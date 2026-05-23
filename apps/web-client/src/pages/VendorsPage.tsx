import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Plus, Search, Phone, Mail, X, Check,
  Trash2, Edit3, ChevronRight, AlertCircle, Building2, Globe
} from 'lucide-react';
import { api } from '../api/axios';

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
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditMode, setShowEditMode] = useState(false);

  // Form State
  const [fName, setFName] = useState('');
  const [fPhone, setFPhone] = useState('');
  const [fEmail, setFEmail] = useState('');
  const [fWebsite, setFWebsite] = useState('');
  const [fType, setFType] = useState('Visa');
  const [fCustomType, setFCustomType] = useState('');
  const [fBalance, setFBalance] = useState('0');
  
  const [actionLoading, setActionLoading] = useState(false);

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

  const openAddModal = () => {
    setFName('');
    setFPhone('');
    setFEmail('');
    setFWebsite('');
    setFType('Visa');
    setFCustomType('');
    setFBalance('0');
    setShowAddModal(true);
  };

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

      if (showEditMode && selectedVendor) {
        await api.patch(`/vendors/${selectedVendor.id}`, payload);
        const updated = await api.get('/vendors');
        setVendors(updated.data.vendors);
        setSelectedVendor({ ...selectedVendor, ...payload, creditBalance: payload.creditBalance });
      } else {
        const res = await api.post('/vendors', payload);
        setVendors([res.data.vendor, ...vendors]);
        setShowAddModal(false);
      }
    } catch (error) {
      console.error('Save vendor failed', error);
      alert('Failed to save vendor');
    } finally {
      setActionLoading(false);
      setShowEditMode(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this vendor?')) return;
    try {
      await api.delete(`/vendors/${id}`);
      setVendors(vendors.filter(v => v.id !== id));
      setSelectedVendor(null);
    } catch (error) {
      console.error('Failed to delete', error);
    }
  };

  const enableEditMode = () => {
    if (!selectedVendor) return;
    setFName(selectedVendor.name || '');
    setFPhone(selectedVendor.phoneNumber || '');
    setFEmail(selectedVendor.email || '');
    setFWebsite(selectedVendor.website || '');
    
    const presetTypes = ['Visa', 'Flight', 'Hotel', 'Transport', 'Insurance'];
    if (selectedVendor.vendorType && !presetTypes.includes(selectedVendor.vendorType)) {
      setFType('Other');
      setFCustomType(selectedVendor.vendorType);
    } else {
      setFType(selectedVendor.vendorType || 'Visa');
      setFCustomType('');
    }
    
    setFBalance(String(selectedVendor.creditBalance || 0));
    setShowEditMode(true);
  };

  const filtered = vendors.filter(v => 
    v.name.toLowerCase().includes(search.toLowerCase()) || 
    (v.vendorType && v.vendorType.toLowerCase().includes(search.toLowerCase()))
  );

  // --- DETAIL VIEW ---
  if (selectedVendor) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Breadcrumb */}
        <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 text-sm">
            <button onClick={() => setSelectedVendor(null)} className="text-slate-500 hover:text-slate-900 font-semibold transition-colors">Admin</button>
            <ChevronRight className="w-4 h-4 text-slate-400" />
            <button onClick={() => setSelectedVendor(null)} className="text-slate-500 hover:text-slate-900 font-semibold transition-colors">Vendors</button>
            <ChevronRight className="w-4 h-4 text-slate-400" />
            <span className="font-bold text-slate-900">{selectedVendor.name}</span>
          </div>
          <div className="flex gap-2">
            {!showEditMode && (
              <button onClick={enableEditMode} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors">
                <Edit3 className="w-3.5 h-3.5" /> Edit Profile
              </button>
            )}
            <button onClick={() => handleDelete(selectedVendor.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-lg transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/40 border border-slate-200 overflow-hidden relative">
          {/* Header Banner */}
          <div className="h-32 bg-gradient-to-r from-primary-600 to-primary-800 relative">
            <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
          </div>

          <div className="px-8 pb-8 relative">
            {/* Avatar */}
            <div className="absolute -top-12 left-8 w-24 h-24 bg-white rounded-2xl shadow-xl flex items-center justify-center text-3xl font-black text-primary-600 border-4 border-white">
              {selectedVendor.name.charAt(0).toUpperCase()}
            </div>

            <div className="pt-16">
              {showEditMode ? (
                <form onSubmit={handleSaveVendor} className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Vendor Name</label>
                      <input type="text" required value={fName} onChange={e => setFName(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Vendor Type</label>
                      <select value={fType} onChange={e => setFType(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none">
                        <option value="Visa">Visa</option>
                        <option value="Flight">Flight</option>
                        <option value="Hotel">Hotel</option>
                        <option value="Transport">Transport</option>
                        <option value="Insurance">Insurance</option>
                        <option value="Other">Other</option>
                      </select>
                      {fType === 'Other' && (
                        <motion.input initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} type="text" value={fCustomType} onChange={e => setFCustomType(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none mt-2" placeholder="Specify vendor type" />
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Phone Number</label>
                      <input type="text" value={fPhone} onChange={e => setFPhone(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Email Address</label>
                      <input type="email" value={fEmail} onChange={e => setFEmail(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Website</label>
                      <input type="text" value={fWebsite} onChange={e => setFWebsite(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none" placeholder="https://" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Credit Balance (£)</label>
                      <input type="number" step="0.01" value={fBalance} onChange={e => setFBalance(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button type="button" onClick={() => setShowEditMode(false)} className="px-5 py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 text-sm font-bold text-slate-600">Cancel</button>
                    <button type="submit" disabled={actionLoading} className="px-5 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-sm font-bold flex items-center gap-2">
                      {actionLoading ? 'Saving...' : <><Save className="w-4 h-4" /> Save Changes</>}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-2 gap-y-6">
                  <div>
                    <h1 className="text-2xl font-black text-slate-900">{selectedVendor.name}</h1>
                    <div className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                      {selectedVendor.vendorType || 'Vendor'}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Credit Balance</p>
                    <p className="text-2xl font-black text-emerald-600">£{Number(selectedVendor.creditBalance).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Contact Phone</p>
                    <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" /> {selectedVendor.phoneNumber || 'Not provided'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Email Address</p>
                    <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400" /> {selectedVendor.email || 'Not provided'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Website</p>
                    <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-slate-400" /> {selectedVendor.website || 'Not provided'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- LIST VIEW ---
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary-500" /> Vendors Directory
          </h1>
          <p className="text-slate-500 text-sm font-medium mt-1">Manage external vendors, suppliers, and ledger balances.</p>
        </div>
        <button onClick={openAddModal} className="bg-primary-600 hover:bg-primary-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-primary-500/20 transition-all flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Vendor
        </button>
      </div>

      {/* Stats/Search Bar */}
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

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl h-48 border border-slate-100 shadow-sm animate-pulse"></div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-800">No vendors found</h3>
          <p className="text-slate-500 text-sm mt-1">Try adjusting your search or add a new vendor.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(vendor => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={vendor.id}
              onClick={() => setSelectedVendor(vendor)}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-xl hover:border-primary-200 transition-all cursor-pointer group flex flex-col justify-between h-48 relative overflow-hidden"
            >
              {/* Decorative side border */}
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center font-black text-lg border border-primary-100">
                      {vendor.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 line-clamp-1">{vendor.name}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {vendor.vendorType || 'Vendor'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-1.5">
                  <p className="text-xs text-slate-600 font-medium flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> {vendor.phoneNumber || 'No phone'}
                  </p>
                  <p className="text-xs text-slate-600 font-medium flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> {vendor.email || 'No email'}
                  </p>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-100 flex justify-between items-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Balance</div>
                <div className="text-sm font-black text-emerald-600">£{Number(vendor.creditBalance).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-3xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden border border-slate-100">
              <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex justify-between items-center">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-primary-500" /> Add New Vendor
                </h3>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveVendor} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Name</label>
                  <input type="text" required value={fName} onChange={e => setFName(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" placeholder="e.g. Insurate Ltd" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Phone Number</label>
                    <input type="text" value={fPhone} onChange={e => setFPhone(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" placeholder="447844455456" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Vendor Type</label>
                    <select value={fType} onChange={e => setFType(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none">
                      <option value="Visa">Visa</option>
                      <option value="Flight">Flight</option>
                      <option value="Hotel">Hotel</option>
                      <option value="Transport">Transport</option>
                      <option value="Insurance">Insurance</option>
                      <option value="Other">Other</option>
                    </select>
                    {fType === 'Other' && (
                      <motion.input initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} type="text" value={fCustomType} onChange={e => setFCustomType(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none mt-2" placeholder="Specify vendor type" />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Email Address</label>
                    <input type="email" value={fEmail} onChange={e => setFEmail(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" placeholder="contact@vendor.com" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Credit Balance</label>
                    <input type="number" step="0.01" value={fBalance} onChange={e => setFBalance(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" placeholder="0.00" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Website</label>
                  <input type="text" value={fWebsite} onChange={e => setFWebsite(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" placeholder="https://vendor.com" />
                </div>

                <div className="flex justify-end gap-3 pt-4 mt-2">
                  <button type="button" onClick={() => setShowAddModal(false)} className="px-5 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-sm font-bold text-slate-600 transition-colors">Cancel</button>
                  <button type="submit" disabled={actionLoading} className="px-5 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-sm font-bold shadow-md shadow-primary-500/20 flex items-center gap-2">
                    {actionLoading ? 'Saving...' : 'Add Vendor'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
