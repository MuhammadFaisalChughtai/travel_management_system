import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Search, Plus, Edit3, Trash2, X, Check, AlertCircle } from 'lucide-react';
import { api } from '../api/axios';
import toast from 'react-hot-toast';
import { EmptyState } from '../components/shared/EmptyState';
import { LoadingState } from '../components/shared/LoadingState';
import { Pagination } from '../components/shared/Pagination';
import { VendorReconciliationModal } from '../components/finance/VendorReconciliationModal';
import { MultiSelectDropdown } from '../components/shared/MultiSelectDropdown';

export function FinancePage({ bookings, onRefresh }: { bookings: any[]; onRefresh: () => void }) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'client' | 'vendor' | 'ledger'>('ledger');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);
  
  const [ledgerTransactions, setLedgerTransactions] = useState<any[]>([]);
  const [ledgerAccounts, setLedgerAccounts] = useState<any[]>([]);
  
  const [editingPayment, setEditingPayment] = useState<any | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Payments State
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [paymentsTotalPages, setPaymentsTotalPages] = useState(1);
  const paymentsPerPage = 10;

  useEffect(() => {
    if (activeTab === 'ledger') {
      fetchLedgerReport();
    } else {
      fetchPayments();
    }
  }, [activeTab, paymentsPage, search]);

  const fetchPayments = async () => {
    try {
      setPaymentsLoading(true);
      const params = new URLSearchParams();
      params.append('type', activeTab);
      params.append('page', paymentsPage.toString());
      params.append('limit', paymentsPerPage.toString());
      if (search) params.append('search', search);

      const res = await api.get(`/finance/payments?${params.toString()}`);
      setPayments(res.data.payments || []);
      setPaymentsTotal(res.data.total || 0);
      setPaymentsTotalPages(res.data.totalPages || 1);
    } catch (err) {
      toast.error('Failed to load payments');
    } finally {
      setPaymentsLoading(false);
    }
  };

  const [ledgerPage, setLedgerPage] = useState(1);
  const ledgerPerPage = 10;
  useEffect(() => { setLedgerPage(1); }, [ledgerTransactions]);

  const handleDelete = async () => {
    if (!deletingPayment) return;
    setActionLoading(true);
    try {
      const type = deletingPayment.isVendor ? 'vendor-payment' : 'payment';
      await api.delete(`/bookings/${deletingPayment.bookingId}/services/${type}/${deletingPayment.id}`);
      toast.success('Payment deleted successfully');
      setDeletingPayment(null);
      if (activeTab === 'ledger') {
        fetchLedgerReport();
      } else {
        fetchPayments();
      }
      onRefresh();
    } catch (err) {
      toast.error('Failed to delete payment');
    } finally {
      setActionLoading(false);
    }
  };

  const [ledgerFilters, setLedgerFilters] = useState({
    dateStart: '',
    dateEnd: '',
    agentName: '',
    vendorName: '',
    reference: ''
  });

  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    api.get('/agents').then(res => setAgents(res.data.agents || [])).catch(console.error);
    api.get('/vendors').then(res => setVendors(res.data.vendors || [])).catch(console.error);
  }, []);

  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([]);
      return;
    }
    const delayDebounceFn = setTimeout(() => {
      setIsSearching(true);
      api.get(`/bookings/search?q=${searchQuery}`).then(res => {
        setSearchResults(res.data.bookings || []);
      }).finally(() => setIsSearching(false));
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const fetchLedgerReport = async (filtersOverride?: any) => {
    try {
      setLedgerLoading(true);
      const params = new URLSearchParams();
      const currentFilters = filtersOverride || ledgerFilters;
      if (currentFilters.dateStart) params.append('dateStart', currentFilters.dateStart);
      if (currentFilters.dateEnd) params.append('dateEnd', currentFilters.dateEnd);
      if (currentFilters.agentName) params.append('agentName', currentFilters.agentName);
      if (currentFilters.vendorName) params.append('vendorName', currentFilters.vendorName);
      if (currentFilters.reference) params.append('reference', currentFilters.reference);

      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get(`/ledger/report${qs}`);
      setLedgerTransactions(res.data.transactions || []);
      setLedgerAccounts(res.data.accounts || []);
    } catch (err) {
      console.error('Failed to fetch ledger report', err);
    } finally {
      setLedgerLoading(false);
    }
  };

  const activeFiltersCount = Object.values(ledgerFilters).filter(v => v !== '').length;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-emerald-500" /> Global Finance Ledger
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">Comprehensive chronological registry of all corporate payment operations.</p>
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
        <div className="flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
          <button 
            onClick={() => setActiveTab('client')}
            className={`px-6 py-2 rounded-lg text-[13px] font-bold transition-all ${activeTab === 'client' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Client Payments
          </button>
          <button 
            onClick={() => setActiveTab('vendor')}
            className={`px-6 py-2 rounded-lg text-[13px] font-bold transition-all ${activeTab === 'vendor' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Vendor Payments
          </button>
          <button 
            onClick={() => setActiveTab('ledger')}
            className={`px-6 py-2 rounded-lg text-[13px] font-bold transition-all ${activeTab === 'ledger' ? 'bg-amber-50 text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Ledger Report
          </button>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          {activeTab === 'ledger' && (
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
          {activeTab !== 'ledger' && (
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search transactions..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
              />
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showFiltersModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowFiltersModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg relative z-10 overflow-visible flex flex-col rounded-2xl shadow-2xl">
              <div className="absolute inset-0 bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl overflow-hidden -z-10 pointer-events-none"></div>
              <div className="bg-gradient-to-r from-primary-900 to-indigo-900 text-white px-6 py-4 flex justify-between items-center shadow-inner rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="text-indigo-300">
                    <Search className="w-4 h-4" />
                  </div>
                  <h2 className="font-bold text-[14px] tracking-wide uppercase">Ledger Filters</h2>
                </div>
                <button onClick={() => setShowFiltersModal(false)} className="text-white/60 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Start Date</label>
                    <input type="date" value={ledgerFilters.dateStart} onChange={e => setLedgerFilters(prev => ({ ...prev, dateStart: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">End Date</label>
                    <input type="date" value={ledgerFilters.dateEnd} onChange={e => setLedgerFilters(prev => ({ ...prev, dateEnd: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Agent Name</label>
                  <select value={ledgerFilters.agentName} onChange={e => setLedgerFilters(prev => ({ ...prev, agentName: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                    <option value="">All Agents</option>
                    {agents.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Vendor Name</label>
                  <select value={ledgerFilters.vendorName} onChange={e => setLedgerFilters(prev => ({ ...prev, vendorName: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                    <option value="">All Vendors</option>
                    {vendors.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                  </select>
                </div>
                <div className="relative">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Invoice / PNR / Ticket Number</label>
                  <input type="text" placeholder="Search bookings by reference, PNR..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); setLedgerFilters(prev => ({ ...prev, reference: e.target.value })); }} onFocus={() => setShowDropdown(true)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                  {isSearching && <div className="absolute right-3 top-9"><div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>}
                  {showDropdown && searchResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-[160px] overflow-y-auto">
                      {searchResults.map(b => (
                        <div key={b.id} onClick={() => { setLedgerFilters(prev => ({ ...prev, reference: b.bookingReference })); setSearchQuery(b.bookingReference); setShowDropdown(false); }} className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0">
                          <div className="font-bold text-slate-800 text-[13px]">{b.bookingReference}</div>
                          <div className="flex justify-between items-center text-[11px] text-slate-500 mt-0.5">
                            <span>
                              {b.customers?.length > 0 ? `${b.customers[0].firstName} ${b.customers[0].lastName}` : 'No Passenger'}
                            </span>
                            {b.agentName && <span className="font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{b.agentName}</span>}
                          </div>
                          {b.flightServices?.length > 0 && b.flightServices[0]?.pnr && (
                            <div className="text-[10px] font-mono text-slate-400 mt-1 uppercase">
                              PNR: {b.flightServices.map((fs: any) => fs.pnr).filter(Boolean).join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-between items-center rounded-b-2xl">
                <button onClick={() => { const blank = { dateStart: new Date(new Date().setDate(new Date().getDate() - 10)).toISOString().split('T')[0], dateEnd: '', agentName: '', vendorName: '', reference: '' }; setLedgerFilters(blank); fetchLedgerReport(blank); }} className="px-4 py-2 text-rose-600 font-bold text-[13px] hover:bg-rose-50 rounded-lg transition-colors">Clear All</button>
                <button onClick={() => { fetchLedgerReport(); setShowFiltersModal(false); }} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl text-[13px] font-bold shadow-md transition-all">Apply Filters</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden text-[13px]">
        {activeTab !== 'ledger' ? (
          paymentsLoading ? (
            <div className="p-8">
              <LoadingState message="Loading transactions..." />
            </div>
          ) : payments.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Search}
                title="No transactions found"
                description="Try adjusting your search criteria or filters."
              />
            </div>
          ) : (
            <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-4 px-6">Transaction ID</th>
                    <th className="py-4 px-6">Booking Ref</th>
                    {activeTab === 'vendor' && <th className="py-4 px-6">Vendor Name</th>}
                    <th className="py-4 px-6">Amount Settled</th>
                    <th className="py-4 px-6">Date Paid</th>
                    {activeTab === 'client' && <th className="py-4 px-6">Method/Type</th>}
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {payments.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6 font-mono text-slate-400 text-xs">TXN-{p.id}</td>
                      <td className="py-4 px-6 font-black text-slate-900">{p.bookingRef}</td>
                      {activeTab === 'vendor' && <td className="py-4 px-6 font-semibold">{p.vendorName}</td>}
                      <td className={`py-4 px-6 font-black ${activeTab === 'client' ? 'text-emerald-600' : 'text-indigo-600'}`}>
                        £{Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-6 font-medium text-slate-600">{new Date(p.paidOn).toLocaleDateString()}</td>
                      {activeTab === 'client' && (
                        <td className="py-4 px-6">
                          <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-bold text-[10px] uppercase tracking-wide">
                            {p.paymentMethod} / {p.paymentType}
                          </span>
                        </td>
                      )}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setEditingPayment(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => setDeletingPayment(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {payments.length > 0 && (
              <Pagination 
                currentPage={paymentsPage} 
                totalPages={paymentsTotalPages} 
                onPageChange={setPaymentsPage} 
                itemsPerPage={paymentsPerPage} 
                totalItems={paymentsTotal} 
              />
            )}
          </>
          )
        ) : (
          <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden text-[11px] mt-6">
            {ledgerLoading ? (
              <LoadingState message="Loading ledger records..." />
            ) : ledgerTransactions.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={Search}
                  title="No ledger records"
                  description="No double-entry accounting records matched your filters."
                />
              </div>
            ) : (
              <>
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
                      const debit = txn.entries?.reduce((sum: number, e: any) => sum + parseFloat(e.debitAmount), 0) || 0;
                      const credit = txn.entries?.reduce((sum: number, e: any) => sum + parseFloat(e.creditAmount), 0) || 0;
                      
                      const dateObj = new Date(txn.transactionDate);
                      const formattedDate = `${dateObj.getDate().toString().padStart(2, '0')}/${dateObj.toLocaleString('en-GB', { month: 'short' })}/${dateObj.getFullYear()}`;
                      
                      return (
                        <tr key={txn.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-5 align-top font-bold text-slate-900 text-[12px]">{txn.referenceNumber}</td>
                          <td className="py-3 px-5 align-top">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                              txn.type === 'PAYMENT' ? 'bg-indigo-100 text-indigo-700' : 
                              txn.type === 'FEE' ? 'bg-rose-100 text-rose-700' : 
                              txn.type === 'REFUND' ? 'bg-amber-100 text-amber-700' :
                              txn.type === 'DISCOUNT' ? 'bg-cyan-100 text-cyan-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {txn.type}
                            </span>
                          </td>
                          <td className="py-3 px-5 align-top text-slate-600 font-semibold text-[12px]">{formattedDate}</td>
                          <td className="py-3 px-5 align-top text-right font-black text-rose-600 text-[12px]">{debit > 0 ? `£${debit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</td>
                          <td className="py-3 px-5 align-top text-right font-black text-emerald-600 text-[12px]">{credit > 0 ? `£${credit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</td>
                          <td className="py-3 px-5 align-top whitespace-pre-wrap leading-relaxed text-[11px] text-slate-500 font-medium">
                            {txn.description}
                            {txn.allocations?.length > 0 && <div className="mt-1 text-slate-400 font-bold">Allocated to {txn.allocations.length} service(s)</div>}
                          </td>
                        </tr>
                      );
                    })}
                    
                    {(() => {
                      const totalDebit = ledgerTransactions.reduce((acc, txn) => acc + (txn.entries?.reduce((sum: number, e: any) => sum + parseFloat(e.debitAmount), 0) || 0), 0);
                      const totalCredit = ledgerTransactions.reduce((acc, txn) => acc + (txn.entries?.reduce((sum: number, e: any) => sum + parseFloat(e.creditAmount), 0) || 0), 0);
                      
                      const closingBalanceVal = ledgerAccounts.reduce((sum, a) => sum + parseFloat(a.balance), 0);
                      const closingDebit = closingBalanceVal > 0 ? closingBalanceVal : 0;
                      const closingCredit = closingBalanceVal < 0 ? Math.abs(closingBalanceVal) : 0;
                      
                      return (
                        <>
                          <tr className="bg-slate-100/50 border-t-2 border-slate-200">
                            <td className="py-4 px-5"></td>
                            <td className="py-4 px-5 font-black text-slate-700 text-right uppercase tracking-wider text-[11px]" colSpan={2}>Period Total</td>
                            <td className="py-4 px-5 text-right font-black text-rose-600 text-[13px]">{totalDebit > 0 ? `£${totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</td>
                            <td className="py-4 px-5 text-right font-black text-emerald-600 text-[13px]">{totalCredit > 0 ? `£${totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</td>
                            <td className="py-4 px-5"></td>
                          </tr>
                          <tr className="bg-white border-b-4 border-emerald-500 rounded-b-3xl">
                            <td className="py-4 px-5"></td>
                            <td className="py-4 px-5 font-black text-slate-900 text-right uppercase tracking-wider text-[12px]" colSpan={2}>Closing Ledger Balance</td>
                            <td className="py-4 px-5 text-right font-black text-rose-600 text-[13px]">{closingDebit > 0 ? `£${closingDebit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</td>
                            <td className="py-4 px-5 text-right font-black text-emerald-600 text-[13px]">{closingCredit > 0 ? `£${closingCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</td>
                            <td className="py-4 px-5"></td>
                          </tr>
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
              {ledgerTransactions.length > 0 && (
                <Pagination 
                  currentPage={ledgerPage} 
                  totalPages={Math.ceil(ledgerTransactions.length / ledgerPerPage)} 
                  onPageChange={setLedgerPage} 
                  itemsPerPage={ledgerPerPage} 
                  totalItems={ledgerTransactions.length} 
                />
              )}
            </>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setDeletingPayment(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl w-full max-w-sm relative z-10 overflow-hidden flex flex-col p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-rose-100/50 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 text-rose-600">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Payment?</h3>
              <p className="text-slate-500 text-sm mb-6">This action cannot be undone. Are you sure you want to delete this transaction record?</p>
              <div className="flex gap-3">
                <button onClick={() => setDeletingPayment(null)} className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-all border border-slate-200">Cancel</button>
                <button onClick={handleDelete} disabled={actionLoading} className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[13px] font-bold shadow-md transition-all flex items-center justify-center gap-2">
                  {actionLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PaymentFormModal({ onClose, onSaved, onSwitchToVendor, bookings, initialData }: { onClose: () => void; onSaved: () => void; onSwitchToVendor?: () => void; bookings: any[]; initialData?: any }) {
  const [isVendor, setIsVendor] = useState(initialData ? initialData.isVendor : false);
  const [bookingId, setBookingId] = useState(initialData?.bookingId || (bookings.length > 0 ? bookings[0].id : ''));
  const [amount, setAmount] = useState(String(initialData?.amount || ''));
  const [paidOn, setPaidOn] = useState(initialData?.paidOn ? new Date(initialData.paidOn).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [cardCharges, setCardCharges] = useState(initialData?.cardCharges || '');
  
  // Client specific
  const [paymentMethod, setPaymentMethod] = useState(initialData?.paymentMethod || 'Bank Transfer');
  const [paymentType, setPaymentType] = useState(initialData?.paymentType || 'Deposit');
  
  // Vendor specific
  const [vendorName, setVendorName] = useState(initialData?.vendorName || '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isVendor && !bookingId) { setError('Select a booking first'); return; }
    if (!amount) { setError('Amount is required'); return; }
    if (isVendor && !vendorName) { setError('Vendor name is required'); return; }
    setSaving(true);
    try {
      const payload: any = {
        amount: parseFloat(amount),
        paidOn: new Date(paidOn).toISOString(),
        notes
      };

      let endpoint = '';
      if (isVendor) {
        payload.vendorName = vendorName;
        if (bookingId === 'auto' || !bookingId) {
          endpoint = `/ledger/vendor-payment`;
        } else {
          endpoint = `/bookings/${bookingId}/vendor-payments`;
        }
      } else {
        payload.paymentMethod = paymentMethod;
        payload.paymentType = paymentType;
        if (paymentMethod === 'Credit Card' && cardCharges) {
          payload.cardCharges = parseFloat(cardCharges);
        }
        endpoint = `/bookings/${bookingId}/payments`;
      }

      if (initialData) {
        await api.patch(`${endpoint}/${initialData.id}`, payload);
      } else {
        await api.post(endpoint, payload);
      }
      
      toast.success(`Payment ${initialData ? 'updated' : 'recorded'} successfully`);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-gradient-to-r from-primary-900 to-indigo-900 text-white px-6 py-4 flex justify-between items-center shadow-inner shrink-0">
          <div className="flex items-center gap-3">
            <div className="text-indigo-300">
              {initialData ? <Edit3 className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
            </div>
            <h2 className="font-bold text-[14px] tracking-wide uppercase">{initialData ? 'Edit Transaction' : 'Record Payment'}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1 bg-white/50">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl text-[13px] font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {!initialData && (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Transaction Type</label>
              <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button type="button" onClick={() => setIsVendor(false)} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${!isVendor ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Client Payment</button>
                <button type="button" onClick={() => {
                  if (onSwitchToVendor) {
                    onClose();
                    onSwitchToVendor();
                  } else {
                    setIsVendor(true);
                  }
                }} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${isVendor ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Vendor Payment</button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Target Booking</label>
            <select required={!isVendor} value={bookingId} onChange={e => setBookingId(e.target.value === 'auto' ? 'auto' : Number(e.target.value))} disabled={!!initialData} className="w-full bg-white border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all disabled:bg-slate-50 disabled:text-slate-500">
              {isVendor && !initialData && <option value="auto">Global / Auto-Allocate (FIFO)</option>}
              {bookings.map(b => (
                <option key={b.id} value={b.id}>{b.bookingReference} — {b.agentName || 'No Agent'} (Total: £{Number(b.totalPrice).toFixed(2)})</option>
              ))}
            </select>
          </div>

          {isVendor && (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Vendor Name</label>
              <input type="text" required value={vendorName} onChange={e => setVendorName(e.target.value)} className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all" placeholder="Enter vendor name" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Amount (£)</label>
              <input type="number" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-white border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Date Paid</label>
              <input type="date" required value={paidOn} onChange={e => setPaidOn(e.target.value)} className="w-full bg-white border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all" />
            </div>
          </div>

          {!isVendor && (
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Payment Method</label>
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full bg-white border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all">
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Cash">Cash</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Payment Type</label>
                <select value={paymentType} onChange={e => setPaymentType(e.target.value)} className="w-full bg-white border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all">
                  <option value="Deposit">Deposit</option>
                  <option value="Instalment">Instalment</option>
                  <option value="Final Payment">Final Payment</option>
                  <option value="Refund">Refund</option>
                </select>
              </div>
              
              {paymentMethod === 'Credit Card' && (
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Credit Card Charges (£)</label>
                  <input type="number" step="0.01" value={cardCharges} onChange={e => setCardCharges(e.target.value)} className="w-full bg-white border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all" placeholder="0.00" />
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Notes (Optional)</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-white border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl px-4 py-2.5 text-slate-800 text-[13px] outline-none transition-all placeholder:text-slate-400" placeholder="Any reference numbers or notes..." />
          </div>

          <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3 -mx-6 -mb-6 mt-6 shrink-0">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-slate-600 hover:bg-slate-200/50 transition-all">Cancel</button>
            <button type="submit" disabled={saving} className={`px-6 py-2.5 rounded-xl text-white text-[13px] font-bold shadow-md transition-all flex items-center gap-2 active:scale-95 ${isVendor ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/25' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25'}`}>
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (initialData ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />)}
              {initialData ? 'Save Changes' : 'Record Transaction'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
