import { motion } from 'framer-motion';
import { PlusCircle, FileText, Edit2, Trash2 } from 'lucide-react';
import type { AdditionalService } from '../../types/booking';
import { EmptyState } from '../shared/EmptyState';

interface AdditionalServicesSectionProps {
  services: AdditionalService[] | undefined;
  onAdd?: () => void;
  onEdit?: (item: any) => void;
  onDelete?: (item: any) => void;
  onMarkPaid?: (item: AdditionalService) => void;
}

export function AdditionalServicesSection({ services, onAdd, onEdit, onDelete, onMarkPaid }: AdditionalServicesSectionProps) {
  if (!services || services.length === 0) {
    return (
      <EmptyState
        icon={PlusCircle}
        title="No additional services"
        description="No extra services logged for this booking yet."
        size="sm"
        action={
          onAdd ? (
            <button onClick={onAdd} className="bg-white border border-slate-200 hover:border-primary-300 text-primary-600 px-4 py-2 rounded-lg text-xs font-bold transition-colors mt-2">
              Add Service
            </button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {services.map((service, idx) => (
        <motion.div 
          key={service.id || idx}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.05 }}
          className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm hover:shadow-md hover:border-primary-200 transition-all group relative"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center border border-primary-100 flex-shrink-0">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">{service.serviceName}</h4>
              <p className="text-[10px] font-bold text-primary-600 uppercase tracking-wide">{service.vendorName || 'No Vendor'}</p>
              {service.notes && (
                <div className="flex items-start gap-1 mt-1 text-slate-500 text-xs">
                  <FileText className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <p className="line-clamp-2">{service.notes}</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end flex-shrink-0 pl-4 md:border-l border-slate-100">
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4">
              {onEdit && (
                <button onClick={() => onEdit(service)} className="bg-white p-1.5 rounded-md shadow text-slate-400 hover:text-primary-600 border border-slate-200">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
              {onDelete && (
                <button onClick={() => onDelete(service)} className="bg-white p-1.5 rounded-md shadow text-slate-400 hover:text-red-600 border border-slate-200">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {onMarkPaid && (
              <label className="absolute top-4 right-14 flex items-center gap-1.5 cursor-pointer bg-white px-2 py-1 rounded-md shadow-sm border border-slate-200 hover:border-primary-300 transition-colors z-10 group">
                <input type="checkbox" checked={true || false} disabled={true} onChange={(e) => { if (e.target.checked) onMarkPaid(service); }} className="w-3.5 h-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50" />
                <span className="text-[10px] font-bold text-slate-500 group-hover:text-primary-600 uppercase">Paid</span>
              </label>
            )}
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Charges</span>
            <span className="text-sm font-black text-slate-900">£{Number(service.charges).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
