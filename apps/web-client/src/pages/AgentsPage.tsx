import toast from 'react-hot-toast';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Plus, Search, X, Check,
  Trash2, Edit3, ChevronRight, AlertCircle, Percent, TrendingUp,
  Save, ArrowLeft, Wallet, ArrowUpRight, ArrowDownLeft
} from 'lucide-react';
import { api } from '../api/axios';
import { EntityCard } from '../components/EntityCard';
import { EmptyState } from '../components/shared/EmptyState';
import { LoadingState } from '../components/shared/LoadingState';

interface MarginSegment {
  id?: number;
  minAmount: string;
  maxAmount: string;
  marginPercent: string;
  label: string;
}

interface Agent {
  id: number;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  gdsSystem: string | null;
  client: string | null;
  pcc: string | null;
  jobStatus: string;
  createdAt: string;
  updatedAt: string;
  marginSegments: {
    id: number;
    minAmount: string;
    maxAmount: string | null;
    marginPercent: string;
    label: string | null;
  }[];
  wallet?: {
    currentBalance: number;
    transactions: {
      id: number;
      amount: number;
      transactionType: string;
      referenceId: string | null;
      notes: string | null;
      createdAt: string;
    }[];
  };
}

const DEFAULT_SEGMENTS: MarginSegment[] = [
  { minAmount: '1000', maxAmount: '2000', marginPercent: '5', label: '£1,000 – £2,000' },
  { minAmount: '2001', maxAmount: '3000', marginPercent: '6', label: '£2,001 – £3,000' },
  { minAmount: '3001', maxAmount: '4000', marginPercent: '7', label: '£3,001 – £4,000' },
  { minAmount: '4001', maxAmount: '5000', marginPercent: '8', label: '£4,001 – £5,000' },
  { minAmount: '5001', maxAmount: '', marginPercent: '10', label: '£5,001 and above' },
];

function TagInput({ tags, onChange, placeholder }: { tags: string[], onChange: (tags: string[]) => void, placeholder?: string }) {
  const [input, setInput] = useState('');
  const addTag = () => {
    if (input.trim() && !tags.includes(input.trim())) {
      onChange([...tags, input.trim()]);
      setInput('');
    }
  };
  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };
  return (
    <div className="w-full bg-white border border-slate-200 focus-within:border-primary-500 focus-within:ring-4 focus-within:ring-primary-500/10 rounded-xl px-3 py-2 transition-all flex flex-wrap gap-2 items-center min-h-[42px]">
      {tags.map((tag, i) => (
        <span key={i} className="flex items-center gap-1 bg-primary-100 text-primary-700 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide">
          {tag}
          <button type="button" onClick={() => removeTag(i)} className="hover:text-primary-900 ml-1"><X className="w-3 h-3" /></button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
        onBlur={addTag}
        className="flex-1 bg-transparent border-none outline-none text-slate-700 text-[13px] min-w-[120px] placeholder:text-slate-400"
        placeholder={tags.length === 0 ? placeholder : 'Add another (press enter)...'}
      />
    </div>
  );
}

function AgentDetailView({ agent: initialAgent, onBack, onRefresh }: {
  agent: Agent;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const [agent, setAgent] = useState<Agent>(initialAgent);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAgent(initialAgent);
  }, [initialAgent]);
  
  const initialClientTags = initialAgent.client ? initialAgent.client.split(',').map(s => s.trim()).filter(Boolean) : [];
  const [form, setForm] = useState({
    name: initialAgent.name,
    email: initialAgent.email || '',
    phoneNumber: initialAgent.phoneNumber || '',
    gdsSystem: initialAgent.gdsSystem || '',
    pcc: initialAgent.pcc || '',
    jobStatus: initialAgent.jobStatus,
  });
  const [clientTags, setClientTags] = useState<string[]>(initialClientTags);

  const [segments, setSegments] = useState<MarginSegment[]>(
    initialAgent.marginSegments.length > 0
      ? initialAgent.marginSegments.map(s => ({
          id: s.id,
          minAmount: String(s.minAmount),
          maxAmount: s.maxAmount ? String(s.maxAmount) : '',
          marginPercent: String(s.marginPercent),
          label: s.label || ''
        }))
      : DEFAULT_SEGMENTS
  );
  const [segmentsSaving, setSegmentsSaving] = useState(false);
  const [segmentsMsg, setSegmentsMsg] = useState('');

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        client: clientTags.length > 0 ? clientTags.join(', ') : ''
      };
      const res = await api.patch(`/agents/${agent.id}`, payload);
      setAgent(res.data.agent);
      setEditMode(false);
      onRefresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update agent');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSegments = async () => {
    setSegmentsSaving(true);
    setSegmentsMsg('');
    try {
      const payload = segments.map(s => ({
        minAmount: parseFloat(s.minAmount) || 0,
        maxAmount: s.maxAmount ? parseFloat(s.maxAmount) : null,
        marginPercent: parseFloat(s.marginPercent) || 0,
        label: s.label || null
      }));
      const res = await api.post(`/agents/${agent.id}/margin-segments`, { segments: payload });
      setAgent(res.data.agent);
      setSegmentsMsg('Saved successfully!');
      onRefresh();
      setTimeout(() => setSegmentsMsg(''), 2500);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save segments');
    } finally {
      setSegmentsSaving(false);
    }
  };

  const addSegment = () => {
    setSegments([...segments, { minAmount: '', maxAmount: '', marginPercent: '', label: '' }]);
  };

  const removeSegment = (i: number) => {
    setSegments(segments.filter((_, idx) => idx !== i));
  };

  const updateSegment = (i: number, field: keyof MarginSegment, val: string) => {
    const next = [...segments];
    next[i] = { ...next[i], [field]: val };
    setSegments(next);
  };

  const infoRows = [
    { label: 'ID', value: `#${agent.id.toString().padStart(4, '0')}` },
    { label: 'Name', value: agent.name },
    { label: 'Email', value: agent.email || '—' },
    { label: 'Phone Number', value: agent.phoneNumber || '—' },
    { label: 'GDS System', value: agent.gdsSystem || '—' },
    { label: 'Clients', value: agent.client || '—' },
    { label: 'PCC', value: agent.pcc || '—' },
    { label: 'Job Status', value: agent.jobStatus },
    { label: 'Created At', value: new Date(agent.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) },
    { label: 'Updated At', value: new Date(agent.updatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all shadow-sm">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <div className="flex items-center gap-2 text-[12px] font-bold text-slate-400 mb-1">
            <span className="hover:text-primary-600 cursor-pointer" onClick={onBack}>AGENTS</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-600">{agent.name.toUpperCase()}</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">{agent.name}</h1>
        </div>
        <div className="ml-auto flex gap-3">
          {editMode ? (
            <>
              <button onClick={() => { setEditMode(false); setClientTags(initialClientTags); }} className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-[13px] font-bold hover:bg-slate-50 transition-all shadow-sm">
                Cancel
              </button>
              <button onClick={handleSaveProfile} disabled={saving} className="px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-[13px] font-bold transition-all flex items-center gap-2 shadow-md shadow-primary-600/25 active:scale-95">
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
            </>
          ) : (
            <button onClick={() => setEditMode(true)} className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-[13px] font-bold hover:border-slate-300 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm">
              <Edit3 className="w-4 h-4 text-slate-500" /> Edit Profile
            </button>
          )}
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="bg-slate-50 px-8 py-4 border-b border-slate-200">
          <h2 className="text-slate-800 font-bold text-[14px] uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-primary-500" /> Agent Profile
          </h2>
        </div>
        {editMode ? (
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Full Name *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full bg-white border border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full bg-white border border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Phone Number</label>
              <input type="text" value={form.phoneNumber} onChange={e => setForm({ ...form, phoneNumber: e.target.value })} className="w-full bg-white border border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">GDS System</label>
              <input type="text" value={form.gdsSystem} onChange={e => setForm({ ...form, gdsSystem: e.target.value })} className="w-full bg-white border border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Clients (Press Enter to add)</label>
              <TagInput tags={clientTags} onChange={setClientTags} placeholder="Enter client names..." />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">PCC</label>
              <input type="text" value={form.pcc} onChange={e => setForm({ ...form, pcc: e.target.value })} className="w-full bg-white border border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Job Status</label>
              <select value={form.jobStatus} onChange={e => setForm({ ...form, jobStatus: e.target.value })} className="w-full md:w-1/2 bg-white border border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="On Leave">On Leave</option>
              </select>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {infoRows.map((row) => (
              <div key={row.label} className="flex items-center px-8 py-4 hover:bg-slate-50/50 transition-colors">
                <span className="w-48 text-[11px] font-bold text-slate-400 uppercase tracking-widest shrink-0">{row.label}</span>
                {row.label === 'Clients' ? (
                  <div className="flex flex-wrap gap-1.5">
                    {row.value !== '—' && row.value ? row.value.split(',').map((tag, i) => (
                      <span key={i} className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-[12px] font-semibold">{tag.trim()}</span>
                    )) : <span className="text-slate-400 italic">No clients assigned</span>}
                  </div>
                ) : (
                  <span className={`text-[14px] font-semibold ${row.label === 'Job Status'
                    ? (agent.jobStatus === 'Active' ? 'text-emerald-600' : 'text-rose-600')
                    : row.value === '—' ? 'text-slate-400 italic' : 'text-slate-800'}`}>
                    {row.value}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-slate-50 to-indigo-50/30 px-8 py-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
            <h2 className="text-slate-800 font-bold text-[15px] uppercase tracking-wider">Commission Margin Segments</h2>
          </div>
          <span className="text-[11px] text-slate-500 font-bold tracking-wider uppercase bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">Performance Slabs</span>
        </div>
        <div className="p-8">
          <p className="text-slate-500 text-[13px] mb-6 max-w-3xl">
            Define commission percentage slabs for <strong className="text-slate-800">{agent.name}</strong>. The system matches the agent's net profit to a slab below and automatically applies the corresponding margin rate.
          </p>

          <div className="rounded-2xl overflow-hidden border border-slate-200 mb-6 shadow-sm">
            <div className="grid grid-cols-12 bg-slate-50 px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">
              <div className="col-span-4">Monthly Net Sales (£)</div>
              <div className="col-span-3 text-right">Min Amount (£)</div>
              <div className="col-span-3 text-right">Max Amount (£)</div>
              <div className="col-span-1 text-right">Rate %</div>
              <div className="col-span-1"></div>
            </div>
            <div className="divide-y divide-slate-100">
              {segments.map((seg, i) => (
                <div key={i} className="grid grid-cols-12 items-center px-5 py-3 hover:bg-slate-50 transition-colors gap-3">
                  <div className="col-span-4">
                    <input
                      value={seg.label}
                      onChange={e => updateSegment(i, 'label', e.target.value)}
                      className="w-full bg-transparent border-b border-transparent focus:border-primary-500 text-slate-800 text-[13px] font-semibold outline-none py-1 transition-colors"
                      placeholder="Label (e.g. £1,000 – £2,000)"
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      value={seg.minAmount}
                      onChange={e => updateSegment(i, 'minAmount', e.target.value)}
                      className="w-full bg-white border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-xl px-3 py-1.5 text-slate-800 text-[13px] font-medium outline-none text-right transition-all"
                      placeholder="0"
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      value={seg.maxAmount}
                      onChange={e => updateSegment(i, 'maxAmount', e.target.value)}
                      className="w-full bg-white border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-xl px-3 py-1.5 text-slate-800 text-[13px] font-medium outline-none text-right transition-all"
                      placeholder="∞"
                    />
                  </div>
                  <div className="col-span-1">
                    <input
                      type="number"
                      value={seg.marginPercent}
                      onChange={e => updateSegment(i, 'marginPercent', e.target.value)}
                      className="w-full bg-emerald-50 border border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-3 py-1.5 text-emerald-700 text-[14px] font-bold outline-none text-right transition-all"
                      placeholder="%"
                      step="0.5"
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button onClick={() => removeSegment(i)} className="p-1.5 rounded-xl hover:bg-rose-100 text-slate-400 hover:text-rose-500 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={addSegment} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-[13px] font-bold border border-slate-200 shadow-sm transition-all active:scale-95">
              <Plus className="w-4 h-4 text-slate-400" /> Add Slab Row
            </button>
            <div className="flex-1" />
            {segmentsMsg && (
              <span className="flex items-center gap-2 text-emerald-600 text-[13px] font-bold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                <Check className="w-4 h-4" /> {segmentsMsg}
              </span>
            )}
            <button
              onClick={handleSaveSegments}
              disabled={segmentsSaving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[13px] font-bold shadow-md shadow-indigo-600/25 transition-all active:scale-95"
            >
              {segmentsSaving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Segments Configuration
            </button>
          </div>
        </div>
      </motion.div>

      {/* NEW: Agent Wallet Section */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-slate-50 to-indigo-50/30 px-8 py-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
            <h2 className="text-slate-800 font-bold text-[15px] uppercase tracking-wider">Agent Wallet & Ledger</h2>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex flex-col items-end">
               <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Current Balance</span>
               <span className={`text-xl font-black ${agent.wallet && Number(agent.wallet.currentBalance) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                 £{agent.wallet ? Number(agent.wallet.currentBalance).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
               </span>
             </div>
          </div>
        </div>
        <div className="p-0">
          {!agent.wallet || agent.wallet.transactions.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-[13px]">
               No wallet transactions recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">
                  <tr>
                    <th className="px-8 py-4">Date</th>
                    <th className="px-8 py-4">Type</th>
                    <th className="px-8 py-4">Reference</th>
                    <th className="px-8 py-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {agent.wallet.transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-4 text-slate-500 whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
                      <td className="px-8 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-widest ${
                          tx.amount > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {tx.amount > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                          {tx.transactionType.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-8 py-4 text-slate-600">
                        {tx.referenceId || '—'}
                        {tx.notes && <div className="text-[11px] text-slate-400 mt-0.5">{tx.notes}</div>}
                      </td>
                      <td className={`px-8 py-4 text-right font-bold ${Number(tx.amount) > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {Number(tx.amount) > 0 ? '+' : ''}£{Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function AgentFormModal({ onClose, onSaved, initialData }: { onClose: () => void; onSaved: (a: Agent) => void; initialData?: Agent | null }) {
  const [form, setForm] = useState({
    name: initialData?.name || '', 
    email: initialData?.email || '', 
    phoneNumber: initialData?.phoneNumber || '', 
    gdsSystem: initialData?.gdsSystem || '', 
    pcc: initialData?.pcc || '', 
    jobStatus: initialData?.jobStatus || 'Active'
  });
  const [clientTags, setClientTags] = useState<string[]>(initialData?.client ? initialData.client.split(',').map(s => s.trim()).filter(Boolean) : []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        client: clientTags.length > 0 ? clientTags.join(', ') : ''
      };
      
      let res;
      if (initialData) {
        res = await api.patch(`/agents/${initialData.id}`, payload);
      } else {
        res = await api.post('/agents', payload);
      }
      
      onSaved(res.data.agent);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || `Failed to ${initialData ? 'update' : 'create'} agent`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="bg-slate-50 px-6 py-5 flex justify-between items-center border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center">
              {initialData ? <Edit3 className="w-5 h-5" /> : <Users className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-[16px]">{initialData ? 'Edit Agent Profile' : 'Create New Agent'}</h3>
              <p className="text-[12px] text-slate-500 font-medium">{initialData ? 'Update agent details and settings' : 'Add a new agent to the system'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-rose-600 text-[13px] font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Full Name *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full bg-white border border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all placeholder:text-slate-400" placeholder="e.g. Sarah Jenkins" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Email Address</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full bg-white border border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all placeholder:text-slate-400" placeholder="sarah@example.com" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Phone Number</label>
              <input type="text" value={form.phoneNumber} onChange={e => setForm({ ...form, phoneNumber: e.target.value })} className="w-full bg-white border border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all placeholder:text-slate-400" placeholder="+44 123 456 789" />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Clients (Press Enter to add)</label>
              <TagInput tags={clientTags} onChange={setClientTags} placeholder="e.g. Acme Corp, Global Tech..." />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">GDS System</label>
              <input type="text" value={form.gdsSystem} onChange={e => setForm({ ...form, gdsSystem: e.target.value })} className="w-full bg-white border border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all placeholder:text-slate-400" placeholder="Amadeus, Galileo..." />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">PCC Code</label>
              <input type="text" value={form.pcc} onChange={e => setForm({ ...form, pcc: e.target.value })} className="w-full bg-white border border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all placeholder:text-slate-400" placeholder="Alpha numeric code" />
            </div>
            <div className="md:col-span-2 border-t border-slate-100 pt-5 mt-2">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Job Status</label>
              <select value={form.jobStatus} onChange={e => setForm({ ...form, jobStatus: e.target.value })} className="w-full md:w-1/2 bg-white border border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] font-medium outline-none transition-all shadow-sm cursor-pointer">
                <option value="Active">Active - Currently operating</option>
                <option value="Inactive">Inactive - Account disabled</option>
                <option value="On Leave">On Leave - Temporarily away</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-slate-600 hover:bg-slate-200/50 transition-all">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-[13px] font-bold shadow-md shadow-primary-600/25 transition-all flex items-center gap-2 active:scale-95">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>{initialData ? 'Save Changes' : 'Create Agent'}</>}
          </button>
        </div>
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
        <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Agent?</h3>
        <p className="text-slate-500 text-sm mb-6">This action cannot be undone. Are you sure you want to permanently delete this agent?</p>
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

export function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [deletingAgentId, setDeletingAgentId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const res = await api.get('/agents');
      setAgents(res.data.agents || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAgents(); }, []);

  const handleDelete = async () => {
    if (!deletingAgentId) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/agents/${deletingAgentId}`);
      toast.success('Agent deleted successfully');
      setAgents(prev => prev.filter(a => a.id !== deletingAgentId));
      setDeletingAgentId(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete agent');
    } finally {
      setDeleteLoading(false);
    }
  };

  const filtered = agents.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (a.phoneNumber || '').includes(search)
  );

  if (selectedAgent) {
    return (
      <AgentDetailView
        agent={selectedAgent}
        onBack={() => { setSelectedAgent(null); fetchAgents(); }}
        onRefresh={fetchAgents}
      />
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            Agent Registry
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">Manage agents, clients, and their commission margin slabs</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 bg-primary-600 text-white hover:bg-primary-500 px-4.5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-primary-600/20 active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" /> Add New Agent
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          { label: 'Total Registered Agents', value: agents.length, color: 'text-primary-600', bg: 'bg-primary-50', border: 'border-primary-100' },
          { label: 'Active Agents', value: agents.filter(a => a.jobStatus === 'Active').length, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'Inactive / On Leave', value: agents.filter(a => a.jobStatus !== 'Active').length, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
        ].map(stat => (
          <div key={stat.label} className={`bg-white border border-slate-200 rounded-3xl p-6 flex flex-col justify-center shadow-sm relative overflow-hidden group`}>
            <div className={`absolute right-0 top-0 w-24 h-24 ${stat.bg} rounded-bl-full -z-10 opacity-70 group-hover:scale-110 transition-transform duration-500`} />
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mb-1">{stat.label}</p>
            <div className="flex items-end gap-3">
              <p className={`text-4xl font-black ${stat.color}`}>{stat.value}</p>
              <div className={`mb-1.5 w-8 h-8 rounded-lg ${stat.bg} ${stat.color} flex items-center justify-center`}>
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4 bg-slate-50 flex items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-xl text-slate-800 text-[13px] outline-none transition-all placeholder:text-slate-400 shadow-sm"
              placeholder="Search by name, email, or phone..."
            />
          </div>
        </div>

        <div className="p-6 bg-slate-50/50">
          {loading ? (
            <LoadingState message="Loading agents repository..." />
          ) : error ? (
            <div className="bg-rose-50 rounded-2xl border border-rose-200 p-12 text-center shadow-sm max-w-2xl mx-auto">
              <AlertCircle className="w-12 h-12 text-rose-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-rose-800">Failed to load data</h3>
              <p className="text-rose-600 text-sm mt-1">{error}</p>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Users}
              title={search ? 'No agents found' : 'No agents yet'}
              description={search ? `We couldn't find anything matching "${search}"` : 'Get started by creating your first agent profile.'}
              action={
                !search && (
                  <button onClick={() => setShowAddModal(true)} className="mx-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-primary-50 text-primary-600 hover:bg-primary-100 rounded-xl text-[13px] font-bold transition-colors">
                    <Plus className="w-4 h-4" /> Add Agent
                  </button>
                )
              }
            />
          ) : (
            <motion.div layout className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              <AnimatePresence>
                {filtered.map(agent => (
                  <motion.div key={agent.id} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}>
                    <EntityCard 
                      name={agent.name}
                      badge={agent.jobStatus === 'Active' ? 'ACTIVE' : agent.jobStatus.toUpperCase()}
                      phone={agent.phoneNumber}
                      email={agent.email}
                      onClick={() => setSelectedAgent(agent)}
                      customFooter={
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] text-slate-600 font-medium flex items-center gap-1.5">
                            <Percent className="w-3.5 h-3.5 text-indigo-500" />
                            <span className="font-bold text-slate-800">{agent.marginSegments.length}</span> slabs
                          </span>
                          <div className="flex items-center gap-2">
                            <button onClick={(e) => { e.stopPropagation(); setEditingAgent(agent); setShowAddModal(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"><Edit3 className="w-4 h-4" /></button>
                            <button onClick={(e) => { e.stopPropagation(); setDeletingAgentId(agent.id); }} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>
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
        {showAddModal && (
          <AgentFormModal
            onClose={() => { setShowAddModal(false); setEditingAgent(null); }}
            onSaved={() => { 
              fetchAgents(); 
              if (selectedAgent) { 
                const updated = agents.find(a => a.id === (selectedAgent as any)?.id); 
                if (updated) setSelectedAgent(updated); 
              } 
            }}
            initialData={editingAgent}
          />
        )}
        
        {deletingAgentId && (
          <DeleteConfirmationModal 
            onClose={() => setDeletingAgentId(null)}
            onConfirm={handleDelete}
            loading={deleteLoading}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
