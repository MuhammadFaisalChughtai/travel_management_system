import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard,
  Search,
  Plus,
  Edit3,
  Trash2,
  X,
  Check,
  AlertCircle,
  Wallet,
  Clock,
  Loader2,
  ChevronRight,
  Upload,
  Receipt,
  Bell,
  Eye,
} from "lucide-react";
import { api } from "../api/axios";
import toast from "react-hot-toast";
import { useAuthStore } from "../store/authStore";
import { useCurrency } from "../utils/currency";
import { EmptyState } from "../components/shared/EmptyState";
import { LoadingState } from "../components/shared/LoadingState";
import { Pagination } from "../components/shared/Pagination";
import { VendorReconciliationModal } from "../components/finance/VendorReconciliationModal";
import { formatPendingNotes } from "../components/Layout";

export function FinancePage({
  bookings,
  onRefresh,
}: {
  bookings: any[];
  onRefresh: () => void;
}) {
  const { symbol, format } = useCurrency();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<
    | "ledger"
    | "vendor-wallet"
    | "agent-wallet"
    | "approval-requests"
    | "company-expenses"
  >("ledger");
  const [showAddModal, setShowAddModal] = useState(false);

  // Company Expenses State
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any | null>(null);

  // Expense fields form state
  const [expenseName, setExpenseName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseType, setExpenseType] = useState("one-time"); // 'one-time' | 'recurring'
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [expenseNotes, setExpenseNotes] = useState("");
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);

  const [ledgerTransactions, setLedgerTransactions] = useState<any[]>([]);
  const [ledgerAccounts, setLedgerAccounts] = useState<any[]>([]);

  const [editingPayment, setEditingPayment] = useState<any | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<any | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Approval requests state
  const [approvalPayments, setApprovalPayments] = useState<any[]>([]);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvalPage, setApprovalPage] = useState(1);
  const approvalPerPage = 10;
  const [activeApproval, setActiveApproval] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  // Vendor wallets state
  const [vendorWallets, setVendorWallets] = useState<any[]>([]);
  const [vendorWalletsLoading, setVendorWalletsLoading] = useState(false);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);

  // Wallet history states
  const [selectedVendor, setSelectedVendor] = useState<any | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);
  const [walletHistory, setWalletHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchVendorHistory = async (vendorName: string) => {
    try {
      setLoadingHistory(true);
      const res = await api.get(
        `/ledger/report?vendorName=${encodeURIComponent(vendorName)}`,
      );
      const rawTxns = res.data.transactions || [];
      const walletTxns = rawTxns.filter((t: any) => {
        const desc = (t.description || "").toLowerCase();
        return (
          desc.includes("overpayment") ||
          desc.includes("wallet credit") ||
          desc.includes("prepayment") ||
          desc.includes("drawdown")
        );
      });
      setWalletHistory(walletTxns);
    } catch (err) {
      toast.error("Failed to load wallet history");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleVendorClick = (w: any) => {
    setSelectedVendor(w);
    setSelectedAgent(null);
    fetchVendorHistory(w.vendorName);
  };

  const handleAgentClick = (a: any) => {
    setSelectedAgent(a);
    setSelectedVendor(null);
    const sortedTrxs = [...(a.wallet?.transactions || [])].sort(
      (t1: any, t2: any) =>
        new Date(t1.createdAt).getTime() - new Date(t2.createdAt).getTime(),
    );
    setWalletHistory(sortedTrxs);
  };

  const handleCloseDrawer = () => {
    setSelectedVendor(null);
    setSelectedAgent(null);
    setWalletHistory([]);
  };

  const fetchVendorWallets = async () => {
    try {
      setVendorWalletsLoading(true);
      const res = await api.get("/finance/vendors/wallets");
      setVendorWallets(res.data.wallets || []);
    } catch (err) {
      toast.error("Failed to load vendor wallets");
    } finally {
      setVendorWalletsLoading(false);
    }
  };

  const fetchAgents = async () => {
    try {
      setAgentsLoading(true);
      const res = await api.get("/agents");
      setAgents(res.data.agents || []);
    } catch (err) {
      console.error(err);
    } finally {
      setAgentsLoading(false);
    }
  };

  const fetchApprovalPayments = async () => {
    try {
      setApprovalLoading(true);
      const qs = search
        ? `?search=${encodeURIComponent(search)}&limit=100`
        : "?limit=100";
      const res = await api.get(`/finance/payments${qs}`);
      setApprovalPayments(res.data.payments || []);
    } catch (err) {
      console.error("Failed to fetch approval payments:", err);
    } finally {
      setApprovalLoading(false);
    }
  };

  const handleApprove = async (paymentId: number) => {
    setSubmitting(true);
    try {
      await api.post(`/finance/payments/${paymentId}/approve`);
      toast.success("Transaction approved successfully");
      setActiveApproval(null);
      fetchApprovalPayments();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error(err);
      toast.error(
        err.response?.data?.message || "Failed to approve transaction",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (paymentId: number) => {
    setSubmitting(true);
    try {
      await api.post(`/finance/payments/${paymentId}/reject`);
      toast.success("Transaction rejected successfully");
      setActiveApproval(null);
      fetchApprovalPayments();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error(err);
      toast.error(
        err.response?.data?.message || "Failed to reject transaction",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const fetchExpenses = async () => {
    try {
      setExpensesLoading(true);
      const res = await api.get("/finance/expenses");
      setExpenses(res.data.expenses || []);
    } catch (err) {
      toast.error("Failed to load company expenses");
    } finally {
      setExpensesLoading(false);
    }
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseName || !expenseAmount || !expenseType || !expenseDate) {
      toast.error("Please fill in all required fields");
      return;
    }
    try {
      setExpenseSubmitting(true);
      const payload = {
        name: expenseName,
        amount: parseFloat(expenseAmount),
        type: expenseType,
        date: expenseDate,
        notes: expenseNotes,
      };

      if (editingExpense) {
        await api.put(`/finance/expenses/${editingExpense.id}`, payload);
        toast.success("Expense updated successfully");
      } else {
        await api.post("/finance/expenses", payload);
        toast.success("Expense recorded successfully");
      }

      setShowAddExpenseModal(false);
      setEditingExpense(null);
      setExpenseName("");
      setExpenseAmount("");
      setExpenseType("one-time");
      setExpenseDate(new Date().toISOString().split("T")[0]);
      setExpenseNotes("");
      fetchExpenses();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to save expense");
    } finally {
      setExpenseSubmitting(false);
    }
  };

  const handleOpenEditExpense = (exp: any) => {
    setEditingExpense(exp);
    setExpenseName(exp.name);
    setExpenseAmount(String(exp.amount));
    setExpenseType(exp.type);
    setExpenseDate(new Date(exp.date).toISOString().split("T")[0]);
    setExpenseNotes(exp.notes || "");
    setShowAddExpenseModal(true);
  };

  useEffect(() => {
    if (activeTab === "ledger") {
      fetchLedgerReport();
    } else if (activeTab === "vendor-wallet") {
      fetchVendorWallets();
    } else if (activeTab === "agent-wallet") {
      fetchAgents();
    } else if (activeTab === "approval-requests") {
      fetchApprovalPayments();
    } else if (activeTab === "company-expenses") {
      fetchExpenses();
    }
  }, [activeTab, search]);

  useEffect(() => {
    setApprovalPage(1);
  }, [approvalPayments]);

  const filteredVendorWallets = useMemo(() => {
    return vendorWallets.filter(
      (w) =>
        !search || w.vendorName.toLowerCase().includes(search.toLowerCase()),
    );
  }, [vendorWallets, search]);

  const filteredAgents = useMemo(() => {
    return agents.filter(
      (a) => !search || a.name.toLowerCase().includes(search.toLowerCase()),
    );
  }, [agents, search]);

  const handleDelete = async () => {
    if (!deletingPayment) return;
    setActionLoading(true);
    try {
      const type = deletingPayment.isVendor ? "vendor-payment" : "payment";
      await api.delete(
        `/bookings/${deletingPayment.bookingId}/services/${type}/${deletingPayment.id}`,
      );
      toast.success("Payment deleted successfully");
      setDeletingPayment(null);
      fetchLedgerReport();
      onRefresh();
    } catch (err) {
      toast.error("Failed to delete payment");
    } finally {
      setActionLoading(false);
    }
  };

  const [ledgerFilters, setLedgerFilters] = useState({
    dateStart: new Date(new Date().setDate(new Date().getDate() - 10))
      .toISOString()
      .split("T")[0],
    dateEnd: "",
    agentName: "",
    vendorName: "",
    reference: "",
  });

  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    api
      .get("/agents")
      .then((res) => setAgents(res.data.agents || []))
      .catch(console.error);
    api
      .get("/vendors")
      .then((res) => setVendors(res.data.vendors || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([]);
      return;
    }
    const delayDebounceFn = setTimeout(() => {
      setIsSearching(true);
      api
        .get(`/bookings/search?q=${searchQuery}`)
        .then((res) => {
          setSearchResults(res.data.bookings || []);
        })
        .finally(() => setIsSearching(false));
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const fetchLedgerReport = async (filtersOverride?: any) => {
    try {
      setLedgerLoading(true);
      const params = new URLSearchParams();
      const currentFilters = filtersOverride || ledgerFilters;
      if (currentFilters.dateStart)
        params.append("dateStart", currentFilters.dateStart);
      if (currentFilters.dateEnd)
        params.append("dateEnd", currentFilters.dateEnd);
      if (currentFilters.agentName)
        params.append("agentName", currentFilters.agentName);
      if (currentFilters.vendorName)
        params.append("vendorName", currentFilters.vendorName);
      if (currentFilters.reference)
        params.append("reference", currentFilters.reference);

      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await api.get(`/ledger/report${qs}`);
      setLedgerTransactions(res.data.transactions || []);
      setLedgerAccounts(res.data.accounts || []);
    } catch (err) {
      console.error("Failed to fetch ledger report", err);
    } finally {
      setLedgerLoading(false);
    }
  };

  const activeFiltersCount = Object.values(ledgerFilters).filter(
    (v) => v !== "",
  ).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-emerald-500" /> Global Finance
            Ledger
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Comprehensive chronological registry of all corporate payment
            operations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowVendorModal(true)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-4.5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 transition-all active:scale-95"
          >
            <Plus className="h-4 w-4" /> Record Vendor Payment
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap bg-white rounded-xl border border-slate-200 p-1 shadow-sm gap-y-1">
          <button
            onClick={() => setActiveTab("ledger")}
            className={`px-6 py-2 rounded-lg text-[13px] font-bold transition-all ${activeTab === "ledger" ? "bg-amber-50 text-amber-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Ledger Report
          </button>
          <button
            onClick={() => setActiveTab("approval-requests")}
            className={`px-6 py-2 rounded-lg text-[13px] font-bold transition-all ${activeTab === "approval-requests" ? "bg-violet-50 text-violet-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Approval Requests
          </button>
          <button
            onClick={() => setActiveTab("vendor-wallet")}
            className={`px-6 py-2 rounded-lg text-[13px] font-bold transition-all ${activeTab === "vendor-wallet" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Vendor Wallets
          </button>
          <button
            onClick={() => setActiveTab("agent-wallet")}
            className={`px-6 py-2 rounded-lg text-[13px] font-bold transition-all ${activeTab === "agent-wallet" ? "bg-emerald-50 text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Agent Wallets
          </button>
          <button
            onClick={() => setActiveTab("company-expenses")}
            className={`px-6 py-2 rounded-lg text-[13px] font-bold transition-all ${activeTab === "company-expenses" ? "bg-rose-50 text-rose-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Company Expenses
          </button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {activeTab === "ledger" && (
            <button
              onClick={() => setShowFiltersModal(true)}
              className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm flex items-center gap-2 transition-all"
            >
              <Search className="w-4 h-4" />
              Advanced Filters
              {activeFiltersCount > 0 && (
                <span className="bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-md text-[10px] font-black ml-1">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          )}
          {activeTab !== "ledger" && (
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={
                  activeTab === "approval-requests"
                    ? "Search reference or notes..."
                    : "Search by name..."
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
              />
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showFiltersModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFiltersModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg relative z-10 overflow-visible flex flex-col rounded-2xl shadow-2xl"
            >
              <div className="absolute inset-0 bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl overflow-hidden -z-10 pointer-events-none"></div>
              <div className="bg-gradient-to-r from-primary-900 to-indigo-900 text-white px-6 py-4 flex justify-between items-center shadow-inner rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="text-indigo-300">
                    <Search className="w-4 h-4" />
                  </div>
                  <h2 className="font-bold text-[14px] tracking-wide uppercase">
                    Ledger Filters
                  </h2>
                </div>
                <button
                  onClick={() => setShowFiltersModal(false)}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={ledgerFilters.dateStart}
                      onChange={(e) =>
                        setLedgerFilters((prev) => ({
                          ...prev,
                          dateStart: e.target.value,
                        }))
                      }
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={ledgerFilters.dateEnd}
                      onChange={(e) =>
                        setLedgerFilters((prev) => ({
                          ...prev,
                          dateEnd: e.target.value,
                        }))
                      }
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Agent Name
                  </label>
                  <select
                    value={ledgerFilters.agentName}
                    onChange={(e) =>
                      setLedgerFilters((prev) => ({
                        ...prev,
                        agentName: e.target.value,
                      }))
                    }
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="">All Agents</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.name}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Vendor Name
                  </label>
                  <select
                    value={ledgerFilters.vendorName}
                    onChange={(e) =>
                      setLedgerFilters((prev) => ({
                        ...prev,
                        vendorName: e.target.value,
                      }))
                    }
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="">All Vendors</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.name}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="relative">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Invoice / PNR / Ticket Number
                  </label>
                  <input
                    type="text"
                    placeholder="Search bookings by reference, PNR..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowDropdown(true);
                      setLedgerFilters((prev) => ({
                        ...prev,
                        reference: e.target.value,
                      }));
                    }}
                    onFocus={() => setShowDropdown(true)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-9">
                      <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                  {showDropdown && searchResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-[160px] overflow-y-auto">
                      {searchResults.map((b) => (
                        <div
                          key={b.id}
                          onClick={() => {
                            setLedgerFilters((prev) => ({
                              ...prev,
                              reference: b.bookingReference,
                            }));
                            setSearchQuery(b.bookingReference);
                            setShowDropdown(false);
                          }}
                          className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                        >
                          <div className="font-bold text-slate-800 text-[13px]">
                            {b.bookingReference}
                          </div>
                          <div className="flex justify-between items-center text-[11px] text-slate-500 mt-0.5">
                            <span>
                              {b.customers?.length > 0
                                ? `${b.customers[0].firstName} ${b.customers[0].lastName}`
                                : "No Passenger"}
                            </span>
                            {b.agentName && (
                              <span className="font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                                {b.agentName}
                              </span>
                            )}
                          </div>
                          {b.flightServices?.length > 0 &&
                            b.flightServices[0]?.pnr && (
                              <div className="text-[10px] font-mono text-slate-400 mt-1 uppercase">
                                PNR:{" "}
                                {b.flightServices
                                  .map((fs: any) => fs.pnr)
                                  .filter(Boolean)
                                  .join(", ")}
                              </div>
                            )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-between items-center rounded-b-2xl">
                <button
                  onClick={() => {
                    const blank = {
                      dateStart: new Date(
                        new Date().setDate(new Date().getDate() - 10),
                      )
                        .toISOString()
                        .split("T")[0],
                      dateEnd: "",
                      agentName: "",
                      vendorName: "",
                      reference: "",
                    };
                    setLedgerFilters(blank);
                    fetchLedgerReport(blank);
                  }}
                  className="px-4 py-2 text-rose-600 font-bold text-[13px] hover:bg-rose-50 rounded-lg transition-colors"
                >
                  Clear All
                </button>
                <button
                  onClick={() => {
                    fetchLedgerReport();
                    setShowFiltersModal(false);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl text-[13px] font-bold shadow-md transition-all"
                >
                  Apply Filters
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {activeTab === "ledger" &&
        (ledgerLoading ? (
          <LoadingState message="Loading ledger records..." />
        ) : ledgerTransactions.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No ledger records"
            description="No double-entry accounting records matched your filters."
            size="sm"
            transparent={true}
          />
        ) : (
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden text-[13px]">
            <div className="text-[11px]">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-400 font-bold uppercase border-b border-slate-100">
                      <th className="py-3 px-5">Reference</th>
                      <th className="py-3 px-5">Type</th>
                      <th className="py-3 px-5">Date</th>
                      <th className="py-3 px-5 text-right">Debit</th>
                      <th className="py-3 px-5 text-right">Credit</th>
                      <th className="py-3 px-5">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-600 font-medium">
                    {ledgerTransactions.map((txn) => {
                      const debit =
                        txn.entries?.reduce(
                          (sum: number, e: any) =>
                            sum + parseFloat(e.debitAmount),
                          0,
                        ) || 0;
                      const credit =
                        txn.entries?.reduce(
                          (sum: number, e: any) =>
                            sum + parseFloat(e.creditAmount),
                          0,
                        ) || 0;

                      const dateObj = new Date(txn.transactionDate);
                      const formattedDate = `${dateObj.getDate().toString().padStart(2, "0")}/${dateObj.toLocaleString("en-GB", { month: "short" })}/${dateObj.getFullYear()} ${dateObj.getHours().toString().padStart(2, "0")}:${dateObj.getMinutes().toString().padStart(2, "0")}`;

                      return (
                        <tr
                          key={txn.id}
                          className="hover:bg-slate-50/80 transition-colors"
                        >
                          <td className="py-3 px-5 align-top font-bold text-slate-900 text-[12px]">
                            {txn.referenceNumber}
                          </td>
                          <td className="py-3 px-5 align-top">
                            <div className="flex flex-col gap-1 items-start">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                                  txn.type === "PAYMENT"
                                    ? "bg-indigo-100 text-indigo-700"
                                    : txn.type === "FEE"
                                      ? "bg-rose-100 text-rose-700"
                                      : txn.type === "REFUND"
                                        ? "bg-amber-100 text-amber-700"
                                        : txn.type === "DISCOUNT"
                                          ? "bg-cyan-100 text-cyan-700"
                                          : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {txn.type}
                              </span>
                              {txn.type === "PAYMENT" && (
                                <span
                                  className={`inline-block px-1.5 py-0.2 rounded text-[8px] font-extrabold tracking-wide uppercase ${
                                    txn.status === "pending"
                                      ? "bg-amber-50 text-amber-600 border border-amber-100/50"
                                      : txn.status === "rejected"
                                        ? "bg-rose-50 text-rose-600 border border-rose-100/50"
                                        : "bg-emerald-50 text-emerald-600 border border-emerald-100/50"
                                  }`}
                                >
                                  {txn.status || "approved"}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-5 align-top text-slate-600 font-semibold text-[12px]">
                            {formattedDate}
                          </td>
                          <td className="py-3 px-5 align-top text-right font-black text-rose-600 text-[12px]">
                            {debit > 0 ? format(debit) : "-"}
                          </td>
                          <td className="py-3 px-5 align-top text-right font-black text-emerald-600 text-[12px]">
                            {credit > 0 ? format(credit) : "-"}
                          </td>
                          <td className="py-3 px-5 align-top whitespace-pre-wrap leading-relaxed text-[11px] text-slate-500 font-medium">
                            <div className="flex flex-col gap-1">
                              <div>
                                {txn.description}
                                {txn.loggedByName && (
                                  <span className="text-[10px] text-slate-400 font-bold ml-1.5">
                                    ({txn.loggedByName})
                                  </span>
                                )}
                              </div>
                              {txn.allocations?.length > 0 && (
                                <div className="mt-1 text-slate-400 font-bold flex flex-wrap items-center gap-1">
                                  <span>
                                    Allocated to {txn.allocations.length}{" "}
                                    service(s) on booking(s):
                                  </span>
                                  <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md font-extrabold text-[10px]">
                                    {Array.from(
                                      new Set(
                                        txn.allocations.map(
                                          (a: any) =>
                                            a.bookingRef ||
                                            `BKG-${a.bookingId}`,
                                        ),
                                      ),
                                    ).join(", ")}
                                  </span>
                                </div>
                              )}
                              {txn.evidenceUrl && (
                                <div className="mt-1.5 flex">
                                  <a
                                    href={txn.evidenceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[9px] font-extrabold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-lg border border-indigo-100/50 transition-colors"
                                  >
                                    <Receipt className="w-3 h-3 text-indigo-500" />{" "}
                                    Receipt Screenshot
                                  </a>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {(() => {
                      const totalDebit = ledgerTransactions.reduce(
                        (acc, txn) =>
                          acc +
                          (txn.entries?.reduce(
                            (sum: number, e: any) =>
                              sum + parseFloat(e.debitAmount),
                            0,
                          ) || 0),
                        0,
                      );
                      const totalCredit = ledgerTransactions.reduce(
                        (acc, txn) =>
                          acc +
                          (txn.entries?.reduce(
                            (sum: number, e: any) =>
                              sum + parseFloat(e.creditAmount),
                            0,
                          ) || 0),
                        0,
                      );

                      const closingBalanceVal = ledgerAccounts.reduce(
                        (sum, a) => sum + parseFloat(a.balance),
                        0,
                      );
                      const closingDebit =
                        closingBalanceVal > 0 ? closingBalanceVal : 0;
                      const closingCredit =
                        closingBalanceVal < 0 ? Math.abs(closingBalanceVal) : 0;

                      return (
                        <>
                          <tr className="bg-slate-100/50 border-t-2 border-slate-200">
                            <td className="py-4 px-5"></td>
                            <td
                              className="py-4 px-5 font-black text-slate-700 text-right uppercase tracking-wider text-[11px]"
                              colSpan={2}
                            >
                              Period Total
                            </td>
                            <td className="py-4 px-5 text-right font-black text-rose-600 text-[13px]">
                              {totalDebit > 0 ? format(totalDebit) : "-"}
                            </td>
                            <td className="py-4 px-5 text-right font-black text-emerald-600 text-[13px]">
                              {totalCredit > 0 ? format(totalCredit) : "-"}
                            </td>
                            <td className="py-4 px-5"></td>
                          </tr>
                          <tr className="bg-white border-b-4 border-emerald-500 rounded-b-3xl">
                            <td className="py-4 px-5"></td>
                            <td
                              className="py-4 px-5 font-black text-slate-900 text-right uppercase tracking-wider text-[12px]"
                              colSpan={2}
                            >
                              Closing Ledger Balance
                            </td>
                            <td className="py-4 px-5 text-right font-black text-rose-600 text-[13px]">
                              {closingDebit > 0 ? format(closingDebit) : "-"}
                            </td>
                            <td className="py-4 px-5 text-right font-black text-emerald-600 text-[13px]">
                              {closingCredit > 0 ? format(closingCredit) : "-"}
                            </td>
                            <td className="py-4 px-5"></td>
                          </tr>
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}

      {activeTab === "vendor-wallet" &&
        (vendorWalletsLoading ? (
          <LoadingState message="Loading vendor wallets..." />
        ) : filteredVendorWallets.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No vendor wallets"
            description="No vendor wallets found matching your search."
            size="sm"
            transparent={true}
          />
        ) : (
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden text-[13px]">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-4 px-6">Vendor Name</th>
                    <th className="py-4 px-6 text-right">Ledger Balance</th>
                    <th className="py-4 px-6 text-right">
                      Available Floating Credit
                    </th>
                    <th className="py-4 px-6 text-right">Status</th>
                    <th className="py-4 px-6 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredVendorWallets.map((w) => (
                    <tr
                      key={w.id || w.vendorName}
                      onClick={() => handleVendorClick(w)}
                      className="hover:bg-slate-50/70 cursor-pointer transition-colors"
                    >
                      <td className="py-4 px-6 font-bold text-slate-900 flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-slate-400 shrink-0" />
                        {w.vendorName}
                      </td>
                      <td className="py-4 px-6 text-right font-semibold text-slate-600">
                        {format(w.ledgerBalance)}
                      </td>
                      <td className="py-4 px-6 text-right font-black text-emerald-600">
                        {w.walletBalance > 0 ? format(w.walletBalance) : "-"}
                      </td>
                      <td className="py-4 px-6 text-right font-bold">
                        {w.walletBalance > 0 ? (
                          <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-[11px] border border-emerald-100">
                            Floating Credit
                          </span>
                        ) : w.ledgerBalance < 0 ? (
                          <span className="bg-rose-50 text-rose-700 px-2.5 py-1 rounded-full text-[11px] border border-rose-100">
                            Owe Vendor
                          </span>
                        ) : (
                          <span className="bg-slate-50 text-slate-500 px-2.5 py-1 rounded-full text-[11px] border border-slate-100">
                            Settled
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-slate-400 text-center w-10">
                        <ChevronRight className="w-4 h-4 inline" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

      {activeTab === "agent-wallet" &&
        (agentsLoading ? (
          <LoadingState message="Loading agent wallets..." />
        ) : filteredAgents.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No agent wallets"
            description="No agent wallets found matching your search."
            size="sm"
            transparent={true}
          />
        ) : (
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden text-[13px]">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-4 px-6">Agent Name</th>
                    <th className="py-4 px-6 text-right">Wallet Balance</th>
                    <th className="py-4 px-6 text-right">Status</th>
                    <th className="py-4 px-6 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredAgents.map((a) => {
                    const balance = parseFloat(a.wallet?.currentBalance || 0);
                    return (
                      <tr
                        key={a.id}
                        onClick={() => handleAgentClick(a)}
                        className="hover:bg-slate-50/70 cursor-pointer transition-colors"
                      >
                        <td className="py-4 px-6 font-bold text-slate-900 flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-slate-400 shrink-0" />
                          {a.name}
                        </td>
                        <td
                          className={`py-4 px-6 text-right font-black ${balance >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                        >
                          {format(balance)}
                        </td>
                        <td className="py-4 px-6 text-right font-bold">
                          {balance > 0 ? (
                            <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-[11px] border border-emerald-100">
                              Credit Balance
                            </span>
                          ) : balance < 0 ? (
                            <span className="bg-rose-50 text-rose-700 px-2.5 py-1 rounded-full text-[11px] border border-rose-100">
                              Receivable (Debt)
                            </span>
                          ) : (
                            <span className="bg-slate-50 text-slate-500 px-2.5 py-1 rounded-full text-[11px] border border-slate-100">
                              Zero Balance
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-slate-400 text-center w-10">
                          <ChevronRight className="w-4 h-4 inline" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}

      {activeTab === "approval-requests" &&
        (approvalLoading ? (
          <LoadingState message="Loading approval requests..." />
        ) : approvalPayments.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No approval requests"
            description="There are no transaction log approval requests."
            size="sm"
            transparent={true}
          />
        ) : (
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden text-[13px]">
            <div className="text-[11px]">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-4 px-6">Booking Ref</th>
                      <th className="py-4 px-6">Amount</th>
                      <th className="py-4 px-6">Method / Type</th>
                      <th className="py-4 px-6">Logged By</th>
                      <th className="py-4 px-6">Date</th>
                      <th className="py-4 px-6 text-center">Status</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {approvalPayments
                      .slice(
                        (approvalPage - 1) * approvalPerPage,
                        approvalPage * approvalPerPage,
                      )
                      .map((p) => {
                        const dateObj = new Date(p.paidOn);
                        const formattedDate = `${dateObj.getDate().toString().padStart(2, "0")}/${dateObj.toLocaleString("en-GB", { month: "short" })}/${dateObj.getFullYear()} ${dateObj.getHours().toString().padStart(2, "0")}:${dateObj.getMinutes().toString().padStart(2, "0")}`;

                        return (
                          <tr
                            key={p.id}
                            className="hover:bg-slate-50/70 transition-colors"
                          >
                            <td className="py-4 px-6 font-bold text-slate-900 text-[12px]">
                              {p.bookingRef || "N/A"}
                            </td>
                            <td className="py-4 px-6 font-black text-slate-900 text-[12px]">
                              {format(p.amount)}
                            </td>
                            <td className="py-4 px-6 text-slate-800 font-semibold">
                              {p.paymentMethod} • {p.paymentType}
                            </td>
                            <td className="py-4 px-6">
                              <span className="font-bold text-slate-800">
                                {p.loggedByName || "Agent"}
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold ml-1.5 bg-slate-100 px-1.5 py-0.5 rounded">
                                {p.loggedByRole || "AGENT"}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-slate-500 font-semibold">
                              {formattedDate}
                            </td>
                            <td className="py-4 px-6 text-center">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide border ${
                                  p.status === "approved"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                    : p.status === "rejected"
                                      ? "bg-rose-50 text-rose-700 border-rose-100"
                                      : "bg-amber-50 text-amber-700 border-amber-100"
                                }`}
                              >
                                {p.status || "pending"}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-right">
                              <button
                                onClick={() =>
                                  setActiveApproval({ payment: p })
                                }
                                className="inline-flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-sm transition-all active:scale-95 uppercase tracking-wider"
                              >
                                Review
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
              {approvalPayments.length > 0 && (
                <Pagination
                  currentPage={approvalPage}
                  totalPages={Math.ceil(
                    approvalPayments.length / approvalPerPage,
                  )}
                  onPageChange={setApprovalPage}
                  itemsPerPage={approvalPerPage}
                  totalItems={approvalPayments.length}
                />
              )}
            </div>
          </div>
        ))}

      {activeTab === "company-expenses" &&
        (expensesLoading ? (
          <LoadingState message="Loading company expenses..." />
        ) : (
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden text-[13px]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-900">
                Registered Corporate Expenses
              </h3>
              <button
                onClick={() => {
                  setEditingExpense(null);
                  setExpenseName("");
                  setExpenseAmount("");
                  setExpenseType("one-time");
                  setExpenseDate(new Date().toISOString().split("T")[0]);
                  setExpenseNotes("");
                  setShowAddExpenseModal(true);
                }}
                className="flex items-center gap-1 bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-sm transition-all animate-fade-in"
              >
                <Plus className="w-3.5 h-3.5" /> Record Expense
              </button>
            </div>

            {expenses.length === 0 ? (
              <EmptyState
                icon={CreditCard}
                title="No expenses recorded"
                description="Use the button above to register your first corporate expense."
                size="sm"
                transparent={true}
              />
            ) : (
              <div className="overflow-x-auto text-[11px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-4 px-6">Expense Name</th>
                      <th className="py-4 px-6 text-right">Amount</th>
                      <th className="py-4 px-6">Type</th>
                      <th className="py-4 px-6">Start / Occur Date</th>
                      <th className="py-4 px-6">Notes</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {expenses.map((exp) => (
                      <tr
                        key={exp.id}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        <td className="py-4 px-6 font-bold text-slate-900 text-[12px]">
                          {exp.name}
                        </td>
                        <td className="py-4 px-6 font-black text-rose-600 text-[12px] text-right">
                          {format(exp.amount)}
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide border ${
                              exp.type === "recurring"
                                ? "bg-rose-50 text-rose-700 border-rose-100"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            {exp.type === "recurring"
                              ? "Recurring Monthly"
                              : "One-Time"}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-slate-500 font-semibold">
                          {new Date(exp.date).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-6 text-slate-500 italic max-w-xs truncate">
                          {exp.notes || "No description"}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleOpenEditExpense(exp)}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
                              title="Edit Expense"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeletingExpense(exp)}
                              className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 hover:text-red-700 transition-colors"
                              title="Delete Expense"
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
            )}
          </div>
        ))}

      <AnimatePresence>
        {activeApproval && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveApproval(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Dynamic Header color and text based on status */}
              {(() => {
                const status = activeApproval.payment?.status;
                let bgClass = "from-amber-600 to-amber-700";
                let iconColor = "text-amber-200";
                let headerText = "Review Transaction Log";
                let subText = "Pending approval request submitted by Agent";
                let Icon = Bell;
                let animateClass = "animate-bounce";

                if (status === "approved") {
                  bgClass = "from-emerald-600 to-emerald-700";
                  iconColor = "text-emerald-200";
                  headerText = "Transaction Approved ✓";
                  subText =
                    "This transaction has been successfully processed and logged to ledger";
                  Icon = Check;
                  animateClass = "";
                } else if (status === "rejected") {
                  bgClass = "from-red-600 to-red-700";
                  iconColor = "text-red-200";
                  headerText = "Transaction Rejected ✗";
                  subText = "This transaction request has been rejected";
                  Icon = X;
                  animateClass = "";
                }

                return (
                  <div
                    className={`bg-gradient-to-r ${bgClass} text-white px-6 py-4 flex justify-between items-center shadow-inner shrink-0 transition-all duration-300`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={`w-5 h-5 ${iconColor} ${animateClass}`}
                      />
                      <div>
                        <h3 className="font-extrabold text-white text-sm tracking-wide uppercase leading-none">
                          {headerText}
                        </h3>
                        <p
                          className={`${status === "approved" ? "text-emerald-100" : status === "rejected" ? "text-red-100" : "text-amber-100"} text-[10px] mt-1 font-normal`}
                        >
                          {subText}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveApproval(null)}
                      className="text-white/60 hover:text-white transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                );
              })()}

              <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-white/50 text-xs">
                <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-100 rounded-2xl p-4 font-semibold text-slate-600">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                      Booking Reference
                    </span>
                    <span className="text-slate-800 font-mono text-sm bg-white border border-slate-100 px-2 py-0.5 rounded">
                      {activeApproval.payment?.bookingRef ||
                        activeApproval.payment?.booking?.bookingReference ||
                        "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                      Payment Amount
                    </span>
                    <span className="text-slate-900 font-bold text-base">
                      {format(activeApproval.payment?.amount)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                      Payment Method / Type
                    </span>
                    <span className="text-slate-800">
                      {activeApproval.payment?.paymentMethod} •{" "}
                      {activeApproval.payment?.paymentType}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                      Logged By
                    </span>
                    <span className="text-slate-800 font-bold">
                      {activeApproval.payment?.loggedByName || "Agent"} (
                      {activeApproval.payment?.loggedByRole})
                    </span>
                  </div>
                  {activeApproval.payment?.status && (
                    <div className="col-span-2 border-t border-slate-100 pt-3">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                        Approval Status
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                          activeApproval.payment.status === "approved"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            : activeApproval.payment.status === "rejected"
                              ? "bg-red-50 text-red-700 border border-red-100"
                              : "bg-amber-50 text-amber-700 border border-amber-100"
                        }`}
                      >
                        {activeApproval.payment.status === "approved" && (
                          <Check className="w-3 h-3 text-emerald-600" />
                        )}
                        {activeApproval.payment.status === "rejected" && (
                          <X className="w-3 h-3 text-red-600" />
                        )}
                        {activeApproval.payment.status === "pending" && (
                          <Clock className="w-3 h-3 text-amber-500 animate-spin" />
                        )}
                        {activeApproval.payment.status}
                      </span>
                    </div>
                  )}
                  <div className="col-span-2 border-t border-slate-100 pt-3">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                      Notes / Description
                    </span>
                    <p className="text-slate-700 italic font-medium">
                      {formatPendingNotes(activeApproval.payment?.notes)}
                    </p>
                  </div>
                </div>

                {activeApproval.payment?.evidenceUrl && (
                  <div className="space-y-2">
                    <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wide">
                      Bank Transaction Evidence
                    </span>
                    <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-slate-50 flex items-center justify-center max-h-60 relative group shadow-sm">
                      <img
                        src={activeApproval.payment.evidenceUrl}
                        alt="Bank evidence"
                        className="object-contain max-h-60 w-full hover:scale-[1.02] transition-transform duration-300"
                      />
                      <a
                        href={activeApproval.payment.evidenceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute bottom-3 right-3 bg-slate-900/80 hover:bg-slate-900 text-white p-2 rounded-xl flex items-center gap-1.5 shadow backdrop-blur-xs text-[10px] font-bold transition-all hover:scale-105 active:scale-95"
                      >
                        <Eye className="w-3.5 h-3.5" /> Full Size
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <div
                className={`bg-slate-50 border-t border-slate-200/60 p-4 shrink-0 flex items-center gap-3 ${
                  activeApproval.payment?.status === "approved" ||
                  activeApproval.payment?.status === "rejected"
                    ? "justify-end"
                    : "justify-between"
                }`}
              >
                {activeApproval.payment?.status !== "approved" &&
                  activeApproval.payment?.status !== "rejected" && (
                    <button
                      onClick={() => handleReject(activeApproval.payment.id)}
                      disabled={submitting}
                      className="px-5 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-[11px] font-bold uppercase tracking-wider disabled:opacity-50 transition-colors"
                    >
                      Reject & Log
                    </button>
                  )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveApproval(null)}
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-[11px] font-bold"
                  >
                    Cancel
                  </button>
                  {activeApproval.payment?.status !== "approved" &&
                    activeApproval.payment?.status !== "rejected" && (
                      <button
                        onClick={() => handleApprove(activeApproval.payment.id)}
                        disabled={submitting}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl text-[11px] font-bold shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 uppercase tracking-wider disabled:opacity-50 transition-all hover:-translate-y-0.5 active:translate-y-0"
                      >
                        {submitting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        Approve Log
                      </button>
                    )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
        {showAddExpenseModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddExpenseModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md relative z-10 overflow-hidden flex flex-col animate-scale-up"
            >
              <div className="bg-gradient-to-r from-rose-600 to-rose-700 text-white px-6 py-4 flex justify-between items-center shadow-inner shrink-0">
                <h3 className="font-extrabold text-white text-sm tracking-wide uppercase leading-none">
                  {editingExpense
                    ? "Modify Corporate Expense"
                    : "Record Corporate Expense"}
                </h3>
                <button
                  onClick={() => setShowAddExpenseModal(false)}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={handleSaveExpense}
                className="p-6 space-y-4 text-xs font-semibold text-slate-600"
              >
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Expense Name / Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={expenseName}
                    onChange={(e) => setExpenseName(e.target.value)}
                    placeholder="e.g. Office Rent, Internet Bill, Tea & Coffee"
                    className="w-full bg-white border border-slate-200 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all placeholder:text-slate-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">{`Amount (${symbol}) *`}</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white border border-slate-200 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Billing Frequency *
                    </label>
                    <select
                      value={expenseType}
                      onChange={(e) => setExpenseType(e.target.value)}
                      className="w-full bg-white border border-slate-200 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all"
                    >
                      <option value="one-time">One-Time</option>
                      <option value="recurring">Recurring Monthly</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Billing Start / Occur Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={expenseNotes}
                    onChange={(e) => setExpenseNotes(e.target.value)}
                    rows={3}
                    placeholder="Enter any reference, details or custom guidelines..."
                    className="w-full bg-white border border-slate-200 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all resize-none placeholder:text-slate-400"
                  />
                </div>

                <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3 -mx-6 -mb-6 mt-6 shrink-0 font-bold">
                  <button
                    type="button"
                    onClick={() => setShowAddExpenseModal(false)}
                    className="px-5 py-2.5 rounded-xl text-[13px] text-slate-600 hover:bg-slate-200/50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={expenseSubmitting}
                    className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[13px] shadow-md shadow-rose-600/25 transition-all flex items-center gap-2 active:scale-95"
                  >
                    {expenseSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : editingExpense ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    {editingExpense ? "Save Changes" : "Record Expense"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showVendorModal && (
          <VendorReconciliationModal
            onClose={() => setShowVendorModal(false)}
            onSaved={onRefresh}
            bookings={bookings}
          />
        )}

        {showAddModal && (
          <PaymentFormModal
            onClose={() => setShowAddModal(false)}
            onSaved={onRefresh}
            onSwitchToVendor={() => setShowVendorModal(true)}
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
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              onClick={() => setDeletingPayment(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl w-full max-w-sm relative z-10 overflow-hidden flex flex-col p-6 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-rose-100/50 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 text-rose-600">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                Delete Payment?
              </h3>
              <p className="text-slate-500 text-sm mb-6">
                This action cannot be undone. Are you sure you want to delete
                this transaction record?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingPayment(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-all border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[13px] font-bold shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {actionLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Delete"
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {deletingExpense && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              onClick={() => setDeletingExpense(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl w-full max-w-sm relative z-10 overflow-hidden flex flex-col p-6 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-rose-100/50 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 text-rose-600">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                Delete Expense?
              </h3>
              <p className="text-slate-500 text-sm mb-6">
                Are you sure you want to delete the expense "
                {deletingExpense.name}"? This will remove it from the ledger.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingExpense(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-all border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setActionLoading(true);
                    try {
                      await api.delete(
                        `/finance/expenses/${deletingExpense.id}`,
                      );
                      toast.success("Expense deleted successfully");
                      setExpenses((prev) =>
                        prev.filter((e) => e.id !== deletingExpense.id),
                      );
                      setDeletingExpense(null);
                    } catch (err) {
                      console.error("Failed to delete expense", err);
                      toast.error("Failed to delete expense");
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[13px] font-bold shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {actionLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Delete"
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Wallet Detailed History Drawer */}
        {(selectedVendor || selectedAgent) && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseDrawer}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-lg h-full bg-white/95 backdrop-blur-md shadow-2xl border-l border-slate-200/50 flex flex-col z-10"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      {selectedVendor
                        ? selectedVendor.vendorName
                        : selectedAgent?.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      {selectedVendor
                        ? "Vendor Wallet Ledger"
                        : "Agent Commission Wallet"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCloseDrawer}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Current Balance
                    </span>
                    <span
                      className={`text-3xl font-extrabold tracking-tight ${
                        selectedVendor
                          ? selectedVendor.walletBalance > 0
                            ? "text-emerald-600"
                            : "text-slate-600"
                          : parseFloat(
                                selectedAgent?.wallet?.currentBalance || 0,
                              ) >= 0
                            ? "text-emerald-600"
                            : "text-rose-600"
                      }`}
                    >
                      {selectedVendor
                        ? format(selectedVendor.walletBalance)
                        : format(
                            parseFloat(
                              selectedAgent?.wallet?.currentBalance || 0,
                            ),
                          )}
                    </span>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      selectedVendor
                        ? selectedVendor.walletBalance > 0
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                          : selectedVendor.ledgerBalance < 0
                            ? "bg-rose-50 text-rose-700 border-rose-100"
                            : "bg-slate-50 text-slate-500 border-slate-100"
                        : parseFloat(
                              selectedAgent?.wallet?.currentBalance || 0,
                            ) > 0
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                          : parseFloat(
                                selectedAgent?.wallet?.currentBalance || 0,
                              ) < 0
                            ? "bg-rose-50 text-rose-700 border-rose-100"
                            : "bg-slate-50 text-slate-500 border-slate-100"
                    }`}
                  >
                    {selectedVendor
                      ? selectedVendor.walletBalance > 0
                        ? "Available Floating Credit"
                        : selectedVendor.ledgerBalance < 0
                          ? "Owe Vendor"
                          : "Settled"
                      : parseFloat(selectedAgent?.wallet?.currentBalance || 0) >
                          0
                        ? "Credit Balance"
                        : parseFloat(
                              selectedAgent?.wallet?.currentBalance || 0,
                            ) < 0
                          ? "Receivable (Debt)"
                          : "Zero Balance"}
                  </span>
                </div>
              </div>

              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> Transaction
                  History
                </span>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold">
                  {walletHistory.length} Record
                  {walletHistory.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 bg-slate-50/20">
                {loadingHistory ? (
                  <div className="h-48 flex flex-col items-center justify-center text-slate-400 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                    <span className="text-xs font-semibold">
                      Loading transactions...
                    </span>
                  </div>
                ) : walletHistory.length === 0 ? (
                  <EmptyState
                    icon={Clock}
                    title="No transactions found"
                    description="No recorded history for this wallet."
                    size="sm"
                    transparent={true}
                  />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {selectedVendor
                      ? walletHistory.map((txn: any) => {
                          const vendorEntries =
                            txn.entries?.filter(
                              (e: any) =>
                                e.account?.accountType === "VENDOR_PAYABLE" &&
                                e.account?.entityName?.toLowerCase() ===
                                  selectedVendor.vendorName.toLowerCase(),
                            ) || [];

                          const debit = vendorEntries.reduce(
                            (sum: number, e: any) =>
                              sum + parseFloat(e.debitAmount || 0),
                            0,
                          );
                          const credit = vendorEntries.reduce(
                            (sum: number, e: any) =>
                              sum + parseFloat(e.creditAmount || 0),
                            0,
                          );

                          const isPayment = debit > 0;
                          const amount = isPayment ? debit : credit;

                          const dateObj = new Date(txn.transactionDate);
                          const formattedDate = `${dateObj.getDate().toString().padStart(2, "0")}/${dateObj.toLocaleString("en-GB", { month: "short" })}/${dateObj.getFullYear()} ${dateObj.getHours().toString().padStart(2, "0")}:${dateObj.getMinutes().toString().padStart(2, "0")}`;

                          return (
                            <div
                              key={txn.id}
                              className="p-4 hover:bg-slate-50 transition-colors flex gap-4 items-start"
                            >
                              <div
                                className={`p-2 rounded-lg shrink-0 ${
                                  isPayment
                                    ? "bg-emerald-50 text-emerald-600"
                                    : "bg-rose-50/80 text-rose-600"
                                }`}
                              >
                                <Wallet className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="font-bold text-slate-800 text-[13px]">
                                    {txn.referenceNumber}
                                  </span>
                                  <span
                                    className={`font-black text-[13px] ${
                                      isPayment
                                        ? "text-emerald-600"
                                        : "text-slate-700"
                                    }`}
                                  >
                                    {isPayment ? "+" : "-"}
                                    {format(amount)}
                                  </span>
                                </div>
                                <p className="text-slate-500 text-xs leading-relaxed font-medium">
                                  {txn.description}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-[10px] text-slate-400 font-semibold">
                                    {formattedDate}
                                  </span>
                                  <span
                                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                      txn.type === "PAYMENT"
                                        ? "bg-indigo-50 text-indigo-700"
                                        : "bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    {txn.type}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      : walletHistory.map((txn: any) => {
                          const amount = parseFloat(txn.amount);
                          const isCredit = amount >= 0;

                          const dateObj = new Date(txn.createdAt);
                          const formattedDate = `${dateObj.getDate().toString().padStart(2, "0")}/${dateObj.toLocaleString("en-GB", { month: "short" })}/${dateObj.getFullYear()} ${dateObj.getHours().toString().padStart(2, "0")}:${dateObj.getMinutes().toString().padStart(2, "0")}`;

                          return (
                            <div
                              key={txn.id}
                              className="p-4 hover:bg-slate-50 transition-colors flex gap-4 items-start"
                            >
                              <div
                                className={`p-2 rounded-lg shrink-0 ${
                                  isCredit
                                    ? "bg-emerald-50 text-emerald-600"
                                    : "bg-rose-50/80 text-rose-600"
                                }`}
                              >
                                <Wallet className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="font-bold text-slate-800 text-[13px]">
                                    {txn.referenceId || "Wallet Trx"}
                                  </span>
                                  <span
                                    className={`font-black text-[13px] ${
                                      isCredit
                                        ? "text-emerald-600"
                                        : "text-rose-600"
                                    }`}
                                  >
                                    {isCredit ? "+" : ""}
                                    {format(amount)}
                                  </span>
                                </div>
                                <p className="text-slate-500 text-xs leading-relaxed font-medium">
                                  {txn.notes || "Agent wallet update"}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-[10px] text-slate-400 font-semibold">
                                    {formattedDate}
                                  </span>
                                  <span
                                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                      txn.transactionType === "MARGIN_CLAWBACK"
                                        ? "bg-rose-50 text-rose-700"
                                        : txn.transactionType ===
                                            "MARGIN_EARNED"
                                          ? "bg-emerald-50 text-emerald-700"
                                          : "bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    {txn.transactionType}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PaymentFormModal({
  onClose,
  onSaved,
  onSwitchToVendor,
  bookings,
  initialData,
}: {
  onClose: () => void;
  onSaved: () => void;
  onSwitchToVendor?: () => void;
  bookings: any[];
  initialData?: any;
}) {
  const { user } = useAuthStore();
  const { format, symbol } = useCurrency();
  const [isVendor, setIsVendor] = useState(
    initialData ? initialData.isVendor : false,
  );
  const [bookingId, setBookingId] = useState(
    initialData?.bookingId || (bookings.length > 0 ? bookings[0].id : ""),
  );
  const [amount, setAmount] = useState(String(initialData?.amount || ""));
  const [paidOn, setPaidOn] = useState(
    initialData?.paidOn
      ? new Date(initialData.paidOn).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
  );
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [cardCharges, setCardCharges] = useState(
    initialData?.cardCharges || "",
  );

  // Client specific
  const [paymentMethod, setPaymentMethod] = useState(
    initialData?.paymentMethod || "Bank Transfer",
  );
  const [paymentType, setPaymentType] = useState(
    initialData?.paymentType || "Deposit",
  );
  const [evidenceUrl, setEvidenceUrl] = useState(
    initialData?.evidenceUrl || "",
  );
  const [uploadingEvidence, setUploadingEvidence] = useState(false);

  // Vendor specific
  const [vendorName, setVendorName] = useState(initialData?.vendorName || "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleEvidenceUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingEvidence(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await api.post("/auth/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      setEvidenceUrl(response.data.url);
      toast.success("Evidence uploaded successfully");
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to upload evidence");
    } finally {
      setUploadingEvidence(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isVendor && !bookingId) {
      setError("Select a booking first");
      return;
    }
    if (!amount) {
      setError("Amount is required");
      return;
    }
    if (isVendor && !vendorName) {
      setError("Vendor name is required");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        amount: parseFloat(amount),
        paidOn: new Date(paidOn).toISOString(),
        notes,
      };

      let endpoint = "";
      if (isVendor) {
        payload.vendorName = vendorName;
        if (bookingId === "auto" || !bookingId) {
          endpoint = `/ledger/vendor-payment`;
        } else {
          endpoint = `/bookings/${bookingId}/vendor-payments`;
        }
      } else {
        payload.paymentMethod = paymentMethod;
        payload.paymentType = paymentType;
        payload.evidenceUrl = evidenceUrl || undefined;
        payload.loggedByName = user?.name || undefined;
        if (paymentMethod === "Credit Card" && cardCharges) {
          payload.cardCharges = parseFloat(cardCharges);
        }
        endpoint = `/bookings/${bookingId}/payments`;
      }

      if (initialData) {
        await api.patch(`${endpoint}/${initialData.id}`, payload);
      } else {
        await api.post(endpoint, payload);
      }

      toast.success(
        user?.role === "AGENT" && !isVendor
          ? "Transaction logged for admin approval"
          : `Payment ${initialData ? "updated" : "recorded"} successfully`,
      );
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to save payment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="bg-gradient-to-r from-primary-900 to-indigo-900 text-white px-6 py-4 flex justify-between items-center shadow-inner shrink-0">
          <div className="flex items-center gap-3">
            <div className="text-indigo-300">
              {initialData ? (
                <Edit3 className="w-4 h-4" />
              ) : (
                <CreditCard className="w-4 h-4" />
              )}
            </div>
            <h2 className="font-bold text-[14px] tracking-wide uppercase">
              {initialData ? "Edit Transaction" : "Record Payment"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 overflow-y-auto space-y-5 flex-1 bg-white/50"
        >
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl text-[13px] font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {!initialData && (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Transaction Type
              </label>
              <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsVendor(false)}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${!isVendor ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}
                >
                  Client Payment
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onSwitchToVendor) {
                      onClose();
                      onSwitchToVendor();
                    } else {
                      setIsVendor(true);
                    }
                  }}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${isVendor ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}
                >
                  Vendor Payment
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Target Booking
            </label>
            <select
              required={!isVendor}
              value={bookingId}
              onChange={(e) =>
                setBookingId(
                  e.target.value === "auto" ? "auto" : Number(e.target.value),
                )
              }
              disabled={!!initialData}
              className="w-full bg-white border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all disabled:bg-slate-50 disabled:text-slate-500"
            >
              {isVendor && !initialData && (
                <option value="auto">Global / Auto-Allocate (FIFO)</option>
              )}
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bookingReference} -- {b.agentName || "No Agent"} (Total:{" "}
                  {format(b.totalPrice)})
                </option>
              ))}
            </select>
          </div>

          {isVendor && (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Vendor Name
              </label>
              <input
                type="text"
                required
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all"
                placeholder="Enter vendor name"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">{`Amount (${symbol})`}</label>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-white border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Date Paid
              </label>
              <input
                type="date"
                required
                value={paidOn}
                onChange={(e) => setPaidOn(e.target.value)}
                className="w-full bg-white border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all"
              />
            </div>
          </div>

          {!isVendor && (
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all"
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Cash">Cash</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Payment Type
                </label>
                <select
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all"
                >
                  <option value="Deposit">Deposit</option>
                  <option value="Instalment">Instalment</option>
                  <option value="Final Payment">Final Payment</option>
                  <option value="Refund">Refund</option>
                </select>
              </div>

              {paymentMethod === "Credit Card" && (
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">{`Credit Card Charges (${symbol})`}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cardCharges}
                    onChange={(e) => setCardCharges(e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all"
                    placeholder="0.00"
                  />
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-white border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all placeholder:text-slate-400"
              placeholder="Any reference numbers or notes..."
            />
          </div>

          {!isVendor && (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Evidence / Receipt Screenshot{" "}
                {user?.role === "AGENT" && (
                  <span className="text-rose-500 font-bold">*</span>
                )}
              </label>

              {evidenceUrl ? (
                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0">
                      <img
                        src={evidenceUrl}
                        alt="Receipt preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-slate-700 truncate text-left">
                        Evidence uploaded successfully
                      </p>
                      <a
                        href={evidenceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-indigo-600 hover:text-indigo-700 underline font-medium"
                      >
                        View Full Image
                      </a>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEvidenceUrl("")}
                    className="p-1 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                    title="Remove upload"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative border-2 border-dashed border-slate-200 hover:border-emerald-400 rounded-xl p-4 transition-colors bg-slate-50/50 flex flex-col items-center justify-center text-center cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleEvidenceUpload}
                    disabled={uploadingEvidence}
                    required={user?.role === "AGENT"}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  {uploadingEvidence ? (
                    <div className="flex flex-col items-center gap-2 py-1">
                      <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                      <span className="text-[11px] font-semibold text-slate-500">
                        Uploading screenshot...
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="p-2 bg-slate-100 text-slate-500 rounded-lg border border-slate-200">
                        <Upload className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-slate-700 block">
                          Click to upload bank transfer screenshot
                        </span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">
                          JPEG, PNG up to 10MB
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3 -mx-6 -mb-6 mt-6 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-slate-600 hover:bg-slate-200/50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`px-6 py-2.5 rounded-xl text-white text-[13px] font-bold shadow-md transition-all flex items-center gap-2 active:scale-95 ${isVendor ? "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/25" : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25"}`}
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : initialData ? (
                <Check className="w-4 h-4" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {initialData ? "Save Changes" : "Record Transaction"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
