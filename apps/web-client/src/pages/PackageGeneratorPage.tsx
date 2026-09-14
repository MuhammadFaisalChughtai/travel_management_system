import { useState, useEffect, useRef } from 'react';
import { 
  Printer, Save, Package, Plus, Trash2, Plane, 
  Building2, Car, ShieldCheck, RefreshCw, FileText,
  Download, Edit3, Folder, Star, CheckCircle2, 
  X, ArrowRight, Tag, ChevronDown, ChevronUp, Lock, Unlock, Pencil,
  Sparkles, Columns
} from 'lucide-react';
import { api } from '../api/axios';
import { useAuthStore } from '../store/authStore';
import { toast } from 'react-hot-toast';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { getAirlineName, getAirportName, calculateTransitTime } from '../utils/flightUtils';

interface HotelItem {
  name: string;
  location: string;
  ratingStars: number; // 1 to 5
  ratingLabel: string; // e.g. "(4-Star)" or "(Luxury)"
  checkInDate: string;
  checkOutDate: string;
  stayDuration: string;
  isManualStayDuration?: boolean;
  roomType: string;
  boardBasis: string;
  featureBadge: string;
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

  // Company / Tenant Context
  const [companyInfo, setCompanyInfo] = useState({
    companyName: 'Tooba Travels',
    logoPrimary: '',
    officeAddress: '',
    emailSender: '',
    landlineFormat: ''
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

  // Structured Outbound Flight
  const [outboundRoute, setOutboundRoute] = useState('LHR ➔ JED');
  const [outboundDepDate, setOutboundDepDate] = useState('2026-11-09');
  const [outboundDateText, setOutboundDateText] = useState('Mon, 09 Nov 2026');
  
  const [outboundLeg1No, setOutboundLeg1No] = useState('RJ 112');
  const [outboundLeg1Craft, setOutboundLeg1Craft] = useState('Boeing 787-9');
  const [outboundLeg1Dep, setOutboundLeg1Dep] = useState('16:05 LHR (T3)');
  const [outboundLeg1Arr, setOutboundLeg1Arr] = useState('00:05 AMM (+1)');

  const [outboundTransitText, setOutboundTransitText] = useState('Transit in Amman (AMM): 1 hr 30 mins');

  const [outboundLeg2No, setOutboundLeg2No] = useState('RJ 704');
  const [outboundLeg2Craft, setOutboundLeg2Craft] = useState('Boeing 787');
  const [outboundLeg2Dep, setOutboundLeg2Dep] = useState('01:35 AMM');
  const [outboundLeg2Arr, setOutboundLeg2Arr] = useState('03:45 JED (T1)');

  const [outboundArrivalNote, setOutboundArrivalNote] = useState('Arrival: Tue, 10 Nov (03:45)');
  
  // Baggage Selectors
  const [outboundCheckedBag, setOutboundCheckedBag] = useState('1x 23kg (pp)');
  const [outboundCabinBag, setOutboundCabinBag] = useState('+ Cabin Bag (pp)');
  const [outboundBaggage, setOutboundBaggage] = useState('Baggage: 1x 23kg + Cabin Bag (pp)');

  // Structured Inbound Flight
  const [inboundRoute, setInboundRoute] = useState('MED ➔ LHR');
  const [inboundDepDate, setInboundDepDate] = useState('2026-11-19');
  const [inboundDateText, setInboundDateText] = useState('Thu, 19 Nov 2026');

  const [inboundLeg1No, setInboundLeg1No] = useState('RJ 723');
  const [inboundLeg1Craft, setInboundLeg1Craft] = useState('Boeing 787-8');
  const [inboundLeg1Dep, setInboundLeg1Dep] = useState('07:00 MED');
  const [inboundLeg1Arr, setInboundLeg1Arr] = useState('08:55 AMM');

  const [inboundTransitText, setInboundTransitText] = useState('Transit in Amman (AMM): 3 hrs 00 mins');

  const [inboundLeg2No, setInboundLeg2No] = useState('RJ 111');
  const [inboundLeg2Craft, setInboundLeg2Craft] = useState('Boeing 787-9');
  const [inboundLeg2Dep, setInboundLeg2Dep] = useState('11:55 AMM');
  const [inboundLeg2Arr, setInboundLeg2Arr] = useState('14:20 LHR (T3)');

  const [inboundArrivalNote, setInboundArrivalNote] = useState('Arrival: Thu, 19 Nov (14:20)');
  
  const [inboundCheckedBag, setInboundCheckedBag] = useState('1x 23kg (pp)');
  const [inboundCabinBag, setInboundCabinBag] = useState('+ Cabin Bag (pp)');
  const [inboundBaggage, setInboundBaggage] = useState('Baggage: 1x 23kg + Cabin Bag (pp)');

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
      featureBadge: '24/7 Dedicated Haram Shuttle Bus Service'
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
      featureBadge: 'Steps from Al-Masjid an-Nabawi Courtyard'
    }
  ]);

  // Transfers & Visa
  const [transferTitle, setTransferTitle] = useState('Private AC Vehicle Circuit');
  const [transferSectors, setTransferSectors] = useState<SectorItem[]>([
    { label: 'Sector 1: Jeddah Airport (JED) ➔ voco Makkah Hotel' },
    { label: 'Sector 2: Makkah Hotel ➔ Millennium Taiba Madinah' },
    { label: 'Sector 3: Millennium Taiba Madinah ➔ Madinah Airport (MED)' }
  ]);

  const [selectedVisaTemplate, setSelectedVisaTemplate] = useState('uk_eta');
  const [visaTitle, setVisaTitle] = useState('Saudi Electronic Travel Authorisation (ETA)');
  const [visaValidity, setVisaValidity] = useState('2-Year Multiple Entry Visa');
  const [visaEligibility, setVisaEligibility] = useState('British Passport Holders');
  const [visaProcessing, setVisaProcessing] = useState('Full electronic documentation & support included');

  // Pricing
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

  // Sync Outbound Baggage text
  useEffect(() => {
    setOutboundBaggage(`Baggage: ${outboundCheckedBag} ${outboundCabinBag}`.trim());
  }, [outboundCheckedBag, outboundCabinBag]);

  // Sync Inbound Baggage text
  useEffect(() => {
    setInboundBaggage(`Baggage: ${inboundCheckedBag} ${inboundCabinBag}`.trim());
  }, [inboundCheckedBag, inboundCabinBag]);

  // Fetch company context & saved packages on load
  useEffect(() => {
    fetchCompanyContext();
    fetchSavedPackages();
  }, []);

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

  // Auto calculate total package price (pricePerPerson * passengerCount) unless manually locked
  useEffect(() => {
    if (!isManualTotalPrice) {
      const ppp = parseFloat(pricePerPerson) || 0;
      const total = ppp * passengerCount;
      setTotalPackagePrice(total.toFixed(2));
    }
  }, [pricePerPerson, passengerCount, isManualTotalPrice]);

  // Auto calculate transit layovers when leg times change
  useEffect(() => {
    if (outboundLeg1Arr && outboundLeg2Dep) {
      const arrMatch = outboundLeg1Arr.match(/(\d{1,2}:\d{2})/);
      const depMatch = outboundLeg2Dep.match(/(\d{1,2}:\d{2})/);
      const codeMatch = outboundLeg1Arr.match(/([A-Z]{3})/);
      const airportCode = codeMatch ? codeMatch[1] : 'AMM';
      if (arrMatch && depMatch) {
        const transit = calculateTransitTime(null, arrMatch[1], null, depMatch[1]);
        if (transit) {
          setOutboundTransitText(`Transit in ${getAirportName(airportCode)} (${airportCode}): ${transit}`);
        }
      }
    }
  }, [outboundLeg1Arr, outboundLeg2Dep]);

  useEffect(() => {
    if (inboundLeg1Arr && inboundLeg2Dep) {
      const arrMatch = inboundLeg1Arr.match(/(\d{1,2}:\d{2})/);
      const depMatch = inboundLeg2Dep.match(/(\d{1,2}:\d{2})/);
      const codeMatch = inboundLeg1Arr.match(/([A-Z]{3})/);
      const airportCode = codeMatch ? codeMatch[1] : 'AMM';
      if (arrMatch && depMatch) {
        const transit = calculateTransitTime(null, arrMatch[1], null, depMatch[1]);
        if (transit) {
          setInboundTransitText(`Transit in ${getAirportName(airportCode)} (${airportCode}): ${transit}`);
        }
      }
    }
  }, [inboundLeg1Arr, inboundLeg2Dep]);

  const fetchCompanyContext = async () => {
    try {
      const res = await api.get('/finance/company-context');
      if (res.data?.companyContext) {
        const ctx = res.data.companyContext;
        setCompanyInfo({
          companyName: ctx.companyName || 'Tooba Travels',
          logoPrimary: ctx.logoPrimary || '',
          officeAddress: ctx.officeAddress || '',
          emailSender: ctx.emailSender || '',
          landlineFormat: ctx.landlineFormat || ''
        });
      }
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

    setOutboundRoute('LHR ➔ JED');
    setOutboundDepDate('2026-11-09');
    setOutboundLeg1No('RJ 112');
    setOutboundLeg1Craft('Boeing 787-9');
    setOutboundLeg1Dep('16:05 LHR (T3)');
    setOutboundLeg1Arr('00:05 AMM (+1)');
    setOutboundTransitText('Transit in Amman (AMM): 1 hr 30 mins');
    setOutboundLeg2No('RJ 704');
    setOutboundLeg2Craft('Boeing 787');
    setOutboundLeg2Dep('01:35 AMM');
    setOutboundLeg2Arr('03:45 JED (T1)');
    setOutboundArrivalNote('Arrival: Tue, 10 Nov (03:45)');
    setOutboundCheckedBag('1x 23kg (pp)');
    setOutboundCabinBag('+ Cabin Bag (pp)');

    setInboundRoute('MED ➔ LHR');
    setInboundDepDate('2026-11-19');
    setInboundLeg1No('RJ 723');
    setInboundLeg1Craft('Boeing 787-8');
    setInboundLeg1Dep('07:00 MED');
    setInboundLeg1Arr('08:55 AMM');
    setInboundTransitText('Transit in Amman (AMM): 3 hrs 00 mins');
    setInboundLeg2No('RJ 111');
    setInboundLeg2Craft('Boeing 787-9');
    setInboundLeg2Dep('11:55 AMM');
    setInboundLeg2Arr('14:20 LHR (T3)');
    setInboundArrivalNote('Arrival: Thu, 19 Nov (14:20)');
    setInboundCheckedBag('1x 23kg (pp)');
    setInboundCabinBag('+ Cabin Bag (pp)');

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
        featureBadge: '24/7 Dedicated Haram Shuttle Bus Service'
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
        featureBadge: 'Steps from Al-Masjid an-Nabawi Courtyard'
      }
    ]);

    setTransferTitle('Private AC Vehicle Circuit');
    setTransferSectors([
      { label: 'Sector 1: Jeddah Airport (JED) ➔ voco Makkah Hotel' },
      { label: 'Sector 2: Makkah Hotel ➔ Millennium Taiba Madinah' },
      { label: 'Sector 3: Millennium Taiba Madinah ➔ Madinah Airport (MED)' }
    ]);

    handleSelectVisaTemplate('uk_eta');

    setPricePerPerson('950.00');
    setPassengerCount(2);
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
        if (matches[0]) {
          const detectedAirline = getAirlineName(matches[0][1]);
          if (detectedAirline) {
            setAirlineCarrier(detectedAirline);
          }
          setOutboundLeg1No(`${matches[0][1]} ${matches[0][2]}`);
          setOutboundLeg1Dep(`${matches[0][6].slice(0,2)}:${matches[0][6].slice(2)} ${matches[0][4]}`);
          setOutboundLeg1Arr(`${matches[0][7].slice(0,2)}:${matches[0][7].slice(2)} ${matches[0][5]}`);
          setDepartureAirport(getAirportName(matches[0][4]));
        }
        if (matches[1]) {
          setOutboundLeg2No(`${matches[1][1]} ${matches[1][2]}`);
          setOutboundLeg2Dep(`${matches[1][6].slice(0,2)}:${matches[1][6].slice(2)} ${matches[1][4]}`);
          setOutboundLeg2Arr(`${matches[1][7].slice(0,2)}:${matches[1][7].slice(2)} ${matches[1][5]}`);
          
          const arrTime = `${matches[0][7].slice(0,2)}:${matches[0][7].slice(2)}`;
          const depTime = `${matches[1][6].slice(0,2)}:${matches[1][6].slice(2)}`;
          const transit = calculateTransitTime(null, arrTime, null, depTime);
          if (transit) {
            setOutboundTransitText(`Transit in ${getAirportName(matches[0][5])} (${matches[0][5]}): ${transit}`);
          }
        }
        if (matches[2]) {
          setInboundLeg1No(`${matches[2][1]} ${matches[2][2]}`);
          setInboundLeg1Dep(`${matches[2][6].slice(0,2)}:${matches[2][6].slice(2)} ${matches[2][4]}`);
          setInboundLeg1Arr(`${matches[2][7].slice(0,2)}:${matches[2][7].slice(2)} ${matches[2][5]}`);
        }
        if (matches[3]) {
          setInboundLeg2No(`${matches[3][1]} ${matches[3][2]}`);
          setInboundLeg2Dep(`${matches[3][6].slice(0,2)}:${matches[3][6].slice(2)} ${matches[3][4]}`);
          setInboundLeg2Arr(`${matches[3][7].slice(0,2)}:${matches[3][7].slice(2)} ${matches[3][5]}`);

          const arrTime = `${matches[2][7].slice(0,2)}:${matches[2][7].slice(2)}`;
          const depTime = `${matches[3][6].slice(0,2)}:${matches[3][6].slice(2)}`;
          const transit = calculateTransitTime(null, arrTime, null, depTime);
          if (transit) {
            setInboundTransitText(`Transit in ${getAirportName(matches[2][5])} (${matches[2][5]}): ${transit}`);
          }
        }
        toast.success(`Successfully parsed ${matches.length} flight legs from PNR text!`);
        setShowPnrModal(false);
        setPnrText('');
      } else {
        toast.error('Could not auto-detect standard PNR format. You can fill out the structured leg fields below.');
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
          route: outboundRoute,
          dateText: outboundDateText,
          depDate: outboundDepDate,
          leg1No: outboundLeg1No,
          leg1Craft: outboundLeg1Craft,
          leg1Dep: outboundLeg1Dep,
          leg1Arr: outboundLeg1Arr,
          transitText: outboundTransitText,
          leg2No: outboundLeg2No,
          leg2Craft: outboundLeg2Craft,
          leg2Dep: outboundLeg2Dep,
          leg2Arr: outboundLeg2Arr,
          arrivalNote: outboundArrivalNote,
          baggage: outboundBaggage
        },
        flightInboundJson: {
          route: inboundRoute,
          dateText: inboundDateText,
          depDate: inboundDepDate,
          leg1No: inboundLeg1No,
          leg1Craft: inboundLeg1Craft,
          leg1Dep: inboundLeg1Dep,
          leg1Arr: inboundLeg1Arr,
          transitText: inboundTransitText,
          leg2No: inboundLeg2No,
          leg2Craft: inboundLeg2Craft,
          leg2Dep: inboundLeg2Dep,
          leg2Arr: inboundLeg2Arr,
          arrivalNote: inboundArrivalNote,
          baggage: inboundBaggage
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
        pricePerPerson,
        totalPackagePrice,
        priceIncludes,
        importantTerms,
        agentName: user?.name || 'Agent',
        companyName: companyInfo.companyName,
        companyLogo: companyInfo.logoPrimary,
        companyPhone: companyInfo.landlineFormat,
        companyEmail: companyInfo.emailSender
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

      if (item.flightOutboundJson) {
        const out = typeof item.flightOutboundJson === 'string' ? JSON.parse(item.flightOutboundJson) : item.flightOutboundJson;
        setOutboundRoute(out.route || 'LHR ➔ JED');
        setOutboundDateText(out.dateText || '');
        if (out.depDate) setOutboundDepDate(out.depDate);
        setOutboundLeg1No(out.leg1No || out.leg1Flight || '');
        setOutboundLeg1Craft(out.leg1Craft || '');
        setOutboundLeg1Dep(out.leg1Dep || out.leg1Time || '');
        setOutboundLeg1Arr(out.leg1Arr || '');
        setOutboundTransitText(out.transitText || out.transit || '');
        setOutboundLeg2No(out.leg2No || out.leg2Flight || '');
        setOutboundLeg2Craft(out.leg2Craft || '');
        setOutboundLeg2Dep(out.leg2Dep || out.leg2Time || '');
        setOutboundLeg2Arr(out.leg2Arr || '');
        setOutboundArrivalNote(out.arrivalNote || '');
        setOutboundBaggage(out.baggage || '');
      }

      if (item.flightInboundJson) {
        const inb = typeof item.flightInboundJson === 'string' ? JSON.parse(item.flightInboundJson) : item.flightInboundJson;
        setInboundRoute(inb.route || 'MED ➔ LHR');
        setInboundDateText(inb.dateText || '');
        if (inb.depDate) setInboundDepDate(inb.depDate);
        setInboundLeg1No(inb.leg1No || inb.leg1Flight || '');
        setInboundLeg1Craft(inb.leg1Craft || '');
        setInboundLeg1Dep(inb.leg1Dep || inb.leg1Time || '');
        setInboundLeg1Arr(inb.leg1Arr || '');
        setInboundTransitText(inb.transitText || inb.transit || '');
        setInboundLeg2No(inb.leg2No || inb.leg2Flight || '');
        setInboundLeg2Craft(inb.leg2Craft || '');
        setInboundLeg2Dep(inb.leg2Dep || inb.leg2Time || '');
        setInboundLeg2Arr(inb.leg2Arr || '');
        setInboundArrivalNote(inb.arrivalNote || '');
        setInboundBaggage(inb.baggage || '');
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

  // High-Resolution 1-Click PDF Download
  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setGeneratingPdf(true);
    try {
      const element = printRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgWidth = 210; // A4 width mm
      const pageHeight = 297; // A4 height mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, Math.min(imgHeight, pageHeight));
      pdf.save(`${refNumber.replace(/[^a-zA-Z0-9-]/g, '_')}_Quotation.pdf`);
      toast.success('PDF downloaded successfully!');
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('Direct PDF export error. Opening standard print window.');
      window.print();
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

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
        featureBadge: 'Great Location & Haram Shuttle'
      }
    ]);
  };

  const updateHotel = (index: number, field: keyof HotelItem, value: any) => {
    const updated = [...hotels];
    const hotel = { ...updated[index], [field]: value };

    // Auto update stay duration if checkIn or checkOut changes and manual override is off
    if ((field === 'checkInDate' || field === 'checkOutDate') && !hotel.isManualStayDuration) {
      const checkIn = field === 'checkInDate' ? value : hotel.checkInDate;
      const checkOut = field === 'checkOutDate' ? value : hotel.checkOutDate;
      const autoDuration = computeStayDuration(checkIn, checkOut);
      if (autoDuration) {
        hotel.stayDuration = autoDuration;
      }
    }

    updated[index] = hotel;
    setHotels(updated);
  };

  const removeHotel = (index: number) => {
    setHotels(hotels.filter((_, i) => i !== index));
  };

  const addSector = () => {
    setTransferSectors([...transferSectors, { label: `Sector ${transferSectors.length + 1}: Airport ➔ Hotel` }]);
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
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
              ✓ Ref: {refNumber}
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

      {/* SECTION 2: FLIGHT ITINERARY BUILDER */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between transition-all">
          <button onClick={() => toggleSection('flights')} className="flex items-center gap-2 text-left">
            <Plane className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              2. Flight Itinerary Builder
            </h3>
            <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
              ✓ {airlineCarrier}
            </span>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPnrModal(true)}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg shadow-sm flex items-center gap-1 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" /> ⚡ Auto-Fill via GDS PNR
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
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Airline Carrier</label>
                <input
                  type="text"
                  value={airlineCarrier}
                  onChange={(e) => setAirlineCarrier(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Cabin / Flight Class</label>
                <input
                  type="text"
                  value={flightClass}
                  onChange={(e) => setFlightClass(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold"
                />
              </div>
            </div>

            {/* Outbound & Inbound Leg Builders */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Outbound */}
              <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-3 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-xs text-blue-900 uppercase flex items-center gap-1.5">
                    <Plane className="w-3.5 h-3.5 text-blue-600" /> Outbound Flight
                  </h4>
                  <span className="text-[10px] font-extrabold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                    {outboundRoute}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Route (e.g. LHR ➔ JED)"
                    value={outboundRoute}
                    onChange={(e) => setOutboundRoute(e.target.value)}
                    className="border rounded-lg px-2.5 py-1 text-xs font-bold bg-white"
                  />
                  <input
                    type="date"
                    value={outboundDepDate}
                    onChange={(e) => setOutboundDepDate(e.target.value)}
                    className="border rounded-lg px-2.5 py-1 text-xs bg-white"
                  />
                </div>

                <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-2">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase">Outbound Leg 1</span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Flight No (e.g. RJ 112)"
                      value={outboundLeg1No}
                      onChange={(e) => setOutboundLeg1No(e.target.value)}
                      className="border rounded-lg px-2.5 py-1 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Craft (e.g. Boeing 787-9)"
                      value={outboundLeg1Craft}
                      onChange={(e) => setOutboundLeg1Craft(e.target.value)}
                      className="border rounded-lg px-2.5 py-1 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Dep Time & Airport (e.g. 16:05 LHR)"
                      value={outboundLeg1Dep}
                      onChange={(e) => setOutboundLeg1Dep(e.target.value)}
                      className="border rounded-lg px-2.5 py-1 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Arr Time & Airport (e.g. 00:05 AMM)"
                      value={outboundLeg1Arr}
                      onChange={(e) => setOutboundLeg1Arr(e.target.value)}
                      className="border rounded-lg px-2.5 py-1 text-xs"
                    />
                  </div>
                </div>

                <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-2">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase">Outbound Leg 2</span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Flight No (e.g. RJ 704)"
                      value={outboundLeg2No}
                      onChange={(e) => setOutboundLeg2No(e.target.value)}
                      className="border rounded-lg px-2.5 py-1 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Craft (e.g. Boeing 787)"
                      value={outboundLeg2Craft}
                      onChange={(e) => setOutboundLeg2Craft(e.target.value)}
                      className="border rounded-lg px-2.5 py-1 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Dep Time & Airport (e.g. 01:35 AMM)"
                      value={outboundLeg2Dep}
                      onChange={(e) => setOutboundLeg2Dep(e.target.value)}
                      className="border rounded-lg px-2.5 py-1 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Arr Time & Airport (e.g. 03:45 JED)"
                      value={outboundLeg2Arr}
                      onChange={(e) => setOutboundLeg2Arr(e.target.value)}
                      className="border rounded-lg px-2.5 py-1 text-xs"
                    />
                  </div>
                </div>

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

              {/* Inbound */}
              <div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-3 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-xs text-indigo-900 uppercase flex items-center gap-1.5">
                    <Plane className="w-3.5 h-3.5 text-indigo-600 rotate-180" /> Inbound Flight
                  </h4>
                  <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                    {inboundRoute}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Route (e.g. MED ➔ LHR)"
                    value={inboundRoute}
                    onChange={(e) => setInboundRoute(e.target.value)}
                    className="border rounded-lg px-2.5 py-1 text-xs font-bold bg-white"
                  />
                  <input
                    type="date"
                    value={inboundDepDate}
                    onChange={(e) => setInboundDepDate(e.target.value)}
                    className="border rounded-lg px-2.5 py-1 text-xs bg-white"
                  />
                </div>

                <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-2">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase">Inbound Leg 1</span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Flight No (e.g. RJ 723)"
                      value={inboundLeg1No}
                      onChange={(e) => setInboundLeg1No(e.target.value)}
                      className="border rounded-lg px-2.5 py-1 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Craft (e.g. Boeing 787-8)"
                      value={inboundLeg1Craft}
                      onChange={(e) => setInboundLeg1Craft(e.target.value)}
                      className="border rounded-lg px-2.5 py-1 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Dep Time & Airport (e.g. 07:00 MED)"
                      value={inboundLeg1Dep}
                      onChange={(e) => setInboundLeg1Dep(e.target.value)}
                      className="border rounded-lg px-2.5 py-1 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Arr Time & Airport (e.g. 08:55 AMM)"
                      value={inboundLeg1Arr}
                      onChange={(e) => setInboundLeg1Arr(e.target.value)}
                      className="border rounded-lg px-2.5 py-1 text-xs"
                    />
                  </div>
                </div>

                <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-2">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase">Inbound Leg 2</span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Flight No (e.g. RJ 111)"
                      value={inboundLeg2No}
                      onChange={(e) => setInboundLeg2No(e.target.value)}
                      className="border rounded-lg px-2.5 py-1 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Craft (e.g. Boeing 787-9)"
                      value={inboundLeg2Craft}
                      onChange={(e) => setInboundLeg2Craft(e.target.value)}
                      className="border rounded-lg px-2.5 py-1 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Dep Time & Airport (e.g. 11:55 AMM)"
                      value={inboundLeg2Dep}
                      onChange={(e) => setInboundLeg2Dep(e.target.value)}
                      className="border rounded-lg px-2.5 py-1 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Arr Time & Airport (e.g. 14:20 LHR)"
                      value={inboundLeg2Arr}
                      onChange={(e) => setInboundLeg2Arr(e.target.value)}
                      className="border rounded-lg px-2.5 py-1 text-xs"
                    />
                  </div>
                </div>

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
              ✓ {hotels.length} Hotel{hotels.length > 1 ? 's' : ''}
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
              ✓ {transferSectors.length} Sectors
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
              ✓ {visaValidity}
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
              <label className="block text-xs font-black text-teal-900 mb-1.5 uppercase">
                ⚡ Select Quick Visa Template
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
          </div>
        )}
      </div>

      {/* SECTION 6: PRICING & TERMS */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between transition-all">
          <button onClick={() => toggleSection('pricing')} className="flex items-center gap-2 text-left">
            <Tag className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              6. Pricing & Booking Terms
            </h3>
            <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
              ✓ Total: £{parseFloat(totalPackagePrice || '0').toFixed(2)}
            </span>
          </button>
          <button onClick={() => toggleSection('pricing')}>
            {openSections.pricing ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
          </button>
        </div>

        {openSections.pricing && (
          <div className="p-4 space-y-4 border-t border-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Price Per Person (£)</label>
                <input
                  type="number"
                  step="0.01"
                  value={pricePerPerson}
                  onChange={(e) => setPricePerPerson(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Passenger Count (PAX)</label>
                <input
                  type="number"
                  min="1"
                  value={passengerCount}
                  onChange={(e) => setPassengerCount(parseInt(e.target.value) || 1)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-700">Total Package Price (£)</label>
                  <button
                    onClick={() => setIsManualTotalPrice(!isManualTotalPrice)}
                    className="text-[10px] font-bold text-amber-700 hover:underline flex items-center gap-0.5"
                  >
                    {isManualTotalPrice ? <Unlock className="w-3 h-3 text-amber-600" /> : <Lock className="w-3 h-3 text-slate-500" />}
                    {isManualTotalPrice ? 'Manual Mode' : 'Auto-Calc'}
                  </button>
                </div>
                <input
                  type="number"
                  step="0.01"
                  readOnly={!isManualTotalPrice}
                  value={totalPackagePrice}
                  onChange={(e) => setTotalPackagePrice(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-1.5 text-xs font-black ${
                    isManualTotalPrice ? 'bg-white border-amber-400 text-amber-900' : 'bg-slate-100 text-slate-800 border-slate-300'
                  }`}
                />
              </div>
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
    <div className="w-full flex justify-center">
      <div 
        ref={printRef}
        className="w-full bg-white shadow-xl border border-slate-200 text-slate-800 p-6 sm:p-10 rounded-2xl relative print:shadow-none print:border-none print:p-0"
        style={{ minHeight: '297mm' }}
      >
        {/* Document Header */}
        <div className="flex justify-between items-start pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              {companyInfo.logoPrimary ? (
                <img src={companyInfo.logoPrimary} alt="Company Logo" className="h-10 object-contain" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-primary-700 text-white flex items-center justify-center font-black text-lg">
                  T
                </div>
              )}
              <span className="text-xl font-black tracking-tight text-slate-900">
                {companyInfo.companyName || 'TOOBA TRAVELS'}
              </span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 mt-1 max-w-xs leading-tight">
              {companyInfo.officeAddress || 'ATOL & IATA Licensed Travel Agency'}
            </p>
          </div>

          <div className="text-right">
            <span className="inline-block bg-primary-50 text-primary-800 text-[11px] font-extrabold px-3 py-1 rounded-full border border-primary-200 mb-1">
              {refNumber}
            </span>
            <p className="text-[10px] font-bold text-slate-400">Date: {quoteDate}</p>
            <p className="text-[10px] font-bold text-slate-500 mt-0.5">Prepared For: {preparedFor}</p>
          </div>
        </div>

        {/* Title Banner */}
        <div className="my-6 bg-gradient-to-r from-primary-900 via-primary-800 to-indigo-950 text-white rounded-xl p-5 shadow-sm relative overflow-hidden">
          <div className="relative z-10 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-black tracking-wide text-amber-300 uppercase">{title}</h2>
              <p className="text-xs font-semibold text-blue-100 mt-0.5">{subtitle}</p>
            </div>
            <div className="text-right">
              <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-black px-3 py-1 rounded-full backdrop-blur-sm">
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

        {/* FLIGHT ITINERARY SECTION */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3 pb-1 border-b border-slate-200">
            <Plane className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Flight Details & Itinerary</h3>
            <span className="text-[10px] font-bold text-slate-400 ml-auto">{flightClass}</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Outbound */}
            <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 space-y-2.5">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-xs font-extrabold text-blue-900 flex items-center gap-1">
                  <Plane className="w-3.5 h-3.5 text-blue-600" /> OUTBOUND: {outboundRoute}
                </span>
                <span className="text-[10px] font-bold text-slate-500">{outboundDateText}</span>
              </div>

              <div className="text-[11px] space-y-1 text-slate-700">
                <p className="font-semibold">
                  <strong className="text-slate-900">Leg 1:</strong> {outboundLeg1No} ({outboundLeg1Craft}) • Dep: {outboundLeg1Dep} ➔ Arr: {outboundLeg1Arr}
                </p>
                {outboundTransitText && (
                  <p className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block">
                    {outboundTransitText}
                  </p>
                )}
                <p className="font-semibold">
                  <strong className="text-slate-900">Leg 2:</strong> {outboundLeg2No} ({outboundLeg2Craft}) • Dep: {outboundLeg2Dep} ➔ Arr: {outboundLeg2Arr}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-between text-[10px] font-bold text-slate-500">
                <span>{outboundArrivalNote}</span>
                <span className="text-blue-700">{outboundBaggage}</span>
              </div>
            </div>

            {/* Inbound */}
            <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 space-y-2.5">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-xs font-extrabold text-indigo-900 flex items-center gap-1">
                  <Plane className="w-3.5 h-3.5 text-indigo-600 rotate-180" /> INBOUND: {inboundRoute}
                </span>
                <span className="text-[10px] font-bold text-slate-500">{inboundDateText}</span>
              </div>

              <div className="text-[11px] space-y-1 text-slate-700">
                <p className="font-semibold">
                  <strong className="text-slate-900">Leg 1:</strong> {inboundLeg1No} ({inboundLeg1Craft}) • Dep: {inboundLeg1Dep} ➔ Arr: {inboundLeg1Arr}
                </p>
                {inboundTransitText && (
                  <p className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block">
                    {inboundTransitText}
                  </p>
                )}
                <p className="font-semibold">
                  <strong className="text-slate-900">Leg 2:</strong> {inboundLeg2No} ({inboundLeg2Craft}) • Dep: {inboundLeg2Dep} ➔ Arr: {inboundLeg2Arr}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-between text-[10px] font-bold text-slate-500">
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

        {/* PRICING BREAKDOWN BANNER */}
        <div className="bg-gradient-to-r from-slate-900 via-primary-950 to-slate-900 text-white rounded-xl p-4 mb-6 shadow-md">
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

              <div className="text-right pl-6 border-l border-blue-400/30">
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
          <span>{companyInfo.companyName || 'Tooba Travels'} • Umrah Package Quotation</span>
          <span>{departureAirport} • {passengerBadge}</span>
          <span>Page 1 of 1</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 p-3 sm:p-6 font-sans">
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
            <Sparkles className="w-4 h-4 text-indigo-600" />
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
        <div className="print:hidden max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (55%): Collapsible Accordion Editor */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
              <h2 className="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-wide">
                <Edit3 className="w-4 h-4 text-primary-600" /> Package Quotation Accordion Builder
              </h2>
              <span className="text-[11px] font-bold text-slate-500">Live Syncing ⚡</span>
            </div>
            {renderEditorForm()}
          </div>

          {/* Right Column (45%): Sticky Live PDF Preview */}
          <div className="lg:col-span-6 sticky top-6">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm mb-3 flex justify-between items-center">
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
