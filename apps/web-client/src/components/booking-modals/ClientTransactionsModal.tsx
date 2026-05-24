import { X, ArrowDownLeft, RefreshCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import type { BookingDetail } from '../../types/booking';

interface ClientTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingDetail;
}

export function ClientTransactionsModal({ isOpen, onClose, booking }: ClientTransactionsModalProps) {
  if (!isOpen) return null;

  const clientPayments = booking.payments?.filter(p => p.paymentType === 'Received from Client') || [];
  const clientRefunds = booking.refunds?.filter(r => r.direction === 'Refund to Client') || [];

  const combined = [
    ...clientPayments.map(p => ({ ...p, _type: 'payment', _date: new Date(p.paidOn) })),
    ...clientRefunds.map(r => ({ ...r, _type: 'refund', _date: new Date(r.date) }))
  ].sort((a, b) => b._date.getTime() - a._date.getTime());

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
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
          <h2 className="text-lg font-black text-slate-800">Client Transactions</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3">
          {combined.length === 0 ? (
            <p className="text-center text-slate-400 py-8 text-sm font-medium">No client transactions found.</p>
          ) : (
            combined.map((item, idx) => {
              if (item._type === 'payment') {
                return (
                  <div key={`payment-${item.id}-${idx}`} className="flex items-center justify-between p-3 rounded-xl border border-emerald-100 bg-emerald-50 hover:bg-emerald-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-emerald-100 text-emerald-600 shrink-0">
                        <ArrowDownLeft className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-[12px] text-emerald-800">Received from Client</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-semibold text-emerald-600">{item._date.toLocaleDateString()}</span>
                          <span className="w-1 h-1 rounded-full bg-emerald-300"></span>
                          <span className="text-[10px] font-semibold text-emerald-600">{(item as any).paymentMethod}</span>
                        </div>
                        {item.notes && <p className="text-[10px] text-emerald-600 mt-1 italic">"{item.notes}"</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-[13px] text-emerald-600">+£{parseFloat(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div key={`refund-${item.id}-${idx}`} className="flex items-center justify-between p-3 rounded-xl border border-red-100 bg-red-50 hover:bg-red-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-100 text-red-600 shrink-0">
                        <RefreshCcw className="w-4 h-4" />
                      </div>
                      <div>
                        {'vendorCategory' in item ? (
                          <h4 className="font-bold text-[12px] text-red-800">
                            Refund: {(item as any).vendorCategory} {((item as any).serviceName) ? `— ${(item as any).serviceName}` : ''}
                          </h4>
                        ) : (
                          <h4 className="font-bold text-[12px] text-red-800">Refund to Client</h4>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-semibold text-red-600">{item._date.toLocaleDateString()}</span>
                          {(item as any).serviceName && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-red-300"></span>
                              <span className="text-[10px] font-semibold text-red-600">{(item as any).serviceName}</span>
                            </>
                          )}
                        </div>
                        {item.notes && <p className="text-[10px] text-red-600 mt-1 italic">"{item.notes}"</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-[13px] text-red-600">-£{parseFloat(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                );
              }
            })
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
