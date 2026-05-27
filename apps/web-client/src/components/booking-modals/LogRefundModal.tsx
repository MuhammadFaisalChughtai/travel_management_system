import { useState } from 'react';
import { X, RefreshCcw, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import type { Refund, BookingDetail } from '../../types/booking';

interface LogRefundModalProps {
  booking: BookingDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (refund: Partial<Refund>) => void;
}

export function LogRefundModal({ booking, isOpen, onClose, onSubmit }: LogRefundModalProps) {
  const [form, setForm] = useState<Partial<Refund> & { paymentMethod?: string; ccCharges?: string }>({
    direction: 'Refund to Client',
    vendorCategory: 'Flight',
    serviceName: '',
    amount: '',
    paymentMethod: 'Bank Transfer',
    ccCharges: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const availableCategories = [];
  if (booking?.flightServices?.some(f => f.pnr && f.pnr.trim() !== '')) availableCategories.push('Flight');
  if (booking?.accommodations?.length) availableCategories.push('Accommodation');
  if (booking?.transportServices?.length) availableCategories.push('Transportation');
  if (booking?.visaServices?.length) availableCategories.push('Visa');
  if (booking?.additionalServices?.length) availableCategories.push('Additional Service');

  let availableItems: any[] = (form.vendorCategory as string) === 'Flight' ? (booking?.flightServices || []).filter(f => f.pnr && f.pnr.trim() !== '') :
                (form.vendorCategory as string) === 'Accommodation' ? booking?.accommodations || [] :
                (form.vendorCategory as string) === 'Transportation' ? booking?.transportServices || [] :
                (form.vendorCategory as string) === 'Visa' ? booking?.visaServices || [] :
                (form.vendorCategory as string) === 'Additional Service' ? booking?.additionalServices || [] : [];

  const previousRefunds = booking?.refunds?.filter(r => r.serviceName === form.serviceName && r.direction === form.direction).reduce((acc, r) => acc + (parseFloat(r.amount) || 0), 0) || 0;
  

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] relative z-10 overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-red-500 to-rose-600 text-white px-6 py-4 flex justify-between items-center shadow-inner">
          <div className="flex items-center gap-3">
            <RefreshCcw className="h-5 w-5 text-red-100" />
            <h3 className="font-bold text-[14px] tracking-wide uppercase">Log Refund</h3>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div className="md:col-span-2">
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Refund Direction</label>
              <div className="grid grid-cols-2 gap-2">
                {['Refund to Client', 'Refund from Vendor'].map(dir => (
                  <button 
                    key={dir}
                    onClick={() => setForm({...form, direction: dir as any})}
                    className={`py-2 rounded-lg text-[11px] font-bold border transition-all ${form.direction === dir ? 'bg-red-500 text-white border-red-600 shadow-md shadow-red-500/20' : 'bg-white/50 border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    {dir}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Service Category</label>
              <select value={form.vendorCategory} onChange={e => setForm({...form, vendorCategory: e.target.value as any, serviceName: ''})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all font-semibold text-slate-700">
                <option value="">-- Select Category --</option>
                {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Specific Service</label>
              {form.vendorCategory === 'Other' ? (
                <input type="text" value={form.serviceName || ''} onChange={e => setForm({...form, serviceName: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all font-semibold text-slate-700" placeholder="Type specific service..." />
              ) : (
                <select value={form.serviceName || ''} onChange={e => setForm({...form, serviceName: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all font-semibold text-slate-700">
                  <option value="">Select a specific service (Required)</option>
                  {availableItems.map(item => {
                    let val = '';
                    if (form.vendorCategory === 'Flight') val = `Flight: ${item.airline || item.vendorName || 'Unknown'} - ${item.flightNo || 'No Flight No'} (${item.pnr})`;
                    else if (form.vendorCategory === 'Accommodation') val = `Hotel: ${item.hotelName || item.vendorName || 'Unknown'} (${item.checkIn || item.date || 'No Date'})`;
                    else if (form.vendorCategory === 'Transportation') val = `Transport: ${item.vehicleType || item.vendorName || 'Unknown'} (${item.date || 'No Date'})`;
                    else if (form.vendorCategory === 'Visa') val = `Visa: ${item.vendorName || 'Unknown'} (${item.visaType || item.type || ''})`;
                    else val = `Service: ${item.serviceName || item.vendorName || 'Unknown'} (£${item.charges || item.price || 0})`;
                    return <option key={item.id} value={val}>{val}</option>;
                  })}
                </select>
              )}
              {previousRefunds > 0 && form.serviceName && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-bold rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p><strong>Notice:</strong> You have already refunded £{previousRefunds.toFixed(2)} for this service. Are you sure you want to continue?</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Refund Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-[11px] font-bold text-slate-400">£</span>
                <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="w-full pl-7 pr-3 border border-slate-200 bg-white/70 rounded-lg py-2 text-[11px] outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all font-semibold text-slate-700" placeholder="0.00" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Method</label>
              <select value={form.paymentMethod as any} onChange={e => setForm({...form, paymentMethod: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all font-semibold text-slate-700">
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {form.paymentMethod === 'Credit Card' && (
              <div className="md:col-span-2">
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Credit Card Charges</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-[11px] font-bold text-slate-400">£</span>
                  <input type="number" value={(form as any).ccCharges} onChange={e => setForm({...form, ccCharges: e.target.value})} className="w-full pl-7 pr-3 border border-slate-200 bg-white/70 rounded-lg py-2 text-[11px] outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all font-semibold text-slate-700" placeholder="0.00" />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Date</label>
              <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all font-semibold text-slate-700" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Notes / Remarks</label>
              <textarea value={form.notes || ''} onChange={e => setForm({...form, notes: e.target.value})} className="w-full h-20 border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all font-semibold text-slate-700 resize-none" placeholder="Enter refund reason, reference, or penalty details..." />
            </div>
          </div>
        </div>

        <div className="bg-slate-50/50 p-5 border-t border-slate-200 flex justify-end gap-3 backdrop-blur-md">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-[11px] font-bold text-slate-600 hover:bg-slate-200/50 transition-colors">Cancel</button>
          <button onClick={() => { onSubmit(form); onClose(); }} className="bg-red-600 hover:bg-red-500 text-white px-6 py-2.5 rounded-xl text-[11px] font-bold shadow-lg shadow-red-600/30 transition-all uppercase tracking-wide active:scale-95">
            Process Refund
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
