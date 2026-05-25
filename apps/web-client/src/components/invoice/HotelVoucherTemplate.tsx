import type { BookingDetail } from '../../types/booking';

interface HotelVoucherTemplateProps {
  booking: BookingDetail;
}

export function HotelVoucherTemplate({ booking }: HotelVoucherTemplateProps) {
  if (!booking.accommodations || booking.accommodations.length === 0) {
    return null;
  }

  const leadPassenger = booking.customers && booking.customers.length > 0 
    ? `${booking.customers[0].title} ${booking.customers[0].firstName} ${booking.customers[0].lastName}` 
    : 'Lead Passenger';

  return (
    <div id="hotel-voucher-template" className="bg-white absolute left-0 top-0 -z-50 pointer-events-none flex flex-col gap-8" style={{ width: '210mm', minHeight: '297mm', fontFamily: "'Inter', sans-serif" }}>
      {booking.accommodations.map((hotel, idx) => (
        <div key={hotel.id} className={`p-12 ${idx > 0 ? 'border-t-[3px] border-dashed border-slate-300 page-break-before' : ''}`}>
          
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-200 pb-6 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-emerald-200">
                TT
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">Terrific Travel Ltd</h1>
                <p className="text-[10px] uppercase tracking-widest text-emerald-600 font-bold">Accommodation Voucher</p>
              </div>
            </div>

            <div className="text-right">
              <h2 className="text-3xl font-black text-slate-200 uppercase tracking-widest mb-2">Voucher</h2>
              <div className="text-[10px] text-slate-500 font-medium">
                <p>Booking Ref: <span className="text-slate-800 font-bold">{booking.bookingReference}</span></p>
                <p>Issued: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
              </div>
            </div>
          </div>

          <div className="mb-8 bg-slate-50 border border-slate-200 rounded-xl p-6">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Guest Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Lead Guest</p>
                <p className="text-[16px] font-bold text-slate-800">{leadPassenger}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Total Guests</p>
                <p className="text-[14px] font-bold text-slate-800">{booking.customers?.length || 1} Person(s)</p>
              </div>
            </div>
          </div>

          {/* Hotel Details Box */}
          <div className="border-2 border-emerald-600 rounded-2xl overflow-hidden mb-8">
            <div className="bg-emerald-600 text-white p-4 flex justify-between items-center">
              <h3 className="text-xl font-bold">{hotel.hotelName}</h3>
              <div className="text-right">
                <p className="text-[10px] uppercase font-semibold text-emerald-200">Confirmation No</p>
                <p className="text-lg font-black tracking-wider">{hotel.hotelConfirmationNumber || 'TBA'}</p>
              </div>
            </div>
            
            <div className="p-6 grid grid-cols-2 gap-y-6 gap-x-8 bg-white">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Check-in</p>
                <p className="text-[16px] font-black text-slate-800">{hotel.checkInDate}</p>
                <p className="text-[10px] text-slate-500 mt-1">From 14:00 onwards</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Check-out</p>
                <p className="text-[16px] font-black text-slate-800">{hotel.checkOutDate}</p>
                <p className="text-[10px] text-slate-500 mt-1">Before 12:00 noon</p>
              </div>

              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Room Details</p>
                <p className="text-[14px] font-bold text-slate-800">{hotel.roomType}</p>
                <p className="text-[12px] text-slate-600">{hotel.qty} Room(s)</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Board Basis</p>
                <p className="text-[14px] font-bold text-slate-800">{hotel.mealType || 'Room Only'}</p>
              </div>

              {hotel.hotelAddress && (
                <div className="col-span-2 pt-4 border-t border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Hotel Address</p>
                  <p className="text-[12px] font-medium text-slate-700">{hotel.hotelAddress}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-[10px] text-amber-800 leading-relaxed mb-6">
            <p className="font-bold uppercase mb-2 text-amber-900">Important Instructions for Guests</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Please present this voucher along with a valid photo ID/Passport at the time of check-in.</li>
              <li>The hotel may ask for a credit card or cash deposit for incidental charges.</li>
              <li>Early check-in and late check-out are strictly subject to hotel availability.</li>
              <li>This voucher covers accommodation and the specified meal plan only. All other expenses (minibar, laundry, room service) must be settled directly at the hotel.</li>
            </ul>
          </div>
          
          <div className="text-center pt-8 border-t border-slate-200 mt-auto">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">For Support, Contact</p>
            <p className="text-[10px] text-slate-600 mt-1">Terrific Travel Ltd | +44 01215291630 | office@terrifictravel.co.uk</p>
          </div>

        </div>
      ))}
    </div>
  );
}
