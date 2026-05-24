import { useState, useEffect } from 'react';
import { X, Hotel } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Accommodation } from '../../types/booking';
import { VendorSelect } from '../shared/VendorSelect';

interface AddAccommodationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (stay: Partial<Accommodation>) => void;
  initialData?: Partial<Accommodation>;
}

export function AddAccommodationModal({ isOpen, onClose, onSubmit, initialData }: AddAccommodationModalProps) {
  const [form, setForm] = useState<Partial<Accommodation>>({
    vendorName: '',
    hotelName: '',
    roomType: 'Double',
    mealType: 'Room Only',
    checkInDate: '',
    checkOutDate: '',
    qty: 1,
    price: '',
    currency: 'GBP',
    reservationNumber: '',
    hotelConfirmationNumber: '',
    hotelAddress: '',
    lastCancellationDate: '',
    issueDate: '',
    otherCurrency: '',
    conversionRate: ''
  });

  
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Map date strings to YYYY-MM-DD for date inputs if necessary
        const mappedData = { ...initialData };
        // Format dates correctly for inputs
        ['date', 'issueDate', 'checkIn', 'checkOut', 'dob', 'expiryDate', 'departureDate'].forEach(field => {
          if ((mappedData as any)[field]) {
            try { (mappedData as any)[field] = new Date((mappedData as any)[field]).toISOString().split('T')[0]; } catch(e) {}
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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] relative z-10 overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-primary-900 to-indigo-900 text-white px-6 py-4 flex justify-between items-center shadow-inner">
          <div className="flex items-center gap-3">
            <Hotel className="h-5 w-5 text-indigo-300" />
            <h3 className="font-bold text-[14px] tracking-wide uppercase">{initialData ? 'Edit' : 'Add'} Accommodation</h3>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          
          <div className="space-y-4">
            <h4 className="text-[11px] font-extrabold text-indigo-900 tracking-wide uppercase border-b border-indigo-100 pb-1">Core Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Hotel Name</label>
                <input type="text" value={form.hotelName} onChange={e => setForm({...form, hotelName: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Vendor / Provider</label>
                <VendorSelect category="accommodation" value={form.vendorName || ''} onChange={val => setForm({...form, vendorName: val})} />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Hotel Address</label>
                <input type="text" value={form.hotelAddress || ''} onChange={e => setForm({...form, hotelAddress: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[11px] font-extrabold text-indigo-900 tracking-wide uppercase border-b border-indigo-100 pb-1">Reservation & Stay Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Check-In</label>
                <input type="datetime-local" value={form.checkInDate || ''} onChange={e => setForm({...form, checkInDate: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Check-Out</label>
                <input type="datetime-local" value={form.checkOutDate || ''} onChange={e => setForm({...form, checkOutDate: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Qty (Rooms)</label>
                <input type="number" value={form.qty} onChange={e => setForm({...form, qty: parseInt(e.target.value) || 1})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Room Type</label>
                <input type="text" value={form.roomType || ''} onChange={e => setForm({...form, roomType: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Meal Type</label>
                <input type="text" value={form.mealType || ''} onChange={e => setForm({...form, mealType: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Last Cancellation Date</label>
                <input type="date" value={form.lastCancellationDate || ''} onChange={e => setForm({...form, lastCancellationDate: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[11px] font-extrabold text-indigo-900 tracking-wide uppercase border-b border-indigo-100 pb-1">Financial & References</h4>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">System Res. Number</label>
                <input type="text" value={form.reservationNumber || ''} onChange={e => setForm({...form, reservationNumber: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Hotel Conf. Number</label>
                <input type="text" value={form.hotelConfirmationNumber || ''} onChange={e => setForm({...form, hotelConfirmationNumber: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Currency</label>
                <input type="text" value={form.currency || 'GBP'} onChange={e => setForm({...form, currency: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700 uppercase" maxLength={3} />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Other Currency</label>
                <input type="text" value={form.otherCurrency || ''} onChange={e => setForm({...form, otherCurrency: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700 uppercase" maxLength={3} />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Conv. Rate</label>
                <input type="number" step="0.0001" value={form.conversionRate || ''} onChange={e => setForm({...form, conversionRate: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Total Price</label>
                <input type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" />
              </div>
            </div>
          </div>
        </div>

        
          
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <label className="flex items-center gap-2 cursor-pointer group w-fit">
              <input 
                type="checkbox" 
                checked={form.isPaidToVendor || false} 
                onChange={(e) => setForm({ ...form, isPaidToVendor: e.target.checked })}
                disabled={initialData?.isPaidToVendor}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className="text-[12px] font-bold text-slate-700 group-hover:text-slate-900 flex items-center gap-1.5 transition-colors">
                Paid to Vendor?
                {initialData?.isPaidToVendor && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">(Already Paid)</span>}
              </span>
            </label>
            <p className="text-[10px] text-slate-500 mt-1 ml-6">Check this if you have already transferred the money for this service to the vendor. It will automatically log a transaction.</p>
          </div>
          <div className="bg-slate-50/50 p-5 border-t border-slate-200 flex justify-end items-center backdrop-blur-md">
            
            <div className="flex gap-3">
              <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-[11px] font-bold text-slate-600 hover:bg-slate-200/50 transition-colors">Cancel</button>
              <button onClick={() => { onSubmit({ ...form, price: parseFloat(form.price as any) || 0 } as any); onClose(); }} className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-2.5 rounded-xl text-[11px] font-bold shadow-lg shadow-primary-600/30 transition-all uppercase tracking-wide active:scale-95">
                {initialData ? 'Update' : 'Save'}
              </button>
            </div>
          </div>

      </motion.div>
    </div>
  );
}
