import { useState } from 'react';
import { X, Receipt, AlertCircle, Upload, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../../api/axios';
import toast from 'react-hot-toast';
import type { Payment, BookingDetail } from '../../types/booking';

interface LogTransactionModalProps {
  booking?: BookingDetail;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (transaction: Partial<Payment> & { serviceCategory?: string; serviceId?: string; ccCharges?: string; serviceName?: string; evidenceUrl?: string }) => void;
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
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [uploadingEvidence, setUploadingEvidence] = useState(false);

  const handleEvidenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingEvidence(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/auth/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setEvidenceUrl(response.data.url);
      toast.success('Evidence uploaded successfully');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to upload evidence');
    } finally {
      setUploadingEvidence(false);
    }
  };
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
    if (selectedCategory === 'Flight') currentServiceName = `Flight: ${selectedItem.airline || 'Unknown'} - ${selectedItem.flightNo || 'No Flight No'} (${selectedItem.pnr})`;
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
                           if (selectedCategory === 'Flight') serviceName = `Flight: ${it.airline || it.vendorName || 'Unknown'} - ${it.flightNo || 'No Flight No'} (${it.pnr})`;
                           else if (selectedCategory === 'Accommodation') serviceName = `Hotel: ${it.hotelName || it.vendorName || 'Unknown'}`;
                           else if (selectedCategory === 'Transportation') serviceName = `Transport: ${it.vehicleType || it.vendorName || 'Unknown'}`;
                           else if (selectedCategory === 'Visa') serviceName = `Visa: ${it.vendorName || 'Unknown'} (${it.visaType})`;
                           else serviceName = `Service: ${it.serviceName || it.vendorName || 'Unknown'}`;
                           
                           setForm(prev => ({ ...prev, amount: cost, notes: `Manual vendor payment for ${serviceName}`, serviceName }));
                         }
                       }} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none font-semibold text-slate-700">
                         <option value="">-- Select Service --</option>
                          {availableItems.map(item => {
                            let label = '';
                             if (selectedCategory === 'Flight') label = `Flight: ${item.airline || item.vendorName || 'Unknown'} - ${item.flightNo || 'No Flight No'} (${item.pnr})`;
                             else if (selectedCategory === 'Accommodation') label = `Hotel: ${item.hotelName || item.vendorName || 'Unknown'} (${item.checkIn || item.date || 'No Date'})`;
                             else if (selectedCategory === 'Transportation') label = `Transport: ${item.vehicleType || item.vendorName || 'Unknown'} (${item.date || 'No Date'})`;
                             else if (selectedCategory === 'Visa') label = `Visa: ${item.vendorName || 'Unknown'} (${item.visaType || ''})`;
                             else label = `Service: ${item.serviceName || item.vendorName || 'Unknown'} (£${item.charges || item.price || 0})`;
                            
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
                {['Received from Client', 'Sent to Vendor', 'Margin Paid to Agent'].map(type => {
                  const isDisabled = type === 'Margin Paid to Agent' && booking?.marginStatus !== 'Finalized' && booking?.marginStatus !== 'Paid';
                  return (
                  <button 
                    key={type}
                    type="button"
                    disabled={isDisabled}
                    title={isDisabled ? 'Margin must be finalized before paying to agent' : undefined}
                    onClick={() => setForm({...form, paymentType: type as any})}
                    className={`py-2 rounded-lg text-[11px] font-bold border transition-all ${isDisabled ? 'bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed' : form.paymentType === type ? 'bg-emerald-500 text-white border-emerald-600 shadow-md shadow-emerald-500/20' : 'bg-white/50 border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    {type}
                  </button>
                  );
                })}
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

            {/* Evidence Upload */}
            <div className="md:col-span-2">
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">
                Bank Transfer Evidence / Screenshot
              </label>
              {evidenceUrl ? (
                <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0">
                      <img src={evidenceUrl} alt="Receipt preview" className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-emerald-700 truncate">Evidence uploaded ✓</p>
                      <a href={evidenceUrl} target="_blank" rel="noreferrer" className="text-[10px] text-indigo-600 hover:underline font-medium">View full image</a>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEvidenceUrl('')}
                    className="p-1 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                    title="Remove upload"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative border-2 border-dashed border-slate-200 hover:border-emerald-400 rounded-xl p-4 transition-colors bg-slate-50/50 flex flex-col items-center justify-center text-center cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleEvidenceUpload}
                    disabled={uploadingEvidence}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  {uploadingEvidence ? (
                    <div className="flex flex-col items-center gap-2 py-1">
                      <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                      <span className="text-[11px] font-semibold text-slate-500">Uploading screenshot...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="p-2 bg-slate-100 text-slate-500 rounded-lg border border-slate-200">
                        <Upload className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-slate-700 block">Click to upload bank transfer screenshot</span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">JPEG, PNG up to 10MB</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-slate-50/50 p-5 border-t border-slate-200 flex justify-end gap-3 backdrop-blur-md">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-[11px] font-bold text-slate-600 hover:bg-slate-200/50 transition-colors">Cancel</button>
          <button 
            disabled={form.paymentType === 'Sent to Vendor' && isDuplicate}
            onClick={() => { onSubmit({ ...form, serviceCategory: selectedCategory, serviceId: selectedServiceId, evidenceUrl: evidenceUrl || undefined }); onClose(); }} 
            className={`px-6 py-2.5 rounded-xl text-[11px] font-bold shadow-lg transition-all uppercase tracking-wide ${form.paymentType === 'Sent to Vendor' && isDuplicate ? 'bg-slate-400 text-slate-200 cursor-not-allowed shadow-none' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 active:scale-95'}`}
          >
            Log Transaction
          </button>
        </div>
      </motion.div>
    </div>
  );
}
