import { useState } from "react";
import { X, Upload, Loader2, Check, RefreshCw, FileText, CheckCircle, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import Tesseract from "tesseract.js";
import toast from "react-hot-toast";

interface PassportOcrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (data: {
    firstName?: string;
    lastName?: string;
    passportNumber?: string;
    dob?: string;
    passportExpiryDate?: string;
    passportImage?: string;
    nationality?: string;
    issuingCountry?: string;
  }) => void;
  isPublic?: boolean;
}

interface OCRResult {
  passportNumber?: string;
  firstName?: string;
  lastName?: string;
  dob?: string;
  expiryDate?: string;
  issuingCountry?: string;
  nationality?: string;
}

const countryCodes: Record<string, string> = {
  GBR: "United Kingdom",
  USA: "United States",
  CAN: "Canada",
  AUS: "Australia",
  NZL: "New Zealand",
  IRL: "Ireland",
  FRA: "France",
  DEU: "Germany",
  ITA: "Italy",
  ESP: "Spain",
  PRT: "Portugal",
  NLD: "Netherlands",
  BEL: "Belgium",
  CHE: "Switzerland",
  SWE: "Sweden",
  NOR: "Norway",
  DNK: "Denmark",
  FIN: "Finland",
  ZAF: "South Africa",
  IND: "India",
  PAK: "Pakistan",
  BGD: "Bangladesh",
  LKA: "Sri Lanka",
};

export function PassportOcrScannerModal({
  isOpen,
  onClose,
  onApply,
  isPublic = false,
}: PassportOcrScannerModalProps) {
  const [image, setImage] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [scanning, setScanning] = useState(false);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);

  // Field edit states after OCR
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [passportNumber, setPassportNumber] = useState("");
  const [dob, setDob] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [nationality, setNationality] = useState("");
  const [issuingCountry, setIssuingCountry] = useState("");

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error("File size exceeds 10MB limit.");
      return;
    }

    setFile(selectedFile);
    if (selectedFile.type === "application/pdf") {
      setImage(null);
      // Immediately open fields for manual details entry
      setOcrResult({});
      toast.success("Passport PDF attached successfully!");
    } else {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setOcrResult(null);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const cleanName = (nameStr: string): string => {
    if (!nameStr) return "";
    
    // Split by spaces/newlines
    const words = nameStr.split(/\s+/);
    
    // Filter words to remove lowercase noise (e.g. "as", "a") when there's an uppercase name
    const cleanedWords = words.filter(w => {
      if (/[a-z]/.test(w) && words.some(other => /[A-Z]/.test(other) && !/[a-z]/.test(other))) {
        return false;
      }
      const lettersOnly = w.replace(/[^A-Za-z]/g, "");
      if (lettersOnly.length === 0) return false;
      return true;
    });

    const finalString = cleanedWords
      .map(w => w.replace(/[^A-Za-z\-]/g, "").toUpperCase())
      .filter(w => w.length > 0)
      .join(" ");

    return finalString;
  };

  const parsePassportText = (text: string): OCRResult => {
    const result: OCRResult = {};
    const rawLines = text.split("\n").map(l => l.trim());
    const lines = rawLines.map(l => l.replace(/\s+/g, "").toUpperCase());

    // 1. Try to find standard passport MRZ lines
    const mrzLines = lines.filter(l => (l.includes("<") || l.includes("<<")) && l.length >= 25);

    if (mrzLines.length >= 2) {
      const line1 = mrzLines.find(l => l.startsWith("P") && (l.includes("<") || l.includes("<<")));
      const line2 = mrzLines.find(l => l !== line1 && /[0-9]{6}/.test(l));

      if (line1) {
        const issuingCountryCode = line1.substring(2, 5).replace(/</g, "").trim();
        if (/^[A-Z]{3}$/.test(issuingCountryCode)) {
          result.issuingCountry = countryCodes[issuingCountryCode] || issuingCountryCode;
        }

        const rest = line1.substring(5);
        const nameParts = rest.split("<<");
        if (nameParts[0]) {
          result.lastName = cleanName(nameParts[0]);
        }
        if (nameParts[1]) {
          result.firstName = cleanName(nameParts[1]);
        }
      }

      if (line2) {
        const passportNo = line2.substring(0, 9).replace(/</g, "").trim();
        if (/^[A-Z0-9]{9}$/.test(passportNo)) {
          result.passportNumber = passportNo;
        }

        const nationalityCode = line2.substring(10, 13).replace(/</g, "").trim();
        if (/^[A-Z]{3}$/.test(nationalityCode)) {
          result.nationality = countryCodes[nationalityCode] || nationalityCode;
        }

        const dobStr = line2.substring(13, 19);
        if (/^[0-9]{6}$/.test(dobStr)) {
          const yy = parseInt(dobStr.substring(0, 2));
          const mm = parseInt(dobStr.substring(2, 4));
          const dd = parseInt(dobStr.substring(4, 6));
          const currentYear = new Date().getFullYear() % 100;
          const year = yy > currentYear ? 1900 + yy : 2000 + yy;
          result.dob = `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
        }

        const expStr = line2.substring(21, 27);
        if (/^[0-9]{6}$/.test(expStr)) {
          const yy = parseInt(expStr.substring(0, 2));
          const mm = parseInt(expStr.substring(2, 4));
          const dd = parseInt(expStr.substring(4, 6));
          const year = 2000 + yy;
          result.expiryDate = `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
        }
      }
    }

    // Helper to convert DD MMM YY date strings (e.g. "27 JUN /JUIN 24" or "27 JUN 34")
    const parsePassportDate = (dateStr: string): string => {
      const cleaned = dateStr.replace(/\/[A-Z]+/g, "").replace(/\s+/g, " ").trim();
      const parts = cleaned.split(" ");
      if (parts.length >= 3) {
        const day = parseInt(parts[0]);
        const monthName = parts[1].toUpperCase();
        let year = parseInt(parts[2]);

        const months: Record<string, string> = {
          JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
          JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12"
        };

        const month = months[monthName.substring(0, 3)];
        if (day && month && year) {
          if (year < 100) {
            const currentYear = new Date().getFullYear() % 100;
            year = year > currentYear + 10 ? 1900 + year : 2000 + year;
          }
          return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        }
      }
      return "";
    };

    // 2. Regex fallback for Passport Number with word exclusion
    if (!result.passportNumber) {
      const matches = text.match(/\b([A-Z0-9]{9})\b/gi) || [];
      const ignoredWords = ["PASSEPORT", "PASSPORT", "DOCUMENT", "NATIONAL", "AUTHORIT", "REPUBLIC", "BIRTHDAY"];
      const validMatch = matches.find(m => !ignoredWords.includes(m.toUpperCase()));
      if (validMatch) {
        result.passportNumber = validMatch.toUpperCase();
      }
    }

    // 3. Match dates like "27 JUN /JUIN 34" or "27 JUN 2034"
    const datePattern = /\b\d{1,2}\s+[A-Z]{3,4}(?:\s*\/[A-Z]+)?\s+(?:\d{4}|\d{2})\b/gi;
    const foundDates = text.match(datePattern) || [];

    if (foundDates.length >= 2) {
      const parsedDates = foundDates.map(d => parsePassportDate(d)).filter(Boolean).sort();
      if (parsedDates.length >= 2) {
        if (!result.dob) result.dob = parsedDates[0];
        if (!result.expiryDate) result.expiryDate = parsedDates[parsedDates.length - 1];
      }
    } else if (foundDates.length === 1) {
      const singleDate = parsePassportDate(foundDates[0]);
      const currentYear = new Date().getFullYear();
      const parsedYear = parseInt(singleDate.split("-")[0]);
      if (parsedYear > currentYear) {
        if (!result.expiryDate) result.expiryDate = singleDate;
      } else {
        if (!result.dob) result.dob = singleDate;
      }
    }

    // 4. Fallback for Names, Nationality, and Issuing Country using labels
    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i].toUpperCase();
      if (line.includes("SURNAME") || line.includes("NOM")) {
        if (i + 1 < rawLines.length) {
          const nextLine = rawLines[i + 1].trim();
          if (nextLine && !nextLine.includes("/") && nextLine.length > 2 && !result.lastName) {
            result.lastName = cleanName(nextLine);
          }
        }
      }
      if (line.includes("GIVEN") || line.includes("PRENOM")) {
        if (i + 1 < rawLines.length) {
          const nextLine = rawLines[i + 1].trim();
          if (nextLine && !nextLine.includes("/") && nextLine.length > 2 && !result.firstName) {
            result.firstName = cleanName(nextLine);
          }
        }
      }
      if (line.includes("NATIONALITY") || line.includes("NATIONALITE")) {
        if (i + 1 < rawLines.length) {
          const nextLine = rawLines[i + 1].trim();
          if (nextLine && !nextLine.includes("/") && nextLine.length > 2 && !result.nationality) {
            result.nationality = cleanName(nextLine);
          }
        }
      }
      if (line.includes("ISSUINGSTATE") || line.includes("STATUSEMET") || line.includes("STATEEMETTEUR") || line.includes("AUTHORITY") || line.includes("AUTORITE")) {
        if (i + 1 < rawLines.length) {
          const nextLine = rawLines[i + 1].trim();
          if (nextLine && nextLine.length >= 3 && !result.issuingCountry) {
            result.issuingCountry = countryCodes[nextLine.toUpperCase()] || nextLine;
          }
        }
      }
    }

    // Try regex names if still missing
    if (!result.lastName) {
      const surnameMatch = text.match(/(?:surname|last\s*name|nom)\s*[:\-]*\s*([A-Z\s\-]+)/i);
      if (surnameMatch && surnameMatch[1].trim().length > 2) {
        result.lastName = cleanName(surnameMatch[1]);
      }
    }
    if (!result.firstName) {
      const givenMatch = text.match(/(?:given\s*names?|first\s*name|prénoms?)\s*[:\-]*\s*([A-Z\s\-]+)/i);
      if (givenMatch && givenMatch[1].trim().length > 2) {
        result.firstName = cleanName(givenMatch[1]);
      }
    }

    return result;
  };

  const startScan = async () => {
    if (!image) return;

    setScanning(true);
    setProgress(0);
    setStatusText("Initializing Scanner...");

    try {
      const { data: { text } } = await Tesseract.recognize(
        image,
        "eng",
        {
          logger: (m) => {
            if (m.status === "recognizing text") {
              setProgress(Math.round(m.progress * 100));
              setStatusText(`Scanning Passport details... (${Math.round(m.progress * 100)}%)`);
            } else {
              setStatusText(m.status);
            }
          },
        }
      );

      const parsed = parsePassportText(text);
      setOcrResult(parsed);

      setFirstName(parsed.firstName || "");
      setLastName(parsed.lastName || "");
      setPassportNumber(parsed.passportNumber || "");
      setDob(parsed.dob || "");
      setExpiryDate(parsed.expiryDate || "");
      setNationality(parsed.nationality || "");
      setIssuingCountry(parsed.issuingCountry || "");

      toast.success("Passport scanned successfully!");
    } catch (err: any) {
      console.error("OCR Scan failed:", err);
      toast.error("Failed to parse passport text. Please upload a clearer copy.");
    } finally {
      setScanning(false);
      setProgress(0);
      setStatusText("");
    }
  };

  const handleApply = async () => {
    let uploadedUrl = "";
    if (file) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        if (isPublic) {
          const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
          const axios = (await import("axios")).default;
          const response = await axios.post(`${API_BASE_URL}/auth/upload`, formData, {
            headers: { "Content-Type": "multipart/form-data" }
          });
          uploadedUrl = response.data.url;
        } else {
          const { api } = await import("../../api/axios");
          const response = await api.post("/auth/upload", formData, {
            headers: { "Content-Type": "multipart/form-data" }
          });
          uploadedUrl = response.data.url;
        }
      } catch (err) {
        console.error("Failed to upload scan file:", err);
      }
    }

    onApply({
      firstName,
      lastName,
      passportNumber,
      dob,
      passportExpiryDate: expiryDate,
      nationality,
      issuingCountry,
      ...(uploadedUrl && { passportImage: uploadedUrl }),
    });
    onClose();
  };

  const handleRemoveFile = () => {
    setImage(null);
    setFile(null);
    setOcrResult(null);
  };

  if (!isOpen) return null;

  const isPdf = file?.type === "application/pdf";

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
        className="bg-white border border-slate-105 rounded-2xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden flex flex-col font-sans"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-900 to-indigo-900 text-white px-6 py-4 flex justify-between items-center shadow-inner">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-indigo-300" />
            <h3 className="font-bold text-[14px] tracking-wide uppercase">
              Passport OCR Scanner
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh] flex flex-col gap-5">
          {!image && !isPdf ? (
            <div className="relative border-2 border-dashed border-slate-200 hover:border-primary-500 rounded-xl p-8 transition-colors bg-slate-50/50 flex flex-col items-center justify-center text-center cursor-pointer">
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleImageChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center gap-3">
                <div className="p-3 bg-white text-primary-600 rounded-xl border border-slate-100 shadow-sm">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[12px] font-bold text-slate-700 block">
                    Upload Passport Scan / Photo / PDF
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Upload details page (JPEG, PNG, PDF up to 10MB)
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {isPdf ? (
                <div className="p-4 border border-indigo-100 bg-indigo-50/20 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-white border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-sm">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-slate-800 truncate">
                        {file?.name}
                      </p>
                      <p className="text-[9px] text-slate-505 mt-0.5">
                        PDF Document Attached
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleRemoveFile}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-650 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 max-h-[220px] flex items-center justify-center">
                  <img src={image || ""} alt="Passport Scan" className="max-h-[220px] object-contain w-full" />
                  {!ocrResult && !scanning && (
                    <button
                      onClick={handleRemoveFile}
                      className="absolute top-2 right-2 bg-slate-900/60 hover:bg-slate-900/80 text-white rounded-lg p-1.5 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {scanning && (
                <div className="p-4 border border-indigo-100 bg-indigo-50/30 rounded-xl flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-indigo-900">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {statusText}
                    </span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-primary-600 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {!ocrResult && !scanning && !isPdf && (
                <button
                  onClick={startScan}
                  className="w-full bg-primary-600 hover:bg-primary-500 text-white py-3 rounded-xl text-[12px] font-bold shadow-md shadow-primary-600/20 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Start OCR Scanning
                </button>
              )}

              {ocrResult && (
                <div className="flex flex-col gap-4 border-t border-slate-100 pt-4">
                  <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-100 text-[11px] font-bold">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    {isPdf ? (
                      <span>PDF Passport copy attached. Please fill details below.</span>
                    ) : (
                      <span>Passport Scan Active - Automatically extract personal information</span>
                    )}
                  </div>

                  <div className="flex items-start gap-2.5 p-3 bg-amber-50 text-amber-800 rounded-xl border border-amber-200 text-[11px] font-semibold leading-relaxed">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>Please double-check all details below. OCR scanning can occasionally contain inaccuracies.</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-[10px] font-extrabold text-slate-500 mb-1 uppercase tracking-wide">
                        First Name
                      </label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full border border-slate-200 bg-slate-50/50 rounded-lg px-3 py-2 text-[11px] font-bold text-slate-700 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-extrabold text-slate-500 mb-1 uppercase tracking-wide">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full border border-slate-200 bg-slate-50/50 rounded-lg px-3 py-2 text-[11px] font-bold text-slate-700 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-extrabold text-slate-500 mb-1 uppercase tracking-wide">
                        Passport Number
                      </label>
                      <input
                        type="text"
                        value={passportNumber}
                        onChange={(e) => setPassportNumber(e.target.value)}
                        className="w-full border border-slate-200 bg-slate-50/50 rounded-lg px-3 py-2 text-[11px] font-bold text-slate-700 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 mb-1 uppercase tracking-wide">
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        className="w-full border border-slate-200 bg-slate-50/50 rounded-lg px-3 py-2 text-[11px] font-bold text-slate-700 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 mb-1 uppercase tracking-wide">
                        Expiry Date
                      </label>
                      <input
                        type="date"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                        className="w-full border border-slate-200 bg-slate-50/50 rounded-lg px-3 py-2 text-[11px] font-bold text-slate-700 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 mb-1 uppercase tracking-wide">
                        Nationality
                      </label>
                      <input
                        type="text"
                        value={nationality}
                        onChange={(e) => setNationality(e.target.value)}
                        className="w-full border border-slate-200 bg-slate-50/50 rounded-lg px-3 py-2 text-[11px] font-bold text-slate-700 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 mb-1 uppercase tracking-wide">
                        Issuing Country
                      </label>
                      <input
                        type="text"
                        value={issuingCountry}
                        onChange={(e) => setIssuingCountry(e.target.value)}
                        className="w-full border border-slate-200 bg-slate-50/50 rounded-lg px-3 py-2 text-[11px] font-bold text-slate-700 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 p-4 bg-slate-50/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-[11px] font-bold text-slate-650 hover:bg-slate-200/50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!ocrResult}
            className="bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl text-[11px] font-bold shadow-lg shadow-primary-600/20 transition-all flex items-center gap-1.5 uppercase tracking-wider"
          >
            <Check className="w-4 h-4" />
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
}
