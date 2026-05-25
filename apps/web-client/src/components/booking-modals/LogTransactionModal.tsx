import { useState } from 'react';
import { X, Receipt, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Payment, BookingDetail } from '../../types/booking';

interface LogTransactionModalProps {
  booking?: BookingDetail;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (transaction: Partial<Payment> & { serviceCategory?: string; serviceId?: string; ccCharges?: string; serviceName?: string }) => void;
}

export function LogTransactionModal({ isOpen, onClose, onSubmit, booking }: LogTransactionModalProps) {
  const [form, setForm] = useState<Partial<Payment> & { ccCharges?: string; serviceName?: string }>({
    paymentType: 'Received from Client',
    amount: '',
    paymentMethod: 'Bank Transfer',
    paidOn: new Date().toISOString().split('T')[0],
    notes: '',
    ccCharges: '',
    serviceName: ''
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');

  const availableCategories = [];
  if (booking?.flightServices?.some(f => f.pnr && f.pnr.trim() !== '')) availableCategories.push('Flight');
  if (booking?.accommodations?.length) availableCategories.push('Accommodation');
  if (booking?.transportServices?.length) availableCategories.push('Transportation');
  if (booking?.visaServices?.length) availableCategories.push('Visa');
  if (booking?.additionalServices?.length) availableCategories.push('Additional Service');

  let availableItems: any[] = [];
  if (selectedCategory === 'Flight') availableItems = (booking?.flightServices || []).filter(f => f.pnr && f.pnr.trim() !== '');
  else if (selectedCategory === 'Accommodation') availableItems = booking?.accommodations || [];
  else if (selectedCategory === 'Transportation') availableItems = booking?.transportServices || [];
  else if (selectedCategory === 'Visa') availableItems = booking?.visaServices || [];
  else if (selectedCategory === 'Additional Service') availableItems = booking?.additionalServices || [];

  const selectedItem = availableItems.find(item => item.id == selectedServiceId);
  
  let currentServiceName = '';
  if (selectedItem) {
    if (selectedCategory === 'Flight') currentServiceName = `Flight ${selectedItem.flightNo} (${selectedItem.pnr})`;
    else if (selectedCategory === 'Accommodation') currentServiceName = `Hotel ${selectedItem.hotelName}`;
    else if (selectedCategory === 'Transportation') currentServiceName = `Transport ${selectedItem.vehicleType}`;
    else if (selectedCategory === 'Visa') currentServiceName = `Visa ${selectedItem.visaType}`;
    else currentServiceName = `Service ${selectedItem.serviceName}`;
  }

  const previousPayments = booking?.payments?.filter(p => p.paymentType === 'Sent to Vendor' && p.notes && p.notes.includes(currentServiceName)).reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0) || 0;
  const isDuplicate = selectedItem?.isPaidToVendor === true || previousPayments > 0;


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] relative z-10 overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-4 flex justify-between items-center shadow-inner">
          <div className="flex items-center gap-3">
            <Receipt className="h-5 w-5 text-emerald-200" />
            <h3 className="font-bold text-[14px] tracking-wide uppercase">Log Transaction</h3>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {form.paymentType === 'Sent to Vendor' && booking && (
              <div className="md:col-span-2 p-3 bg-indigo-50 border border-indigo-100 rounded-lg space-y-3">
                <h4 className="text-[10px] font-extrabold text-indigo-900 uppercase">Vendor Service Selection</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                     <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Service Category</label>
                     <select value={selectedCategory} onChange={e => { setSelectedCategory(e.target.value); setSelectedServiceId(''); }} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none font-semibold">
                       <option value="">-- Select Category --</option>
                       {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                  </div>
                  
                  {selectedCategory && (
                    <div>
                       <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Specific Service</label>
                       {selectedCategory === 'Other' ? (
                <input type="text" value={form.serviceName || ''} onChange={e => {
                  const serviceName = e.target.value;
                  setForm(prev => ({ ...prev, serviceName, notes: `Manual payment for ${serviceName}` }));
                }} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none font-semibold text-slate-700" placeholder="Type specific service..." />
              ) : (
                <select value={selectedServiceId} onChange={e => { 
                         const id = e.target.value;
                         setSelectedServiceId(id); 
                         const it = availableItems.find(i => i.id == id);
                         if (it) {
                           const cost = it.price || it.charges || it.cost || 0;
                           let serviceName = '';
                           if (selectedCategory === 'Flight') serviceName = `Flight: ${it.airline || 'Unknown'} - ${it.flightNo || 'No Flight No'} (${it.pnr})`;
                           else if (selectedCategory === 'Accommodation') serviceName = `Hotel ${it.hotelName}`;
                           else if (selectedCategory === 'Transportation') serviceName = `Transport ${it.vehicleType}`;
                           else if (selectedCategory === 'Visa') serviceName = `Visa ${it.visaType}`;
                           else serviceName = `Service ${it.serviceName}`;
                           
                           setForm(prev => ({ ...prev, amount: cost, notes: `Manual vendor payment for ${serviceName}`, serviceName }));
                         }
                       }} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none font-semibold text-slate-700">
                         <option value="">-- Select Service --</option>
                          {availableItems.map(item => {
                            let label = '';
                            if (selectedCategory === 'Flight') label = `Flight: ${item.airline || 'Unknown'} - ${item.flightNo || 'No Flight No'} (${item.pnr})`;
                            else if (selectedCategory === 'Accommodation') label = `Hotel: ${item.hotelName} (${item.checkIn || 'No Date'})`;
                            else if (selectedCategory === 'Transportation') label = `Transport: ${item.vehicleType} (${item.date || 'No Date'})`;
                            else if (selectedCategory === 'Visa') label = `Visa: ${item.visaType} (${item.passportNumber || ''})`;
                            else label = `Service: ${item.serviceName || 'Unknown'} (£${item.charges || 0})`;
                            
                            return (
                              <option key={item.id} value={item.id}>
                                {label.length > 55 ? label.substring(0, 55) + '...' : label}
                              </option>
                            );
                          })}
                       </select>
              )}
                    </div>
                  )}
                </div>

                {selectedItem && isDuplicate && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 text-red-700 text-[11px] font-bold rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <p><strong>Warning:</strong> You have already logged £{previousPayments > 0 ? previousPayments.toFixed(2) : (selectedItem?.price || selectedItem?.charges || 0)} in payments to the vendor for this service. Logging this transaction may result in double-payment!</p>
                  </div>
                )}
              </div>
            )}

            <div className="md:col-span-2">
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Transaction Type</label>
              <div className="grid grid-cols-3 gap-2">
                {['Received from Client', 'Sent to Vendor', 'Margin Paid to Agent'].map(type => (
                  <button 
                    key={type}
                    type="button"
                    onClick={() => setForm({...form, paymentType: type as any})}
                    className={`py-2 rounded-lg text-[11px] font-bold border transition-all ${form.paymentType === type ? 'bg-emerald-500 text-white border-emerald-600 shadow-md shadow-emerald-500/20' : 'bg-white/50 border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-[11px] font-bold text-slate-400">£</span>
                <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="w-full pl-7 pr-3 border border-slate-200 bg-white/70 rounded-lg py-2 text-[11px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-semibold text-slate-700" placeholder="0.00" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Date</label>
              <input type="date" value={form.paidOn} onChange={e => setForm({...form, paidOn: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-semibold text-slate-700" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Method</label>
              <select value={form.paymentMethod} onChange={e => setForm({...form, paymentMethod: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-semibold text-slate-700">
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
                  <input type="number" value={form.ccCharges} onChange={e => setForm({...form, ccCharges: e.target.value})} className="w-full pl-7 pr-3 border border-slate-200 bg-white/70 rounded-lg py-2 text-[11px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-semibold text-slate-700" placeholder="0.00" />
                </div>
              </div>
            )}

            <div className="md:col-span-2">
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Notes / Reference</label>
              <textarea value={form.notes || ''} onChange={e => setForm({...form, notes: e.target.value})} className="w-full h-20 border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-semibold text-slate-700 resize-none" placeholder="Add transaction reference or notes here..." />
            </div>
          </div>
        </div>

        <div className="bg-slate-50/50 p-5 border-t border-slate-200 flex justify-end gap-3 backdrop-blur-md">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-[11px] font-bold text-slate-600 hover:bg-slate-200/50 transition-colors">Cancel</button>
          <button onClick={() => { onSubmit({ ...form, serviceCategory: selectedCategory, serviceId: selectedServiceId }); onClose(); }} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl text-[11px] font-bold shadow-lg shadow-emerald-600/30 transition-all uppercase tracking-wide active:scale-95">
            Log Transaction
          </button>
        </div>
      </motion.div>
    </div>
  );
}
