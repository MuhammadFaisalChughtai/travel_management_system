import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Plus, Search, X, Check, Trash2, Edit3, ShieldAlert, Users, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/axios';
import { EmptyState } from '../components/shared/EmptyState';
import { LoadingState } from '../components/shared/LoadingState';
import { Pagination } from '../components/shared/Pagination';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  agentId?: number;
  agentName?: string;
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
        <div className="bg-gradient-to-r from-primary-900 to-indigo-900 text-white px-6 py-5 flex justify-between items-center shadow-lg relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-16 w-32 h-32 bg-indigo-500/30 rounded-full blur-2xl -mb-10"></div>
          
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 text-white flex items-center justify-center backdrop-blur-sm shadow-sm">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-[16px] tracking-wide">Permissions Matrix</h3>
              <p className="text-[12px] text-indigo-200 font-medium">Golden Security Rules enforced by the API</p>
            </div>
          </div>
          <button onClick={onClose} className="relative z-10 w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-colors shadow-sm"><X className="w-4 h-4" /></button>
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

function InviteMemberModal({ onClose, onCreated, editingUser, agents }: { onClose: () => void; onCreated: () => void; editingUser: User | null; agents: any[] }) {
  const [form, setForm] = useState({
    name: editingUser?.name || '',
    email: editingUser?.email || '',
    password: '',
    roleName: editingUser?.role || 'AGENT',
    agentId: editingUser?.agentId || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!form.name.trim() || (!editingUser && !form.email.trim()) || (!editingUser && !form.password)) {
      setError('Please fill out all required fields.'); return;
    }
    setSaving(true);
    setError('');
    
    // Prepare payload
    const payload: any = { ...form };
    if (payload.agentId === '') payload.agentId = null;

    try {
      if (editingUser) {
        await api.patch(`/auth/users/${editingUser.id}`, payload);
        toast.success('User updated successfully');
      } else {
        await api.post('/auth/users', payload);
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
        <div className="bg-gradient-to-r from-primary-900 to-indigo-900 text-white px-6 py-5 flex justify-between items-center shadow-lg relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
          <div className="absolute bottom-0 left-10 w-24 h-24 bg-indigo-500/30 rounded-full blur-xl -mb-6"></div>
          
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 text-white flex items-center justify-center backdrop-blur-sm shadow-sm">
              {editingUser ? <Edit3 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-extrabold text-white text-[16px] tracking-wide">{editingUser ? 'Edit Team Member' : 'Invite Team Member'}</h3>
              <p className="text-[12px] text-indigo-200 font-medium">Manage access and role permissions</p>
            </div>
          </div>
          <button onClick={onClose} className="relative z-10 w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-colors shadow-sm"><X className="w-4 h-4" /></button>
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
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Link to Agent Profile (Optional)</label>
            <select value={form.agentId} onChange={e => setForm({ ...form, agentId: e.target.value })} className="w-full bg-white border border-slate-200 focus:border-primary-500 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] font-medium outline-none transition-all shadow-sm cursor-pointer">
              <option value="">-- No Agent Linked --</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <p className="mt-2 text-[11px] text-slate-500">Linking an agent profile ensures their bookings and commissions are tracked to this user.</p>
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
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showMatrix, setShowMatrix] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [tableUsers, setTableUsers] = useState<User[]>([]);
  const [totalTableItems, setTotalTableItems] = useState(0);
  const [totalTablePages, setTotalTablePages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 10;

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);

      const paginatedParams = new URLSearchParams(params.toString());
      paginatedParams.append('page', currentPage.toString());
      paginatedParams.append('limit', usersPerPage.toString());

      const [usersRes, agentsRes] = await Promise.all([
        api.get(`/auth/users?${paginatedParams.toString()}`),
        api.get('/agents?limit=all')
      ]);
      setTableUsers(usersRes.data.users || []);
      setTotalTableItems(usersRes.data.total || 0);
      setTotalTablePages(usersRes.data.totalPages || 1);
      
      setAgents(agentsRes.data.agents || []);
    } catch (err) {
      toast.error('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [currentPage, search]);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to remove this user from your company?')) return;
    try {
      await api.delete(`/auth/users/${id}`);
      toast.success('User removed successfully');
      fetchData();
    } catch (err) {
      toast.error('Failed to remove user');
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U';
  };

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

      <div className="bg-white/70 backdrop-blur-xl border border-white rounded-3xl shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4 bg-white/50 flex items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 focus:border-primary-500 rounded-xl text-slate-800 text-[13px] outline-none transition-all placeholder:text-slate-400 shadow-sm" placeholder="Search team members..." />
          </div>
        </div>

        <div className="p-0">
          {loading ? (
            <div className="p-8">
              <LoadingState message="Loading team members..." />
            </div>
          ) : tableUsers.length === 0 ? (
            <div className="p-8">
              <EmptyState 
                icon={Users} 
                title={search ? 'No team members found' : 'No team members yet'} 
                description={search ? `We couldn't find anyone matching "${search}"` : 'Get started by inviting a team member.'} 
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-400 font-bold uppercase text-[11px] border-b border-slate-100">
                      <th className="py-3 px-6">Member Name</th>
                      <th className="py-3 px-6">Email Address</th>
                      <th className="py-3 px-6">Role / Access</th>
                      <th className="py-3 px-6">Linked Agent Profile</th>
                      <th className="py-3 px-6 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/50 text-[12px] font-medium bg-white/40">
                    {tableUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-100 to-indigo-100 text-primary-700 flex items-center justify-center font-bold text-[11px] border border-primary-200/50 shadow-sm shrink-0">
                              {getInitials(user.name)}
                            </div>
                            <span className="font-bold text-slate-800">{user.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-6 text-slate-500">
                          {user.email}
                        </td>
                        <td className="py-3 px-6">
                          <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest ${
                            user.role === 'MAIN_COMPANY_ADMIN' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                            user.role === 'COMPANY_ADMIN' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                            'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                            {user.role === 'MAIN_COMPANY_ADMIN' ? 'MAIN ADMIN' : user.role === 'COMPANY_ADMIN' ? 'ADMIN' : user.role}
                          </span>
                        </td>
                        <td className="py-3 px-6">
                          {user.agentId ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-100 text-[11px] font-bold">
                              <Users className="w-3 h-3" />
                              {user.agentName || `Agent #${user.agentId}`}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">No linked profile</span>
                          )}
                        </td>
                        <td className="py-3 px-6 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button 
                              onClick={() => { setEditingUser(user); setShowInvite(true); }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                              title="Edit Member"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            {user.role !== 'MAIN_COMPANY_ADMIN' ? (
                              <button 
                                onClick={() => handleDelete(user.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                title="Remove Member"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <div className="p-1.5 text-slate-300" title="Main Admin cannot be deleted here">
                                <Lock className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination 
                currentPage={currentPage}
                totalPages={totalTablePages}
                onPageChange={setCurrentPage}
                itemsPerPage={usersPerPage}
                totalItems={totalTableItems}
              />
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showMatrix && <PermissionsMatrixModal onClose={() => setShowMatrix(false)} />}
        {showInvite && <InviteMemberModal onClose={() => setShowInvite(false)} onCreated={fetchData} editingUser={editingUser} agents={agents} />}
      </AnimatePresence>
    </div>
  );
}
