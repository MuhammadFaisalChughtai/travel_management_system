import { Users, Edit, Trash2, AlertCircle, Mail } from 'lucide-react';
import type { Passenger } from '../../types/booking';
import { EmptyState } from '../shared/EmptyState';

interface PassengersSectionProps {
  onAdd?: () => void;
  passengers: Passenger[];
  onEdit?: (item: any) => void;
  onDelete?: (item: any) => void;
  onSendGdprRequest?: (item: any) => void;
}

export function PassengersSection({ passengers, onEdit, onDelete, onSendGdprRequest }: PassengersSectionProps) {
  const isExpiringSoon = (expiryStr: string | null | undefined) => {
    if (!expiryStr) return false;
    const expiry = new Date(expiryStr);
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
    return expiry < sixMonthsFromNow && expiry > new Date();
  };
  const isExpired = (expiryStr: string | null | undefined) => {
    if (!expiryStr) return false;
    const expiry = new Date(expiryStr);
    return expiry < new Date();
  };

  return (
    <div className="flex flex-col gap-4">
      {passengers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No passengers recorded"
          description="Click the add button to log a new passenger."
          size="sm"
        />
      ) : (
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 to-indigo-50/30 text-slate-500 font-extrabold uppercase border-b border-slate-100">
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Passport</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {passengers.map((p, i) => (
                  <tr key={p.id || i} className="hover:bg-indigo-50/30 transition-colors group">
                    <td className="py-3 px-4 font-black text-slate-800">
                      <div className="flex flex-col gap-1 items-start">
                        <span>{p.title} {p.firstName} {p.lastName}</span>
                        {i === 0 && (
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider border border-emerald-100/50 flex items-center gap-1">
                              <Users className="w-2.5 h-2.5" /> Lead Passenger
                            </span>
                            {onSendGdprRequest && (
                              <button
                                type="button"
                                onClick={() => onSendGdprRequest(p)}
                                className="inline-flex items-center gap-1 text-[8px] font-bold text-primary-600 hover:text-primary-700 bg-primary-50/50 hover:bg-primary-50 px-2 py-0.5 rounded border border-primary-100 transition-all cursor-pointer active:scale-95"
                                title="Send secure email link to passenger to fill their passport & GDPR consent details."
                              >
                                <Mail className="w-2.5 h-2.5" /> Send GDPR Info Request
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-primary-50 text-primary-600 px-2.5 py-1 rounded-md font-bold text-[9px] uppercase tracking-wide">
                        {p.ageCategory}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      <div className="flex flex-col gap-1">
                        <span>{p.passportNumber || '—'}</span>
                        {p.passportExpiryDate && (
                          <div className="flex flex-col gap-0.5 mt-0.5">
                            <span className="text-[9px] font-bold text-slate-400 font-sans tracking-wide">EXP: {new Date(p.passportExpiryDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                            {isExpired(p.passportExpiryDate) ? (
                              <span className="flex items-center gap-1 w-max text-[8px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded uppercase font-sans"><AlertCircle className="w-2.5 h-2.5" /> Expired</span>
                            ) : isExpiringSoon(p.passportExpiryDate) ? (
                              <span className="flex items-center gap-1 w-max text-[8px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded uppercase font-sans"><AlertCircle className="w-2.5 h-2.5" /> {'<'} 6 Months</span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-medium">
                      {p.email || p.phoneNumber || '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onEdit && (
                          <button onClick={() => onEdit(p)} className="p-1.5 bg-white text-indigo-500 hover:bg-indigo-50 border border-indigo-100 rounded-lg shadow-sm transition-all">
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDelete && (
                          <button onClick={() => onDelete(p)}  className="p-1.5 bg-white text-red-500 hover:bg-red-50 border border-red-100 rounded-lg shadow-sm transition-all">
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
