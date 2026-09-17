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
    billingAddress?: string;
  };
}

const AIRPORT_MAP: Record<string, string> = {
  // UK & Ireland
  LHR: "London Heathrow (LHR)",
  LGW: "London Gatwick (LGW)",
  STN: "London Stansted (STN)",
  LTN: "London Luton (LTN)",
  LCY: "London City (LCY)",
  MAN: "Manchester Airport (MAN)",
  BHX: "Birmingham Airport (BHX)",
  EDI: "Edinburgh Airport (EDI)",
  GLA: "Glasgow Airport (GLA)",
  NCL: "Newcastle Airport (NCL)",
  BFS: "Belfast International (BFS)",
  BHD: "George Best Belfast City (BHD)",
  LPL: "Liverpool John Lennon (LPL)",
  EMA: "East Midlands Airport (EMA)",
  BRS: "Bristol Airport (BRS)",
  CWL: "Cardiff Airport (CWL)",
  ABZ: "Aberdeen Airport (ABZ)",
  DUB: "Dublin Airport (DUB)",

  // Saudi Arabia & Middle East
  JED: "King Abdulaziz Int'l, Jeddah (JED)",
  MED: "Prince Mohammad Bin Abdulaziz, Madinah (MED)",
  RUH: "King Khalid Int'l, Riyadh (RUH)",
  DMM: "King Fahd Int'l, Dammam (DMM)",
  AMM: "Queen Alia Int'l, Amman (AMM)",
  DXB: "Dubai International (DXB)",
  DWC: "Al Maktoum Int'l (DWC)",
  AUH: "Zayed International, Abu Dhabi (AUH)",
  SHJ: "Sharjah International (SHJ)",
  DOH: "Hamad International, Doha (DOH)",
  BAH: "Bahrain International (BAH)",
  KWI: "Kuwait International (KWI)",
  MCT: "Muscat International (MCT)",
  BEY: "Beirut-Rafic Hariri Int'l (BEY)",
  CAI: "Cairo International (CAI)",
  HBE: "Borg El Arab, Alexandria (HBE)",

  // Turkey & Europe
  IST: "Istanbul Airport (IST)",
  SAW: "Sabiha Gokcen Int'l, Istanbul (SAW)",
  AYT: "Antalya Airport (AYT)",
  ADB: "Izmir Adnan Menderes (ADB)",
  CDG: "Paris Charles de Gaulle (CDG)",
  ORY: "Paris Orly (ORY)",
  FRA: "Frankfurt Airport (FRA)",
  MUC: "Munich Airport (MUC)",
  AMS: "Amsterdam Schiphol (AMS)",
  BRU: "Brussels Airport (BRU)",
  FCO: "Rome Fiumicino (FCO)",
  MXP: "Milan Malpensa (MXP)",
  MAD: "Madrid-Barajas (MAD)",
  BCN: "Barcelona-El Prat (BCN)",
  ZRH: "Zurich Airport (ZRH)",
  VIE: "Vienna International (VIE)",
  GVA: "Geneva Airport (GVA)",
  CPH: "Copenhagen Airport (CPH)",

  // North America
  YYZ: "Toronto Pearson International (YYZ)",
  YVR: "Vancouver International (YVR)",
  YUL: "Montreal-Trudeau (YUL)",
  YYC: "Calgary International (YYC)",
  YOW: "Ottawa Macdonald-Cartier (YOW)",
  JFK: "John F. Kennedy Int'l, New York (JFK)",
  EWR: "Newark Liberty Int'l (EWR)",
  LGA: "LaGuardia Airport, New York (LGA)",
  ORD: "Chicago O'Hare Int'l (ORD)",
  MDW: "Chicago Midway (MDW)",
  LAX: "Los Angeles International (LAX)",
  SFO: "San Francisco International (SFO)",
  IAD: "Washington Dulles Int'l (IAD)",
  DCA: "Ronald Reagan Washington (DCA)",
  DFW: "Dallas/Fort Worth Int'l (DFW)",
  IAH: "George Bush Intercontinental, Houston (IAH)",
  MIA: "Miami International (MIA)",
  MCO: "Orlando International (MCO)",
  BOS: "Boston Logan International (BOS)",
  ATL: "Hartsfield-Jackson Atlanta (ATL)",
  SEA: "Seattle-Tacoma Int'l (SEA)",

  // South Asia
  ISB: "Islamabad International (ISB)",
  LHE: "Allama Iqbal Int'l, Lahore (LHE)",
  KHI: "Jinnah International, Karachi (KHI)",
  PEW: "Bacha Khan Int'l, Peshawar (PEW)",
  MUX: "Multan International (MUX)",
  SKT: "Sialkot International (SKT)",
  DEL: "Indira Gandhi Int'l, Delhi (DEL)",
  BOM: "Chhatrapati Shivaji Maharaj, Mumbai (BOM)",
  DAC: "Hazrat Shahjalal Int'l, Dhaka (DAC)",
  CMB: "Bandaranaike Int'l, Colombo (CMB)",

  // Southeast Asia & Others
  KUL: "Kuala Lumpur International (KUL)",
  SIN: "Singapore Changi (SIN)",
  BKK: "Suvarnabhumi Airport, Bangkok (BKK)",
  CGK: "Soekarno-Hatta Int'l, Jakarta (CGK)",
  MLE: "Velana International, Maldives (MLE)",
};

function getAirportDisplay(codeOrName: string | undefined | null): string {
  if (!codeOrName || typeof codeOrName !== 'string') return '-';
  const trimmed = codeOrName.trim();
  if (!trimmed || trimmed === 'Departure Airport' || trimmed === 'Arrival Airport') return '-';
  if (trimmed.includes('(') && trimmed.includes(')')) return trimmed;
  const upper = trimmed.toUpperCase();
  if (AIRPORT_MAP[upper]) return AIRPORT_MAP[upper];
  return trimmed;
}

const AIRLINE_MAP: Record<string, string> = {
  DL: "Delta Air Lines",
  RJ: "Royal Jordanian",
  SV: "Saudia",
  BA: "British Airways",
  EK: "Emirates",
  QR: "Qatar Airways",
  TK: "Turkish Airlines",
  MS: "EgyptAir",
  WY: "Oman Air",
  GF: "Gulf Air",
  KU: "Kuwait Airways",
  FZ: "flydubai",
  XY: "flynas",
  PK: "PIA (Pakistan International Airlines)",
  LH: "Lufthansa",
  AF: "Air France",
  KL: "KLM",
  UA: "United Airlines",
  AA: "American Airlines",
  AC: "Air Canada",
  EY: "Etihad Airways",
  VS: "Virgin Atlantic",
  SQ: "Singapore Airlines",
  TG: "Thai Airways",
  MH: "Malaysia Airlines",
  AT: "Royal Air Maroc",
  PC: "Pegasus Airlines",
  W9: "Wizz Air UK",
  W6: "Wizz Air",
  U2: "easyJet",
  FR: "Ryanair",
  ME: "Middle East Airlines",
  RB: "Syrian Air",
  IA: "Iraqi Airways",
  J9: "Jazeera Airways",
};

function getAirlineName(flight: any): string {
  if (!flight) return "Scheduled International Carrier";
  const candidate = flight.airline || flight.airlineCarrier;
  if (candidate && typeof candidate === 'string' && candidate.trim()) {
    const clean = candidate.trim();
    const lower = clean.toLowerCase();
    if (!lower.includes("travel") && !lower.includes("polani") && !lower.includes("basma") && !lower.includes("vendor") && !lower.includes("supplier") && !lower.includes("fleet")) {
      return clean;
    }
  }

  if (flight.flightNo && typeof flight.flightNo === 'string') {
    const match = flight.flightNo.trim().toUpperCase().match(/^([A-Z0-9]{2})/);
    if (match && AIRLINE_MAP[match[1]]) {
      return AIRLINE_MAP[match[1]];
    }
  }

  return "Scheduled International Carrier";
}

function sortFlightsChronologically(flights: any[]): any[] {
  if (!flights || !Array.isArray(flights)) return [];
  return [...flights].sort((a, b) => {
    const dateA = a.departureDate || a.date || '';
    const dateB = b.departureDate || b.date || '';
    const timeA = a.departureTime || a.departTime || '00:00';
    const timeB = b.departureTime || b.departTime || '00:00';

    const parseA = Date.parse(`${dateA}T${timeA.length === 5 ? timeA + ':00' : timeA}`) || Date.parse(`${dateA} ${timeA}`) || Date.parse(dateA) || 0;
    const parseB = Date.parse(`${dateB}T${timeB.length === 5 ? timeB + ':00' : timeB}`) || Date.parse(`${dateB} ${timeB}`) || Date.parse(dateB) || 0;

    if (parseA !== parseB) {
      return parseA - parseB;
    }
    return (dateA + timeA).localeCompare(dateB + timeB);
  });
}

export const InvoiceTemplate: React.FC<InvoiceTemplateProps> = ({ booking, companyInfo }) => {
  const { symbol } = useCurrency();
  if (!booking) return null;

  const companyName = companyInfo?.name || "Tooba Travels Ltd";
  const companyLogo = companyInfo?.logo;
  const companyAddress = companyInfo?.location || "63 Buxton Road, London, E17 7EH";
  const companyPhone = companyInfo?.phone || "+44 20 7946 0958";
  const companyEmail = companyInfo?.email || "operations@toobatravels.co.uk";
  const companyWebsite = companyInfo?.website || "www.toobatravels.co.uk";
  
  // Official Tooba Travels Bank Remittance Details
  const bankName = companyInfo?.bankName || "Lloyds Bank";
  const accountName = companyInfo?.accountName || "TOOBA TRAVELS LTD";
  const sortCode = companyInfo?.sortCode || "30-54-66";
  const accountNumber = companyInfo?.accountNumber || "19401663";
  const billingAddress = companyInfo?.billingAddress || "63 Buxton Road, London, E17 7EH";

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

  // Chronologically sorted flights
  const rawFlights = booking.flightServices || [];
  const sortedFlights = sortFlightsChronologically(rawFlights);

  // Accommodations, Transports, and Visas
  const accommodations = booking.accommodations || [];
  const transports = booking.transportServices || [];
  const visas = booking.visaServices || [];

  const hasAccommodations = accommodations.length > 0;
  const hasTransports = transports.length > 0;
  const hasVisas = visas.length > 0;
  const hasGroundLogistics = hasAccommodations || hasTransports || hasVisas;

  // Travel dates & duration calculation
  let travelDatesText = "Dates TBA";
  let totalNights = 0;
  if (hasAccommodations) {
    const valid = accommodations.filter((a: any) => a.checkInDate && a.checkOutDate);
    if (valid.length > 0) {
      const earliest = new Date(Math.min(...valid.map((a: any) => new Date(a.checkInDate).getTime())));
      const latest = new Date(Math.max(...valid.map((a: any) => new Date(a.checkOutDate).getTime())));
      totalNights = Math.max(1, Math.round((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24)));
      travelDatesText = `${earliest.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} to ${latest.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} (${totalNights + 1} Days / ${totalNights} Nights)`;
    }
  } else if (sortedFlights.length > 0) {
    const firstFlight = sortedFlights[0];
    const lastFlight = sortedFlights[sortedFlights.length - 1];
    const depDate = firstFlight.departureDate || firstFlight.date;
    const retDate = lastFlight.departureDate || lastFlight.date;
    if (depDate && retDate) {
      const d1 = new Date(depDate);
      const d2 = new Date(retDate);
      const diff = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
      travelDatesText = `${d1.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} to ${d2.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} (${diff + 1} Days)`;
    } else if (depDate) {
      travelDatesText = new Date(depDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }
  } else if (booking.departureDate && booking.returnDate) {
    const d1 = new Date(booking.departureDate);
    const d2 = new Date(booking.returnDate);
    const diff = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
    travelDatesText = `${d1.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} to ${d2.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} (${diff + 1} Days)`;
  }

  // Package Route
  const packageRoute = sortedFlights.length > 0
    ? `${getAirportDisplay(sortedFlights[0].departedFromAirportName || sortedFlights[0].departedFrom)} to ${getAirportDisplay(sortedFlights[sortedFlights.length - 1].arrivedAtAirportName || sortedFlights[sortedFlights.length - 1].arrivedAt)}`
    : "London Heathrow (LHR) to Jeddah / Madinah (Return)";

  // Dynamic contracted inclusions (never mention non-included services)
  const inclusions: string[] = [];
  if (sortedFlights.length > 0) {
    inclusions.push("Return scheduled flights with luggage & airport taxes included");
  }
  if (hasAccommodations) {
    const hotelNames = accommodations.map((h: any) => h.hotelName).filter(Boolean).join(", ");
    inclusions.push(`Hotel accommodations (${hotelNames || "Confirmed hotel booking"})`);
  }
  if (hasTransports) {
    inclusions.push("Ground transportation circuits and airport transfers");
  }
  if (hasVisas) {
    inclusions.push("Saudi entrance / tourist visa processing and issuing");
  }
  if (inclusions.length === 0) {
    inclusions.push("Arranged travel management services as contracted");
  }

  const isSpiritualOrUmrah = !booking.tripType || booking.tripType.toLowerCase().includes("umrah") || booking.tripType.toLowerCase().includes("spiritual");
  const cleanTripType = isSpiritualOrUmrah
    ? (sortedFlights.length > 0 && !hasAccommodations ? "Flight Travel" : "Tailored Travel")
    : booking.tripType;
  const packageTypeDisplay = `${totalNights > 0 ? `${totalNights + 1}D/${totalNights}N ` : ""}${cleanTripType} Package`;

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

      {/* PAGE 1: ITINERARY, FLIGHT SCHEDULE & BILLING BREAKDOWN */}
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
              <p className="text-[9px] text-slate-600"><span className="font-semibold">Phone:</span> {leadCustomer?.phone || leadCustomer?.phoneNumber || "Phone on file"}</p>
              <p className="text-[9px] text-slate-600"><span className="font-semibold">Email:</span> {leadCustomer?.email || "Email on file"}</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Package Itinerary Overview</p>
              <p className="font-bold text-slate-900 text-[11px]">{packageRoute}</p>
              <p className="text-[9px] text-slate-600"><span className="font-semibold">Travel Dates:</span> {travelDatesText}</p>
              <p className="text-[9px] text-slate-600"><span className="font-semibold">Manifest:</span> {booking.customers?.length || 1} Passenger(s)</p>
              <p className="text-[9px] text-slate-600"><span className="font-semibold">Package Type:</span> {packageTypeDisplay}</p>
            </div>
          </div>

          {/* Confirmed Flight Schedule (Strictly Sorted Chronologically) */}
          <div className="mb-4">
            <div className="bg-slate-900 text-white font-extrabold text-[10px] uppercase px-2.5 py-1 rounded-t flex justify-between">
              <span>Confirmed Flight Schedule</span>
              <span className="font-normal text-[9px] opacity-80">All timings in local airport times</span>
            </div>
            <table className="w-full text-left border-collapse border border-slate-200 text-[9.5px]">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-1.5 w-[18%]">Sector / Route</th>
                  <th className="p-1.5 w-[27%]">Departure Airport & Time</th>
                  <th className="p-1.5 w-[27%]">Arrival Airport & Time</th>
                  <th className="p-1.5 w-[14%]">Transit / Airline</th>
                  <th className="p-1.5 w-[14%]">Cabin & Baggage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedFlights.length > 0 ? (
                  sortedFlights.map((f: any, idx: number) => {
                    let sectorLabel = `Sector ${idx + 1}`;
                    if (sortedFlights.length === 1) {
                      sectorLabel = 'One-Way Flight';
                    } else if (sortedFlights.length === 2) {
                      sectorLabel = idx === 0 ? 'Outbound Flight' : 'Inbound Flight';
                    } else {
                      const half = Math.ceil(sortedFlights.length / 2);
                      sectorLabel = idx < half ? `Outbound (Leg ${idx + 1})` : `Inbound (Leg ${idx + 1})`;
                    }

                    const depDateRaw = f.departureDate || f.date;
                    const dateStr = depDateRaw ? new Date(depDateRaw).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '-';
                    const fromAirport = getAirportDisplay(f.departedFromAirportName || f.departedFrom);
                    const toAirport = getAirportDisplay(f.arrivedAtAirportName || f.arrivedAt);
                    const airlineName = getAirlineName(f);
                    const flightNo = f.flightNo || 'TBA';
                    const depTime = f.departTime || f.departureTime || 'TBA';
                    const arrTime = f.arrivalTime || f.arriveTime || 'TBA';
                    const aircraft = f.aircraft || 'Commercial Jet';
                    const cabin = f.flightClass || 'Economy Class';
                    const holdBag = f.checkedBaggage || f.baggageAllowance || f.baggage || '23kg Hold Luggage';
                    const handBag = f.carryOnBaggage || '7kg Cabin Bag';
                    const isDirect = !f.isTransit && (!f.flightType || f.flightType.toLowerCase().includes('direct'));

                    return (
                      <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                        <td className="p-1.5 align-top">
                          <strong className="block text-slate-900 uppercase text-[9px]">{sectorLabel}</strong>
                          <span className="font-bold text-blue-900">{f.departedFrom || 'DEP'} → {f.arrivedAt || 'ARR'}</span>
                          <div className="text-[8.5px] font-mono text-sky-700 font-bold">{flightNo}</div>
                          <div className="text-[8.5px] text-slate-500">{dateStr}</div>
                        </td>
                        <td className="p-1.5 align-top">
                          <strong className="text-slate-800 block text-[9.5px]">{fromAirport}</strong>
                          <div className="text-slate-700 font-semibold mt-0.5">Dep: <span className="font-bold text-slate-900">{depTime}</span></div>
                          <div className="text-[8.5px] text-slate-500">Airline: {airlineName}</div>
                        </td>
                        <td className="p-1.5 align-top">
                          <strong className="text-slate-800 block text-[9.5px]">{toAirport}</strong>
                          <div className="text-slate-700 font-semibold mt-0.5">Arr: <span className="font-bold text-slate-900">{arrTime}</span></div>
                          <div className="text-[8.5px] text-slate-500">{f.pnr ? `PNR: ${f.pnr}` : `Flight ${flightNo}`}</div>
                        </td>
                        <td className="p-1.5 align-top">
                          {isDirect ? (
                            <span className="text-emerald-700 font-bold block">Direct Flight</span>
                          ) : (
                            <span className="text-amber-700 font-bold block">Connecting / Transit</span>
                          )}
                          <div className="text-[8.5px] text-slate-500 mt-0.5">{aircraft}</div>
                        </td>
                        <td className="p-1.5 align-top">
                          <strong className="block text-slate-800">{cabin}</strong>
                          <div className="text-[8.5px] text-slate-600">{holdBag}</div>
                          <div className="text-[8.5px] text-slate-400">{handBag}</div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="p-3 text-center text-slate-400 italic">No scheduled flight segments registered.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Accommodation & Ground Logistics Cards (Only rendered if actually present) */}
          {hasGroundLogistics && (
            <div className={`grid gap-2.5 mb-4 ${accommodations.length + (hasTransports ? 1 : 0) + (hasVisas ? 1 : 0) > 2 ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {accommodations.map((h: any, idx: number) => (
                <div key={idx} className="border border-slate-200 rounded p-2.5 bg-white">
                  <p className="text-[9px] font-black text-slate-900 uppercase mb-1">{h.city ? `${h.city} Accommodation` : `Hotel Stay ${idx + 1}`}</p>
                  <p className="font-bold text-blue-900 text-[10px]">{h.hotelName || 'Confirmed Hotel'}</p>
                  <p className="text-[8.5px] text-slate-600 mt-1">
                    <span className="font-semibold">Duration:</span> {h.checkInDate ? new Date(h.checkInDate).toLocaleDateString('en-GB') : '-'} to {h.checkOutDate ? new Date(h.checkOutDate).toLocaleDateString('en-GB') : '-'}
                  </p>
                  <p className="text-[8.5px] text-slate-600"><span className="font-semibold">Room:</span> {h.roomType || 'Standard Room'}</p>
                  <p className="text-[8.5px] text-slate-600"><span className="font-semibold">Board:</span> {h.mealType || 'Room Only'}</p>
                </div>
              ))}

              {hasTransports && (
                <div className="border border-slate-200 rounded p-2.5 bg-white">
                  <p className="text-[9px] font-black text-slate-900 uppercase mb-1">Ground Logistics & Transfers</p>
                  <p className="font-bold text-blue-900 text-[10px]">Private Ground Transport</p>
                  <div className="text-[8.5px] text-slate-600 mt-1 space-y-0.5">
                    {transports.slice(0, 3).map((t: any, idx: number) => (
                      <div key={idx}>• {t.pickupLocation || 'Origin'} to {t.dropoffLocation || 'Destination'} ({t.vehicleType || 'Private Vehicle'})</div>
                    ))}
                  </div>
                </div>
              )}

              {hasVisas && (
                <div className="border border-slate-200 rounded p-2.5 bg-white">
                  <p className="text-[9px] font-black text-slate-900 uppercase mb-1">Visa Processing & Authorization</p>
                  <p className="font-bold text-blue-900 text-[10px]">Official Travel Authorization</p>
                  <div className="text-[8.5px] text-slate-600 mt-1 space-y-0.5">
                    {visas.slice(0, 3).map((v: any, idx: number) => (
                      <div key={idx}>• {v.visaType || 'Saudi Tourist / Entry Visa'} - {v.country || 'Saudi Arabia'} ({v.visaStatus || 'Confirmed'})</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. Package Billing & Inclusions Table (Amount Details) */}
          <div className="mb-3">
            <div className="bg-slate-900 text-white font-extrabold text-[10px] uppercase px-2.5 py-1 rounded-t flex justify-between">
              <span>3. Package Billing & Inclusions Breakdown</span>
              <span className="font-normal text-[9px] opacity-80">All taxes & contracted inclusions itemized</span>
            </div>
            <table className="w-full text-left border-collapse border border-slate-200 text-[9px]">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-1.5 w-[58%]">Contracted Inclusions & Itemized Description</th>
                  <th className="p-1.5 text-center w-[12%]">Quantity</th>
                  <th className="p-1.5 text-right w-[15%]">Rate ({symbol})</th>
                  <th className="p-1.5 text-right w-[15%]">Total ({symbol})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="p-1.5">
                    <strong className="text-slate-900 block font-bold text-[9.5px]">{cleanTripType} Package Provision</strong>
                    <ul className="list-disc pl-4 text-[8.5px] text-slate-600 mt-0.5 space-y-0.5">
                      {inclusions.map((inc, i) => (
                        <li key={i}>{inc}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="p-1.5 text-center font-bold align-top">{booking.customers?.length || 1} Pax</td>
                  <td className="p-1.5 text-right align-top">{(totalGross / (booking.customers?.length || 1)).toFixed(2)}</td>
                  <td className="p-1.5 text-right font-bold align-top">{totalGross.toFixed(2)}</td>
                </tr>

                {booking.additionalServices?.map((s: any) => (
                  <tr key={s.id}>
                    <td className="p-1.5">
                      <strong className="text-slate-900">{s.serviceName}</strong>
                      <div className="text-[8px] text-slate-500">{s.description}</div>
                    </td>
                    <td className="p-1.5 text-center font-bold">1</td>
                    <td className="p-1.5 text-right">{Number(s.price || 0).toFixed(2)}</td>
                    <td className="p-1.5 text-right font-bold">{Number(s.price || 0).toFixed(2)}</td>
                  </tr>
                ))}

                {booking.discounts?.map((d: any) => (
                  <tr key={d.id} className="text-rose-600">
                    <td className="p-1.5">
                      <strong>Discount: {d.description}</strong>
                    </td>
                    <td className="p-1.5 text-center font-bold">1</td>
                    <td className="p-1.5 text-right">-{Number(d.amount || 0).toFixed(2)}</td>
                    <td className="p-1.5 text-right font-bold">-{Number(d.amount || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 4. Financial Settlement Summary & Official Bank Remittance (Amount Details) */}
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div className="border-2 border-sky-500 rounded-lg p-2.5 bg-gradient-to-br from-sky-50 to-blue-50 text-[9.5px] shadow-sm">
              <div className="flex justify-between items-center border-b border-sky-200 pb-1 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-600 inline-block"></span>
                  <p className="font-black text-sky-950 uppercase text-[9px] tracking-wide">Official Bank Remittance Details</p>
                </div>
                <span className="text-[7.5px] font-bold bg-sky-600 text-white px-1.5 py-0.5 rounded uppercase">Direct Settlement</span>
              </div>
              <p><span className="font-semibold text-slate-600">Bank:</span> <strong className="text-slate-900">{bankName}</strong></p>
              <p><span className="font-semibold text-slate-600">Account Name:</span> <strong className="text-slate-900">{accountName}</strong></p>
              <div className="flex items-center gap-2 my-1">
                <div>
                  <span className="font-semibold text-slate-600 text-[8px] block">Sort Code:</span>
                  <span className="inline-block bg-yellow-200 text-yellow-950 border border-yellow-400 font-mono font-black px-1.5 py-0.5 rounded text-[11px]">{sortCode}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-600 text-[8px] block">Account Number:</span>
                  <span className="inline-block bg-yellow-200 text-yellow-950 border border-yellow-400 font-mono font-black px-1.5 py-0.5 rounded text-[11px]">{accountNumber}</span>
                </div>
              </div>
              <p className="text-[8px]"><span className="font-semibold text-slate-600">Billing Address:</span> {billingAddress}</p>
              <p className="text-[8px] text-slate-500 mt-0.5">Payment Reference: <strong className="font-mono text-rose-700 font-bold">{booking.bookingReference}</strong></p>
            </div>

            <div className="border border-slate-200 rounded-lg p-2.5 bg-white text-[9.5px] space-y-1">
              <div className="flex justify-between font-semibold text-slate-700">
                <span>Total Package Price:</span>
                <span>{symbol}{totalGross.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-emerald-700">
                <span>Confirmed Settled:</span>
                <span>{symbol}{totalSettled.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-black text-[12px] text-slate-900 border-t border-slate-200 pt-1">
                <span>Total Balance Due:</span>
                <span className="text-blue-900">{symbol}{balanceDue.toFixed(2)}</span>
              </div>
              <p className="text-[8px] text-slate-500 text-right pt-0.5">Initial Deposit Required: {symbol}{depositDue.toFixed(2)}</p>
              <p className="text-[7.5px] text-slate-400 text-right">Government taxes, APD & regulatory surcharges included</p>
            </div>
          </div>
        </div>

        {/* Page 1 Footer */}
        <div className="border-t border-slate-200 pt-2 flex justify-between text-[8.5px] text-slate-400">
          <span>{companyName} • Official Travel & Logistics Service Provider</span>
          <span>Page 1 of 2 (Reservation & Package Billing Settlement)</span>
        </div>
      </div>

      <div className="page-break" style={{ pageBreakAfter: 'always', breakAfter: 'page', height: 0, margin: 0, padding: 0 }} />

      {/* PAGE 2: TERMS & CONDITIONS AND CLIENT ACCEPTANCE SIGNATURE */}
      <div className="tax-invoice-page p-6 min-h-[1050px] flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-3">
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">TERMS & CONDITIONS</h2>
              <p className="text-[10px] font-extrabold text-rose-700 uppercase tracking-tight">{companyName} - BOOKING TERMS, CONDITIONS & LEGAL DISCLAIMERS</p>
            </div>
            <span className="text-[10px] font-black text-slate-900 uppercase tracking-wider">PAGE 2 OF 2</span>
          </div>

          {/* 13 Clauses in 2 columns */}
          <div className="grid grid-cols-2 gap-4 text-[8.5px] text-slate-600 leading-relaxed text-justify mb-4">
            <div className="space-y-2.5">
              <div>
                <strong className="text-slate-900 font-bold text-[9px] mr-1">1. Legally Binding Agreement:</strong>
                By submitting payment, the client explicitly agrees to be legally bound by all terms. Failure to digitally sign within 48 hours constitutes irrevocable acceptance. All issued tickets and packages are strictly non-changeable and non-refundable.
              </div>

              <div>
                <strong className="text-slate-900 font-bold text-[9px] mr-1">2. Payment & Settlement:</strong>
                A deposit strictly secures reservations. Balance must be cleared prior to ticket issuance. The client bears absolute sole responsibility for any supplementary resort fees, city taxes, or mandatory airline/hotel surcharges.
              </div>

              <div>
                <strong className="text-slate-900 font-bold text-[9px] mr-1">3. Strict Cancellation Policy:</strong>
                Cancellations incur strict penalty charges. Credit for future reservations from initial deposits is entirely at the agency's sole discretion. {companyName} assumes zero liability for issuing full refunds once services are booked and issued.
              </div>

              <div>
                <strong className="text-slate-900 font-bold text-[9px] mr-1">4. Force Majeure:</strong>
                In unforeseen disruptions (e.g., weather, regulatory mandates, border closures), clients may carry forward or reschedule. Standard cancellation penalties apply if reschedule is declined.
              </div>

              <div>
                <strong className="text-slate-900 font-bold text-[9px] mr-1">5. Flight Obligations:</strong>
                Clients bear absolute responsibility for exact name matches on passports (minimum 6 months validity required). {companyName} accepts zero liability for boarding denials. Group fares and block-booked seats are unequivocally non-refundable once issued.
              </div>

              <div>
                <strong className="text-slate-900 font-bold text-[9px] mr-1">6. Visa & Immigration:</strong>
                Visa eligibility and issuance are strictly at the absolute discretion of destination ministries and consulates. Customers bear sole responsibility for verifying eligibility and possessing valid passports and documentation.
              </div>

              <div>
                <strong className="text-slate-900 font-bold text-[9px] mr-1">7. Accommodation & Transfers:</strong>
                We reserve the right to alter hotels to equivalent properties without prior notice during peak seasons or full bookings. Star ratings correspond to local destination standards.
              </div>
            </div>

            <div className="space-y-2.5">
              <div>
                <strong className="text-slate-900 font-bold text-[9px] mr-1">8. Specialized & Package Travel:</strong>
                {companyName} operates solely as an authorized travel booking agent and disclaims liability for airline schedule revisions or operating carrier substitutions.
              </div>

              <div>
                <strong className="text-slate-900 font-bold text-[9px] mr-1">9. Transport & Ground Services:</strong>
                Passengers must ensure punctual arrival for scheduled departures and transfers. We accept no liability for traffic congestion or missed connections.
              </div>

              <div>
                <strong className="text-slate-900 font-bold text-[9px] mr-1">10. Third-Party Liability & Insurance:</strong>
                All services are subject to the terms of the operating supplier. We strongly recommend purchasing comprehensive travel insurance for cancellations, emergencies, and missed departures.
              </div>

              <div>
                <strong className="text-slate-900 font-bold text-[9px] mr-1">11. Chargebacks & Payment Disputes:</strong>
                The customer agrees not to initiate credit card chargebacks for legitimately booked non-refundable services. Any grievances must be reported to {companyName} directly within 28 days.
              </div>

              <div>
                <strong className="text-slate-900 font-bold text-[9px] mr-1">12. Hotel Check-In & Check-Out Times:</strong>
                The customer is strictly responsible for adhering to hotel check-in and check-out policies. Early arrival or late departure arrangements must be coordinated directly.
              </div>

              <div>
                <strong className="text-slate-900 font-bold text-[9px] mr-1">13. Governing Law:</strong>
                This contract is governed by and construed in accordance with English Law, and both parties submit to the exclusive jurisdiction of the Courts of England and Wales.
              </div>
            </div>
          </div>

          {/* Client Acceptance and Signatures (Placed Beneath Terms & Conditions) */}
          <div className="border border-slate-300 rounded p-3.5 bg-slate-50 mt-2">
            <h3 className="text-[10px] font-black text-slate-900 uppercase mb-1.5">Legal Acceptance & Booking Confirmation Signatures</h3>
            <p className="text-[8.5px] text-slate-600 mb-3 leading-relaxed">
              By signing below, the lead passenger accepts these arrangements on behalf of all persons listed in this booking. The signer certifies that they have read, understood, and agreed to all 13 terms and conditions listed above.
            </p>

            <div className="grid grid-cols-2 gap-8 pt-2">
              <div className="border-t-2 border-slate-400 pt-1.5">
                <p className="font-bold text-slate-900 text-[10px]">Lead Passenger Signature</p>
                <p className="text-[9px] text-slate-500">Name: <span className="font-semibold text-slate-800">{customerFullName}</span></p>
                <p className="text-[9px] text-slate-500">Date: __________________________</p>
              </div>

              <div className="border-t-2 border-slate-400 pt-1.5">
                <p className="font-bold text-slate-900 text-[10px]">Authorized Agency Signatory</p>
                <p className="text-[9px] text-slate-500">For & On Behalf of: <span className="font-semibold text-slate-800">{companyName}</span></p>
                <p className="text-[9px] text-slate-500">Date: {new Date().toLocaleDateString('en-GB')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Page 2 Footer */}
        <div className="border-t border-slate-200 pt-2 flex justify-between text-[8.5px] text-slate-400">
          <span>{companyName} • Regulated Tourism & Booking Agreement</span>
          <span>Page 2 of 2 (Contractual Terms & Acceptance Signatures)</span>
        </div>
      </div>
    </div>
  );
};
