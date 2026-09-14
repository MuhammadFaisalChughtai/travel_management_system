import React from "react";

interface VoucherTemplateProps {
  booking: any;
  companyInfo: {
    name?: string;
    location?: string;
    phone?: string;
    email?: string;
    logo?: string | null;
    website?: string;
    atolNumber?: string;
    iataNumber?: string;
  };
  type: "hotel" | "transport";
}

export const VoucherTemplate: React.FC<VoucherTemplateProps> = ({
  booking,
  companyInfo,
  type,
}) => {
  if (!booking) return null;

  const leadCustomer =
    booking.customers && booking.customers.length > 0
      ? booking.customers[0]
      : null;
  const leadPassengerName = leadCustomer
    ? `${leadCustomer.title ? leadCustomer.title + " " : ""}${leadCustomer.firstName} ${leadCustomer.lastName}`
    : "Walk-in Client";
  const customerPhone = leadCustomer?.phoneNumber || companyInfo?.phone || "+44 [Customer Mobile]";
  const customerEmail = leadCustomer?.email || companyInfo?.email || "client@example.com";
  const customerNationality = leadCustomer?.nationality || "British Citizen";
  const totalPax = booking.customers?.length || 1;

  const accommodations = booking.accommodations || booking.accommodationServices || [];
  const transports = booking.transportServices || [];

  const companyName = companyInfo?.name || "Tooba Travels Ltd";
  const companyAddress = companyInfo?.location || "63 Buxton Road, London, E17 7EH";
  const companyPhone = companyInfo?.phone || "+44 20 7946 0958";
  const companyEmail = companyInfo?.email || "operations@toobatravels.co.uk";
  const companyWebsite = companyInfo?.website || "www.toobatravels.co.uk";
  const companyLogo = companyInfo?.logo;
  const atolNo = companyInfo?.atolNumber || "11492";
  const iataNo = companyInfo?.iataNumber || "9127845";

  const issueDate = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const calculateNights = (inDate?: string, outDate?: string) => {
    if (!inDate || !outDate) return 1;
    try {
      const diff = new Date(outDate).getTime() - new Date(inDate).getTime();
      return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
    } catch {
      return 1;
    }
  };

  if (type === "hotel") {
    const primaryHotel = accommodations[0] || null;
    const hotelCity = primaryHotel?.city || "Makkah / Madinah";
    const checkIn = primaryHotel?.checkInDate ? formatDate(primaryHotel.checkInDate) : "TBA";
    const checkOut = primaryHotel?.checkOutDate ? formatDate(primaryHotel.checkOutDate) : "TBA";
    const nights = primaryHotel?.checkInDate && primaryHotel?.checkOutDate
      ? calculateNights(primaryHotel.checkInDate, primaryHotel.checkOutDate)
      : "-";

    return (
      <div
        className="voucher-print-root bg-white text-slate-900 font-sans"
        style={{
          width: "210mm",
          minHeight: "297mm",
          margin: "0 auto",
          padding: "24px 28px",
          boxSizing: "border-box",
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          fontSize: "11px",
          lineHeight: "1.4",
        }}
      >
        {/* Document Header */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "18px" }}>
          <tbody>
            <tr>
              <td style={{ width: "60%", verticalAlign: "top" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                  {companyLogo ? (
                    <img
                      src={companyLogo}
                      alt={companyName}
                      style={{ maxHeight: "55px", maxWidth: "160px", objectFit: "contain" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "8px",
                        background: "#091E42",
                        color: "#ffffff",
                        fontWeight: 900,
                        fontSize: "20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        letterSpacing: "-1px",
                      }}
                    >
                      {companyName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: "16px", fontWeight: 900, color: "#091E42", textTransform: "uppercase", letterSpacing: "-0.3px" }}>
                      {companyName}
                    </div>
                    <div style={{ fontSize: "9.5px", color: "#475569", fontWeight: 600, marginTop: "2px" }}>
                      Headquarters: {companyAddress}
                    </div>
                    <div style={{ fontSize: "9px", color: "#64748b", marginTop: "1px" }}>
                      Support: {companyPhone} | Email: {companyEmail}
                    </div>
                    <div style={{ fontSize: "9px", color: "#64748b", marginTop: "1px" }}>
                      Web: {companyWebsite}
                    </div>
                  </div>
                </div>
              </td>
              <td style={{ width: "40%", verticalAlign: "top", textAlign: "right" }}>
                <div style={{ fontSize: "22px", fontWeight: 900, color: "#091E42", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
                  HOTEL VOUCHER
                </div>
                <div style={{ display: "inline-block", background: "#ecfdf5", border: "1px solid #10b981", borderRadius: "4px", padding: "2px 8px", fontSize: "9px", fontWeight: 800, color: "#047857", textTransform: "uppercase", marginBottom: "6px" }}>
                  Status: Confirmed & Guaranteed
                </div>
                <table style={{ marginLeft: "auto", textAlign: "right", fontSize: "9.5px", color: "#334155", borderCollapse: "collapse" }}>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 600, color: "#64748b", paddingRight: "8px" }}>Voucher No:</td>
                      <td style={{ fontWeight: 800, fontFamily: "monospace", color: "#091E42" }}>
                        VCH-HTL-{booking.bookingReference}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600, color: "#64748b", paddingRight: "8px" }}>Booking Ref:</td>
                      <td style={{ fontWeight: 800, fontFamily: "monospace", color: "#091E42" }}>
                        {booking.bookingReference}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600, color: "#64748b", paddingRight: "8px" }}>Issue Date:</td>
                      <td style={{ fontWeight: 700 }}>{issueDate}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Regulatory Protection Strip */}
        <div
          style={{
            background: "#091E42",
            color: "#ffffff",
            borderRadius: "6px",
            padding: "6px 14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "9px",
            fontWeight: 700,
            marginBottom: "16px",
            letterSpacing: "0.3px",
          }}
        >
          <span>ATOL PROTECTED (REG. NO {atolNo})</span>
          <span>• OFFICIAL ACCOMMODATION CONFIRMATION VOUCHER •</span>
          <span>IATA MEMBER AGENCY ({iataNo})</span>
        </div>

        {/* 2-Column Overview Cards */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "16px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
          <tbody>
            <tr>
              <td style={{ width: "50%", verticalAlign: "top", padding: "10px 14px", borderRight: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "10px", fontWeight: 900, color: "#091E42", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", borderBottom: "1px solid #e2e8f0", paddingBottom: "4px" }}>
                  PRIMARY GUEST DETAILS
                </div>
                <div style={{ fontSize: "9.5px", color: "#334155", lineHeight: "1.6" }}>
                  <div><span style={{ color: "#64748b", fontWeight: 600 }}>Lead Guest:</span> <strong style={{ color: "#0f172a" }}>{leadPassengerName}</strong></div>
                  <div><span style={{ color: "#64748b", fontWeight: 600 }}>Total Guests:</span> <strong style={{ color: "#0f172a" }}>{totalPax} Passenger(s)</strong></div>
                  <div><span style={{ color: "#64748b", fontWeight: 600 }}>Mobile Contact:</span> {customerPhone}</div>
                  <div><span style={{ color: "#64748b", fontWeight: 600 }}>Email Address:</span> {customerEmail}</div>
                  <div><span style={{ color: "#64748b", fontWeight: 600 }}>Nationality:</span> {customerNationality}</div>
                </div>
              </td>
              <td style={{ width: "50%", verticalAlign: "top", padding: "10px 14px" }}>
                <div style={{ fontSize: "10px", fontWeight: 900, color: "#091E42", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", borderBottom: "1px solid #e2e8f0", paddingBottom: "4px" }}>
                  STAY & PROPERTY OVERVIEW
                </div>
                <div style={{ fontSize: "9.5px", color: "#334155", lineHeight: "1.6" }}>
                  <div><span style={{ color: "#64748b", fontWeight: 600 }}>Destination:</span> <strong style={{ color: "#0f172a" }}>{hotelCity}</strong></div>
                  <div><span style={{ color: "#64748b", fontWeight: 600 }}>Check-in Date:</span> <strong style={{ color: "#0f172a" }}>{checkIn}</strong> (From 14:00)</div>
                  <div><span style={{ color: "#64748b", fontWeight: 600 }}>Check-out Date:</span> <strong style={{ color: "#0f172a" }}>{checkOut}</strong> (Before 12:00)</div>
                  <div><span style={{ color: "#64748b", fontWeight: 600 }}>Duration of Stay:</span> <strong style={{ color: "#0f172a" }}>{nights !== "-" ? `${nights} Night(s)` : "Standard Stay"}</strong></div>
                  <div><span style={{ color: "#64748b", fontWeight: 600 }}>Fulfillment Guarantee:</span> Pre-paid by {companyName}</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Table 1: Hotel & Room Allocation Table */}
        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "10.5px", fontWeight: 900, color: "#091E42", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
            ACCOMMODATION & ROOM ALLOCATION
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5px", border: "1px solid #cbd5e1" }}>
            <thead>
              <tr style={{ background: "#091E42", color: "#ffffff", textAlign: "left" }}>
                <th style={{ padding: "6px 8px", fontWeight: 800, width: "32%" }}>Hotel Property & Location</th>
                <th style={{ padding: "6px 8px", fontWeight: 800, width: "18%" }}>Confirmation #</th>
                <th style={{ padding: "6px 8px", fontWeight: 800, width: "16%" }}>Room Type</th>
                <th style={{ padding: "6px 8px", fontWeight: 800, width: "14%" }}>Board Basis</th>
                <th style={{ padding: "6px 8px", fontWeight: 800, width: "8%", textAlign: "center" }}>Qty</th>
                <th style={{ padding: "6px 8px", fontWeight: 800, width: "12%" }}>Stay Dates</th>
              </tr>
            </thead>
            <tbody>
              {accommodations.length > 0 ? (
                accommodations.map((h: any, idx: number) => {
                  const cIn = formatDate(h.checkInDate);
                  const cOut = formatDate(h.checkOutDate);
                  const n = calculateNights(h.checkInDate, h.checkOutDate);
                  const confNo = h.hotelConfirmationNumber || h.reservationNumber || `CNF-${booking.bookingReference}-${idx + 1}`;
                  return (
                    <tr key={h.id || idx} style={{ borderBottom: "1px solid #e2e8f0", background: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                      <td style={{ padding: "7px 8px", verticalAlign: "top" }}>
                        <strong style={{ color: "#091E42", display: "block", fontSize: "10px" }}>{h.hotelName}</strong>
                        <div style={{ color: "#64748b", fontSize: "8.5px", marginTop: "2px" }}>
                          {h.hotelAddress || (h.city ? `${h.city}, Saudi Arabia` : "Central Haram Area")}
                        </div>
                      </td>
                      <td style={{ padding: "7px 8px", verticalAlign: "top", fontFamily: "monospace", fontWeight: 800, color: "#1e3a8a" }}>
                        {confNo}
                      </td>
                      <td style={{ padding: "7px 8px", verticalAlign: "top" }}>
                        <strong style={{ color: "#0f172a" }}>{h.roomType || "Standard Room"}</strong>
                      </td>
                      <td style={{ padding: "7px 8px", verticalAlign: "top", color: "#334155" }}>
                        {h.mealType || "Room Only"}
                      </td>
                      <td style={{ padding: "7px 8px", verticalAlign: "top", textAlign: "center", fontWeight: 700 }}>
                        {h.qty || 1}
                      </td>
                      <td style={{ padding: "7px 8px", verticalAlign: "top", fontSize: "9px" }}>
                        <div>{cIn} to</div>
                        <div>{cOut}</div>
                        <div style={{ color: "#64748b", fontSize: "8px", fontWeight: 600 }}>({n} Nights)</div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: "12px", textAlign: "center", color: "#64748b" }}>
                    No hotel accommodations assigned to this booking.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table 2: Guest Manifest Table */}
        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "10.5px", fontWeight: 900, color: "#091E42", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
            REGISTERED GUEST MANIFEST
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5px", border: "1px solid #cbd5e1" }}>
            <thead>
              <tr style={{ background: "#091E42", color: "#ffffff", textAlign: "left" }}>
                <th style={{ padding: "6px 8px", fontWeight: 800, width: "6%", textAlign: "center" }}>No.</th>
                <th style={{ padding: "6px 8px", fontWeight: 800, width: "36%" }}>Full Guest Name</th>
                <th style={{ padding: "6px 8px", fontWeight: 800, width: "18%" }}>Age Category</th>
                <th style={{ padding: "6px 8px", fontWeight: 800, width: "20%" }}>Nationality</th>
                <th style={{ padding: "6px 8px", fontWeight: 800, width: "20%" }}>Passport No.</th>
              </tr>
            </thead>
            <tbody>
              {booking.customers && booking.customers.length > 0 ? (
                booking.customers.map((c: any, idx: number) => (
                  <tr key={c.id || idx} style={{ borderBottom: "1px solid #e2e8f0", background: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                    <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 700, color: "#64748b" }}>{idx + 1}</td>
                    <td style={{ padding: "6px 8px", fontWeight: 700, color: "#0f172a" }}>
                      {c.title ? `${c.title} ` : ""}{c.firstName} {c.lastName}
                    </td>
                    <td style={{ padding: "6px 8px", color: "#334155" }}>{c.ageCategory || "Adult"}</td>
                    <td style={{ padding: "6px 8px", color: "#334155" }}>{c.nationality || customerNationality}</td>
                    <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "#334155" }}>{c.passportNumber || "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ padding: "10px", textAlign: "center", color: "#64748b" }}>
                    Lead Guest: {leadPassengerName} (1 Pax)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Check-In Instructions Box */}
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #cbd5e1",
            borderRadius: "6px",
            padding: "10px 14px",
            marginBottom: "16px",
          }}
        >
          <div style={{ fontSize: "10px", fontWeight: 900, color: "#091E42", textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: "6px" }}>
            IMPORTANT CHECK-IN POLICIES & GUEST NOTICES
          </div>
          <ol style={{ margin: 0, paddingLeft: "16px", fontSize: "8.8px", color: "#334155", lineHeight: "1.5" }}>
            <li style={{ marginBottom: "3px" }}>
              <strong>Standard Check-in / Check-out Times:</strong> Standard hotel check-in time is from 14:00 hrs onwards, and check-out is strictly before 12:00 noon. Early check-in or late check-out is subject to room availability and discretionary hotel charges.
            </li>
            <li style={{ marginBottom: "3px" }}>
              <strong>Mandatory Identification:</strong> All guests must present valid government photo identification (original Passport & valid Umrah/Tourist Visa) upon arrival at reception.
            </li>
            <li style={{ marginBottom: "3px" }}>
              <strong>Incidental Expenses:</strong> This voucher covers the room accommodation and board basis specified above. All incidental charges (telephone, laundry, room service, mini-bar, or property damages) must be settled directly with the hotel prior to departure.
            </li>
            <li style={{ marginBottom: "3px" }}>
              <strong>Pre-paid Guarantee:</strong> This accommodation voucher is pre-paid and guaranteed by {companyName}. Front desk reception must NOT demand room charges from the registered guest. For urgent assistance, contact our 24/7 hotline at {companyPhone}.
            </li>
          </ol>
        </div>

        {/* Footer */}
        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "10px", textAlign: "center", fontSize: "8.5px", color: "#64748b" }}>
          <strong>{companyName}</strong> | {companyAddress} | Tel: {companyPhone} | Email: {companyEmail} | Web: {companyWebsite}
        </div>
      </div>
    );
  }

  // Transport Voucher
  const primaryTransport = transports[0] || null;
  const dispatchVendor = primaryTransport?.vendorName || "Basma Transport / Ground Fleet";
  const dispatchPhone = companyPhone;
  const dispatchEmail = companyEmail;

  return (
    <div
      className="voucher-print-root bg-white text-slate-900 font-sans"
      style={{
        width: "210mm",
        minHeight: "297mm",
        margin: "0 auto",
        padding: "24px 28px",
        boxSizing: "border-box",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: "11px",
        lineHeight: "1.4",
      }}
    >
      {/* Document Header */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "18px" }}>
        <tbody>
          <tr>
            <td style={{ width: "60%", verticalAlign: "top" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                {companyLogo ? (
                  <img
                    src={companyLogo}
                    alt={companyName}
                    style={{ maxHeight: "55px", maxWidth: "160px", objectFit: "contain" }}
                  />
                ) : (
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "8px",
                      background: "#091E42",
                      color: "#ffffff",
                      fontWeight: 900,
                      fontSize: "20px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      letterSpacing: "-1px",
                    }}
                  >
                    {companyName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <div style={{ fontSize: "16px", fontWeight: 900, color: "#091E42", textTransform: "uppercase", letterSpacing: "-0.3px" }}>
                    {companyName}
                  </div>
                  <div style={{ fontSize: "9.5px", color: "#475569", fontWeight: 600, marginTop: "2px" }}>
                    Headquarters: {companyAddress}
                  </div>
                  <div style={{ fontSize: "9px", color: "#64748b", marginTop: "1px" }}>
                    Support: {companyPhone} | Email: {companyEmail}
                  </div>
                  <div style={{ fontSize: "9px", color: "#64748b", marginTop: "1px" }}>
                    Web: {companyWebsite}
                  </div>
                </div>
              </div>
            </td>
            <td style={{ width: "40%", verticalAlign: "top", textAlign: "right" }}>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#091E42", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
                TRANSPORT VOUCHER
              </div>
              <div style={{ display: "inline-block", background: "#ecfdf5", border: "1px solid #10b981", borderRadius: "4px", padding: "2px 8px", fontSize: "9px", fontWeight: 800, color: "#047857", textTransform: "uppercase", marginBottom: "6px" }}>
                Status: Confirmed & Dispatched
              </div>
              <table style={{ marginLeft: "auto", textAlign: "right", fontSize: "9.5px", color: "#334155", borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 600, color: "#64748b", paddingRight: "8px" }}>Voucher No:</td>
                    <td style={{ fontWeight: 800, fontFamily: "monospace", color: "#091E42" }}>
                      VCH-TRN-{booking.bookingReference}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600, color: "#64748b", paddingRight: "8px" }}>Booking Ref:</td>
                    <td style={{ fontWeight: 800, fontFamily: "monospace", color: "#091E42" }}>
                      {booking.bookingReference}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600, color: "#64748b", paddingRight: "8px" }}>Issue Date:</td>
                    <td style={{ fontWeight: 700 }}>{issueDate}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Regulatory Protection Strip */}
      <div
        style={{
          background: "#091E42",
          color: "#ffffff",
          borderRadius: "6px",
          padding: "6px 14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "9px",
          fontWeight: 700,
          marginBottom: "16px",
          letterSpacing: "0.3px",
        }}
      >
        <span>ATOL PROTECTED (REG. NO {atolNo})</span>
        <span>• GROUND LOGISTICS & TRANSFERS VOUCHER •</span>
        <span>IATA MEMBER AGENCY ({iataNo})</span>
      </div>

      {/* 2-Column Overview Cards */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "16px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
        <tbody>
          <tr>
            <td style={{ width: "50%", verticalAlign: "top", padding: "10px 14px", borderRight: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "10px", fontWeight: 900, color: "#091E42", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", borderBottom: "1px solid #e2e8f0", paddingBottom: "4px" }}>
                PRIMARY TRAVELER DETAILS
              </div>
              <div style={{ fontSize: "9.5px", color: "#334155", lineHeight: "1.6" }}>
                <div><span style={{ color: "#64748b", fontWeight: 600 }}>Lead Passenger:</span> <strong style={{ color: "#0f172a" }}>{leadPassengerName}</strong></div>
                <div><span style={{ color: "#64748b", fontWeight: 600 }}>Total Travelers:</span> <strong style={{ color: "#0f172a" }}>{totalPax} Passenger(s)</strong></div>
                <div><span style={{ color: "#64748b", fontWeight: 600 }}>Mobile Contact:</span> {customerPhone}</div>
                <div><span style={{ color: "#64748b", fontWeight: 600 }}>Email Address:</span> {customerEmail}</div>
                <div><span style={{ color: "#64748b", fontWeight: 600 }}>Nationality:</span> {customerNationality}</div>
              </div>
            </td>
            <td style={{ width: "50%", verticalAlign: "top", padding: "10px 14px" }}>
              <div style={{ fontSize: "10px", fontWeight: 900, color: "#091E42", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", borderBottom: "1px solid #e2e8f0", paddingBottom: "4px" }}>
                FULFILLMENT PARTNER & DISPATCH
              </div>
              <div style={{ fontSize: "9.5px", color: "#334155", lineHeight: "1.6" }}>
                <div><span style={{ color: "#64748b", fontWeight: 600 }}>Fleet Partner:</span> <strong style={{ color: "#0f172a" }}>{dispatchVendor}</strong></div>
                <div><span style={{ color: "#64748b", fontWeight: 600 }}>24/7 Operations Desk:</span> <strong style={{ color: "#0f172a" }}>{dispatchPhone}</strong></div>
                <div><span style={{ color: "#64748b", fontWeight: 600 }}>Dispatch Support:</span> {dispatchEmail}</div>
                <div><span style={{ color: "#64748b", fontWeight: 600 }}>Vehicle Allocation:</span> Private Air-Conditioned Fleet</div>
                <div><span style={{ color: "#64748b", fontWeight: 600 }}>Payment Status:</span> Pre-paid by {companyName}</div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Table 1: Scheduled Route & Transfer Legs */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ fontSize: "10.5px", fontWeight: 900, color: "#091E42", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
          SCHEDULED TRANSFER ROUTE & LEGS
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5px", border: "1px solid #cbd5e1" }}>
          <thead>
            <tr style={{ background: "#091E42", color: "#ffffff", textAlign: "left" }}>
              <th style={{ padding: "6px 8px", fontWeight: 800, width: "6%", textAlign: "center" }}>Leg #</th>
              <th style={{ padding: "6px 8px", fontWeight: 800, width: "16%" }}>Date & Time</th>
              <th style={{ padding: "6px 8px", fontWeight: 800, width: "24%" }}>Pick-up Location</th>
              <th style={{ padding: "6px 8px", fontWeight: 800, width: "24%" }}>Drop-off Destination</th>
              <th style={{ padding: "6px 8px", fontWeight: 800, width: "15%" }}>Vehicle Type</th>
              <th style={{ padding: "6px 8px", fontWeight: 800, width: "15%" }}>Flight / Remarks</th>
            </tr>
          </thead>
          <tbody>
            {transports.length > 0 ? (
              transports.map((t: any, idx: number) => {
                const dateStr = t.date ? formatDate(t.date) : "Scheduled Date TBA";
                const timeStr = t.time || "Scheduled Time TBA";
                const pickup = t.departureDestination || t.pickUpLocation || "Jeddah Airport (JED) / Hotel Lobby";
                const dropoff = t.arrivalDestination || t.dropOffLocation || "Hotel Accommodation";
                const vehicle = t.vehicleType || "Private AC Vehicle";
                const notes = t.notes || t.flightNo || "Standard Transfer";

                return (
                  <tr key={t.id || idx} style={{ borderBottom: "1px solid #e2e8f0", background: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                    <td style={{ padding: "7px 8px", textAlign: "center", fontWeight: 800, color: "#091E42" }}>{idx + 1}</td>
                    <td style={{ padding: "7px 8px", verticalAlign: "top" }}>
                      <strong style={{ color: "#0f172a" }}>{dateStr}</strong>
                      <div style={{ color: "#64748b", fontSize: "8.5px", marginTop: "1px" }}>{timeStr}</div>
                    </td>
                    <td style={{ padding: "7px 8px", verticalAlign: "top", color: "#334155" }}>
                      <strong style={{ color: "#0f172a" }}>{pickup}</strong>
                    </td>
                    <td style={{ padding: "7px 8px", verticalAlign: "top", color: "#334155" }}>
                      <strong style={{ color: "#0f172a" }}>{dropoff}</strong>
                    </td>
                    <td style={{ padding: "7px 8px", verticalAlign: "top", fontWeight: 700, color: "#1e3a8a" }}>
                      {vehicle}
                    </td>
                    <td style={{ padding: "7px 8px", verticalAlign: "top", color: "#64748b", fontSize: "9px" }}>
                      {notes}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} style={{ padding: "12px", textAlign: "center", color: "#64748b" }}>
                  Private circuit transfers included as per confirmed itinerary.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Table 2: Passenger Manifest */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ fontSize: "10.5px", fontWeight: 900, color: "#091E42", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
          PASSENGER MANIFEST
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5px", border: "1px solid #cbd5e1" }}>
          <thead>
            <tr style={{ background: "#091E42", color: "#ffffff", textAlign: "left" }}>
              <th style={{ padding: "6px 8px", fontWeight: 800, width: "6%", textAlign: "center" }}>No.</th>
              <th style={{ padding: "6px 8px", fontWeight: 800, width: "38%" }}>Full Passenger Name</th>
              <th style={{ padding: "6px 8px", fontWeight: 800, width: "18%" }}>Age Category</th>
              <th style={{ padding: "6px 8px", fontWeight: 800, width: "18%" }}>Nationality</th>
              <th style={{ padding: "6px 8px", fontWeight: 800, width: "20%" }}>Passport No.</th>
            </tr>
          </thead>
          <tbody>
            {booking.customers && booking.customers.length > 0 ? (
              booking.customers.map((c: any, idx: number) => (
                <tr key={c.id || idx} style={{ borderBottom: "1px solid #e2e8f0", background: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                  <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 700, color: "#64748b" }}>{idx + 1}</td>
                  <td style={{ padding: "6px 8px", fontWeight: 700, color: "#0f172a" }}>
                    {c.title ? `${c.title} ` : ""}{c.firstName} {c.lastName}
                  </td>
                  <td style={{ padding: "6px 8px", color: "#334155" }}>{c.ageCategory || "Adult"}</td>
                  <td style={{ padding: "6px 8px", color: "#334155" }}>{c.nationality || customerNationality}</td>
                  <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "#334155" }}>{c.passportNumber || "-"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} style={{ padding: "10px", textAlign: "center", color: "#64748b" }}>
                  Lead Passenger: {leadPassengerName} (1 Pax)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 5-Point Operational Transfer Instructions Box */}
      <div
        style={{
          background: "#f8fafc",
          border: "1px solid #cbd5e1",
          borderRadius: "6px",
          padding: "10px 14px",
          marginBottom: "16px",
        }}
      >
        <div style={{ fontSize: "10px", fontWeight: 900, color: "#091E42", textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: "6px" }}>
          5-POINT OPERATIONAL TRANSFER GUIDELINES & PROTOCOLS
        </div>
        <ol style={{ margin: 0, paddingLeft: "16px", fontSize: "8.8px", color: "#334155", lineHeight: "1.5" }}>
          <li style={{ marginBottom: "3px" }}>
            <strong>Meeting Point & Driver Meet-and-Greet:</strong> For airport arrivals, the driver will await guests outside the terminal customs arrival hall holding a name paging board. For hotel departures, the driver will report to the main lobby entrance.
          </li>
          <li style={{ marginBottom: "3px" }}>
            <strong>Punctuality & Lobby Readiness:</strong> Passengers must be waiting in the hotel reception lobby with all luggage ready 15 minutes prior to the scheduled pickup time. Intercity and flight departure transfers operate strictly to schedule.
          </li>
          <li style={{ marginBottom: "3px" }}>
            <strong>Flight Tracking & Schedule Revisions:</strong> Airport transfers are coordinated against designated flight numbers. In the event of flight delays, cancelations, or gate reassignments, notify our dispatch desk immediately via phone or WhatsApp.
          </li>
          <li style={{ marginBottom: "3px" }}>
            <strong>Luggage Allowance Compliance:</strong> Baggage is strictly limited to standard allowances (1 suitcase + 1 hand luggage per passenger). Excessive baggage exceeding vehicle trunk capacity may necessitate a supplemental transfer at the guest's expense.
          </li>
          <li style={{ marginBottom: "3px" }}>
            <strong>Pre-paid Transfer Notice:</strong> This transfer service has been fully pre-paid and contracted by {companyName}. No cash payment, tolls, or driver tips should be paid by the guest. For operational queries, call dispatch at {companyPhone}.
          </li>
        </ol>
      </div>

      {/* Footer */}
      <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "10px", textAlign: "center", fontSize: "8.5px", color: "#64748b" }}>
        <strong>{companyName}</strong> | {companyAddress} | Tel: {companyPhone} | Email: {companyEmail} | Web: {companyWebsite}
      </div>
    </div>
  );
};
