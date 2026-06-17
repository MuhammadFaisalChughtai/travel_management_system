import { Car, Edit, Trash2 } from 'lucide-react';
import type { TransportService } from '../../types/booking';
import { EmptyState } from '../shared/EmptyState';
import { useCurrency } from '../../utils/currency';

interface TransportServicesSectionProps {
  onAdd?: () => void;
  onEdit?: (item: any) => void;
  onDelete?: (item: any) => void;
  transports: TransportService[];
  
}

export function TransportServicesSection({ transports, onEdit, onDelete}: TransportServicesSectionProps) {
  const { symbol } = useCurrency();
  return (
    <div className="flex flex-col gap-4">
      {transports.length === 0 ? (
        <EmptyState
          icon={Car}
          title="No transport services recorded"
          description="Click the add button to log a new transport."
          size="sm"
        />
      ) : (
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 to-indigo-50/30 text-slate-500 font-extrabold uppercase border-b border-slate-100">
                  <th className="py-3 px-4">Vendor / Type</th>
                  <th className="py-3 px-4">Route</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Price</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transports.map((t, i) => (
                  <tr key={t.id || i} className="hover:bg-indigo-50/30 transition-colors group">
                    <td className="py-3 px-4">
                      <div className="font-black text-slate-800">{t.vendorName || '—'}</div>
                      <div className="text-slate-500 font-semibold">{t.vehicleType}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1">
                        <div className="font-bold text-slate-700 flex items-center gap-1.5">
                          <span>{t.departureDestination}</span>
                          <span className="text-slate-300">→</span>
                          <span>{t.arrivalDestination}</span>
                        </div>
                        {t.flightNo && (
                          <div className="text-[9px] font-bold text-indigo-500 uppercase tracking-wide bg-indigo-50 px-1.5 py-0.5 rounded w-max">
                            Linked Flight: {t.flightNo}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-600">
                      {t.date ? new Date(t.date).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-emerald-600">
                      {symbol}{Number(t.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onEdit && (
                          <button onClick={() => onEdit(t)} className="p-1.5 bg-white text-indigo-500 hover:bg-indigo-50 border border-indigo-100 rounded-lg shadow-sm transition-all">
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDelete && (
                          <button onClick={() => onDelete(t)}  className="p-1.5 bg-white text-red-500 hover:bg-red-50 border border-red-100 rounded-lg shadow-sm transition-all">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
