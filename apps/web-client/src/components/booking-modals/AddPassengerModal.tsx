import { useState, useEffect } from "react";
import {
  X,
  Search,
  User,
  FileText,
  Check,
  Upload,
  Link,
  Mail,
  CheckCircle2,
  Copy,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Passenger } from "../../types/booking";
import { api } from "../../api/axios";
import toast from "react-hot-toast";
import { PassportOcrScannerModal } from "./PassportOcrScannerModal";
import { ManageAdditionalDocumentsModal } from "./ManageAdditionalDocumentsModal";

interface AddPassengerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (passenger: Partial<Passenger>) => void;
  initialData?: Passenger | null;
  bookingId: number | null;
  allPassengers: Passenger[];
}

export function AddPassengerModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  bookingId,
  allPassengers = [],
}: AddPassengerModalProps) {
  const [form, setForm] = useState<Partial<Passenger>>({
    title: "Mr",
    firstName: "",
    lastName: "",
    ageCategory: "Adult",
    passportNumber: "",
    passportExpiryDate: "",
    dob: "",
    passportImage: "",
    phoneNumber: "",
    email: "",
    role: "Family Member",
    documents: [],
  });

  // Checklist states
  const [collectPassport, setCollectPassport] = useState(true);
  const [collectAdditional, setCollectAdditional] = useState(false);

  // Child modal triggers
  const [showOcrScanner, setShowOcrScanner] = useState(false);
  const [showManageDocuments, setShowManageDocuments] = useState(false);

  // Autocomplete Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await api.get(
          `/bookings/passengers/search?q=${encodeURIComponent(searchQuery)}`,
        );
        setSearchResults(response.data.passengers || []);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setSearching(false);
      }
    }, 450);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        const mappedData = { ...initialData };
        // Format dates correctly for inputs
        [
          "date",
          "issueDate",
          "checkIn",
          "checkOut",
          "dob",
          "expiryDate",
          "departureDate",
          "passportExpiryDate",
        ].forEach((field) => {
          if ((mappedData as any)[field]) {
            try {
              (mappedData as any)[field] = new Date((mappedData as any)[field])
                .toISOString()
                .split("T")[0];
            } catch (e) {}
          }
        });
        if (!mappedData.documents) {
          mappedData.documents = [];
        }
        setForm(mappedData);
        if (mappedData.documents.length > 0) {
          setCollectAdditional(true);
        }
      } else {
        setForm({
          title: "Mr",
          firstName: "",
          lastName: "",
          ageCategory: "Adult",
          passportNumber: "",
          passportExpiryDate: "",
          dob: "",
          passportImage: "",
          phoneNumber: "",
          email: "",
          role: "Family Member",
          documents: [],
        });
        setCollectAdditional(false);
      }
    }
  }, [isOpen, initialData]);

  // Auto-calculate Age Category based on DOB
  const calculateAgeCategory = (dobString: string) => {
    if (!dobString) return;
    const birthDate = new Date(dobString);
    if (isNaN(birthDate.getTime())) return;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    let category = "Adult";
    if (age < 2) {
      category = "Infant";
    } else if (age < 15) {
      category = "Child";
    } else {
      category = "Adult";
    }

    setForm((prev) => ({ ...prev, ageCategory: category }));
  };

  useEffect(() => {
    if (form.dob) {
      calculateAgeCategory(form.dob);
    }
  }, [form.dob]);

  const getCategoryBadgeText = () => {
    if (form.ageCategory === "Adult") {
      return "Adult (15+) -- Auto-calculated from date of birth";
    } else if (form.ageCategory === "Child" || form.ageCategory === "Youth") {
      return "Child (2-14) -- Auto-calculated from date of birth";
    } else if (form.ageCategory === "Infant") {
      return "Infant (<2) -- Auto-calculated from date of birth";
    }
    return "Auto-calculated from date of birth";
  };

  const getPassportExpiryStatus = () => {
    if (!form.passportExpiryDate) return null;
    const expiryDate = new Date(form.passportExpiryDate);
    if (isNaN(expiryDate.getTime())) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiryDate.setHours(0, 0, 0, 0);

    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(today.getMonth() + 6);
    sixMonthsFromNow.setHours(0, 0, 0, 0);

    if (expiryDate < today) {
      return {
        type: "expired",
        message: "Passport has expired!",
        bgColor: "bg-red-50",
        textColor: "text-red-800",
        borderColor: "border-red-100",
        iconColor: "text-red-600"
      };
    } else if (expiryDate < sixMonthsFromNow) {
      return {
        type: "warning",
        message: "Passport is going to expire within the next 6 months!",
        bgColor: "bg-amber-50",
        textColor: "text-amber-800",
        borderColor: "border-amber-100",
        iconColor: "text-amber-600"
      };
    }
    return null;
  };

  const expiryStatus = getPassportExpiryStatus();

  const handleApplyLeaderContact = (field: "email" | "phoneNumber") => {
    const leader = allPassengers.find((p) => p.role === "Leader");
    if (leader) {
      setForm((prev) => ({ ...prev, [field]: leader[field] || "" }));
      toast.success(`Copied ${field} from leader passenger.`);
    } else {
      toast.error("No leader passenger found in this booking.");
    }
  };

  const handleCopyLink = async () => {
    if (!bookingId || !form.id) return;
    try {
      const response = await api.get(
        `/bookings/${bookingId}/passengers/${form.id}/gdpr-link`,
      );
      const link = response.data.gdprLink;
      await navigator.clipboard.writeText(link);
      toast.success("GDPR self-fill link copied to clipboard!");
    } catch (err) {
      console.error("Error getting link:", err);
      toast.error("Failed to retrieve GDPR self-fill link.");
    }
  };

  const handleEmailLink = async () => {
    if (!bookingId || !form.id) return;
    const emailToSend = form.email;
    if (!emailToSend) {
      toast.error("Passenger email address is required to send the link.");
      return;
    }
    try {
      await api.post(
        `/bookings/${bookingId}/passengers/${form.id}/send-gdpr-request`,
        { email: emailToSend },
      );
      toast.success("GDPR self-fill link sent via email!");
    } catch (err: any) {
      console.error("Error sending link email:", err);
      toast.error(
        err.response?.data?.message || "Failed to dispatch email link.",
      );
    }
  };

  const selectSuggestedPassenger = (p: any) => {
    const mapped = { ...p };
    ["dob", "passportExpiryDate"].forEach((field) => {
      if (mapped[field]) {
        try {
          mapped[field] = new Date(mapped[field]).toISOString().split("T")[0];
        } catch (e) {}
      }
    });

    setForm((prev) => ({
      ...prev,
      title: mapped.title || "Mr",
      firstName: mapped.firstName || "",
      lastName: mapped.lastName || "",
      ageCategory: mapped.ageCategory || "Adult",
      passportNumber: mapped.passportNumber || "",
      passportExpiryDate: mapped.passportExpiryDate || "",
      dob: mapped.dob || "",
      passportImage: mapped.passportImage || "",
      phoneNumber: mapped.phoneNumber || "",
      email: mapped.email || "",
      role: mapped.role || "Family Member",
    }));
    setSearchQuery("");
    setSearchResults([]);
    toast.success(`Imported customer ${mapped.firstName} ${mapped.lastName}`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
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
        className="bg-white border border-slate-105 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] relative z-10 overflow-hidden flex flex-col font-sans"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-900 to-indigo-900 text-white px-6 py-4 flex justify-between items-center shadow-inner">
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-indigo-300" />
            <h3 className="font-bold text-[14px] tracking-wide uppercase">
              {initialData ? "Edit Passenger" : "Add Passenger"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable container */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5">
          {/* DOB Category Autocalc Alert Banner */}
          {form.dob && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-100 text-[11px] font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{getCategoryBadgeText()}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left/Middle Columns: Customer Details */}
            <div className="lg:col-span-2 space-y-5">
              {/* Import Existing Passenger (Autocomplete lookup) */}
              {!initialData && (
                <div className="bg-slate-50/50 border border-slate-200/60 rounded-2xl p-5 relative">
                  <h4 className="text-[11px] font-extrabold text-indigo-900 uppercase tracking-wide mb-3 flex items-center gap-1.5 border-b border-indigo-50 pb-1.5">
                    <Search className="w-3.5 h-3.5 text-indigo-500" />
                    IMPORT EXISTING PASSENGER
                  </h4>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search by first name, last name, email or passport..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full border border-slate-200 bg-white rounded-lg pl-9 pr-4 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700 placeholder-slate-400"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    {searching && (
                      <Loader2 className="w-4 h-4 text-primary-500 animate-spin absolute right-3 top-2.5" />
                    )}
                  </div>

                  {/* Autocomplete list */}
                  <AnimatePresence>
                    {searchResults.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute left-5 right-5 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-[180px] overflow-y-auto divide-y divide-slate-100"
                      >
                        {searchResults.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => selectSuggestedPassenger(p)}
                            className="w-full px-4 py-2.5 text-left hover:bg-indigo-50/50 transition-colors flex items-center justify-between text-[11px]"
                          >
                            <div>
                              <p className="font-bold text-slate-800">
                                {p.firstName} {p.lastName}
                              </p>
                              <p className="text-[9px] text-slate-400 mt-0.5">
                                {p.email || "No email"} · Passport:{" "}
                                {p.passportNumber || "None"}
                              </p>
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Personal Information Panel */}
              <div className="border border-slate-200/60 rounded-2xl p-5 space-y-4">
                <h4 className="text-[11px] font-extrabold text-indigo-900 uppercase tracking-wide border-b border-indigo-100 pb-2 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-500" />
                  PERSONAL INFORMATION
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wider">
                      Title
                    </label>
                    <select
                      value={form.title || "Mr"}
                      onChange={(e) =>
                        setForm({ ...form, title: e.target.value })
                      }
                      className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700"
                    >
                      <option value="Mr">Mr</option>
                      <option value="Mrs">Mrs</option>
                      <option value="Ms">Ms</option>
                      <option value="Miss">Miss</option>
                      <option value="Mstr">Mstr</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wider">
                      Role
                    </label>
                    <select
                      value={form.role || "Family Member"}
                      onChange={(e) =>
                        setForm({ ...form, role: e.target.value })
                      }
                      className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700"
                    >
                      <option value="Leader">Leader</option>
                      <option value="Family Member">Family Member</option>
                      <option value="Passenger">Passenger</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wider">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={form.firstName || ""}
                      onChange={(e) =>
                        setForm({ ...form, firstName: e.target.value })
                      }
                      className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wider">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={form.lastName || ""}
                      onChange={(e) =>
                        setForm({ ...form, lastName: e.target.value })
                      }
                      className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wider">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={form.dob || ""}
                      onChange={(e) =>
                        setForm({ ...form, dob: e.target.value })
                      }
                      className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wider">
                      Nationality
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. United Kingdom"
                      value={(form as any).nationality || ""}
                      onChange={(e) =>
                        setForm({ ...form, nationality: e.target.value } as any)
                      }
                      className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                        Email Address *
                      </label>
                      <button
                        type="button"
                        onClick={() => handleApplyLeaderContact("email")}
                        className="text-[9px] text-indigo-600 hover:underline font-extrabold uppercase tracking-wide"
                      >
                        Same as Leader
                      </button>
                    </div>
                    <input
                      type="email"
                      value={form.email || ""}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                      className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                        Phone Number
                      </label>
                      <button
                        type="button"
                        onClick={() => handleApplyLeaderContact("phoneNumber")}
                        className="text-[9px] text-indigo-600 hover:underline font-extrabold uppercase tracking-wide"
                      >
                        Same as Leader
                      </button>
                    </div>
                    <input
                      type="tel"
                      value={form.phoneNumber || ""}
                      onChange={(e) =>
                        setForm({ ...form, phoneNumber: e.target.value })
                      }
                      className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700"
                    />
                  </div>
                </div>
              </div>

              {/* Passport Information Panel */}
              <div className="border border-slate-200/60 rounded-2xl p-5 space-y-4">
                <h4 className="text-[11px] font-extrabold text-indigo-900 uppercase tracking-wide border-b border-indigo-100 pb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-500" />
                  PASSPORT INFORMATION
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wider">
                      Passport Number
                    </label>
                    <input
                      type="text"
                      value={form.passportNumber || ""}
                      onChange={(e) =>
                        setForm({ ...form, passportNumber: e.target.value })
                      }
                      className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700 uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wider">
                      Issuing Country
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. United Kingdom"
                      value={(form as any).issuingCountry || ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          issuingCountry: e.target.value,
                        } as any)
                      }
                      className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wider">
                      Passport Expiry Date
                    </label>
                    <input
                      type="date"
                      value={form.passportExpiryDate || ""}
                      onChange={(e) =>
                        setForm({ ...form, passportExpiryDate: e.target.value })
                      }
                      className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700"
                    />
                  </div>
                </div>

                {/* Expiry Warning Alert Banner */}
                {expiryStatus && (
                  <div className={`mt-3 flex items-center gap-2 p-3 ${expiryStatus.bgColor} ${expiryStatus.textColor} rounded-xl border ${expiryStatus.borderColor} text-[11px] font-bold`}>
                    <svg className={`w-4 h-4 ${expiryStatus.iconColor} shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{expiryStatus.message}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Actions, Scanner, Checkbox Documents */}
            <div className="space-y-5">
              {/* Documents to Collect Checklist */}
              <div className="border border-slate-200/60 rounded-2xl p-5 space-y-3">
                <h4 className="text-[11px] font-extrabold text-indigo-900 uppercase tracking-wide mb-1 flex items-center gap-1.5 border-b border-indigo-50 pb-1">
                  <FileText className="w-3.5 h-3.5 text-indigo-500" />
                  DOCUMENTS TO COLLECT
                </h4>
                <div className="space-y-2.5">
                  <label className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-200/50 rounded-xl cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={collectPassport}
                      onChange={(e) => setCollectPassport(e.target.checked)}
                      className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500/20 border-slate-300 accent-primary-600"
                    />
                    <span className="text-[11px] font-bold text-slate-700">
                      Collect Passport details & scan
                    </span>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-200/50 rounded-xl cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={collectAdditional}
                      onChange={(e) => setCollectAdditional(e.target.checked)}
                      className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500/20 border-slate-300 accent-primary-600"
                    />
                    <span className="text-[11px] font-bold text-slate-700">
                      Collect Additional documents
                    </span>
                  </label>
                </div>
              </div>

              {/* Passport Scan Panel */}
              {collectPassport && (
                <div className="border border-slate-200/60 rounded-2xl p-5 space-y-3">
                  <h4 className="text-[11px] font-extrabold text-indigo-900 uppercase tracking-wide flex items-center gap-1.5 border-b border-indigo-50 pb-1">
                    <FileText className="w-3.5 h-3.5 text-indigo-500" />
                    PASSPORT SCAN / PHOTO
                  </h4>
                  {form.passportImage ? (
                    <div className="p-3.5 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-[11px] font-bold">
                          Passport Scan Uploaded
                        </span>
                      </div>
                      <div className="flex gap-2 text-[9px] font-extrabold uppercase tracking-wide">
                        <a
                          href={form.passportImage}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-500 hover:text-slate-700 hover:underline"
                        >
                          View
                        </a>
                        <button
                          type="button"
                          onClick={() => setShowOcrScanner(true)}
                          className="text-indigo-600 hover:text-indigo-750 hover:underline"
                        >
                          Replace
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setForm({ ...form, passportImage: "" })
                          }
                          className="text-red-650 hover:text-red-750 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => setShowOcrScanner(true)}
                      className="border border-dashed border-slate-300 hover:border-primary-400 rounded-xl p-4 bg-white/50 hover:bg-indigo-50/20 flex flex-col items-center justify-center text-center cursor-pointer transition-all"
                    >
                      <Upload className="w-4 h-4 text-indigo-600 mb-2" />
                      <span className="text-[11px] font-bold text-slate-700">
                        Scan or upload passport details page
                      </span>
                      <span className="text-[9px] text-slate-400 mt-1">
                        PDF, JPEG, or PNG up to 10MB
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Additional Documents Panel */}
              {collectAdditional && (
                <div className="border border-slate-200/60 rounded-2xl p-5 space-y-3">
                  <div className="flex justify-between items-center mb-1 border-b border-indigo-50 pb-1">
                    <h4 className="text-[11px] font-extrabold text-indigo-900 uppercase tracking-wide flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-indigo-500" />
                      ADDITIONAL DOCUMENTS
                    </h4>
                    <span className="bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded-full text-[9px] font-extrabold">
                      {(form.documents || []).length} files
                    </span>
                  </div>

                  {(form.documents || []).length > 0 && (
                    <div className="max-h-[110px] overflow-y-auto pr-1 space-y-1.5">
                      {(form.documents || []).map((doc, idx) => (
                        <div
                          key={doc.id || idx}
                          className="flex items-center justify-between p-2 border border-slate-200 bg-white rounded-lg text-[10px]"
                        >
                          <span className="font-bold text-slate-700 truncate max-w-[130px]">
                            {doc.title}
                          </span>
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[9px] text-indigo-600 hover:underline font-bold"
                          >
                            View
                          </a>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowManageDocuments(true)}
                    className="w-full bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 py-2.5 rounded-xl text-[11px] font-bold transition-all uppercase tracking-wide"
                  >
                    Manage Documents
                  </button>
                </div>
              )}

              {/* Self-fill direct Link block */}
              {form.id && (
                <div className="border border-slate-200/60 rounded-2xl p-5 bg-slate-50/50 space-y-3">
                  <h4 className="text-[11px] font-extrabold text-indigo-900 uppercase tracking-wide flex items-center gap-1.5 border-b border-indigo-50 pb-1">
                    <Link className="w-3.5 h-3.5 text-indigo-500" />
                    SELF-FILL LINK
                  </h4>
                  <p className="text-[9px] font-semibold text-slate-500 leading-relaxed">
                    Send a secure request form link so the passenger can fill in
                    their details directly.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="flex-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-2 rounded-xl text-[10px] font-extrabold transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      Copy Link
                    </button>
                    <button
                      type="button"
                      onClick={handleEmailLink}
                      className="flex-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-2 rounded-xl text-[10px] font-extrabold transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                    >
                      <Mail className="w-3.5 h-3.5 text-slate-500" />
                      Email Link
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="border-t border-slate-100 p-4 bg-slate-50/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-[11px] font-bold text-slate-600 hover:bg-slate-200/50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSubmit(form);
              onClose();
            }}
            className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-2.5 rounded-xl text-[11px] font-bold shadow-lg shadow-primary-600/30 transition-all uppercase tracking-wider active:scale-95"
          >
            {initialData ? "Save Changes" : "Add Passenger"}
          </button>
        </div>
      </motion.div>

      {/* Child modals */}
      <AnimatePresence>
        {showOcrScanner && (
          <PassportOcrScannerModal
            isOpen={showOcrScanner}
            onClose={() => setShowOcrScanner(false)}
            onApply={(ocrData) => {
              setForm((prev) => ({
                ...prev,
                firstName: ocrData.firstName || prev.firstName,
                lastName: ocrData.lastName || prev.lastName,
                passportNumber: ocrData.passportNumber || prev.passportNumber,
                dob: ocrData.dob || prev.dob,
                passportExpiryDate:
                  ocrData.passportExpiryDate || prev.passportExpiryDate,
                passportImage: ocrData.passportImage || prev.passportImage,
                nationality: ocrData.nationality || prev.nationality,
                issuingCountry: ocrData.issuingCountry || prev.issuingCountry,
              }));
              toast.success("Passport OCR details applied!");
            }}
          />
        )}

        {showManageDocuments && (
          <ManageAdditionalDocumentsModal
            isOpen={showManageDocuments}
            onClose={() => setShowManageDocuments(false)}
            bookingId={bookingId}
            passengerId={form.id}
            documents={form.documents || []}
            onChange={(updatedDocs) => {
              setForm((prev) => ({ ...prev, documents: updatedDocs }));
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
