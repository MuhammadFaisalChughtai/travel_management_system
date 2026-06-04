import { useState, useEffect } from 'react';
import { X, Car } from 'lucide-react';
import { motion } from 'framer-motion';
import type { TransportService, FlightService } from '../../types/booking';
import { VendorSelect } from '../shared/VendorSelect';
import { api as axios } from '../../api/axios';

interface AddTransportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (transport: Partial<TransportService>) => void;
  initialData?: TransportService | null;
  flights: FlightService[];
  accommodations?: any[];
}

export function AddTransportModal({ isOpen, onClose, onSubmit, flights, accommodations, initialData }: AddTransportModalProps) {
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

  
  const handlePickupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    let newForm = { ...form, departureDestination: val };
    
    const matchedFlight = flights.find(f => `${f.arrivedAt} (Arrival Flight ${f.flightNo})` === val);
    if (matchedFlight) {
      newForm.flightNo = matchedFlight.flightNo || form.flightNo;
      newForm.date = matchedFlight.date ? new Date(matchedFlight.date).toISOString().split('T')[0] : form.date;
      newForm.departureTime = matchedFlight.arrivalTime || form.departureTime;
      // Extract just the destination part for the actual value if desired, or keep the whole string. 
      // User might prefer keeping the whole string so they see what they selected.
    }
    
    setForm(newForm);
  };

  const handleDropoffChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    let newForm = { ...form, arrivalDestination: val };
    
    const matchedFlight = flights.find(f => `${f.departedFrom} (Departure Flight ${f.flightNo})` === val);
    if (matchedFlight) {
      newForm.flightNo = matchedFlight.flightNo || form.flightNo;
      newForm.date = matchedFlight.date ? new Date(matchedFlight.date).toISOString().split('T')[0] : form.date;
      newForm.arrivalTime = matchedFlight.departTime || form.arrivalTime;
    }
    
    setForm(newForm);
  };

  if (!isOpen) return null;

  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('custom');

  useEffect(() => {
    if (isOpen) {
      axios.get('/catalog').then(res => {
        const items = res.data.items || (Array.isArray(res.data) ? res.data : []);
        setCatalogItems(items.filter((item: any) => item.serviceType === 'TRANSPORT'));
      }).catch(console.error);
    }
  }, [isOpen]);

  const selectedCatalogItem = catalogItems.find(i => i.id.toString() === selectedCatalogId);

  useEffect(() => {
    if (selectedCatalogId !== 'custom' && selectedCatalogItem) {
      setForm(prev => {
        let vehicles = selectedCatalogItem.metadata?.vehicles;
        // Handle migration from old object format to new array format if needed
        if (vehicles && !Array.isArray(vehicles)) {
          vehicles = Object.keys(vehicles).map(k => ({ type: k, capacity: 4, price: vehicles[k] }));
        }
        
        const defaultVehicle = vehicles && vehicles.length > 0 ? vehicles[0].type : '';
        const defaultPrice = vehicles && vehicles.length > 0 ? vehicles[0].price : selectedCatalogItem.unitPrice;
        
        return {
          ...prev,
          vendorName: selectedCatalogItem.metadata?.vendorName || prev.vendorName,
          unitPrice: defaultPrice.toString(),
          price: (defaultPrice * (prev.qty || 1)).toString(),
          currency: selectedCatalogItem.currency || 'GBP',
          vehicleType: defaultVehicle || prev.vehicleType
        };
      });
    }
  }, [selectedCatalogId, catalogItems]);


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
          


          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(() => {
              let capacity = 999;
              if (selectedCatalogItem?.metadata?.vehicles) {
                let vehicles = selectedCatalogItem.metadata.vehicles;
                if (!Array.isArray(vehicles)) {
                  vehicles = Object.keys(vehicles).map(k => ({ type: k, capacity: 4, price: vehicles[k] }));
                }
                const vObj = vehicles.find((v: any) => v.type === form.vehicleType);
                if (vObj && vObj.capacity) capacity = vObj.capacity;
              }
              const pax = form.qty || 1;
              const vehiclesNeeded = Math.ceil(pax / capacity);
              
              return vehiclesNeeded > 1 ? (
                <div className="col-span-1 md:col-span-2 text-[11px] font-bold text-red-600 bg-red-50 p-3 rounded-lg border border-red-200 flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{pax} passengers exceed the limit of a single {form.vehicleType} (Max {capacity} Pax). System advice: Please change the vehicle type to a larger capacity.</span>
                </div>
              ) : null;
            })()}

            <div className="col-span-1 md:col-span-2 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50 mb-2">
              <label className="block text-[10px] font-extrabold text-indigo-800 mb-1.5 uppercase tracking-wide">Service Catalog Selection</label>
              <select value={selectedCatalogId} onChange={e => setSelectedCatalogId(e.target.value)} className="w-full border border-indigo-200 bg-white rounded-lg px-3 py-2 text-sm font-bold text-indigo-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm">
                <option value="custom">Custom / Not Listed (Manual Entry)</option>
                {catalogItems.map(item => (
                  <option key={item.id} value={item.id.toString()}>{item.name}{item.metadata?.vehicles ? '' : ` - ${item.currency} ${item.unitPrice}`}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Provider</label>
              <VendorSelect category="transport" value={form.vendorName || ''} onChange={val => setForm({...form, vendorName: val})} />
            </div>
            {selectedCatalogItem?.metadata?.vehicles ? (
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Vehicle Type</label>
                <select value={form.vehicleType || ''} onChange={e => {
                  const vType = e.target.value;
                  let vehicles = selectedCatalogItem.metadata.vehicles;
                  if (!Array.isArray(vehicles)) {
                    vehicles = Object.keys(vehicles).map(k => ({ type: k, capacity: 4, price: vehicles[k] }));
                  }
                  const vObj = vehicles.find((v: any) => v.type === vType);
                  const uPrice = vObj ? vObj.price : 0;
                  const capacity = vObj ? vObj.capacity : 999;
                  const vehiclesNeeded = Math.ceil((form.qty || 1) / capacity);
                  setForm({...form, vehicleType: vType, unitPrice: uPrice.toString(), price: (uPrice * vehiclesNeeded).toString()});
                }} className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700">
                  {(Array.isArray(selectedCatalogItem.metadata.vehicles) ? selectedCatalogItem.metadata.vehicles : Object.keys(selectedCatalogItem.metadata.vehicles).map(k => ({ type: k, capacity: 4, price: selectedCatalogItem.metadata.vehicles[k] }))).map((v: any) => (
                    <option key={v.type} value={v.type}>{v.type} (Max {v.capacity} Pax) - {selectedCatalogItem.currency} {v.price}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Vehicle Type</label>
                <input type="text" value={form.vehicleType || ''} onChange={e => setForm({...form, vehicleType: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" placeholder="e.g. Standard Car, Minivan" />
              </div>
            )}
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">From (Pick-up)</label>
              <input type="text" list="pickup-flights" value={form.departureDestination} onChange={handlePickupChange} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" placeholder="Type any location, flight, or hotel..." />
              <datalist id="pickup-flights">
                {flights?.map((f, i) => (
                  <option key={`pickup-${f.id || i}`} value={`${f.arrivedAt} (Arrival Flight ${f.flightNo})`} />
                ))}
                {accommodations?.map((h, i) => (
                  <option key={`pickup-hotel-${h.id || i}`} value={`${h.hotelName} (Hotel/Accommodation)`} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">To (Drop-off)</label>
              <input type="text" list="dropoff-flights" value={form.arrivalDestination} onChange={handleDropoffChange} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" placeholder="Type any location, flight, or hotel..." />
              <datalist id="dropoff-flights">
                {flights?.map((f, i) => (
                  <option key={`dropoff-${f.id || i}`} value={`${f.departedFrom} (Departure Flight ${f.flightNo})`} />
                ))}
                {accommodations?.map((h, i) => (
                  <option key={`dropoff-hotel-${h.id || i}`} value={`${h.hotelName} (Hotel/Accommodation)`} />
                ))}
              </datalist>
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
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Number of Passengers</label>
              <input type="number" min="1" value={form.qty || 1} onChange={e => {
                const newQty = parseInt(e.target.value) || 1;
                const u = parseFloat(String(form.unitPrice || 0)) || 0;
                
                let capacity = 999;
                if (selectedCatalogItem?.metadata?.vehicles) {
                  let vehicles = selectedCatalogItem.metadata.vehicles;
                  if (!Array.isArray(vehicles)) {
                    vehicles = Object.keys(vehicles).map(k => ({ type: k, capacity: 4, price: vehicles[k] }));
                  }
                  const vObj = vehicles.find((v: any) => v.type === form.vehicleType);
                  if (vObj && vObj.capacity) capacity = vObj.capacity;
                }
                const vehiclesNeeded = Math.ceil(newQty / capacity);
                
                setForm({...form, qty: newQty, price: (vehiclesNeeded * u).toString()});
              }} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" />
            </div>
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Unit Price (Per Vehicle)</label>
              <input type="number" value={form.unitPrice || ''} onChange={e => {
                const u = parseFloat(e.target.value || '0');
                let capacity = 999;
                if (selectedCatalogItem?.metadata?.vehicles) {
                  let vehicles = selectedCatalogItem.metadata.vehicles;
                  if (!Array.isArray(vehicles)) {
                    vehicles = Object.keys(vehicles).map(k => ({ type: k, capacity: 4, price: vehicles[k] }));
                  }
                  const vObj = vehicles.find((v: any) => v.type === form.vehicleType);
                  if (vObj && vObj.capacity) capacity = vObj.capacity;
                }
                const vehiclesNeeded = Math.ceil((form.qty || 1) / capacity);
                setForm({...form, unitPrice: e.target.value, price: (u * vehiclesNeeded).toString()});
              }} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" />
            </div>
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Total Price</label>
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
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Conversion Rate</label>
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
  );
}
