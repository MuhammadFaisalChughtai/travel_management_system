import { useState, useEffect } from 'react';
import type { BookingDetail } from '../../types/booking';
import { useCurrency } from '../../utils/currency';

interface CommitMarginModalProps {
  booking: BookingDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { amount: string; notes: string }) => void;
  recommendedAmount: number;
}

export function CommitMarginModal({ booking, isOpen, onClose, onSubmit, recommendedAmount }: CommitMarginModalProps) {
  const { symbol } = useCurrency();
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      setAmount(recommendedAmount.toString());
      setNotes('');
    }
  }, [isOpen, recommendedAmount]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    onSubmit({ amount, notes });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="font-bold text-[14px] tracking-wide uppercase">Commit Margin</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
            <p className="text-sm text-slate-600 leading-relaxed">
              Commit earned margin to <strong>{booking?.agentName || 'Agent'}</strong>. This will instantly increase their wallet balance and log the expense.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold tracking-wide text-slate-500 uppercase mb-2">Amount ({symbol})</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
              required
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-xs font-bold tracking-wide text-slate-500 uppercase mb-2">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all resize-none h-24"
              placeholder="E.g., Margin earned for package completion"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button type="button" className="flex-1 px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="flex-1 px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-lg shadow-emerald-600/20 transition-all active:scale-95">
              Commit Margin
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
