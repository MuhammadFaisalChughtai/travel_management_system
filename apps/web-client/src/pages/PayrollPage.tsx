import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Banknote, Send, CheckCircle2, Clock, ChevronDown,
  Plus, Pencil, X, Check, AlertCircle, TrendingUp,
  Wallet, FileText, Users, RefreshCw, Trash2, Printer
} from 'lucide-react';
import { api } from '../api/axios';
import toast from 'react-hot-toast';
import { EmptyState } from '../components/shared/EmptyState';
import { LoadingState } from '../components/shared/LoadingState';
import { useCurrency } from '../utils/currency';

interface Agent {
  id: number;
  name: string;
  email: string | null;
  personalEmail?: string | null;
  jobStatus: string;
  basicSalary: number | null;
  gdsSystem?: string | null;
  pcc?: string | null;
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
  totalWorkdays?: number | null;
  daysPresent?: number | null;
  absents?: number | null;
  paidHolidaysCount?: number | null;
  paidHolidaysRate?: number | null;
  publicHolidaysCount?: number | null;
  publicHolidaysRate?: number | null;
  allowances?: any | null;
  deductions?: any | null;
  createdAt: string;
  agent: {
    id: number;
    name: string;
    email: string | null;
    personalEmail?: string | null;
    basicSalary: number | null;
    jobStatus: string;
    gdsSystem?: string | null;
    pcc?: string | null;
  };
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
  const { symbol } = useCurrency();
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
                  {a.name} {a.basicSalary ? `(${symbol}${Number(a.basicSalary).toFixed(2)}/mo)` : '(no salary set)'}
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
  const { symbol } = useCurrency();
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
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">{`Monthly Basic Salary (${symbol})`}</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[15px]">{symbol}</span>
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
  const { symbol, format } = useCurrency();
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [salaryAgent, setSalaryAgent] = useState<Agent | null>(null);
  const [sendSlipPayroll, setSendSlipPayroll] = useState<Payroll | null>(null);
  const [viewSlipPayroll, setViewSlipPayroll] = useState<Payroll | null>(null);
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

  const totalPayroll = payrolls.reduce((s, p) => s + Number(p.totalPaid), 0);
  const totalMargin = payrolls.reduce((s, p) => s + Number(p.totalMarginEarned), 0);
  const totalSalary = payrolls.reduce((s, p) => s + Number(p.basicSalary), 0);
  const paidCount = payrolls.filter(p => p.status === 'Paid').length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Payroll', value: format(totalPayroll), icon: Banknote, color: 'primary', sub: 'All records' },
          { label: 'Total Salary', value: format(totalSalary), icon: Wallet, color: 'amber', sub: 'Basic salary sum' },
          { label: 'Total Commission', value: format(totalMargin), icon: TrendingUp, color: 'emerald', sub: 'Margin earned' },
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
                    {format(agent.basicSalary)}/mo
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
                        {new Date(p.periodFrom).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {new Date(p.periodTo).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-3 px-5 text-right font-bold text-slate-700">{format(p.basicSalary)}</td>
                      <td className="py-3 px-5 text-right font-bold text-emerald-600">+{format(p.totalMarginEarned)}</td>
                      <td className="py-3 px-5 text-right">
                        <span className="text-[14px] font-extrabold text-primary-700">{format(p.totalPaid)}</span>
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
                          {p.status !== 'Paid' && (
                            <button
                              onClick={() => setSendSlipPayroll(p)}
                              title="Send payroll slip via email"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] font-bold transition-all"
                            >
                              <Send className="w-3 h-3" />
                              {p.status === 'Sent' ? 'Resend' : 'Send Slip'}
                            </button>
                          )}
                          <button
                            onClick={() => setViewSlipPayroll(p)}
                            title="View / Print Salary Slip"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-all"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            View Slip
                          </button>
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

      <AnimatePresence>
        {showGenerate && (
          <GeneratePayrollModal agents={agents} onClose={() => setShowGenerate(false)} onCreated={fetchData} />
        )}
        {salaryAgent && (
          <SetSalaryModal agent={salaryAgent} onClose={() => setSalaryAgent(null)} onSaved={() => { fetchData(); setSalaryAgent(null); }} />
        )}
        {sendSlipPayroll && (
          <SendPayrollSlipModal
            payroll={sendSlipPayroll}
            onClose={() => setSendSlipPayroll(null)}
            onSent={fetchData}
          />
        )}
        {viewSlipPayroll && (
          <ViewSalarySlipModal
            payroll={viewSlipPayroll}
            onClose={() => setViewSlipPayroll(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Send Payroll Slip Modal ──────────────────────────────────────────────────
interface SendPayrollSlipModalProps {
  payroll: Payroll;
  onClose: () => void;
  onSent: () => void;
}

function SendPayrollSlipModal({ payroll, onClose, onSent }: SendPayrollSlipModalProps) {
  const { symbol } = useCurrency();
  const [email, setEmail] = useState(payroll.agent.personalEmail || payroll.agent.email || '');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [smtpHost, setSmtpHost] = useState<string | null>(null);
  const [smtpUser, setSmtpUser] = useState<string | null>(null);
  const [checkingSmtp, setCheckingSmtp] = useState(true);
  const [tenant, setTenant] = useState<any>(null);

  const [totalWorkdays, setTotalWorkdays] = useState(() => 
    payroll.totalWorkdays !== null && payroll.totalWorkdays !== undefined ? Number(payroll.totalWorkdays) : 22
  );
  const [daysPresent, setDaysPresent] = useState(() => 
    payroll.daysPresent !== null && payroll.daysPresent !== undefined ? Number(payroll.daysPresent) : 22
  );
  const [absents, setAbsents] = useState(() => 
    payroll.absents !== null && payroll.absents !== undefined ? Number(payroll.absents) : 0
  );

  const [paidHolidaysCount, setPaidHolidaysCount] = useState(() => 
    payroll.paidHolidaysCount !== null && payroll.paidHolidaysCount !== undefined ? Number(payroll.paidHolidaysCount) : 0
  );
  const [paidHolidaysRate, setPaidHolidaysRate] = useState(() => 
    payroll.paidHolidaysRate !== null && payroll.paidHolidaysRate !== undefined ? Number(payroll.paidHolidaysRate) : 0
  );
  const [publicHolidaysCount, setPublicHolidaysCount] = useState(() => 
    payroll.publicHolidaysCount !== null && payroll.publicHolidaysCount !== undefined ? Number(payroll.publicHolidaysCount) : 0
  );
  const [publicHolidaysRate, setPublicHolidaysRate] = useState(() => 
    payroll.publicHolidaysRate !== null && payroll.publicHolidaysRate !== undefined ? Number(payroll.publicHolidaysRate) : 0
  );

  const [allowances, setAllowances] = useState<{ description: string; amount: number }[]>(() => {
    if (payroll.allowances !== null && payroll.allowances !== undefined) {
      return typeof payroll.allowances === 'string' ? JSON.parse(payroll.allowances) : payroll.allowances;
    }
    return [];
  });
  const [deductions, setDeductions] = useState<{ description: string; amount: number }[]>(() => {
    if (payroll.deductions !== null && payroll.deductions !== undefined) {
      return typeof payroll.deductions === 'string' ? JSON.parse(payroll.deductions) : payroll.deductions;
    }
    return [];
  });

  const [newAllowDesc, setNewAllowDesc] = useState('');
  const [newAllowAmt, setNewAllowAmt] = useState('');
  const [newDedDesc, setNewDedDesc] = useState('');
  const [newDedAmt, setNewDedAmt] = useState('');

  const [notes, setNotes] = useState(payroll.notes || '');

  const basicSalaryVal = Number(payroll.basicSalary);
  const marginEarnedVal = Number(payroll.totalMarginEarned);

  useEffect(() => {
    let active = true;
    const isSaved = payroll.totalWorkdays !== null && payroll.totalWorkdays !== undefined;
    
    api.get('/auth/tenants/profile')
      .then(res => {
        if (!active) return;
        const tenantData = res.data.tenant;
        setTenant(tenantData || null);
        if (tenantData?.smtpHost && tenantData?.smtpUser) {
          setSmtpHost(tenantData.smtpHost);
          setSmtpUser(tenantData.smtpUser);
        }
        setCheckingSmtp(false);
      })
      .catch(() => {
        if (active) setCheckingSmtp(false);
      });

    api.get(`/agents/${payroll.agentId}/attendance`, {
      params: { from: payroll.periodFrom.slice(0, 10), to: payroll.periodTo.slice(0, 10) }
    })
      .then(attRes => {
        if (!active) return;
        const attList = attRes.data.attendance || [];
        const uniqueDays = new Set(
          attList.map((r: any) => new Date(r.checkIn).toLocaleDateString('en-GB'))
        );
        const computedPresent = uniqueDays.size;
        
        if (!isSaved) {
          setDaysPresent(computedPresent);

          let weekdaysCount = 0;
          const curDate = new Date(payroll.periodFrom);
          const endDate = new Date(payroll.periodTo);
          while (curDate <= endDate) {
            const day = curDate.getDay();
            if (day !== 0 && day !== 6) weekdaysCount++;
            curDate.setDate(curDate.getDate() + 1);
          }
          const defaultTotalWorkdays = weekdaysCount || 1;
          setTotalWorkdays(defaultTotalWorkdays);

          const computedAbsents = Math.max(0, defaultTotalWorkdays - computedPresent);
          setAbsents(computedAbsents);

          const computedDailyRate = defaultTotalWorkdays > 0 ? (basicSalaryVal / defaultTotalWorkdays) : 0;
          setPaidHolidaysRate(Number(computedDailyRate.toFixed(2)));
          setPublicHolidaysRate(Number((computedDailyRate * 1.5).toFixed(2)));

          const gdsAllowance = payroll.agent?.gdsSystem ? 120.00 : 0.00;
          const travelAllowance = 80.00;
          const initialAllowances = [
            { description: 'Travel & Internet connectivity allowance (Amenities)', amount: travelAllowance }
          ];
          if (gdsAllowance > 0) {
            initialAllowances.push({ description: 'GDS Terminal Premium allowance (Amenities)', amount: gdsAllowance });
          }
          setAllowances(initialAllowances);
        }

        setLoadingData(false);
      })
      .catch(() => {
        if (active) setLoadingData(false);
      });

    return () => { active = false; };
  }, [payroll, basicSalaryVal]);

  const handleWorkdaysChange = (val: number) => {
    const sanitizedVal = Math.max(1, val);
    setTotalWorkdays(sanitizedVal);
    setAbsents(Math.max(0, sanitizedVal - daysPresent));
    const computedDailyRate = sanitizedVal > 0 ? (basicSalaryVal / sanitizedVal) : 0;
    setPaidHolidaysRate(Number(computedDailyRate.toFixed(2)));
    setPublicHolidaysRate(Number((computedDailyRate * 1.5).toFixed(2)));
  };

  const handlePresentChange = (val: number) => {
    const sanitizedVal = Math.max(0, val);
    setDaysPresent(sanitizedVal);
    setAbsents(Math.max(0, totalWorkdays - sanitizedVal));
  };

  const addAllowance = () => {
    if (!newAllowDesc || !newAllowAmt) return;
    setAllowances([...allowances, { description: newAllowDesc, amount: Math.abs(Number(newAllowAmt)) }]);
    setNewAllowDesc('');
    setNewAllowAmt('');
  };

  const removeAllowance = (index: number) => {
    setAllowances(allowances.filter((_, i) => i !== index));
  };

  const addDeduction = () => {
    if (!newDedDesc || !newDedAmt) return;
    setDeductions([...deductions, { description: newDedDesc, amount: Math.abs(Number(newDedAmt)) }]);
    setNewDedDesc('');
    setNewDedAmt('');
  };

  const removeDeduction = (index: number) => {
    setDeductions(deductions.filter((_, i) => i !== index));
  };

  const totalAllowances = allowances.reduce((sum, a) => sum + Number(a.amount || 0), 0);
  const dailyRate = totalWorkdays > 0 ? (basicSalaryVal / totalWorkdays) : 0;
  const absentDeduction = dailyRate * absents;
  const holidayPay = (paidHolidaysCount * paidHolidaysRate) + (publicHolidaysCount * publicHolidaysRate);
  const grossEarnings = basicSalaryVal + marginEarnedVal + totalAllowances + holidayPay;
  const totalDeductions = absentDeduction + deductions.reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const finalNetPay = Math.max(0, grossEarnings - totalDeductions);

  const handleSend = async () => {
    if (!email) {
      toast.error('Please enter a recipient email address');
      return;
    }
    setLoading(true);
    try {
      await api.post(`/agents/payroll/${payroll.id}/send`, {
        email,
        totalWorkdays,
        daysPresent,
        absents,
        paidHolidaysCount,
        paidHolidaysRate,
        publicHolidaysCount,
        publicHolidaysRate,
        allowances,
        deductions,
        notes
      });
      toast.success('Payroll slip sent successfully with PDF attachment!');
      onSent();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || 'Failed to send payroll slip');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const periodFromStr = new Date(payroll.periodFrom).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const periodToStr = new Date(payroll.periodTo).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const companyName = tenant?.name || 'Travel Booker';
  const logoUrl = tenant?.logo || 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80';

  const isCompanySmtpActive = !!smtpHost;

  return (
    <motion.div
      key="send-slip-modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 overflow-y-auto"
    >
      <motion.div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm print:hidden"
        onClick={() => !loading && onClose()}
      />
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-custom-slip, #printable-custom-slip * {
            visibility: visible !important;
          }
          #printable-custom-slip {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
          }
        }
      `}</style>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 240 }}
        className="relative z-10 bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden max-h-[92vh] flex flex-col print:shadow-none print:rounded-none print:max-h-none print:bg-white"
      >
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 text-white relative overflow-hidden shrink-0 flex items-center justify-between print:hidden">
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[16px] font-extrabold">Customize & Send Salary Slip</h3>
              <p className="text-[11px] text-indigo-100">Tailor wages, calendar parameters, and attachments before dispatch</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loadingData ? (
          <div className="p-12 text-center text-slate-500 font-bold text-sm">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            Compiling payroll settings & attendance...
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col lg:flex-row print:block">
            <div className="w-full lg:w-[45%] p-6 overflow-y-auto space-y-5 border-r border-slate-100 print:hidden shrink-0">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400">Recipient Settings</h4>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Agent Name</label>
                  <div className="text-[12px] font-bold text-slate-800">{payroll.agent?.name}</div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Email Address *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-[12px] outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400">Calendar Parameters</h4>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total Workdays (Presets)</label>
                  <div className="flex gap-2 mb-2">
                    {[22, 26, 30].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleWorkdaysChange(val)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${totalWorkdays === val ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                      >
                        {val} Days
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min="1"
                    value={totalWorkdays}
                    onChange={e => handleWorkdaysChange(Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-[12px] outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Days Present</label>
                    <input
                      type="number"
                      min="0"
                      value={daysPresent}
                      onChange={e => handlePresentChange(Number(e.target.value))}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-[12px] outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Days Absent</label>
                    <input
                      type="number"
                      min="0"
                      value={absents}
                      onChange={e => setAbsents(Math.max(0, Number(e.target.value)))}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-[12px] outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400">Holidays Settings</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Paid Holiday Days</label>
                    <input
                      type="number"
                      min="0"
                      value={paidHolidaysCount}
                      onChange={e => setPaidHolidaysCount(Math.max(0, Number(e.target.value)))}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-[12px] outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{`Paid Holiday Rate (${symbol}/day)`}</label>
                    <input
                      type="number"
                      min="0"
                      value={paidHolidaysRate}
                      onChange={e => setPaidHolidaysRate(Math.max(0, Number(e.target.value)))}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-[12px] outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Public Holiday Days</label>
                    <input
                      type="number"
                      min="0"
                      value={publicHolidaysCount}
                      onChange={e => setPublicHolidaysCount(Math.max(0, Number(e.target.value)))}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-[12px] outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{`Public Holiday Rate (${symbol}/day)`}</label>
                    <input
                      type="number"
                      min="0"
                      value={publicHolidaysRate}
                      onChange={e => setPublicHolidaysRate(Math.max(0, Number(e.target.value)))}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-[12px] outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400">Amenities (Allowances)</h4>
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{`+${symbol}${totalAllowances.toFixed(2)}`}</span>
                </div>
                {allowances.length > 0 && (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {allowances.map((item, index) => (
                      <div key={index} className="flex justify-between items-center bg-white border border-slate-200 rounded-lg p-2 text-xs">
                        <span className="font-semibold text-slate-700 truncate max-w-[70%]">{item.description}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{symbol}{item.amount.toFixed(2)}</span>
                          <button
                            type="button"
                            onClick={() => removeAllowance(index)}
                            className="text-red-500 hover:text-red-700 p-0.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Description (e.g. Travel)"
                    value={newAllowDesc}
                    onChange={e => setNewAllowDesc(e.target.value)}
                    className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-850 text-[11px] outline-none"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Amount"
                    value={newAllowAmt}
                    onChange={e => setNewAllowAmt(e.target.value)}
                    className="w-16 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-850 text-[11px] outline-none"
                  />
                  <button
                    type="button"
                    onClick={addAllowance}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg p-1.5 flex items-center justify-center shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400">Custom Deductions</h4>
                </div>
                {deductions.length > 0 && (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {deductions.map((item, index) => (
                      <div key={index} className="flex justify-between items-center bg-white border border-slate-200 rounded-lg p-2 text-xs">
                        <span className="font-semibold text-slate-700 truncate max-w-[70%]">{item.description}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-red-600">-{symbol}{item.amount.toFixed(2)}</span>
                          <button
                            type="button"
                            onClick={() => removeDeduction(index)}
                            className="text-red-500 hover:text-red-700 p-0.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Description (e.g. Loan Payment)"
                    value={newDedDesc}
                    onChange={e => setNewDedDesc(e.target.value)}
                    className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-850 text-[11px] outline-none"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Amount"
                    value={newDedAmt}
                    onChange={e => setNewDedAmt(e.target.value)}
                    className="w-16 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-850 text-[11px] outline-none"
                  />
                  <button
                    type="button"
                    onClick={addDeduction}
                    className="bg-red-600 hover:bg-red-700 text-white rounded-lg p-1.5 flex items-center justify-center shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Notes & Remarks</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Add custom comments or notes onto the statement..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-850 text-[12px] h-20 outline-none focus:border-indigo-500 resize-none"
                />
              </div>
            </div>

            <div className="flex-1 bg-slate-50 overflow-y-auto p-6 flex flex-col justify-between print:bg-white print:p-0">
              <div id="printable-custom-slip" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-slate-800 print:border-none print:shadow-none print:rounded-none">
                <div className="flex justify-between items-start border-b border-slate-200 pb-5 mb-5">
                  <div>
                    {logoUrl && <img src={logoUrl} alt="Logo" className="h-10 mb-2 object-contain" />}
                    <h2 className="text-md font-extrabold text-slate-800 tracking-tight">{companyName}</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Official Salary Slip</p>
                  </div>
                  <div className="text-right">
                    <div className="inline-block bg-indigo-50 border border-indigo-100 text-indigo-800 rounded-full px-2.5 py-0.5 text-[10px] font-bold">
                      Pay Period: {periodFromStr} &ndash; {periodToStr}
                    </div>
                    <p className="text-[9px] text-slate-400 mt-2 font-medium">Issue Date: {new Date(payroll.createdAt).toLocaleDateString('en-GB')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-4 mb-4 text-[11px]">
                  <div className="space-y-1.5">
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider">Employee / Agent</span>
                      <span className="font-bold text-slate-800">{payroll.agent?.name}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider">Email Address</span>
                      <span className="font-semibold text-slate-600">{email || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider">GDS Terminal System</span>
                      <span className="font-bold text-slate-800">{payroll.agent?.gdsSystem || 'None'}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider">Pseudo City Code (PCC)</span>
                      <span className="font-semibold text-slate-600">{payroll.agent?.pcc || 'None'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 mb-5 print:bg-slate-50">
                  <h5 className="text-[9px] uppercase font-black text-slate-400 tracking-wider mb-2">Attendance Summary</h5>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <span className="block text-[14px] font-black text-slate-800">{totalWorkdays}</span>
                      <span className="block text-[8px] uppercase font-bold text-slate-400 tracking-wider">Workdays</span>
                    </div>
                    <div>
                      <span className="block text-[14px] font-black text-emerald-600">{daysPresent}</span>
                      <span className="block text-[8px] uppercase font-bold text-slate-400 tracking-wider">Present</span>
                    </div>
                    <div>
                      <span className="block text-[14px] font-black text-red-650">{absents}</span>
                      <span className="block text-[8px] uppercase font-bold text-slate-400 tracking-wider">Absent</span>
                    </div>
                  </div>
                </div>

                <table className="w-full text-left border-collapse text-[11px] mb-5">
                  <thead>
                    <tr className="bg-slate-50 text-[9px] uppercase tracking-wider text-slate-400 font-bold border-t border-b border-slate-200">
                      <th className="py-2 px-3">Description</th>
                      <th className="py-2 px-3 text-right">Earnings</th>
                      <th className="py-2 px-3 text-right">Deductions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-800">Basic Contract Salary</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-800">{symbol}{basicSalaryVal.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right text-slate-350">&mdash;</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-800">Booking Commission / Margin Share</td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-600">+{symbol}{marginEarnedVal.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right text-slate-350">&mdash;</td>
                    </tr>
                    {allowances.map((item, i) => (
                      <tr key={i}>
                        <td className="py-2 px-3 font-semibold text-slate-800">{item.description}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-800">+{symbol}{Number(item.amount).toFixed(2)}</td>
                        <td className="py-2 px-3 text-right text-slate-350">&mdash;</td>
                      </tr>
                    ))}
                    {paidHolidaysCount > 0 && (
                      <tr>
                        <td className="py-2 px-3 font-semibold text-slate-800">Paid Holidays ({paidHolidaysCount} days @ {symbol}{paidHolidaysRate.toFixed(2)}/day)</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-800">+{symbol}{(paidHolidaysCount * paidHolidaysRate).toFixed(2)}</td>
                        <td className="py-2 px-3 text-right text-slate-350">&mdash;</td>
                      </tr>
                    )}
                    {publicHolidaysCount > 0 && (
                      <tr>
                        <td className="py-2 px-3 font-semibold text-slate-800">Public Holidays ({publicHolidaysCount} days @ {symbol}{publicHolidaysRate.toFixed(2)}/day)</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-800">+{symbol}{(publicHolidaysCount * publicHolidaysRate).toFixed(2)}</td>
                        <td className="py-2 px-3 text-right text-slate-350">&mdash;</td>
                      </tr>
                    )}
                    {absents > 0 && dailyRate > 0 && (
                      <tr>
                        <td className="py-2 px-3 font-semibold text-slate-800">Absenteeism Penalty ({absents} days absent @ {symbol}{dailyRate.toFixed(2)}/day)</td>
                        <td className="py-2 px-3 text-right text-slate-350">&mdash;</td>
                        <td className="py-2 px-3 text-right font-bold text-red-600">-{symbol}{absentDeduction.toFixed(2)}</td>
                      </tr>
                    )}
                    {deductions.map((item, i) => (
                      <tr key={i}>
                        <td className="py-2 px-3 font-semibold text-slate-800">{item.description}</td>
                        <td className="py-2 px-3 text-right text-slate-350">&mdash;</td>
                        <td className="py-2 px-3 text-right font-bold text-red-600">-{symbol}{Number(item.amount).toFixed(2)}</td>
                      </tr>
                    ))}

                    <tr className="bg-slate-50 font-bold border-t border-slate-200">
                      <td className="py-2 px-3 text-slate-700">Subtotals</td>
                      <td className="py-2 px-3 text-right text-slate-850">{symbol}{grossEarnings.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right text-red-650">{symbol}{totalDeductions.toFixed(2)}</td>
                    </tr>

                    <tr className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white font-bold">
                      <td className="py-3 px-4 rounded-l-xl text-[12px] border-none">Total Net Payable (Net Salary)</td>
                      <td colSpan={2} className="py-3 px-4 text-right text-[14px] text-sky-400 font-black rounded-r-xl border-none">
                        {symbol}{finalNetPay.toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {notes && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3.5 text-[10px] text-amber-900 leading-relaxed">
                    <strong>Notes & Remarks:</strong>
                    <p className="mt-0.5">{notes}</p>
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-3 print:hidden shrink-0">
                {checkingSmtp ? (
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 justify-center">
                    <div className="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                    <span>Verifying SMTP configuration...</span>
                  </div>
                ) : isCompanySmtpActive ? (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-2.5 text-[10.5px] text-emerald-800 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">SMTP Active: {smtpHost} ({smtpUser})</strong>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-2.5 text-[10.5px] text-amber-800 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">System Default SMTP Fallback</strong>
                      Configure SMTP in Dashboard settings to send branded emails from your domain.
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={onClose}
                    disabled={loading}
                    className="py-2 px-4 rounded-xl border border-slate-200 text-slate-605 text-[12px] font-bold hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePrint}
                    disabled={loading}
                    className="py-2 px-4 rounded-xl border border-slate-200 text-slate-700 bg-white text-[12px] font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Printer className="w-4 h-4" /> Print / PDF
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={loading}
                    className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[12px] font-bold shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    {loading ? 'Sending...' : 'Send Branded Email & PDF'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── View Salary Slip Modal (Printable) ───────────────────────────────────────
interface ViewSalarySlipModalProps {
  payroll: Payroll;
  onClose: () => void;
}

function ViewSalarySlipModal({ payroll, onClose }: ViewSalarySlipModalProps) {
  const { symbol } = useCurrency();
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<any>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get(`/agents/${payroll.agentId}/attendance`, {
        params: { from: payroll.periodFrom.slice(0, 10), to: payroll.periodTo.slice(0, 10) }
      }),
      api.get('/auth/tenants/profile')
    ]).then(([attRes, profileRes]) => {
      if (!active) return;
      setAttendance(attRes.data.attendance || []);
      setTenant(profileRes.data.tenant || null);
      setLoading(false);
    }).catch(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [payroll]);

  let weekdaysCount = 0;
  const curDate = new Date(payroll.periodFrom);
  const endDate = new Date(payroll.periodTo);
  while (curDate <= endDate) {
    const day = curDate.getDay();
    if (day !== 0 && day !== 6) {
      weekdaysCount++;
    }
    curDate.setDate(curDate.getDate() + 1);
  }
  const defaultTotalWorkdays = weekdaysCount || 1;

  const uniqueDays = new Set(
    attendance.map(r => new Date(r.checkIn).toLocaleDateString('en-GB'))
  );

  const isSaved = payroll.totalWorkdays !== null && payroll.totalWorkdays !== undefined;

  const totalWorkdays = isSaved ? Number(payroll.totalWorkdays) : defaultTotalWorkdays;
  const daysPresent = isSaved ? Number(payroll.daysPresent) : uniqueDays.size;
  const absents = isSaved ? Number(payroll.absents) : Math.max(0, totalWorkdays - daysPresent);

  const paidHolidaysCount = isSaved ? Number(payroll.paidHolidaysCount || 0) : 0;
  const paidHolidaysRate = isSaved ? Number(payroll.paidHolidaysRate || 0) : 0;
  const publicHolidaysCount = isSaved ? Number(payroll.publicHolidaysCount || 0) : 0;
  const publicHolidaysRate = isSaved ? Number(payroll.publicHolidaysRate || 0) : 0;

  const holidayPay = (paidHolidaysCount * paidHolidaysRate) + (publicHolidaysCount * publicHolidaysRate);

  const basicSalaryVal = Number(payroll.basicSalary);
  const marginEarnedVal = Number(payroll.totalMarginEarned);

  const defaultGdsAllowance = payroll.agent?.gdsSystem ? 120.00 : 0.00;
  const defaultTravelAllowance = 80.00;
  const defaultAllowances = [
    { description: 'Travel & Internet connectivity allowance (Amenities)', amount: defaultTravelAllowance }
  ];
  if (defaultGdsAllowance > 0) {
    defaultAllowances.push({ description: 'GDS Terminal Premium allowance (Amenities)', amount: defaultGdsAllowance });
  }

  const allowances: { description: string; amount: number }[] = isSaved && payroll.allowances
    ? (typeof payroll.allowances === 'string' ? JSON.parse(payroll.allowances) : payroll.allowances)
    : defaultAllowances;

  const totalAllowances = allowances.reduce((sum, a) => sum + Number(a.amount || 0), 0);
  const grossEarnings = basicSalaryVal + marginEarnedVal + totalAllowances + holidayPay;

  const dailyRate = totalWorkdays > 0 ? (basicSalaryVal / totalWorkdays) : 0;
  const absentDeduction = dailyRate * absents;

  const customDeductions: { description: string; amount: number }[] = isSaved && payroll.deductions
    ? (typeof payroll.deductions === 'string' ? JSON.parse(payroll.deductions) : payroll.deductions)
    : [];

  const customDeductionsVal = customDeductions.reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const totalDeductions = absentDeduction + customDeductionsVal;
  const finalNetPay = Math.max(0, grossEarnings - totalDeductions);

  const periodFromStr = new Date(payroll.periodFrom).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const periodToStr = new Date(payroll.periodTo).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const companyName = tenant?.name || 'Travel Booker';
  const logoUrl = tenant?.logo || '';

  const handlePrint = () => {
    window.print();
  };

  return (
    <motion.div
      key="view-slip-modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 overflow-y-auto"
    >
      <motion.div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm print:hidden"
        onClick={onClose}
      />
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-slip, #printable-slip * {
            visibility: visible !important;
          }
          #printable-slip {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
          }
        }
      `}</style>
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 240 }}
        className="relative z-10 bg-slate-50 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden print:bg-white print:shadow-none print:w-full print:max-w-none print:rounded-none max-h-[90vh] flex flex-col"
      >
        <div className="bg-gradient-to-r from-slate-800 to-indigo-950 px-6 py-4 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            <span className="font-extrabold text-[15px]">Official Salary Slip Overview</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={loading}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5 rotate-90" /> Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-6 flex-1 print:overflow-visible print:p-0">
          {loading ? (
            <div className="py-12"><LoadingState message="Compiling salary slip details..." /></div>
          ) : (
            <div id="printable-slip" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm print:border-none print:shadow-none print:rounded-none text-slate-800">
              <div className="flex justify-between items-start border-b border-slate-200 pb-5 mb-5">
                <div>
                  {logoUrl && <img src={logoUrl} alt="Logo" className="h-10 mb-2 object-contain" />}
                  <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">{companyName}</h2>
                  <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Official Salary Slip</p>
                </div>
                <div className="text-right">
                  <div className="inline-block bg-primary-50 border border-primary-100 text-primary-800 rounded-full px-3 py-1 text-[11px] font-bold">
                    Pay Period: {periodFromStr} &ndash; {periodToStr}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 font-medium">Issue Date: {new Date(payroll.createdAt).toLocaleDateString('en-GB')}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 border-b border-slate-100 pb-5 mb-5 text-[12px]">
                <div className="space-y-2">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Employee / Agent</span>
                    <span className="font-bold text-slate-800">{payroll.agent?.name}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Email Address</span>
                    <span className="font-semibold text-slate-600">{payroll.agent?.email || 'N/A'}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">GDS Terminal System</span>
                    <span className="font-bold text-slate-800">{payroll.agent?.gdsSystem || 'None'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Pseudo City Code (PCC)</span>
                    <span className="font-semibold text-slate-600">{payroll.agent?.pcc || 'None'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-6">
                <h3 className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider mb-3 border-b border-slate-200 pb-1.5">
                  Attendance & Calendar Summary
                </h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <span className="block text-[15px] font-extrabold text-slate-800">{totalWorkdays}</span>
                    <span className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider mt-0.5">Total Workdays</span>
                  </div>
                  <div>
                    <span className="block text-[15px] font-extrabold text-emerald-600">{daysPresent}</span>
                    <span className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider mt-0.5">Days Present</span>
                  </div>
                  <div>
                    <span className="block text-[15px] font-extrabold text-red-600">{absents}</span>
                    <span className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider mt-0.5">Days Absent</span>
                  </div>
                </div>
              </div>

              <table className="w-full text-left border-collapse text-[12px] mb-6">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400 font-bold border-t border-b border-slate-200">
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-right">Earnings</th>
                    <th className="py-2.5 px-3 text-right">Deductions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-3 px-3 font-semibold text-slate-800">Basic Contract Salary</td>
                    <td className="py-3 px-3 text-right font-bold text-slate-800">{symbol}{basicSalaryVal.toFixed(2)}</td>
                    <td className="py-3 px-3 text-right text-slate-300">&mdash;</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-3 font-semibold text-slate-800">Booking Commission / Margin Share</td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-600">+{symbol}{marginEarnedVal.toFixed(2)}</td>
                    <td className="py-3 px-3 text-right text-slate-300">&mdash;</td>
                  </tr>
                  {allowances.map((allow, idx) => (
                    <tr key={`allow-${idx}`}>
                      <td className="py-3 px-3 font-semibold text-slate-800">{allow.description}</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-800">+{symbol}{Number(allow.amount).toFixed(2)}</td>
                      <td className="py-3 px-3 text-right text-slate-300">&mdash;</td>
                    </tr>
                  ))}
                  {paidHolidaysCount > 0 && (
                    <tr>
                      <td className="py-3 px-3 font-semibold text-slate-800">Paid Holidays ({paidHolidaysCount} days @ {symbol}{paidHolidaysRate.toFixed(2)}/day)</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-800">+{symbol}{(paidHolidaysCount * paidHolidaysRate).toFixed(2)}</td>
                      <td className="py-3 px-3 text-right text-slate-300">&mdash;</td>
                    </tr>
                  )}
                  {publicHolidaysCount > 0 && (
                    <tr>
                      <td className="py-3 px-3 font-semibold text-slate-800">Public Holidays ({publicHolidaysCount} days @ {symbol}{publicHolidaysRate.toFixed(2)}/day)</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-800">+{symbol}{(publicHolidaysCount * publicHolidaysRate).toFixed(2)}</td>
                      <td className="py-3 px-3 text-right text-slate-300">&mdash;</td>
                    </tr>
                  )}

                  {absentDeduction > 0 && (
                    <tr>
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        Absenteeism Penalty ({absents} day{absents !== 1 ? 's' : ''} @ {symbol}{dailyRate.toFixed(2)}/day)
                      </td>
                      <td className="py-3 px-3 text-right text-slate-300">&mdash;</td>
                      <td className="py-3 px-3 text-right font-bold text-red-600">-{symbol}{absentDeduction.toFixed(2)}</td>
                    </tr>
                  )}
                  {customDeductions.map((ded, idx) => (
                    <tr key={`ded-${idx}`}>
                      <td className="py-3 px-3 font-semibold text-slate-800">{ded.description}</td>
                      <td className="py-3 px-3 text-right text-slate-300">&mdash;</td>
                      <td className="py-3 px-3 text-right font-bold text-red-600">-{symbol}{Number(ded.amount).toFixed(2)}</td>
                    </tr>
                  ))}

                  <tr className="bg-slate-50 font-bold border-t border-slate-200">
                    <td className="py-2.5 px-3 text-slate-700">Subtotals</td>
                    <td className="py-2.5 px-3 text-right text-slate-800">{symbol}{grossEarnings.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right text-red-600">{symbol}{totalDeductions.toFixed(2)}</td>
                  </tr>

                  <tr className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white font-bold">
                    <td className="py-3.5 px-4 rounded-l-xl text-[13px] border-none">Total Net Payable (Net Salary)</td>
                    <td colSpan={2} className="py-3.5 px-4 text-right text-[15px] text-sky-400 font-black rounded-r-xl border-none">
                      £{finalNetPay.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Notes */}
              {payroll.notes && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-[11px] text-amber-900 leading-relaxed">
                  <strong>Notes & Remarks:</strong>
                  <p className="mt-1">{payroll.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
