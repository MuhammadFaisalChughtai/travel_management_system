import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar as CalendarIcon, User, CreditCard, Hash, Users } from 'lucide-react';

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentValue?: any;
  title: string;
  icon: React.ReactNode;
}

const BaseModal = ({ isOpen, onClose, title, icon, children }: FilterModalProps & { children: React.ReactNode }) => {
  if (!isOpen) return null;
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" 
          onClick={onClose} 
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 10 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 0.95, y: 10 }} 
          className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl w-full max-w-sm relative z-10 overflow-hidden flex flex-col"
        >
          <div className="bg-gradient-to-r from-primary-900 to-indigo-900 text-white px-6 py-4 flex justify-between items-center shadow-inner">
            <div className="flex items-center gap-3">
              <div className="text-indigo-300">{icon}</div>
              <h2 className="font-bold text-[14px] tracking-wide uppercase">{title}</h2>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6">
            {children}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};


export const BookingRefSearchModal = ({ isOpen, onClose, onApply, currentValue }: any) => {
  const [val, setVal] = useState(currentValue || '');
  return (
    <BaseModal isOpen={isOpen} onClose={onClose}  title="Search by Reference" icon={<Hash className="w-4 h-4" />}>
      <input type="text" value={val} onChange={e => setVal(e.target.value)} placeholder="e.g. INV-12345" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-[12px] outline-none focus:border-primary-500 font-semibold text-slate-700 bg-slate-50" autoFocus />
      <button onClick={() => onApply(val)} className="w-full mt-4 bg-primary-600 hover:bg-primary-500 text-white font-bold py-2 rounded-xl transition-colors text-[12px]">Apply Filter</button>
    </BaseModal>
  );
};

export const CustomerSearchModal = ({ isOpen, onClose, onApply, currentValue }: any) => {
  const [val, setVal] = useState(currentValue || '');
  return (
    <BaseModal isOpen={isOpen} onClose={onClose}  title="Search Customer" icon={<User className="w-4 h-4" />}>
      <input type="text" value={val} onChange={e => setVal(e.target.value)} placeholder="Name, Phone, or Email" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-[12px] outline-none focus:border-primary-500 font-semibold text-slate-700 bg-slate-50" autoFocus />
      <button onClick={() => onApply(val)} className="w-full mt-4 bg-primary-600 hover:bg-primary-500 text-white font-bold py-2 rounded-xl transition-colors text-[12px]">Apply Filter</button>
    </BaseModal>
  );
};

export const AgentSearchModal = ({ isOpen, onClose, onApply, currentValue, agents = [] }: any) => {
  const [val, setVal] = useState(currentValue || 'Any');
  return (
    <BaseModal isOpen={isOpen} onClose={onClose}  title="Filter by Agent" icon={<Users className="w-4 h-4" />}>
      <select value={val} onChange={e => setVal(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-[12px] outline-none focus:border-primary-500 font-semibold text-slate-700 bg-slate-50">
        <option value="Any">All Agents</option>
        {agents.map((a: any) => (
          <option key={a.id} value={a.name}>{a.name}</option>
        ))}
      </select>
      <button onClick={() => onApply(val)} className="w-full mt-4 bg-primary-600 hover:bg-primary-500 text-white font-bold py-2 rounded-xl transition-colors text-[12px]">Apply Filter</button>
    </BaseModal>
  );
};

export const DateSearchModal = ({ isOpen, onClose, onApply, currentValue, title, icon }: any) => {
  const [val, setVal] = useState(currentValue || '');
  return (
    <BaseModal isOpen={isOpen} onClose={onClose}  title={title} icon={icon || <CalendarIcon className="w-4 h-4" />}>
      <input type="date" value={val} onChange={e => setVal(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-[12px] outline-none focus:border-primary-500 font-semibold text-slate-700 bg-slate-50" />
      <button onClick={() => onApply(val)} className="w-full mt-4 bg-primary-600 hover:bg-primary-500 text-white font-bold py-2 rounded-xl transition-colors text-[12px]">Apply Filter</button>
    </BaseModal>
  );
};

export const DateRangeSearchModal = ({ isOpen, onClose, onApply, currentValue, title }: any) => {
  const [start, setStart] = useState(currentValue?.start || '');
  const [end, setEnd] = useState(currentValue?.end || '');
  return (
    <BaseModal isOpen={isOpen} onClose={onClose}  title={title} icon={<CalendarIcon className="w-4 h-4" />}>
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">From</label>
          <input type="date" value={start} onChange={e => setStart(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-[12px] outline-none focus:border-primary-500 font-semibold text-slate-700 bg-slate-50" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">To</label>
          <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-[12px] outline-none focus:border-primary-500 font-semibold text-slate-700 bg-slate-50" />
        </div>
      </div>
      <button onClick={() => onApply({start, end})} className="w-full mt-4 bg-primary-600 hover:bg-primary-500 text-white font-bold py-2 rounded-xl transition-colors text-[12px]">Apply Filter</button>
    </BaseModal>
  );
};

export const PaymentStatusSearchModal = ({ isOpen, onClose, onApply, currentValue }: any) => {
  const [val, setVal] = useState(currentValue || 'Any');
  return (
    <BaseModal isOpen={isOpen} onClose={onClose}  title="Payment Status" icon={<CreditCard className="w-4 h-4" />}>
      <select value={val} onChange={e => setVal(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-[12px] outline-none focus:border-primary-500 font-semibold text-slate-700 bg-slate-50">
        <option value="Any">All Statuses</option>
        <option value="paid">Paid</option>
        <option value="partially_paid">Partially Paid</option>
        <option value="unpaid">Unpaid</option>
      </select>
      <button onClick={() => onApply(val)} className="w-full mt-4 bg-primary-600 hover:bg-primary-500 text-white font-bold py-2 rounded-xl transition-colors text-[12px]">Apply Filter</button>
    </BaseModal>
  );
};
