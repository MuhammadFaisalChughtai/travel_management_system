import { useState } from 'react';
import { X, Tag, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCurrency } from '../../utils/currency';
import type { Discount, BookingDetail } from '../../types/booking';

interface AddDiscountModalProps {
  booking: BookingDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (discount: Partial<Discount>) => void;
}

export function AddDiscountModal({ booking, isOpen, onClose, onSubmit }: AddDiscountModalProps) {
  const { symbol } = useCurrency();
  const [form, setForm] = useState<Partial<Discount> & { paymentMethod?: string; ccCharges?: string }>({
    vendorCategory: 'Hotel',
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

  const parseFlightDetails = (serviceName: string | null | undefined) => {
    if (!serviceName) return null;
    const match = serviceName.match(/Flight:\s*(.*?)\s*-\s*([A-Za-z0-9]+)\s*\((.*?)\)/i);
    if (match) {
      return {
        airline: match[1],
        flightNo: match[2],
        pnr: match[3]
      };
    }
    return null;
  };

  const previousDiscounts = booking?.discounts?.filter(d => {
    if (d.vendorCategory === 'Flight' && form.vendorCategory === 'Flight') {
      const f1 = parseFlightDetails(d.serviceName);
      const f2 = parseFlightDetails(form.serviceName);
      if (f1 && f2) {
        return f1.flightNo === f2.flightNo && f1.pnr === f2.pnr;
      }
    }
    return d.serviceName === form.serviceName;
  }).reduce((acc, d) => acc + (parseFloat(d.amount) || 0), 0) || 0;
  

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] relative z-10 overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white px-6 py-4 flex justify-between items-center shadow-inner">
          <div className="flex items-center gap-3">
            <Tag className="h-5 w-5 text-amber-200" />
            <h3 className="font-bold text-[14px] tracking-wide uppercase">Add Discount</h3>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="md:col-span-2">
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Discount Category</label>
              <select value={form.vendorCategory} onChange={e => setForm({...form, vendorCategory: e.target.value as any, serviceName: ''})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all font-semibold text-slate-700">
                <option value="">-- Select Category --</option>
                {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Specific Service</label>
              {form.vendorCategory === 'Other' ? (
                <input type="text" value={form.serviceName || ''} onChange={e => setForm({...form, serviceName: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all font-semibold text-slate-700" placeholder="Type specific service..." />
              ) : (
                <select value={form.serviceName || ''} onChange={e => setForm({...form, serviceName: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all font-semibold text-slate-700">
                  <option value="">Select a specific service (Optional)</option>
                  {availableItems.map(item => {
                    let val = '';
                    if (form.vendorCategory === 'Flight') val = `Flight: ${item.airline || item.vendorName || 'Unknown'} - ${item.flightNo || 'No Flight No'} (${item.pnr})`;
                    else if (form.vendorCategory === 'Accommodation') val = `Hotel: ${item.hotelName} (${item.checkIn || 'No Date'})`;
                    else if (form.vendorCategory === 'Transportation') val = `Transport: ${item.vehicleType} (${item.date || 'No Date'})`;
                    else if (form.vendorCategory === 'Visa') val = `Visa: ${item.country} (${item.type || ''})`;
                    else val = `Service: ${item.serviceName || 'Unknown'} (${symbol}${item.charges || 0})`;
                    return <option key={item.id} value={val}>{val}</option>;
                  })}
                </select>
              )}
              {previousDiscounts > 0 && form.serviceName && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-bold rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p><strong>Notice:</strong> You have already logged {symbol}{previousDiscounts.toFixed(2)} in discounts for this service. Are you sure you want to continue?</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-[11px] font-bold text-slate-400">{symbol}</span>
                <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="w-full pl-7 pr-3 border border-slate-200 bg-white/70 rounded-lg py-2 text-[11px] outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all font-semibold text-slate-700" placeholder="0.00" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Method</label>
              <select value={form.paymentMethod as any} onChange={e => setForm({...form, paymentMethod: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all font-semibold text-slate-700">
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
                  <span className="absolute left-3 top-2 text-[11px] font-bold text-slate-400">{symbol}</span>
                  <input type="number" value={(form as any).ccCharges} onChange={e => setForm({...form, ccCharges: e.target.value})} className="w-full pl-7 pr-3 border border-slate-200 bg-white/70 rounded-lg py-2 text-[11px] outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all font-semibold text-slate-700" placeholder="0.00" />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Date</label>
              <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all font-semibold text-slate-700" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Notes / Remarks</label>
              <textarea value={form.notes || ''} onChange={e => setForm({...form, notes: e.target.value})} className="w-full h-20 border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all font-semibold text-slate-700 resize-none" placeholder="Enter discount reason or reference..." />
            </div>
          </div>
        </div>

        <div className="bg-slate-50/50 p-5 border-t border-slate-200 flex justify-end gap-3 backdrop-blur-md">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-[11px] font-bold text-slate-600 hover:bg-slate-200/50 transition-colors">Cancel</button>
          <button onClick={() => { onSubmit(form); onClose(); }} className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-2.5 rounded-xl text-[11px] font-bold shadow-lg shadow-amber-600/30 transition-all uppercase tracking-wide active:scale-95">
            Save Discount
          </button>
        </div>
      </motion.div>
    </div>
  );
}
