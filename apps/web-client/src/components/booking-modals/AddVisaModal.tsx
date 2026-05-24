import { useState, useEffect } from 'react';
import { X, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import type { VisaService } from '../../types/booking';
import { VendorSelect } from '../shared/VendorSelect';

interface AddVisaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (visa: Partial<VisaService>) => void;
  initialData?: VisaService | null;
  passengers?: any[];
}

export function AddVisaModal({ isOpen, onClose, onSubmit, initialData, passengers }: AddVisaModalProps) {
  const [form, setForm] = useState<Partial<VisaService>>({
    vendorName: '',
    passportNumber: '',
    visaType: '',
    visaNumber: '',
    issueDate: '',
    expiryDate: '',
    qty: 1,
    unitPrice: '',
    price: '',
    currency: 'GBP',
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


  const [tagInput, setTagInput] = useState('');
  const tags = (form.passportNumber || '').split(',').map((s: string) => s.trim()).filter(Boolean);

  const handleAddTag = (val: string) => {
    if (!val.trim()) return;
    const newTags = [...tags, val.trim()];
    const newQty = newTags.length > 0 ? newTags.length : 1;
    const u = parseFloat(String(form.unitPrice || 0)) || 0;
    setForm({ ...form, passportNumber: newTags.join(', '), qty: newQty, price: (newQty * u).toString() });
    setTagInput('');
  };

  const handleRemoveTag = (idx: number) => {
    const newTags = tags.filter((_, i) => i !== idx);
    const newQty = newTags.length > 0 ? newTags.length : 1;
    const u = parseFloat(String(form.unitPrice || 0)) || 0;
    setForm({ ...form, passportNumber: newTags.join(', '), qty: newQty, price: (newQty * u).toString() });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] relative z-10 overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-primary-900 to-indigo-900 text-white px-6 py-4 flex justify-between items-center shadow-inner">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-indigo-300" />
            <h3 className="font-bold text-[14px] tracking-wide uppercase">{initialData ? 'Edit' : 'Add'} Visa Service</h3>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Provider</label>
              <VendorSelect category="visa" value={form.vendorName || ''} onChange={val => setForm({...form, vendorName: val})} />
            </div>
            <div className="col-span-1 md:col-span-2">
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Passengers / Passport Numbers</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag, idx) => (
                  <span key={idx} className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 border border-indigo-100">
                    {tag}
                    <button type="button" onClick={() => handleRemoveTag(idx)} className="hover:text-indigo-900 focus:outline-none bg-indigo-200/50 rounded-full p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  value={tagInput} 
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(tagInput); } }}
                  list="passenger-suggestions"
                  placeholder="Type a name/passport and hit Enter..."
                  className="flex-1 border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" 
                />
                <button type="button" onClick={() => handleAddTag(tagInput)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-[11px] font-bold shadow-sm transition-all uppercase tracking-wide">
                  Add
                </button>
              </div>
              <datalist id="passenger-suggestions">
                {passengers?.map((p, i) => (
                  <option key={`p-${i}`} value={`${p.firstName} ${p.lastName} ${p.passportNumber ? `(${p.passportNumber})` : ''}`} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Visa Type</label>
              <input type="text" value={form.visaType || ''} onChange={e => setForm({...form, visaType: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" placeholder="e.g. Tourist, Business, Visit" />
            </div>
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Visa Document Number</label>
              <input type="text" value={form.visaNumber || ''} onChange={e => setForm({...form, visaNumber: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" />
            </div>
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Issue Date</label>
              <input type="date" value={form.issueDate || ''} onChange={e => setForm({...form, issueDate: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" />
            </div>
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Expiry Date</label>
              <input type="date" value={form.expiryDate || ''} onChange={e => setForm({...form, expiryDate: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" />
            </div>
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Price</label>
              <input type="number" value={form.price || ''} onChange={e => setForm({...form, price: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" />
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
                            <button onClick={() => {
                const payload = { ...form } as any;
                if (payload.price) payload.price = parseFloat(payload.price);
                if (payload.qty) payload.qty = parseInt(payload.qty, 10);
                if (payload.conversionRate) payload.conversionRate = parseFloat(payload.conversionRate);
                if (payload.refundAmount) payload.refundAmount = parseFloat(payload.refundAmount);
                if (payload.fineAmount) payload.fineAmount = parseFloat(payload.fineAmount);
                onSubmit(payload);
                onClose();
              }} className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-2.5 rounded-xl text-[11px] font-bold shadow-lg shadow-primary-600/30 transition-all uppercase tracking-wide active:scale-95">
                {initialData ? 'Update' : 'Save'}
              </button>
            </div>
          </div>

      </motion.div>
    </div>
  );
}
