import { useState, useEffect, useRef } from 'react';
import { 
  Printer, Save, Package, Plus, Trash2, Plane, 
  Building2, Car, ShieldCheck, RefreshCw, FileText,
  Download, Edit3, Folder, Star, CheckCircle2, 
  X, ArrowRight, Tag, ChevronDown, ChevronUp, Lock, Unlock, Pencil,
  Sparkles, Columns, Zap, Calculator
} from 'lucide-react';
import { api } from '../api/axios';
import { useAuthStore } from '../store/authStore';
import { toast } from 'react-hot-toast';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { getAirlineName, getAirportName, getAirportShort, calculateTransitTime } from '../utils/flightUtils';

export interface FlightSegment {
  id: string;
  airline: string;
  flightNo: string;
  departedFrom: string;
  arrivedAt: string;
  date: string;
  departTime: string;
  arrivalTime: string;
  craft?: string;
  baggage?: string;
  pnr?: string;
}

interface HotelItem {
  name: string;
  location: string;
  ratingStars: number;
  ratingLabel: string;
  checkInDate: string;
  checkOutDate: string;
  stayDuration: string;
  isManualStayDuration?: boolean;
  roomType: string;
  boardBasis: string;
  featureBadge: string;
  price?: string;
  priceType?: 'per_person' | 'total';
}

interface SectorItem {
  label: string;
}

const BOARD_BASIS_OPTIONS = [
  'Room Only',
  'Bed & Breakfast',
  'Half Board',
  'Full Board',
  'All Inclusive'
];

const ROOM_TYPE_OPTIONS = [
  'Single Room',
  'Double Room',
  'Twin Room',
  'Triple Room',
  'Quad Room',
  'Quint Room',
  'Executive Suite',
  'Family Suite',
  'Superior Room King Bed (City View)',
  'Deluxe Haram View'
];

const CITY_OPTIONS = [
  'Makkah Al-Mukarramah',
  'Madinah Al-Munawwarah',
  'Jeddah',
  'Riyadh',
  'Taif',
  'Al-Ula'
];

const CHECKED_BAGGAGE_OPTIONS = [
  '1x 23kg (pp)',
  '2x 23kg (pp)',
  '1x 32kg (pp)',
  'Hand Luggage Only',
  'No Checked Baggage'
];

const CABIN_BAGGAGE_OPTIONS = [
  '+ Cabin Bag (pp)',
  '+ Hand Luggage (pp)',
  '+ 2x Cabin Bags',
  'No Cabin Bag'
];

const BRAND_THEMES = [
  { label: 'Navy Slate', value: '#0f172a' },
  { label: 'Royal Blue', value: '#1e3a8a' },
  { label: 'Deep Indigo', value: '#312e81' },
  { label: 'Emerald Green', value: '#065f46' },
  { label: 'Royal Purple', value: '#4c1d95' }
];

const VISA_TEMPLATES = [
  {
    id: 'uk_eta',
    label: 'UK Saudi ETA (British Citizens)',
    title: 'Saudi Electronic Travel Authorisation (ETA)',
    validity: '2-Year Multiple Entry Visa',
    eligibility: 'British Passport Holders',
    processing: 'Full electronic documentation & support included'
  },
  {
    id: 'us_eu_evisa',
    label: 'US / EU Resident eVisa',
    title: 'Saudi Electronic Visa (eVisa)',
    validity: '1-Year Multiple Entry Visa',
    eligibility: 'US / EU Passport & Resident Card Holders',
    processing: 'Full electronic documentation & support included'
  },
  {
    id: 'umrah_visa',
    label: 'Official Saudi Umrah Visa',
    title: 'Official Saudi Umrah Tourist Visa',
    validity: '90 Days Single/Multiple Entry',
    eligibility: 'All Eligible Nationalities',
    processing: 'Includes Umrah Insurance & Nusuk App Registration'
  },
  {
    id: 'gcc_evisa',
    label: 'GCC Resident eVisa',
    title: 'GCC Resident Saudi eVisa',
    validity: '1-Year Multiple Entry Visa',
    eligibility: 'GCC Residency Permit Holders',
    processing: 'Electronic visa approval & support'
  }
];

export function PackageGeneratorPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'split' | 'editor' | 'preview' | 'saved'>('split');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [savedPackages, setSavedPackages] = useState<any[]>([]);

  // Accordion Expand/Collapse States
  const [openSections, setOpenSections] = useState({
    company: false,
    meta: true,
    flights: true,
    hotels: true,
    transfers: true,
    visa: true,
    pricing: true
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // PNR Import Modal
  const [showPnrModal, setShowPnrModal] = useState(false);
  const [pnrText, setPnrText] = useState('');

  // Dynamic Tenant & Company Context
  const [companyInfo, setCompanyInfo] = useState({
    companyName: 'Tooba Travels Ltd',
    logoPrimary: '',
    officeAddress: '63 Buxton Road, London, E17 7EH',
    emailSender: 'office.toobatravels.co.uk',
    landlineFormat: '0203 371 8774',
    brandColor: '#0f172a'
  });

  // Quotation Meta
  const [quoteId, setQuoteId] = useState<number | null>(null);
  const [refNumber, setRefNumber] = useState('REF: TT-UMR-950');
  const [quoteDate, setQuoteDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [preparedFor, setPreparedFor] = useState('2 Adults (British Passports)');
  
  const [title, setTitle] = useState('UMRAH PACKAGE QUOTATION');
  const [subtitle, setSubtitle] = useState('10 Days / 9 Nights Tailored Spiritual Journey');
  const [passengerBadge, setPassengerBadge] = useState('2 Passengers • British Citizens');

  // Summary Metrics
  const [departureAirport, setDepartureAirport] = useState('London Heathrow (LHR)');
  const [startDate, setStartDate] = useState('2026-11-09');
  const [endDate, setEndDate] = useState('2026-11-19');
  const [travelDatesText, setTravelDatesText] = useState('09 Nov – 19 Nov 2026');
  const [totalDurationText, setTotalDurationText] = useState('10 Days / 9 Nights');
  const [airlineCarrier, setAirlineCarrier] = useState('Royal Jordanian');
  const [flightClass, setFlightClass] = useState('Royal Jordanian • Economy Class');

  // Dynamic Outbound Flight Segments (Matching Booking Flight Section)
  const [outboundPnr, setOutboundPnr] = useState('RJ-OUTBOUND-PNR');
  const [outboundRoute, setOutboundRoute] = useState('LHR -> JED');
  const [outboundDepDate, setOutboundDepDate] = useState('2026-11-09');
  const [outboundDateText, setOutboundDateText] = useState('Mon, 09 Nov 2026');
  const [outboundTransitText, setOutboundTransitText] = useState('Transit in Amman (AMM): 1 hr 30 mins');
  const [outboundArrivalNote, setOutboundArrivalNote] = useState('Arrival: Tue, 10 Nov (03:45)');
  
  const [outboundCheckedBag, setOutboundCheckedBag] = useState('1x 23kg (pp)');
  const [outboundCabinBag, setOutboundCabinBag] = useState('+ Cabin Bag (pp)');
  const [outboundBaggage, setOutboundBaggage] = useState('Baggage: 1x 23kg + Cabin Bag (pp)');

  const [outboundLegs, setOutboundLegs] = useState<FlightSegment[]>([
    {
      id: 'out-1',
      airline: 'Royal Jordanian',
      flightNo: 'RJ 112',
      craft: 'Boeing 787-9',
      departedFrom: 'LHR',
      arrivedAt: 'AMM',
      date: '2026-11-09',
      departTime: '16:05 LHR (T3)',
      arrivalTime: '00:05 AMM (+1)',
      baggage: '23 Kg'
    },
    {
      id: 'out-2',
      airline: 'Royal Jordanian',
      flightNo: 'RJ 704',
      craft: 'Boeing 787',
      departedFrom: 'AMM',
      arrivedAt: 'JED',
      date: '2026-11-10',
      departTime: '01:35 AMM',
      arrivalTime: '03:45 JED (T1)',
      baggage: '23 Kg'
    }
  ]);

  // Dynamic Inbound Flight Segments
  const [inboundPnr, setInboundPnr] = useState('RJ-INBOUND-PNR');
  const [inboundRoute, setInboundRoute] = useState('MED -> LHR');
  const [inboundDepDate, setInboundDepDate] = useState('2026-11-19');
  const [inboundDateText, setInboundDateText] = useState('Thu, 19 Nov 2026');
  const [inboundTransitText, setInboundTransitText] = useState('Transit in Amman (AMM): 3 hrs 00 mins');
  const [inboundArrivalNote, setInboundArrivalNote] = useState('Arrival: Thu, 19 Nov (14:20)');
  
  const [inboundCheckedBag, setInboundCheckedBag] = useState('1x 23kg (pp)');
  const [inboundCabinBag, setInboundCabinBag] = useState('+ Cabin Bag (pp)');
  const [inboundBaggage, setInboundBaggage] = useState('Baggage: 1x 23kg + Cabin Bag (pp)');

  const [inboundLegs, setInboundLegs] = useState<FlightSegment[]>([
    {
      id: 'in-1',
      airline: 'Royal Jordanian',
      flightNo: 'RJ 723',
      craft: 'Boeing 787-8',
      departedFrom: 'MED',
      arrivedAt: 'AMM',
      date: '2026-11-19',
      departTime: '07:00 MED',
      arrivalTime: '08:55 AMM',
      baggage: '23 Kg'
    },
    {
      id: 'in-2',
      airline: 'Royal Jordanian',
      flightNo: 'RJ 111',
      craft: 'Boeing 787-9',
      departedFrom: 'AMM',
      arrivedAt: 'LHR',
      date: '2026-11-19',
      departTime: '11:55 AMM',
      arrivalTime: '14:20 LHR (T3)',
      baggage: '23 Kg'
    }
  ]);

  // Hotels
  const [hotelStaySummaryBadge, setHotelStaySummaryBadge] = useState('9 Nights Total Stay');
  const [hotels, setHotels] = useState<HotelItem[]>([
    {
      name: 'voco Makkah',
      location: 'Makkah Al-Mukarramah',
      ratingStars: 4,
      ratingLabel: '(4-Star)',
      checkInDate: '2026-11-10',
      checkOutDate: '2026-11-15',
      stayDuration: '5 Nights (10 Nov – 15 Nov 2026)',
      isManualStayDuration: false,
      roomType: 'Quad Room',
      boardBasis: 'Room Only',
      featureBadge: '24/7 Dedicated Haram Shuttle Bus Service',
      price: '250.00',
      priceType: 'per_person'
    },
    {
      name: 'Millennium Taiba Hotel',
      location: 'Madinah Al-Munawwarah',
      ratingStars: 5,
      ratingLabel: '(Luxury)',
      checkInDate: '2026-11-15',
      checkOutDate: '2026-11-19',
      stayDuration: '4 Nights (15 Nov – 19 Nov 2026)',
      isManualStayDuration: false,
      roomType: 'Superior Room King Bed (City View)',
      boardBasis: 'Room Only',
      featureBadge: 'Steps from Al-Masjid an-Nabawi Courtyard',
      price: '150.00',
      priceType: 'per_person'
    }
  ]);

  // Transfers & Visa
  const [transferTitle, setTransferTitle] = useState('Private AC Vehicle Circuit');
  const [transferSectors, setTransferSectors] = useState<SectorItem[]>([
    { label: 'Sector 1: Jeddah Airport (JED) -> voco Makkah Hotel' },
    { label: 'Sector 2: Makkah Hotel -> Millennium Taiba Madinah' },
    { label: 'Sector 3: Millennium Taiba Madinah -> Madinah Airport (MED)' }
  ]);

  const [selectedVisaTemplate, setSelectedVisaTemplate] = useState('uk_eta');
  const [visaTitle, setVisaTitle] = useState('Saudi Electronic Travel Authorisation (ETA)');
  const [visaValidity, setVisaValidity] = useState('2-Year Multiple Entry Visa');
  const [visaEligibility, setVisaEligibility] = useState('British Passport Holders');
  const [visaProcessing, setVisaProcessing] = useState('Full electronic documentation & support included');

  // Section-based Itemized Pricing
  const [pricingMode, setPricingMode] = useState<'breakdown' | 'manual'>('breakdown');
  const [showPriceBreakdownOnDoc, setShowPriceBreakdownOnDoc] = useState(false);

  const [flightPrice, setFlightPrice] = useState('450.00');
  const [flightPriceType, setFlightPriceType] = useState<'per_person' | 'total'>('per_person');

  const [transfersPrice, setTransfersPrice] = useState('100.00');
  const [transfersPriceType, setTransfersPriceType] = useState<'per_person' | 'total'>('total');

  const [visaPrice, setVisaPrice] = useState('50.00');
  const [visaPriceType, setVisaPriceType] = useState<'per_person' | 'total'>('per_person');

  const [otherPrice, setOtherPrice] = useState('0.00');
  const [otherPriceTitle, setOtherPriceTitle] = useState('Ziyarat & Local Tours');
  const [otherPriceType, setOtherPriceType] = useState<'per_person' | 'total'>('total');

  // Overall Pricing
  const [pricePerPerson, setPricePerPerson] = useState('950.00');
  const [passengerCount, setPassengerCount] = useState(2);
  const [totalPackagePrice, setTotalPackagePrice] = useState('1900.00');
  const [isManualTotalPrice, setIsManualTotalPrice] = useState(false);

  const [priceIncludes, setPriceIncludes] = useState('Includes Return Flights, 9 Nights Hotels, Private Ground Transfers & ETA Visas');

  const [importantTerms, setImportantTerms] = useState(
    'Rates and flight availability are subject to re-confirmation at the time of final booking and payment. British passport validity must be at least 6 months from the departure date. Hotel standard check-in is 16:00 and check-out is 12:00. Non-refundable package terms apply upon ticket issuance.'
  );

  const printRef = useRef<HTMLDivElement>(null);

  // Helper: Compute stay duration string automatically
  const computeStayDuration = (checkIn: string, checkOut: string): string => {
    if (!checkIn || !checkOut) return '';
    try {
      const cin = new Date(checkIn);
      const cout = new Date(checkOut);
      const diffTime = cout.getTime() - cin.getTime();
      const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (isNaN(nights) || nights <= 0) return '';
      const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
      const inFmt = cin.toLocaleDateString('en-GB', opts);
      const outFmt = cout.toLocaleDateString('en-GB', opts);
      const yearFmt = cout.getFullYear();
      return `${nights} Night${nights > 1 ? 's' : ''} (${inFmt} – ${outFmt} ${yearFmt})`;
    } catch (e) {
      return '';
    }
  };

  // Helper: Compute route string from flight legs array
  const getRouteFromLegs = (legs: FlightSegment[], defaultRoute: string): string => {
    if (!legs || legs.length === 0) return defaultRoute;
    const start = getAirportShort(legs[0].departedFrom) || legs[0].departedFrom;
    const end = getAirportShort(legs[legs.length - 1].arrivedAt) || legs[legs.length - 1].arrivedAt;
    if (start && end) return `${start} -> ${end}`;
    return defaultRoute;
  };

  // Helper: Compute transit layover between consecutive legs
  const computeTransitTextForLegs = (legs: FlightSegment[]): string => {
    if (!legs || legs.length <= 1) return '';
    const layovers: string[] = [];
    for (let i = 0; i < legs.length - 1; i++) {
      const leg1 = legs[i];
      const leg2 = legs[i + 1];
      const arrMatch = leg1.arrivalTime?.match(/(\d{1,2}:\d{2})/);
      const depMatch = leg2.departTime?.match(/(\d{1,2}:\d{2})/);
      const airportCode = getAirportShort(leg1.arrivedAt) || leg1.arrivedAt || 'Transit';
      if (arrMatch && depMatch) {
        const transit = calculateTransitTime(leg1.date, arrMatch[1], leg2.date, depMatch[1]);
        if (transit) {
          layovers.push(`Transit in ${getAirportName(airportCode)} (${airportCode}): ${transit}`);
        }
      }
    }
    return layovers.join(' • ');
  };

  // Helper: Section price calculation
  const getSectionTotal = (amountStr: string, priceType: 'per_person' | 'total', pax: number): number => {
    const val = parseFloat(amountStr) || 0;
    return priceType === 'per_person' ? val * Math.max(1, pax) : val;
  };

  const getSectionPP = (amountStr: string, priceType: 'per_person' | 'total', pax: number): number => {
    const val = parseFloat(amountStr) || 0;
    if (priceType === 'per_person') return val;
    return pax > 0 ? val / pax : val;
  };

  const calculateBreakdownTotals = (
    pax: number, 
    fPrice: string, fType: 'per_person' | 'total',
    hts: HotelItem[],
    tPrice: string, tType: 'per_person' | 'total',
    vPrice: string, vType: 'per_person' | 'total',
    oPrice: string, oType: 'per_person' | 'total'
  ) => {
    const safePax = Math.max(1, pax);
    const fTotal = getSectionTotal(fPrice, fType, safePax);
    const hTotal = hts.reduce((sum, h) => sum + getSectionTotal(h.price || '0', h.priceType || 'per_person', safePax), 0);
    const tTotal = getSectionTotal(tPrice, tType, safePax);
    const vTotal = getSectionTotal(vPrice, vType, safePax);
    const oTotal = getSectionTotal(oPrice, oType, safePax);

    const grandTotal = fTotal + hTotal + tTotal + vTotal + oTotal;
    const ppTotal = safePax > 0 ? grandTotal / safePax : 0;

    return {
      fTotal,
      hTotal,
      tTotal,
      vTotal,
      oTotal,
      grandTotal,
      ppTotal
    };
  };

  // Sync Outbound Baggage text
  useEffect(() => {
    setOutboundBaggage(`Baggage: ${outboundCheckedBag} ${outboundCabinBag}`.trim());
  }, [outboundCheckedBag, outboundCabinBag]);

  // Sync Inbound Baggage text
  useEffect(() => {
    setInboundBaggage(`Baggage: ${inboundCheckedBag} ${inboundCabinBag}`.trim());
  }, [inboundCheckedBag, inboundCabinBag]);

  // Fetch company context & tenant profile on load
  useEffect(() => {
    fetchCompanyContext();
    fetchSavedPackages();
  }, []);

  const fetchCompanyContext = async () => {
    try {
      const [ctxRes, tenantRes] = await Promise.all([
        api.get('/finance/company-context').catch(() => null),
        api.get('/tenants/profile').catch(() => null)
      ]);
      
      const ctx = ctxRes?.data?.companyContext;
      const tenant = tenantRes?.data?.tenant;

      setCompanyInfo(prev => ({
        ...prev,
        companyName: ctx?.companyName || tenant?.name || 'Tooba Travels Ltd',
        logoPrimary: ctx?.logoPrimary || tenant?.logo || '',
        officeAddress: ctx?.officeAddress || tenant?.location || '63 Buxton Road, London, E17 7EH',
        emailSender: ctx?.emailSender || tenant?.email || 'office.toobatravels.co.uk',
        landlineFormat: ctx?.landlineFormat || tenant?.phone || '0203 371 8774',
        brandColor: ctx?.brandColor || prev.brandColor || '#0f172a'
      }));
    } catch (err) {
      console.error('Failed to fetch company context:', err);
    }
  };

  const fetchSavedPackages = async () => {
    setLoading(true);
    try {
      const res = await api.get('/packages');
      if (res.data?.packages) {
        setSavedPackages(res.data.packages);
      }
    } catch (err) {
      console.error('Failed to fetch saved packages:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto calculate overall trip dates & nights
  useEffect(() => {
    if (startDate && endDate) {
      try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = end.getTime() - start.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 0) {
          setTotalDurationText(`${diffDays + 1} Days / ${diffDays} Nights`);
          setHotelStaySummaryBadge(`${diffDays} Nights Total Stay`);
        }
        
        const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
        const startFmt = start.toLocaleDateString('en-GB', opts);
        const endFmt = end.toLocaleDateString('en-GB', opts);
        setTravelDatesText(`${startFmt} – ${endFmt}`);
      } catch (e) {}
    }
  }, [startDate, endDate]);

  // Outbound date formatting
  useEffect(() => {
    if (outboundDepDate) {
      try {
        const d = new Date(outboundDepDate);
        const dayName = d.toLocaleDateString('en-GB', { weekday: 'short' });
        const dayFmt = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        setOutboundDateText(`${dayName}, ${dayFmt}`);
      } catch (e) {}
    }
  }, [outboundDepDate]);

  // Inbound date formatting
  useEffect(() => {
    if (inboundDepDate) {
      try {
        const d = new Date(inboundDepDate);
        const dayName = d.toLocaleDateString('en-GB', { weekday: 'short' });
        const dayFmt = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        setInboundDateText(`${dayName}, ${dayFmt}`);
      } catch (e) {}
    }
  }, [inboundDepDate]);

  // Auto calculate total package price and price per person
  useEffect(() => {
    if (pricingMode === 'breakdown') {
      const { grandTotal, ppTotal } = calculateBreakdownTotals(
        passengerCount,
        flightPrice, flightPriceType,
        hotels,
        transfersPrice, transfersPriceType,
        visaPrice, visaPriceType,
        otherPrice, otherPriceType
      );
      setTotalPackagePrice(grandTotal.toFixed(2));
      setPricePerPerson(ppTotal.toFixed(2));
    } else if (!isManualTotalPrice) {
      const ppp = parseFloat(pricePerPerson) || 0;
      const total = ppp * passengerCount;
      setTotalPackagePrice(total.toFixed(2));
    }
  }, [
    pricingMode,
    passengerCount,
    flightPrice, flightPriceType,
    hotels,
    transfersPrice, transfersPriceType,
    visaPrice, visaPriceType,
    otherPrice, otherPriceType,
    pricePerPerson,
    isManualTotalPrice
  ]);

  // Auto sync Outbound transit & route
  useEffect(() => {
    const computedRoute = getRouteFromLegs(outboundLegs, outboundRoute);
    if (computedRoute) setOutboundRoute(computedRoute);
    const transit = computeTransitTextForLegs(outboundLegs);
    if (transit) setOutboundTransitText(transit);
  }, [outboundLegs]);

  // Auto sync Inbound transit & route
  useEffect(() => {
    const computedRoute = getRouteFromLegs(inboundLegs, inboundRoute);
    if (computedRoute) setInboundRoute(computedRoute);
    const transit = computeTransitTextForLegs(inboundLegs);
    if (transit) setInboundTransitText(transit);
  }, [inboundLegs]);

  // Visa Template Handler
  const handleSelectVisaTemplate = (templateId: string) => {
    setSelectedVisaTemplate(templateId);
    const tmpl = VISA_TEMPLATES.find(t => t.id === templateId);
    if (tmpl) {
      setVisaTitle(tmpl.title);
      setVisaValidity(tmpl.validity);
      setVisaEligibility(tmpl.eligibility);
      setVisaProcessing(tmpl.processing);
      toast.success(`Applied ${tmpl.label}`);
    }
  };

  const handleLoadUmrahPreset = () => {
    setQuoteId(null);
    setRefNumber(`REF: TT-UMR-${Math.floor(100 + Math.random() * 900)}`);
    setQuoteDate(new Date().toISOString().split('T')[0]);
    setPreparedFor('2 Adults (British Passports)');
    setTitle('UMRAH PACKAGE QUOTATION');
    setSubtitle('10 Days / 9 Nights Tailored Spiritual Journey');
    setPassengerBadge('2 Passengers • British Citizens');
    
    setDepartureAirport('London Heathrow (LHR)');
    setStartDate('2026-11-09');
    setEndDate('2026-11-19');
    setAirlineCarrier('Royal Jordanian');
    setFlightClass('Royal Jordanian • Economy Class');

    setOutboundPnr('RJ-OUTBOUND-PNR');
    setOutboundRoute('LHR -> JED');
    setOutboundDepDate('2026-11-09');
    setOutboundCheckedBag('1x 23kg (pp)');
    setOutboundCabinBag('+ Cabin Bag (pp)');
    setOutboundArrivalNote('Arrival: Tue, 10 Nov (03:45)');

    setOutboundLegs([
      {
        id: 'out-1',
        airline: 'Royal Jordanian',
        flightNo: 'RJ 112',
        craft: 'Boeing 787-9',
        departedFrom: 'LHR',
        arrivedAt: 'AMM',
        date: '2026-11-09',
        departTime: '16:05 LHR (T3)',
        arrivalTime: '00:05 AMM (+1)',
        baggage: '23 Kg'
      },
      {
        id: 'out-2',
        airline: 'Royal Jordanian',
        flightNo: 'RJ 704',
        craft: 'Boeing 787',
        departedFrom: 'AMM',
        arrivedAt: 'JED',
        date: '2026-11-10',
        departTime: '01:35 AMM',
        arrivalTime: '03:45 JED (T1)',
        baggage: '23 Kg'
      }
    ]);

    setInboundPnr('RJ-INBOUND-PNR');
    setInboundRoute('MED -> LHR');
    setInboundDepDate('2026-11-19');
    setInboundCheckedBag('1x 23kg (pp)');
    setInboundCabinBag('+ Cabin Bag (pp)');
    setInboundArrivalNote('Arrival: Thu, 19 Nov (14:20)');

    setInboundLegs([
      {
        id: 'in-1',
        airline: 'Royal Jordanian',
        flightNo: 'RJ 723',
        craft: 'Boeing 787-8',
        departedFrom: 'MED',
        arrivedAt: 'AMM',
        date: '2026-11-19',
        departTime: '07:00 MED',
        arrivalTime: '08:55 AMM',
        baggage: '23 Kg'
      },
      {
        id: 'in-2',
        airline: 'Royal Jordanian',
        flightNo: 'RJ 111',
        craft: 'Boeing 787-9',
        departedFrom: 'AMM',
        arrivedAt: 'LHR',
        date: '2026-11-19',
        departTime: '11:55 AMM',
        arrivalTime: '14:20 LHR (T3)',
        baggage: '23 Kg'
      }
    ]);

    setHotels([
      {
        name: 'voco Makkah',
        location: 'Makkah Al-Mukarramah',
        ratingStars: 4,
        ratingLabel: '(4-Star)',
        checkInDate: '2026-11-10',
        checkOutDate: '2026-11-15',
        stayDuration: '5 Nights (10 Nov – 15 Nov 2026)',
        isManualStayDuration: false,
        roomType: 'Quad Room',
        boardBasis: 'Room Only',
        featureBadge: '24/7 Dedicated Haram Shuttle Bus Service',
        price: '250.00',
        priceType: 'per_person'
      },
      {
        name: 'Millennium Taiba Hotel',
        location: 'Madinah Al-Munawwarah',
        ratingStars: 5,
        ratingLabel: '(Luxury)',
        checkInDate: '2026-11-15',
        checkOutDate: '2026-11-19',
        stayDuration: '4 Nights (15 Nov – 19 Nov 2026)',
        isManualStayDuration: false,
        roomType: 'Superior Room King Bed (City View)',
        boardBasis: 'Room Only',
        featureBadge: 'Steps from Al-Masjid an-Nabawi Courtyard',
        price: '150.00',
        priceType: 'per_person'
      }
    ]);

    setTransferTitle('Private AC Vehicle Circuit');
    setTransferSectors([
      { label: 'Sector 1: Jeddah Airport (JED) -> voco Makkah Hotel' },
      { label: 'Sector 2: Makkah Hotel -> Millennium Taiba Madinah' },
      { label: 'Sector 3: Millennium Taiba Madinah -> Madinah Airport (MED)' }
    ]);

    handleSelectVisaTemplate('uk_eta');

    // Preset itemized pricing
    setFlightPrice('450.00');
    setFlightPriceType('per_person');
    setTransfersPrice('100.00');
    setTransfersPriceType('total');
    setVisaPrice('50.00');
    setVisaPriceType('per_person');
    setOtherPrice('0.00');
    setOtherPriceTitle('Ziyarat & Local Tours');
    setOtherPriceType('total');
    setPricingMode('breakdown');
    setShowPriceBreakdownOnDoc(true);

    setPassengerCount(2);
    setPricePerPerson('950.00');
    setTotalPackagePrice('1900.00');
    setIsManualTotalPrice(false);
    setPriceIncludes('Includes Return Flights, 9 Nights Hotels, Private Ground Transfers & ETA Visas');

    setImportantTerms(
      'Rates and flight availability are subject to re-confirmation at the time of final booking and payment. British passport validity must be at least 6 months from the departure date. Hotel standard check-in is 16:00 and check-out is 12:00. Non-refundable package terms apply upon ticket issuance.'
    );

    toast.success('Loaded Umrah Sample Quotation!');
    setActiveTab('split');
  };

  // Smart GDS PNR / Flight Text Converter
  const handleParsePnrText = () => {
    if (!pnrText.trim()) {
      toast.error('Please paste flight PNR or itinerary text');
      return;
    }
    try {
      const text = pnrText.trim();
      const flightRegex = /([A-Z0-9]{2})\s*(\d{3,4})\s*(?:[A-Z]\s*)?(\d{2}[A-Z]{3})?\s*([A-Z]{3})\s*([A-Z]{3})\s*(\d{4})\s*(\d{4})/gi;
      const matches = [...text.matchAll(flightRegex)];

      if (matches.length > 0) {
        const parsedLegs: FlightSegment[] = matches.map((m, idx) => {
          const airline = getAirlineName(m[1]) || m[1];
          const depTimeStr = `${m[6].slice(0,2)}:${m[6].slice(2)} ${m[4]}`;
          const arrTimeStr = `${m[7].slice(0,2)}:${m[7].slice(2)} ${m[5]}`;
          return {
            id: `pnr-leg-${idx}`,
            airline,
            flightNo: `${m[1]} ${m[2]}`,
            departedFrom: m[4],
            arrivedAt: m[5],
            date: startDate || new Date().toISOString().split('T')[0],
            departTime: depTimeStr,
            arrivalTime: arrTimeStr,
            baggage: '23 Kg'
          };
        });

        if (parsedLegs.length > 0) {
          const detectedAirline = parsedLegs[0].airline;
          if (detectedAirline) setAirlineCarrier(detectedAirline);
          setDepartureAirport(getAirportName(parsedLegs[0].departedFrom));

          if (parsedLegs.length >= 2) {
            setOutboundLegs(parsedLegs.slice(0, Math.ceil(parsedLegs.length / 2)));
            setInboundLegs(parsedLegs.slice(Math.ceil(parsedLegs.length / 2)));
          } else {
            setOutboundLegs(parsedLegs);
          }
        }

        toast.success(`Successfully parsed ${matches.length} flight segments from PNR text!`);
        setShowPnrModal(false);
        setPnrText('');
      } else {
        toast.error('Could not auto-detect standard PNR format. You can edit the segment fields directly.');
      }
    } catch (e) {
      toast.error('Error parsing PNR text.');
    }
  };

  const handleSavePackage = async () => {
    setSaving(true);
    try {
      const payload = {
        referenceNumber: refNumber,
        title,
        subtitle,
        preparedFor,
        passengerBadge,
        departureAirport,
        travelDates: travelDatesText,
        totalDuration: totalDurationText,
        airlineCarrier,
        flightClass,
        flightOutboundJson: {
          pnr: outboundPnr,
          route: outboundRoute,
          dateText: outboundDateText,
          depDate: outboundDepDate,
          transitText: outboundTransitText,
          arrivalNote: outboundArrivalNote,
          baggage: outboundBaggage,
          legs: outboundLegs,
          // Backward compatibility fallback fields:
          leg1No: outboundLegs[0]?.flightNo || '',
          leg1Craft: outboundLegs[0]?.craft || '',
          leg1Dep: outboundLegs[0]?.departTime || '',
          leg1Arr: outboundLegs[0]?.arrivalTime || '',
          leg2No: outboundLegs[1]?.flightNo || '',
          leg2Craft: outboundLegs[1]?.craft || '',
          leg2Dep: outboundLegs[1]?.departTime || '',
          leg2Arr: outboundLegs[1]?.arrivalTime || ''
        },
        flightInboundJson: {
          pnr: inboundPnr,
          route: inboundRoute,
          dateText: inboundDateText,
          depDate: inboundDepDate,
          transitText: inboundTransitText,
          arrivalNote: inboundArrivalNote,
          baggage: inboundBaggage,
          legs: inboundLegs,
          // Backward compatibility fallback fields:
          leg1No: inboundLegs[0]?.flightNo || '',
          leg1Craft: inboundLegs[0]?.craft || '',
          leg1Dep: inboundLegs[0]?.departTime || '',
          leg1Arr: inboundLegs[0]?.arrivalTime || '',
          leg2No: inboundLegs[1]?.flightNo || '',
          leg2Craft: inboundLegs[1]?.craft || '',
          leg2Dep: inboundLegs[1]?.departTime || '',
          leg2Arr: inboundLegs[1]?.arrivalTime || ''
        },
        hotelsJson: hotels,
        transfersJson: {
          title: transferTitle,
          sectors: transferSectors
        },
        visaJson: {
          title: visaTitle,
          validity: visaValidity,
          eligibility: visaEligibility,
          processing: visaProcessing
        },
        pricingMode,
        showPriceBreakdownOnDoc,
        sectionPricingJson: {
          flightPrice,
          flightPriceType,
          transfersPrice,
          transfersPriceType,
          visaPrice,
          visaPriceType,
          otherPrice,
          otherPriceTitle,
          otherPriceType,
          pricingMode,
          showPriceBreakdownOnDoc
        },
        pricePerPerson,
        totalPackagePrice,
        priceIncludes,
        importantTerms,
        agentName: user?.name || 'Agent',
        companyName: companyInfo.companyName,
        companyLogo: companyInfo.logoPrimary,
        companyPhone: companyInfo.landlineFormat,
        companyEmail: companyInfo.emailSender,
        brandColor: companyInfo.brandColor
      };

      if (quoteId) {
        await api.put(`/packages/${quoteId}`, payload);
        toast.success('Package quotation updated successfully');
      } else {
        const res = await api.post('/packages', payload);
        if (res.data?.package?.id) {
          setQuoteId(res.data.package.id);
        }
        toast.success('Package quotation saved successfully');
      }

      // Also persist updated company context to backend
      try {
        await api.put('/finance/company-context', {
          companyName: companyInfo.companyName,
          logoPrimary: companyInfo.logoPrimary,
          officeAddress: companyInfo.officeAddress,
          emailSender: companyInfo.emailSender,
          landlineFormat: companyInfo.landlineFormat,
          brandColor: companyInfo.brandColor
        });
      } catch (e) {}

      fetchSavedPackages();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to save package quotation');
    } finally {
      setSaving(false);
    }
  };

  const handleLoadPackage = (item: any) => {
    try {
      setQuoteId(item.id);
      setRefNumber(item.referenceNumber || `REF: TT-UMR-${item.id}`);
      setTitle(item.title || 'UMRAH PACKAGE QUOTATION');
      setSubtitle(item.subtitle || '');
      setPreparedFor(item.preparedFor || '');
      setPassengerBadge(item.passengerBadge || '');

      setDepartureAirport(item.departureAirport || '');
      setTravelDatesText(item.travelDates || '');
      setTotalDurationText(item.totalDuration || '');
      setAirlineCarrier(item.airlineCarrier || '');
      setFlightClass(item.flightClass || '');

      if (item.companyName || item.companyLogo) {
        setCompanyInfo(prev => ({
          ...prev,
          companyName: item.companyName || prev.companyName,
          logoPrimary: item.companyLogo || prev.logoPrimary,
          officeAddress: item.companyAddress || prev.officeAddress,
          emailSender: item.companyEmail || prev.emailSender,
          landlineFormat: item.companyPhone || prev.landlineFormat
        }));
      }

      if (item.flightOutboundJson) {
        const out = typeof item.flightOutboundJson === 'string' ? JSON.parse(item.flightOutboundJson) : item.flightOutboundJson;
        if (out.pnr) setOutboundPnr(out.pnr);
        setOutboundRoute(out.route || 'LHR -> JED');
        setOutboundDateText(out.dateText || '');
        if (out.depDate) setOutboundDepDate(out.depDate);
        setOutboundTransitText(out.transitText || '');
        setOutboundArrivalNote(out.arrivalNote || '');
        setOutboundBaggage(out.baggage || '');

        if (Array.isArray(out.legs) && out.legs.length > 0) {
          setOutboundLegs(out.legs);
        } else {
          setOutboundLegs([
            {
              id: 'out-1',
              airline: item.airlineCarrier || 'Airline',
              flightNo: out.leg1No || 'RJ 112',
              craft: out.leg1Craft || '',
              departedFrom: 'LHR',
              arrivedAt: 'AMM',
              date: out.depDate || '',
              departTime: out.leg1Dep || '',
              arrivalTime: out.leg1Arr || '',
              baggage: '23 Kg'
            },
            ...(out.leg2No ? [{
              id: 'out-2',
              airline: item.airlineCarrier || 'Airline',
              flightNo: out.leg2No || 'RJ 704',
              craft: out.leg2Craft || '',
              departedFrom: 'AMM',
              arrivedAt: 'JED',
              date: out.depDate || '',
              departTime: out.leg2Dep || '',
              arrivalTime: out.leg2Arr || '',
              baggage: '23 Kg'
            }] : [])
          ]);
        }
      }

      if (item.flightInboundJson) {
        const inb = typeof item.flightInboundJson === 'string' ? JSON.parse(item.flightInboundJson) : item.flightInboundJson;
        if (inb.pnr) setInboundPnr(inb.pnr);
        setInboundRoute(inb.route || 'MED -> LHR');
        setInboundDateText(inb.dateText || '');
        if (inb.depDate) setInboundDepDate(inb.depDate);
        setInboundTransitText(inb.transitText || '');
        setInboundArrivalNote(inb.arrivalNote || '');
        setInboundBaggage(inb.baggage || '');

        if (Array.isArray(inb.legs) && inb.legs.length > 0) {
          setInboundLegs(inb.legs);
        } else {
          setInboundLegs([
            {
              id: 'in-1',
              airline: item.airlineCarrier || 'Airline',
              flightNo: inb.leg1No || 'RJ 723',
              craft: inb.leg1Craft || '',
              departedFrom: 'MED',
              arrivedAt: 'AMM',
              date: inb.depDate || '',
              departTime: inb.leg1Dep || '',
              arrivalTime: inb.leg1Arr || '',
              baggage: '23 Kg'
            },
            ...(inb.leg2No ? [{
              id: 'in-2',
              airline: item.airlineCarrier || 'Airline',
              flightNo: inb.leg2No || 'RJ 111',
              craft: inb.leg2Craft || '',
              departedFrom: 'AMM',
              arrivedAt: 'LHR',
              date: inb.depDate || '',
              departTime: inb.leg2Dep || '',
              arrivalTime: inb.leg2Arr || '',
              baggage: '23 Kg'
            }] : [])
          ]);
        }
      }

      if (item.hotelsJson) {
        const h = typeof item.hotelsJson === 'string' ? JSON.parse(item.hotelsJson) : item.hotelsJson;
        if (Array.isArray(h)) setHotels(h);
      }

      if (item.transfersJson) {
        const tr = typeof item.transfersJson === 'string' ? JSON.parse(item.transfersJson) : item.transfersJson;
        setTransferTitle(tr.title || 'Private AC Vehicle Circuit');
        if (Array.isArray(tr.sectors)) setTransferSectors(tr.sectors);
      }

      if (item.visaJson) {
        const v = typeof item.visaJson === 'string' ? JSON.parse(item.visaJson) : item.visaJson;
        setVisaTitle(v.title || '');
        setVisaValidity(v.validity || '');
        setVisaEligibility(v.eligibility || '');
        setVisaProcessing(v.processing || '');
      }

      if (item.sectionPricingJson) {
        const sp = typeof item.sectionPricingJson === 'string' ? JSON.parse(item.sectionPricingJson) : item.sectionPricingJson;
        if (sp.flightPrice !== undefined) setFlightPrice(String(sp.flightPrice));
        if (sp.flightPriceType) setFlightPriceType(sp.flightPriceType);
        if (sp.transfersPrice !== undefined) setTransfersPrice(String(sp.transfersPrice));
        if (sp.transfersPriceType) setTransfersPriceType(sp.transfersPriceType);
        if (sp.visaPrice !== undefined) setVisaPrice(String(sp.visaPrice));
        if (sp.visaPriceType) setVisaPriceType(sp.visaPriceType);
        if (sp.otherPrice !== undefined) setOtherPrice(String(sp.otherPrice));
        if (sp.otherPriceTitle) setOtherPriceTitle(sp.otherPriceTitle);
        if (sp.otherPriceType) setOtherPriceType(sp.otherPriceType);
        if (sp.pricingMode) setPricingMode(sp.pricingMode);
        if (sp.showPriceBreakdownOnDoc !== undefined) setShowPriceBreakdownOnDoc(!!sp.showPriceBreakdownOnDoc);
      }

      setPricePerPerson(item.pricePerPerson ? String(item.pricePerPerson) : '');
      setTotalPackagePrice(item.totalPackagePrice ? String(item.totalPackagePrice) : '');
      setPriceIncludes(item.priceIncludes || '');
      setImportantTerms(item.importantTerms || '');

      toast.success(`Loaded package quotation ${item.referenceNumber}`);
      setActiveTab('split');
    } catch (err) {
      console.error(err);
      toast.error('Failed to parse package quotation');
    }
  };

  const handleDeletePackage = async (id: number) => {
    if (!confirm('Are you sure you want to delete this package quotation?')) return;
    try {
      await api.delete(`/packages/${id}`);
      toast.success('Package deleted');
      fetchSavedPackages();
    } catch (err) {
      toast.error('Failed to delete package');
    }
  };

  // High-Resolution PDF Download
  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setGeneratingPdf(true);
    try {
      const element = printRef.current;
      const imgs = element.querySelectorAll('img');
      imgs.forEach((img) => {
        img.setAttribute('crossOrigin', 'anonymous');
      });

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, Math.min(imgHeight, pageHeight));
      pdf.save(`${refNumber.replace(/[^a-zA-Z0-9-]/g, '_')}_Quotation.pdf`);
      toast.success('PDF downloaded successfully!');
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('Direct PDF export error. Opening standard print window.');
      handlePrint();
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Flight Leg Management Handlers
  const addLeg = (isOutbound: boolean) => {
    const newLeg: FlightSegment = {
      id: `leg-${Date.now()}`,
      airline: airlineCarrier || 'Royal Jordanian',
      flightNo: 'RJ 100',
      craft: 'Boeing 787',
      departedFrom: 'LHR',
      arrivedAt: 'JED',
      date: startDate || new Date().toISOString().split('T')[0],
      departTime: '12:00',
      arrivalTime: '18:00',
      baggage: '23 Kg'
    };

    if (isOutbound) {
      setOutboundLegs([...outboundLegs, newLeg]);
    } else {
      setInboundLegs([...inboundLegs, newLeg]);
    }
  };

  const updateLeg = (isOutbound: boolean, index: number, field: keyof FlightSegment, value: string) => {
    const list = isOutbound ? [...outboundLegs] : [...inboundLegs];
    const item = { ...list[index], [field]: value };

    // Auto detect airline from flightNo
    if (field === 'flightNo') {
      const detected = getAirlineName(value);
      if (detected) item.airline = detected;
    }

    list[index] = item;
    if (isOutbound) {
      setOutboundLegs(list);
    } else {
      setInboundLegs(list);
    }
  };

  const removeLeg = (isOutbound: boolean, index: number) => {
    if (isOutbound) {
      if (outboundLegs.length > 1) setOutboundLegs(outboundLegs.filter((_, i) => i !== index));
    } else {
      if (inboundLegs.length > 1) setInboundLegs(inboundLegs.filter((_, i) => i !== index));
    }
  };

  // Hotel Handlers
  const addHotel = () => {
    const defaultCheckIn = startDate || '';
    const defaultCheckOut = endDate || '';
    const computedDuration = computeStayDuration(defaultCheckIn, defaultCheckOut) || '3 Nights';

    setHotels([
      ...hotels,
      {
        name: 'Hotel Name',
        location: 'Makkah Al-Mukarramah',
        ratingStars: 4,
        ratingLabel: '(4-Star)',
        checkInDate: defaultCheckIn,
        checkOutDate: defaultCheckOut,
        stayDuration: computedDuration,
        isManualStayDuration: false,
        roomType: 'Quad Room',
        boardBasis: 'Room Only',
        featureBadge: 'Great Location & Haram Shuttle',
        price: '0.00',
        priceType: 'per_person'
      }
    ]);
  };

  const updateHotel = (index: number, field: keyof HotelItem, value: any) => {
    const updated = [...hotels];
    const hotel = { ...updated[index], [field]: value };

    if ((field === 'checkInDate' || field === 'checkOutDate') && !hotel.isManualStayDuration) {
      const checkIn = field === 'checkInDate' ? value : hotel.checkInDate;
      const checkOut = field === 'checkOutDate' ? value : hotel.checkOutDate;
      const autoDuration = computeStayDuration(checkIn, checkOut);
      if (autoDuration) hotel.stayDuration = autoDuration;
    }

    updated[index] = hotel;
    setHotels(updated);
  };

  const removeHotel = (index: number) => {
    setHotels(hotels.filter((_, i) => i !== index));
  };

  const addSector = () => {
    setTransferSectors([...transferSectors, { label: `Sector ${transferSectors.length + 1}: Airport -> Hotel` }]);
  };

  const removeSector = (index: number) => {
    setTransferSectors(transferSectors.filter((_, i) => i !== index));
  };

  const renderStars = (count: number) => {
    return (
      <span className="inline-flex items-center gap-0.5 text-amber-500">
        {Array.from({ length: count || 4 }).map((_, i) => (
          <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
        ))}
      </span>
    );
  };

  // Render Editor Accordions Panel
  const renderEditorForm = () => (
    <div className="space-y-4">
      {/* SECTION 0: COMPANY / TENANT BRANDING */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <button
          onClick={() => toggleSection('company')}
          className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between transition-all"
        >
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary-600" />
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Company Branding & Contact Details
            </h3>
            <span className="text-[10px] font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full border border-primary-200">
              {companyInfo.companyName}
            </span>
          </div>
          {openSections.company ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </button>

        {openSections.company && (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 border-t border-slate-200 bg-slate-50/30">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Company Name</label>
              <input
                type="text"
                value={companyInfo.companyName}
                onChange={(e) => setCompanyInfo({ ...companyInfo, companyName: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-primary-500 outline-none bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Logo URL</label>
              <input
                type="text"
                value={companyInfo.logoPrimary}
                onChange={(e) => setCompanyInfo({ ...companyInfo, logoPrimary: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono focus:ring-2 focus:ring-primary-500 outline-none bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Brand Accent Color</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={companyInfo.brandColor}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, brandColor: e.target.value })}
                  className="w-9 h-8 rounded border border-slate-300 cursor-pointer p-0.5"
                />
                <select
                  value={companyInfo.brandColor}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, brandColor: e.target.value })}
                  className="flex-1 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold bg-white outline-none"
                >
                  {BRAND_THEMES.map(theme => (
                    <option key={theme.value} value={theme.value}>{theme.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Registered Address</label>
              <input
                type="text"
                value={companyInfo.officeAddress}
                onChange={(e) => setCompanyInfo({ ...companyInfo, officeAddress: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-primary-500 outline-none bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
              <input
                type="text"
                value={companyInfo.landlineFormat}
                onChange={(e) => setCompanyInfo({ ...companyInfo, landlineFormat: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-primary-500 outline-none bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
              <input
                type="text"
                value={companyInfo.emailSender}
                onChange={(e) => setCompanyInfo({ ...companyInfo, emailSender: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-primary-500 outline-none bg-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* SECTION 1: HEADER & META */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <button
          onClick={() => toggleSection('meta')}
          className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between transition-all"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary-600" />
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              1. Header & Quote Meta
            </h3>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
              Ref: {refNumber}
            </span>
          </div>
          {openSections.meta ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </button>

        {openSections.meta && (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 border-t border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Quote Reference</label>
              <input
                type="text"
                value={refNumber}
                onChange={(e) => setRefNumber(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Quote Date</label>
              <input
                type="date"
                value={quoteDate}
                onChange={(e) => setQuoteDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Prepared For</label>
              <input
                type="text"
                value={preparedFor}
                onChange={(e) => setPreparedFor(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Package Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Package Subtitle</label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Passenger Badge Pill</label>
              <input
                type="text"
                value={passengerBadge}
                onChange={(e) => setPassengerBadge(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: FLIGHT ITINERARY BUILDER (MATCHING BOOKING FLIGHT SECTION) */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between transition-all">
          <button onClick={() => toggleSection('flights')} className="flex items-center gap-2 text-left">
            <Plane className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              2. Flight Itinerary Builder
            </h3>
            <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
              {airlineCarrier}
            </span>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPnrModal(true)}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg shadow-sm flex items-center gap-1 transition-all"
            >
              <Zap className="w-3.5 h-3.5 fill-white text-white" /> Auto-Fill via GDS PNR
            </button>
            <button onClick={() => toggleSection('flights')}>
              {openSections.flights ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </button>
          </div>
        </div>

        {openSections.flights && (
          <div className="p-4 space-y-4 border-t border-slate-200">
            {/* Overview Flight Header */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Departure Airport</label>
                <input
                  type="text"
                  value={departureAirport}
                  onChange={(e) => setDepartureAirport(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Airline Carrier</label>
                <input
                  type="text"
                  value={airlineCarrier}
                  onChange={(e) => setAirlineCarrier(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Cabin / Flight Class</label>
                <input
                  type="text"
                  value={flightClass}
                  onChange={(e) => setFlightClass(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold bg-white"
                />
              </div>
            </div>

            {/* Flight Section Price Bar */}
            <div className="bg-sky-50/80 border border-sky-200 p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2">
                <Plane className="w-4 h-4 text-sky-600 shrink-0" />
                <div>
                  <span className="text-xs font-black text-sky-950 uppercase tracking-wider block">Flight Section Pricing</span>
                  <span className="text-[10px] font-semibold text-sky-700">Calculates automatically per person and total for {passengerCount} PAX</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">£</span>
                  <input
                    type="number"
                    step="0.01"
                    value={flightPrice}
                    onChange={(e) => setFlightPrice(e.target.value)}
                    className="pl-6 pr-2 py-1 w-28 bg-white border border-sky-300 rounded-lg text-xs font-black text-slate-900 focus:ring-2 focus:ring-sky-500 outline-none shadow-xs"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex rounded-lg border border-sky-300 bg-white p-0.5 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setFlightPriceType('per_person')}
                    className={`px-2 py-0.5 rounded transition-all ${flightPriceType === 'per_person' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Per Person
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlightPriceType('total')}
                    className={`px-2 py-0.5 rounded transition-all ${flightPriceType === 'total' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Total
                  </button>
                </div>
                <span className="text-[11px] font-extrabold text-sky-900 bg-sky-100/70 border border-sky-200 px-2 py-0.5 rounded-md shrink-0">
                  {flightPriceType === 'per_person' 
                    ? `Total: £${(parseFloat(flightPrice || '0') * passengerCount).toFixed(2)}` 
                    : `£${(parseFloat(flightPrice || '0') / (passengerCount || 1)).toFixed(2)} pp`}
                </span>
              </div>
            </div>

            {/* Outbound & Inbound Leg Builders (Matching Booking Details Flight Cards) */}
            <div className="grid grid-cols-1 gap-5">
              {/* OUTBOUND FLIGHT BUILDER */}
              <div className="border border-blue-200 bg-blue-50/30 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-blue-200">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-xs text-blue-900 bg-blue-100 px-2 py-0.5 rounded border border-blue-300 uppercase">
                      OUTBOUND PNR: {outboundPnr}
                    </span>
                    <span className="text-xs font-black text-blue-800">
                      Route: {outboundRoute}
                    </span>
                  </div>
                  <button
                    onClick={() => addLeg(true)}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Segment
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">PNR Reference</label>
                    <input
                      type="text"
                      value={outboundPnr}
                      onChange={(e) => setOutboundPnr(e.target.value)}
                      className="w-full border rounded-lg px-2.5 py-1 text-xs font-mono font-bold bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Departure Date</label>
                    <input
                      type="date"
                      value={outboundDepDate}
                      onChange={(e) => setOutboundDepDate(e.target.value)}
                      className="w-full border rounded-lg px-2.5 py-1 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Overall Route Label</label>
                    <input
                      type="text"
                      value={outboundRoute}
                      onChange={(e) => setOutboundRoute(e.target.value)}
                      className="w-full border rounded-lg px-2.5 py-1 text-xs font-bold bg-white"
                    />
                  </div>
                </div>

                {/* Segments List */}
                <div className="space-y-2">
                  {outboundLegs.map((leg, idx) => (
                    <div key={leg.id || idx} className="bg-white p-3 rounded-lg border border-slate-200 space-y-2 relative">
                      <div className="flex justify-between items-center text-[11px] font-black text-slate-800 pb-1.5 border-b border-slate-100">
                        <span className="flex items-center gap-1.5 text-blue-800">
                          <Plane className="w-3.5 h-3.5 text-blue-600" /> Outbound Segment #{idx + 1}
                        </span>
                        {outboundLegs.length > 1 && (
                          <button onClick={() => removeLeg(true, idx)} className="text-slate-400 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                          <label className="block text-[9.5px] font-extrabold text-slate-500 uppercase">Flight No</label>
                          <input
                            type="text"
                            placeholder="e.g. RJ 112"
                            value={leg.flightNo}
                            onChange={(e) => updateLeg(true, idx, 'flightNo', e.target.value)}
                            className="w-full border rounded px-2 py-1 text-xs font-bold font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-extrabold text-slate-500 uppercase">Airline</label>
                          <input
                            type="text"
                            placeholder="e.g. Royal Jordanian"
                            value={leg.airline}
                            onChange={(e) => updateLeg(true, idx, 'airline', e.target.value)}
                            className="w-full border rounded px-2 py-1 text-xs font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-extrabold text-slate-500 uppercase">Origin (Airport)</label>
                          <input
                            type="text"
                            placeholder="e.g. LHR"
                            value={leg.departedFrom}
                            onChange={(e) => updateLeg(true, idx, 'departedFrom', e.target.value)}
                            className="w-full border rounded px-2 py-1 text-xs font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-extrabold text-slate-500 uppercase">Destination (Airport)</label>
                          <input
                            type="text"
                            placeholder="e.g. AMM"
                            value={leg.arrivedAt}
                            onChange={(e) => updateLeg(true, idx, 'arrivedAt', e.target.value)}
                            className="w-full border rounded px-2 py-1 text-xs font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-extrabold text-slate-500 uppercase">Dep Time</label>
                          <input
                            type="text"
                            placeholder="16:05 LHR"
                            value={leg.departTime}
                            onChange={(e) => updateLeg(true, idx, 'departTime', e.target.value)}
                            className="w-full border rounded px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-extrabold text-slate-500 uppercase">Arr Time</label>
                          <input
                            type="text"
                            placeholder="00:05 AMM"
                            value={leg.arrivalTime}
                            onChange={(e) => updateLeg(true, idx, 'arrivalTime', e.target.value)}
                            className="w-full border rounded px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-extrabold text-slate-500 uppercase">Aircraft / Craft</label>
                          <input
                            type="text"
                            placeholder="Boeing 787-9"
                            value={leg.craft || ''}
                            onChange={(e) => updateLeg(true, idx, 'craft', e.target.value)}
                            className="w-full border rounded px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-extrabold text-slate-500 uppercase">Baggage</label>
                          <input
                            type="text"
                            placeholder="23 Kg"
                            value={leg.baggage || ''}
                            onChange={(e) => updateLeg(true, idx, 'baggage', e.target.value)}
                            className="w-full border rounded px-2 py-1 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Transit & Layover Text</label>
                    <input
                      type="text"
                      placeholder="e.g. Transit in Amman (AMM): 1 hr 30 mins"
                      value={outboundTransitText}
                      onChange={(e) => setOutboundTransitText(e.target.value)}
                      className="w-full border rounded-lg px-2.5 py-1 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Arrival Note</label>
                    <input
                      type="text"
                      placeholder="e.g. Arrival: Tue, 10 Nov (03:45)"
                      value={outboundArrivalNote}
                      onChange={(e) => setOutboundArrivalNote(e.target.value)}
                      className="w-full border rounded-lg px-2.5 py-1 text-xs bg-white"
                    />
                  </div>
                </div>

                {/* Baggage Selectors */}
                <div className="grid grid-cols-2 gap-2 bg-white p-2 rounded-lg border border-slate-200">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Checked Baggage</label>
                    <select
                      value={outboundCheckedBag}
                      onChange={(e) => setOutboundCheckedBag(e.target.value)}
                      className="w-full border border-slate-300 rounded-md px-2 py-1 text-xs outline-none"
                    >
                      {CHECKED_BAGGAGE_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Cabin Baggage</label>
                    <select
                      value={outboundCabinBag}
                      onChange={(e) => setOutboundCabinBag(e.target.value)}
                      className="w-full border border-slate-300 rounded-md px-2 py-1 text-xs outline-none"
                    >
                      {CABIN_BAGGAGE_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* INBOUND FLIGHT BUILDER */}
              <div className="border border-indigo-200 bg-indigo-50/30 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-indigo-200">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-xs text-indigo-900 bg-indigo-100 px-2 py-0.5 rounded border border-indigo-300 uppercase">
                      INBOUND PNR: {inboundPnr}
                    </span>
                    <span className="text-xs font-black text-indigo-800">
                      Route: {inboundRoute}
                    </span>
                  </div>
                  <button
                    onClick={() => addLeg(false)}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Segment
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">PNR Reference</label>
                    <input
                      type="text"
                      value={inboundPnr}
                      onChange={(e) => setInboundPnr(e.target.value)}
                      className="w-full border rounded-lg px-2.5 py-1 text-xs font-mono font-bold bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Departure Date</label>
                    <input
                      type="date"
                      value={inboundDepDate}
                      onChange={(e) => setInboundDepDate(e.target.value)}
                      className="w-full border rounded-lg px-2.5 py-1 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Overall Route Label</label>
                    <input
                      type="text"
                      value={inboundRoute}
                      onChange={(e) => setInboundRoute(e.target.value)}
                      className="w-full border rounded-lg px-2.5 py-1 text-xs font-bold bg-white"
                    />
                  </div>
                </div>

                {/* Segments List */}
                <div className="space-y-2">
                  {inboundLegs.map((leg, idx) => (
                    <div key={leg.id || idx} className="bg-white p-3 rounded-lg border border-slate-200 space-y-2 relative">
                      <div className="flex justify-between items-center text-[11px] font-black text-slate-800 pb-1.5 border-b border-slate-100">
                        <span className="flex items-center gap-1.5 text-indigo-800">
                          <Plane className="w-3.5 h-3.5 text-indigo-600 rotate-180" /> Inbound Segment #{idx + 1}
                        </span>
                        {inboundLegs.length > 1 && (
                          <button onClick={() => removeLeg(false, idx)} className="text-slate-400 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                          <label className="block text-[9.5px] font-extrabold text-slate-500 uppercase">Flight No</label>
                          <input
                            type="text"
                            placeholder="e.g. RJ 723"
                            value={leg.flightNo}
                            onChange={(e) => updateLeg(false, idx, 'flightNo', e.target.value)}
                            className="w-full border rounded px-2 py-1 text-xs font-bold font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-extrabold text-slate-500 uppercase">Airline</label>
                          <input
                            type="text"
                            placeholder="e.g. Royal Jordanian"
                            value={leg.airline}
                            onChange={(e) => updateLeg(false, idx, 'airline', e.target.value)}
                            className="w-full border rounded px-2 py-1 text-xs font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-extrabold text-slate-500 uppercase">Origin (Airport)</label>
                          <input
                            type="text"
                            placeholder="e.g. MED"
                            value={leg.departedFrom}
                            onChange={(e) => updateLeg(false, idx, 'departedFrom', e.target.value)}
                            className="w-full border rounded px-2 py-1 text-xs font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-extrabold text-slate-500 uppercase">Destination (Airport)</label>
                          <input
                            type="text"
                            placeholder="e.g. AMM"
                            value={leg.arrivedAt}
                            onChange={(e) => updateLeg(false, idx, 'arrivedAt', e.target.value)}
                            className="w-full border rounded px-2 py-1 text-xs font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-extrabold text-slate-500 uppercase">Dep Time</label>
                          <input
                            type="text"
                            placeholder="07:00 MED"
                            value={leg.departTime}
                            onChange={(e) => updateLeg(false, idx, 'departTime', e.target.value)}
                            className="w-full border rounded px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-extrabold text-slate-500 uppercase">Arr Time</label>
                          <input
                            type="text"
                            placeholder="08:55 AMM"
                            value={leg.arrivalTime}
                            onChange={(e) => updateLeg(false, idx, 'arrivalTime', e.target.value)}
                            className="w-full border rounded px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-extrabold text-slate-500 uppercase">Aircraft / Craft</label>
                          <input
                            type="text"
                            placeholder="Boeing 787-8"
                            value={leg.craft || ''}
                            onChange={(e) => updateLeg(false, idx, 'craft', e.target.value)}
                            className="w-full border rounded px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-extrabold text-slate-500 uppercase">Baggage</label>
                          <input
                            type="text"
                            placeholder="23 Kg"
                            value={leg.baggage || ''}
                            onChange={(e) => updateLeg(false, idx, 'baggage', e.target.value)}
                            className="w-full border rounded px-2 py-1 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Transit & Layover Text</label>
                    <input
                      type="text"
                      placeholder="e.g. Transit in Amman (AMM): 3 hrs 00 mins"
                      value={inboundTransitText}
                      onChange={(e) => setInboundTransitText(e.target.value)}
                      className="w-full border rounded-lg px-2.5 py-1 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Arrival Note</label>
                    <input
                      type="text"
                      placeholder="e.g. Arrival: Thu, 19 Nov (14:20)"
                      value={inboundArrivalNote}
                      onChange={(e) => setInboundArrivalNote(e.target.value)}
                      className="w-full border rounded-lg px-2.5 py-1 text-xs bg-white"
                    />
                  </div>
                </div>

                {/* Baggage Selectors */}
                <div className="grid grid-cols-2 gap-2 bg-white p-2 rounded-lg border border-slate-200">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Checked Baggage</label>
                    <select
                      value={inboundCheckedBag}
                      onChange={(e) => setInboundCheckedBag(e.target.value)}
                      className="w-full border border-slate-300 rounded-md px-2 py-1 text-xs outline-none"
                    >
                      {CHECKED_BAGGAGE_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Cabin Baggage</label>
                    <select
                      value={inboundCabinBag}
                      onChange={(e) => setInboundCabinBag(e.target.value)}
                      className="w-full border border-slate-300 rounded-md px-2 py-1 text-xs outline-none"
                    >
                      {CABIN_BAGGAGE_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3: HOTEL ACCOMMODATIONS */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between transition-all">
          <button onClick={() => toggleSection('hotels')} className="flex items-center gap-2 text-left">
            <Building2 className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              3. Hotel Accommodations
            </h3>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
              {hotels.length} Hotel{hotels.length > 1 ? 's' : ''}
            </span>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={addHotel}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg shadow-sm flex items-center gap-1 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Add Hotel
            </button>
            <button onClick={() => toggleSection('hotels')}>
              {openSections.hotels ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </button>
          </div>
        </div>

        {openSections.hotels && (
          <div className="p-4 space-y-4 border-t border-slate-200">
            {hotels.map((hotel, index) => (
              <div key={index} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3 relative">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-xs font-black text-emerald-900 uppercase">
                    Hotel #{index + 1}: {hotel.name || 'New Hotel'}
                  </span>
                  {hotels.length > 1 && (
                    <button
                      onClick={() => removeHotel(index)}
                      className="text-slate-400 hover:text-red-600 p-1 rounded-md hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Hotel Name</label>
                    <input
                      type="text"
                      value={hotel.name}
                      onChange={(e) => updateHotel(index, 'name', e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">City / Location</label>
                    <select
                      value={hotel.location}
                      onChange={(e) => updateHotel(index, 'location', e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold bg-white outline-none"
                    >
                      {CITY_OPTIONS.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Star Rating & Label</label>
                    <div className="flex gap-2">
                      <select
                        value={hotel.ratingStars}
                        onChange={(e) => updateHotel(index, 'ratingStars', parseInt(e.target.value))}
                        className="w-20 border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold bg-white outline-none"
                      >
                        <option value={5}>5 Star</option>
                        <option value={4}>4 Star</option>
                        <option value={3}>3 Star</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Label e.g. (Luxury)"
                        value={hotel.ratingLabel}
                        onChange={(e) => updateHotel(index, 'ratingLabel', e.target.value)}
                        className="flex-1 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold bg-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Check-in Date</label>
                    <input
                      type="date"
                      value={hotel.checkInDate}
                      onChange={(e) => updateHotel(index, 'checkInDate', e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1 text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Check-out Date</label>
                    <input
                      type="date"
                      value={hotel.checkOutDate}
                      onChange={(e) => updateHotel(index, 'checkOutDate', e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1 text-xs bg-white"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[11px] font-bold text-slate-700">Stay Duration Label</label>
                      <button
                        onClick={() => updateHotel(index, 'isManualStayDuration', !hotel.isManualStayDuration)}
                        className="text-[10px] font-bold text-emerald-700 hover:underline flex items-center gap-0.5"
                      >
                        <Pencil className="w-3 h-3" /> {hotel.isManualStayDuration ? 'Auto-Calc' : 'Manual Override'}
                      </button>
                    </div>
                    <input
                      type="text"
                      readOnly={!hotel.isManualStayDuration}
                      value={hotel.stayDuration}
                      onChange={(e) => updateHotel(index, 'stayDuration', e.target.value)}
                      className={`w-full border rounded-lg px-2.5 py-1 text-xs font-semibold ${
                        hotel.isManualStayDuration ? 'bg-white border-amber-300 focus:ring-2 focus:ring-amber-400' : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Room Type</label>
                    <select
                      value={hotel.roomType}
                      onChange={(e) => updateHotel(index, 'roomType', e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold bg-white outline-none"
                    >
                      {ROOM_TYPE_OPTIONS.map(rt => (
                        <option key={rt} value={rt}>{rt}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Board Basis</label>
                    <select
                      value={hotel.boardBasis}
                      onChange={(e) => updateHotel(index, 'boardBasis', e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold bg-white outline-none"
                    >
                      {BOARD_BASIS_OPTIONS.map(bb => (
                        <option key={bb} value={bb}>{bb}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Feature / Amenity Badge</label>
                    <input
                      type="text"
                      placeholder="e.g. 24/7 Haram Shuttle Service"
                      value={hotel.featureBadge}
                      onChange={(e) => updateHotel(index, 'featureBadge', e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1 text-xs bg-white"
                    />
                  </div>
                </div>

                {/* Hotel Pricing Box */}
                <div className="bg-emerald-50/70 border border-emerald-200 p-2.5 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span className="text-[11px] font-bold text-emerald-950">Hotel #{index + 1} Cost:</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">£</span>
                      <input
                        type="number"
                        step="0.01"
                        value={hotel.price || ''}
                        onChange={(e) => updateHotel(index, 'price', e.target.value)}
                        className="pl-5 pr-2 py-0.5 w-24 bg-white border border-emerald-300 rounded-lg text-xs font-black text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none shadow-xs"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="flex rounded-lg border border-emerald-300 bg-white p-0.5 text-[9px] font-bold">
                      <button
                        type="button"
                        onClick={() => updateHotel(index, 'priceType', 'per_person')}
                        className={`px-2 py-0.5 rounded transition-all ${(hotel.priceType || 'per_person') === 'per_person' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                      >
                        Per Person
                      </button>
                      <button
                        type="button"
                        onClick={() => updateHotel(index, 'priceType', 'total')}
                        className={`px-2 py-0.5 rounded transition-all ${hotel.priceType === 'total' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                      >
                        Total
                      </button>
                    </div>
                    <span className="text-[10px] font-extrabold text-emerald-900 bg-emerald-100/70 border border-emerald-200 px-2 py-0.5 rounded-md shrink-0">
                      {(hotel.priceType || 'per_person') === 'per_person'
                        ? `Total: £${(parseFloat(hotel.price || '0') * passengerCount).toFixed(2)}`
                        : `£${(parseFloat(hotel.price || '0') / (passengerCount || 1)).toFixed(2)} pp`}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 4: GROUND TRANSFERS */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between transition-all">
          <button onClick={() => toggleSection('transfers')} className="flex items-center gap-2 text-left">
            <Car className="w-4 h-4 text-purple-600" />
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              4. Ground Transfers
            </h3>
            <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
              {transferSectors.length} Sectors
            </span>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={addSector}
              className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold rounded-lg shadow-sm flex items-center gap-1 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Add Sector
            </button>
            <button onClick={() => toggleSection('transfers')}>
              {openSections.transfers ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </button>
          </div>
        </div>

        {openSections.transfers && (
          <div className="p-4 space-y-3 border-t border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Transfer Title</label>
              <input
                type="text"
                value={transferTitle}
                onChange={(e) => setTransferTitle(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">Sectors & Itinerary Routes</label>
              {transferSectors.map((sec, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={sec.label}
                    onChange={(e) => {
                      const updated = [...transferSectors];
                      updated[i].label = e.target.value;
                      setTransferSectors(updated);
                    }}
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-1 text-xs"
                  />
                  {transferSectors.length > 1 && (
                    <button
                      onClick={() => removeSector(i)}
                      className="p-1 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Transfers Price Box */}
            <div className="bg-purple-50/80 border border-purple-200 p-2.5 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                <span className="text-[11px] font-bold text-purple-950">Ground Transfers Section Pricing:</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">£</span>
                  <input
                    type="number"
                    step="0.01"
                    value={transfersPrice}
                    onChange={(e) => setTransfersPrice(e.target.value)}
                    className="pl-5 pr-2 py-0.5 w-24 bg-white border border-purple-300 rounded-lg text-xs font-black text-slate-900 focus:ring-2 focus:ring-purple-500 outline-none shadow-xs"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex rounded-lg border border-purple-300 bg-white p-0.5 text-[9px] font-bold">
                  <button
                    type="button"
                    onClick={() => setTransfersPriceType('per_person')}
                    className={`px-2 py-0.5 rounded transition-all ${transfersPriceType === 'per_person' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Per Person
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransfersPriceType('total')}
                    className={`px-2 py-0.5 rounded transition-all ${transfersPriceType === 'total' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Total
                  </button>
                </div>
                <span className="text-[10px] font-extrabold text-purple-900 bg-purple-100/70 border border-purple-200 px-2 py-0.5 rounded-md shrink-0">
                  {transfersPriceType === 'per_person'
                    ? `Total: £${(parseFloat(transfersPrice || '0') * passengerCount).toFixed(2)}`
                    : `£${(parseFloat(transfersPrice || '0') / (passengerCount || 1)).toFixed(2)} pp`}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 5: VISA SERVICES */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between transition-all">
          <button onClick={() => toggleSection('visa')} className="flex items-center gap-2 text-left">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              5. Visa Support & Services
            </h3>
            <span className="text-[10px] font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full">
              {visaValidity}
            </span>
          </button>
          <button onClick={() => toggleSection('visa')}>
            {openSections.visa ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
          </button>
        </div>

        {openSections.visa && (
          <div className="p-4 space-y-3 border-t border-slate-200">
            {/* Visa Template Quick Selector */}
            <div className="bg-teal-50/50 p-3 rounded-xl border border-teal-200">
              <label className="block text-xs font-black text-teal-900 mb-1.5 uppercase flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-teal-600" /> Select Visa Template
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {VISA_TEMPLATES.map(tmpl => (
                  <button
                    key={tmpl.id}
                    onClick={() => handleSelectVisaTemplate(tmpl.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold text-left transition-all border ${
                      selectedVisaTemplate === tmpl.id
                        ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                        : 'bg-white text-teal-800 border-teal-200 hover:bg-teal-100'
                    }`}
                  >
                    {tmpl.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Visa Title</label>
                <input
                  type="text"
                  value={visaTitle}
                  onChange={(e) => setVisaTitle(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Validity</label>
                <input
                  type="text"
                  value={visaValidity}
                  onChange={(e) => setVisaValidity(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Eligibility</label>
                <input
                  type="text"
                  value={visaEligibility}
                  onChange={(e) => setVisaEligibility(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Processing & Support</label>
                <input
                  type="text"
                  value={visaProcessing}
                  onChange={(e) => setVisaProcessing(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold"
                />
              </div>
            </div>

            {/* Visa Price Box */}
            <div className="bg-teal-50/80 border border-teal-200 p-2.5 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                <span className="text-[11px] font-bold text-teal-950">Visa Processing Section Pricing:</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">£</span>
                  <input
                    type="number"
                    step="0.01"
                    value={visaPrice}
                    onChange={(e) => setVisaPrice(e.target.value)}
                    className="pl-5 pr-2 py-0.5 w-24 bg-white border border-teal-300 rounded-lg text-xs font-black text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none shadow-xs"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex rounded-lg border border-teal-300 bg-white p-0.5 text-[9px] font-bold">
                  <button
                    type="button"
                    onClick={() => setVisaPriceType('per_person')}
                    className={`px-2 py-0.5 rounded transition-all ${visaPriceType === 'per_person' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Per Person
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisaPriceType('total')}
                    className={`px-2 py-0.5 rounded transition-all ${visaPriceType === 'total' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Total
                  </button>
                </div>
                <span className="text-[10px] font-extrabold text-teal-900 bg-teal-100/70 border border-teal-200 px-2 py-0.5 rounded-md shrink-0">
                  {visaPriceType === 'per_person'
                    ? `Total: £${(parseFloat(visaPrice || '0') * passengerCount).toFixed(2)}`
                    : `£${(parseFloat(visaPrice || '0') / (passengerCount || 1)).toFixed(2)} pp`}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 6: PRICING & TERMS */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between transition-all">
          <button onClick={() => toggleSection('pricing')} className="flex items-center gap-2 text-left">
            <Calculator className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              6. Pricing Breakdown & Calculations
            </h3>
            <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
              £{parseFloat(pricePerPerson || '0').toFixed(2)} pp • Total: £{parseFloat(totalPackagePrice || '0').toFixed(2)}
            </span>
          </button>
          <button onClick={() => toggleSection('pricing')}>
            {openSections.pricing ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
          </button>
        </div>

        {openSections.pricing && (
          <div className="p-4 space-y-5 border-t border-slate-200">
            {/* Mode Switcher */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
              <button
                type="button"
                onClick={() => setPricingMode('breakdown')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  pricingMode === 'breakdown'
                    ? 'bg-white text-amber-900 shadow-sm border border-amber-200 font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calculator className="w-3.5 h-3.5 text-amber-600" />
                Auto-Calculate from Section Costs
              </button>
              <button
                type="button"
                onClick={() => setPricingMode('manual')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  pricingMode === 'manual'
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-300 font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Tag className="w-3.5 h-3.5 text-slate-500" />
                Direct / Manual Package Price
              </button>
            </div>

            {/* Itemized Breakdown Table & Section Pricing */}
            {pricingMode === 'breakdown' ? (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="bg-amber-50/60 px-4 py-2.5 border-b border-amber-200 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-black text-amber-950 uppercase tracking-wider">
                      Itemized Section Pricing & Auto-Sum
                    </span>
                  </div>
                  <span className="text-[11px] font-extrabold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                    {passengerCount} Passenger{passengerCount > 1 ? 's' : ''} (PAX)
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-extrabold text-slate-600 uppercase">
                        <th className="py-2.5 px-3">Service Section</th>
                        <th className="py-2.5 px-3">Amount (£)</th>
                        <th className="py-2.5 px-3">Cost Basis</th>
                        <th className="py-2.5 px-3 text-right">Cost Per Person</th>
                        <th className="py-2.5 px-3 text-right">Section Total ({passengerCount} PAX)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                      {/* Flights */}
                      <tr className="hover:bg-slate-50/50">
                        <td className="py-2 px-3">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <Plane className="w-3.5 h-3.5 text-sky-600" /> Flights
                          </div>
                          <div className="text-[10px] text-slate-500">{airlineCarrier} • {outboundRoute}</div>
                        </td>
                        <td className="py-2 px-3">
                          <div className="relative w-28">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 font-bold text-slate-400">£</span>
                            <input
                              type="number"
                              step="0.01"
                              value={flightPrice}
                              onChange={(e) => setFlightPrice(e.target.value)}
                              className="pl-5 pr-2 py-1 w-full border border-slate-300 rounded-lg text-xs font-black text-slate-900 focus:ring-2 focus:ring-sky-500 outline-none"
                            />
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex rounded-md border border-slate-300 bg-white p-0.5 text-[9px] font-bold w-fit">
                            <button
                              type="button"
                              onClick={() => setFlightPriceType('per_person')}
                              className={`px-2 py-0.5 rounded ${flightPriceType === 'per_person' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                              Per Person
                            </button>
                            <button
                              type="button"
                              onClick={() => setFlightPriceType('total')}
                              className={`px-2 py-0.5 rounded ${flightPriceType === 'total' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                              Total
                            </button>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-slate-700">
                          £{getSectionPP(flightPrice, flightPriceType, passengerCount).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-black text-slate-900">
                          £{getSectionTotal(flightPrice, flightPriceType, passengerCount).toFixed(2)}
                        </td>
                      </tr>

                      {/* Hotels */}
                      {hotels.map((hotel, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-emerald-600" /> Hotel {idx + 1}: {hotel.name}
                            </div>
                            <div className="text-[10px] text-slate-500">{hotel.stayDuration || hotel.location}</div>
                          </td>
                          <td className="py-2 px-3">
                            <div className="relative w-28">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 font-bold text-slate-400">£</span>
                              <input
                                type="number"
                                step="0.01"
                                value={hotel.price || ''}
                                onChange={(e) => updateHotel(idx, 'price', e.target.value)}
                                className="pl-5 pr-2 py-1 w-full border border-slate-300 rounded-lg text-xs font-black text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                              />
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex rounded-md border border-slate-300 bg-white p-0.5 text-[9px] font-bold w-fit">
                              <button
                                type="button"
                                onClick={() => updateHotel(idx, 'priceType', 'per_person')}
                                className={`px-2 py-0.5 rounded ${(hotel.priceType || 'per_person') === 'per_person' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                              >
                                Per Person
                              </button>
                              <button
                                type="button"
                                onClick={() => updateHotel(idx, 'priceType', 'total')}
                                className={`px-2 py-0.5 rounded ${hotel.priceType === 'total' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                              >
                                Total
                              </button>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right font-semibold text-slate-700">
                            £{getSectionPP(hotel.price || '0', hotel.priceType || 'per_person', passengerCount).toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right font-black text-slate-900">
                            £{getSectionTotal(hotel.price || '0', hotel.priceType || 'per_person', passengerCount).toFixed(2)}
                          </td>
                        </tr>
                      ))}

                      {/* Ground Transfers */}
                      <tr className="hover:bg-slate-50/50">
                        <td className="py-2 px-3">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <Car className="w-3.5 h-3.5 text-purple-600" /> Transfers
                          </div>
                          <div className="text-[10px] text-slate-500">{transferTitle} ({transferSectors.length} Sectors)</div>
                        </td>
                        <td className="py-2 px-3">
                          <div className="relative w-28">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 font-bold text-slate-400">£</span>
                            <input
                              type="number"
                              step="0.01"
                              value={transfersPrice}
                              onChange={(e) => setTransfersPrice(e.target.value)}
                              className="pl-5 pr-2 py-1 w-full border border-slate-300 rounded-lg text-xs font-black text-slate-900 focus:ring-2 focus:ring-purple-500 outline-none"
                            />
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex rounded-md border border-slate-300 bg-white p-0.5 text-[9px] font-bold w-fit">
                            <button
                              type="button"
                              onClick={() => setTransfersPriceType('per_person')}
                              className={`px-2 py-0.5 rounded ${transfersPriceType === 'per_person' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                              Per Person
                            </button>
                            <button
                              type="button"
                              onClick={() => setTransfersPriceType('total')}
                              className={`px-2 py-0.5 rounded ${transfersPriceType === 'total' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                              Total
                            </button>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-slate-700">
                          £{getSectionPP(transfersPrice, transfersPriceType, passengerCount).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-black text-slate-900">
                          £{getSectionTotal(transfersPrice, transfersPriceType, passengerCount).toFixed(2)}
                        </td>
                      </tr>

                      {/* Visa Support */}
                      <tr className="hover:bg-slate-50/50">
                        <td className="py-2 px-3">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" /> Visa Services
                          </div>
                          <div className="text-[10px] text-slate-500">{visaTitle}</div>
                        </td>
                        <td className="py-2 px-3">
                          <div className="relative w-28">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 font-bold text-slate-400">£</span>
                            <input
                              type="number"
                              step="0.01"
                              value={visaPrice}
                              onChange={(e) => setVisaPrice(e.target.value)}
                              className="pl-5 pr-2 py-1 w-full border border-slate-300 rounded-lg text-xs font-black text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none"
                            />
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex rounded-md border border-slate-300 bg-white p-0.5 text-[9px] font-bold w-fit">
                            <button
                              type="button"
                              onClick={() => setVisaPriceType('per_person')}
                              className={`px-2 py-0.5 rounded ${visaPriceType === 'per_person' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                              Per Person
                            </button>
                            <button
                              type="button"
                              onClick={() => setVisaPriceType('total')}
                              className={`px-2 py-0.5 rounded ${visaPriceType === 'total' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                              Total
                            </button>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-slate-700">
                          £{getSectionPP(visaPrice, visaPriceType, passengerCount).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-black text-slate-900">
                          £{getSectionTotal(visaPrice, visaPriceType, passengerCount).toFixed(2)}
                        </td>
                      </tr>

                      {/* Additional / Other Services */}
                      <tr className="hover:bg-slate-50/50">
                        <td className="py-2 px-3">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <Plus className="w-3.5 h-3.5 text-amber-600" />
                            <input
                              type="text"
                              value={otherPriceTitle}
                              onChange={(e) => setOtherPriceTitle(e.target.value)}
                              className="border border-slate-300 rounded px-1.5 py-0.5 text-[11px] font-bold text-slate-800 bg-white"
                              placeholder="Extra Service Name"
                            />
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <div className="relative w-28">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 font-bold text-slate-400">£</span>
                            <input
                              type="number"
                              step="0.01"
                              value={otherPrice}
                              onChange={(e) => setOtherPrice(e.target.value)}
                              className="pl-5 pr-2 py-1 w-full border border-slate-300 rounded-lg text-xs font-black text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                            />
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex rounded-md border border-slate-300 bg-white p-0.5 text-[9px] font-bold w-fit">
                            <button
                              type="button"
                              onClick={() => setOtherPriceType('per_person')}
                              className={`px-2 py-0.5 rounded ${otherPriceType === 'per_person' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                              Per Person
                            </button>
                            <button
                              type="button"
                              onClick={() => setOtherPriceType('total')}
                              className={`px-2 py-0.5 rounded ${otherPriceType === 'total' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                              Total
                            </button>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-slate-700">
                          £{getSectionPP(otherPrice, otherPriceType, passengerCount).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-black text-slate-900">
                          £{getSectionTotal(otherPrice, otherPriceType, passengerCount).toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Calculation Summary Bar */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-t border-amber-200 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div>
                      <label className="block text-[10px] font-extrabold text-amber-900 uppercase">Passenger Count</label>
                      <input
                        type="number"
                        min="1"
                        value={passengerCount}
                        onChange={(e) => setPassengerCount(parseInt(e.target.value) || 1)}
                        className="w-20 border border-amber-300 rounded-lg px-2.5 py-1 text-xs font-black bg-white text-amber-950 focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    </div>
                    <div className="text-[11px] text-amber-800 font-semibold mt-3">
                      All section costs auto-scaled for {passengerCount} PAX
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <span className="block text-[10px] font-black text-amber-900 uppercase">Price Per Person</span>
                      <span className="text-base font-black text-slate-900">£{parseFloat(pricePerPerson || '0').toFixed(2)}</span>
                    </div>
                    <div className="pl-4 border-l border-amber-300">
                      <span className="block text-[10px] font-black text-amber-900 uppercase">Grand Total Cost</span>
                      <span className="text-xl font-black text-amber-800">£{parseFloat(totalPackagePrice || '0').toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Direct / Manual Pricing Inputs */
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Price Per Person (£)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={pricePerPerson}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPricePerPerson(val);
                      if (!isManualTotalPrice) {
                        setTotalPackagePrice(((parseFloat(val) || 0) * passengerCount).toFixed(2));
                      }
                    }}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Passenger Count (PAX)</label>
                  <input
                    type="number"
                    min="1"
                    value={passengerCount}
                    onChange={(e) => setPassengerCount(parseInt(e.target.value) || 1)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 bg-white"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-700">Total Package Price (£)</label>
                    <button
                      type="button"
                      onClick={() => setIsManualTotalPrice(!isManualTotalPrice)}
                      className="text-[10px] font-bold text-amber-700 hover:underline flex items-center gap-0.5"
                    >
                      {isManualTotalPrice ? <Unlock className="w-3 h-3 text-amber-600" /> : <Lock className="w-3 h-3 text-slate-500" />}
                      {isManualTotalPrice ? 'Manual Override' : 'Auto-Sync'}
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    readOnly={!isManualTotalPrice}
                    value={totalPackagePrice}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTotalPackagePrice(val);
                      if (passengerCount > 0) {
                        setPricePerPerson(((parseFloat(val) || 0) / passengerCount).toFixed(2));
                      }
                    }}
                    className={`w-full border rounded-lg px-3 py-1.5 text-xs font-black ${
                      isManualTotalPrice ? 'bg-white border-amber-400 text-amber-900' : 'bg-slate-100 text-slate-800 border-slate-300'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Checkbox: Show Itemized Price Table on Document */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-start gap-3">
              <input
                id="show-itemized-checkbox"
                type="checkbox"
                checked={showPriceBreakdownOnDoc}
                onChange={(e) => setShowPriceBreakdownOnDoc(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <label htmlFor="show-itemized-checkbox" className="cursor-pointer select-none">
                <span className="text-xs font-extrabold text-slate-900 block">
                  Display Itemized Price Breakdown Table on Quotation Document
                </span>
                <span className="text-[11px] text-slate-500 block leading-tight">
                  When enabled, an itemized table listing individual section rates (Flights, Hotels, Transfers, Visas) is shown on the customer PDF and printout.
                </span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Price Inclusions Summary</label>
              <input
                type="text"
                value={priceIncludes}
                onChange={(e) => setPriceIncludes(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Important Terms & Conditions</label>
              <textarea
                rows={3}
                value={importantTerms}
                onChange={(e) => setImportantTerms(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Render Document PDF Live Preview Component
  const renderQuotationPreview = () => (
    <div className="w-full flex justify-center print:block print:w-full">
      <style>{`
        @media print {
          nav, aside, header, footer, .print\\:hidden, button, form {
            display: none !important;
          }
          html, body, #root, main {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            height: auto !important;
            width: 100% !important;
            max-width: none !important;
            position: static !important;
          }
          #printable-quotation-document {
            display: block !important;
            visibility: visible !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 8mm !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            box-sizing: border-box !important;
          }
          @page {
            size: A4 portrait;
            margin: 0;
          }
        }
      `}</style>
      <div 
        ref={printRef}
        id="printable-quotation-document"
        className="w-full bg-white shadow-xl border border-slate-200 text-slate-800 p-6 sm:p-10 rounded-2xl relative print:shadow-none print:border-none print:p-0"
        style={{ minHeight: '297mm' }}
      >
        {/* Document Header */}
        <div className="flex justify-between items-start pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-3">
              {companyInfo.logoPrimary ? (
                <img src={companyInfo.logoPrimary} alt="Company Logo" className="h-12 max-w-[180px] object-contain rounded-md" />
              ) : (
                <div 
                  className="w-10 h-10 rounded-lg text-white flex items-center justify-center font-black text-xl shadow-sm"
                  style={{ backgroundColor: companyInfo.brandColor || '#0f172a' }}
                >
                  {companyInfo.companyName.charAt(0)}
                </div>
              )}
              <div>
                <span className="text-xl font-black tracking-tight text-slate-900 block">
                  {companyInfo.companyName || 'TOOBA TRAVELS LTD'}
                </span>
                <p className="text-[11px] font-semibold text-slate-500 leading-tight">
                  {companyInfo.officeAddress || '63 Buxton Road, London, E17 7EH'}
                </p>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                  Tel: {companyInfo.landlineFormat} • Email: {companyInfo.emailSender}
                </p>
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="inline-block bg-slate-100 text-slate-800 text-[11px] font-extrabold px-3 py-1 rounded-full border border-slate-200 mb-1">
              {refNumber}
            </span>
            <p className="text-[10px] font-bold text-slate-400">Date: {quoteDate}</p>
            <p className="text-[10px] font-bold text-slate-500 mt-0.5">Prepared For: {preparedFor}</p>
          </div>
        </div>

        {/* Dynamic Title Banner matching Company Brand Color */}
        <div 
          className="my-6 text-white rounded-xl p-5 shadow-sm relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${companyInfo.brandColor || '#0f172a'} 0%, #1e293b 100%)`
          }}
        >
          <div className="relative z-10 flex justify-between items-center gap-4">
            <div>
              <h2 className="text-xl font-black tracking-wide text-amber-300 uppercase">{title}</h2>
              <p className="text-xs font-semibold text-slate-200 mt-0.5">{subtitle}</p>
            </div>
            <div className="shrink-0 text-right">
              <span className="inline-block bg-white/10 text-amber-300 border border-amber-400/40 text-[10.5px] font-black px-3 py-1 rounded-full whitespace-nowrap backdrop-blur-sm">
                {passengerBadge}
              </span>
            </div>
          </div>
        </div>

        {/* Overview Metrics Cards */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
            <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">DEPARTURE</span>
            <span className="text-xs font-extrabold text-slate-800 block truncate">{departureAirport}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
            <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">TRAVEL DATES</span>
            <span className="text-xs font-extrabold text-slate-800 block truncate">{travelDatesText}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
            <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">DURATION</span>
            <span className="text-xs font-extrabold text-slate-800 block truncate">{totalDurationText}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
            <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">AIRLINE</span>
            <span className="text-xs font-extrabold text-slate-800 block truncate">{airlineCarrier}</span>
          </div>
        </div>

        {/* FLIGHT ITINERARY SECTION (MATCHING BOOKING FLIGHT DETAILS LAYOUT) */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3 pb-1 border-b border-slate-200">
            <Plane className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Flight Details & Itinerary</h3>
            <span className="text-[10px] font-bold text-slate-400 ml-auto">{flightClass}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Outbound Card */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50 flex flex-col justify-between">
              <div>
                <div className="bg-slate-900 text-white px-3.5 py-2 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Plane className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-xs font-black uppercase text-amber-300 font-mono">
                      OUTBOUND PNR: {outboundPnr}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-300">{outboundDateText}</span>
                </div>

                <div className="p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-black text-slate-800 border-b border-slate-200 pb-1.5">
                    <span>Route: {outboundRoute}</span>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {outboundLegs.length} Segment{outboundLegs.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {outboundLegs.map((leg, i) => (
                    <div key={leg.id || i} className="bg-white p-2.5 rounded-lg border border-slate-200 text-[11px] space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-black text-slate-900">{leg.airline || airlineCarrier}</span>
                        <span className="font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{leg.flightNo}</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-bold text-slate-700">
                        <span className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200">{getAirportShort(leg.departedFrom)}</span>
                        <span className="text-slate-400">{"->"}</span>
                        <span className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200">{getAirportShort(leg.arrivedAt)}</span>
                        <span className="text-slate-400 font-normal ml-auto text-[10px]">{leg.craft}</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-600 flex justify-between pt-0.5">
                        <span>Dep: {leg.departTime}</span>
                        <span>Arr: {leg.arrivalTime}</span>
                      </div>
                    </div>
                  ))}

                  {outboundTransitText && (
                    <p className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded border border-amber-200">
                      {outboundTransitText}
                    </p>
                  )}
                </div>
              </div>

              <div className="p-3 bg-slate-100/80 border-t border-slate-200 flex justify-between items-center text-[10px] font-bold text-slate-600">
                <span>{outboundArrivalNote}</span>
                <span className="text-blue-700">{outboundBaggage}</span>
              </div>
            </div>

            {/* Inbound Card */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50 flex flex-col justify-between">
              <div>
                <div className="bg-slate-900 text-white px-3.5 py-2 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Plane className="w-3.5 h-3.5 text-indigo-400 rotate-180" />
                    <span className="text-xs font-black uppercase text-amber-300 font-mono">
                      INBOUND PNR: {inboundPnr}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-300">{inboundDateText}</span>
                </div>

                <div className="p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-black text-slate-800 border-b border-slate-200 pb-1.5">
                    <span>Route: {inboundRoute}</span>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      {inboundLegs.length} Segment{inboundLegs.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {inboundLegs.map((leg, i) => (
                    <div key={leg.id || i} className="bg-white p-2.5 rounded-lg border border-slate-200 text-[11px] space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-black text-slate-900">{leg.airline || airlineCarrier}</span>
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">{leg.flightNo}</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-bold text-slate-700">
                        <span className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200">{getAirportShort(leg.departedFrom)}</span>
                        <span className="text-slate-400">{"->"}</span>
                        <span className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200">{getAirportShort(leg.arrivedAt)}</span>
                        <span className="text-slate-400 font-normal ml-auto text-[10px]">{leg.craft}</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-600 flex justify-between pt-0.5">
                        <span>Dep: {leg.departTime}</span>
                        <span>Arr: {leg.arrivalTime}</span>
                      </div>
                    </div>
                  ))}

                  {inboundTransitText && (
                    <p className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded border border-amber-200">
                      {inboundTransitText}
                    </p>
                  )}
                </div>
              </div>

              <div className="p-3 bg-slate-100/80 border-t border-slate-200 flex justify-between items-center text-[10px] font-bold text-slate-600">
                <span>{inboundArrivalNote}</span>
                <span className="text-indigo-700">{inboundBaggage}</span>
              </div>
            </div>
          </div>
        </div>

        {/* HOTEL ACCOMMODATIONS SECTION */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3 pb-1 border-b border-slate-200">
            <Building2 className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Hotel Accommodations</h3>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 ml-auto">
              {hotelStaySummaryBadge}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hotels.map((hotel, idx) => (
              <div key={idx} className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <h4 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                        {hotel.name} {renderStars(hotel.ratingStars)}
                      </h4>
                      <p className="text-[10.5px] font-bold text-emerald-700">{hotel.location}</p>
                    </div>
                    <span className="text-[9.5px] font-extrabold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded">
                      {hotel.ratingLabel}
                    </span>
                  </div>

                  <div className="text-[11px] font-semibold text-slate-600 my-2 space-y-0.5">
                    <p><strong className="text-slate-800">Stay:</strong> {hotel.stayDuration}</p>
                    <p><strong className="text-slate-800">Room:</strong> {hotel.roomType} • ({hotel.boardBasis})</p>
                  </div>
                </div>

                {hotel.featureBadge && (
                  <div className="mt-2 pt-2 border-t border-slate-200 text-[10px] font-bold text-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>{hotel.featureBadge}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* TRANSFERS & VISA SECTION */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Ground Transfers */}
          <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
            <div className="flex items-center gap-1.5 mb-2 pb-1 border-b border-slate-200">
              <Car className="w-3.5 h-3.5 text-purple-600" />
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">{transferTitle}</h4>
            </div>
            <ul className="space-y-1 text-[10.5px] font-semibold text-slate-700">
              {transferSectors.map((sec, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                  <span>{sec.label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Visa Services */}
          <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
            <div className="flex items-center gap-1.5 mb-2 pb-1 border-b border-slate-200">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">{visaTitle}</h4>
            </div>
            <div className="text-[10.5px] font-semibold text-slate-700 space-y-0.5">
              <p><strong className="text-slate-800">Validity:</strong> {visaValidity}</p>
              <p><strong className="text-slate-800">Eligibility:</strong> {visaEligibility}</p>
              <p className="text-[10px] text-teal-700 font-bold mt-1">{visaProcessing}</p>
            </div>
          </div>
        </div>

        {/* OPTIONAL ITEMIZED PRICE BREAKDOWN TABLE */}
        {showPriceBreakdownOnDoc && (
          <div className="mb-4 border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="bg-slate-100 px-3.5 py-1.5 border-b border-slate-200 flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-slate-600" /> Itemized Cost Breakdown
              </span>
              <span className="text-[9.5px] font-extrabold text-slate-600">
                Calculation based on {passengerCount} Passenger{passengerCount > 1 ? 's' : ''}
              </span>
            </div>
            <table className="w-full text-left border-collapse text-[10.5px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[9px] font-extrabold text-slate-500 uppercase">
                  <th className="py-1.5 px-3">Service Section</th>
                  <th className="py-1.5 px-3">Details / Route</th>
                  <th className="py-1.5 px-3 text-right">Cost Per Person</th>
                  <th className="py-1.5 px-3 text-right">Total ({passengerCount} PAX)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {parseFloat(flightPrice || '0') > 0 && (
                  <tr>
                    <td className="py-1.5 px-3 font-bold text-slate-900">Flights</td>
                    <td className="py-1.5 px-3 text-slate-600">{airlineCarrier} • {outboundRoute}</td>
                    <td className="py-1.5 px-3 text-right font-semibold">£{getSectionPP(flightPrice, flightPriceType, passengerCount).toFixed(2)}</td>
                    <td className="py-1.5 px-3 text-right font-bold text-slate-900">£{getSectionTotal(flightPrice, flightPriceType, passengerCount).toFixed(2)}</td>
                  </tr>
                )}
                {hotels.map((h, i) => (
                  parseFloat(h.price || '0') > 0 && (
                    <tr key={i}>
                      <td className="py-1.5 px-3 font-bold text-slate-900">Hotel {i + 1}</td>
                      <td className="py-1.5 px-3 text-slate-600">{h.name} ({h.stayDuration || h.location})</td>
                      <td className="py-1.5 px-3 text-right font-semibold">£{getSectionPP(h.price || '0', h.priceType || 'per_person', passengerCount).toFixed(2)}</td>
                      <td className="py-1.5 px-3 text-right font-bold text-slate-900">£{getSectionTotal(h.price || '0', h.priceType || 'per_person', passengerCount).toFixed(2)}</td>
                    </tr>
                  )
                ))}
                {parseFloat(transfersPrice || '0') > 0 && (
                  <tr>
                    <td className="py-1.5 px-3 font-bold text-slate-900">Ground Transfers</td>
                    <td className="py-1.5 px-3 text-slate-600">{transferTitle}</td>
                    <td className="py-1.5 px-3 text-right font-semibold">£{getSectionPP(transfersPrice, transfersPriceType, passengerCount).toFixed(2)}</td>
                    <td className="py-1.5 px-3 text-right font-bold text-slate-900">£{getSectionTotal(transfersPrice, transfersPriceType, passengerCount).toFixed(2)}</td>
                  </tr>
                )}
                {parseFloat(visaPrice || '0') > 0 && (
                  <tr>
                    <td className="py-1.5 px-3 font-bold text-slate-900">Visa Processing</td>
                    <td className="py-1.5 px-3 text-slate-600">{visaTitle}</td>
                    <td className="py-1.5 px-3 text-right font-semibold">£{getSectionPP(visaPrice, visaPriceType, passengerCount).toFixed(2)}</td>
                    <td className="py-1.5 px-3 text-right font-bold text-slate-900">£{getSectionTotal(visaPrice, visaPriceType, passengerCount).toFixed(2)}</td>
                  </tr>
                )}
                {parseFloat(otherPrice || '0') > 0 && (
                  <tr>
                    <td className="py-1.5 px-3 font-bold text-slate-900">{otherPriceTitle || 'Additional Service'}</td>
                    <td className="py-1.5 px-3 text-slate-600">Tailored Inclusions</td>
                    <td className="py-1.5 px-3 text-right font-semibold">£{getSectionPP(otherPrice, otherPriceType, passengerCount).toFixed(2)}</td>
                    <td className="py-1.5 px-3 text-right font-bold text-slate-900">£{getSectionTotal(otherPrice, otherPriceType, passengerCount).toFixed(2)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* PRICING BREAKDOWN BANNER MATCHING BRAND COLOR */}
        <div 
          className="text-white rounded-xl p-4 mb-6 shadow-md"
          style={{
            background: `linear-gradient(135deg, ${companyInfo.brandColor || '#0f172a'} 0%, #1e293b 100%)`
          }}
        >
          <div className="flex justify-between items-center">
            <div>
              <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-wider block">GRAND TOTAL INVESTMENT</span>
              <p className="text-xs font-semibold text-slate-300 mt-0.5">{priceIncludes}</p>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <span className="block text-[9px] font-extrabold text-blue-300 uppercase tracking-wider">PRICE PER PERSON</span>
                <span className="text-lg font-black text-white">£{parseFloat(pricePerPerson || '0').toFixed(2)}</span>
              </div>

              <div className="text-right pl-6 border-l border-white/20">
                <span className="block text-[9px] font-extrabold text-blue-300 uppercase tracking-wider">TOTAL PACKAGE ({passengerCount} PAX)</span>
                <span className="text-2xl font-black text-amber-300">£{parseFloat(totalPackagePrice || '0').toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Terms & Footer Note */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-6">
          <p className="text-[9.5px] text-slate-500 font-semibold leading-relaxed">
            <strong className="text-slate-800">Important Booking Terms:</strong> {importantTerms}
          </p>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400 font-bold">
          <span>{companyInfo.companyName || 'Tooba Travels Ltd'} • Umrah Package Quotation</span>
          <span>{departureAirport} • {passengerBadge}</span>
          <span>Page 1 of 1</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 p-3 sm:p-6 font-sans print:p-0 print:m-0 print:bg-white">
      {/* Top Header Controls (Hide on print) */}
      <div className="print:hidden max-w-7xl mx-auto mb-6 bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-primary-700" />
            Umrah & Holiday Package Quotation Builder
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            Logged in as <span className="text-primary-700 font-bold">{user?.name || user?.email}</span> • {companyInfo.companyName}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowPnrModal(true)}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Zap className="w-4 h-4 text-indigo-600 fill-indigo-600" />
            Paste GDS PNR
          </button>

          <button
            onClick={handleLoadUmrahPreset}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-all flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw className="w-4 h-4 text-amber-600" />
            Load Preset
          </button>

          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('split')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'split' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Columns className="w-3.5 h-3.5" /> Split View
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'preview' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Full Preview
            </button>
            <button
              onClick={() => setActiveTab('editor')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'editor' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" /> Full Editor
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'saved' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Folder className="w-3.5 h-3.5" /> Saved ({savedPackages.length})
            </button>
          </div>

          <button
            onClick={handleSavePackage}
            disabled={saving}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : quoteId ? 'Update Package' : 'Save Package'}
          </button>

          <button
            onClick={handleDownloadPDF}
            disabled={generatingPdf}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            {generatingPdf ? 'Generating...' : 'PDF'}
          </button>

          <button
            onClick={handlePrint}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      {/* SAVED PACKAGES TAB */}
      {activeTab === 'saved' && (
        <div className="print:hidden max-w-7xl mx-auto bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Folder className="w-5 h-5 text-primary-600" /> Saved Package Quotations
          </h2>
          {loading ? (
            <p className="text-sm text-slate-500">Loading saved packages...</p>
          ) : savedPackages.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-500">No package quotations saved yet.</p>
              <button onClick={handleLoadUmrahPreset} className="mt-4 text-xs font-bold text-primary-600 hover:underline">
                Create your first package from sample
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedPackages.map((item) => (
                <div key={item.id} className="border border-slate-200 rounded-xl p-4 hover:shadow-md transition-all flex flex-col justify-between bg-white">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-extrabold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-md">
                        {item.referenceNumber}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="font-black text-slate-900 text-sm">{item.title}</h3>
                    <p className="text-xs text-slate-500 font-medium">{item.preparedFor || item.passengerBadge}</p>
                    <p className="text-xs text-slate-600 font-semibold mt-2">
                      Carrier: {item.airlineCarrier || 'N/A'} • {item.totalDuration}
                    </p>
                    <p className="text-sm font-extrabold text-emerald-700 mt-2">
                      Total: £{parseFloat(item.totalPackagePrice || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => handleLoadPackage(item)}
                      className="px-3 py-1.5 bg-primary-50 text-primary-700 hover:bg-primary-100 text-xs font-bold rounded-lg transition-all"
                    >
                      Open & Edit
                    </button>
                    <button
                      onClick={() => handleDeletePackage(item.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SPLIT VIEW TAB (55% Editor / 45% Live Preview) */}
      {activeTab === 'split' && (
        <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start print:block print:w-full print:max-w-none print:p-0 print:m-0">
          {/* Left Column (55%): Collapsible Accordion Editor */}
          <div className="lg:col-span-6 space-y-4 print:hidden">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
              <h2 className="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-wide">
                <Edit3 className="w-4 h-4 text-primary-600" /> Package Quotation Accordion Builder
              </h2>
              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> Live Syncing
              </span>
            </div>
            {renderEditorForm()}
          </div>

          {/* Right Column (45%): Sticky Live PDF Preview */}
          <div className="lg:col-span-6 sticky top-6 print:block print:w-full print:static print:p-0 print:m-0">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm mb-3 flex justify-between items-center print:hidden">
              <span className="text-xs font-black text-slate-800 flex items-center gap-2 uppercase tracking-wide">
                <FileText className="w-4 h-4 text-blue-600" /> Live Quotation PDF Document Preview
              </span>
              <div className="flex gap-2">
                <button onClick={handleDownloadPDF} className="px-2.5 py-1 bg-blue-600 text-white text-[11px] font-bold rounded-lg shadow-sm hover:bg-blue-700">
                  Save PDF
                </button>
                <button onClick={handlePrint} className="px-2.5 py-1 bg-slate-800 text-white text-[11px] font-bold rounded-lg shadow-sm hover:bg-slate-900">
                  Print
                </button>
              </div>
            </div>
            {renderQuotationPreview()}
          </div>
        </div>
      )}

      {/* FULL EDITOR TAB */}
      {activeTab === 'editor' && (
        <div className="print:hidden max-w-5xl mx-auto bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-primary-600" /> Customize Package Quotation Fields
            </h2>
            <button onClick={() => setActiveTab('split')} className="text-xs font-bold text-primary-600 hover:underline flex items-center gap-1">
              Switch to Split View <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {renderEditorForm()}
        </div>
      )}

      {/* FULL PREVIEW TAB */}
      {activeTab === 'preview' && (
        <div className="max-w-4xl mx-auto">
          {renderQuotationPreview()}
        </div>
      )}

      {/* PNR CONVERTER MODAL */}
      {showPnrModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-2xl border border-slate-200 relative">
            <button
              onClick={() => setShowPnrModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-black text-slate-900 flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-indigo-600" /> Smart GDS PNR / Flight Text Converter
            </h3>
            <p className="text-xs text-slate-500 font-medium mb-4">
              Paste GDS PNR text (Amadeus, Sabre, Galileo) or flight itinerary text. The converter will parse flight numbers, routes, and times into structured fields.
            </p>

            <textarea
              rows={6}
              value={pnrText}
              onChange={(e) => setPnrText(e.target.value)}
              placeholder="e.g.&#10;1 RJ 112 Y 09NOV LHR AMM 1605 0005+1&#10;2 RJ 704 Y 10NOV AMM JED 0135 0345&#10;3 RJ 723 Y 19NOV MED AMM 0700 0855&#10;4 RJ 111 Y 19NOV AMM LHR 1155 1420"
              className="w-full border border-slate-300 rounded-xl p-3 text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowPnrModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleParsePnrText}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5"
              >
                <FileText className="w-4 h-4" /> Convert & Fill Fields
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
