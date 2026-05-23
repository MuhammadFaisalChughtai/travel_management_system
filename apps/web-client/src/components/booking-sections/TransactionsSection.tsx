import { useState, useEffect } from 'react';
import type { BookingDetail } from '../../types/booking';
import { ArrowDownLeft, ArrowUpRight, Clock, AlertCircle, Percent, Receipt, RefreshCcw, Tag } from 'lucide-react';
import { api } from '../../api/axios';

interface TransactionsSectionProps {
  booking: BookingDetail;
  onAddDiscount?: () => void;
  onLogRefund?: () => void;
}

export function TransactionsSection({ booking, onAddDiscount, onLogRefund }: TransactionsSectionProps) {
  const [filter, setFilter] = useState<'All' | 'Received from Client' | 'Sent to Vendor'>('All');
  const [customMarginPercentage, setCustomMarginPercentage] = useState<string>('0');
  const [marginPercentage, setMarginPercentage] = useState<number>(0);
  const [loadingMargin, setLoadingMargin] = useState(false);

  // Parse Booking Total
  const bookingTotal = parseFloat(booking.totalPrice) || 0;

  // Calculate Totals first so we can use netProfit for agent margin
  const clientPayments = booking.payments?.filter(p => p.paymentType === 'Received from Client').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0;
  const vendorPayments = booking.payments?.filter(p => p.paymentType === 'Sent to Vendor').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0;
  const totalDiscounts = booking.discounts?.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0) || 0;
  const refundsToClient = booking.refunds?.filter(r => r.direction === 'Refund to Client').reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0) || 0;
  const refundsFromVendor = booking.refunds?.filter(r => r.direction === 'Refund from Vendor').reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0) || 0;

  const moneyIn = clientPayments + refundsFromVendor + totalDiscounts;
  const moneyOut = vendorPayments + refundsToClient;
  const netProfit = moneyIn - moneyOut;

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

  const agentMargin = (netProfit * marginPercentage) / 100;



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

  const filteredTransactions = booking.payments?.filter(p => filter === 'All' || p.paymentType === filter) || [];

  // Sort by date descending
  filteredTransactions.sort((a, b) => new Date(b.paidOn).getTime() - new Date(a.paidOn).getTime());

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

          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {/* Total Cost */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <p className="text-[9px] text-indigo-200 font-bold uppercase mb-1">Total Cost</p>
              <p className="font-black text-white text-lg">£{bookingTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>

            {/* Total Received */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <p className="text-[9px] text-indigo-200 font-bold uppercase mb-1">Total Received</p>
              <p className="font-black text-emerald-400 text-lg">£{(clientPayments + refundsFromVendor).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              {refundsFromVendor > 0 && <p className="text-[8px] text-emerald-300 mt-0.5">Includes £{refundsFromVendor.toFixed(2)} Refund from Vendor</p>}
            </div>

            {/* Total Sent */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <p className="text-[9px] text-indigo-200 font-bold uppercase mb-1">Total Sent</p>
              <p className="font-black text-red-400 text-lg">£{(vendorPayments + refundsToClient).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              {refundsToClient > 0 && <p className="text-[8px] text-red-300 mt-0.5">Includes £{refundsToClient.toFixed(2)} Refund to Client</p>}
            </div>

            {/* Discounts */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <p className="text-[9px] text-indigo-200 font-bold uppercase mb-1">Discounts Saved</p>
              <p className="font-black text-amber-400 text-lg">£{totalDiscounts.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>

            {/* Agent Margin — informational only, NOT added to net profit */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/10 relative">
              <p className="text-[9px] text-indigo-200 font-bold uppercase mb-1">
                Agent Margin {loadingMargin ? <span className="animate-pulse">...</span> : `(${marginPercentage}%)`}
              </p>
              {netProfit > 100000 && marginPercentage === 0 && !loadingMargin ? (
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-blue-400 text-lg">£{agentMargin.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  <input type="number" value={customMarginPercentage} onChange={e => {
                    setCustomMarginPercentage(e.target.value);
                    setMarginPercentage(parseFloat(e.target.value) || 0);
                  }} className="w-10 bg-white/10 text-white text-[9px] px-1 py-0.5 rounded border border-white/20 outline-none" placeholder="%" />
                </div>
              ) : (
                <div className="font-black text-blue-400 text-lg">
                  {loadingMargin ? <div className="w-4 h-4 mt-1 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" /> : `£${agentMargin.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                </div>
              )}
              <p className="text-[8px] text-indigo-300 mt-0.5 italic">On net profit</p>
            </div>

            {/* Net Profit — colour-coded */}
            <div className={`rounded-xl p-3 border ${netProfit >= 0 ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-red-500/20 border-red-500/30'}`}>
              <p className="text-[9px] text-emerald-100 font-bold uppercase mb-1">Net Profit</p>
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
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-500" /> Transaction History
          </h3>
          <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
            {['All', 'Received from Client', 'Sent to Vendor'].map(f => (
              <button 
                key={f} 
                onClick={() => setFilter(f as any)}
                className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${filter === f ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {f === 'Received from Client' ? 'Client' : f === 'Sent to Vendor' ? 'Vendor' : 'All'}
              </button>
            ))}
          </div>
        </div>

        {filteredTransactions.length === 0 && (!booking.refunds || booking.refunds.length === 0) && (!booking.discounts || booking.discounts.length === 0) ? (
          <div className="text-center py-8 text-slate-400">
            <Receipt className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="text-[12px] font-medium">No transactions found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTransactions.map(t => {
              const isReceived = t.paymentType === 'Received from Client';
              return (
                <div key={t.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isReceived ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                      {isReceived ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-[12px] text-slate-800">{t.paymentType}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-semibold text-slate-500">{new Date(t.paidOn).toLocaleDateString()}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                        <span className="text-[10px] font-semibold text-slate-500">{t.paymentMethod}</span>
                      </div>
                      {t.notes && <p className="text-[10px] text-slate-400 mt-1 italic">"{t.notes}"</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-black text-[14px] ${isReceived ? 'text-emerald-600' : 'text-red-600'}`}>
                      {isReceived ? '+' : '-'}£{parseFloat(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Amount</p>
                  </div>
                </div>
              );
            })}
            {booking.refunds?.map(r => {
              const isFromVendor = r.direction === 'Refund from Vendor';
              return (
                <div key={`ref-${r.id}`} className="flex items-center justify-between p-4 rounded-xl border border-rose-100 bg-rose-50/50 hover:bg-rose-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isFromVendor ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                      <RefreshCcw className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-[12px] text-rose-800">{r.direction} <span className="text-rose-500 font-medium">({r.vendorCategory})</span></h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-semibold text-rose-500">{new Date(r.date).toLocaleDateString()}</span>
                        {r.serviceName && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-rose-300"></span>
                            <span className="text-[10px] font-semibold text-rose-600">{r.serviceName}</span>
                          </>
                        )}
                      </div>
                      {r.notes && <p className="text-[10px] text-rose-400 mt-1 italic">"{r.notes}"</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-black text-[14px] ${isFromVendor ? 'text-emerald-600' : 'text-red-600'}`}>
                      {isFromVendor ? '+' : '-'}£{parseFloat(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[9px] text-rose-400 font-bold uppercase mt-0.5">Refund</p>
                  </div>
                </div>
              );
            })}
            {booking.discounts?.map(d => {
              return (
                <div key={`disc-${d.id}`} className="flex items-center justify-between p-4 rounded-xl border border-amber-100 bg-amber-50/50 hover:bg-amber-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-emerald-100 text-emerald-600">
                      <Tag className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-[12px] text-amber-800">Discount Received <span className="text-amber-500 font-medium">({d.vendorCategory})</span></h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-semibold text-amber-600">{new Date(d.date).toLocaleDateString()}</span>
                        {d.serviceName && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-amber-300"></span>
                            <span className="text-[10px] font-semibold text-amber-600">{d.serviceName}</span>
                          </>
                        )}
                      </div>
                      {d.notes && <p className="text-[10px] text-amber-600 mt-1 italic">"{d.notes}"</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-[14px] text-emerald-600">
                      +£{parseFloat(d.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[9px] text-amber-500 font-bold uppercase mt-0.5">Discount</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
