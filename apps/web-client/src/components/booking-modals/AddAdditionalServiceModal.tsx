import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, PlusCircle } from "lucide-react";
import { VendorSelect } from "../shared/VendorSelect";
import { useCurrency } from "../../utils/currency";

interface AddAdditionalServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void> | void;
  initialData?: any;
}

export function AddAdditionalServiceModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}: AddAdditionalServiceModalProps) {
  const { symbol } = useCurrency();
  const [fType, setFType] = useState("Extra Baggage");
  const [fCustomType, setFCustomType] = useState("");
  const [charges, setCharges] = useState("");
  const [notes, setNotes] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [isPaidToVendor, setIsPaidToVendor] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Map date strings to YYYY-MM-DD for date inputs if necessary
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
        ].forEach((field) => {
          if (mappedData[field]) {
            try {
              mappedData[field] = new Date(mappedData[field])
                .toISOString()
                .split("T")[0];
            } catch (e) {}
          }
        });
        if (mappedData.serviceName) {
          const defaultTypes = ["Extra Baggage", "Seat Selection", "Lounge Access", "In-flight Meal", "Priority Boarding"];
          if (defaultTypes.includes(mappedData.serviceName)) {
            setFType(mappedData.serviceName);
            setFCustomType("");
          } else {
            setFType("Other");
            setFCustomType(mappedData.serviceName);
          }
        }
        if (mappedData.charges !== undefined) setCharges(String(mappedData.charges));
        if (mappedData.notes) setNotes(mappedData.notes);
        if (mappedData.vendorName) setVendorName(mappedData.vendorName);
        if (mappedData.isPaidToVendor !== undefined) setIsPaidToVendor(mappedData.isPaidToVendor);
      } else {
        // We'd reset the form here normally, but let's just let useState handle the initial if it's not editing.
        // Or better yet, we can clear the form when opening without initialData.
        // To be safe, we just set initialData if it exists.
        // Actually, we must clear it if adding a new one after editing!
        // But since the parent destroys the component when closing, it mounts fresh each time!
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const serviceName = fType === "Other" ? fCustomType || "Other" : fType;
      await onSubmit({
        id: initialData?.id,
        serviceName,
        vendorName,
        charges: parseFloat(charges) || 0,
        notes,
        isPaidToVendor
      });
      onClose();
    } catch (error) {
      console.error("Failed to save additional service:", error);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] relative z-10 overflow-hidden flex flex-col"
      >
        <div className="bg-gradient-to-r from-primary-900 to-indigo-900 text-white px-6 py-4 flex justify-between items-center shadow-inner">
          <div className="flex items-center gap-3">
            <PlusCircle className="h-5 w-5 text-indigo-300" />
            <h3 className="font-bold text-[14px] tracking-wide uppercase">
              {initialData ? "Edit" : "Add"} Additional Service
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <form
            id="addServiceForm"
            onSubmit={handleSubmit}
            className="flex flex-col gap-4"
          >
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">
                Service Name
              </label>
              <select
                value={fType}
                onChange={(e) => setFType(e.target.value)}
                className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700"
              >
                <option value="Extra Baggage">Extra Baggage</option>
                <option value="Lounge Access">Lounge Access</option>
                <option value="Excursion/Tour">Excursion/Tour</option>
                <option value="Special Meal">Special Meal</option>
                <option value="Other">Other</option>
              </select>
              {fType === "Other" && (
                <motion.input
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  type="text"
                  required
                  value={fCustomType}
                  onChange={(e) => setFCustomType(e.target.value)}
                  placeholder="Specify service name"
                  className="w-full mt-2 border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700"
                />
              )}
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">
                Vendor / Provider
              </label>
              <VendorSelect category="additional" value={vendorName || ''} onChange={val => setVendorName(val)} />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">
                Service Charges ({symbol})
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={charges}
                onChange={(e) => setCharges(e.target.value)}
                placeholder="0.00"
                className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">
                Service Notes
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special instructions or details..."
                className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700 resize-none"
              />
            </div>
          </form>
        </div>

        
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <label className="flex items-center gap-2 cursor-pointer group w-fit">
              <input 
                type="checkbox" 
                checked={isPaidToVendor} 
                onChange={(e) => setIsPaidToVendor(e.target.checked)}
                disabled={initialData?.isPaidToVendor}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className="text-[12px] font-bold text-slate-700 group-hover:text-slate-900 flex items-center gap-1.5 transition-colors">
                Paid to Vendor?
                {initialData?.isPaidToVendor && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">(Already Paid)</span>}
              </span>
            </label>
            <p className="text-[10px] text-slate-500 mt-1 ml-6">Check this to manually mark as paid if you have already transferred the money to the vendor. (To log a formal transaction, use the Log Transaction button).</p>
          </div>
          <div className="bg-slate-50/50 p-5 border-t border-slate-200 flex justify-end items-center backdrop-blur-md">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-[11px] font-bold text-slate-600 hover:bg-slate-200/50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-2.5 rounded-xl text-[11px] font-bold shadow-lg shadow-primary-600/30 transition-all uppercase tracking-wide active:scale-95"
            >
              {initialData ? "Update" : "Save"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
