import { X } from 'lucide-react';
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
    const legacy = booking.payments?.filter(p => p.paymentType === 'Sent to Vendor' && p.notes?.toLowerCase().includes(category.toLowerCase())).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0;
    const modern = booking.vendorPayments?.filter(vp => {
      const notesMatch = vp.notes?.toLowerCase().includes(category.toLowerCase());
      if (category === 'flight') {
        return notesMatch || !!vp.flightPnr;
      }
      if (category === 'hotel' || category === 'accommodation') {
        return notesMatch || !!vp.reservationNumber;
      }
      return notesMatch;
    }).reduce((sum, vp) => sum + (parseFloat(vp.amount.toString()) || 0), 0) || 0;
    return legacy + modern;
  };
  
  const spendFlight = getVendorPayments('flight');
  const spendHotel = getVendorPayments('hotel') + getVendorPayments('accommodation');
  const spendVisa = getVendorPayments('visa');
  const spendTransport = getVendorPayments('transport');
  
  const legacyVendorPayments = booking.payments?.filter(p => p.paymentType === 'Sent to Vendor').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0;
  const modernVendorPayments = booking.vendorPayments?.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0;
  const totalVendorPayments = legacyVendorPayments + modernVendorPayments;
  const spendOther = Math.max(0, totalVendorPayments - (spendFlight + spendHotel + spendVisa + spendTransport));

  const totalReceived = booking.payments?.filter(p => p.paymentType === 'Received from Client' && (!p.status || p.status === 'approved')).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0;
  const totalDiscounts = booking.discounts?.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0) || 0;
  
  const clientRefunds = booking.refunds?.filter(r => r.direction === 'Refund to Client').reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0) || 0;
  const vendorRefunds = booking.refunds?.filter(r => r.direction === 'Refund from Vendor').reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0) || 0;
  const marginPaidToAgentGross = booking.payments?.filter(p => p.paymentType === 'Margin Paid to Agent' && parseFloat(p.amount) > 0).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0;
  const marginClawback = Math.abs(booking.payments?.filter(p => p.paymentType === 'Margin Paid to Agent' && parseFloat(p.amount) < 0).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0);
  const creditCardCharges = booking.payments?.filter(p => p.paymentType === 'Credit Card Charges').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0;

  const bookingTotal = parseFloat(booking.totalPrice || '0') || 0;
  const netReceived = Math.min(totalReceived, bookingTotal) - clientRefunds;
  const netSent = totalVendorPayments - vendorRefunds;
  const netProfit = (netReceived - netSent) + totalDiscounts - marginPaidToAgentGross + marginClawback - creditCardCharges;

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
        className="relative w-full max-w-2xl bg-[#f8f9fa] border border-slate-300 shadow-[0_0_40px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Ledger Header Area */}
        <div className="bg-white px-8 py-6 border-b-2 border-slate-800 flex justify-between items-start relative">
          <div>
            <h2 className="text-3xl font-serif text-slate-900 uppercase tracking-widest">Profit Ledger</h2>
            <p className="text-slate-500 text-xs mt-1 font-mono tracking-wider">REF: {booking.bookingReference} | {new Date().toLocaleDateString()}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-800 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 overflow-y-auto bg-[#fdfdfd]">
          <table className="w-full text-sm font-sans">
            <thead>
              <tr className="border-b-2 border-slate-800 text-slate-600 uppercase text-xs tracking-wider">
                <th className="text-left py-3 font-bold w-1/2">Description</th>
                <th className="text-right py-3 font-bold px-4 border-l border-slate-200">Debit (DR)</th>
                <th className="text-right py-3 font-bold px-4 border-l border-slate-200">Credit (CR)</th>
              </tr>
            </thead>
            <tbody className="font-mono text-slate-800 text-[13px]">
              
              <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="py-4 font-semibold text-sans text-sm text-slate-700">Client Deposits</td>
                <td className="text-right py-4 px-4 border-l border-slate-200 text-slate-300">-</td>
                <td className="text-right py-4 px-4 border-l border-slate-200 font-medium">£{totalReceived.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
              
              <tr className="border-b border-slate-50">
                <td className="py-2 pt-4 pl-4 text-slate-500 text-xs italic font-sans">Vendor Expenditure: Flights</td>
                <td className="text-right py-2 px-4 border-l border-slate-200">£{spendFlight.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="text-right py-2 px-4 border-l border-slate-200 text-slate-300">-</td>
              </tr>
              <tr className="border-b border-slate-50">
                <td className="py-2 pl-4 text-slate-500 text-xs italic font-sans">Vendor Expenditure: Hotels</td>
                <td className="text-right py-2 px-4 border-l border-slate-200">£{spendHotel.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="text-right py-2 px-4 border-l border-slate-200 text-slate-300">-</td>
              </tr>
              <tr className="border-b border-slate-50">
                <td className="py-2 pl-4 text-slate-500 text-xs italic font-sans">Vendor Expenditure: Visas</td>
                <td className="text-right py-2 px-4 border-l border-slate-200">£{spendVisa.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="text-right py-2 px-4 border-l border-slate-200 text-slate-300">-</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 pb-4 pl-4 text-slate-500 text-xs italic font-sans">Vendor Expenditure: Transport</td>
                <td className="text-right py-2 px-4 border-l border-slate-200">£{spendTransport.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="text-right py-2 px-4 border-l border-slate-200 text-slate-300">-</td>
              </tr>
              
              {spendOther > 0 && (
                <tr className="border-b border-slate-100">
                  <td className="py-3 pl-4 text-slate-500 text-xs italic font-sans">Other Vendor Spend</td>
                  <td className="text-right py-3 px-4 border-l border-slate-200">£{spendOther.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="text-right py-3 px-4 border-l border-slate-200 text-slate-300">-</td>
                </tr>
              )}

              <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="py-4 font-semibold text-sans text-sm text-slate-700">Discounts Applied</td>
                <td className="text-right py-4 px-4 border-l border-slate-200 text-slate-300">-</td>
                <td className="text-right py-4 px-4 border-l border-slate-200">£{totalDiscounts.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>

              <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors bg-red-50/20">
                <td className="py-4 font-semibold text-sans text-sm text-red-700">Refunds to Client</td>
                <td className="text-right py-4 px-4 border-l border-slate-200 text-red-700">£{clientRefunds.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="text-right py-4 px-4 border-l border-slate-200 text-slate-300">-</td>
              </tr>

              <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors bg-emerald-50/20">
                <td className="py-4 font-semibold text-sans text-sm text-emerald-700">Refunds from Vendor</td>
                <td className="text-right py-4 px-4 border-l border-slate-200 text-slate-300">-</td>
                <td className="text-right py-4 px-4 border-l border-slate-200 text-emerald-700">£{vendorRefunds.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>

              <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors bg-amber-50/20">
                <td className="py-4 font-semibold text-sans text-sm text-amber-700">Margin Paid to Agent</td>
                <td className="text-right py-4 px-4 border-l border-slate-200 text-amber-700">£{marginPaidToAgentGross.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="text-right py-4 px-4 border-l border-slate-200 text-slate-300">-</td>
              </tr>

              {marginClawback > 0 && (
                <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors bg-purple-50/20">
                  <td className="py-4 font-semibold text-sans text-sm text-purple-700">Margin Clawback from Agent</td>
                  <td className="text-right py-4 px-4 border-l border-slate-200 text-slate-300">-</td>
                  <td className="text-right py-4 px-4 border-l border-slate-200 text-purple-700">£{marginClawback.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                </tr>
              )}

              <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors bg-orange-50/20">
                <td className="py-4 font-semibold text-sans text-sm text-orange-700">Credit Card Charges</td>
                <td className="text-right py-4 px-4 border-l border-slate-200 text-orange-700">£{creditCardCharges.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="text-right py-4 px-4 border-l border-slate-200 text-slate-300">-</td>
              </tr>

            </tbody>
            <tfoot>
              <tr className="border-t-[3px] border-double border-slate-800 bg-slate-100">
                <td className="py-4 px-3 uppercase tracking-widest font-bold text-slate-900 text-xs">Closing Balance (Net Profit)</td>
                <td className="text-right py-4 px-4 border-l border-slate-300 bg-slate-50"></td>
                <td className={`text-right py-4 px-4 border-l border-slate-300 font-mono font-bold text-lg ${netProfit >= 0 ? 'text-emerald-700 bg-emerald-50/50' : 'text-red-700 bg-red-50/50'}`}>
                  £{netProfit.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </td>
              </tr>
            </tfoot>
          </table>
          
          <div className="mt-8 text-center text-[10px] text-slate-400 font-mono uppercase tracking-widest border-t border-slate-200 pt-4">
            *** End of Ledger ***
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
