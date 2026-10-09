import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  LogIn,
  LogOut,
  Search,
  CheckCircle2,
  UserCheck,
  X,
  ChevronDown,
  ClipboardList,
} from "lucide-react";
import { api } from "../api/axios";
import toast from "react-hot-toast";
import { EmptyState } from "../components/shared/EmptyState";
import { LoadingState } from "../components/shared/LoadingState";
import { useAuthStore } from "../store/authStore";

interface AttendanceRecord {
  id: number;
  agentId: number;
  checkIn: string;
  checkOut: string | null;
  notes: string | null;
  durationMinutes: number | null;
  agent?: { id: number; name: string; email: string | null; jobStatus: string };
}

interface Agent {
  id: number;
  name: string;
  email: string | null;
  jobStatus: string;
}

type ViewFilter = "today" | "week" | "month" | "custom";

function fmtTime(dt: string) {
  return new Date(dt).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
function fmtDate(dt: string) {
  return new Date(dt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function fmtDuration(mins: number | null) {
  if (mins === null) return "--";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ todayCheckIns: 0, currentlyIn: 0 });
  const [currentTime, setCurrentTime] = useState(new Date());

  const user = useAuthStore((state) => state.user);

  // Live timer for clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Determine user role: only platform/company admins see the management dashboard
  const isAdmin =
    user?.role === "SUPER_ADMIN" ||
    user?.role === "COMPANY_ADMIN" ||
    user?.role === "MAIN_COMPANY_ADMIN" ||
    user?.role === "ADMIN";
  const isAgent = !isAdmin;

  const loggedInAgent = agents.find(
    (a) =>
      (user?.agentId && a.id === user.agentId) ||
      (user?.email && a.email?.toLowerCase() === user.email.toLowerCase()) ||
      (user?.name && a.name.toLowerCase() === user.name.toLowerCase()),
  );
  const effectiveAgentId =
    loggedInAgent?.id ||
    user?.agentId ||
    (records.length > 0 && isAgent ? records[0].agentId : undefined);

  // Filters for Admin view
  const [view, setView] = useState<ViewFilter>("today");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");

  // Check-in state & modal
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkInAgentId, setCheckInAgentId] = useState("");
  const [checkInNotes, setCheckInNotes] = useState("");
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkOutLoading, setCheckOutLoading] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (view !== "custom") {
        params.append("view", view);
      } else {
        if (fromDate) params.append("from", fromDate);
        if (toDate) params.append("to", toDate);
      }
      if (isAgent) {
        const agentIdVal = effectiveAgentId;
        if (agentIdVal) params.append("agentId", String(agentIdVal));
      } else if (selectedAgent) {
        params.append("agentId", selectedAgent);
      }

      let attRes;
      let agentsRes = { data: { agents: [] } };
      if (isAgent) {
        attRes = await api.get(`/agents/attendance?${params}`);
      } else {
        const [aRes, agRes] = await Promise.all([
          api.get(`/agents/attendance?${params}`),
          api.get("/agents?limit=all").catch(() => ({ data: { agents: [] } })),
        ]);
        attRes = aRes;
        agentsRes = agRes;
      }

      setRecords(attRes.data.attendance || []);
      setSummary(attRes.data.summary || { todayCheckIns: 0, currentlyIn: 0 });
      setAgents(agentsRes.data.agents || []);
    } catch (err) {
      toast.error("Failed to load attendance records");
    } finally {
      setLoading(false);
    }
  }, [view, selectedAgent, fromDate, toDate, isAgent, effectiveAgentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (showCheckInModal && isAgent) {
      const agentIdVal = effectiveAgentId;
      if (agentIdVal) {
        setCheckInAgentId(String(agentIdVal));
      }
    }
  }, [showCheckInModal, isAgent, effectiveAgentId]);

  // Admin Check-in (via modal)
  const handleCheckIn = async () => {
    if (!checkInAgentId) {
      toast.error("Please select an agent");
      return;
    }
    setCheckInLoading(true);
    try {
      await api.post(`/agents/${checkInAgentId}/attendance/checkin`, {
        notes: checkInNotes || undefined,
      });
      toast.success("Agent checked in successfully");
      setShowCheckInModal(false);
      setCheckInAgentId("");
      setCheckInNotes("");
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || "Failed to check in");
    } finally {
      setCheckInLoading(false);
    }
  };

  // Agent Check-In directly from agent view
  const handleAgentCheckIn = async () => {
    const targetId = effectiveAgentId || "me";
    setCheckInLoading(true);
    try {
      await api.post(`/agents/${targetId}/attendance/checkin`, {
        notes: checkInNotes || undefined,
      });
      toast.success("Attendance marked! Checked in successfully.");
      setCheckInNotes("");
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || "Failed to check in");
    } finally {
      setCheckInLoading(false);
    }
  };

  // Agent Check-Out directly from agent view
  const handleAgentCheckOut = async () => {
    const targetId = effectiveAgentId || "me";
    setCheckOutLoading(typeof targetId === "number" ? targetId : 1);
    try {
      await api.post(`/agents/${targetId}/attendance/checkout`, {
        notes: checkInNotes || undefined,
      });
      toast.success("Checked out successfully for today!");
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || "Failed to check out");
    } finally {
      setCheckOutLoading(null);
    }
  };

  // Admin Check-Out from table
  const handleCheckOut = async (agentId: number) => {
    setCheckOutLoading(agentId);
    try {
      await api.post(`/agents/${agentId}/attendance/checkout`);
      toast.success("Agent checked out successfully");
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || "Failed to check out");
    } finally {
      setCheckOutLoading(null);
    }
  };

  // Calculate Today's Attendance State for the logged-in agent
  const todayDateString = new Date().toLocaleDateString("en-GB");
  const myTodayRecord = records.find((r) => {
    if (!isAgent && effectiveAgentId && r.agentId !== effectiveAgentId) return false;
    return new Date(r.checkIn).toLocaleDateString("en-GB") === todayDateString;
  });

  const hasMarkedAttendanceToday = !!myTodayRecord;
  const isCurrentlyCheckedIn = !!myTodayRecord && !myTodayRecord.checkOut;
  const hasCheckedOutToday = !!myTodayRecord && !!myTodayRecord.checkOut;

  // Filtered records for Admin table
  const filtered = records.filter((r) => {
    if (!search) return true;
    const name = r.agent?.name?.toLowerCase() || "";
    return name.includes(search.toLowerCase());
  });

  const checkedInAgentIds = new Set(
    records.filter((r) => !r.checkOut).map((r) => r.agentId),
  );

  const viewLabels: Record<ViewFilter, string> = {
    today: "Today",
    week: "This Week",
    month: "This Month",
    custom: "Custom Range",
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // AGENT VIEW: Agents can see ONLY the check-in and check-out button
  // ─────────────────────────────────────────────────────────────────────────────
  if (isAgent) {
    return (
      <div className="max-w-xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 py-6">
        {/* Header card with live clock */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold mb-2">
                <Clock className="w-3.5 h-3.5" />
                Attendance Module
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Daily Attendance Clock
              </h1>
              <p className="text-slate-500 text-xs mt-0.5">
                {user?.name || "Agent"} {user?.email ? `• ${user.email}` : ""}
              </p>
            </div>

            {/* Live Digital Clock */}
            <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-3.5 text-right sm:min-w-[170px]">
              <div className="text-2xl font-black font-mono tracking-tight text-slate-900">
                {currentTime.toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </div>
              <div className="text-[11px] font-bold text-slate-500 mt-0.5">
                {currentTime.toLocaleDateString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </div>
            </div>
          </div>

          {/* Today's Status Banner */}
          <div className="mt-6">
            {loading ? (
              <div className="py-8 flex justify-center">
                <LoadingState message="Loading your attendance status..." />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Status Indicator Card */}
                <div
                  className={`rounded-2xl p-4 sm:p-5 border transition-all ${
                    hasCheckedOutToday
                      ? "bg-slate-50 border-slate-200"
                      : isCurrentlyCheckedIn
                      ? "bg-emerald-50/70 border-emerald-200"
                      : "bg-amber-50/60 border-amber-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-3.5 h-3.5 rounded-full ${
                          hasCheckedOutToday
                            ? "bg-slate-400"
                            : isCurrentlyCheckedIn
                            ? "bg-emerald-500 animate-pulse"
                            : "bg-amber-500"
                        }`}
                      />
                      <div>
                        <div className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">
                          Today's Status
                        </div>
                        <div className="text-base font-black text-slate-900">
                          {hasCheckedOutToday
                            ? "Attendance Completed for Today"
                            : isCurrentlyCheckedIn
                            ? "Clocked In (Active Shift)"
                            : "Not Checked In Today"}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                        hasCheckedOutToday
                          ? "bg-slate-200 text-slate-700"
                          : isCurrentlyCheckedIn
                          ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20"
                          : "bg-amber-200 text-amber-900"
                      }`}
                    >
                      {hasCheckedOutToday
                        ? "Completed"
                        : isCurrentlyCheckedIn
                        ? "Active"
                        : "Pending"}
                    </span>
                  </div>

                  {myTodayRecord && (
                    <div className="grid grid-cols-3 gap-2 pt-4 mt-4 border-t border-slate-200/60 text-center">
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">
                          Check-In
                        </div>
                        <div className="text-sm font-black text-emerald-700 mt-0.5">
                          {fmtTime(myTodayRecord.checkIn)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">
                          Check-Out
                        </div>
                        <div className="text-sm font-black text-rose-700 mt-0.5">
                          {myTodayRecord.checkOut
                            ? fmtTime(myTodayRecord.checkOut)
                            : "In Progress"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">
                          Duration
                        </div>
                        <div className="text-sm font-black text-slate-800 mt-0.5">
                          {myTodayRecord.durationMinutes !== null
                            ? fmtDuration(myTodayRecord.durationMinutes)
                            : "Active"}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Optional Shift Notes */}
                {!hasCheckedOutToday && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Shift Notes (Optional)
                    </label>
                    <input
                      type="text"
                      value={checkInNotes}
                      onChange={(e) => setCheckInNotes(e.target.value)}
                      placeholder="e.g. Working from office / remote / client visit..."
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none focus:border-primary-500 placeholder:text-slate-400 bg-white"
                    />
                  </div>
                )}

                {/* ─── AGENT ACTION BUTTONS: ONLY CHECK-IN AND CHECK-OUT ─── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {/* Check-In Button */}
                  <button
                    onClick={handleAgentCheckIn}
                    disabled={hasMarkedAttendanceToday || checkInLoading || loading}
                    className={`flex items-center justify-center gap-3 py-4 px-6 rounded-2xl text-base font-extrabold transition-all shadow-md active:scale-98 ${
                      !hasMarkedAttendanceToday && !loading
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 cursor-pointer"
                        : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none"
                    }`}
                  >
                    {checkInLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <LogIn className="w-5 h-5" />
                    )}
                    <span>
                      {hasMarkedAttendanceToday ? "Checked In" : "Check In"}
                    </span>
                  </button>

                  {/* Check-Out Button (Disabled when checked out) */}
                  <button
                    onClick={handleAgentCheckOut}
                    disabled={!isCurrentlyCheckedIn || checkOutLoading !== null || loading}
                    className={`flex items-center justify-center gap-3 py-4 px-6 rounded-2xl text-base font-extrabold transition-all shadow-md active:scale-98 ${
                      isCurrentlyCheckedIn && !loading
                        ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 cursor-pointer animate-pulse"
                        : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none"
                    }`}
                  >
                    {checkOutLoading !== null ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <LogOut className="w-5 h-5" />
                    )}
                    <span>
                      {hasCheckedOutToday ? "Checked Out" : "Check Out"}
                    </span>
                  </button>
                </div>

                {/* Helpful status note below buttons */}
                <div className="text-center text-xs text-slate-400 font-medium pt-1">
                  {hasCheckedOutToday ? (
                    <span className="text-emerald-700 font-bold">
                      ✓ Your attendance for today is complete. Buttons are disabled until tomorrow.
                    </span>
                  ) : isCurrentlyCheckedIn ? (
                    <span className="text-amber-700 font-semibold">
                      ● Active shift in progress. When you finish your day, click "Check Out".
                    </span>
                  ) : (
                    <span>
                      ⓘ You can mark attendance once per day. Click "Check In" to start your shift.
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ADMIN VIEW: Full team attendance management for Super Admin / Company Admin
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 rounded-xl">
              <Clock className="w-5 h-5 text-indigo-600" />
            </div>
            Team Attendance Management
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            Track and manage check-ins and check-outs for all agents in your company.
          </p>
        </div>
        <button
          onClick={() => setShowCheckInModal(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-primary-500/20 active:scale-95 transition-all"
        >
          <LogIn className="w-4 h-4" /> Record Check-In
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          {
            label: "Today's Check-ins",
            value: summary.todayCheckIns,
            icon: UserCheck,
            color: "emerald",
          },
          {
            label: "Currently In",
            value: summary.currentlyIn,
            icon: CheckCircle2,
            color: "indigo",
          },
          {
            label: "Records (filtered)",
            value: filtered.length,
            icon: ClipboardList,
            color: "amber",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center gap-4"
          >
            <div className={`p-3 rounded-xl bg-${card.color}-50`}>
              <card.icon className={`w-5 h-5 text-${card.color}-600`} />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-slate-900">
                {card.value}
              </p>
              <p className="text-[11px] text-slate-500 font-medium">
                {card.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          {/* View buttons */}
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            {(["today", "week", "month", "custom"] as ViewFilter[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all ${
                  view === v
                    ? "bg-white text-primary-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {viewLabels[v]}
              </button>
            ))}
          </div>

          {/* Custom date inputs */}
          <AnimatePresence>
            {view === "custom" && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="flex gap-2"
              >
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="border border-slate-200 rounded-xl px-3 py-1.5 text-[12px] text-slate-700 outline-none focus:border-primary-500"
                />
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="border border-slate-200 rounded-xl px-3 py-1.5 text-[12px] text-slate-700 outline-none focus:border-primary-500"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Agent filter dropdown */}
          <div className="relative">
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="pl-3 pr-8 py-1.5 border border-slate-200 rounded-xl text-[12px] text-slate-700 outline-none focus:border-primary-500 appearance-none bg-white"
            >
              <option value="">All Agents</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="relative ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agent..."
              className="pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl text-[12px] text-slate-700 outline-none focus:border-primary-500 w-44"
            />
          </div>
        </div>
      </div>

      {/* Admin Table */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8">
            <LoadingState message="Loading attendance records..." />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No attendance records"
            description="No check-ins found for the selected period."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-100">
                  <th className="py-3 px-5">Agent</th>
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-5">Check-In</th>
                  <th className="py-3 px-5">Check-Out</th>
                  <th className="py-3 px-5">Duration</th>
                  <th className="py-3 px-5">Notes</th>
                  <th className="py-3 px-5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-[12px]">
                {filtered.map((rec) => {
                  const isOpen = !rec.checkOut;
                  return (
                    <tr
                      key={rec.id}
                      className={`transition-colors hover:bg-slate-50/50 ${
                        isOpen ? "bg-emerald-50/30" : ""
                      }`}
                    >
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-100 to-indigo-100 text-primary-700 flex items-center justify-center font-bold text-[10px] border border-primary-200/50 shrink-0">
                            {(rec.agent?.name || "A").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">
                              {rec.agent?.name || `Agent #${rec.agentId}`}
                            </p>
                            {rec.agent?.email && (
                              <p className="text-slate-400 text-[10px]">
                                {rec.agent.email}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-5 text-slate-600">
                        {fmtDate(rec.checkIn)}
                      </td>
                      <td className="py-3 px-5">
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold">
                          <LogIn className="w-3.5 h-3.5" />
                          {fmtTime(rec.checkIn)}
                        </span>
                      </td>
                      <td className="py-3 px-5">
                        {rec.checkOut ? (
                          <span className="inline-flex items-center gap-1.5 text-rose-600 font-bold">
                            <LogOut className="w-3.5 h-3.5" />
                            {fmtTime(rec.checkOut)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[11px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-5 font-semibold text-slate-600">
                        {isOpen ? (
                          <span className="text-indigo-600">In progress…</span>
                        ) : (
                          fmtDuration(rec.durationMinutes)
                        )}
                      </td>
                      <td className="py-3 px-5 text-slate-500 max-w-[150px] truncate">
                        {rec.notes || "--"}
                      </td>
                      <td className="py-3 px-5 text-center">
                        {isOpen ? (
                          <button
                            onClick={() => handleCheckOut(rec.agentId)}
                            disabled={checkOutLoading === rec.agentId}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[11px] font-bold transition-all disabled:opacity-50"
                          >
                            {checkOutLoading === rec.agentId ? (
                              <div className="w-3.5 h-3.5 border-2 border-rose-300 border-t-rose-600 rounded-full animate-spin" />
                            ) : (
                              <LogOut className="w-3.5 h-3.5" />
                            )}
                            Check Out
                          </button>
                        ) : (
                          <span className="text-slate-300 text-[11px] font-medium">
                            Completed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Admin Check-In Modal */}
      <AnimatePresence>
        {showCheckInModal && (
          <motion.div
            key="checkin-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          >
            <motion.div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => !checkInLoading && setShowCheckInModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: "spring", damping: 24, stiffness: 220 }}
              className="relative z-10 bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="bg-gradient-to-r from-emerald-600 to-teal-500 px-6 py-5 text-white relative overflow-hidden">
                <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
                <div className="relative z-10 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center">
                    <LogIn className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-extrabold">
                      Record Check-In
                    </h3>
                    <p className="text-[11px] text-emerald-100">
                      Select agent and confirm attendance
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCheckInModal(false)}
                  className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Agent *
                  </label>
                  <select
                    value={checkInAgentId}
                    onChange={(e) => setCheckInAgentId(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none focus:border-primary-500 bg-white"
                  >
                    <option value="">-- Select Agent --</option>
                    {agents
                      .filter((a) => !checkedInAgentIds.has(a.id))
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </select>
                  {agents.filter((a) => checkedInAgentIds.has(a.id)).length >
                    0 && (
                    <p className="mt-1 text-[10px] text-amber-600 font-medium">
                      ⚠️ Already checked in:{" "}
                      {agents
                        .filter((a) => checkedInAgentIds.has(a.id))
                        .map((a) => a.name)
                        .join(", ")}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Notes (optional)
                  </label>
                  <input
                    type="text"
                    value={checkInNotes}
                    onChange={(e) => setCheckInNotes(e.target.value)}
                    placeholder="e.g. Working from office"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none focus:border-primary-500 placeholder:text-slate-400"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowCheckInModal(false)}
                    disabled={checkInLoading}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-[13px] font-bold hover:bg-slate-50 transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCheckIn}
                    disabled={checkInLoading || !checkInAgentId}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-bold shadow-md shadow-emerald-500/30 transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {checkInLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <LogIn className="w-4 h-4" />
                    )}
                    {checkInLoading ? "Checking In…" : "Confirm Check-In"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
