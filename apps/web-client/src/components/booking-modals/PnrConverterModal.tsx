import { useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

interface PnrConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (extractedData: any) => void;
}

export function PnrConverterModal({ isOpen, onClose, onSave }: PnrConverterModalProps) {
  const [pnrText, setPnrText] = useState('');

  const parsePNR = () => {
    if (!pnrText.trim()) return;
    const airlineMatch = pnrText.match(/(emirates|qatar|british airways|lufthansa|delta|united)/i);
    const flightNoMatch = pnrText.match(/([A-Z]{2}\s?\d{3,4})/i);
    const dateMatch = pnrText.match(/(\d{2}[A-Z]{3})/i);
    const airportMatch = pnrText.match(/([A-Z]{3})\s*(?:TO|-)?\s*([A-Z]{3})/);
    const pnrRefMatch = pnrText.match(/([A-Z0-9]{6})/);

    const extracted = {
      airline: airlineMatch ? airlineMatch[0].toUpperCase() : undefined,
      flightNo: flightNoMatch ? flightNoMatch[0] : undefined,
      date: dateMatch ? dateMatch[0] : undefined,
      departedFrom: airportMatch ? airportMatch[1] : undefined,
      arrivedAt: airportMatch ? airportMatch[2] : undefined,
      pnr: pnrRefMatch ? pnrRefMatch[0] : undefined
    };

    onSave(extracted);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-white/90 backdrop-blur-2xl border border-white rounded-2xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-indigo-600 to-primary-600 text-white px-6 py-4 flex justify-between items-center shadow-inner">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 text-indigo-200" />
            <h3 className="font-bold text-[14px] tracking-wide uppercase">Smart PNR Converter</h3>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <p className="text-[11px] text-slate-500 font-medium">
            Paste an unformatted GDS PNR block below. We will automatically extract the airline, flight number, routing, and PNR reference to autofill your form.
          </p>
          <textarea 
            value={pnrText} 
            onChange={e => setPnrText(e.target.value)} 
            className="w-full h-32 border border-slate-200 bg-white/70 rounded-lg p-3 text-[11px] outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all font-mono resize-none shadow-inner" 
            placeholder="e.g. 1.SMITH/JOHN MR  2.EK123 J 12MAY DXBLHR HK1 1430 1830..." 
          />
        </div>

        <div className="bg-slate-50 p-5 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-[11px] font-bold text-slate-600 hover:bg-slate-200/50 transition-colors">Cancel</button>
          <button onClick={parsePNR} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl text-[11px] font-bold shadow-lg shadow-indigo-600/30 transition-all uppercase tracking-wide active:scale-95">
            Save & Auto-fill
          </button>
        </div>
      </motion.div>
    </div>
  );
}
