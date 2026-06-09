import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Banknote, Send, CheckCircle2, Clock, ChevronDown,
  Plus, Pencil, X, Check, AlertCircle, TrendingUp,
  Wallet, FileText, Users, RefreshCw
} from 'lucide-react';
import { api } from '../api/axios';
import toast from 'react-hot-toast';
import { EmptyState } from '../components/shared/EmptyState';
import { LoadingState } from '../components/shared/LoadingState';

interface Agent {
  id: number;
  name: string;
  email: string | null;
  jobStatus: string;
  basicSalary: number | null;
}

interface Payroll {
  id: number;
  agentId: number;
  periodFrom: string;
  periodTo: string;
  basicSalary: number;
  totalMarginEarned: number;
  totalPaid: number;
  status: 'Draft' | 'Sent' | 'Paid';
  sentAt: string | null;
  notes: string | null;
  createdAt: string;
  agent: { id: number; name: string; email: string | null; basicSalary: number | null; jobStatus: string };
}

function fmt(n: number | string) {
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtPeriod(from: string, to: string) {
  const f = new Date(from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const t = new Date(to).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${f} – ${t}`;
}

const STATUS_STYLES: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-600 border-slate-200',
  Sent: 'bg-blue-50 text-blue-700 border-blue-100',
  Paid: 'bg-emerald-50 text-emerald-700 border-emerald-100',
};
const STATUS_ICONS: Record<string, any> = {
  Draft: Clock,
  Sent: Send,
  Paid: CheckCircle2,
};

// ─── Generate Payroll Modal ─────────────────────────────────────────────────
function GeneratePayrollModal({
  agents, onClose, onCreated
}: { agents: Agent[]; onClose: () => void; onCreated: () => void }) {
  const [agentId, setAgentId] = useState('');
  const [periodFrom, setPeriodFrom] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [periodTo, setPeriodTo] = useState(() => {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!agentId) { toast.error('Please select an agent'); return; }
    setLoading(true);
    try {
      await api.post(`/agents/${agentId}/payroll`, { periodFrom, periodTo, notes: notes || undefined });
      toast.success('Payroll generated successfully');
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to generate payroll');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div key="gen-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <motion.div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !loading && onClose()} />
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: 'spring', damping: 24, stiffness: 220 }}
        className="relative z-10 bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="bg-gradient-to-r from-primary-900 to-indigo-900 px-6 py-5 text-white relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[16px] font-extrabold">Generate Payroll</h3>
              <p className="text-[11px] text-indigo-200">Calculate salary + commission for a period</p>
            </div>
          </div>
          <button onClick={onClose} className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Agent *</label>
            <select value={agentId} onChange={e => setAgentId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none focus:border-primary-500 bg-white">
              <option value="">-- Select Agent --</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} {a.basicSalary ? `(£${Number(a.basicSalary).toFixed(2)}/mo)` : '(no salary set)'}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Period From *</label>
              <input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 text-[13px] outline-none focus:border-primary-500" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Period To *</label>
              <input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 text-[13px] outline-none focus:border-primary-500" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Notes (optional)</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="e.g. June 2026 payroll"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none focus:border-primary-500 placeholder:text-slate-400" />
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-[12px] text-blue-700">
            <strong>💡 How it works:</strong> We'll calculate total commission earned from all non-cancelled bookings in the selected period where this agent is assigned. Basic salary is taken from the agent's profile.
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} disabled={loading}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-[13px] font-bold hover:bg-slate-50 transition-all disabled:opacity-50">
              Cancel
            </button>
            <button onClick={handleGenerate} disabled={loading || !agentId}
              className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-[13px] font-bold shadow-md shadow-primary-500/30 transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Banknote className="w-4 h-4" />}
              {loading ? 'Calculating…' : 'Generate Payroll'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Set Basic Salary Modal ──────────────────────────────────────────────────
function SetSalaryModal({
  agent, onClose, onSaved
}: { agent: Agent; onClose: () => void; onSaved: () => void }) {
  const [salary, setSalary] = useState(agent.basicSalary !== null ? String(agent.basicSalary) : '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.patch(`/agents/${agent.id}`, { basicSalary: salary === '' ? null : salary });
      toast.success(`Basic salary updated for ${agent.name}`);
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to update salary');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div key="salary-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <motion.div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !loading && onClose()} />
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: 'spring', damping: 24, stiffness: 220 }}
        className="relative z-10 bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
      >
        <div className="bg-gradient-to-r from-amber-600 to-orange-500 px-6 py-5 text-white relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[16px] font-extrabold">Set Basic Salary</h3>
              <p className="text-[11px] text-amber-100">{agent.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Monthly Basic Salary (£)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[15px]">£</span>
              <input type="number" min="0" step="0.01" value={salary} onChange={e => setSalary(e.target.value)}
                placeholder="e.g. 2000.00"
                className="w-full border border-slate-200 rounded-xl pl-8 pr-4 py-2.5 text-slate-800 text-[14px] font-bold outline-none focus:border-primary-500 placeholder:text-slate-300 placeholder:font-normal" />
            </div>
            <p className="mt-1.5 text-[10px] text-slate-400">Leave blank to remove the salary. This is used in payroll calculations.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} disabled={loading}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-[13px] font-bold hover:bg-slate-50 transition-all disabled:opacity-50">
              Cancel
            </button>
            <button onClick={handleSave} disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-[13px] font-bold shadow-md shadow-amber-500/30 transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
              Save Salary
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main PayrollPage ─────────────────────────────────────────────────────────
export function PayrollPage() {
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [salaryAgent, setSalaryAgent] = useState<Agent | null>(null);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<number | null>(null);
  const [filterAgent, setFilterAgent] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterAgent) params.append('agentId', filterAgent);
      if (filterStatus) params.append('status', filterStatus);

      const [payrollRes, agentsRes] = await Promise.all([
        api.get(`/agents/payroll?${params}`),
        api.get('/agents?limit=all'),
      ]);
      setPayrolls(payrollRes.data.payrolls || []);
      setAgents(agentsRes.data.agents || []);
    } catch (err) {
      toast.error('Failed to load payroll data');
    } finally {
      setLoading(false);
    }
  }, [filterAgent, filterStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSendSlip = async (payrollId: number) => {
    setSendingId(payrollId);
    try {
      await api.post(`/agents/payroll/${payrollId}/send`);
      toast.success('Payroll slip sent via email!');
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || 'Failed to send payroll slip');
    } finally {
      setSendingId(null);
    }
  };

  const handleMarkPaid = async (payrollId: number) => {
    setMarkingPaidId(payrollId);
    try {
      await api.patch(`/agents/payroll/${payrollId}`, { status: 'Paid' });
      toast.success('Payroll marked as Paid');
      fetchData();
    } catch (err: any) {
      toast.error('Failed to update payroll status');
    } finally {
      setMarkingPaidId(null);
    }
  };

  // Summary
  const totalPayroll = payrolls.reduce((s, p) => s + Number(p.totalPaid), 0);
  const totalMargin = payrolls.reduce((s, p) => s + Number(p.totalMarginEarned), 0);
  const totalSalary = payrolls.reduce((s, p) => s + Number(p.basicSalary), 0);
  const paidCount = payrolls.filter(p => p.status === 'Paid').length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 rounded-xl">
              <Banknote className="w-5 h-5 text-emerald-600" />
            </div>
            Agent Payroll
          </h1>
          <p className="text-slate-500 text-xs mt-1">Manage salaries, commissions, and send payroll slips.</p>
        </div>
        <button
          onClick={() => setShowGenerate(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-primary-500/20 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" /> Generate Payroll
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Payroll', value: fmt(totalPayroll), icon: Banknote, color: 'primary', sub: 'All records' },
          { label: 'Total Salary', value: fmt(totalSalary), icon: Wallet, color: 'amber', sub: 'Basic salary sum' },
          { label: 'Total Commission', value: fmt(totalMargin), icon: TrendingUp, color: 'emerald', sub: 'Margin earned' },
          { label: 'Paid Out', value: `${paidCount} / ${payrolls.length}`, icon: CheckCircle2, color: 'indigo', sub: 'Payrolls paid' },
        ].map(card => (
          <div key={card.label} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
            <div className={`w-9 h-9 rounded-xl bg-${card.color}-50 flex items-center justify-center mb-3`}>
              <card.icon className={`w-4.5 h-4.5 text-${card.color}-600`} />
            </div>
            <p className="text-xl font-extrabold text-slate-900">{card.value}</p>
            <p className="text-[11px] text-slate-500 font-medium">{card.label}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Agent Salary Overview */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 text-[14px] flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" /> Agent Salary Settings
          </h2>
          <p className="text-[11px] text-slate-400">Click pencil to set basic salary per agent</p>
        </div>
        <div className="divide-y divide-slate-50">
          {agents.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-[13px]">No agents found</div>
          ) : agents.map(agent => (
            <div key={agent.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-100 to-indigo-100 text-primary-700 flex items-center justify-center font-bold text-[11px] border border-primary-200/50 shrink-0">
                  {agent.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-[13px]">{agent.name}</p>
                  <p className="text-[11px] text-slate-400">{agent.email || 'No email'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {agent.basicSalary !== null ? (
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-[12px] font-bold">
                    {fmt(agent.basicSalary)}/mo
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-slate-50 text-slate-400 border border-slate-100 rounded-lg text-[12px]">
                    No salary set
                  </span>
                )}
                <button
                  onClick={() => setSalaryAgent(agent)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                  title="Set basic salary"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)}
            className="pl-3 pr-8 py-2 border border-slate-200 rounded-xl text-[12px] text-slate-700 outline-none focus:border-primary-500 appearance-none bg-white">
            <option value="">All Agents</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="relative">
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="pl-3 pr-8 py-2 border border-slate-200 rounded-xl text-[12px] text-slate-700 outline-none focus:border-primary-500 appearance-none bg-white">
            <option value="">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Sent">Sent</option>
            <option value="Paid">Paid</option>
          </select>
        </div>
        <button onClick={fetchData} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors" title="Refresh">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <span className="text-[12px] text-slate-400 ml-auto">{payrolls.length} record{payrolls.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Payroll Records */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-800 text-[14px] flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" /> Payroll Records
          </h2>
        </div>
        {loading ? (
          <div className="p-8"><LoadingState message="Loading payroll records..." /></div>
        ) : payrolls.length === 0 ? (
          <EmptyState
            icon={Banknote}
            title="No payroll records"
            description="Generate a payroll slip to get started."
            action={
              <button onClick={() => setShowGenerate(true)}
                className="flex items-center gap-1.5 bg-primary-600 text-white hover:bg-primary-500 px-4 py-2.5 rounded-xl text-xs font-bold shadow-md active:scale-95 transition-all">
                <Plus className="h-4 w-4" /> Generate Payroll
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-100">
                  <th className="py-3 px-5">Agent</th>
                  <th className="py-3 px-5">Period</th>
                  <th className="py-3 px-5 text-right">Basic Salary</th>
                  <th className="py-3 px-5 text-right">Commission</th>
                  <th className="py-3 px-5 text-right">Total</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Notes</th>
                  <th className="py-3 px-5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-[12px]">
                {payrolls.map(p => {
                  const StatusIcon = STATUS_ICONS[p.status] || Clock;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-100 to-indigo-100 text-primary-700 flex items-center justify-center font-bold text-[10px] border border-primary-200/50 shrink-0">
                            {(p.agent?.name || 'A').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">{p.agent?.name}</p>
                            <p className="text-slate-400 text-[10px]">{p.agent?.email || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-5 text-slate-600 font-medium whitespace-nowrap">
                        {fmtPeriod(p.periodFrom, p.periodTo)}
                      </td>
                      <td className="py-3 px-5 text-right font-bold text-slate-700">{fmt(p.basicSalary)}</td>
                      <td className="py-3 px-5 text-right font-bold text-emerald-600">+{fmt(p.totalMarginEarned)}</td>
                      <td className="py-3 px-5 text-right">
                        <span className="text-[14px] font-extrabold text-primary-700">{fmt(p.totalPaid)}</span>
                      </td>
                      <td className="py-3 px-5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold ${STATUS_STYLES[p.status]}`}>
                          <StatusIcon className="w-3 h-3" />
                          {p.status}
                        </span>
                        {p.sentAt && (
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Sent {new Date(p.sentAt).toLocaleDateString('en-GB')}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-5 text-slate-500 max-w-[120px] truncate text-[11px]">{p.notes || '—'}</td>
                      <td className="py-3 px-5">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Send Slip */}
                          {p.status !== 'Paid' && p.agent?.email && (
                            <button
                              onClick={() => handleSendSlip(p.id)}
                              disabled={sendingId === p.id}
                              title="Send payroll slip via email"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] font-bold transition-all disabled:opacity-50"
                            >
                              {sendingId === p.id
                                ? <div className="w-3.5 h-3.5 border-2 border-blue-300 border-t-blue-700 rounded-full animate-spin" />
                                : <Send className="w-3 h-3" />}
                              {p.status === 'Sent' ? 'Resend' : 'Send Slip'}
                            </button>
                          )}
                          {/* Mark Paid */}
                          {p.status !== 'Paid' && (
                            <button
                              onClick={() => handleMarkPaid(p.id)}
                              disabled={markingPaidId === p.id}
                              title="Mark as paid"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[11px] font-bold transition-all disabled:opacity-50"
                            >
                              {markingPaidId === p.id
                                ? <div className="w-3.5 h-3.5 border-2 border-emerald-300 border-t-emerald-700 rounded-full animate-spin" />
                                : <CheckCircle2 className="w-3 h-3" />}
                              Mark Paid
                            </button>
                          )}
                          {p.status === 'Paid' && !p.agent?.email && (
                            <span className="text-[11px] text-amber-600 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> No email
                            </span>
                          )}
                          {p.status === 'Paid' && (
                            <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Paid
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showGenerate && (
          <GeneratePayrollModal agents={agents} onClose={() => setShowGenerate(false)} onCreated={fetchData} />
        )}
        {salaryAgent && (
          <SetSalaryModal agent={salaryAgent} onClose={() => setSalaryAgent(null)} onSaved={() => { fetchData(); setSalaryAgent(null); }} />
        )}
      </AnimatePresence>
    </div>
  );
}
