import { X, PieChart, Plane, Hotel, Car, FileText, Gift, RefreshCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import type { BookingDetail } from '../../types/booking';

interface ProfitLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingDetail;
}

export function ProfitLedgerModal({ isOpen, onClose, booking }: ProfitLedgerModalProps) {
  if (!isOpen) return null;

  const getVendorPayments = (category: string) => {
    return booking.payments?.filter(p => p.paymentType === 'Sent to Vendor' && p.notes?.toLowerCase().includes(category.toLowerCase())).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0;
  };
  
  // Try to match transactions based on notes since we don't store strict category IDs on the payment model yet.
  const spendFlight = getVendorPayments('flight');
  const spendHotel = getVendorPayments('hotel') + getVendorPayments('accommodation');
  const spendVisa = getVendorPayments('visa');
  const spendTransport = getVendorPayments('transport');
  
  // Calculate exact total vendor payments vs categorized ones to find "Other"
  const totalVendorPayments = booking.payments?.filter(p => p.paymentType === 'Sent to Vendor').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0;
  const spendOther = Math.max(0, totalVendorPayments - (spendFlight + spendHotel + spendVisa + spendTransport));

  const totalReceived = booking.payments?.filter(p => p.paymentType === 'Received from Client').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0;
  const totalDiscounts = booking.discounts?.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0) || 0;
  
  const clientRefunds = booking.refunds?.filter(r => r.direction === 'Refund to Client').reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0) || 0;
  const vendorRefunds = booking.refunds?.filter(r => r.direction === 'Refund from Vendor').reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0) || 0;

  const netReceived = totalReceived - clientRefunds;
  const netSent = totalVendorPayments - vendorRefunds;
  const netProfit = (netReceived - netSent) + totalDiscounts;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-gradient-to-r from-indigo-900 to-indigo-800">
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <PieChart className="w-5 h-5 text-indigo-300" />
            Profit Ledger Breakdown
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-6">
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
              <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Total Client Deposits</p>
              <p className="text-2xl font-black text-emerald-700">£{totalReceived.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
            </div>
            <div className="bg-red-50 rounded-xl p-4 border border-red-100">
              <p className="text-[10px] font-bold text-red-600 uppercase mb-1">Total Vendor Payments</p>
              <p className="text-2xl font-black text-red-700">£{totalVendorPayments.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
            </div>
          </div>

          <div>
            <h3 className="text-[11px] font-bold text-slate-400 uppercase mb-3 px-1 tracking-wider border-b border-slate-100 pb-2">Vendor Spend Breakdown</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2 text-slate-700"><Plane className="w-4 h-4 text-blue-500"/> <span className="font-semibold text-sm">Flights</span></div>
                <span className="font-black text-slate-800">£{spendFlight.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2 text-slate-700"><Hotel className="w-4 h-4 text-purple-500"/> <span className="font-semibold text-sm">Hotels</span></div>
                <span className="font-black text-slate-800">£{spendHotel.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2 text-slate-700"><FileText className="w-4 h-4 text-amber-500"/> <span className="font-semibold text-sm">Visas</span></div>
                <span className="font-black text-slate-800">£{spendVisa.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2 text-slate-700"><Car className="w-4 h-4 text-emerald-500"/> <span className="font-semibold text-sm">Transportation</span></div>
                <span className="font-black text-slate-800">£{spendTransport.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
              {spendOther > 0 && (
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 text-slate-700"><div className="w-4 h-4 rounded-full bg-slate-200" /> <span className="font-semibold text-sm">Other Services</span></div>
                  <span className="font-black text-slate-800">£{spendOther.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-[11px] font-bold text-slate-400 uppercase mb-3 px-1 tracking-wider border-b border-slate-100 pb-2">Adjustments</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-amber-50/50 rounded-lg">
                <div className="flex items-center gap-2 text-amber-700"><Gift className="w-4 h-4 text-amber-500"/> <span className="font-semibold text-sm">Total Discounts</span></div>
                <span className="font-black text-amber-600">+ £{totalDiscounts.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-rose-50/50 rounded-lg">
                <div className="flex items-center gap-2 text-rose-700"><RefreshCcw className="w-4 h-4 text-rose-500"/> <span className="font-semibold text-sm">Refunds to Client</span></div>
                <span className="font-black text-rose-600">- £{clientRefunds.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-emerald-50/50 rounded-lg">
                <div className="flex items-center gap-2 text-emerald-700"><RefreshCcw className="w-4 h-4 text-emerald-500"/> <span className="font-semibold text-sm">Refunds from Vendor</span></div>
                <span className="font-black text-emerald-600">+ £{vendorRefunds.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
            </div>
          </div>
          
          <div className="pt-4 border-t-2 border-slate-100">
            <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-xl border border-indigo-100">
              <span className="font-black text-indigo-900 text-lg uppercase">Net Profit</span>
              <span className="font-black text-indigo-600 text-2xl">£{netProfit.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
          </div>

        </div>
      </motion.div>
    </div>,
    document.body
  );
}
