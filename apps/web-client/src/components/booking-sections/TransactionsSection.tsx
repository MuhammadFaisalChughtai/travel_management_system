import { useState, useEffect } from 'react';
import type { BookingDetail } from '../../types/booking';
import { ArrowDownLeft, ArrowUpRight, Clock, AlertCircle, Percent, Receipt, RefreshCcw, Tag, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../../api/axios';
import { VendorTransactionsModal } from '../booking-modals/VendorTransactionsModal';
import { ClientTransactionsModal } from '../booking-modals/ClientTransactionsModal';
import { ProfitLedgerModal } from '../booking-modals/ProfitLedgerModal';
import { PieChart } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface TransactionsSectionProps {
  booking: BookingDetail;
  onAddDiscount?: () => void;
  onLogRefund?: () => void;
}

export function TransactionsSection({ booking, onAddDiscount, onLogRefund }: TransactionsSectionProps) {
  const [filter, setFilter] = useState<'All' | 'Received from Client' | 'Sent to Vendor' | 'Margin Paid to Agent'>('All');
  const [customMarginPercentage, setCustomMarginPercentage] = useState<string>('0');
  const [marginPercentage, setMarginPercentage] = useState<number>(0);
  const [loadingMargin, setLoadingMargin] = useState(false);
  const [showVendorTransactions, setShowVendorTransactions] = useState(false);
  const [showClientTransactions, setShowClientTransactions] = useState(false);
  const [showProfitLedger, setShowProfitLedger] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);

  // Parse Booking Total
  const bookingTotal = parseFloat(booking.totalPrice) || 0;

  // Calculate Totals first so we can use netProfit for agent margin
  const clientPayments = booking.payments?.filter(p => p.paymentType === 'Received from Client').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0;
  const legacyVendorPayments = booking.payments?.filter(p => p.paymentType === 'Sent to Vendor').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0;
  const modernVendorPayments = booking.vendorPayments?.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0;
  const vendorPayments = legacyVendorPayments + modernVendorPayments;
  const totalDiscounts = booking.discounts?.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0) || 0;
  const refundsToClient = booking.refunds?.filter(r => r.direction === 'Refund to Client').reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0) || 0;
  const refundsFromVendor = booking.refunds?.filter(r => r.direction === 'Refund from Vendor').reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0) || 0;

  // Strict Net Accounting (Contra-accounts) for Profit calculation
  // CLIENT_REFUND is a contra-revenue (subtracts from Total Received)
  // VENDOR_REFUND is a contra-expense (subtracts from Total Sent)
  const netReceived = clientPayments - refundsToClient;
  const netSent = vendorPayments - refundsFromVendor;
  
  // Remaining Balance should ONLY look at what the client was supposed to pay vs what they physically paid in gross.
  // Refunds do not make the client owe us more money.
  const clientBalance = Math.max(0, bookingTotal - clientPayments);
  
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



  // Correct Net Profit Formula:
  // Money IN  = Client Payments + Refunds received back from Vendor + Discounts saved
  // Money OUT = Vendor Payments + Refunds paid out to Client
  // Agent Margin is a reference KPI (% of net profit) — NOT added to profit as it is
  // already embedded in the spread between client price and vendor cost.

  // Gross margin % (profit as a % of total received — shown as informational)
  const grossMarginPct = clientPayments > 0 ? (netProfit / clientPayments) * 100 : 0;

  // Identify Pending Vendor Payments
  // Rule: Check if we have services but no vendor payment transactions. 
  // For a robust system, we would match vendor names, but as a visual cue we check if vendorPayments is 0 while there are services.
  const hasServices = (booking.flightServices?.length || 0) + (booking.accommodations?.length || 0) + (booking.transportServices?.length || 0) > 0;
  const hasPendingVendorPayments = hasServices && vendorPayments === 0;

  const allCombinedTransactions = [
    ...(booking.payments || []),
    ...(booking.vendorPayments?.map(vp => ({
      id: `vp-${vp.id}`,
      paidOn: vp.paidOn,
      paymentType: 'Sent to Vendor',
      paymentMethod: vp.vendorName,
      amount: vp.amount,
      notes: vp.notes
    })) || [])
  ];

  const filteredTransactions = allCombinedTransactions.filter(p => filter === 'All' || p.paymentType === filter);

  // Sort by date descending
  filteredTransactions.sort((a, b) => new Date(b.paidOn || new Date()).getTime() - new Date(a.paidOn || new Date()).getTime());

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
              <button onClick={onAddDiscount} className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border border-white/10 flex items-center gap-1.5">
                <Percent className="w-3 h-3" /> Add Discount
              </button>
              <button onClick={onLogRefund} className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border border-white/10 flex items-center gap-1.5">
                <RefreshCcw className="w-3 h-3" /> Log Refund
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-8 gap-3">
            {/* Total Cost */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <p className="text-[9px] text-indigo-200 font-bold uppercase mb-1">Total Cost</p>
              <p className="font-black text-white text-lg">£{bookingTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>

            {/* Total Received (Gross) */}
            <div 
              className="bg-white/5 rounded-xl p-3 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
              onClick={() => setShowClientTransactions(true)}
            >
              <p className="text-[9px] text-indigo-200 font-bold uppercase mb-1 flex items-center justify-between">Total Received <ArrowDownLeft className="w-3 h-3 text-emerald-400 opacity-50" /></p>
              <p className="font-black text-emerald-400 text-lg">£{clientPayments.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
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
              <p className={`font-black text-lg ${clientBalance > 0 ? 'text-amber-400' : 'text-slate-300'}`}>£{clientBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              {clientBalance <= 0 ? (
                <p className="text-[8px] text-emerald-300 mt-0.5 font-bold">Fully Paid</p>
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

            {/* Discounts */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <p className="text-[9px] text-indigo-200 font-bold uppercase mb-1">Discounts Saved</p>
              <p className="font-black text-amber-400 text-lg">£{totalDiscounts.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>

            {/* Agent Margin — informational only, NOT added to net profit */}
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

            {/* Net Profit — colour-coded */}
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
                  <div className="text-center py-8 text-slate-400">
                    <Receipt className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-[12px] font-medium">No transactions found.</p>
                  </div>
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
                        {filteredTransactions.map(t => {
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
                        })}
                        {booking.refunds?.map(r => {
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
                        })}
                        {booking.discounts?.map(d => {
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
                        })}
                      </tbody>
                    </table>
                  </div>
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
      </AnimatePresence>
    </div>
  );
}
