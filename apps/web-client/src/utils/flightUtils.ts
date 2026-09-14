// Comprehensive Utility for Airlines, Airports, and Transit Time Calculations
import { AIRPORT_TEXT_MAP } from './airportData';

const AIRLINE_MAP: Record<string, string> = {
  DL: 'Delta Air Lines',
  RJ: 'Royal Jordanian',
  SV: 'Saudia',
  EK: 'Emirates',
  BA: 'British Airways',
  MS: 'EgyptAir',
  QR: 'Qatar Airways',
  EY: 'Etihad Airways',
  TK: 'Turkish Airlines',
  WY: 'Oman Air',
  GF: 'Gulf Air',
  XY: 'Flynas',
  FZ: 'Flydubai',
  PK: 'Pakistan Intl Airlines (PIA)',
  PA: 'Airblue',
  ER: 'SereneAir',
  PF: 'Fly Jinnah',
  AA: 'American Airlines',
  UA: 'United Airlines',
  LH: 'Lufthansa',
  AF: 'Air France',
  KL: 'KLM Royal Dutch Airlines',
  SQ: 'Singapore Airlines',
  MH: 'Malaysia Airlines',
  AI: 'Air India',
  IX: 'Air India Express',
  '6E': 'IndiGo',
  TG: 'Thai Airways',
  KU: 'Kuwait Airways',
  ME: 'Middle East Airlines',
  J9: 'Jazeera Airways',
  G9: 'Air Arabia',
  VS: 'Virgin Atlantic',
  AC: 'Air Canada',
  CX: 'Cathay Pacific',
  QF: 'Qantas Airways',
  ET: 'Ethiopian Airlines',
  AT: 'Royal Air Maroc',
  HY: 'Uzbekistan Airways',
};

const AIRPORT_MAP: Record<string, { city: string; name: string; country: string }> = {
  LHR: { city: 'London', name: 'London Heathrow Airport', country: 'UK' },
  LGW: { city: 'London', name: 'London Gatwick Airport', country: 'UK' },
  STN: { city: 'London', name: 'London Stansted Airport', country: 'UK' },
  LTN: { city: 'London', name: 'London Luton Airport', country: 'UK' },
  MAN: { city: 'Manchester', name: 'Manchester Airport', country: 'UK' },
  BHX: { city: 'Birmingham', name: 'Birmingham Airport', country: 'UK' },
  EDI: { city: 'Edinburgh', name: 'Edinburgh Airport', country: 'UK' },
  GLA: { city: 'Glasgow', name: 'Glasgow Airport', country: 'UK' },
  
  JED: { city: 'Jeddah', name: 'King Abdulaziz Intl Airport', country: 'Saudi Arabia' },
  MED: { city: 'Medina', name: 'Prince Mohammad bin Abdulaziz Airport', country: 'Saudi Arabia' },
  RUH: { city: 'Riyadh', name: 'King Khalid Intl Airport', country: 'Saudi Arabia' },
  DMM: { city: 'Dammam', name: 'King Fahd Intl Airport', country: 'Saudi Arabia' },
  TIF: { city: 'Taif', name: 'Taif Regional Airport', country: 'Saudi Arabia' },

  AMM: { city: 'Amman', name: 'Queen Alia Intl Airport', country: 'Jordan' },
  DXB: { city: 'Dubai', name: 'Dubai Intl Airport', country: 'UAE' },
  AUH: { city: 'Abu Dhabi', name: 'Zayed Intl Airport', country: 'UAE' },
  SHJ: { city: 'Sharjah', name: 'Sharjah Intl Airport', country: 'UAE' },
  DOH: { city: 'Doha', name: 'Hamad Intl Airport', country: 'Qatar' },
  MCT: { city: 'Muscat', name: 'Muscat Intl Airport', country: 'Oman' },
  KWI: { city: 'Kuwait City', name: 'Kuwait Intl Airport', country: 'Kuwait' },
  BAH: { city: 'Manama', name: 'Bahrain Intl Airport', country: 'Bahrain' },

  IST: { city: 'Istanbul', name: 'Istanbul Airport', country: 'Turkey' },
  SAW: { city: 'Istanbul', name: 'Sabiha Gokcen Airport', country: 'Turkey' },
  CAI: { city: 'Cairo', name: 'Cairo Intl Airport', country: 'Egypt' },

  KHI: { city: 'Karachi', name: 'Jinnah Intl Airport', country: 'Pakistan' },
  LHE: { city: 'Lahore', name: 'Allama Iqbal Intl Airport', country: 'Pakistan' },
  ISB: { city: 'Islamabad', name: 'Islamabad Intl Airport', country: 'Pakistan' },
  PEW: { city: 'Peshawar', name: 'Bacha Khan Intl Airport', country: 'Pakistan' },
  MUX: { city: 'Multan', name: 'Multan Intl Airport', country: 'Pakistan' },
  SKT: { city: 'Sialkot', name: 'Sialkot Intl Airport', country: 'Pakistan' },

  YYZ: { city: 'Toronto', name: 'Toronto Pearson Intl Airport', country: 'Canada' },
  YVR: { city: 'Vancouver', name: 'Vancouver Intl Airport', country: 'Canada' },
  JFK: { city: 'New York', name: 'John F. Kennedy Intl Airport', country: 'USA' },
  ORD: { city: 'Chicago', name: 'O\'Hare Intl Airport', country: 'USA' },
  LAX: { city: 'Los Angeles', name: 'Los Angeles Intl Airport', country: 'USA' },
  IAD: { city: 'Washington D.C.', name: 'Dulles Intl Airport', country: 'USA' },
};

/**
 * Returns full Airline Name from code or flight number (e.g. DL5935 -> Delta Air Lines)
 */
export function getAirlineName(flightNoOrCode?: string | null): string {
  if (!flightNoOrCode) return '';
  const trimmed = flightNoOrCode.trim().toUpperCase();
  const codeMatch = trimmed.match(/^([A-Z0-9]{2})/);
  if (codeMatch && AIRLINE_MAP[codeMatch[1]]) {
    return AIRLINE_MAP[codeMatch[1]];
  }
  return flightNoOrCode;
}

/**
 * Returns Airport Name & City from 3-letter IATA code using AIRPORT_MAP & airport.text data
 */
export function getAirportName(code?: string | null): string {
  if (!code) return '';
  const cleanCode = code.trim().toUpperCase();
  if (AIRPORT_MAP[cleanCode]) {
    const item = AIRPORT_MAP[cleanCode];
    return `${item.city} (${cleanCode}) - ${item.name}`;
  }
  if (AIRPORT_TEXT_MAP[cleanCode]) {
    return `${cleanCode} - ${AIRPORT_TEXT_MAP[cleanCode]}`;
  }
  return cleanCode;
}

/**
 * Returns short Airport City + Code (e.g. London (LHR))
 */
export function getAirportShort(code?: string | null): string {
  if (!code) return '';
  const cleanCode = code.trim().toUpperCase();
  if (AIRPORT_MAP[cleanCode]) {
    const item = AIRPORT_MAP[cleanCode];
    return `${item.city} (${cleanCode})`;
  }
  if (AIRPORT_TEXT_MAP[cleanCode]) {
    const full = AIRPORT_TEXT_MAP[cleanCode];
    const cityOrName = full.split(' ')[0] || cleanCode;
    return `${cityOrName} (${cleanCode})`;
  }
  return cleanCode;
}

/**
 * Parses time string like "17:50", "1750", "5:50 PM", "17:50:00" into { hours, minutes }
 */
export function parseTimeString(timeStr?: string | null): { hours: number; minutes: number } | null {
  if (!timeStr) return null;
  const clean = timeStr.trim();
  
  // Format HH:MM or HH:MM:SS
  const match1 = clean.match(/^(\d{1,2}):(\d{2})/);
  if (match1) {
    return { hours: parseInt(match1[1], 10), minutes: parseInt(match1[2], 10) };
  }
  
  // Format HHMM (4 digits e.g. 1750)
  const match2 = clean.match(/^(\d{2})(\d{2})$/);
  if (match2) {
    return { hours: parseInt(match2[1], 10), minutes: parseInt(match2[2], 10) };
  }

  return null;
}

/**
 * Parses date string into a Date object at 00:00:00
 */
export function parseDateString(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return null;
}

/**
 * Automatically calculates flight duration / layover duration between departure and arrival.
 * Returns formatted string like "2h 50m" or "4h 55m".
 */
export function calculateTransitTime(
  arrDateStr?: string | null,
  arrTimeStr?: string | null,
  depDateStr?: string | null,
  depTimeStr?: string | null
): string | null {
  const arrTimeParsed = parseTimeString(arrTimeStr);
  const depTimeParsed = parseTimeString(depTimeStr);

  if (!arrTimeParsed || !depTimeParsed) return null;

  let arrDateTime = parseDateString(arrDateStr) || new Date(2026, 0, 1);
  arrDateTime.setHours(arrTimeParsed.hours, arrTimeParsed.minutes, 0, 0);

  let depDateTime = parseDateString(depDateStr) || new Date(2026, 0, 1);
  depDateTime.setHours(depTimeParsed.hours, depTimeParsed.minutes, 0, 0);

  // Handle overnight arrival -> next day departure if departure time is earlier than arrival time on same date
  if (depDateTime.getTime() <= arrDateTime.getTime()) {
    if (!depDateStr || !arrDateStr || depDateStr === arrDateStr) {
      depDateTime.setDate(depDateTime.getDate() + 1);
    }
  }

  const diffMs = depDateTime.getTime() - arrDateTime.getTime();
  if (diffMs < 0) return null;

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0 && minutes === 0) return null;

  if (hours === 0) {
    return `${minutes}m`;
  }
  if (minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}m`;
}

/**
 * Calculates layover between two CONSECUTIVE flight services (Leg 1 Arrival -> Leg 2 Departure).
 * Does NOT calculate on the same flight's departure and arrival time.
 * Respects user's choice of Direct Flight vs Transit Flight.
 */
export function getTransitBetweenFlights(f1: any, f2: any): string | null {
  if (!f1 || !f2) return null;

  // Direct flight check: If both flights are set as Direct Flight, do NOT calculate transit layover
  if (f1.flightType === 'Direct' && f2.flightType === 'Direct') {
    return null;
  }
  if (f1.isTransit === false && f2.isTransit === false && f1.flightType !== 'Transit' && f2.flightType !== 'Transit') {
    return null;
  }

  const f1ArrAirport = (f1.arrivedAt || '').trim().toUpperCase();
  const f2DepAirport = (f2.departedFrom || '').trim().toUpperCase();

  // Layover occurs when f1 arrives where f2 departs
  if (f1ArrAirport && f2DepAirport && f1ArrAirport === f2DepAirport) {
    const transit = calculateTransitTime(
      f1.date,
      f1.arrivalTime,
      f2.date || f1.date,
      f2.departTime
    );
    if (!transit) return null;

    // Check connecting window: If layover is > 36 hours (e.g. 194h return flight), ignore unless explicitly marked 'Transit'
    const arrTimeParsed = parseTimeString(f1.arrivalTime);
    const depTimeParsed = parseTimeString(f2.departTime);
    if (arrTimeParsed && depTimeParsed) {
      const arrD = parseDateString(f1.date) || new Date();
      arrD.setHours(arrTimeParsed.hours, arrTimeParsed.minutes, 0, 0);
      const depD = parseDateString(f2.date || f1.date) || new Date();
      depD.setHours(depTimeParsed.hours, depTimeParsed.minutes, 0, 0);

      const diffHours = (depD.getTime() - arrD.getTime()) / (1000 * 60 * 60);
      if (diffHours > 36 && f1.flightType !== 'Transit' && f2.flightType !== 'Transit' && !f1.isTransit && !f2.isTransit) {
        return null;
      }
    }

    return `${transit} layover at ${f1ArrAirport}`;
  }
  return null;
}
