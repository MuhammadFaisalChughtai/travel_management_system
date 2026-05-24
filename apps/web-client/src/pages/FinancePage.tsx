import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Search, Plus, Edit3, Trash2, X, Check, AlertCircle } from 'lucide-react';
import { api } from '../api/axios';
import toast from 'react-hot-toast';

export function FinancePage({ bookings, onRefresh }: { bookings: any[]; onRefresh: () => void }) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'client' | 'vendor'>('client');
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [editingPayment, setEditingPayment] = useState<any | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Aggregate Client Payments
  const clientPayments = useMemo(() => {
    const all: any[] = [];
    bookings.forEach(b => {
      if (b.payments) {
        b.payments.forEach((p: any) => {
          all.push({ ...p, bookingRef: b.bookingReference, bookingId: b.id, isVendor: false });
        });
      }
    });
    return all.sort((a, b) => new Date(b.paidOn).getTime() - new Date(a.paidOn).getTime());
  }, [bookings]);

  // Aggregate Vendor Payments
  const vendorPayments = useMemo(() => {
    const all: any[] = [];
    bookings.forEach(b => {
      if (b.vendorPayments) {
        b.vendorPayments.forEach((p: any) => {
          all.push({ ...p, bookingRef: b.bookingReference, bookingId: b.id, isVendor: true });
        });
      }
    });
    return all.sort((a, b) => new Date(b.paidOn).getTime() - new Date(a.paidOn).getTime());
  }, [bookings]);

  const currentList = activeTab === 'client' ? clientPayments : vendorPayments;

  const filtered = currentList.filter(p => 
    p.bookingRef.toLowerCase().includes(search.toLowerCase()) ||
    (p.paymentMethod && p.paymentMethod.toLowerCase().includes(search.toLowerCase())) ||
    (p.vendorName && p.vendorName.toLowerCase().includes(search.toLowerCase())) ||
    (p.notes && p.notes.toLowerCase().includes(search.toLowerCase()))
  );

  const handleDelete = async () => {
    if (!deletingPayment) return;
    setActionLoading(true);
    try {
      const type = deletingPayment.isVendor ? 'vendor-payment' : 'payment';
      await api.delete(`/bookings/${deletingPayment.bookingId}/services/${type}/${deletingPayment.id}`);
      toast.success('Payment deleted successfully');
      setDeletingPayment(null);
      onRefresh();
    } catch (err) {
      toast.error('Failed to delete payment');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-emerald-500" /> Global Finance Ledger
          </h1>
          <p className="text-slate-500 text-sm font-medium mt-1">Comprehensive chronological registry of all corporate payment operations.</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-emerald-500/20 transition-all flex items-center gap-2 active:scale-95">
          <Plus className="w-4 h-4" /> Add Record
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
          <button 
            onClick={() => setActiveTab('client')}
            className={`px-6 py-2 rounded-lg text-[13px] font-bold transition-all ${activeTab === 'client' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Client Payments
          </button>
          <button 
            onClick={() => setActiveTab('vendor')}
            className={`px-6 py-2 rounded-lg text-[13px] font-bold transition-all ${activeTab === 'vendor' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Vendor Payments
          </button>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search transactions..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden text-[13px]">
        {filtered.length === 0 ? (
          <div className="bg-white p-16 text-center text-slate-400 font-medium">
            No transactions found matching your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-4 px-6">Transaction ID</th>
                  <th className="py-4 px-6">Booking Ref</th>
                  {activeTab === 'vendor' && <th className="py-4 px-6">Vendor Name</th>}
                  <th className="py-4 px-6">Amount Settled</th>
                  <th className="py-4 px-6">Date Paid</th>
                  {activeTab === 'client' && <th className="py-4 px-6">Method/Type</th>}
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 font-mono text-slate-400 text-xs">TXN-{p.id}</td>
                    <td className="py-4 px-6 font-black text-slate-900">{p.bookingRef}</td>
                    {activeTab === 'vendor' && <td className="py-4 px-6 font-semibold">{p.vendorName}</td>}
                    <td className={`py-4 px-6 font-black ${activeTab === 'client' ? 'text-emerald-600' : 'text-indigo-600'}`}>
                      £{Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-6 font-medium text-slate-600">{new Date(p.paidOn).toLocaleDateString()}</td>
                    {activeTab === 'client' && (
                      <td className="py-4 px-6">
                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-bold text-[10px] uppercase tracking-wide">
                          {p.paymentMethod} / {p.paymentType}
                        </span>
                      </td>
                    )}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setEditingPayment(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"><Edit3 className="w-4 h-4" /></button>
                        <button onClick={() => setDeletingPayment(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAddModal && (
          <PaymentFormModal
            onClose={() => setShowAddModal(false)}
            onSaved={onRefresh}
            bookings={bookings}
          />
        )}
        
        {editingPayment && (
          <PaymentFormModal
            onClose={() => setEditingPayment(null)}
            onSaved={onRefresh}
            bookings={bookings}
            initialData={editingPayment}
          />
        )}

        {deletingPayment && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setDeletingPayment(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-sm relative z-10 overflow-hidden flex flex-col p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4 text-rose-600">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Payment?</h3>
              <p className="text-slate-500 text-sm mb-6">This action cannot be undone. Are you sure you want to delete this transaction record?</p>
              <div className="flex gap-3">
                <button onClick={() => setDeletingPayment(null)} className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-all border border-slate-200">Cancel</button>
                <button onClick={handleDelete} disabled={actionLoading} className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[13px] font-bold shadow-md transition-all flex items-center justify-center gap-2">
                  {actionLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PaymentFormModal({ onClose, onSaved, bookings, initialData }: { onClose: () => void; onSaved: () => void; bookings: any[]; initialData?: any }) {
  const [isVendor, setIsVendor] = useState(initialData ? initialData.isVendor : false);
  const [bookingId, setBookingId] = useState(initialData?.bookingId || (bookings.length > 0 ? bookings[0].id : ''));
  const [amount, setAmount] = useState(String(initialData?.amount || ''));
  const [paidOn, setPaidOn] = useState(initialData?.paidOn ? new Date(initialData.paidOn).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState(initialData?.notes || '');
  
  // Client specific
  const [paymentMethod, setPaymentMethod] = useState(initialData?.paymentMethod || 'Bank Transfer');
  const [paymentType, setPaymentType] = useState(initialData?.paymentType || 'Deposit');
  
  // Vendor specific
  const [vendorName, setVendorName] = useState(initialData?.vendorName || '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingId) { setError('Select a booking first'); return; }
    if (!amount) { setError('Amount is required'); return; }
    setSaving(true);
    try {
      const payload: any = {
        amount: parseFloat(amount),
        paidOn: new Date(paidOn).toISOString(),
        notes
      };

      let endpoint = '';
      if (isVendor) {
        payload.vendorName = vendorName;
        endpoint = `/bookings/${bookingId}/vendor-payments`;
      } else {
        payload.paymentMethod = paymentMethod;
        payload.paymentType = paymentType;
        endpoint = `/bookings/${bookingId}/payments`;
      }

      if (initialData) {
        await api.patch(`${endpoint}/${initialData.id}`, payload);
      } else {
        await api.post(endpoint, payload);
      }
      
      toast.success(`Payment ${initialData ? 'updated' : 'recorded'} successfully`);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isVendor ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
              {initialData ? <Edit3 className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-[16px]">{initialData ? 'Edit Transaction' : 'Record New Payment'}</h3>
              <p className="text-[12px] text-slate-500 font-medium">{initialData ? 'Update existing ledger entry' : 'Log a new client or vendor payment'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl text-[13px] font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {!initialData && (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Transaction Type</label>
              <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button type="button" onClick={() => setIsVendor(false)} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${!isVendor ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Client Payment</button>
                <button type="button" onClick={() => setIsVendor(true)} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${isVendor ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Vendor Payment</button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Target Booking</label>
            <select required value={bookingId} onChange={e => setBookingId(Number(e.target.value))} disabled={!!initialData} className="w-full bg-white border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all disabled:bg-slate-50 disabled:text-slate-500">
              {bookings.map(b => (
                <option key={b.id} value={b.id}>{b.bookingReference} — {b.agentName || 'No Agent'} (Total: £{Number(b.totalPrice).toFixed(2)})</option>
              ))}
            </select>
          </div>

          {isVendor && (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Vendor Name</label>
              <input type="text" required value={vendorName} onChange={e => setVendorName(e.target.value)} className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all" placeholder="Enter vendor name" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Amount (£)</label>
              <input type="number" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-white border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Date Paid</label>
              <input type="date" required value={paidOn} onChange={e => setPaidOn(e.target.value)} className="w-full bg-white border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all" />
            </div>
          </div>

          {!isVendor && (
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Payment Method</label>
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full bg-white border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all">
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Cash">Cash</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Payment Type</label>
                <select value={paymentType} onChange={e => setPaymentType(e.target.value)} className="w-full bg-white border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all">
                  <option value="Deposit">Deposit</option>
                  <option value="Instalment">Instalment</option>
                  <option value="Final Payment">Final Payment</option>
                  <option value="Refund">Refund</option>
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Notes (Optional)</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-white border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all placeholder:text-slate-400" placeholder="Any reference numbers or notes..." />
          </div>

          <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3 -mx-6 -mb-6 mt-6 shrink-0">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-slate-600 hover:bg-slate-200/50 transition-all">Cancel</button>
            <button type="submit" disabled={saving} className={`px-6 py-2.5 rounded-xl text-white text-[13px] font-bold shadow-md transition-all flex items-center gap-2 active:scale-95 ${isVendor ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/25' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25'}`}>
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (initialData ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />)}
              {initialData ? 'Save Changes' : 'Record Transaction'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
