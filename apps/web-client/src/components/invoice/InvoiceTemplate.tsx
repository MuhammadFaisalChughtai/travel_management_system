import { useState, useEffect } from 'react';
import type { BookingDetail } from '../../types/booking';
import { api } from '../../api/axios';

interface InvoiceTemplateProps {
  booking: BookingDetail;
}

export function InvoiceTemplate({ booking }: InvoiceTemplateProps) {
  const [agentEmail, setAgentEmail] = useState('office@terrifictravel.co.uk');
  const [agentPhone, setAgentPhone] = useState('01215291630');

  useEffect(() => {
    if (!booking.agentName || booking.agentName === 'System / Auto' || booking.agentName === 'Any') {
      return;
    }
    const fetchAgent = async () => {
      try {
        const res = await api.get(`/agents/by-name/${encodeURIComponent(booking.agentName!)}`);
        if (res.data.agent) {
          if (res.data.agent.email) setAgentEmail(res.data.agent.email);
          if (res.data.agent.phoneNumber) setAgentPhone(res.data.agent.phoneNumber);
        }
      } catch (err) {
        console.error('Failed to fetch agent details for invoice', err);
      }
    };
    fetchAgent();
  }, [booking.agentName]);

  const calculateTotal = () => parseFloat(booking.totalPrice) || 0;
  const calculatePaid = () => parseFloat(booking.paidAmount) || 0;
  const calculateRemaining = () => calculateTotal() - calculatePaid();

  return (
    <div id="invoice-template" className="bg-white absolute left-0 top-0 -z-50 pointer-events-none" style={{ width: '210mm', minHeight: '297mm', fontFamily: "'Inter', sans-serif" }}>
      <div className="p-12">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-200 pb-8 mb-10">
          <div className="flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-14 h-14 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-indigo-200">
                TT
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">Terrific Travel Ltd</h1>
                <p className="text-[10px] uppercase tracking-widest text-indigo-600 font-bold">Premium Travel Services</p>
              </div>
            </div>
            <div className="text-[11px] text-slate-500 leading-relaxed">
              <p>Office 1, 11 Walford Road</p>
              <p>Birmingham, B11 1NP</p>
              <p className="mt-1">www.terrifictravel.co.uk</p>
              <p>office@terrifictravel.co.uk</p>
              <p>0121 529 1630</p>
            </div>
          </div>

          <div className="flex flex-col items-end">
            <h2 className="text-4xl font-black text-slate-200 uppercase tracking-widest mb-4">Invoice</h2>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 w-64">
              <div className="flex justify-between mb-2 pb-2 border-b border-slate-200">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Invoice Date</span>
                <span className="text-[11px] text-slate-800 font-bold">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              </div>
              <div className="flex justify-between mb-2 pb-2 border-b border-slate-200">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Booking Ref</span>
                <span className="text-[11px] text-indigo-600 font-black">{booking.bookingReference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Agent</span>
                <div className="text-right">
                  <span className="text-[11px] text-slate-800 font-bold block">{booking.agentName || 'System'}</span>
                  <span className="text-[9px] text-slate-500 block">{agentEmail}</span>
                  <span className="text-[9px] text-slate-500 block">{agentPhone}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bill To & Passengers */}
        <div className="grid grid-cols-2 gap-8 mb-10">
          <div>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Bill To</h3>
            {booking.customers && booking.customers.length > 0 ? (
              <div className="text-[12px] text-slate-800 leading-relaxed">
                <p className="font-bold text-[14px]">{booking.customers[0].title} {booking.customers[0].firstName} {booking.customers[0].lastName}</p>
                {booking.customers[0].email && <p className="text-slate-500">{booking.customers[0].email}</p>}
                {booking.customers[0].phoneNumber && <p className="text-slate-500">{booking.customers[0].phoneNumber}</p>}
              </div>
            ) : (
              <p className="text-[12px] text-slate-500 italic">No Lead Passenger Found</p>
            )}
          </div>
          
          <div>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Passengers</h3>
            {booking.customers && booking.customers.length > 0 ? (
              <div className="bg-slate-50 rounded-lg border border-slate-100 overflow-hidden">
                <table className="w-full text-[10px]">
                  <thead className="bg-slate-100 text-slate-500">
                    <tr>
                      <th className="py-2 px-3 text-left font-semibold">Name</th>
                      <th className="py-2 px-3 text-right font-semibold">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {booking.customers.map((c, idx) => (
                      <tr key={c.id} className={idx !== booking.customers.length - 1 ? 'border-b border-slate-100' : ''}>
                        <td className="py-2 px-3 text-slate-800 font-medium">{c.title} {c.firstName} {c.lastName}</td>
                        <td className="py-2 px-3 text-slate-500 text-right">{c.ageCategory}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>

        {/* Services Acquired */}
        <h3 className="text-[12px] font-black text-slate-800 uppercase tracking-widest mb-4 pb-2 border-b-2 border-indigo-600 inline-block">Services Rendered</h3>

        {/* Flights */}
        {booking.flightServices && booking.flightServices.length > 0 && (
          <div className="mb-6">
            <h4 className="text-[11px] font-bold text-indigo-600 mb-2">Flight Services</h4>
            <table className="w-full text-[10px] border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-200 text-slate-500 uppercase tracking-wider">
                  <th className="py-2 text-left font-semibold w-1/4">Flight & PNR</th>
                  <th className="py-2 text-left font-semibold w-1/4">Date</th>
                  <th className="py-2 text-left font-semibold w-1/4">Route</th>
                  <th className="py-2 text-right font-semibold w-1/4">Amount</th>
                </tr>
              </thead>
              <tbody>
                {booking.flightServices.map(f => (
                  <tr key={f.id} className="border-b border-slate-100">
                    <td className="py-3 align-top">
                      <div className="font-bold text-slate-800">{f.airline} {f.flightNo}</div>
                      <div className="text-[9px] text-slate-500">PNR: <span className="font-semibold text-slate-700">{f.pnr}</span></div>
                    </td>
                    <td className="py-3 align-top text-slate-600">{f.date}</td>
                    <td className="py-3 align-top">
                      <div className="font-semibold text-slate-800">{f.departedFrom} &rarr; {f.arrivedAt}</div>
                      <div className="text-[9px] text-slate-500">{f.departTime} - {f.arrivalTime}</div>
                    </td>
                    <td className="py-3 align-top text-right font-bold text-slate-800">£{parseFloat(f.price).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Accommodation */}
        {booking.accommodations && booking.accommodations.length > 0 && (
          <div className="mb-6">
            <h4 className="text-[11px] font-bold text-indigo-600 mb-2">Accommodation</h4>
            <table className="w-full text-[10px] border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-200 text-slate-500 uppercase tracking-wider">
                  <th className="py-2 text-left font-semibold w-1/3">Hotel Details</th>
                  <th className="py-2 text-left font-semibold w-1/3">Stay Duration</th>
                  <th className="py-2 text-center font-semibold">Qty</th>
                  <th className="py-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {booking.accommodations.map(a => (
                  <tr key={a.id} className="border-b border-slate-100">
                    <td className="py-3 align-top">
                      <div className="font-bold text-slate-800">{a.hotelName}</div>
                      <div className="text-[9px] text-slate-500">{a.roomType} | {a.mealType}</div>
                    </td>
                    <td className="py-3 align-top text-slate-600">
                      <div><span className="font-semibold text-slate-400">IN:</span> {a.checkInDate}</div>
                      <div><span className="font-semibold text-slate-400">OUT:</span> {a.checkOutDate}</div>
                    </td>
                    <td className="py-3 align-top text-center text-slate-600">{a.qty}</td>
                    <td className="py-3 align-top text-right font-bold text-slate-800">£{parseFloat(a.price).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Transport */}
        {booking.transportServices && booking.transportServices.length > 0 && (
          <div className="mb-6">
            <h4 className="text-[11px] font-bold text-indigo-600 mb-2">Transportation</h4>
            <table className="w-full text-[10px] border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-200 text-slate-500 uppercase tracking-wider">
                  <th className="py-2 text-left font-semibold w-1/4">Vehicle</th>
                  <th className="py-2 text-left font-semibold w-1/4">Date</th>
                  <th className="py-2 text-left font-semibold w-1/4">Route</th>
                  <th className="py-2 text-right font-semibold w-1/4">Amount</th>
                </tr>
              </thead>
              <tbody>
                {booking.transportServices.map(t => (
                  <tr key={t.id} className="border-b border-slate-100">
                    <td className="py-3 align-top font-bold text-slate-800">{t.vehicleType}</td>
                    <td className="py-3 align-top text-slate-600">{t.date}</td>
                    <td className="py-3 align-top">
                      <div className="font-semibold text-slate-800">{t.departureDestination} &rarr; {t.arrivalDestination}</div>
                      <div className="text-[9px] text-slate-500">Pick-up: {t.departureTime}</div>
                    </td>
                    <td className="py-3 align-top text-right font-bold text-slate-800">£{parseFloat(t.price).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Visa */}
        {booking.visaServices && booking.visaServices.length > 0 && (
          <div className="mb-6">
            <h4 className="text-[11px] font-bold text-indigo-600 mb-2">Visa Processing</h4>
            <table className="w-full text-[10px] border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-200 text-slate-500 uppercase tracking-wider">
                  <th className="py-2 text-left font-semibold">Type</th>
                  <th className="py-2 text-left font-semibold">Passport No</th>
                  <th className="py-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {booking.visaServices.map(v => (
                  <tr key={v.id} className="border-b border-slate-100">
                    <td className="py-3 align-top font-bold text-slate-800">{v.visaType}</td>
                    <td className="py-3 align-top text-slate-600 uppercase">{v.passportNumber}</td>
                    <td className="py-3 align-top text-right font-bold text-slate-800">£{parseFloat(v.price).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Financial Totals */}
        <div className="flex justify-end mt-8 mb-12">
          <div className="w-72 bg-slate-50 rounded-xl p-5 border border-slate-100">
            <div className="flex justify-between mb-3 text-[12px] text-slate-600">
              <span>Gross Total</span>
              <span className="font-semibold">£{calculateTotal().toFixed(2)}</span>
            </div>
            {booking.discounts && booking.discounts.length > 0 && (
              <div className="flex justify-between mb-3 text-[12px] text-emerald-600">
                <span>Discounts Applied</span>
                <span className="font-semibold">-£{booking.discounts.reduce((sum, d) => sum + (parseFloat(d.amount)||0), 0).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between mb-3 text-[12px] text-slate-600 pb-3 border-b border-slate-200">
              <span>Amount Paid</span>
              <span className="font-semibold">£{calculatePaid().toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[16px] text-slate-800 font-black">
              <span>Amount Due</span>
              <span className={calculateRemaining() > 0 ? "text-rose-600" : "text-emerald-600"}>
                {calculateRemaining() < 0 ? `-£${Math.abs(calculateRemaining()).toFixed(2)} (Overpaid)` : `£${calculateRemaining().toFixed(2)}`}
              </span>
            </div>
            {calculateRemaining() <= 0 && (
              <div className="mt-4 bg-emerald-100 text-emerald-700 text-[10px] font-bold text-center py-1.5 rounded uppercase tracking-widest border border-emerald-200">
                Paid In Full
              </div>
            )}
          </div>
        </div>

        {/* Terms and Conditions Block - Compact & Professional */}
        <div className="text-[7.5px] text-slate-500 leading-relaxed border-t border-slate-200 pt-6 column-count-2 gap-8">
          <p className="font-bold text-slate-700 mb-2 uppercase tracking-widest text-[8px]">Terms & Conditions</p>
          <p className="mb-2 italic">By making this booking, the customer accepts all terms outlined below.</p>
          <ul className="list-disc pl-3 mb-4 space-y-1">
            <li>Tickets are non-changeable and non-refundable (conditions apply).</li>
            <li>All packages are non-refundable and non-changeable once issued.</li>
            <li>Deposits secure seats, not fares. Full balance must be cleared to guarantee fare.</li>
            <li>Failure to dispute this invoice within 48 hours is considered acceptance.</li>
            <li>This invoice is a package confirmation, not an E-Ticket.</li>
            <li>70% of total price is required within 72 hours of confirmation.</li>
            <li>Rates in GBP include applicable hotel taxes. Resort fees or incidentals are the customer's responsibility.</li>
          </ul>

          <p className="font-bold text-slate-700 mt-3 mb-1 uppercase tracking-widest text-[8px]">Visa & Travel Requirements</p>
          <ul className="list-disc pl-3 mb-4 space-y-1">
            <li>Passports and UK visas must be valid for 6-8 months before departure.</li>
            <li>Original Biometric Residence Permit (BRP) is required for Non-British nationals.</li>
            <li>Visa issuance is subject to the Saudi Ministry. We are not liable for rejections.</li>
            <li>Double-check E-Ticket numbers on airline's official website immediately.</li>
          </ul>

          <p className="font-bold text-slate-700 mt-3 mb-1 uppercase tracking-widest text-[8px]">Accommodations & Transport</p>
          <ul className="list-disc pl-3 space-y-1">
            <li>Hotels are subject to availability. Alternative hotels of same rating may be provided.</li>
            <li>Upon arrival at Jeddah/Madinah, purchase a Saudi SIM to contact your driver.</li>
            <li>Ziyarats are limited to 2-3 hours. Coordinate with transfers manager.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
