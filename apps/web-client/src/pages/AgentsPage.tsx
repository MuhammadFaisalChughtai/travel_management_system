import toast from 'react-hot-toast';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Plus, Search, X, Check,
  Trash2, Edit3, AlertCircle, Percent, TrendingUp,
  Save, Wallet, ArrowUpRight, ArrowDownLeft
} from 'lucide-react';
import { api } from '../api/axios';
import { AccordionSection } from '../components/AccordionSection';
import { Pagination } from '../components/shared/Pagination';
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
    <div className="w-full bg-white border border-slate-200 focus-within:border-primary-500 focus-within:ring-4 focus-within:ring-primary-500/10 rounded-xl px-3 py-1.5 transition-all flex flex-wrap gap-2 items-center min-h-[38px]">
      {tags.map((tag, i) => (
        <span key={i} className="flex items-center gap-1 bg-primary-100 text-primary-700 px-2 py-0.5 rounded text-[11px] font-bold tracking-wide">
          {tag}
          <button type="button" onClick={() => removeTag(i)} className="hover:text-primary-900 ml-1"><X className="w-3 h-3" /></button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
        onBlur={addTag}
        className="flex-1 bg-transparent border-none outline-none text-slate-800 text-[13px] font-bold min-w-[120px] placeholder:text-slate-400"
        placeholder={tags.length === 0 ? placeholder : 'Add another...'}
      />
    </div>
  );
}

function AgentDetailsModal({ agent: initialAgent, isOpen, onClose, onRefresh }: {
  agent: Agent | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<any>({});
  const [clientTags, setClientTags] = useState<string[]>([]);
  const [segments, setSegments] = useState<MarginSegment[]>([]);
  const [segmentsSaving, setSegmentsSaving] = useState(false);
  const [segmentsMsg, setSegmentsMsg] = useState('');

  const [openSections, setOpenSections] = useState<string[]>(['profile', 'segments', 'wallet']);
  const [walletPage, setWalletPage] = useState(1);
  const walletItemsPerPage = 10;

  const toggleSection = (section: string) => {
    setOpenSections(prev => prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]);
  };

  useEffect(() => {
    if (isOpen && initialAgent) {
      setAgent(initialAgent);
      setEditMode(false);
      const initialClientTags = initialAgent.client ? initialAgent.client.split(',').map(s => s.trim()).filter(Boolean) : [];
      setClientTags(initialClientTags);
      setForm({
        name: initialAgent.name,
        email: initialAgent.email || '',
        phoneNumber: initialAgent.phoneNumber || '',
        gdsSystem: initialAgent.gdsSystem || '',
        pcc: initialAgent.pcc || '',
        jobStatus: initialAgent.jobStatus,
      });
      setSegments(
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
    }
  }, [isOpen, initialAgent]);

  const handleSaveProfile = async () => {
    if (!agent) return;
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
    if (!agent) return;
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

  if (!isOpen || !agent) return null;

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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Background Dimmer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Main Modal Panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="relative w-full max-w-[95vw] xl:max-w-7xl h-[96vh] bg-slate-50 shadow-2xl flex flex-col z-10 rounded-2xl overflow-hidden"
      >
        {/* Premium Header */}
        <div className="bg-gradient-to-r from-primary-900 to-indigo-900 text-white px-8 py-6 flex justify-between items-center shadow-lg relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-20 w-40 h-40 bg-indigo-500/20 rounded-full blur-2xl -mb-10"></div>

          <div className="relative z-10 flex flex-col">
            <h2 className="text-2xl font-extrabold tracking-tight flex items-center gap-3">
              Agent Profile Workspace
              <span className="bg-white/20 px-3 py-1 rounded-lg text-sm font-mono tracking-widest backdrop-blur-md border border-white/20">
                #{agent.id.toString().padStart(4, '0')}
              </span>
            </h2>
            <p className="text-indigo-200 text-xs mt-1 font-medium">
              {agent.name.toUpperCase()} - Complete overview and administration
            </p>
          </div>
          <div className="relative z-10 flex items-center gap-4">
            <div className="flex gap-3 mr-4">
              {editMode ? (
                <>
                  <button onClick={() => { setEditMode(false); }} className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-[12px] font-bold transition-all backdrop-blur-sm shadow-sm">
                    Cancel
                  </button>
                  <button onClick={handleSaveProfile} disabled={saving} className="px-5 py-2 rounded-xl bg-white text-primary-900 hover:bg-slate-50 text-[12px] font-bold transition-all flex items-center gap-2 shadow-lg shadow-white/20 active:scale-95">
                    {saving ? <div className="w-4 h-4 border-2 border-primary-900/30 border-t-primary-900 rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Changes
                  </button>
                </>
              ) : (
                <button onClick={() => setEditMode(true)} className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-[12px] font-bold transition-all flex items-center gap-2 backdrop-blur-sm shadow-sm">
                  <Edit3 className="w-4 h-4" /> Edit Profile
                </button>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/80 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 relative">
          <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-indigo-100/50 to-transparent pointer-events-none"></div>
          
          <div className="relative z-10 max-w-6xl mx-auto space-y-4">
            <AccordionSection
              title="Agent Profile"
              icon={<Users className="w-4 h-4" />}
              isOpen={openSections.includes('profile')}
              onToggle={() => toggleSection('profile')}
            >
              {editMode ? (
                <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Full Name *</label>
                    <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full bg-white/70 border border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Email</label>
                    <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full bg-white/70 border border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Phone Number</label>
                    <input type="text" value={form.phoneNumber} onChange={e => setForm({ ...form, phoneNumber: e.target.value })} className="w-full bg-white/70 border border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">GDS System</label>
                    <input type="text" value={form.gdsSystem} onChange={e => setForm({ ...form, gdsSystem: e.target.value })} className="w-full bg-white/70 border border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Clients (Press Enter to add)</label>
                    <TagInput tags={clientTags} onChange={setClientTags} placeholder="Enter client names..." />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">PCC</label>
                    <input type="text" value={form.pcc} onChange={e => setForm({ ...form, pcc: e.target.value })} className="w-full bg-white/70 border border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all shadow-sm" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Job Status</label>
                    <select value={form.jobStatus} onChange={e => setForm({ ...form, jobStatus: e.target.value })} className="w-full md:w-1/2 bg-white/70 border border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all shadow-sm">
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="On Leave">On Leave</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-8 p-8 bg-white/50 rounded-2xl border border-white">
                  {infoRows.map((row) => (
                    <div key={row.label} className="flex flex-col gap-2 min-w-0">
                      <span className="text-[10px] font-extrabold text-indigo-900/60 uppercase tracking-widest truncate">{row.label}</span>
                      {row.label === 'Clients' ? (
                        <div className="flex flex-wrap gap-1.5">
                          {row.value !== '—' && row.value ? row.value.split(',').map((tag, i) => (
                            <span key={i} className="bg-white text-slate-700 border border-slate-200 px-2.5 py-1 rounded-md text-[12px] font-semibold shadow-sm">{tag.trim()}</span>
                          )) : <span className="text-slate-400 italic text-[13px]">No clients assigned</span>}
                        </div>
                      ) : (
                        <span className={`text-[14px] font-black break-words ${row.label === 'Job Status'
                          ? (agent.jobStatus === 'Active' ? 'text-emerald-600' : 'text-rose-600')
                          : row.value === '—' ? 'text-slate-400 italic font-medium' : 'text-slate-800'}`}>
                          {row.value}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </AccordionSection>

            <AccordionSection
              title="Commission Margin Segments"
              icon={<Percent className="w-4 h-4" />}
              isOpen={openSections.includes('segments')}
              onToggle={() => toggleSection('segments')}
            >
              <div className="p-2">
                <p className="text-slate-500 text-[13px] mb-6 max-w-3xl">
                  Define commission percentage slabs for <strong className="text-slate-800">{agent.name}</strong>. The system matches the agent's net profit to a slab below and automatically applies the corresponding margin rate.
                </p>

                <div className="rounded-2xl overflow-hidden border border-slate-200 mb-6 shadow-sm bg-white/50">
                  <div className="grid grid-cols-12 bg-slate-50/80 px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">
                    <div className="col-span-4">Monthly Net Sales (£)</div>
                    <div className="col-span-3 text-right">Min Amount (£)</div>
                    <div className="col-span-3 text-right">Max Amount (£)</div>
                    <div className="col-span-1 text-right">Rate %</div>
                    <div className="col-span-1"></div>
                  </div>
                  <div className="divide-y divide-slate-100/50">
                    {segments.map((seg, i) => (
                      <div key={i} className="grid grid-cols-12 items-center px-5 py-3 hover:bg-slate-50/50 transition-colors gap-3">
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
                            className="w-full bg-white/80 border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-xl px-3 py-1.5 text-slate-800 text-[13px] font-medium outline-none text-right transition-all"
                            placeholder="0"
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            type="number"
                            value={seg.maxAmount}
                            onChange={e => updateSegment(i, 'maxAmount', e.target.value)}
                            className="w-full bg-white/80 border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-xl px-3 py-1.5 text-slate-800 text-[13px] font-medium outline-none text-right transition-all"
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

                <div className="flex items-center gap-4 mt-6">
                  <button onClick={addSegment} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-600 text-[12px] font-bold border border-slate-200 shadow-sm transition-all active:scale-95">
                    <Plus className="w-3.5 h-3.5 text-slate-400" /> Add Slab Row
                  </button>
                  <div className="flex-1" />
                  {segmentsMsg && (
                    <span className="flex items-center gap-2 text-emerald-600 text-[12px] font-bold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                      <Check className="w-4 h-4" /> {segmentsMsg}
                    </span>
                  )}
                  <button
                    onClick={handleSaveSegments}
                    disabled={segmentsSaving}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-bold shadow-md shadow-emerald-600/25 transition-all active:scale-95"
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
            </AccordionSection>

            <AccordionSection
              title="Agent Wallet & Ledger"
              icon={<Wallet className="w-4 h-4" />}
              isOpen={openSections.includes('wallet')}
              onToggle={() => toggleSection('wallet')}
              action={
                <div className="flex items-center gap-2">
                  <div className="flex flex-col items-end mr-4">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-none mb-1">Current Balance</span>
                    <span className={`text-base leading-none font-black ${agent.wallet && Number(agent.wallet.currentBalance) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      £{agent.wallet ? Number(agent.wallet.currentBalance).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                    </span>
                  </div>
                </div>
              }
            >
              <div className="p-0">
                {!agent.wallet || agent.wallet.transactions.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-[13px] bg-white/50 rounded-2xl border border-white">
                    No wallet transactions recorded yet.
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto bg-white/50 rounded-2xl border border-white">
                      <table className="w-full text-left text-[13px]">
                        <thead className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">
                          <tr>
                          <th className="px-6 py-2.5">Date</th>
                          <th className="px-6 py-2.5">Type</th>
                          <th className="px-6 py-2.5">Reference</th>
                          <th className="px-6 py-2.5 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100/50 font-medium text-[12px]">
                        {agent.wallet.transactions.slice((walletPage - 1) * walletItemsPerPage, walletPage * walletItemsPerPage).map((tx) => (
                          <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-2.5 text-slate-500 whitespace-nowrap">
                              {new Date(tx.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                            </td>
                            <td className="px-6 py-2.5">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest ${
                                tx.amount > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                              }`}>
                                {tx.amount > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                                {tx.transactionType.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="px-6 py-2.5 text-slate-600">
                              {tx.referenceId || '—'}
                              {tx.notes && <div className="text-[10px] text-slate-400 mt-0.5">{tx.notes}</div>}
                            </td>
                            <td className={`px-6 py-2.5 text-right font-bold ${Number(tx.amount) > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {Number(tx.amount) > 0 ? '+' : ''}£{Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {agent.wallet.transactions.length > 0 && (
                    <Pagination 
                      currentPage={walletPage} 
                      totalPages={Math.ceil(agent.wallet.transactions.length / walletItemsPerPage)} 
                      onPageChange={setWalletPage} 
                      itemsPerPage={walletItemsPerPage} 
                      totalItems={agent.wallet.transactions.length} 
                    />
                  )}
                </>
                )}
              </div>
            </AccordionSection>
          </div>
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

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 15 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white rounded-lg shadow-2xl w-full max-w-xl relative z-10 overflow-hidden flex flex-col">
        
        {/* Dark Sleek Header */}
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between shrink-0">
          <h3 className="text-[11px] font-bold tracking-wide uppercase">{initialData ? 'Edit Agent Profile' : 'New Agent Profile'}</h3>
          <button 
            type="button" 
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 max-h-[85vh] overflow-hidden">
          <div className="p-5 overflow-y-auto space-y-4">
            {error && (
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-rose-600 text-[13px] font-medium mb-3">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Full Name *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full bg-white border border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-xl px-3 py-2 text-slate-800 text-[13px] font-bold outline-none transition-all placeholder:text-slate-400" placeholder="e.g. Sarah Jenkins" />
              </div>
              
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Email Address</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full bg-white border border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-xl px-3 py-2 text-slate-800 text-[13px] font-medium outline-none transition-all placeholder:text-slate-400" placeholder="sarah@example.com" />
              </div>
              
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Phone Number</label>
                <input type="text" value={form.phoneNumber} onChange={e => setForm({ ...form, phoneNumber: e.target.value })} className="w-full bg-white border border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-xl px-3 py-2 text-slate-800 text-[13px] font-medium outline-none transition-all placeholder:text-slate-400" placeholder="+44 123 456 789" />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Clients</label>
                <TagInput tags={clientTags} onChange={setClientTags} placeholder="e.g. Acme Corp..." />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">GDS System</label>
                <input type="text" value={form.gdsSystem} onChange={e => setForm({ ...form, gdsSystem: e.target.value })} className="w-full bg-white border border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-xl px-3 py-2 text-slate-800 text-[13px] font-medium outline-none transition-all placeholder:text-slate-400" placeholder="Amadeus, Galileo..." />
              </div>
              
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">PCC Code</label>
                <input type="text" value={form.pcc} onChange={e => setForm({ ...form, pcc: e.target.value })} className="w-full bg-white border border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-xl px-3 py-2 text-slate-800 text-[13px] font-medium outline-none transition-all placeholder:text-slate-400" placeholder="Alpha numeric code" />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Job Status</label>
                <select value={form.jobStatus} onChange={e => setForm({ ...form, jobStatus: e.target.value })} className="w-full bg-white border border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-xl px-3 py-2 text-slate-800 text-[13px] font-medium outline-none transition-all cursor-pointer">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="On Leave">On Leave</option>
                </select>
              </div>
            </div>
          </div>
          
          <div className="p-4 border-t border-slate-100 flex justify-end gap-2 shrink-0 bg-white">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-[12px] font-bold text-slate-600 transition-colors">Cancel</button>
            <button type="submit" disabled={saving}
              className="bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white px-4 py-1.5 rounded text-[10px] font-bold active:scale-95 transition-all">
              {saving ? 'Saving...' : (initialData ? 'Save Changes' : 'Create Agent')}
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
  const [agents, setAgents] = useState<Agent[]>([]); // All agents for stats
  const [tableAgents, setTableAgents] = useState<Agent[]>([]); // Paginated agents for table
  const [totalTableItems, setTotalTableItems] = useState(0);
  const [totalTablePages, setTotalTablePages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [deletingAgentId, setDeletingAgentId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);

      const paginatedParams = new URLSearchParams(params.toString());
      paginatedParams.append('page', currentPage.toString());
      paginatedParams.append('limit', itemsPerPage.toString());

      const allParams = new URLSearchParams(params.toString());
      allParams.append('limit', 'all');

      const [paginatedRes, allRes] = await Promise.all([
        api.get(`/agents?${paginatedParams.toString()}`),
        api.get(`/agents?${allParams.toString()}`)
      ]);

      setTableAgents(paginatedRes.data.agents || []);
      setTotalTableItems(paginatedRes.data.total || 0);
      setTotalTablePages(paginatedRes.data.totalPages || 1);

      setAgents(allRes.data.agents || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAgents(); }, [currentPage, search]);

  const handleDelete = async () => {
    if (!deletingAgentId) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/agents/${deletingAgentId}`);
      toast.success('Agent deleted successfully');
      setAgents(prev => prev.filter(a => a.id !== deletingAgentId));
      setTableAgents(prev => prev.filter(a => a.id !== deletingAgentId));
      setDeletingAgentId(null);
      fetchAgents();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete agent');
    } finally {
      setDeleteLoading(false);
    }
  };

  useEffect(() => { setCurrentPage(1); }, [search]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Agent Registry</h1>
          <p className="text-slate-500 text-xs mt-0.5">Manage agents, clients, and their commission margin slabs</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 bg-primary-600 text-white hover:bg-primary-500 px-4.5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-primary-500/20 active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" /> New Agent
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

      {loading ? (
        <div className="bg-white/70 backdrop-blur-xl border border-white rounded-3xl shadow-sm p-8">
          <LoadingState message="Loading agents..." />
        </div>
      ) : tableAgents.length === 0 && !search ? (
        <EmptyState 
          icon={Search}
          title="No agents yet"
          description="Get started by adding a new agent."
          transparent={false}
          action={
            <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 bg-primary-600 text-white hover:bg-primary-500 px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-primary-500/20 active:scale-95 transition-all">
              <Plus className="h-4 w-4" /> Add Agent
            </button>
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="bg-white px-6 py-4 flex items-center justify-between gap-4 border-b border-slate-100 rounded-t-3xl shadow-sm">
            <div className="flex flex-wrap items-center gap-3 w-full">
              <div className="flex items-center gap-2 text-slate-500 font-bold text-[10px] mr-2 uppercase tracking-wider">
                <Search className="w-3.5 h-3.5 text-primary-500" /> Search:
              </div>
              <div className="relative w-full max-w-sm">
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-xl px-3 py-2 text-slate-800 text-[13px] font-bold outline-none transition-all placeholder:text-slate-400 shadow-sm"
                  placeholder="Search by name, email, or phone..."
                />
              </div>
            </div>
          </div>

          <div className="flex-1 w-full min-w-0">
            {error ? (
              <div className="bg-rose-50 rounded-2xl border border-rose-200 p-12 text-center shadow-sm max-w-2xl mx-auto">
                <AlertCircle className="w-12 h-12 text-rose-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-rose-800">Failed to load data</h3>
                <p className="text-rose-600 text-sm mt-1">{error}</p>
              </div>
            ) : tableAgents.length === 0 ? (
              <EmptyState 
                icon={Search}
                title="No records found"
                description={`We couldn't find any agents matching "${search}"`}
                size="sm"
                transparent={true}
              />
            ) : (
              <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden text-[11px]">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100">
                      <th className="py-3 px-5">Agent ID</th>
                      <th className="py-3 px-5">Agent Name</th>
                      <th className="py-3 px-5">Contact Info</th>
                      <th className="py-3 px-5">GDS & PCC</th>
                      <th className="py-3 px-5">Clients</th>
                      <th className="py-3 px-5">Margin Tier</th>
                      <th className="py-3 px-5 text-center">Status</th>
                      <th className="py-3 px-5 text-center w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-600 font-medium">
                    {tableAgents.map(agent => (
                      <tr 
                        key={agent.id} 
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                        onClick={() => setSelectedAgent(agent)}
                      >
                        <td className="py-3.5 px-5 font-black text-slate-500">#{agent.id.toString().padStart(4, '0')}</td>
                        <td className="py-3.5 px-5">
                          <span className="font-bold text-slate-900">{agent.name}</span>
                        </td>
                        <td className="py-3.5 px-5">
                          {agent.phoneNumber && <div className="text-slate-700">{agent.phoneNumber}</div>}
                          {agent.email && <div className="text-slate-400 text-[10px]">{agent.email}</div>}
                        </td>
                        <td className="py-3.5 px-5 font-bold text-slate-700">{agent.gdsSystem || '—'}</td>
                        <td className="py-3.5 px-5">
                          <div className="flex flex-wrap gap-1 max-w-[150px]">
                            {agent.client ? agent.client.split(',').slice(0, 2).map((tag, i) => (
                              <span key={i} className="bg-slate-50 text-slate-600 border border-slate-100 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                {tag.trim()}
                              </span>
                            )) : <span className="text-slate-400 italic text-[10px]">None</span>}
                            {agent.client && agent.client.split(',').length > 2 && (
                              <span className="text-[9px] font-bold text-primary-500">
                                +{agent.client.split(',').length - 2} more
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-5">
                          <span className="inline-flex items-center gap-1.5 text-indigo-600 font-bold">
                            {agent.marginSegments.length} slabs
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            agent.jobStatus === 'Active' 
                              ? 'bg-emerald-50 text-emerald-700' 
                              : agent.jobStatus === 'On Leave'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}>
                            {agent.jobStatus.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-center" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => { setEditingAgent(agent); setShowAddModal(true); }} className="text-slate-400 hover:text-indigo-600 transition-colors">
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeletingAgentId(agent.id)} className="text-slate-400 hover:text-rose-600 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => setSelectedAgent(agent)} className="bg-primary-50 text-primary-600 hover:bg-primary-100 font-bold px-3 py-1.5 rounded-lg transition-colors ml-2">
                              Inspect
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {tableAgents.length > 0 && (
                <Pagination 
                  currentPage={currentPage} 
                  totalPages={totalTablePages} 
                  onPageChange={setCurrentPage} 
                  itemsPerPage={itemsPerPage} 
                  totalItems={totalTableItems} 
                />
              )}
            </div>
          )}
        </div>
      </div>
      )}

      <AnimatePresence>
        {selectedAgent && (
          <AgentDetailsModal 
            agent={selectedAgent} 
            isOpen={!!selectedAgent}
            onClose={() => setSelectedAgent(null)}
            onRefresh={fetchAgents}
          />
        )}
        
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
