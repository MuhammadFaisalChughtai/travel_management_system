import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Search, Plus, Trash2, Edit3, X, Check, Globe, Phone, Mail
} from 'lucide-react';
import { api } from '../api/axios';
import { EmptyState } from '../components/shared/EmptyState';
import { LoadingState } from '../components/shared/LoadingState';
import { Pagination } from '../components/shared/Pagination';
import toast from 'react-hot-toast';

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

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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
      toast.error('Failed to load vendors');
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
      toast.success('Vendor deleted successfully');
    } catch (error) {
      console.error('Failed to delete vendor', error);
      toast.error('Failed to delete vendor');
    } finally {
      setDeleteLoading(false);
    }
  };

  const filtered = vendors.filter(v => 
    v.name.toLowerCase().includes(search.toLowerCase()) || 
    (v.vendorType && v.vendorType.toLowerCase().includes(search.toLowerCase()))
  );

  const paginatedVendors = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getInitials = (name: string) => {
    return name.substring(0, 2).toUpperCase() || 'V';
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            Vendors Directory
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">Manage external vendors, suppliers, and ledger balances.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setEditingVendor(null); setShowAddModal(true); }} className="flex items-center gap-1.5 bg-primary-600 text-white hover:bg-primary-500 px-4.5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-primary-500/20 active:scale-95 transition-all">
            <Plus className="h-4 w-4" /> Add Vendor
          </button>
        </div>
      </div>

      <div className="bg-white/70 backdrop-blur-xl border border-white rounded-3xl shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4 bg-white/50 flex items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              value={search} 
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} 
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 focus:border-primary-500 rounded-xl text-slate-800 text-[13px] outline-none transition-all placeholder:text-slate-400 shadow-sm" 
              placeholder="Search vendors..." 
            />
          </div>
        </div>

        <div className="p-0">
          {loading ? (
            <div className="p-8">
              <LoadingState message="Loading vendors..." />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8">
              <EmptyState 
                icon={Building2} 
                title={search ? 'No vendors found' : 'No vendors yet'} 
                description={search ? `We couldn't find anyone matching "${search}"` : 'Get started by adding a new vendor.'} 
                transparent
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-400 font-bold uppercase text-[11px] border-b border-slate-100">
                      <th className="py-3 px-6">Vendor Name</th>
                      <th className="py-3 px-6">Type</th>
                      <th className="py-3 px-6">Contact Details</th>
                      <th className="py-3 px-6">Credit Balance</th>
                      <th className="py-3 px-6 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/50 text-[12px] font-medium bg-white/40">
                    {paginatedVendors.map((vendor) => (
                      <tr key={vendor.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-primary-100 text-indigo-700 flex items-center justify-center font-bold text-[11px] border border-indigo-200/50 shadow-sm shrink-0">
                              {getInitials(vendor.name)}
                            </div>
                            <div>
                              <span className="font-bold text-slate-800 block">{vendor.name}</span>
                              {vendor.website && (
                                <a href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary-500 hover:underline flex items-center gap-1 mt-0.5">
                                  <Globe className="w-3 h-3" /> {vendor.website.replace(/^https?:\/\//, '')}
                                </a>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-6">
                          <span className="inline-block px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest bg-slate-100 text-slate-600 border border-slate-200">
                            {vendor.vendorType || 'Vendor'}
                          </span>
                        </td>
                        <td className="py-3 px-6">
                          <div className="space-y-1">
                            {vendor.email && (
                              <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                                <Mail className="w-3.5 h-3.5 text-slate-400" />
                                {vendor.email}
                              </div>
                            )}
                            {vendor.phoneNumber && (
                              <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                                <Phone className="w-3.5 h-3.5 text-slate-400" />
                                {vendor.phoneNumber}
                              </div>
                            )}
                            {!vendor.email && !vendor.phoneNumber && <span className="text-slate-400 italic text-[11px]">No contact details</span>}
                          </div>
                        </td>
                        <td className="py-3 px-6">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold ${
                            Number(vendor.creditBalance) < 0 
                              ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                              : Number(vendor.creditBalance) > 0 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : 'bg-slate-50 text-slate-600 border border-slate-200'
                          }`}>
                            £{Number(vendor.creditBalance).toLocaleString(undefined, {minimumFractionDigits: 2})}
                          </span>
                        </td>
                        <td className="py-3 px-6 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button 
                              onClick={() => { setEditingVendor(vendor); setShowAddModal(true); }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                              title="Edit Vendor"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setDeletingVendorId(vendor.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Delete Vendor"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination 
                currentPage={currentPage}
                totalPages={Math.ceil(filtered.length / itemsPerPage)}
                onPageChange={setCurrentPage}
                itemsPerPage={itemsPerPage}
                totalItems={filtered.length}
              />
            </>
          )}
        </div>
      </div>

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
        toast.success('Vendor updated successfully');
      } else {
        await api.post('/vendors', payload);
        toast.success('Vendor added successfully');
      }
      onSaved();
      onClose();
    } catch (error) {
      console.error('Save vendor failed', error);
      toast.error('Failed to save vendor');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} 
        className="bg-slate-50 border border-slate-200 rounded-3xl shadow-2xl w-full max-w-3xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="bg-gradient-to-r from-primary-900 to-indigo-900 text-white px-6 py-5 flex justify-between items-center shadow-lg relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
          <div className="absolute bottom-0 left-10 w-24 h-24 bg-indigo-500/30 rounded-full blur-xl -mb-6"></div>
          
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 text-white flex items-center justify-center backdrop-blur-sm shadow-sm">
              {initialData ? <Edit3 className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-extrabold text-white text-[16px] tracking-wide">{initialData ? 'Edit Vendor Profile' : 'Add New Vendor'}</h3>
              <p className="text-[12px] text-indigo-200 font-medium">Manage vendor information and balance</p>
            </div>
          </div>
          <button onClick={onClose} className="relative z-10 w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-colors shadow-sm"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSaveVendor} className="p-6 overflow-y-auto flex-1 flex flex-col gap-6 bg-white/50">
          <div className="space-y-4">
            <h4 className="text-[11px] font-extrabold text-indigo-900 tracking-wide uppercase border-b border-indigo-100 pb-1">Vendor Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Vendor Name *</label>
                <input type="text" required value={fName} onChange={e => setFName(e.target.value)} className="w-full bg-white border border-slate-200 focus:border-primary-500 rounded-xl px-4 py-2 text-[12px] outline-none transition-all placeholder:text-slate-400 shadow-sm" placeholder="e.g. Insurate Ltd" />
              </div>
              
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Phone Number</label>
                <input type="text" value={fPhone} onChange={e => setFPhone(e.target.value)} className="w-full bg-white border border-slate-200 focus:border-primary-500 rounded-xl px-4 py-2 text-[12px] outline-none transition-all placeholder:text-slate-400 shadow-sm" placeholder="+44..." />
              </div>
              
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Vendor Type</label>
                <select value={fType} onChange={e => setFType(e.target.value)} className="w-full bg-white border border-slate-200 focus:border-primary-500 rounded-xl px-4 py-2 text-[12px] outline-none transition-all shadow-sm cursor-pointer">
                  <option value="Visa">Visa</option>
                  <option value="Flight">Flight</option>
                  <option value="Hotel">Hotel</option>
                  <option value="Transport">Transport</option>
                  <option value="Insurance">Insurance</option>
                  <option value="Other">Other</option>
                </select>
                {fType === 'Other' && (
                  <motion.input initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} type="text" value={fCustomType} onChange={e => setFCustomType(e.target.value)} className="w-full bg-white border border-slate-200 focus:border-primary-500 rounded-xl px-4 py-2 text-[12px] outline-none transition-all shadow-sm mt-2" placeholder="Specify type" />
                )}
              </div>
              
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Email Address</label>
                <input type="email" value={fEmail} onChange={e => setFEmail(e.target.value)} className="w-full bg-white border border-slate-200 focus:border-primary-500 rounded-xl px-4 py-2 text-[12px] outline-none transition-all placeholder:text-slate-400 shadow-sm" placeholder="contact@vendor.com" />
              </div>
              
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Credit Balance</label>
                <input type="number" step="0.01" value={fBalance} onChange={e => setFBalance(e.target.value)} className="w-full bg-white border border-slate-200 focus:border-primary-500 rounded-xl px-4 py-2 text-[12px] outline-none transition-all placeholder:text-slate-400 shadow-sm" placeholder="0.00" />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Website</label>
                <input type="text" value={fWebsite} onChange={e => setFWebsite(e.target.value)} className="w-full bg-white border border-slate-200 focus:border-primary-500 rounded-xl px-4 py-2 text-[12px] outline-none transition-all placeholder:text-slate-400 shadow-sm" placeholder="https://" />
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-200 mt-auto">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-slate-600 hover:bg-slate-200/50 transition-colors">Cancel</button>
            <button type="submit" disabled={actionLoading} className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-2.5 rounded-xl text-[13px] font-bold shadow-md shadow-primary-200 transition-all flex items-center gap-2">
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
