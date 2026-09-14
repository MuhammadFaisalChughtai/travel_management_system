import React, { useMemo } from "react";
import { Plane, Edit, Trash2, Clock, Ticket } from "lucide-react";
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

  // Group flights by PNR code
  const groupedFlights = useMemo(() => {
    const groups: { pnr: string; items: FlightService[]; totalPrice: number }[] = [];
    const map = new Map<string, FlightService[]>();

    flights.forEach((f) => {
      const pnrKey = (f.pnr && f.pnr.trim()) ? f.pnr.trim().toUpperCase() : 'Unassigned PNR';
      if (!map.has(pnrKey)) {
        map.set(pnrKey, []);
      }
      map.get(pnrKey)!.push(f);
    });

    map.forEach((items, pnr) => {
      const totalPrice = items.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
      groups.push({ pnr, items, totalPrice });
    });

    return groups;
  }, [flights]);

  return (
    <div className="flex flex-col gap-5">
      {flights.length === 0 ? (
        <EmptyState
          icon={Plane}
          title="No flight services recorded"
          description="Click the add button to log a new flight segment."
          size="sm"
        />
      ) : (
        groupedFlights.map((group, groupIdx) => (
          <div
            key={group.pnr + groupIdx}
            className="bg-white/90 backdrop-blur-md rounded-2xl border border-indigo-100/80 shadow-sm overflow-hidden"
          >
            {/* PNR Group Header Bar */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-5 py-3 flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-indigo-500/20 text-indigo-300 rounded-lg border border-indigo-400/30">
                  <Ticket className="w-4 h-4 text-indigo-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-sm tracking-wider text-amber-300 uppercase">
                      PNR: {group.pnr}
                    </span>
                    <span className="text-[10px] font-bold bg-indigo-900/80 text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-700/50">
                      {group.items.length} {group.items.length === 1 ? "Segment" : "Segments"}
                    </span>
                  </div>
                  {group.items[0]?.vendorName && (
                    <p className="text-[10px] text-slate-400 font-medium">
                      Provider / Vendor: {group.items[0].vendorName}
                    </p>
                  )}
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wide">
                  PNR Total Price
                </span>
                <span className="text-sm font-black text-emerald-400">
                  {symbol}
                  {group.totalPrice.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>

            {/* Table of Flights for this PNR Group */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 font-extrabold uppercase border-b border-slate-100 text-[10px]">
                    <th className="py-2.5 px-4">Flight & Airline</th>
                    <th className="py-2.5 px-4">Vendor</th>
                    <th className="py-2.5 px-4">Route / Airport</th>
                    <th className="py-2.5 px-4">Date / Time</th>
                    <th className="py-2.5 px-4">Tkt No.</th>
                    <th className="py-2.5 px-4 text-right">Price</th>
                    <th className="py-2.5 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {group.items.map((f, i) => {
                    const airlineDisplay = getAirlineName(f.flightNo) || f.airline || f.vendorName || "--";
                    const transitLayover = i < group.items.length - 1 ? getTransitBetweenFlights(f, group.items[i + 1]) : null;

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
                            <div className="text-[9.5px] text-slate-500 mt-0.5 font-medium truncate max-w-[240px]" title={`${getAirportName(f.departedFrom)} ➔ ${getAirportName(f.arrivedAt)}`}>
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
                          <tr className="bg-amber-50/80 border-y border-amber-200/80 text-[10.5px]">
                            <td colSpan={7} className="py-2 px-4">
                              <div className="flex items-center justify-center gap-2 text-amber-900 font-extrabold tracking-wide uppercase">
                                <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
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
        ))
      )}
    </div>
  );
}
