import React from 'react';
import { useCurrency } from '../../utils/currency';

interface InvoiceTemplateProps {
  booking: any;
  companyInfo?: {
    name?: string;
    location?: string;
    phone?: string;
    email?: string;
    logo?: string | null;
    website?: string;
    bankName?: string;
    accountName?: string;
    sortCode?: string;
    accountNumber?: string;
  };
}

export const InvoiceTemplate: React.FC<InvoiceTemplateProps> = ({ booking, companyInfo }) => {
  const { symbol } = useCurrency();
  if (!booking) return null;

  const companyName = companyInfo?.name || "Tooba Travels Ltd";
  const companyLogo = companyInfo?.logo;
  const companyAddress = companyInfo?.location || "63 Buxton Road, London, E17 7EH";
  const companyPhone = companyInfo?.phone || "+44 20 7946 0958";
  const companyEmail = companyInfo?.email || "operations@travelagency.com";
  const companyWebsite = companyInfo?.website || "www.toobatravels.co.uk";
  const bankName = companyInfo?.bankName || "Barclays Bank UK";
  const accountName = companyInfo?.accountName || companyName;
  const sortCode = companyInfo?.sortCode || "20-00-00";
  const accountNumber = companyInfo?.accountNumber || "12345678";

  const totalGross = Number(booking.totalPrice || 0);
  const totalSettled = Number(
    booking.paidAmount !== undefined
      ? booking.paidAmount
      : (booking.payments || []).reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0)
  );
  const balanceDue = Math.max(0, totalGross - totalSettled);
  const depositDue = Number(booking.depositRequired || 0) || Math.round(totalGross * 0.35);

  const leadCustomer = booking.customers?.[0] || null;
  const customerFullName = leadCustomer
    ? `${leadCustomer.salutation || leadCustomer.title ? (leadCustomer.salutation || leadCustomer.title) + ' ' : ''}${leadCustomer.firstName || ''} ${leadCustomer.lastName || ''}`.trim()
    : 'Walk-in Client';

  const additionalPax = (booking.customers || [])
    .slice(1)
    .map((c: any) => `${c.firstName} ${c.lastName}`)
    .join(', ');

  // Travel dates & duration
  let travelDatesText = "Dates TBA";
  let totalNights = 0;
  if (booking.accommodations && booking.accommodations.length > 0) {
    const valid = booking.accommodations.filter((a: any) => a.checkInDate && a.checkOutDate);
    if (valid.length > 0) {
      const earliest = new Date(Math.min(...valid.map((a: any) => new Date(a.checkInDate).getTime())));
      const latest = new Date(Math.max(...valid.map((a: any) => new Date(a.checkOutDate).getTime())));
      totalNights = Math.max(1, Math.round((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24)));
      travelDatesText = `${earliest.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} to ${latest.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} (${totalNights + 1} Days / ${totalNights} Nights)`;
    }
  }

  const packageRoute = booking.flightServices && booking.flightServices.length > 0
    ? `${booking.flightServices[0].departedFrom || 'LHR'} to ${booking.flightServices[booking.flightServices.length - 1].arrivedAt || 'JED'} (Return)`
    : "London Heathrow (LHR) to Jeddah / Madinah (Return)";

  const flights = booking.flightServices || [];
  const outboundFlights = flights.slice(0, Math.max(1, Math.ceil(flights.length / 2)));
  const inboundFlights = flights.length > 1 ? flights.slice(Math.max(1, Math.ceil(flights.length / 2))) : [];

  const h1 = booking.accommodations?.[0] || null;
  const h2 = booking.accommodations?.[1] || null;

  return (
    <div className="tax-invoice-root bg-white text-slate-800 text-[11px] font-sans leading-tight">
      <style>{`
        @media print {
          .tax-invoice-page {
            page-break-after: always !important;
            break-after: page !important;
            padding: 8mm !important;
            margin: 0 !important;
          }
          .page-break {
            page-break-after: always !important;
            break-after: page !important;
          }
        }
      `}</style>

      {/* PAGE 1: ITINERARY, ACCOMMODATION & BILLING BREAKDOWN */}
      <div className="tax-invoice-page p-6 border-b border-slate-200 min-h-[1050px] flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-4 mb-4">
            <div className="flex items-center gap-3.5">
              {companyLogo ? (
                <img src={companyLogo} alt={companyName} className="max-h-12 max-w-[170px] object-contain" />
              ) : (
                <div className="w-11 h-11 rounded-lg bg-slate-900 text-white font-black text-lg flex items-center justify-center">
                  {companyName.charAt(0)}
                </div>
              )}
              <div>
                <h1 className="text-base font-black text-slate-900 uppercase tracking-tight">{companyName}</h1>
                <p className="text-[10px] text-slate-500 font-semibold">{companyAddress}</p>
                <p className="text-[10px] text-slate-500">
                  Tel: <span className="font-semibold text-slate-700">{companyPhone}</span> | Email: <span className="font-semibold text-slate-700">{companyEmail}</span>
                </p>
                <p className="text-[9.5px] text-slate-400">Web: {companyWebsite}</p>
              </div>
            </div>

            <div className="text-right">
              <span className="inline-block px-2.5 py-0.5 bg-slate-900 text-white text-[10px] font-black tracking-wider uppercase rounded">
                TAX INVOICE
              </span>
              <p className="text-[11px] font-extrabold text-slate-800 mt-1">INV-{booking.bookingReference}</p>
              <p className="text-[9.5px] text-slate-500">Date: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
              <p className="text-[9.5px] text-slate-500">Booking Ref: <span className="font-bold text-slate-800">{booking.bookingReference}</span></p>
              <p className="text-[9.5px] text-slate-500">Agent: <span className="font-semibold">{booking.agentName || "Agent Assignment"}</span></p>
              <div className="mt-1">
                {balanceDue <= 0 ? (
                  <span className="text-[10px] font-black text-emerald-600">PAID</span>
                ) : totalSettled > 0 ? (
                  <span className="text-[10px] font-black text-amber-600">PARTIALLY PAID</span>
                ) : (
                  <span className="text-[10px] font-black text-rose-600">PENDING PAYMENT</span>
                )}
              </div>
            </div>
          </div>

          {/* Customer & Itinerary Overview Cards */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Customer Details</p>
              <p className="font-bold text-slate-900 text-[12px]">{customerFullName}</p>
              {additionalPax && <p className="text-[9px] text-slate-600"><span className="font-semibold">Pax:</span> {additionalPax}</p>}
              <p className="text-[9px] text-slate-600"><span className="font-semibold">Phone:</span> {leadCustomer?.phone || "Phone on file"}</p>
              <p className="text-[9px] text-slate-600"><span className="font-semibold">Email:</span> {leadCustomer?.email || "Email on file"}</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Package Itinerary Overview</p>
              <p className="font-bold text-slate-900 text-[11px]">{packageRoute}</p>
              <p className="text-[9px] text-slate-600"><span className="font-semibold">Travel Dates:</span> {travelDatesText}</p>
              <p className="text-[9px] text-slate-600"><span className="font-semibold">Manifest:</span> {booking.customers?.length || 1} Passenger(s)</p>
              <p className="text-[9px] text-slate-600"><span className="font-semibold">Package Type:</span> {booking.tripType || "Umrah"} Tailored Package</p>
            </div>
          </div>

          {/* Flight Schedule */}
          <div className="mb-4">
            <div className="bg-slate-900 text-white font-extrabold text-[10px] uppercase px-2.5 py-1 rounded-t flex justify-between">
              <span>Confirmed Flight Schedule</span>
              <span className="font-normal text-[9px] opacity-80">All timings in local airport times</span>
            </div>
            <table className="w-full text-left border-collapse border border-slate-200 text-[9.5px]">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-1.5 w-[20%]">Sector / Route</th>
                  <th className="p-1.5 w-[25%]">Departure</th>
                  <th className="p-1.5 w-[25%]">Arrival</th>
                  <th className="p-1.5 w-[15%]">Transit</th>
                  <th className="p-1.5 w-[15%]">Class & Baggage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {outboundFlights.length > 0 ? (
                  <tr>
                    <td className="p-1.5 align-top">
                      <strong className="block text-slate-900">OUTBOUND</strong>
                      <span className="font-bold text-blue-900">{outboundFlights[0].departedFrom} to {outboundFlights[outboundFlights.length - 1].arrivedAt}</span>
                      <div className="text-[8.5px] text-slate-500 font-mono">{outboundFlights.map((f: any) => f.flightNo).filter(Boolean).join(' / ')}</div>
                    </td>
                    <td className="p-1.5 align-top">
                      <strong className="text-slate-800 block">{outboundFlights[0].departedFromAirportName || outboundFlights[0].departedFrom}</strong>
                      <div>Dep: {outboundFlights[0].departTime || 'TBA'}</div>
                      <div className="text-[8.5px] text-slate-500">{outboundFlights[0].flightNo}</div>
                    </td>
                    <td className="p-1.5 align-top">
                      <strong className="text-slate-800 block">{outboundFlights[outboundFlights.length - 1].arrivedAtAirportName || outboundFlights[outboundFlights.length - 1].arrivedAt}</strong>
                      <div>Arr: {outboundFlights[outboundFlights.length - 1].arrivalTime || 'TBA'}</div>
                    </td>
                    <td className="p-1.5 align-top">
                      {outboundFlights.length > 1 ? (
                        <div>Transit {outboundFlights[0].arrivedAt}</div>
                      ) : (
                        <div className="text-emerald-700 font-bold">Direct</div>
                      )}
                    </td>
                    <td className="p-1.5 align-top">
                      <strong className="block text-slate-800">{outboundFlights[0].flightClass || 'Economy'}</strong>
                      <div className="text-[8.5px] text-slate-500">{outboundFlights[0].checkedBaggage || '1x 23kg Hold'}</div>
                    </td>
                  </tr>
                ) : (
                  <tr><td colSpan={5} className="p-2 text-center text-slate-400 italic">No outbound flight segments registered.</td></tr>
                )}

                {inboundFlights.length > 0 && (
                  <tr>
                    <td className="p-1.5 align-top">
                      <strong className="block text-slate-900">INBOUND</strong>
                      <span className="font-bold text-blue-900">{inboundFlights[0].departedFrom} to {inboundFlights[inboundFlights.length - 1].arrivedAt}</span>
                      <div className="text-[8.5px] text-slate-500 font-mono">{inboundFlights.map((f: any) => f.flightNo).filter(Boolean).join(' / ')}</div>
                    </td>
                    <td className="p-1.5 align-top">
                      <strong className="text-slate-800 block">{inboundFlights[0].departedFromAirportName || inboundFlights[0].departedFrom}</strong>
                      <div>Dep: {inboundFlights[0].departTime || 'TBA'}</div>
                      <div className="text-[8.5px] text-slate-500">{inboundFlights[0].flightNo}</div>
                    </td>
                    <td className="p-1.5 align-top">
                      <strong className="text-slate-800 block">{inboundFlights[outboundFlights.length - 1].arrivedAtAirportName || inboundFlights[outboundFlights.length - 1].arrivedAt}</strong>
                      <div>Arr: {inboundFlights[inboundFlights.length - 1].arrivalTime || 'TBA'}</div>
                    </td>
                    <td className="p-1.5 align-top">
                      {inboundFlights.length > 1 ? (
                        <div>Transit {inboundFlights[0].arrivedAt}</div>
                      ) : (
                        <div className="text-emerald-700 font-bold">Direct</div>
                      )}
                    </td>
                    <td className="p-1.5 align-top">
                      <strong className="block text-slate-800">{inboundFlights[0].flightClass || 'Economy'}</strong>
                      <div className="text-[8.5px] text-slate-500">{inboundFlights[0].checkedBaggage || '1x 23kg Hold'}</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Accommodation & Ground Logistics Cards */}
          <div className="grid grid-cols-3 gap-2.5 mb-4">
            <div className="border border-slate-200 rounded p-2.5 bg-white">
              <p className="text-[9px] font-black text-slate-900 uppercase mb-1">Makkah Accommodation</p>
              {h1 ? (
                <>
                  <p className="font-bold text-blue-900 text-[10px]">{h1.hotelName}</p>
                  <p className="text-[8.5px] text-slate-600 mt-1"><span className="font-semibold">City:</span> {h1.city || 'Makkah'}</p>
                  <p className="text-[8.5px] text-slate-600"><span className="font-semibold">Room:</span> {h1.roomType || 'Standard Room'}</p>
                  <p className="text-[8.5px] text-slate-600"><span className="font-semibold">Board:</span> {h1.mealType || 'Room Only'}</p>
                </>
              ) : (
                <p className="text-[9px] text-slate-400 italic">Not specified</p>
              )}
            </div>

            <div className="border border-slate-200 rounded p-2.5 bg-white">
              <p className="text-[9px] font-black text-slate-900 uppercase mb-1">Madinah Accommodation</p>
              {h2 ? (
                <>
                  <p className="font-bold text-blue-900 text-[10px]">{h2.hotelName}</p>
                  <p className="text-[8.5px] text-slate-600 mt-1"><span className="font-semibold">City:</span> {h2.city || 'Madinah'}</p>
                  <p className="text-[8.5px] text-slate-600"><span className="font-semibold">Room:</span> {h2.roomType || 'Standard Room'}</p>
                  <p className="text-[8.5px] text-slate-600"><span className="font-semibold">Board:</span> {h2.mealType || 'Room Only'}</p>
                </>
              ) : (
                <p className="text-[9px] text-slate-400 italic">Not specified</p>
              )}
            </div>

            <div className="border border-slate-200 rounded p-2.5 bg-white">
              <p className="text-[9px] font-black text-slate-900 uppercase mb-1">Transfers & Visas</p>
              <p className="font-bold text-blue-900 text-[10px]">Private Circuit + Visas</p>
              <div className="text-[8.5px] text-slate-600 mt-1 space-y-0.5">
                <div>• Private Air-Conditioned Vehicle Circuit</div>
                <div>• Saudi Entry Visas / ETA Approvals</div>
                <div>• Complete Ground Meet & Assist</div>
              </div>
            </div>
          </div>

          {/* Financial Settlement Summary */}
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div className="border border-slate-200 rounded p-2.5 bg-slate-50 text-[9.5px]">
              <p className="font-black text-slate-900 uppercase text-[9px] mb-1">Official Bank Remittance Details</p>
              <p><span className="font-semibold text-slate-700">Bank:</span> {bankName}</p>
              <p><span className="font-semibold text-slate-700">Account Name:</span> {accountName}</p>
              <p><span className="font-semibold text-slate-700">Sort Code:</span> {sortCode}</p>
              <p><span className="font-semibold text-slate-700">Account No:</span> {accountNumber}</p>
              <p className="text-[8.5px] text-slate-500 mt-1">Reference: <strong className="text-slate-800">{booking.bookingReference}</strong></p>
            </div>

            <div className="border border-slate-200 rounded p-2.5 bg-white text-[10px] space-y-1">
              <div className="flex justify-between font-semibold text-slate-700">
                <span>Total Package Price:</span>
                <span>{symbol}{totalGross.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-emerald-700">
                <span>Confirmed Settled:</span>
                <span>{symbol}{totalSettled.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-black text-[12px] text-slate-900 border-t border-slate-200 pt-1">
                <span>Balance Due:</span>
                <span className="text-blue-900">{symbol}{balanceDue.toFixed(2)}</span>
              </div>
              <p className="text-[8.5px] text-slate-500 text-right pt-1">Initial Deposit Required: {symbol}{depositDue.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Page 1 Footer */}
        <div className="border-t border-slate-200 pt-2 flex justify-between text-[8.5px] text-slate-400">
          <span>{companyName} • Registered ATOL & Umrah Service Provider</span>
          <span>Page 1 of 3 (Itinerary & Financial Summary)</span>
        </div>
      </div>

      <div className="page-break" />

      {/* PAGE 2: ITEMIZED FINANCIAL SCHEDULE & CLIENT ACCEPTANCE */}
      <div className="tax-invoice-page p-6 border-b border-slate-200 min-h-[1050px] flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase">Package Billing & Inclusions Manifest</h2>
              <p className="text-[9.5px] text-slate-500">Invoice Ref: INV-{booking.bookingReference} | Date: {new Date().toLocaleDateString('en-GB')}</p>
            </div>
            <span className="text-[10px] font-black text-slate-900 uppercase tracking-wider">PAGE 2 OF 3</span>
          </div>

          {/* Package Inclusions Table */}
          <div className="mb-5">
            <table className="w-full text-left border-collapse border border-slate-200 text-[9.5px]">
              <thead className="bg-slate-900 text-white font-bold">
                <tr>
                  <th className="p-2 w-[60%]">Contracted Inclusions & Itemized Description</th>
                  <th className="p-2 text-center w-[12%]">Quantity</th>
                  <th className="p-2 text-right w-[14%]">Rate ({symbol})</th>
                  <th className="p-2 text-right w-[14%]">Total ({symbol})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="p-2">
                    <strong className="text-slate-900 block font-bold text-[10px]">{booking.tripType || "Umrah"} Tailored Full Package Provision</strong>
                    <ul className="list-disc pl-4 text-[9px] text-slate-600 mt-1 space-y-0.5">
                      <li>Return scheduled flights with luggage & taxes included</li>
                      <li>Hotel accommodations in Makkah & Madinah</li>
                      <li>Ground transportation circuits</li>
                      <li>Saudi tourist / Umrah visa processing and issuing</li>
                    </ul>
                  </td>
                  <td className="p-2 text-center font-bold">{booking.customers?.length || 1} Pax</td>
                  <td className="p-2 text-right">{(totalGross / (booking.customers?.length || 1)).toFixed(2)}</td>
                  <td className="p-2 text-right font-bold">{totalGross.toFixed(2)}</td>
                </tr>

                {booking.additionalServices?.map((s: any) => (
                  <tr key={s.id}>
                    <td className="p-2">
                      <strong className="text-slate-900">{s.serviceName}</strong>
                      <div className="text-[8.5px] text-slate-500">{s.description}</div>
                    </td>
                    <td className="p-2 text-center font-bold">1</td>
                    <td className="p-2 text-right">{Number(s.price || 0).toFixed(2)}</td>
                    <td className="p-2 text-right font-bold">{Number(s.price || 0).toFixed(2)}</td>
                  </tr>
                ))}

                {booking.discounts?.map((d: any) => (
                  <tr key={d.id} className="text-rose-600">
                    <td className="p-2">
                      <strong>Discount: {d.description}</strong>
                    </td>
                    <td className="p-2 text-center font-bold">1</td>
                    <td className="p-2 text-right">-{Number(d.amount || 0).toFixed(2)}</td>
                    <td className="p-2 text-right font-bold">-{Number(d.amount || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Payment Receipts Log */}
          <div className="mb-5">
            <h3 className="text-[10px] font-black text-slate-900 uppercase mb-1">Settlement & Payment Receipts Ledger</h3>
            <table className="w-full text-left border-collapse border border-slate-200 text-[9.5px]">
              <thead className="bg-slate-100 text-slate-700 font-bold">
                <tr>
                  <th className="p-1.5 w-[20%]">Date</th>
                  <th className="p-1.5 w-[25%]">Method</th>
                  <th className="p-1.5 w-[35%]">Transaction Reference</th>
                  <th className="p-1.5 text-right w-[20%]">Amount Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(booking.payments && booking.payments.length > 0) ? (
                  booking.payments.map((p: any) => (
                    <tr key={p.id}>
                      <td className="p-1.5">{new Date(p.createdAt).toLocaleDateString('en-GB')}</td>
                      <td className="p-1.5 font-semibold">{p.paymentMethod || 'Bank Remittance'}</td>
                      <td className="p-1.5 font-mono text-[8.5px]">{p.reference || 'TXN-CONFIRMED'}</td>
                      <td className="p-1.5 text-right font-bold text-emerald-700">{symbol}{Number(p.amount).toFixed(2)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-2 text-center text-slate-400 italic">No payment receipts registered yet. Initial deposit outstanding.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Client Acceptance and Signatures */}
          <div className="border border-slate-300 rounded p-4 bg-slate-50 mt-6">
            <h3 className="text-[10px] font-black text-slate-900 uppercase mb-2">Legal Acceptance & Booking Confirmation Signatures</h3>
            <p className="text-[8.5px] text-slate-600 mb-4 leading-relaxed">
              By signing below, the lead passenger accepts these arrangements on behalf of all persons listed in this booking. The signer certifies that they have read, understood, and agreed to all 13 terms and conditions outlined on Page 3 of this document.
            </p>

            <div className="grid grid-cols-2 gap-8 pt-4">
              <div className="border-t-2 border-slate-400 pt-2">
                <p className="font-bold text-slate-900 text-[10px]">Lead Passenger Signature</p>
                <p className="text-[9px] text-slate-500">Name: <span className="font-semibold text-slate-800">{customerFullName}</span></p>
                <p className="text-[9px] text-slate-500">Date: __________________________</p>
              </div>

              <div className="border-t-2 border-slate-400 pt-2">
                <p className="font-bold text-slate-900 text-[10px]">Authorized Agency Signatory</p>
                <p className="text-[9px] text-slate-500">For & On Behalf of: <span className="font-semibold text-slate-800">{companyName}</span></p>
                <p className="text-[9px] text-slate-500">Date: {new Date().toLocaleDateString('en-GB')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Page 2 Footer */}
        <div className="border-t border-slate-200 pt-2 flex justify-between text-[8.5px] text-slate-400">
          <span>{companyName} • Registered Travel & Logistics Provider</span>
          <span>Page 2 of 3 (Billing Ledger & Contractual Signatures)</span>
        </div>
      </div>

      <div className="page-break" />

      {/* PAGE 3: 13 COMPREHENSIVE TERMS & CONDITIONS */}
      <div className="tax-invoice-page p-6 min-h-[1050px] flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase">Terms & Conditions of Contract</h2>
              <p className="text-[9.5px] text-slate-500">Standard Package Travel Regulations & Industry Compliance Guidelines</p>
            </div>
            <span className="text-[10px] font-black text-slate-900 uppercase tracking-wider">PAGE 3 OF 3</span>
          </div>

          {/* 13 Clauses in 2 columns */}
          <div className="grid grid-cols-2 gap-4 text-[8.5px] text-slate-600 leading-relaxed text-justify">
            <div className="space-y-3">
              <div>
                <strong className="text-slate-900 block font-bold text-[9px]">1. CONTRACT FORMATION & PARTIES</strong>
                This contract is concluded between {companyName} ("the Company") and the lead client named overleaf ("the Client"). The Client confirms they have authority to accept and do accept these booking conditions on behalf of all persons in the party.
              </div>

              <div>
                <strong className="text-slate-900 block font-bold text-[9px]">2. PAYMENT SCHEDULE & PRICE GUARANTEE</strong>
                A non-refundable deposit is required at booking. Full payment must be cleared no later than 30 days prior to departure. We reserve the right to cancel bookings where balances remain unpaid past the due date with forfeiture of deposits.
              </div>

              <div>
                <strong className="text-slate-900 block font-bold text-[9px]">3. CANCELLATION BY CLIENT & REFUND POLICY</strong>
                Any cancellation by the Client must be made in writing. Once flights and visas are issued, airline tickets and visa fees are strictly non-refundable and non-transferable under all circumstances. Hotel cancellation penalties apply per supplier terms.
              </div>

              <div>
                <strong className="text-slate-900 block font-bold text-[9px]">4. PASSPORT, VISA & HEALTH REGULATIONS</strong>
                All travellers must possess a machine-readable biometric passport with at least 6 months validity from return date. Clients are solely responsible for ensuring compliance with all Saudi entrance requirements, vaccination rules, and visa protocols.
              </div>

              <div>
                <strong className="text-slate-900 block font-bold text-[9px]">5. FLIGHT SCHEDULES, AIRLINES & DELAYS</strong>
                Flight timings and carriers are subject to change by aviation authorities. The Company acts as agent for airlines and does not accept liability for delays, cancellations, aircraft substitutions, or schedule revisions made by the operating carrier.
              </div>

              <div>
                <strong className="text-slate-900 block font-bold text-[9px]">6. BAGGAGE ALLOWANCE & RESTRICTIONS</strong>
                Hold and cabin baggage limits are set strictly by the operating airline. The Company accepts no liability for excess baggage charges or damages/delays to luggage during transit. Zamzam water transport rules depend entirely on airline policy.
              </div>

              <div>
                <strong className="text-slate-900 block font-bold text-[9px]">7. ACCOMMODATION STANDARDS & CHECK-IN / CHECK-OUT</strong>
                Standard check-in time in Saudi Arabia is 16:00 and check-out is 12:00 noon. Early check-in or late check-out is strictly subject to hotel availability and surcharges. Star ratings correspond to local Ministry of Tourism standards.
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <strong className="text-slate-900 block font-bold text-[9px]">8. GROUND TRANSPORTATION & TRANSFERS</strong>
                Transfer timings are synchronized with flight arrivals. In cases of flight delay exceeding 90 minutes, passengers must notify our local ground dispatch team. Missed transfers due to unreported delays will require private re-booking at passenger expense.
              </div>

              <div>
                <strong className="text-slate-900 block font-bold text-[9px]">9. PACKAGE ALTERATIONS & ITINERARY VARIATIONS</strong>
                While the Company makes every effort to execute arrangements as contracted, operational or regulatory circumstances may necessitate alterations in hotels, routes, or dates. Comparable or superior alternative arrangements will always be provided.
              </div>

              <div>
                <strong className="text-slate-900 block font-bold text-[9px]">10. TRAVEL INSURANCE MANDATE</strong>
                Comprehensive travel, health, and cancellation insurance is strongly advised for all passengers. The Company shall not be held liable for medical treatment expenses, lost property, or emergency repatriation costs during the journey.
              </div>

              <div>
                <strong className="text-slate-900 block font-bold text-[9px]">11. COMPLAINTS PROCEDURE & DISPUTE RESOLUTION</strong>
                Any issues arising during travel must be reported immediately to our local representative or 24/7 operations line. Written claims must be submitted to the Company headquarters within 28 days of return from the journey.
              </div>

              <div>
                <strong className="text-slate-900 block font-bold text-[9px]">12. FORCE MAJEURE & LIMITATION OF LIABILITY</strong>
                The Company shall not be liable for non-performance or delays caused by war, natural disasters, epidemics, border closures, weather conditions, or governmental regulations beyond our reasonable operational control.
              </div>

              <div>
                <strong className="text-slate-900 block font-bold text-[9px]">13. GOVERNING LAW & JURISDICTION</strong>
                This contract is governed by and construed in accordance with English Law. Both parties agree to submit to the exclusive jurisdiction of the Courts of England and Wales in the event of any contractual dispute.
              </div>
            </div>
          </div>
        </div>

        {/* Page 3 Footer */}
        <div className="border-t border-slate-200 pt-2 flex justify-between text-[8.5px] text-slate-400">
          <span>{companyName} • Regulated Tourism & Booking Agreement</span>
          <span>Page 3 of 3 (Contractual Terms & Conditions)</span>
        </div>
      </div>
    </div>
  );
};
