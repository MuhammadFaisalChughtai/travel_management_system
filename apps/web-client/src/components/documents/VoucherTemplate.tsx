

export const VoucherTemplate = ({ booking, companyInfo, type }: { booking: any, companyInfo: any, type: 'hotel' | 'transport' }) => {
  if (!booking) return null;

  return (
    <div className="print-container bg-white p-8 max-w-4xl mx-auto text-slate-800 text-[12px]">
      <div className="flex justify-between items-start border-b border-slate-200 pb-6 mb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 mb-2 uppercase tracking-tight">{type === 'hotel' ? 'HOTEL VOUCHER' : 'TRANSPORT VOUCHER'}</h1>
          <p className="text-slate-500 font-bold mb-1">Booking Ref: <span className="text-slate-800">{booking.bookingReference}</span></p>
          <p className="text-slate-500 font-bold">Issue Date: <span className="text-slate-800">{new Date().toLocaleDateString()}</span></p>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold text-slate-900">{companyInfo?.name || 'Travel Agency'}</h2>
          <p className="text-slate-500">{companyInfo?.phone}</p>
          <p className="text-slate-500">{companyInfo?.email}</p>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Primary Passenger</h3>
        <p className="font-bold text-slate-800 text-[16px]">
          {booking.customers && booking.customers[0] ? `${booking.customers[0].firstName} ${booking.customers[0].lastName}` : 'Walk-in Client'}
        </p>
      </div>

      {type === 'hotel' && booking.accommodationServices?.map((h: any) => (
        <div key={h.id} className="mb-8 border border-slate-200 rounded-2xl p-6 bg-slate-50">
          <h2 className="text-xl font-black text-slate-900 mb-4">{h.hotelName}</h2>
          
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Check-in</p>
              <p className="font-bold text-slate-800">{h.checkInDate ? new Date(h.checkInDate).toLocaleDateString() : 'N/A'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Check-out</p>
              <p className="font-bold text-slate-800">{h.checkOutDate ? new Date(h.checkOutDate).toLocaleDateString() : 'N/A'}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Room Type</p>
              <p className="font-bold text-slate-800">{h.roomType || 'Standard'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Meal Plan</p>
              <p className="font-bold text-slate-800">{h.mealType || 'Room Only'}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Confirmation / Res Number</p>
              <p className="font-bold text-indigo-600 text-lg">{h.reservationNumber || h.hotelConfirmationNumber || 'Pending'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Rooms / Qty</p>
              <p className="font-bold text-slate-800">{h.qty || 1}</p>
            </div>
          </div>
          
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Hotel Address / Contact</p>
            <p className="font-medium text-slate-600">{h.hotelAddress || 'See official hotel website for location.'}</p>
          </div>
        </div>
      ))}

      {type === 'transport' && booking.transportServices?.map((t: any) => (
        <div key={t.id} className="mb-8 border border-slate-200 rounded-2xl p-6 bg-slate-50">
          <h2 className="text-xl font-black text-slate-900 mb-4">{t.vehicleType} Transfer</h2>
          
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Date & Time</p>
              <p className="font-bold text-slate-800">
                {t.date ? new Date(t.date).toLocaleDateString() : 'N/A'} {t.time ? `at ${t.time}` : ''}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Vendor</p>
              <p className="font-bold text-slate-800">{t.vendorName}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Pick-up Location</p>
              <p className="font-bold text-slate-800">{t.pickUpLocation}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Drop-off Location</p>
              <p className="font-bold text-slate-800">{t.dropOffLocation}</p>
            </div>
          </div>
          
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Vehicle Type</p>
            <p className="font-medium text-slate-600">{t.vehicleType}</p>
          </div>
        </div>
      ))}

      <div className="border-t border-slate-200 pt-6 mt-12 text-[10px] text-slate-500 text-center">
        <p className="font-bold mb-1">Please present this voucher upon arrival.</p>
        <p>This voucher is pre-paid by {companyInfo?.name || 'Travel Agency'}. Do not charge the guest for the services listed above.</p>
      </div>
    </div>
  );
};
