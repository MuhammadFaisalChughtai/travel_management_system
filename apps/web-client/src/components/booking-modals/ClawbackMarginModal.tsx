import { useState } from 'react';
import { X, ArrowDownCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import type { BookingDetail } from '../../types/booking';

interface ClawbackMarginModalProps {
  booking: BookingDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { amount: string; reason: string }) => void;
}

export function ClawbackMarginModal({ booking, isOpen, onClose, onSubmit }: ClawbackMarginModalProps) {
  const [form, setForm] = useState({
    amount: '',
    reason: ''
  });

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl w-full max-w-sm relative z-10 overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-4 flex justify-between items-center shadow-inner">
          <div className="flex items-center gap-3">
            <ArrowDownCircle className="h-5 w-5 text-purple-200" />
            <h3 className="font-bold text-[14px] tracking-wide uppercase">Margin Clawback</h3>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex flex-col gap-5">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-[12px] text-slate-600 mb-2">
                Claw back margin from <strong>{booking?.agentName || 'Agent'}</strong>. This will deduct from their wallet balance.
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Clawback Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-[11px] font-bold text-slate-400">£</span>
                <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="w-full pl-7 pr-3 border border-slate-200 bg-white/70 rounded-lg py-2 text-[11px] outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all font-semibold text-slate-700" placeholder="0.00" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Reason / Notes</label>
              <textarea value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} className="w-full h-20 border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all font-semibold text-slate-700 resize-none" placeholder="e.g. Flight cancelled by airline..." />
            </div>
          </div>
        </div>

        <div className="bg-slate-50/50 p-5 border-t border-slate-200 flex justify-end gap-3 backdrop-blur-md">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-[11px] font-bold text-slate-600 hover:bg-slate-200/50 transition-colors">Cancel</button>
          <button onClick={() => { onSubmit(form); onClose(); }} className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2.5 rounded-xl text-[11px] font-bold shadow-lg shadow-purple-600/30 transition-all uppercase tracking-wide active:scale-95">
            Confirm Clawback
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
