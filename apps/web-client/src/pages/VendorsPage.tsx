import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Search, Plus, Trash2, Edit3, X, Check
} from 'lucide-react';
import { api } from '../api/axios';
import { EntityCard } from '../components/EntityCard';
import { EmptyState } from '../components/shared/EmptyState';
import { LoadingState } from '../components/shared/LoadingState';

interface Vendor {
  id: number;
  name: string;
  phoneNumber: string;
  email: string;
  website: string;
  vendorType: string;
  creditBalance: number;
}

export function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [deletingVendorId, setDeletingVendorId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const res = await api.get('/vendors');
      setVendors(res.data.vendors || []);
    } catch (error) {
      console.error('Failed to fetch vendors', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingVendorId) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/vendors/${deletingVendorId}`);
      setVendors(prev => prev.filter(v => v.id !== deletingVendorId));
      setDeletingVendorId(null);
    } catch (error) {
      console.error('Failed to delete vendor', error);
    } finally {
      setDeleteLoading(false);
    }
  };

  const filtered = vendors.filter(v => 
    v.name.toLowerCase().includes(search.toLowerCase()) || 
    (v.vendorType && v.vendorType.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Vendors Directory</h1>
          <p className="text-slate-500 text-xs mt-0.5">Manage external vendors, suppliers, and ledger balances.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 bg-primary-600 text-white hover:bg-primary-500 px-4.5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-primary-500/20 active:scale-95 transition-all">
            <Plus className="h-4 w-4" /> Add Vendor
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search vendors..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm"
          />
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading vendors..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No vendors found"
          description="Try adjusting your search or add a new vendor."
        />
      ) : (
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filtered.map(vendor => (
              <motion.div key={vendor.id} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}>
                <EntityCard 
                  name={vendor.name}
                  badge={vendor.vendorType || 'Vendor'}
                  phone={vendor.phoneNumber}
                  email={vendor.email}
                  customFooter={
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-slate-600 font-medium flex items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Balance</span>
                        <span className="font-black text-emerald-600">£{Number(vendor.creditBalance).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); setEditingVendor(vendor); setShowAddModal(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"><Edit3 className="w-4 h-4" /></button>
                        <button onClick={(e) => { e.stopPropagation(); setDeletingVendorId(vendor.id); }} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  }
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <AnimatePresence>
        {showAddModal && (
          <VendorFormModal
            onClose={() => { setShowAddModal(false); setEditingVendor(null); }}
            onSaved={fetchVendors}
            initialData={editingVendor}
          />
        )}
        
        {deletingVendorId && (
          <DeleteConfirmationModal 
            onClose={() => setDeletingVendorId(null)}
            onConfirm={handleDelete}
            loading={deleteLoading}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function VendorFormModal({ onClose, onSaved, initialData }: { onClose: () => void; onSaved: () => void; initialData?: any | null }) {
  const presetTypes = ['Visa', 'Flight', 'Hotel', 'Transport', 'Insurance'];
  const initType = initialData?.vendorType && !presetTypes.includes(initialData.vendorType) ? 'Other' : (initialData?.vendorType || 'Visa');
  
  const [fName, setFName] = useState(initialData?.name || '');
  const [fPhone, setFPhone] = useState(initialData?.phoneNumber || '');
  const [fEmail, setFEmail] = useState(initialData?.email || '');
  const [fWebsite, setFWebsite] = useState(initialData?.website || '');
  const [fType, setFType] = useState(initType);
  const [fCustomType, setFCustomType] = useState(initType === 'Other' ? (initialData?.vendorType || '') : '');
  const [fBalance, setFBalance] = useState(String(initialData?.creditBalance || 0));
  const [actionLoading, setActionLoading] = useState(false);

  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const payload = {
        name: fName,
        phoneNumber: fPhone,
        email: fEmail,
        website: fWebsite,
        vendorType: fType === 'Other' ? (fCustomType || 'Other') : fType,
        creditBalance: parseFloat(fBalance) || 0
      };

      if (initialData) {
        await api.patch(`/vendors/${initialData.id}`, payload);
      } else {
        await api.post('/vendors', payload);
      }
      onSaved();
      onClose();
    } catch (error) {
      console.error('Save vendor failed', error);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} 
        className="bg-white/90 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl w-full max-w-3xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="bg-gradient-to-r from-primary-900 to-indigo-900 text-white px-6 py-4 flex justify-between items-center shadow-inner">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-indigo-300" />
            <h3 className="font-bold text-[14px] tracking-wide uppercase">{initialData ? 'Edit Vendor Profile' : 'Add New Vendor'}</h3>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSaveVendor} className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          <div className="space-y-4">
            <h4 className="text-[11px] font-extrabold text-indigo-900 tracking-wide uppercase border-b border-indigo-100 pb-1">Vendor Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Vendor Name *</label>
                <input type="text" required value={fName} onChange={e => setFName(e.target.value)} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" placeholder="e.g. Insurate Ltd" />
              </div>
              
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Phone Number</label>
                <input type="text" value={fPhone} onChange={e => setFPhone(e.target.value)} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" placeholder="+44..." />
              </div>
              
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Vendor Type</label>
                <select value={fType} onChange={e => setFType(e.target.value)} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700">
                  <option value="Visa">Visa</option>
                  <option value="Flight">Flight</option>
                  <option value="Hotel">Hotel</option>
                  <option value="Transport">Transport</option>
                  <option value="Insurance">Insurance</option>
                  <option value="Other">Other</option>
                </select>
                {fType === 'Other' && (
                  <motion.input initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} type="text" value={fCustomType} onChange={e => setFCustomType(e.target.value)} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700 mt-2" placeholder="Specify type" />
                )}
              </div>
              
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Email Address</label>
                <input type="email" value={fEmail} onChange={e => setFEmail(e.target.value)} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" placeholder="contact@vendor.com" />
              </div>
              
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Credit Balance</label>
                <input type="number" step="0.01" value={fBalance} onChange={e => setFBalance(e.target.value)} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" placeholder="0.00" />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Website</label>
                <input type="text" value={fWebsite} onChange={e => setFWebsite(e.target.value)} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" placeholder="https://" />
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-auto">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-[11px] font-bold text-slate-600 hover:bg-slate-200/50 transition-colors">Cancel</button>
            <button type="submit" disabled={actionLoading} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl text-[11px] font-bold shadow-md shadow-indigo-200 transition-all uppercase tracking-wide flex items-center gap-2">
              {actionLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (initialData ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />)}
              {initialData ? 'Save Changes' : 'Add Vendor'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function DeleteConfirmationModal({ onClose, onConfirm, loading }: { onClose: () => void; onConfirm: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-sm relative z-10 overflow-hidden flex flex-col p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4 text-rose-600">
          <Trash2 className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Vendor?</h3>
        <p className="text-slate-500 text-sm mb-6">This action cannot be undone. Are you sure you want to permanently delete this vendor?</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-all border border-slate-200">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[13px] font-bold shadow-md transition-all flex items-center justify-center gap-2">
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Delete'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
