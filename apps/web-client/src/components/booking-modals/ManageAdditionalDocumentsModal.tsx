import { useState } from "react";
import { X, Upload, Loader2, Plus, Trash2, FileText, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { api } from "../../api/axios";
import toast from "react-hot-toast";

interface PassengerDocument {
  id?: number;
  title: string;
  description?: string;
  fileUrl: string;
}

interface ManageAdditionalDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: number | null;
  passengerId?: number;
  documents: PassengerDocument[];
  onChange: (docs: PassengerDocument[]) => void;
  isPublic?: boolean;
}

const QUICK_TAGS = [
  "E-visa",
  "Share Code",
  "Travel Insurance",
  "Hotel Voucher",
  "Vaccination Record"
];

export function ManageAdditionalDocumentsModal({
  isOpen,
  onClose,
  bookingId,
  passengerId,
  documents,
  onChange,
  isPublic = false,
}: ManageAdditionalDocumentsModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size exceeds 5MB limit.");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      let response;
      if (isPublic) {
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
        const axios = (await import("axios")).default;
        response = await axios.post(`${API_BASE_URL}/auth/upload`, formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      } else {
        response = await api.post("/auth/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      }
      setFileUrl(response.data.url);
      setFileName(file.name);
      toast.success("Document attached successfully!");
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error("Failed to upload document file.");
    } finally {
      setUploading(false);
    }
  };

  const handleAddDocument = async () => {
    if (!title.trim()) {
      toast.error("Document title is required.");
      return;
    }

    if (!fileUrl) {
      toast.error("Please upload/attach a file first.");
      return;
    }

    // If existing passenger, save directly to backend
    if (passengerId && !isPublic) {
      setSaving(true);
      try {
        const response = await api.post(`/bookings/${bookingId}/passengers/${passengerId}/documents`, {
          title,
          description,
          fileUrl,
        });
        const newDoc = response.data.document;
        onChange([...documents, newDoc]);
        toast.success("Document saved successfully!");
        resetForm();
      } catch (err) {
        console.error("Add doc error:", err);
        toast.error("Failed to save document to database.");
      } finally {
        setSaving(false);
      }
    } else {
      // Local state update for new passenger
      const newDoc: PassengerDocument = {
        // Generate a temp local ID
        id: Math.floor(Math.random() * -100000),
        title,
        description,
        fileUrl,
      };
      onChange([...documents, newDoc]);
      toast.success("Document added!");
      resetForm();
    }
  };

  const handleDelete = async (doc: PassengerDocument) => {
    const docId = doc.id;
    if (!docId) return;

    // If existing passenger and saved document in backend
    if (passengerId && docId > 0 && !isPublic) {
      setDeletingId(docId);
      try {
        await api.delete(`/bookings/${bookingId}/passengers/${passengerId}/documents/${docId}`);
        onChange(documents.filter(d => d.id !== docId));
        toast.success("Document removed successfully!");
      } catch (err) {
        console.error("Delete doc error:", err);
        toast.error("Failed to delete document.");
      } finally {
        setDeletingId(null);
      }
    } else {
      // Local deletion for new passenger
      onChange(documents.filter(d => d.id !== docId));
      toast.success("Document removed!");
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setFileUrl("");
    setFileName("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white border border-slate-100 rounded-2xl shadow-2xl w-full max-w-xl relative z-10 overflow-hidden flex flex-col font-sans"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-900 to-indigo-900 text-white px-6 py-4 flex justify-between items-center shadow-inner">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-indigo-300" />
            <h3 className="font-bold text-[14px] tracking-wide uppercase">
              Manage Additional Documents
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh] flex flex-col gap-6">
          <p className="text-[11px] font-semibold text-slate-500 leading-relaxed">
            Upload and organize visa letters, hotel vouchers, insurance policy documents, vaccination records, etc., for this passenger.
          </p>

          {/* Current Documents list */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-extrabold text-indigo-900 uppercase tracking-wider border-b border-indigo-50 pb-1">
              Uploaded Documents ({documents.length})
            </h4>
            {documents.length === 0 ? (
              <div className="border border-slate-100 bg-slate-50/50 rounded-xl p-6 text-center text-slate-400 text-[11px] font-bold">
                No documents uploaded yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                {documents.map((doc, idx) => (
                  <div
                    key={doc.id || idx}
                    className="flex items-center justify-between p-3 border border-slate-200/80 bg-white/70 rounded-xl hover:border-slate-350 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-650 flex items-center justify-center shrink-0 border border-indigo-100">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-slate-800 truncate">{doc.title}</p>
                        {doc.description && (
                          <p className="text-[9px] text-slate-500 truncate mt-0.5">{doc.description}</p>
                        )}
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[9px] text-indigo-600 hover:underline font-bold uppercase tracking-wider block mt-1"
                        >
                          View Document
                        </a>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={deletingId === doc.id}
                      onClick={() => handleDelete(doc)}
                      className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      {deletingId === doc.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <hr className="border-slate-100" />

          {/* Add New Document Form */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-extrabold text-indigo-900 uppercase tracking-wide border-b border-indigo-100 pb-1">
              + ADD NEW DOCUMENT
            </h4>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">
                Document Title *
              </label>
              <input
                type="text"
                placeholder="e.g. E-visa, Hotel Voucher, Travel Insurance"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {QUICK_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setTitle(tag)}
                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-750 rounded-full text-[9px] font-extrabold transition-all"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">
                Description / Details (Optional)
              </label>
              <textarea
                placeholder="e.g. Share code: S1234567G, policy number, notes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-750"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">
                File Attachment *
              </label>
              {fileUrl ? (
                <div className="flex items-center justify-between p-3 border border-emerald-100 bg-emerald-50/20 rounded-xl">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-[10px] font-bold text-slate-700 truncate">
                      {fileName || "File attached successfully"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFileUrl("");
                      setFileName("");
                    }}
                    className="p-1.5 text-slate-400 hover:text-slate-650 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative border border-dashed border-slate-200 hover:border-primary-400 rounded-xl p-4 transition-colors bg-white/50 flex flex-col items-center justify-center text-center cursor-pointer">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {uploading ? (
                    <Loader2 className="w-5 h-5 text-primary-600 animate-spin" />
                  ) : (
                    <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                      <Upload className="w-4 h-4 text-primary-600" />
                      <span>Attach a file (JPEG, PNG, PDF · Max 5MB)</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleAddDocument}
              disabled={saving}
              className="w-full bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white py-2.5 rounded-xl text-[11px] font-extrabold shadow-sm transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add Document
            </button>
          </div>
        </div>

        <div className="border-t border-slate-100 p-4 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-2 rounded-xl text-[11px] font-bold shadow-md shadow-primary-600/20 transition-colors uppercase tracking-wider"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
}
