import { useState, useEffect } from 'react';
import type { BookingDetail, Refund } from '../../types/booking';
import { EmptyState } from '../shared/EmptyState';
import { ArrowDownLeft, ArrowUpRight, Clock, AlertCircle, Percent, Receipt, RefreshCcw, Tag, ChevronDown, ChevronUp, ArrowDownCircle } from 'lucide-react';
import { api } from '../../api/axios';
import { VendorTransactionsModal } from '../booking-modals/VendorTransactionsModal';
import { ClientTransactionsModal } from '../booking-modals/ClientTransactionsModal';
import { ProfitLedgerModal } from '../booking-modals/ProfitLedgerModal';
import { LogRefundModal } from '../booking-modals/LogRefundModal';
import { ClawbackMarginModal } from '../booking-modals/ClawbackMarginModal';
import { UpdateInvoicePriceModal } from '../booking-modals/UpdateInvoicePriceModal';
import { PieChart, CheckCircle2, Edit2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Pagination } from '../shared/Pagination';

interface TransactionsSectionProps {
  booking: BookingDetail;
  onAddDiscount?: () => void;
  onLogRefund?: (refund: Partial<Refund>) => void;
  onClawbackMargin?: (data: { amount: string; reason: string }) => void;
  onFinalizeMargin?: (data: { amount: string; notes: string }) => void;
  onUpdateInvoicePrice?: (price: string) => Promise<void>;
}

export function TransactionsSection({ booking, onAddDiscount, onLogRefund, onClawbackMargin, onFinalizeMargin, onUpdateInvoicePrice }: TransactionsSectionProps) {
  const [filter, setFilter] = useState<'All' | 'Received from Client' | 'Sent to Vendor' | 'Margin Paid to Agent'>('All');
  const [customMarginPercentage, setCustomMarginPercentage] = useState<string>('0');
  const [marginPercentage, setMarginPercentage] = useState<number>(0);
  const [loadingMargin, setLoadingMargin] = useState(false);
  const [showVendorTransactions, setShowVendorTransactions] = useState(false);
  const [showClientTransactions, setShowClientTransactions] = useState(false);
  const [showProfitLedger, setShowProfitLedger] = useState(false);
  const [showLogRefundModal, setShowLogRefundModal] = useState(false);
  const [showClawbackModal, setShowClawbackModal] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);
  const [showUpdatePriceModal, setShowUpdatePriceModal] = useState(false);

  // Parse Booking Total
  const bookingTotal = parseFloat(booking.totalPrice) || 0;

  // Calculate Totals first so we can use netProfit for agent margin
  const clientPayments = booking.payments?.filter(p => p.paymentType === 'Received from Client').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0;
  const legacyVendorPayments = booking.payments?.filter(p => p.paymentType === 'Sent to Vendor').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0;
  const modernVendorPayments = booking.vendorPayments?.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0;
  const vendorPayments = legacyVendorPayments + modernVendorPayments;

  const flightCost = booking.flightServices?.reduce((sum, f) => sum + (parseFloat(f.price) || 0), 0) || 0;
  const accCost = booking.accommodations?.reduce((sum, a) => sum + (parseFloat(a.price) || 0), 0) || 0;
  const transCost = booking.transportServices?.reduce((sum, t) => sum + (parseFloat(t.price) || 0), 0) || 0;
  const visaCost = booking.visaServices?.reduce((sum, v) => sum + (parseFloat(v.price) || 0), 0) || 0;
  const addCost = booking.additionalServices?.reduce((sum, s) => sum + (parseFloat(s.charges) || 0), 0) || 0;
  const totalVendorCost = flightCost + accCost + transCost + visaCost + addCost;
  const remainingVendorPay = Math.max(0, totalVendorCost - vendorPayments);
  const totalDiscounts = booking.discounts?.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0) || 0;
  const refundsToClient = booking.refunds?.filter(r => r.direction === 'Refund to Client').reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0) || 0;
  const refundsFromVendor = booking.refunds?.filter(r => r.direction === 'Refund from Vendor').reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0) || 0;

  const netReceived = Math.min(clientPayments - refundsToClient, bookingTotal);
  const netSent = vendorPayments - refundsFromVendor;
  
  // Remaining Balance compares the Invoice Price against the net payments received (payments minus refunds)
  const clientBalance = bookingTotal - (clientPayments - refundsToClient);
  
  const marginPaidToAgent = booking.payments?.filter(p => p.paymentType === 'Margin Paid to Agent').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0;
  const creditCardCharges = booking.payments?.filter(p => p.paymentType === 'Credit Card Charges').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0;
  
  const netProfit = (netReceived - netSent) + totalDiscounts - marginPaidToAgent - creditCardCharges;

  // Fetch Agent Margin based on Slabs (evaluated against net profit)
  useEffect(() => {
    if (!booking.agentName || booking.agentName === 'System / Auto' || booking.agentName === 'Any') {
      setMarginPercentage(0);
      return;
    }

    const fetchAgentMargin = async () => {
      setLoadingMargin(true);
      try {
        const res = await api.get(`/agents/by-name/${encodeURIComponent(booking.agentName!)}`);
        const segments = res.data.agent?.marginSegments || [];
        
        // Find matching segment based on bookingTotal (Total Cost)
        const match = segments.find((s: any) => {
          const min = parseFloat(s.minAmount) || 0;
          const max = s.maxAmount ? parseFloat(s.maxAmount) : Infinity;
          return bookingTotal >= min && bookingTotal <= max;
        });

        if (match) {
          setMarginPercentage(parseFloat(match.marginPercent) || 0);
        } else {
          setMarginPercentage(0); 
        }
      } catch (err: any) {
        if (err.response?.status !== 404) {
          console.error('Failed to fetch agent margin', err);
        }
        setMarginPercentage(0);
      } finally {
        setLoadingMargin(false);
      }
    };

    fetchAgentMargin();
  }, [booking.agentName, bookingTotal]);

  // Calculate total agent margin based on the profit BEFORE deducting what was already paid to the agent
  const totalAgentMargin = ((netProfit + marginPaidToAgent) * marginPercentage) / 100;
  const remainingAgentMargin = Math.max(0, totalAgentMargin - marginPaidToAgent);

  // Gross margin % (profit as a % of net total received — shown as informational)
  const grossMarginPct = (clientPayments - refundsToClient) > 0 ? (netProfit / (clientPayments - refundsToClient)) * 100 : 0;

  // Identify Pending Vendor Payments
  const hasServices = (booking.flightServices?.length || 0) + (booking.accommodations?.length || 0) + (booking.transportServices?.length || 0) > 0;
  const hasPendingVendorPayments = hasServices && vendorPayments === 0;

  const allCombinedTransactions = [
    ...(booking.payments?.map(p => ({ ...p, _type: 'payment' })) || []),
    ...(booking.vendorPayments?.map(vp => ({
      ...vp,
      _type: 'vendorPayment',
      id: `vp-${vp.id}`,
      paymentType: 'Sent to Vendor',
      paymentMethod: vp.vendorName
    })) || []),
    ...(booking.refunds?.map(r => ({ ...r, _type: 'refund', paidOn: r.date })) || []),
    ...(booking.discounts?.map(d => ({ ...d, _type: 'discount', paidOn: d.date })) || [])
  ];

  const filteredTransactions = allCombinedTransactions.filter(p => {
    if (filter === 'All') return true;
    if (p._type === 'payment' || p._type === 'vendorPayment') return (p as any).paymentType === filter;
    return false; // hide refunds and discounts when a specific payment type filter is selected
  });

  // Sort by date descending
  filteredTransactions.sort((a, b) => new Date(b.paidOn || new Date()).getTime() - new Date(a.paidOn || new Date()).getTime());

  const [txPage, setTxPage] = useState(1);
  const txPerPage = 10;
  useEffect(() => { setTxPage(1); }, [filter, booking]);

  const paginatedTxs = filteredTransactions.slice((txPage - 1) * txPerPage, txPage * txPerPage);

  const isOverpaid = (clientPayments - refundsToClient) > bookingTotal;
  const isFinalizeDisabled = (vendorPayments < totalVendorCost) || isOverpaid;
  const finalizeTitle = isOverpaid 
    ? "Unallocated funds detected. Please either Log a Refund or Update the Invoice Price to proceed." 
    : vendorPayments < totalVendorCost 
      ? "Cannot finalize until all vendor payments meet or exceed booking cost" 
      : "Finalize margin and credit agent";

  return (
    <div className="space-y-6">
      {/* Financial Summary Card */}
      <div className="bg-gradient-to-br from-indigo-900 to-indigo-800 rounded-2xl shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-20 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl -mb-10"></div>
        
        <div className="relative z-10 p-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-white font-bold text-lg">Financial Summary</h3>
              <p className="text-indigo-200 text-[11px] uppercase tracking-wide font-bold mt-1">Real-time Booking Profitability</p>
            </div>
            <div className="flex gap-2">
              {onAddDiscount && (
                <button onClick={onAddDiscount} className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border border-white/10 flex items-center gap-1.5">
                  <Percent className="w-3 h-3" /> Add Discount
                </button>
              )}
              {onLogRefund && (
                <button onClick={() => setShowLogRefundModal(true)} className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border border-white/10 flex items-center gap-1.5">
                  <RefreshCcw className="w-3 h-3" /> Log Refund
                </button>
              )}
              {onFinalizeMargin && booking.marginStatus !== 'Finalized' && booking.marginStatus !== 'Paid' && (
                <button 
                  onClick={() => onFinalizeMargin({ amount: remainingAgentMargin.toString(), notes: '' })} 
                  disabled={isFinalizeDisabled}
                  title={finalizeTitle}
                  className="bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-100 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border border-emerald-500/30 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
                  <CheckCircle2 className="w-3 h-3" /> Finalize Margin
                </button>
              )}
              {onClawbackMargin && (
                <button onClick={() => setShowClawbackModal(true)} className="bg-purple-500/20 hover:bg-purple-500/40 text-purple-100 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border border-purple-500/30 flex items-center gap-1.5">
                  <ArrowDownCircle className="w-3 h-3" /> Clawback Margin
                </button>
              )}
            </div>
          </div>

          {isOverpaid && (
            <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Unallocated funds detected. Please either Log a Refund or Update the Invoice Price to proceed.</span>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-9 gap-3">
            {/* Invoice Price */}
            <div 
              className={`bg-white/5 rounded-xl p-3 border border-white/10 ${onUpdateInvoicePrice ? 'group cursor-pointer hover:bg-white/10 hover:border-indigo-400/30 transition-all shadow-sm' : ''}`}
              onClick={() => {
                if (onUpdateInvoicePrice) {
                  setShowUpdatePriceModal(true);
                }
              }}
            >
              <p className="text-[9px] text-indigo-200 font-bold uppercase mb-1 flex items-center justify-between">
                <span>Invoice Price</span>
                {onUpdateInvoicePrice && <Edit2 className="w-3 h-3 text-indigo-300 opacity-60 group-hover:opacity-100 transition-opacity" />}
              </p>
              <p className="font-black text-white text-lg">£{bookingTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>

            {/* Total Received (Net) */}
            <div 
              className="bg-white/5 rounded-xl p-3 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
              onClick={() => setShowClientTransactions(true)}
            >
              <p className="text-[9px] text-indigo-200 font-bold uppercase mb-1 flex items-center justify-between">Total Received <ArrowDownLeft className="w-3 h-3 text-emerald-400 opacity-50" /></p>
              <p className="font-black text-emerald-400 text-lg">£{(clientPayments - refundsToClient).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>

            {/* Refunds to Client */}
            <div 
              className="bg-white/5 rounded-xl p-3 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
              onClick={() => setShowClientTransactions(true)}
            >
              <p className="text-[9px] text-indigo-200 font-bold uppercase mb-1 flex items-center justify-between">Total Refunded <RefreshCcw className="w-3 h-3 text-rose-400 opacity-50" /></p>
              <p className="font-black text-rose-400 text-lg">£{refundsToClient.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>

            {/* Remaining Balance */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <p className="text-[9px] text-indigo-200 font-bold uppercase mb-1">Remaining Balance</p>
              <p className={`font-black text-lg ${clientBalance > 0 ? 'text-amber-400' : clientBalance < 0 ? 'text-rose-400' : 'text-slate-300'}`}>£{Math.abs(clientBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              {clientBalance === 0 ? (
                <p className="text-[8px] text-emerald-300 mt-0.5 font-bold">Fully Paid</p>
              ) : clientBalance < 0 ? (
                <p className="text-[8px] text-rose-300 mt-0.5 font-bold">Overpaid</p>
              ) : (
                <p className="text-[8px] text-amber-300/70 mt-0.5">Pending Payment</p>
              )}
            </div>

            {/* Total Sent */}
            <div 
              className="bg-white/5 rounded-xl p-3 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
              onClick={() => setShowVendorTransactions(true)}
            >
              <p className="text-[9px] text-indigo-200 font-bold uppercase mb-1 flex items-center justify-between">Total Sent <ArrowUpRight className="w-3 h-3 text-red-400 opacity-50" /></p>
              <p className="font-black text-red-400 text-lg">£{netSent.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              {refundsFromVendor > 0 && <p className="text-[8px] text-red-300 mt-0.5">After £{refundsFromVendor.toFixed(2)} refunded by vendor</p>}
            </div>

            {/* Remaining to Pay Vendors */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <p className="text-[9px] text-indigo-200 font-bold uppercase mb-1">Remaining to Pay</p>
              <p className={`font-black text-lg ${remainingVendorPay > 0 ? 'text-amber-400' : 'text-slate-300'}`}>£{remainingVendorPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              {remainingVendorPay === 0 ? (
                <p className="text-[8px] text-emerald-300 mt-0.5 font-bold">All Vendors Paid</p>
              ) : (
                <p className="text-[8px] text-amber-300/70 mt-0.5">Owed to vendors</p>
              )}
            </div>

            {/* Discounts */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <p className="text-[9px] text-indigo-200 font-bold uppercase mb-1">Discounts Saved</p>
              <p className="font-black text-amber-400 text-lg">£{totalDiscounts.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>

            {/* Agent Margin */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/10 relative">
              <p className="text-[9px] text-indigo-200 font-bold uppercase mb-1">
                Remaining Margin {loadingMargin ? <span className="animate-pulse">...</span> : `(${marginPercentage}%)`}
              </p>
              {netProfit > 100000 && marginPercentage === 0 && !loadingMargin ? (
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-blue-400 text-lg">£{remainingAgentMargin.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  <input type="number" value={customMarginPercentage} onChange={e => {
                    setCustomMarginPercentage(e.target.value);
                    setMarginPercentage(parseFloat(e.target.value) || 0);
                  }} className="w-10 bg-white/10 text-white text-[9px] px-1 py-0.5 rounded border border-white/20 outline-none" placeholder="%" />
                </div>
              ) : (
                <div className="font-black text-blue-400 text-lg">
                  {loadingMargin ? <div className="w-4 h-4 mt-1 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" /> : `£${remainingAgentMargin.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                </div>
              )}
              <p className="text-[8px] text-indigo-300 mt-0.5 italic">Remaining to pay</p>
              {marginPaidToAgent > 0 && (
                <p className="text-[10px] text-emerald-400 font-bold mt-1">Paid: £{marginPaidToAgent.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              )}
            </div>

            {/* Net Profit */}
            <div 
              className={`rounded-xl p-3 border cursor-pointer hover:bg-emerald-500/30 transition-colors ${netProfit >= 0 ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-red-500/20 border-red-500/30'}`}
              onClick={() => setShowProfitLedger(true)}
            >
              <p className="text-[9px] text-emerald-100 font-bold uppercase mb-1 flex items-center justify-between">Net Profit <PieChart className="w-3 h-3 text-emerald-100 opacity-50" /></p>
              <p className={`font-black text-xl ${netProfit >= 0 ? 'text-white' : 'text-red-300'}`}>
                {netProfit < 0 ? '-' : ''}£{Math.abs(netProfit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[8px] text-emerald-200 mt-0.5">
                {grossMarginPct.toFixed(1)}% margin
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Vendor Payments Alert */}
      {hasPendingVendorPayments && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-[12px] font-bold text-amber-800">Pending Vendor Payments</h4>
            <p className="text-[11px] text-amber-700 mt-0.5">There are services added to this booking, but no vendor payments have been logged yet. Please ensure vendors are paid to secure the bookings.</p>
          </div>
        </div>
      )}

      {/* Transaction Timeline */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div 
          className="flex justify-between items-center p-6 cursor-pointer hover:bg-slate-50 transition-colors"
          onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
        >
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-500" /> Transaction History
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex gap-2 bg-slate-100 p-1 rounded-lg" onClick={(e) => e.stopPropagation()}>
              {['All', 'Received from Client', 'Sent to Vendor', 'Margin Paid to Agent'].map(f => (
                <button 
                  key={f} 
                  onClick={() => setFilter(f as any)}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${filter === f ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {f === 'Received from Client' ? 'Client' : f === 'Sent to Vendor' ? 'Vendor' : f === 'Margin Paid to Agent' ? 'Margin' : 'All'}
                </button>
              ))}
            </div>
            <button className="text-slate-400 hover:text-slate-600 transition-colors">
              {isHistoryExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {isHistoryExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-slate-100 overflow-hidden"
            >
              <div className="p-6 pt-4">
                {filteredTransactions.length === 0 && (!booking.refunds || booking.refunds.length === 0) && (!booking.discounts || booking.discounts.length === 0) ? (
                  <EmptyState
                    icon={Receipt}
                    title="No financial records"
                    description="Log a client payment or vendor payment to begin."
                    size="sm"
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                      <thead>
                        <tr className="border-b border-slate-200 text-[10px] uppercase text-slate-400 bg-slate-50/50">
                          <th className="py-2 px-4 font-bold rounded-tl-xl">Date</th>
                          <th className="py-2 px-4 font-bold">Type</th>
                          <th className="py-2 px-4 font-bold w-full">Details</th>
                          <th className="py-2 px-4 font-bold text-right rounded-tr-xl">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="text-[12px]">
                        {paginatedTxs.map((item: any) => {
                          if (item._type === 'payment' || item._type === 'vendorPayment') {
                            const t = item;
                            const isReceived = t.paymentType === 'Received from Client';
                            return (
                              <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                                <td className="py-2 px-4 text-slate-500">{new Date(t.paidOn || new Date()).toLocaleDateString()}</td>
                                <td className="py-2 px-4 font-bold text-slate-800">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isReceived ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                      {isReceived ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                                    </div>
                                    {t.paymentType}
                                  </div>
                                </td>
                                <td className="py-2 px-4">
                                  <div className="flex flex-col">
                                    <span className="text-slate-600 font-medium">{t.paymentMethod}</span>
                                    {t.notes && <span className="text-[10px] text-slate-400 italic whitespace-normal">"{t.notes}"</span>}
                                  </div>
                                </td>
                                <td className={`py-2 px-4 text-right font-black ${isReceived ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {isReceived ? '+' : '-'}£{parseFloat(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            );
                          }
                          
                          if (item._type === 'refund') {
                            const r = item;
                            const isFromVendor = r.direction === 'Refund from Vendor';
                            return (
                              <tr key={`ref-${r.id}`} className="border-b border-slate-100 hover:bg-rose-50/50 transition-colors">
                                <td className="py-2 px-4 text-slate-500">{new Date(r.date).toLocaleDateString()}</td>
                                <td className="py-2 px-4 font-bold text-rose-800">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isFromVendor ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                      <RefreshCcw className="w-3 h-3" />
                                    </div>
                                    {r.direction} <span className="text-rose-500 font-medium text-[10px]">({r.vendorCategory})</span>
                                  </div>
                                </td>
                                <td className="py-2 px-4">
                                  <div className="flex flex-col">
                                    {r.serviceName && <span className="text-rose-600 font-medium">{r.serviceName}</span>}
                                    {r.notes && <span className="text-[10px] text-rose-400 italic whitespace-normal">"{r.notes}"</span>}
                                  </div>
                                </td>
                                <td className={`py-2 px-4 text-right font-black ${isFromVendor ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {isFromVendor ? '+' : '-'}£{parseFloat(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            );
                          }

                          if (item._type === 'discount') {
                            const d = item;
                            return (
                              <tr key={`disc-${d.id}`} className="border-b border-slate-100 hover:bg-amber-50/50 transition-colors">
                                <td className="py-2 px-4 text-slate-500">{new Date(d.date).toLocaleDateString()}</td>
                                <td className="py-2 px-4 font-bold text-amber-800">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full flex items-center justify-center bg-emerald-100 text-emerald-600">
                                      <Tag className="w-3 h-3" />
                                    </div>
                                    Discount Received <span className="text-amber-500 font-medium text-[10px]">({d.vendorCategory})</span>
                                  </div>
                                </td>
                                <td className="py-2 px-4">
                                  <div className="flex flex-col">
                                    {d.serviceName && <span className="text-amber-600 font-medium">{d.serviceName}</span>}
                                    {d.notes && <span className="text-[10px] text-amber-600 italic whitespace-normal">"{d.notes}"</span>}
                                  </div>
                                </td>
                                <td className="py-2 px-4 text-right font-black text-emerald-600">
                                  +£{parseFloat(d.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            );
                          }
                          
                          return null;
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {filteredTransactions.length > 0 && (
                  <Pagination 
                    currentPage={txPage} 
                    totalPages={Math.ceil(filteredTransactions.length / txPerPage)} 
                    onPageChange={setTxPage} 
                    itemsPerPage={txPerPage} 
                    totalItems={filteredTransactions.length} 
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showVendorTransactions && (
          <VendorTransactionsModal 
            isOpen={showVendorTransactions}
            onClose={() => setShowVendorTransactions(false)}
            booking={booking}
          />
        )}
        {showClientTransactions && (
          <ClientTransactionsModal 
            isOpen={showClientTransactions}
            onClose={() => setShowClientTransactions(false)}
            booking={booking}
          />
        )}
        {showProfitLedger && (
          <ProfitLedgerModal 
            isOpen={showProfitLedger}
            onClose={() => setShowProfitLedger(false)}
            booking={booking}
          />
        )}
        {showLogRefundModal && onLogRefund && (
          <LogRefundModal
            booking={booking}
            isOpen={showLogRefundModal}
            onClose={() => setShowLogRefundModal(false)}
            onSubmit={onLogRefund}
          />
        )}
        {showClawbackModal && onClawbackMargin && (
          <ClawbackMarginModal
            booking={booking}
            isOpen={showClawbackModal}
            onClose={() => setShowClawbackModal(false)}
            onSubmit={onClawbackMargin}
          />
        )}
        {showUpdatePriceModal && onUpdateInvoicePrice && (
          <UpdateInvoicePriceModal
            booking={booking}
            isOpen={showUpdatePriceModal}
            onClose={() => setShowUpdatePriceModal(false)}
            onSubmit={onUpdateInvoicePrice}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
