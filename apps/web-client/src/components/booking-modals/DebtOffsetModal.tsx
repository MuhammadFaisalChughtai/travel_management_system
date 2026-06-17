import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrency } from '../../utils/currency';

interface DebtOffsetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (offsetAmount: number) => void;
  agentName: string;
  debtAmount: number;
  newPayoutAmount: number;
}

export function DebtOffsetModal({ isOpen, onClose, onSubmit, agentName, debtAmount, newPayoutAmount }: DebtOffsetModalProps) {
  const { symbol } = useCurrency();
  const defaultOffset = Math.min(debtAmount, newPayoutAmount);
  const [offsetAmount, setOffsetAmount] = useState<string>(defaultOffset.toString());

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="bg-white/90 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden flex flex-col">
          <div className="bg-gradient-to-r from-red-600 to-rose-600 text-white px-6 py-4 flex justify-between items-center shadow-inner">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-200" />
              <h3 className="font-bold text-[14px] tracking-wide uppercase">Outstanding Debt Detected</h3>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex flex-col gap-4">
            <p className="text-sm font-semibold text-slate-700">
              Agent <span className="font-bold text-slate-900">{agentName}</span> has an outstanding debt of <span className="font-bold text-red-600">{symbol}{debtAmount.toFixed(2)}</span> due to previous clawbacks.
            </p>
            <p className="text-sm text-slate-600">
              You are about to pay out <span className="font-bold text-emerald-600">{symbol}{newPayoutAmount.toFixed(2)}</span>. Do you want to settle the debt against this new margin?
            </p>

            <div className="mt-4">
              <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Amount to Offset (Deduct from Payout)</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-[12px] font-bold text-slate-400">{symbol}</span>
                <input 
                  type="number" 
                  value={offsetAmount} 
                  onChange={e => setOffsetAmount(e.target.value)} 
                  max={newPayoutAmount}
                  min={0}
                  className="w-full pl-7 pr-3 border border-slate-200 bg-white/70 rounded-lg py-2 text-[12px] outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all font-semibold text-slate-700" 
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Maximum offset allowed: {symbol}{newPayoutAmount.toFixed(2)}
              </p>
            </div>
            
            <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-500">Gross Payout:</span>
                <span className="font-bold">{symbol}{newPayoutAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs mb-1 text-red-600">
                <span>Offset Deduction:</span>
                <span className="font-bold">-{symbol}{parseFloat(offsetAmount || '0').toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold pt-2 border-t border-slate-200">
                <span>Final Net Payout to Agent:</span>
                <span className="text-emerald-600">{symbol}{Math.max(0, newPayoutAmount - parseFloat(offsetAmount || '0')).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50/50 p-5 border-t border-slate-200 flex justify-between gap-3 backdrop-blur-md">
            <button onClick={() => onSubmit(0)} className="px-4 py-2.5 rounded-xl text-[11px] font-bold text-slate-600 border border-slate-300 hover:bg-slate-200/50 transition-colors">
              Skip Offset
            </button>
            <button onClick={() => onSubmit(parseFloat(offsetAmount || '0'))} className="bg-red-600 hover:bg-red-500 text-white px-6 py-2.5 rounded-xl text-[11px] font-bold shadow-lg shadow-red-600/30 transition-all uppercase tracking-wide active:scale-95">
              Settle Debt
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
