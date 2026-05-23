import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface AccordionSectionProps {
  title: React.ReactNode;
  icon?: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  action?: React.ReactNode;
}

export function AccordionSection({ title, icon, isOpen, onToggle, children, action }: AccordionSectionProps) {
  return (
    <div className="bg-white/70 backdrop-blur-xl border border-white/60 shadow-lg shadow-indigo-100/40 rounded-2xl overflow-hidden mb-4 transition-all duration-300">
      <div 
        className={`px-6 py-4 flex items-center justify-between cursor-pointer transition-colors ${isOpen ? 'bg-gradient-to-r from-primary-50 to-indigo-50/50' : 'hover:bg-slate-50/50'}`}
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          {icon && <div className="text-primary-600 bg-white p-2 rounded-xl shadow-sm border border-primary-100">{icon}</div>}
          <h3 className="font-extrabold text-[14px] text-slate-800 tracking-tight uppercase">{title}</h3>
        </div>
        <div className="flex items-center gap-4">
          {action && (
            <div onClick={e => e.stopPropagation()}>
              {action}
            </div>
          )}
          <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-400 border border-slate-100">
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </div>
      
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="p-6 border-t border-white/50 bg-slate-50/30">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
