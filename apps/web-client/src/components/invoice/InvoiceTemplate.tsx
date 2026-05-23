
import type { BookingDetail } from '../../types/booking';

interface InvoiceTemplateProps {
  booking: BookingDetail;
}

export function InvoiceTemplate({ booking }: InvoiceTemplateProps) {
  const calculateTotal = () => parseFloat(booking.totalPrice) || 0;
  const calculatePaid = () => parseFloat(booking.paidAmount) || 0;
  const calculateRemaining = () => calculateTotal() - calculatePaid();

  return (
    <div id="invoice-template" className="bg-white p-10 hidden" style={{ width: '210mm', minHeight: '297mm' }}>
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-indigo-900 pb-6 mb-8">
        <div>
          {/* Logo Placeholder (can be replaced with actual img tag) */}
          <div className="flex items-center gap-2 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-primary-600 rounded flex items-center justify-center text-white font-black text-xl">
              TT
            </div>
            <h1 className="text-3xl font-bold text-indigo-900 tracking-tight">Terrific Travel Ltd</h1>
          </div>
          <div className="text-[12px] text-slate-700 leading-tight">
            <p>www.terrifictravel.co.uk</p>
            <p>Phone: 01215291630</p>
            <p>Email: office@terrifictravel.co.uk</p>
          </div>
        </div>

        <div className="text-[12px] text-slate-700 leading-tight text-right flex flex-col gap-1">
          <div className="flex justify-between gap-4"><span className="font-semibold text-indigo-900">Booking No:</span> <span>{booking.bookingReference}</span></div>
          <div className="flex justify-between gap-4"><span className="font-semibold text-indigo-900">Invoice Date:</span> <span>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>
          <div className="flex justify-between gap-4"><span className="font-semibold text-indigo-900">Agent:</span> <span>{booking.agentName || 'System'}</span></div>
          <div className="flex justify-between gap-4"><span className="font-semibold text-indigo-900">Agent-Email:</span> <span>agent@terrifictravel.co.uk</span></div>
          <div className="flex justify-between gap-4"><span className="font-semibold text-indigo-900">Agent-Phone:</span> <span>01215291630</span></div>
        </div>
      </div>

      {/* Passengers */}
      {booking.customers && booking.customers.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-indigo-900 mb-2">Passengers</h2>
          <table className="w-full text-[11px] border-collapse border border-slate-300">
            <thead>
              <tr className="bg-indigo-100 text-indigo-900">
                <th className="border border-slate-300 px-3 py-1.5 text-left font-bold">Title</th>
                <th className="border border-slate-300 px-3 py-1.5 text-left font-bold">First Name</th>
                <th className="border border-slate-300 px-3 py-1.5 text-left font-bold">Last Name</th>
                <th className="border border-slate-300 px-3 py-1.5 text-left font-bold">Age</th>
              </tr>
            </thead>
            <tbody>
              {booking.customers.map(c => (
                <tr key={c.id}>
                  <td className="border border-slate-300 px-3 py-1.5">{c.title || 'Mr'}</td>
                  <td className="border border-slate-300 px-3 py-1.5">{c.firstName}</td>
                  <td className="border border-slate-300 px-3 py-1.5">{c.lastName}</td>
                  <td className="border border-slate-300 px-3 py-1.5">{c.ageCategory}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Services Acquired */}
      <h2 className="text-lg font-bold text-indigo-900 mb-4">Services Acquired</h2>

      {/* Flights */}
      {booking.flightServices && booking.flightServices.length > 0 && (
        <div className="mb-6">
          <h3 className="text-md font-bold text-slate-800 mb-2">Flight</h3>
          <table className="w-full text-[10px] border-collapse border border-slate-300">
            <thead>
              <tr className="bg-indigo-100 text-indigo-900">
                <th className="border border-slate-300 px-2 py-1 text-left font-bold">Date</th>
                <th className="border border-slate-300 px-2 py-1 text-left font-bold">Flight No</th>
                <th className="border border-slate-300 px-2 py-1 text-left font-bold">PNR</th>
                <th className="border border-slate-300 px-2 py-1 text-left font-bold">Departure</th>
                <th className="border border-slate-300 px-2 py-1 text-left font-bold">Arrival</th>
                <th className="border border-slate-300 px-2 py-1 text-left font-bold">Dep Time</th>
                <th className="border border-slate-300 px-2 py-1 text-left font-bold">Arr Time</th>
                <th className="border border-slate-300 px-2 py-1 text-left font-bold">Baggage</th>
              </tr>
            </thead>
            <tbody>
              {booking.flightServices.map(f => (
                <tr key={f.id}>
                  <td className="border border-slate-300 px-2 py-1">{f.date}</td>
                  <td className="border border-slate-300 px-2 py-1">{f.airline} {f.flightNo}</td>
                  <td className="border border-slate-300 px-2 py-1 uppercase">{f.pnr}</td>
                  <td className="border border-slate-300 px-2 py-1 uppercase">{f.departedFrom}</td>
                  <td className="border border-slate-300 px-2 py-1 uppercase">{f.arrivedAt}</td>
                  <td className="border border-slate-300 px-2 py-1">{f.departTime}</td>
                  <td className="border border-slate-300 px-2 py-1">{f.arrivalTime}</td>
                  <td className="border border-slate-300 px-2 py-1">{f.baggage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Accommodation */}
      {booking.accommodations && booking.accommodations.length > 0 && (
        <div className="mb-6">
          <h3 className="text-md font-bold text-slate-800 mb-2">Accommodation</h3>
          <table className="w-full text-[10px] border-collapse border border-slate-300">
            <thead>
              <tr className="bg-indigo-100 text-indigo-900">
                <th className="border border-slate-300 px-2 py-1 text-left font-bold">Hotel</th>
                <th className="border border-slate-300 px-2 py-1 text-left font-bold">Check In</th>
                <th className="border border-slate-300 px-2 py-1 text-left font-bold">Check Out</th>
                <th className="border border-slate-300 px-2 py-1 text-left font-bold">Room Type</th>
                <th className="border border-slate-300 px-2 py-1 text-left font-bold">Meal</th>
                <th className="border border-slate-300 px-2 py-1 text-left font-bold">Qty</th>
              </tr>
            </thead>
            <tbody>
              {booking.accommodations.map(a => (
                <tr key={a.id}>
                  <td className="border border-slate-300 px-2 py-1">{a.hotelName}</td>
                  <td className="border border-slate-300 px-2 py-1">{a.checkInDate}</td>
                  <td className="border border-slate-300 px-2 py-1">{a.checkOutDate}</td>
                  <td className="border border-slate-300 px-2 py-1">{a.roomType}</td>
                  <td className="border border-slate-300 px-2 py-1">{a.mealType}</td>
                  <td className="border border-slate-300 px-2 py-1">{a.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Transport */}
      {booking.transportServices && booking.transportServices.length > 0 && (
        <div className="mb-6">
          <h3 className="text-md font-bold text-slate-800 mb-2">Transportation</h3>
          <table className="w-full text-[10px] border-collapse border border-slate-300">
            <thead>
              <tr className="bg-indigo-100 text-indigo-900">
                <th className="border border-slate-300 px-2 py-1 text-left font-bold">Date</th>
                <th className="border border-slate-300 px-2 py-1 text-left font-bold">Vehicle</th>
                <th className="border border-slate-300 px-2 py-1 text-left font-bold">From</th>
                <th className="border border-slate-300 px-2 py-1 text-left font-bold">To</th>
                <th className="border border-slate-300 px-2 py-1 text-left font-bold">Pick-up</th>
              </tr>
            </thead>
            <tbody>
              {booking.transportServices.map(t => (
                <tr key={t.id}>
                  <td className="border border-slate-300 px-2 py-1">{t.date}</td>
                  <td className="border border-slate-300 px-2 py-1">{t.vehicleType}</td>
                  <td className="border border-slate-300 px-2 py-1">{t.departureDestination}</td>
                  <td className="border border-slate-300 px-2 py-1">{t.arrivalDestination}</td>
                  <td className="border border-slate-300 px-2 py-1">{t.departureTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Visa */}
      {booking.visaServices && booking.visaServices.length > 0 && (
        <div className="mb-8">
          <h3 className="text-md font-bold text-slate-800 mb-2">Visa Processing</h3>
          <table className="w-full text-[10px] border-collapse border border-slate-300">
            <thead>
              <tr className="bg-indigo-100 text-indigo-900">
                <th className="border border-slate-300 px-2 py-1 text-left font-bold">Type</th>
                <th className="border border-slate-300 px-2 py-1 text-left font-bold">Passport No</th>
                <th className="border border-slate-300 px-2 py-1 text-left font-bold">Issue Date</th>
                <th className="border border-slate-300 px-2 py-1 text-left font-bold">Expiry Date</th>
              </tr>
            </thead>
            <tbody>
              {booking.visaServices.map(v => (
                <tr key={v.id}>
                  <td className="border border-slate-300 px-2 py-1">{v.visaType}</td>
                  <td className="border border-slate-300 px-2 py-1 uppercase">{v.passportNumber}</td>
                  <td className="border border-slate-300 px-2 py-1">{v.issueDate}</td>
                  <td className="border border-slate-300 px-2 py-1">{v.expiryDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Payment Summary */}
      <div className="mb-10 w-64">
        <h3 className="text-md font-bold text-indigo-900 mb-3 border-b border-indigo-200 pb-1">Payment Summary</h3>
        <div className="flex flex-col gap-2 text-[12px] text-slate-800">
          <div className="flex justify-between"><span className="font-semibold">Total Amount</span> <span>£{calculateTotal().toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="font-semibold">Paid</span> <span>£{calculatePaid().toFixed(2)}</span></div>
          <div className="flex justify-between pt-2 border-t border-slate-200 font-bold text-[14px]"><span>Remaining</span> <span>£{calculateRemaining().toFixed(2)}</span></div>
        </div>
      </div>

      {/* Terms and Conditions Block */}
      <div className="text-[9px] text-slate-700 leading-tight space-y-4 pt-4 border-t border-slate-300">
        <div>
          <h4 className="font-bold text-black mb-1">Terms & Conditions</h4>
          <p>- By making this booking, the customer accepts all terms and conditions outlined below.</p>
          <ol className="list-decimal pl-4">
            <li>Tickets are non-changeable and non-refundable (conditions apply).</li>
            <li>All packages are non-refundable and non-changeable once issued (conditions apply).</li>
            <li>Deposits only secure seats, not fares; paying the full balance on the same day is recommended.</li>
            <li>Failure to sign this invoice via Echo within 48 hours will be considered confirmation and acceptance.</li>
            <li>This invoice is for package confirmation and not your E-Ticket.</li>
            <li>Prices are not guaranteed until tickets are issued.</li>
            <li>Room rates and airfares are subject to availability.</li>
            <li>To secure your full package, 70% of the total price must be paid within 72 hours of booking confirmation.</li>
            <li>Rates are in GBP, including applicable hotel taxes. Additional resort fees, city taxes, mandatory hotel charges, or optional incidentals are the customer's responsibility.</li>
          </ol>
        </div>

        <div>
          <h4 className="font-bold text-black mb-1">Important Note</h4>
          <ol className="list-decimal pl-4">
            <li>Due to unforeseen circumstances (e.g., COVID-19, Saudi Ministry restrictions, airport or airline closures), you may carry forward or reschedule your tickets/packages.</li>
            <li>If you choose not to reschedule or carry forward, cancellation charges apply as per the invoice.</li>
            <li>Once services are issued, Terrific Travel Ltd is not responsible for full refunds.</li>
          </ol>
        </div>

        <div>
          <h4 className="font-bold text-black mb-1">Flight Requirements</h4>
          <ol className="list-decimal pl-4">
            <li>Provide passenger names exactly as they appear on the passports.</li>
            <li>Ensure there are no mistakes in the first name or surname. Passports must be valid for at least 6-8 months from the date of travel.</li>
            <li>Hajj package cancellation charges will apply as per the Organizer's Terms & Conditions, with a minimum fee of £250.</li>
            <li>Special requests (e.g., meal preferences or wheelchair assistance) can be added as remarks in your booking through your agent. Additional charges may apply.</li>
            <li>Double-check your E-Ticket numbers on the airline's official website immediately after receiving your tickets from your travel agent.</li>
            <li>Group fares or block seats are strictly non-refundable and non-changeable once issued.</li>
            <li>Provide a valid passport copy, email address, and contact number to be included in your air ticket before issuance.</li>
          </ol>
        </div>

        <div>
          <h4 className="font-bold text-black mb-1">Umrah Visa or Tourist Visa Requirements</h4>
          <ol className="list-decimal pl-4">
            <li>Passports and UK visas must both be valid for at least 6-8 months before departure.</li>
            <li>British & European passports: Eligible for both Tourist Visa and Umrah Visa.</li>
            <li>Non-British passports: Eligible for Umrah Visa only.</li>
            <li>Machine-readable travel documents are also eligible for an Umrah Visa.</li>
            <li>Required Documents (Non-British & Non-European): Original Passport, 1 Passport-size photograph, Copy of Meningitis Vaccination Certificate.</li>
            <li>Original Biometric Residence Permit (BRP) card is required for Non-British nationals (except European).</li>
            <li>Proof of address (bank statement or utility bill). For British passport holders, only coloured scanned copies are accepted.</li>
            <li>Visa issuance is subject to the Saudi Ministry. In case of rejection or non-issuance, Terrific Travel Ltd will not be liable for refunds on flights, hotels, or transport.</li>
          </ol>
        </div>

        <div>
          <h4 className="font-bold text-black mb-1">Transportation Requirements</h4>
          <ol className="list-decimal pl-4">
            <li>Upon arrival at Jeddah or Madinah Airport, passengers must purchase a Saudi SIM card and immediately contact their driver or transport manager for smooth pickup.</li>
            <li>Saudi Tasheel may take your passport for scanning at the airport. Ensure you collect it back immediately.</li>
            <li>Due to congestion, traffic delays may occur. Please remain patient as this is beyond our control.</li>
            <li>If your package includes Ziyarats, coordinate your schedule with the transfers manager (subject to availability).</li>
            <li>Ziyarats in Makkah and Madinah are limited to 2-3 hours. Typically, 5-6 holy sites will be visited in each city.</li>
            <li>Drivers will not accompany passengers to locations requiring climbing, such as the Cave of Hira.</li>
          </ol>
        </div>

        <div>
          <h4 className="font-bold text-black mb-1">Accommodation Rules</h4>
          <ol className="list-decimal pl-4">
            <li>Terrific Travel Ltd will strive to provide the hotels promised. However, in cases of peak season or full bookings, we reserve the right to arrange alternative hotels of the same star rating and quality.</li>
            <li>If you wish to upgrade your package after booking, additional charges will apply (if changeable). Most hotel bookings are non-changeable and non-refundable. (Conditions apply).</li>
            <li>All room rates are subject to availability and are not guaranteed until confirmed and issued.</li>
            <li>If hotel changes occur in Saudi Arabia due to supplier/consolidator decisions, Terrific Travel Ltd will not be held responsible. (Exceptions may apply).</li>
          </ol>
        </div>

        <div>
          <h4 className="font-bold text-black mb-1">Hajj Requirements</h4>
          <ol className="list-decimal pl-4">
            <li>Passports must be valid for at least 6-8 months.</li>
            <li>4 passport-size photographs are required along with the original passport.</li>
            <li>Pilgrims who performed Hajj within the last 5 years are not eligible again until the 5-year gap has passed, except if traveling as a Mehram for a first-time pilgrim.</li>
            <li>Terrific Travel Ltd is not a Hajj Organizer. After booking, we will connect you with certified and registered Hajj organizers.</li>
            <li>In the event of last-minute changes from the organizer, Terrific Travel Ltd will not be liable.</li>
          </ol>
        </div>

        <div>
          <h4 className="font-bold text-black mb-1">Complaints</h4>
          <p>- For any issues related to your booking, please contact us:</p>
          <ul className="list-none pl-2">
            <li>- Email: office@terrifictravel.co.uk</li>
            <li>- Phone: 0121 529 1630</li>
            <li>- Our team will assist you as quickly as possible.</li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-black mb-1">Office & Payments</h4>
          <ul className="list-none pl-2">
            <li>- Terrific Travel Ltd</li>
            <li>- Office 1, 11 Walford Road, Birmingham, B11 1NP</li>
            <li>- Modes of Payment:</li>
            <li className="pl-2">1. Initial deposit over the phone using Visa Debit or Credit Card.</li>
            <li className="pl-2">2. Bank Transfer: Account Name: Terrific Travel Ltd | Account Number: 46805760 | Sort Code: 30-90-90</li>
          </ul>
        </div>
      </div>

      <div className="mt-12 flex justify-between items-end border-t border-slate-300 pt-6">
        <div className="text-[10px] text-slate-800">
          <p className="mb-4">Signature: ________________________________</p>
          <p>Date: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
          <p className="text-slate-500 italic text-[9px]">E-Sign ID: 276-9d00ea</p>
        </div>
        
        <div className="text-[9px] text-center text-slate-500 border-t border-slate-200 pt-2 w-1/2">
          Address: Office 1, 11 Walford Road, Birmingham, B11 1NP<br />
          Email: info@terrifictravel.co.uk | Phone: 01215291630 | WhatsApp: +44 7888 461474
        </div>
      </div>

    </div>
  );
}
