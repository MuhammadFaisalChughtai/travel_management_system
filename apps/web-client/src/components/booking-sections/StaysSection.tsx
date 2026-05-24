import { Hotel, Edit, Trash2 } from 'lucide-react';
import type { Accommodation } from '../../types/booking';

interface StaysSectionProps {
  onAdd?: () => void;
  onEdit?: (item: any) => void;
  onDelete?: (item: any) => void;
  stays: Accommodation[];
  
}

export function StaysSection({ stays, onEdit, onDelete}: StaysSectionProps) {
  return (
    <div className="flex flex-col gap-4">
      {stays.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center bg-white/50 rounded-2xl border border-dashed border-slate-300">
          <Hotel className="w-10 h-10 text-slate-300 mb-3" />
          <p className="text-slate-500 font-semibold text-xs">No accommodations recorded.</p>
        </div>
      ) : (
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 to-indigo-50/30 text-slate-500 font-extrabold uppercase border-b border-slate-100">
                  <th className="py-3 px-4">Hotel</th>
                  <th className="py-3 px-4">Check In</th>
                  <th className="py-3 px-4">Check Out</th>
                  <th className="py-3 px-4">Rooms</th>
                  <th className="py-3 px-4 text-right">Price</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stays.map((s, i) => (
                  <tr key={s.id || i} className="hover:bg-indigo-50/30 transition-colors group">
                    <td className="py-3 px-4 font-black text-slate-800">{s.hotelName || s.vendorName}</td>
                    <td className="py-3 px-4 font-semibold text-slate-600">{s.checkInDate ? new Date(s.checkInDate).toLocaleDateString() : '—'}</td>
                    <td className="py-3 px-4 font-semibold text-slate-600">{s.checkOutDate ? new Date(s.checkOutDate).toLocaleDateString() : '—'}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{s.qty || 1}</td>
                    <td className="py-3 px-4 text-right font-black text-emerald-600">
                      £{Number(s.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => onEdit?.(s)} className="p-1.5 bg-white text-indigo-500 hover:bg-indigo-50 border border-indigo-100 rounded-lg shadow-sm transition-all">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => onDelete?.(s)}  className="p-1.5 bg-white text-red-500 hover:bg-red-50 border border-red-100 rounded-lg shadow-sm transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
