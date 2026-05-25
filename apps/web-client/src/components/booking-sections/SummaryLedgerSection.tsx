import { useState, useEffect } from 'react';
import type { BookingDetail } from '../../types/booking';
import { Edit2, Save, X } from 'lucide-react';
import { api } from '../../api/axios';

interface SummaryLedgerSectionProps {
  booking: BookingDetail;
  onUpdate: (field: string, value: string) => Promise<void>;
}

export function SummaryLedgerSection({ booking, onUpdate }: SummaryLedgerSectionProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [dbAgents, setDbAgents] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const res = await api.get('/agents');
        setDbAgents(res.data.agents || []);
      } catch (err) {
        console.error('Failed to fetch agents', err);
      }
    };
    fetchAgents();
  }, []);

  const handleEdit = (field: string, initialValue: string) => {
    setEditingField(field);
    setEditValue(initialValue);
  };

  const handleSave = async (field: string) => {
    try {
      setLoading(true);
      await onUpdate(field, editValue);
      setEditingField(null);
    } catch (err) {
      console.error('Failed to update field:', err);
    } finally {
      setLoading(false);
    }
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white shadow-sm p-4">
        <h4 className="text-[10px] font-extrabold text-indigo-900 tracking-wide uppercase mb-3">Core Information</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {/* Booking Ref (Not Editable) */}
          <div>
            <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">Booking Ref</p>
            <p className="font-mono font-black text-slate-800">{booking.bookingReference}</p>
          </div>

          {/* Status */}
          <div>
            <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">Status</p>
            {editingField === 'status' ? (
              <div className="flex items-center gap-1 mt-1">
                <select value={editValue} onChange={(e) => setEditValue(e.target.value)} className="text-[10px] border border-slate-200 rounded px-1 py-0.5 outline-none font-bold uppercase text-slate-700">
                  <option value="confirmed">Confirmed</option>
                  <option value="pending">Pending</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <button onClick={() => handleSave('status')} disabled={loading} className="text-green-600 hover:text-green-700"><Save className="w-3.5 h-3.5" /></button>
                <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 group cursor-pointer w-fit mt-1" onClick={() => handleEdit('status', booking.status)}>
                <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold text-[9px] uppercase">
                  {booking.status}
                </span>
                <Edit2 className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>

          {/* Date Logged */}
          <div>
            <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">Date Logged</p>
            {editingField === 'date' ? (
              <div className="flex items-center gap-1 mt-1">
                <input type="date" value={editValue} onChange={(e) => setEditValue(e.target.value)} className="text-[10px] border border-slate-200 rounded px-1 py-0.5 outline-none font-semibold text-slate-600" />
                <button onClick={() => handleSave('date')} disabled={loading} className="text-green-600 hover:text-green-700"><Save className="w-3.5 h-3.5" /></button>
                <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 group cursor-pointer w-fit mt-1" onClick={() => handleEdit('date', booking.date.split('T')[0])}>
                <p className="font-semibold text-slate-600">
                  {new Date(booking.date).toLocaleDateString()}
                </p>
                <Edit2 className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>

          {/* Departure Date */}
          <div>
            <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">Departure Date</p>
            {editingField === 'departureDate' ? (
              <div className="flex items-center gap-1 mt-1">
                <input type="date" value={editValue} onChange={(e) => setEditValue(e.target.value)} className="text-[10px] border border-slate-200 rounded px-1 py-0.5 outline-none font-semibold text-slate-600" />
                <button onClick={() => handleSave('departureDate')} disabled={loading} className="text-green-600 hover:text-green-700"><Save className="w-3.5 h-3.5" /></button>
                <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 group cursor-pointer w-fit mt-1" onClick={() => handleEdit('departureDate', booking.departureDate ? booking.departureDate.split('T')[0] : '')}>
                <p className="font-semibold text-slate-600">
                  {booking.departureDate ? new Date(booking.departureDate).toLocaleDateString() : 'N/A'}
                </p>
                <Edit2 className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>

          {/* Agent Name */}
          <div>
            <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">Agent</p>
            {editingField === 'agentName' ? (
              <div className="flex items-center gap-1 mt-1">
                <select value={editValue} onChange={(e) => setEditValue(e.target.value)} className="text-[10px] border border-slate-200 rounded px-1 py-0.5 outline-none font-semibold text-slate-700 w-28">
                  <option value="">Select Agent</option>
                  <option value="System / Auto">System / Auto</option>
                  {dbAgents.map(a => (
                    <option key={a.id} value={a.name}>{a.name}</option>
                  ))}
                </select>
                <button onClick={() => handleSave('agentName')} disabled={loading} className="text-green-600 hover:text-green-700"><Save className="w-3.5 h-3.5" /></button>
                <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 group cursor-pointer w-fit mt-1" onClick={() => handleEdit('agentName', booking.agentName || '')}>
                <p className="font-semibold text-slate-600">
                  {booking.agentName || 'N/A'}
                </p>
                <Edit2 className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
