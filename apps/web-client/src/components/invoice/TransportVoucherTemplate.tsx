import { useState, useEffect } from 'react';
import type { BookingDetail } from '../../types/booking';
import { api } from '../../api/axios';

interface TransportVoucherTemplateProps {
  booking: BookingDetail;
}

export function TransportVoucherTemplate({ booking }: TransportVoucherTemplateProps) {
  const [vendorContacts, setVendorContacts] = useState<Record<string, { email?: string, phone?: string }>>({});

  useEffect(() => {
    if (!booking.transportServices || booking.transportServices.length === 0) return;

    // Fetch unique vendor details
    const vendorsToFetch = Array.from(new Set(booking.transportServices.map(t => t.vendorName).filter(Boolean)));
    
    vendorsToFetch.forEach(async (vendorName) => {
      if (!vendorContacts[vendorName]) {
        try {
          const res = await api.get(`/vendors/by-name/${encodeURIComponent(vendorName)}`);
          if (res.data.vendor) {
            setVendorContacts(prev => ({
              ...prev,
              [vendorName]: {
                email: res.data.vendor.email,
                phone: res.data.vendor.phoneNumber
              }
            }));
          }
        } catch (err) {
          console.error(`Failed to fetch vendor details for ${vendorName}`, err);
        }
      }
    });
  }, [booking.transportServices]);

  if (!booking.transportServices || booking.transportServices.length === 0) {
    return null;
  }

  const leadPassenger = booking.customers && booking.customers.length > 0 
    ? `${booking.customers[0].title} ${booking.customers[0].firstName} ${booking.customers[0].lastName}` 
    : 'Lead Passenger';

  return (
    <div id="transport-voucher-template" className="bg-white absolute left-0 top-0 -z-50 pointer-events-none flex flex-col gap-8" style={{ width: '210mm', minHeight: '297mm', fontFamily: "'Inter', sans-serif" }}>
      {booking.transportServices.map((transport, idx) => {
        const contact = vendorContacts[transport.vendorName] || {};
        
        return (
          <div key={transport.id} className={`p-12 ${idx > 0 ? 'border-t-[3px] border-dashed border-slate-300 page-break-before' : ''}`}>
            
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-slate-200 pb-6 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-blue-200">
                  TT
                </div>
                <div>
                  <h1 className="text-3xl font-black text-slate-800 tracking-tight">Terrific Travel Ltd</h1>
                  <p className="text-[10px] uppercase tracking-widest text-blue-600 font-bold">Transport Voucher</p>
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
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Passenger Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-semibold">Lead Passenger</p>
                  <p className="text-[16px] font-bold text-slate-800">{leadPassenger}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-semibold">Total Passengers</p>
                  <p className="text-[14px] font-bold text-slate-800">{booking.customers?.length || 1} Person(s)</p>
                </div>
              </div>
            </div>

            {/* Transport Details Box */}
            <div className="border-2 border-blue-600 rounded-2xl overflow-hidden mb-8">
              <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-blue-200 uppercase font-semibold mb-1">Transfer Service</p>
                  <h3 className="text-xl font-bold">{transport.vehicleType}</h3>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase font-semibold text-blue-200">Date</p>
                  <p className="text-lg font-black tracking-wider">{transport.date || 'TBA'}</p>
                </div>
              </div>
              
              <div className="p-6 grid grid-cols-2 gap-y-6 gap-x-8 bg-white">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Pick-up Location</p>
                  <p className="text-[16px] font-black text-slate-800">{transport.departureDestination}</p>
                  <p className="text-[10px] text-slate-500 mt-1">Time: <span className="font-bold text-slate-700">{transport.departureTime || 'TBA'}</span></p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Drop-off Location</p>
                  <p className="text-[16px] font-black text-slate-800">{transport.arrivalDestination}</p>
                  <p className="text-[10px] text-slate-500 mt-1">Time: <span className="font-bold text-slate-700">{transport.arrivalTime || 'TBA'}</span></p>
                </div>

                {transport.flightNo && (
                  <div className="col-span-2 pt-4 border-t border-slate-100">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Flight Connection</p>
                    <p className="text-[12px] font-medium text-slate-700">Flight No: {transport.flightNo}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Vendor Contact Box */}
            <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-5 mb-6">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Transport Operator Details</h3>
              <div className="flex flex-col gap-2 text-[12px] text-slate-800 font-medium">
                <p><span className="text-slate-500 w-24 inline-block">Vendor Name:</span> {transport.vendorName}</p>
                {contact.phone && <p><span className="text-slate-500 w-24 inline-block">Phone Number:</span> {contact.phone}</p>}
                {contact.email && <p><span className="text-slate-500 w-24 inline-block">Email:</span> {contact.email}</p>}
                {!contact.phone && !contact.email && <p className="text-slate-400 italic">No direct contact details available. Please contact Terrific Travel Ltd for support.</p>}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-[10px] text-amber-800 leading-relaxed mb-6">
              <p className="font-bold uppercase mb-2 text-amber-900">Important Instructions for Transfer</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Please present this voucher to the driver upon boarding.</li>
                <li>Ensure you are waiting at the pick-up location at least 15 minutes prior to the scheduled departure time.</li>
                <li>In case of flight delays or changes to the pick-up schedule, please immediately contact the transport operator using the details above or contact our support team.</li>
              </ul>
            </div>
            
            <div className="text-center pt-8 border-t border-slate-200 mt-auto">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">For Support, Contact</p>
              <p className="text-[10px] text-slate-600 mt-1">Terrific Travel Ltd | +44 01215291630 | office@terrifictravel.co.uk</p>
            </div>

          </div>
        );
      })}
    </div>
  );
}
