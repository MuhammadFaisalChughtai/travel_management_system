import { useState, useEffect } from 'react';
import { X, Hotel } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Accommodation } from '../../types/booking';
import { VendorSelect } from '../shared/VendorSelect';
import { api as axios } from '../../api/axios';

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
    city: '',
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
        ['checkInDate', 'checkOutDate'].forEach(field => {
          if ((mappedData as any)[field]) {
            try { 
              const d = new Date((mappedData as any)[field]);
              // Format to YYYY-MM-DDTHH:mm
              (mappedData as any)[field] = d.toISOString().slice(0, 16);
            } catch(e) {}
          }
        });
        ['issueDate', 'lastCancellationDate'].forEach(field => {
          if ((mappedData as any)[field]) {
            try { 
              (mappedData as any)[field] = new Date((mappedData as any)[field]).toISOString().split('T')[0]; 
            } catch(e) {}
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

  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('custom');
  
  const selectedCatalogItem = catalogItems.find(i => i.id.toString() === selectedCatalogId);
  const [selectedCategory, setSelectedCategory] = useState(''); // Will store stringified index
  const [selectedOccupancy, setSelectedOccupancy] = useState('dbl');
  const [addIftar, setAddIftar] = useState(false);
  const [addSehor, setAddSehor] = useState(false);

  // Effect 1: Auto-fill dates when category changes
  useEffect(() => {
    if (selectedCatalogItem?.metadata?.hotelRooms && selectedCategory) {
      const room = selectedCatalogItem.metadata.hotelRooms[parseInt(selectedCategory)];
      if (room) {
        setForm(prev => {
           let newCheckIn = prev.checkInDate;
           let newCheckOut = prev.checkOutDate;
           
           if (room.fromDate) {
               newCheckIn = `${room.fromDate}T14:00`;
           }
           if (room.toDate) {
               newCheckOut = `${room.toDate}T12:00`;
           }
           
           return {
             ...prev,
             checkInDate: newCheckIn,
             checkOutDate: newCheckOut
           };
        });
      }
    }
  }, [selectedCategory, selectedCatalogItem]);

  // Effect 2: Recalculate price when dependencies change
  useEffect(() => {
    if (selectedCatalogItem?.metadata?.hotelRooms && selectedCategory) {
      const room = selectedCatalogItem.metadata.hotelRooms[parseInt(selectedCategory)];
      if (room) {
        let basePrice = Number(room[selectedOccupancy]) || 0;
        if (addIftar) basePrice += Number(room.iftar) || 0;
        if (addSehor) basePrice += Number(room.sehor) || 0;
        if (room.meals && room.meals !== 'Room Only' && room.mealPrice) {
          basePrice += Number(room.mealPrice) || 0;
        }
        
        setForm(prev => {
           const total = basePrice * (prev.qty || 1);
           const mealSuffix = (room.meals && room.meals !== 'Room Only') ? ` + ${room.meals}` : '';
           
           return {
             ...prev,
             price: total.toString(),
             roomType: `${room.roomName} (${selectedOccupancy.toUpperCase()})${mealSuffix}${addIftar ? ' + Iftar' : ''}${addSehor ? ' + Sehor' : ''}`, // selectedCategory is index
             mealType: room.meals
           };
        });
      }
    }
  }, [selectedCategory, selectedOccupancy, addIftar, addSehor, form.qty, form.checkInDate, form.checkOutDate, selectedCatalogItem]);

  useEffect(() => {
    if (isOpen) {
      axios.get('/catalog').then(res => {
        const items = res.data.items || (Array.isArray(res.data) ? res.data : []);
        setCatalogItems(items.filter((item: any) => item.serviceType === 'HOTEL'));
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
          <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50 mb-2">
              <label className="block text-[10px] font-extrabold text-indigo-800 mb-1.5 uppercase tracking-wide">Service Catalog Selection</label>
              <select value={selectedCatalogId} onChange={e => setSelectedCatalogId(e.target.value)} className="w-full border border-indigo-200 bg-white rounded-lg px-3 py-2 text-sm font-bold text-indigo-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm">
                <option value="custom">Custom / Not Listed (Manual Entry)</option>
                {catalogItems.map((item, index) => (
                  <option key={item.id || `item-${index}`} value={item.id.toString()}>{item.name}{item.metadata?.hotelRooms ? '' : ` - ${item.currency} ${item.unitPrice}`}</option>
                ))}
              </select>
            </div>
            
            {selectedCatalogItem?.metadata?.hotelRooms && (
              <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50 mb-2">
                <h4 className="text-[11px] font-extrabold text-indigo-900 tracking-wide uppercase border-b border-indigo-100 pb-1 mb-3">Room Selection</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Category</label>
                    <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-[11px] font-semibold text-slate-700 outline-none">
                      <option value="">Select...</option>
                      {selectedCatalogItem.metadata.hotelRooms.map((r: any, i: number) => (
                        <option key={i} value={i.toString()}>
                          {r.roomName} {r.fromDate || r.toDate ? `(${r.fromDate || '...'} to ${r.toDate || '...'})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Occupancy</label>
                    <select value={selectedOccupancy} onChange={e => setSelectedOccupancy(e.target.value)} className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-[11px] font-semibold text-slate-700 outline-none">
                      <option value="dbl">Double (DBL)</option>
                      <option value="trp">Triple (TRP)</option>
                      <option value="quad">Quad (QUAD)</option>
                    </select>
                  </div>
                  <div className="flex items-end gap-4 pb-2">
                    {selectedCategory && Number(selectedCatalogItem?.metadata?.hotelRooms?.[parseInt(selectedCategory)]?.iftar) > 0 && (
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input type="checkbox" checked={addIftar} onChange={e => setAddIftar(e.target.checked)} className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                        <span className="text-[11px] font-bold text-slate-700">Add Iftar</span>
                      </label>
                    )}
                    {selectedCategory && Number(selectedCatalogItem?.metadata?.hotelRooms?.[parseInt(selectedCategory)]?.sehor) > 0 && (
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input type="checkbox" checked={addSehor} onChange={e => setAddSehor(e.target.checked)} className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                        <span className="text-[11px] font-bold text-slate-700">Add Sehor</span>
                      </label>
                    )}
                  </div>
                </div>
              </div>
            )}
          
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
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Hotel Address</label>
                <input type="text" value={form.hotelAddress || ''} onChange={e => setForm({...form, hotelAddress: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">City</label>
                <input type="text" value={form.city || ''} onChange={e => setForm({...form, city: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" />
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
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Booking Date</label>
                <input type="date" value={form.issueDate || ''} onChange={e => setForm({...form, issueDate: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" />
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
