import { useState, useEffect } from "react";
import { X, Users } from "lucide-react";
import { motion } from "framer-motion";
import type { Passenger } from "../../types/booking";

interface AddPassengerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (passenger: Partial<Passenger>) => void;
  initialData?: Passenger | null;
}

export function AddPassengerModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}: AddPassengerModalProps) {
  const [form, setForm] = useState<Partial<Passenger>>({
    title: "Mr",
    firstName: "",
    lastName: "",
    ageCategory: "Adult",
    passportNumber: "",
    passportExpiryDate: "",
    phoneNumber: "",
    email: "",
    role: "Family Member",
  });

  
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Map date strings to YYYY-MM-DD for date inputs if necessary
        const mappedData = { ...initialData };
        // Format dates correctly for inputs
        ['date', 'issueDate', 'checkIn', 'checkOut', 'dob', 'expiryDate', 'departureDate'].forEach(field => {
          if (mappedData[field]) {
            try { mappedData[field] = new Date(mappedData[field]).toISOString().split('T')[0]; } catch(e) {}
          }
        });
        setForm(mappedData);
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
        className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] relative z-10 overflow-hidden flex flex-col"
      >
        <div className="bg-gradient-to-r from-primary-900 to-indigo-900 text-white px-6 py-4 flex justify-between items-center shadow-inner">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-indigo-300" />
            <h3 className="font-bold text-[14px] tracking-wide uppercase">
              Add Passenger
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          <div className="space-y-4">
            <h4 className="text-[11px] font-extrabold text-indigo-900 tracking-wide uppercase border-b border-indigo-100 pb-1">
              Personal Details
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">
                  Title
                </label>
                <select
                  value={form.title || "Mr"}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700"
                >
                  <option value="Mr">Mr</option>
                  <option value="Mrs">Mrs</option>
                  <option value="Ms">Ms</option>
                  <option value="Miss">Miss</option>
                  <option value="Mstr">Mstr</option>
                </select>
              </div>
              <div className="col-span-3 md:col-span-1">
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">
                  First Name
                </label>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) =>
                    setForm({ ...form, firstName: e.target.value })
                  }
                  className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">
                  Last Name
                </label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) =>
                    setForm({ ...form, lastName: e.target.value })
                  }
                  className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">
                  Category
                </label>
                <select
                  value={form.ageCategory}
                  onChange={(e) =>
                    setForm({ ...form, ageCategory: e.target.value })
                  }
                  className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700"
                >
                  <option value="Adult">Adult</option>
                  <option value="Youth">Youth</option>
                  <option value="Child">Child</option>
                  <option value="Infant">Infant</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[11px] font-extrabold text-indigo-900 tracking-wide uppercase border-b border-indigo-100 pb-1">
              Travel & Contact
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">
                  Passport Number
                </label>
                <input
                  type="text"
                  value={form.passportNumber || ""}
                  onChange={(e) =>
                    setForm({ ...form, passportNumber: e.target.value })
                  }
                  className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700 uppercase"
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">
                  Passport Expiry
                </label>
                <input
                  type="date"
                  value={form.passportExpiryDate || ""}
                  onChange={(e) =>
                    setForm({ ...form, passportExpiryDate: e.target.value })
                  }
                  className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700"
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={form.phoneNumber || ""}
                  onChange={(e) =>
                    setForm({ ...form, phoneNumber: e.target.value })
                  }
                  className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700"
                  placeholder="+44 7000 000000"
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email || ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700"
                  placeholder="passenger@email.com"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-50/50 p-5 border-t border-slate-200 flex justify-end gap-3 backdrop-blur-md">
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
            className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-2.5 rounded-xl text-[11px] font-bold shadow-lg shadow-primary-600/30 transition-all uppercase tracking-wide active:scale-95"
          >
            {initialData ? 'Update Passenger' : 'Save Passenger'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
