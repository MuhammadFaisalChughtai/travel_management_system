import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Check, Loader2, CreditCard, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { MultiSelectDropdown } from '../shared/MultiSelectDropdown';
import { api } from '../../api/axios';
import { useCurrency } from '../../utils/currency';

interface ServiceItem {
  id: number;
  bookingId: number;
  bookingRef: string;
  serviceCategory: 'Flights' | 'Hotels' | 'Visas' | 'Transportation' | 'Special Services';
  serviceType: 'FLIGHT' | 'HOTEL' | 'TRANSPORT' | 'VISA' | 'ADDITIONAL';
  description: string;
  pendingAmount: number;
}

interface VendorReconciliationModalProps {
  onClose: () => void;
  onSaved: () => void;
  bookings?: any[];
}

export function VendorReconciliationModal({ onClose, onSaved, bookings: _bookings }: VendorReconciliationModalProps) {
  const { symbol } = useCurrency();
  // 1. TIER 1 - Basic Inputs
  const [lumpSum, setLumpSum] = useState<number | ''>('');
  const [paidOn, setPaidOn] = useState(new Date().toISOString().split('T')[0]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [notes, setNotes] = useState('');
  
  // Vendors from DB
  const [dbVendors, setDbVendors] = useState<{id: string | number, name: string}[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(true);

  // Unpaid bookings and services state
  const [unpaidBookings, setUnpaidBookings] = useState<any[]>([]);
  const [unpaidServices, setUnpaidServices] = useState<ServiceItem[]>([]);
  const [loadingUnpaid, setLoadingUnpaid] = useState(false);

  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const res = await api.get('/vendors');
        if (Array.isArray(res.data)) {
          setDbVendors(res.data);
        } else if (res.data.vendors && Array.isArray(res.data.vendors)) {
          setDbVendors(res.data.vendors);
        } else if (res.data.data && Array.isArray(res.data.data)) {
          setDbVendors(res.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch vendors:', err);
      } finally {
        setLoadingVendors(false);
      }
    };
    fetchVendors();
  }, []);

  // Wallet Drawdown State
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [useWalletCredit, setUseWalletCredit] = useState<boolean>(false);

  // 2. TIER 2 - Booking Selection
  const [selectedBookings, setSelectedBookings] = useState<(string | number)[]>([]);
  
  // 3. TIER 3 - Service Level Allocation (Store selected service IDs)
  const [selectedServiceIds, setSelectedServiceIds] = useState<(string | number)[]>([]);
  
  // UI States
  const [saving, setSaving] = useState(false);

  // Fetch Wallet Balance and Unpaid Bookings when Vendor Changes
  useEffect(() => {
    if (selectedVendorId) {
      // Fetch real unpaid bookings, services, and wallet credit for the selected vendor
      const selectedVendor = dbVendors.find(v => String(v.id) === String(selectedVendorId));
      if (selectedVendor) {
        setLoadingUnpaid(true);
        api.get(`/finance/vendors/unpaid-bookings?vendorName=${encodeURIComponent(selectedVendor.name)}`)
          .then(res => {
            setUnpaidBookings(res.data.bookings || []);
            setUnpaidServices(res.data.services || []);
            setWalletBalance(res.data.walletBalance || 0);
          })
          .catch(err => {
            console.error('Failed to fetch unpaid bookings:', err);
            toast.error('Failed to load unpaid bookings for this vendor.');
            setWalletBalance(0);
          })
          .finally(() => {
            setLoadingUnpaid(false);
          });
      }
    } else {
      setWalletBalance(0);
      setUnpaidBookings([]);
      setUnpaidServices([]);
    }
    setUseWalletCredit(false);
  }, [selectedVendorId, dbVendors]);

  // Derived Data
  const availableBookings = useMemo(() => {
    return unpaidBookings.map(b => ({
      id: b.id,
      label: `${b.bookingReference} (Total Invoice: ${symbol}${Number(b.totalPrice).toFixed(2)})`
    }));
  }, [unpaidBookings, symbol]);

  const availableServices = useMemo(() => {
    return unpaidServices.filter(s => selectedBookings.includes(s.bookingId));
  }, [selectedBookings, unpaidServices]);

  // Group available services for the dropdowns
  const groupedOptions = useMemo(() => {
    const groups: Record<string, { id: number; label: string }[]> = {};
    availableServices.forEach(s => {
      if (!groups[s.serviceCategory]) groups[s.serviceCategory] = [];
      groups[s.serviceCategory].push({
        id: s.id,
        label: `${s.bookingRef}: ${s.description} (${symbol}${s.pendingAmount})`
      });
    });
    return groups;
  }, [availableServices, symbol]);

  // Calculations
  const effectivePaymentPower = useMemo(() => {
    const base = typeof lumpSum === 'number' ? lumpSum : 0;
    return useWalletCredit ? base + walletBalance : base;
  }, [lumpSum, useWalletCredit, walletBalance]);

  const totalAllocation = useMemo(() => {
    return availableServices
      .filter(s => selectedServiceIds.includes(s.id))
      .reduce((sum, s) => sum + s.pendingAmount, 0);
  }, [selectedServiceIds, availableServices]);

  const overAllocated = totalAllocation > effectivePaymentPower;
  const remainingLumpSum = effectivePaymentPower - totalAllocation;

  // Handlers
  const handleVendorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedVendorId(e.target.value);
    setSelectedBookings([]);
    setSelectedServiceIds([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (effectivePaymentPower <= 0) { toast.error("Please enter a valid amount."); return; }
    if (selectedServiceIds.length === 0) { toast.error("Please select services to allocate to."); return; }

    const selectedVendor = dbVendors.find(v => String(v.id) === String(selectedVendorId));
    if (!selectedVendor) { toast.error("Selected vendor not found!"); return; }

    setSaving(true);
    try {
      const payload = {
        vendorName: selectedVendor.name,
        amount: Number(lumpSum),
        walletCreditUsed: useWalletCredit ? walletBalance : 0,
        paymentMethod: 'Bank Transfer',
        paidOn,
        notes: notes || `Bulk payment to vendor ${selectedVendor.name}`,
        allocations: selectedServiceIds.map(id => {
          const s = availableServices.find(srv => srv.id === id);
          return {
            bookingId: s?.bookingId,
            serviceId: s?.id,
            serviceType: s?.serviceType,
            amountApplied: s?.pendingAmount
          };
        }).filter(a => a.serviceId && a.serviceType)
      };
      console.log("Submitting Vendor Payment Payload:", payload);
      await api.post('/ledger/vendor-payment', payload);
      toast.success("Vendor payment successfully recorded!");
      onSaved();
      onClose();
    } catch (err: any) {
      console.error("Failed to save transaction:", err);
      toast.error(err?.response?.data?.message || "Failed to save transaction.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl w-full max-w-3xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="bg-gradient-to-r from-primary-900 to-indigo-900 text-white px-6 py-4 flex justify-between items-center shadow-inner shrink-0">
          <div className="flex items-center gap-3">
            <div className="text-indigo-300">
              <CreditCard className="w-4 h-4" />
            </div>
            <h2 className="font-bold text-[14px] tracking-wide uppercase">Record Vendor Payment</h2>
          </div>
          <button type="button" onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1 bg-white/50">
          
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Transfer Amount ({symbol})</label>
              <input 
                type="number" step="0.01" required value={lumpSum} 
                onChange={e => setLumpSum(e.target.value === '' ? '' : Number(e.target.value))} 
                className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all" 
                placeholder="0.00" 
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Date Paid</label>
              <input 
                type="date" required value={paidOn} 
                onChange={e => setPaidOn(e.target.value)} 
                className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all" 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Select Vendor</label>
              <select 
                required value={selectedVendorId} onChange={handleVendorChange} 
                className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all"
                disabled={loadingVendors}
              >
                <option value="">{loadingVendors ? 'Loading vendors...' : '-- Choose Vendor --'}</option>
                {dbVendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>

            {selectedVendorId ? (
              loadingUnpaid ? (
                <div className="flex flex-col justify-end">
                   <div className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-slate-400 text-[13px] italic flex items-center h-[42px] gap-2">
                     <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                     Fetching unpaid bookings...
                   </div>
                </div>
              ) : (
                <MultiSelectDropdown
                  label="Target Bookings"
                  placeholder={availableBookings.length === 0 ? "No unpaid bookings found" : "Select unpaid bookings..."}
                  options={availableBookings}
                  selectedIds={selectedBookings}
                  onChange={(ids) => {
                    setSelectedBookings(ids);
                    const validBookingIds = ids;
                    const stillValidServiceIds = availableServices
                      .filter(s => validBookingIds.includes(s.bookingId) && selectedServiceIds.includes(s.id))
                      .map(s => s.id);
                    setSelectedServiceIds(stillValidServiceIds);
                  }}
                />
              )
            ) : (
              <div className="flex flex-col justify-end">
                 <div className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-slate-400 text-[13px] italic flex items-center h-[42px]">
                   Select a vendor first
                 </div>
              </div>
            )}
          </div>

          {walletBalance > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl mt-2">
              <p className="text-emerald-800 font-bold text-xs">You have {symbol}{walletBalance.toFixed(2)} in floating credit with this vendor.</p>
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input 
                  type="checkbox" checked={useWalletCredit} 
                  onChange={e => setUseWalletCredit(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <span className="text-[13px] font-semibold text-emerald-700">Apply Wallet Credit to this payment?</span>
              </label>
            </div>
          )}

          {selectedBookings.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <p className="text-[11px] font-extrabold text-indigo-900 uppercase tracking-wider">Unpaid Services Drill-Down</p>
              
              {Object.keys(groupedOptions).length === 0 ? (
                <p className="text-xs text-slate-400 font-medium">No unpaid services found in these bookings.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {Object.entries(groupedOptions).map(([category, options]) => (
                    <MultiSelectDropdown
                      key={category}
                      label={`Unpaid ${category}`}
                      placeholder={`Select ${category}...`}
                      options={options}
                      selectedIds={selectedServiceIds.filter(id => options.some(o => o.id === id))}
                      onChange={(ids) => {
                        const otherCategoryIds = selectedServiceIds.filter(id => !options.some(o => o.id === id));
                        setSelectedServiceIds([...otherCategoryIds, ...ids]);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Notes (Optional)</label>
            <input 
              type="text" value={notes} onChange={e => setNotes(e.target.value)} 
              className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all placeholder:text-slate-400" 
              placeholder="Any reference numbers or notes..." 
            />
          </div>

          <div className={`p-4 rounded-xl border ${overAllocated ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex justify-between items-end mb-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Allocation Tally</span>
              <span className={`text-lg font-black ${overAllocated ? 'text-amber-600' : 'text-indigo-900'}`}>
                {symbol}{totalAllocation.toFixed(2)} <span className="text-sm text-slate-400">/ {symbol}{effectivePaymentPower.toFixed(2)}</span>
              </span>
            </div>
            {useWalletCredit && (
              <p className="text-[10px] font-bold text-emerald-600 mb-2">Includes {symbol}{walletBalance.toFixed(2)} wallet credit</p>
            )}
            {overAllocated ? (
              <p className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Note: Partial payment. Newest booking(s) will be marked as partially paid.
              </p>
            ) : (
              remainingLumpSum > 0 && <p className="text-[11px] font-bold text-emerald-600">{symbol}{remainingLumpSum.toFixed(2)} remaining to allocate</p>
            )}
          </div>

          <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3 -mx-6 -mb-6 mt-6 shrink-0">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-slate-600 hover:bg-slate-200/50 transition-all">Cancel</button>
            <button 
              type="submit" 
              disabled={saving || totalAllocation === 0 || effectivePaymentPower <= 0} 
              className="px-6 py-2.5 rounded-xl text-white text-[13px] font-bold shadow-md shadow-indigo-600/25 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 disabled:shadow-none disabled:text-slate-500 transition-all flex items-center gap-2 active:scale-95"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Record Transaction
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
