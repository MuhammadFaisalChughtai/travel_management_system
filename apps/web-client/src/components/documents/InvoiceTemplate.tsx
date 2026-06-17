

import { useCurrency } from '../../utils/currency';

export const InvoiceTemplate = ({ booking, companyInfo }: { booking: any, companyInfo: any }) => {
  const { symbol } = useCurrency();
  if (!booking) return null;

  return (
    <div className="print-container bg-white p-8 max-w-4xl mx-auto text-slate-800 text-[12px]">
      <div className="flex justify-between items-start border-b border-slate-200 pb-6 mb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 mb-2 uppercase tracking-tight">INVOICE</h1>
          <p className="text-slate-500 font-bold mb-1">Invoice Number: <span className="text-slate-800">{booking.bookingReference}</span></p>
          <p className="text-slate-500 font-bold">Date: <span className="text-slate-800">{new Date().toLocaleDateString()}</span></p>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold text-slate-900">{companyInfo?.name || 'Travel Agency'}</h2>
          <p className="text-slate-500">{companyInfo?.location}</p>
          <p className="text-slate-500">{companyInfo?.phone}</p>
          <p className="text-slate-500">{companyInfo?.email}</p>
        </div>
      </div>

      <div className="mb-8 flex justify-between">
        <div className="w-1/2">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Bill To</h3>
          <p className="font-bold text-slate-800 text-[14px]">
            {booking.customers && booking.customers[0] ? `${booking.customers[0].firstName} ${booking.customers[0].lastName}` : 'Walk-in Client'}
          </p>
          <p className="text-slate-600">{booking.customers && booking.customers[0]?.email}</p>
          <p className="text-slate-600">{booking.customers && booking.customers[0]?.phone}</p>
        </div>
        <div className="w-1/2 text-right">
           <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Booking Agent</h3>
           <p className="font-bold text-slate-800 text-[14px]">{booking.agentName}</p>
        </div>
      </div>

      <div className="mb-8">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-y border-slate-200">
              <th className="py-3 px-4 font-bold text-[10px] text-slate-500 uppercase">Service Description</th>
              <th className="py-3 px-4 font-bold text-[10px] text-slate-500 uppercase text-center">Qty</th>
              <th className="py-3 px-4 font-bold text-[10px] text-slate-500 uppercase text-right">Unit Price</th>
              <th className="py-3 px-4 font-bold text-[10px] text-slate-500 uppercase text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {booking.flightServices?.map((f: any) => (
              <tr key={f.id}>
                <td className="py-3 px-4">
                  <div className="font-bold">Flight: {f.departedFrom} to {f.arrivedAt}</div>
                  <div className="text-[10px] text-slate-500">PNR: {f.pnr} | Flight No: {f.flightNo}</div>
                </td>
                <td className="py-3 px-4 text-center">{f.qty}</td>
                <td className="py-3 px-4 text-right">{symbol}{Number(f.unitPrice).toFixed(2)}</td>
                <td className="py-3 px-4 text-right font-bold">{symbol}{Number(f.price).toFixed(2)}</td>
              </tr>
            ))}
            
            {booking.accommodationServices?.map((h: any) => (
              <tr key={h.id}>
                <td className="py-3 px-4">
                  <div className="font-bold">Hotel: {h.hotelName}</div>
                  <div className="text-[10px] text-slate-500">{h.city} | {h.roomType} | Res: {h.reservationNumber}</div>
                </td>
                <td className="py-3 px-4 text-center">{h.qty}</td>
                <td className="py-3 px-4 text-right">-</td>
                <td className="py-3 px-4 text-right font-bold">{symbol}{Number(h.price).toFixed(2)}</td>
              </tr>
            ))}

            {booking.transportServices?.map((t: any) => (
              <tr key={t.id}>
                <td className="py-3 px-4">
                  <div className="font-bold">Transport: {t.vehicleType}</div>
                  <div className="text-[10px] text-slate-500">{t.pickUpLocation} to {t.dropOffLocation}</div>
                </td>
                <td className="py-3 px-4 text-center">{t.qty}</td>
                <td className="py-3 px-4 text-right">-</td>
                <td className="py-3 px-4 text-right font-bold">{symbol}{Number(t.price).toFixed(2)}</td>
              </tr>
            ))}

            {booking.visaServices?.map((v: any) => (
              <tr key={v.id}>
                <td className="py-3 px-4">
                  <div className="font-bold">Visa: {v.country} ({v.visaType})</div>
                  <div className="text-[10px] text-slate-500">Applicant: {v.firstName} {v.lastName}</div>
                </td>
                <td className="py-3 px-4 text-center">1</td>
                <td className="py-3 px-4 text-right">-</td>
                <td className="py-3 px-4 text-right font-bold">{symbol}{Number(v.price).toFixed(2)}</td>
              </tr>
            ))}

            {booking.additionalServices?.map((s: any) => (
              <tr key={s.id}>
                <td className="py-3 px-4">
                  <div className="font-bold">Extra: {s.serviceName}</div>
                  <div className="text-[10px] text-slate-500">{s.description}</div>
                </td>
                <td className="py-3 px-4 text-center">1</td>
                <td className="py-3 px-4 text-right">-</td>
                <td className="py-3 px-4 text-right font-bold">{symbol}{Number(s.price).toFixed(2)}</td>
              </tr>
            ))}

            {booking.discounts?.map((d: any) => (
              <tr key={d.id}>
                <td className="py-3 px-4">
                  <div className="font-bold text-rose-600">Discount: {d.description}</div>
                </td>
                <td className="py-3 px-4 text-center">1</td>
                <td className="py-3 px-4 text-right">-</td>
                <td className="py-3 px-4 text-right font-bold text-rose-600">-{symbol}{Number(d.amount).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end mb-8">
        <div className="w-64 space-y-3">
          <div className="flex justify-between text-slate-600 font-bold">
            <span>Total Amount:</span>
            <span>{symbol}{Number(booking.totalPrice).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-600 font-bold">
            <span>Amount Paid:</span>
            <span>{symbol}{Number(booking.payments?.reduce((acc: number, p: any) => acc + Number(p.amount), 0) || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-black text-slate-900 border-t border-slate-200 pt-2">
            <span>Balance Due:</span>
            <span>{symbol}{Number(
              booking.totalPrice 
              - (booking.payments?.reduce((acc: number, p: any) => acc + Number(p.amount), 0) || 0)
            ).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-6 mt-12 text-[10px] text-slate-500">
        <h4 className="font-bold text-slate-700 mb-2 uppercase">Terms & Conditions</h4>
        <ul className="list-disc pl-4 space-y-1">
          <li>All balances must be cleared 30 days prior to departure unless specified otherwise.</li>
          <li>Flight tickets are non-refundable and non-transferable once issued.</li>
          <li>Hotel and package cancellations are subject to the respective supplier's cancellation policies.</li>
          <li>Please verify all names match exactly as they appear on your passport before ticketing.</li>
        </ul>
      </div>
    </div>
  );
};
