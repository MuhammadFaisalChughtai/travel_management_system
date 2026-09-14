import React from "react";
import { Plane, Edit, Trash2, Clock } from "lucide-react";
import type { FlightService } from "../../types/booking";
import { EmptyState } from "../shared/EmptyState";
import { useCurrency } from "../../utils/currency";
import { getAirlineName, getAirportName, getAirportShort, getTransitBetweenFlights } from "../../utils/flightUtils";

interface FlightServicesSectionProps {
  onAdd?: () => void;
  onEdit?: (item: any) => void;
  onDelete?: (item: any) => void;
  flights: FlightService[];
}

export function FlightServicesSection({
  flights,
  onEdit,
  onDelete,
}: FlightServicesSectionProps) {
  const { symbol } = useCurrency();
  return (
    <div className="flex flex-col gap-4">
      {flights.length === 0 ? (
        <EmptyState
          icon={Plane}
          title="No flight services recorded"
          description="Click the add button to log a new flight segment."
          size="sm"
        />
      ) : (
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 to-indigo-50/30 text-slate-500 font-extrabold uppercase border-b border-slate-100">
                  <th className="py-3 px-4">Flight & Airline</th>
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">Route / Airport</th>
                  <th className="py-3 px-4">Date / Time</th>
                  <th className="py-3 px-4">PNR</th>
                  <th className="py-3 px-4">Tkt No.</th>
                  <th className="py-3 px-4 text-right">Price</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {flights.map((f, i) => {
                  const airlineDisplay = getAirlineName(f.flightNo) || f.airline || f.vendorName || "--";
                  const transitLayover = i < flights.length - 1 ? getTransitBetweenFlights(f, flights[i + 1]) : null;

                  return (
                    <React.Fragment key={f.id || i}>
                      <tr className="hover:bg-indigo-50/30 transition-colors group">
                        <td className="py-3 px-4">
                          <div className="font-black text-slate-800">
                            {airlineDisplay}
                          </div>
                          <div className="text-primary-600 font-bold font-mono">
                            {f.flightNo}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-700">
                            {f.vendorName || "--"}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800 flex items-center gap-1.5" title={`${getAirportName(f.departedFrom)} ➔ ${getAirportName(f.arrivedAt)}`}>
                            <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100/50">{getAirportShort(f.departedFrom)}</span>
                            <span className="text-slate-300">→</span>
                            <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100/50">{getAirportShort(f.arrivedAt)}</span>
                          </div>
                          <div className="text-[9.5px] text-slate-400 mt-0.5 font-medium truncate max-w-[180px]">
                            {getAirportName(f.departedFrom)}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-700">
                            {f.date ? new Date(f.date).toLocaleDateString() : "--"}
                          </div>
                          {f.departTime && f.arrivalTime && (
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5 font-bold">
                              {f.departTime} - {f.arrivalTime}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-800 bg-slate-50/50">
                          {f.pnr}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">
                          {f.ticketNumber || "--"}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-emerald-600">
                          {symbol}
                          {Number(f.price || 0).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {onEdit && (
                              <button
                                onClick={() => onEdit(f)}
                                className="p-1.5 bg-white text-indigo-500 hover:bg-indigo-50 border border-indigo-100 rounded-lg shadow-sm transition-all"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {onDelete && (
                              <button
                                onClick={() => onDelete(f)}
                                className="p-1.5 bg-white text-red-500 hover:bg-red-50 border border-red-100 rounded-lg shadow-sm transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {transitLayover && (
                        <tr className="bg-amber-50/60 border-y border-amber-100/60 text-[10px]">
                          <td colSpan={8} className="py-1.5 px-4">
                            <div className="flex items-center justify-center gap-1.5 text-amber-800 font-extrabold tracking-wide uppercase">
                              <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                              <span>Transit / Connection: {transitLayover}</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
