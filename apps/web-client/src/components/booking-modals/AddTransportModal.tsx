import { useState, useEffect } from 'react';
import { X, Car } from 'lucide-react';
import { motion } from 'framer-motion';
import type { TransportService, FlightService } from '../../types/booking';
import { VendorSelect } from '../shared/VendorSelect';

interface AddTransportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (transport: Partial<TransportService>) => void;
  initialData?: TransportService | null;
  flights: FlightService[];
}

export function AddTransportModal({ isOpen, onClose, onSubmit, flights }: AddTransportModalProps) {
  const [form, setForm] = useState<Partial<TransportService>>({
    vendorName: '',
    vehicleType: '',
    departureDestination: '',
    arrivalDestination: '',
    date: '',
    departureTime: '',
    arrivalTime: '',
    flightNo: '',
    price: '',
    currency: 'GBP'
  });

  const [useArrivalFlight, setUseArrivalFlight] = useState(false);
  const [useDepartureFlight, setUseDepartureFlight] = useState(false);

  useEffect(() => {
    if (useArrivalFlight && flights && flights.length > 0) {
      // If there are multiple flights, select the second one as requested, otherwise the first
      const flight = flights.length > 1 ? flights[1] : flights[0];
      setForm(prev => ({
        ...prev,
        flightNo: flight.flightNo || prev.flightNo,
        date: flight.date || prev.date,
        departureTime: flight.arrivalTime || prev.departureTime // Transport departs when flight arrives
      }));
      setUseDepartureFlight(false);
    }
  }, [useArrivalFlight, flights]);

  useEffect(() => {
    if (useDepartureFlight && flights && flights.length > 0) {
      const flight = flights[0]; // Usually departure is the first flight
      setForm(prev => ({
        ...prev,
        flightNo: flight.flightNo || prev.flightNo,
        date: flight.date || prev.date,
        arrivalTime: flight.departTime || prev.arrivalTime // Transport arrives before flight departs
      }));
      setUseArrivalFlight(false);
    }
  }, [useDepartureFlight, flights]);

  
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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] relative z-10 overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-primary-900 to-indigo-900 text-white px-6 py-4 flex justify-between items-center shadow-inner">
          <div className="flex items-center gap-3">
            <Car className="h-5 w-5 text-indigo-300" />
            <h3 className="font-bold text-[14px] tracking-wide uppercase">{initialData ? 'Edit' : 'Add'} Transport</h3>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          
          {flights && flights.length > 0 && (
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 flex gap-6">
              <label className="flex items-center gap-2 text-[11px] font-bold text-indigo-900 cursor-pointer">
                <input type="checkbox" checked={useArrivalFlight} onChange={e => setUseArrivalFlight(e.target.checked)} className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500" />
                Auto-fill from Arrival Flight
              </label>
              <label className="flex items-center gap-2 text-[11px] font-bold text-indigo-900 cursor-pointer">
                <input type="checkbox" checked={useDepartureFlight} onChange={e => setUseDepartureFlight(e.target.checked)} className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500" />
                Auto-fill from Departure Flight
              </label>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Provider</label>
              <VendorSelect category="transport" value={form.vendorName || ''} onChange={val => setForm({...form, vendorName: val})} />
            </div>
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Vehicle Type</label>
              <input type="text" value={form.vehicleType} onChange={e => setForm({...form, vehicleType: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" placeholder="e.g. Standard Car, Minivan" />
            </div>
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">From (Pick-up)</label>
              <input type="text" value={form.departureDestination} onChange={e => setForm({...form, departureDestination: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" />
            </div>
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">To (Drop-off)</label>
              <input type="text" value={form.arrivalDestination} onChange={e => setForm({...form, arrivalDestination: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" />
            </div>
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Linked Flight No.</label>
              <input type="text" value={form.flightNo || ''} onChange={e => setForm({...form, flightNo: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700 uppercase" />
            </div>
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Date</label>
              <input type="date" value={form.date || ''} onChange={e => setForm({...form, date: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" />
            </div>
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Pick-up Time</label>
              <input type="time" value={form.departureTime || ''} onChange={e => setForm({...form, departureTime: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" />
            </div>
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Drop-off Time</label>
              <input type="time" value={form.arrivalTime || ''} onChange={e => setForm({...form, arrivalTime: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" />
            </div>
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Price</label>
              <input type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" />
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
              <button onClick={() => { onSubmit(form as any); onClose(); }} className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-2.5 rounded-xl text-[11px] font-bold shadow-lg shadow-primary-600/30 transition-all uppercase tracking-wide active:scale-95">
                {initialData ? 'Update' : 'Save'}
              </button>
            </div>
          </div>

      </motion.div>
    </div>
  );
}
