import { useState, useEffect } from 'react';
import { X, Plane, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { FlightService } from '../../types/booking';
import { VendorSelect } from '../shared/VendorSelect';
import { api as axios } from '../../api/axios';
import { PnrConverterModal } from './PnrConverterModal';
import { useCurrency } from '../../utils/currency';

interface AddFlightModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (flight: Partial<FlightService>) => void;
  initialData?: FlightService | null;
}

export function AddFlightModal({ isOpen, onClose, onSubmit, initialData }: AddFlightModalProps) {
  const { currency: tenantCurrency, symbol } = useCurrency();
  const [form, setForm] = useState<Partial<FlightService>>({
    vendorName: '',
    airline: '',
    flightNo: '',
    pnr: '',
    departedFrom: '',
    arrivedAt: '',
    date: '',
    departTime: '',
    arrivalTime: '',
    price: '',
    currency: tenantCurrency || 'GBP',
    issueDate: '',
    ticketNumber: '',
    baggage: '23 Kg',
    carryOnBaggage: '7 Kg',
    checkedBaggage: '23 Kg',
    flightClass: 'Economy'
  });
  
  const [showPnrModal, setShowPnrModal] = useState(false);

  const handlePnrData = (extracted: any) => {
    let formattedDate: string | undefined = undefined;
    if (extracted.date) {
      // Convert DDMMM (e.g. 26JUL) to YYYY-MM-DD
      const monthMap: Record<string, number> = {
        JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
        JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11
      };
      const match = extracted.date.match(/(\d{2})([A-Z]{3})/i);
      if (match) {
        const day = parseInt(match[1], 10);
        const month = monthMap[match[2].toUpperCase()];
        if (month !== undefined) {
          const now = new Date();
          let year = now.getFullYear();
          let parsedDate = new Date(year, month, day);
          
          // If the date is more than 3 months in the past, it's likely next year's flight
          if (parsedDate.getTime() < now.getTime() - (90 * 24 * 60 * 60 * 1000)) {
            year += 1;
          }
          
          // Format manually to avoid timezone shift from .toISOString() which converts to UTC
          formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
      }
    }

    setForm(prev => ({
      ...prev,
      airline: extracted.airline || prev.airline,
      flightNo: extracted.flightNo || prev.flightNo,
      date: formattedDate || prev.date,
      departedFrom: extracted.departedFrom || prev.departedFrom,
      arrivedAt: extracted.arrivedAt || prev.arrivedAt,
      departTime: extracted.departTime || prev.departTime,
      arrivalTime: extracted.arrivalTime || prev.arrivalTime,
      pnr: extracted.pnr || prev.pnr
    }));
  };

  
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
        setForm(prev => ({ ...prev, currency: tenantCurrency || 'GBP' }));
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('custom');

  useEffect(() => {
    if (isOpen) {
      axios.get('/catalog').then(res => {
        const items = res.data.items || (Array.isArray(res.data) ? res.data : []);
        setCatalogItems(items.filter((item: any) => item.serviceType === 'FLIGHT'));
      }).catch(console.error);
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedCatalogId !== 'custom') {
      const item = catalogItems.find(i => i.id.toString() === selectedCatalogId);
      if (item) {
        setForm(prev => ({
          ...prev,
          vendorName: item.metadata?.vendorName || prev.vendorName,
          price: ((prev.qty || 1) * Number(item.unitPrice)).toString(),
          currency: item.currency || 'GBP'
        }));
      }
    }
  }, [selectedCatalogId, catalogItems]);

  return (
    <>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] relative z-10 overflow-hidden flex flex-col">
          <div className="bg-gradient-to-r from-primary-900 to-indigo-900 text-white px-6 py-4 flex justify-between items-center shadow-inner">
            <div className="flex items-center gap-3">
              <Plane className="h-5 w-5 text-indigo-300" />
              <h3 className="font-bold text-[14px] tracking-wide uppercase">{initialData ? 'Edit' : 'Add'} Flight Service</h3>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => setShowPnrModal(true)} className="flex items-center gap-2 bg-indigo-500/30 hover:bg-indigo-500/50 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all uppercase tracking-wide border border-indigo-400/30">
                <RefreshCw className="h-3.5 w-3.5" /> PNR Converter
              </button>
              <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50 mb-2">
              <label className="block text-[10px] font-extrabold text-indigo-800 mb-1.5 uppercase tracking-wide">Service Catalog Selection</label>
              <select value={selectedCatalogId} onChange={e => setSelectedCatalogId(e.target.value)} className="w-full border border-indigo-200 bg-white rounded-lg px-3 py-2 text-sm font-bold text-indigo-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm">
                <option value="custom">Custom / Not Listed (Manual Entry)</option>
                {catalogItems.map(item => (
                  <option key={item.id} value={item.id.toString()}>{item.name} - {item.currency} {item.unitPrice}</option>
                ))}
              </select>
              {catalogItems.find(i => i.id.toString() === selectedCatalogId)?.metadata?.flightItinerary && (
                <div className="mt-3">
                  <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Block Itinerary Details</label>
                  <div className="bg-slate-900 text-emerald-400 p-3 rounded-lg font-mono text-[11px] whitespace-pre-wrap shadow-inner overflow-x-auto">
                    {catalogItems.find(i => i.id.toString() === selectedCatalogId)?.metadata?.flightItinerary}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <h4 className="text-[11px] font-extrabold text-indigo-900 tracking-wide uppercase border-b border-indigo-100 pb-1">Core Flight Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Airline / Provider</label>
                  <VendorSelect category="airline" value={form.airline || form.vendorName || ''} onChange={val => setForm({...form, airline: val, vendorName: val})} />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Flight Number</label>
                  <input type="text" value={form.flightNo || ''} onChange={e => setForm({...form, flightNo: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700 uppercase" />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Departure (Code)</label>
                  <input type="text" value={form.departedFrom || ''} onChange={e => setForm({...form, departedFrom: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700 uppercase" maxLength={3} />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Arrival (Code)</label>
                  <input type="text" value={form.arrivedAt || ''} onChange={e => setForm({...form, arrivedAt: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700 uppercase" maxLength={3} />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Dep. Time</label>
                  <input type="time" value={form.departTime || ''} onChange={e => setForm({...form, departTime: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Arr. Time</label>
                  <input type="time" value={form.arrivalTime || ''} onChange={e => setForm({...form, arrivalTime: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Travel Date</label>
                  <input type="date" value={form.date || ''} onChange={e => setForm({...form, date: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-[11px] font-extrabold text-indigo-900 tracking-wide uppercase border-b border-indigo-100 pb-1">Luggage & Class</h4>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Flight Class</label>
                  <select value={form.flightClass || 'Economy'} onChange={e => setForm({...form, flightClass: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700">
                    <option value="Economy">Economy</option>
                    <option value="Premium Economy">Premium Economy</option>
                    <option value="Business">Business</option>
                    <option value="First Class">First Class</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Total Baggage</label>
                  <input type="text" value={form.baggage || ''} onChange={e => setForm({...form, baggage: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" placeholder="e.g. 30kg" />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Carry-On</label>
                  <input type="text" value={form.carryOnBaggage || ''} onChange={e => setForm({...form, carryOnBaggage: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" placeholder="e.g. 7kg" />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Checked In</label>
                  <input type="text" value={form.checkedBaggage || ''} onChange={e => setForm({...form, checkedBaggage: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" placeholder="e.g. 23kg" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-[11px] font-extrabold text-indigo-900 tracking-wide uppercase border-b border-indigo-100 pb-1">Financial & References</h4>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">PNR Reference</label>
                  <input type="text" value={form.pnr || ''} onChange={e => setForm({...form, pnr: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700 uppercase" maxLength={6} />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Ticket Number</label>
                  <input type="text" value={form.ticketNumber || ''} onChange={e => setForm({...form, ticketNumber: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Issue Date</label>
                  <input type="date" value={form.issueDate || ''} onChange={e => setForm({...form, issueDate: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Price ({symbol})</label>
                  <input type="number" value={form.price || ''} onChange={e => setForm({...form, price: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" />
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
            <p className="text-[10px] text-slate-500 mt-1 ml-6">Check this to manually mark as paid if you have already transferred the money to the vendor. (To log a formal transaction, use the Log Transaction button).</p>
          </div>
          <div className="bg-slate-50/50 p-5 border-t border-slate-200 flex justify-end items-center backdrop-blur-md">
            
            <div className="flex gap-3">
              <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-[11px] font-bold text-slate-600 hover:bg-slate-200/50 transition-colors">Cancel</button>
                            <button onClick={() => {
                const payload = { ...form } as any;
                payload.price = payload.price ? parseFloat(payload.price) : undefined;
                payload.qty = payload.qty ? parseInt(payload.qty, 10) : undefined;
                payload.conversionRate = payload.conversionRate ? parseFloat(payload.conversionRate) : undefined;
                payload.refundAmount = payload.refundAmount ? parseFloat(payload.refundAmount) : undefined;
                payload.fineAmount = payload.fineAmount ? parseFloat(payload.fineAmount) : undefined;
                onSubmit(payload);
                onClose();
              }} className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-2.5 rounded-xl text-[11px] font-bold shadow-lg shadow-primary-600/30 transition-all uppercase tracking-wide active:scale-95">
                {initialData ? 'Update' : 'Save'}
              </button>
            </div>
          </div>

        </motion.div>
      </div>

      <AnimatePresence>
        {showPnrModal && (
          <PnrConverterModal 
            isOpen={showPnrModal} 
            onClose={() => setShowPnrModal(false)} 
            onSave={handlePnrData} 
          />
        )}
      </AnimatePresence>
    </>
  );
}
