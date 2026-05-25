import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Plus, Search, X, Check, Trash2, Edit3, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/axios';
import { EntityCard } from '../components/EntityCard';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

const PERMISSIONS_MATRIX = [
  { module: 'Bookings & Itineraries', agent: 'Create, Read, Update', companyAdmin: 'Create, Read, Update, Delete', mainAdmin: 'Create, Read, Update, Delete' },
  { module: 'Client Records', agent: 'Create, Read, Update', companyAdmin: 'Create, Read, Update, Delete', mainAdmin: 'Create, Read, Update, Delete' },
  { module: 'Vendor Records', agent: 'Read Only', companyAdmin: 'Create, Read, Update, Delete', mainAdmin: 'Create, Read, Update, Delete' },
  { module: 'Agency Dashboard', agent: 'No Access', companyAdmin: 'Read Only', mainAdmin: 'Full Access' },
  { module: 'Team Management', agent: 'No Access', companyAdmin: 'Create, Read, Update, Delete', mainAdmin: 'Create, Read, Update, Delete' },
  { module: 'Financials (Refunds/Profit)', agent: 'No Access', companyAdmin: 'Read Only', mainAdmin: 'Create, Read, Update, Delete' },
  { module: 'System Settings', agent: 'No Access', companyAdmin: 'No Access', mainAdmin: 'Full Access' }
];

function PermissionsMatrixModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-4xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-slate-50 px-6 py-5 flex justify-between items-center border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-[16px]">Permissions Matrix</h3>
              <p className="text-[12px] text-slate-500 font-medium">Golden Security Rules enforced by the API</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-0 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                <th className="p-4 pl-6 font-bold">Module / Section</th>
                <th className="p-4 border-l border-slate-200 text-center">Agent</th>
                <th className="p-4 border-l border-slate-200 text-center">Company Admin</th>
                <th className="p-4 border-l border-slate-200 text-center text-indigo-600 bg-indigo-50/30">Main Company Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {PERMISSIONS_MATRIX.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 pl-6 text-[13px] font-bold text-slate-800">{row.module}</td>
                  <td className={`p-4 border-l border-slate-100 text-[12px] font-medium text-center ${row.agent === 'No Access' ? 'text-slate-400 italic' : 'text-slate-600'}`}>{row.agent}</td>
                  <td className={`p-4 border-l border-slate-100 text-[12px] font-medium text-center ${row.companyAdmin === 'No Access' ? 'text-slate-400 italic' : 'text-slate-600'}`}>{row.companyAdmin}</td>
                  <td className="p-4 border-l border-slate-100 text-[12px] font-bold text-indigo-600 text-center bg-indigo-50/10">{row.mainAdmin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}

function InviteMemberModal({ onClose, onCreated, editingUser }: { onClose: () => void; onCreated: () => void; editingUser: User | null }) {
  const [form, setForm] = useState({
    name: editingUser?.name || '',
    email: editingUser?.email || '',
    password: '',
    roleName: editingUser?.role || 'AGENT'
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!form.name.trim() || (!editingUser && !form.email.trim()) || (!editingUser && !form.password)) {
      setError('Please fill out all required fields.'); return;
    }
    setSaving(true);
    setError('');
    try {
      if (editingUser) {
        await api.patch(`/auth/users/${editingUser.id}`, form);
        toast.success('User updated successfully');
      } else {
        await api.post('/auth/users', form);
        toast.success('Team member invited successfully');
      }
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to process request');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden flex flex-col">
        <div className="bg-slate-50 px-6 py-5 flex justify-between items-center border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center">
              {editingUser ? <Edit3 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-[16px]">{editingUser ? 'Edit Team Member' : 'Invite Team Member'}</h3>
              <p className="text-[12px] text-slate-500 font-medium">Manage access and role permissions</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-5">
          {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 text-[13px] font-medium rounded-xl">{error}</div>}
          
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Full Name</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full bg-white border border-slate-200 focus:border-primary-500 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all placeholder:text-slate-400" placeholder="e.g. Sarah Jenkins" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Email Address</label>
            <input type="email" value={form.email} disabled={!!editingUser} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full bg-white border border-slate-200 focus:border-primary-500 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400" placeholder="sarah@example.com" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">{editingUser ? 'Reset Password (optional)' : 'Password'}</label>
            <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="w-full bg-white border border-slate-200 focus:border-primary-500 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all placeholder:text-slate-400" placeholder="••••••••" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Assign Role</label>
            <select value={form.roleName} onChange={e => setForm({ ...form, roleName: e.target.value })} className="w-full bg-white border border-slate-200 focus:border-primary-500 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] font-medium outline-none transition-all shadow-sm cursor-pointer">
              <option value="AGENT">Agent (Standard Access)</option>
              <option value="COMPANY_ADMIN">Company Admin (Manager Access)</option>
              {editingUser?.role === 'MAIN_COMPANY_ADMIN' && <option value="MAIN_COMPANY_ADMIN">Main Company Admin (Full Access)</option>}
            </select>
            <p className="mt-2 text-[11px] text-slate-500">Check the permissions matrix to see what each role can access.</p>
          </div>
        </div>
        
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-slate-600 hover:bg-slate-200/50 transition-all">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-[13px] font-bold shadow-md transition-all flex items-center gap-2 active:scale-95">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (editingUser ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />)}
            {editingUser ? 'Save Changes' : 'Send Invite'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function TeamManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showMatrix, setShowMatrix] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/auth/users');
      setUsers(res.data.users || []);
    } catch (err) {
      toast.error('Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to remove this user from your company?')) return;
    try {
      await api.delete(`/auth/users/${id}`);
      toast.success('User removed successfully');
      fetchUsers();
    } catch (err) {
      toast.error('Failed to remove user');
    }
  };

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            Team & Permissions
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">Manage your internal staff and role-based access control.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowMatrix(true)} className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 px-4.5 py-2.5 rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-all">
            <Shield className="h-4 w-4 text-indigo-500" /> View Matrix
          </button>
          <button onClick={() => { setEditingUser(null); setShowInvite(true); }} className="flex items-center gap-1.5 bg-primary-600 text-white hover:bg-primary-500 px-4.5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-primary-500/20 active:scale-95 transition-all">
            <Plus className="h-4 w-4" /> Invite Member
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4 bg-slate-50 flex items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 focus:border-primary-500 rounded-xl text-slate-800 text-[13px] outline-none transition-all placeholder:text-slate-400 shadow-sm" placeholder="Search team members..." />
          </div>
        </div>

        <div className="p-6 bg-slate-50/50">
          {loading ? (
            <div className="flex justify-center py-24"><div className="w-8 h-8 border-4 border-primary-500/20 border-t-primary-500 rounded-full animate-spin" /></div>
          ) : (
            <motion.div layout className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              <AnimatePresence>
                {filtered.map(user => (
                  <motion.div key={user.id} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}>
                    <EntityCard
                      name={user.name}
                      badge={user.role === 'MAIN_COMPANY_ADMIN' ? 'MAIN ADMIN' : user.role === 'COMPANY_ADMIN' ? 'ADMIN' : user.role}
                      email={user.email}
                      customFooter={
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => { setEditingUser(user); setShowInvite(true); }} className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"><Edit3 className="w-4 h-4" /></button>
                          {user.role !== 'MAIN_COMPANY_ADMIN' && (
                            <button onClick={() => handleDelete(user.id)} className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"><Trash2 className="w-4 h-4" /></button>
                          )}
                        </div>
                      }
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showMatrix && <PermissionsMatrixModal onClose={() => setShowMatrix(false)} />}
        {showInvite && <InviteMemberModal onClose={() => setShowInvite(false)} onCreated={fetchUsers} editingUser={editingUser} />}
      </AnimatePresence>
    </div>
  );
}
