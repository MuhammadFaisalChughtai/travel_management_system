import { useState, useEffect } from 'react';
import { X, Receipt, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import type { BookingDetail } from '../../types/booking';
import { useCurrency } from '../../utils/currency';

interface UpdateInvoicePriceModalProps {
  booking: BookingDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (price: string) => Promise<void>;
}

export function UpdateInvoicePriceModal({ booking, isOpen, onClose, onSubmit }: UpdateInvoicePriceModalProps) {
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { symbol } = useCurrency();

  // Sync initial price from booking
  useEffect(() => {
    if (booking) {
      setPrice(booking.totalPrice || '');
    }
  }, [booking, isOpen]);

  if (!isOpen || !booking) return null;

  // Calculate overpayment details
  const clientPayments = booking.payments?.filter(p => p.paymentType === 'Received from Client' && (!p.status || p.status === 'approved')).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0;
  const refundsToClient = booking.refunds?.filter(r => r.direction === 'Refund to Client').reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0) || 0;
  const netReceived = clientPayments - refundsToClient;
  const currentInvoicePrice = parseFloat(booking.totalPrice) || 0;
  const overpayment = netReceived > currentInvoicePrice ? netReceived - currentInvoicePrice : 0;

  const handleSave = async () => {
    if (!price || isNaN(parseFloat(price)) || parseFloat(price) < 0) {
      setError('Please enter a valid positive price.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await onSubmit(price);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update invoice price.');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" 
        onClick={onClose} 
      />

      {/* Modal Dialog */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        exit={{ opacity: 0, scale: 0.95, y: 10 }} 
        className="bg-white/95 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white px-6 py-4 flex justify-between items-center shadow-inner">
          <div className="flex items-center gap-3">
            <Receipt className="h-5 w-5 text-indigo-200" />
            <h3 className="font-bold text-[14px] tracking-wide uppercase">Update Invoice Price</h3>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-4">
            <p className="text-[12px] text-slate-600 leading-relaxed">
              Modify the total invoice price for booking <strong className="font-mono">{booking.bookingReference}</strong>. 
              This will update the ledger remaining balance and dynamically recalculate the booking's profitability margins.
            </p>

            {/* Ledger Overpayment Status */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex flex-col gap-2 shadow-inner">
              <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase tracking-wide">
                <span>Current Ledger State</span>
                {overpayment > 0 && <span className="bg-amber-100 text-amber-800 text-[9px] px-2.5 py-0.5 rounded-full font-bold">Overpaid</span>}
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-700">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-slate-400 font-normal uppercase">Total Received (Net)</span>
                  <span className="text-slate-800 font-extrabold text-[13px]">{symbol}{netReceived.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-slate-400 font-normal uppercase">Overpayment Amount</span>
                  <span className={`font-extrabold text-[13px] ${overpayment > 0 ? 'text-amber-600 font-black' : 'text-slate-500'}`}>
                    {symbol}{overpayment.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              {overpayment > 0 && (
                <p className="text-[10px] text-amber-700 leading-normal bg-amber-50 border border-amber-200/50 p-2.5 rounded-lg mt-1 font-medium">
                  💡 Suggestion: Update the invoice price to <strong className="font-extrabold text-amber-900">{symbol}{netReceived.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong> to allocate the overpaid funds to revenue.
                </p>
              )}
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-semibold rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">New Invoice Price</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-[12px] font-bold text-slate-400">{symbol}</span>
                <input 
                  type="number" 
                  value={price} 
                  onChange={e => {
                    setPrice(e.target.value);
                    setError('');
                  }} 
                  className="w-full pl-7 pr-3 border border-slate-200 bg-white/70 rounded-lg py-2.5 text-[12px] outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-semibold text-slate-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                  placeholder="0.00" 
                  step="0.01"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSave();
                    } else if (e.key === 'Escape') {
                      onClose();
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50/50 p-5 border-t border-slate-200 flex justify-end gap-3 backdrop-blur-md">
          <button 
            onClick={onClose} 
            disabled={loading}
            className="px-5 py-2.5 rounded-xl text-[11px] font-bold text-slate-600 hover:bg-slate-200/50 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl text-[11px] font-bold shadow-lg shadow-indigo-600/30 transition-all uppercase tracking-wide active:scale-95 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Updating...' : 'Save Changes'}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
