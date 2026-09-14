import { useState, useEffect, useRef } from 'react';
import { 
  Printer, Save, Package, Plus, Trash2, Plane, 
  Building2, Car, ShieldCheck, RefreshCw, FileText, Globe,
  Download, Edit3, Folder, Star, CheckCircle2, 
  X, ArrowRight, Tag
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
  roomType: string;
  boardBasis: string;
  featureBadge: string;
}

interface SectorItem {
  label: string;
}

export function PackageGeneratorPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'editor' | 'preview' | 'saved'>('preview');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [savedPackages, setSavedPackages] = useState<any[]>([]);

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
      roomType: 'Quad Room (for 2 Pax)',
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

  const [visaTitle, setVisaTitle] = useState('Saudi Electronic Travel Authorisation (ETA)');
  const [visaValidity, setVisaValidity] = useState('2-Year Multiple Entry Visa');
  const [visaEligibility, setVisaEligibility] = useState('British Passport Holders');
  const [visaProcessing, setVisaProcessing] = useState('Full electronic documentation & support included');

  // Pricing
  const [pricePerPerson, setPricePerPerson] = useState('950.00');
  const [totalPackagePrice, setTotalPackagePrice] = useState('1900.00');
  const [passengerCount, setPassengerCount] = useState(2);
  const [priceIncludes, setPriceIncludes] = useState('Includes Return Flights, 9 Nights Hotels, Private Ground Transfers & ETA Visas');

  const [importantTerms, setImportantTerms] = useState(
    'Rates and flight availability are subject to re-confirmation at the time of final booking and payment. British passport validity must be at least 6 months from the departure date. Hotel standard check-in is 16:00 and check-out is 12:00. Non-refundable package terms apply upon ticket issuance.'
  );

  const printRef = useRef<HTMLDivElement>(null);

  // Fetch company context & saved packages on load
  useEffect(() => {
    fetchCompanyContext();
    fetchSavedPackages();
  }, []);

  // Auto calculate trip dates & nights
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

  // Auto calculate total package price
  useEffect(() => {
    const ppp = parseFloat(pricePerPerson) || 0;
    const total = ppp * passengerCount;
    setTotalPackagePrice(total.toFixed(2));
  }, [pricePerPerson, passengerCount]);

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
    setOutboundBaggage('Baggage: 1x 23kg + Cabin Bag (pp)');

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
    setInboundBaggage('Baggage: 1x 23kg + Cabin Bag (pp)');

    setHotels([
      {
        name: 'voco Makkah',
        location: 'Makkah Al-Mukarramah',
        ratingStars: 4,
        ratingLabel: '(4-Star)',
        checkInDate: '2026-11-10',
        checkOutDate: '2026-11-15',
        stayDuration: '5 Nights (10 Nov – 15 Nov 2026)',
        roomType: 'Quad Room (for 2 Pax)',
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

    setVisaTitle('Saudi Electronic Travel Authorisation (ETA)');
    setVisaValidity('2-Year Multiple Entry Visa');
    setVisaEligibility('British Passport Holders');
    setVisaProcessing('Full electronic documentation & support included');

    setPricePerPerson('950.00');
    setPassengerCount(2);
    setTotalPackagePrice('1900.00');
    setPriceIncludes('Includes Return Flights, 9 Nights Hotels, Private Ground Transfers & ETA Visas');

    setImportantTerms(
      'Rates and flight availability are subject to re-confirmation at the time of final booking and payment. British passport validity must be at least 6 months from the departure date. Hotel standard check-in is 16:00 and check-out is 12:00. Non-refundable package terms apply upon ticket issuance.'
    );

    toast.success('Loaded Umrah Sample Quotation!');
    setActiveTab('preview');
  };

  // Smart GDS PNR / Flight Text Converter
  const handleParsePnrText = () => {
    if (!pnrText.trim()) {
      toast.error('Please paste flight PNR or itinerary text');
      return;
    }
    try {
      const text = pnrText.trim();
      // Match flight lines e.g. "RJ 112 Y 09NOV LHR AMM 1605 0005"
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
          
          // Auto-calculate Outbound Transit Layover
          const arrTime = `${matches[0][7].slice(0,2)}:${matches[0][7].slice(2)}`;
          const depTime = `${matches[1][6].slice(0,2)}:${matches[1][6].slice(2)}`;
          const transit = calculateTransitTime(null, arrTime, null, depTime);
          if (transit) {
            setOutboundTransitText(`${transit} Layover at ${matches[0][5]}`);
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

          // Auto-calculate Inbound Transit Layover
          const arrTime = `${matches[2][7].slice(0,2)}:${matches[2][7].slice(2)}`;
          const depTime = `${matches[3][6].slice(0,2)}:${matches[3][6].slice(2)}`;
          const transit = calculateTransitTime(null, arrTime, null, depTime);
          if (transit) {
            setInboundTransitText(`${transit} Layover at ${matches[2][5]}`);
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
      setActiveTab('preview');
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
    } fontFinally: {
      setGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const addHotel = () => {
    setHotels([
      ...hotels,
      {
        name: 'Hotel Name',
        location: 'Location',
        ratingStars: 4,
        ratingLabel: '(4-Star)',
        checkInDate: startDate || '',
        checkOutDate: endDate || '',
        stayDuration: '3 Nights',
        roomType: 'Double Room',
        boardBasis: 'Room Only',
        featureBadge: 'Great Location & Haram Shuttle'
      }
    ]);
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

  return (
    <div className="min-h-screen bg-slate-100 p-3 sm:p-6 font-sans">
      {/* Top Header Controls (Hide on print) */}
      <div className="print:hidden max-w-6xl mx-auto mb-6 bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
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
            <FileText className="w-4 h-4 text-indigo-600" />
            Paste GDS PNR / Flight Text
          </button>

          <button
            onClick={handleLoadUmrahPreset}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-all flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw className="w-4 h-4 text-amber-600" />
            Load Sample Umrah Quotation
          </button>

          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'preview' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Live Quotation
            </button>
            <button
              onClick={() => setActiveTab('editor')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'editor' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" /> Edit Fields
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
            {generatingPdf ? 'Generating PDF...' : 'Save as PDF'}
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
        <div className="print:hidden max-w-6xl mx-auto bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
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
                <div key={item.id} className="border border-slate-200 rounded-xl p-4 hover:shadow-md transition-all flex flex-col justify-between">
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

      {/* EDITOR TAB */}
      {activeTab === 'editor' && (
        <div className="print:hidden max-w-6xl mx-auto bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-primary-600" /> Customize Package Quotation Fields
            </h2>
            <button onClick={() => setActiveTab('preview')} className="text-xs font-bold text-primary-600 hover:underline flex items-center gap-1">
              Switch to Live Preview <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Section 1: Header & Meta */}
          <div>
            <h3 className="text-xs font-black text-primary-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <FileText className="w-4 h-4" /> 1. Header & Quote Meta
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Quote Reference</label>
                <input
                  type="text"
                  value={refNumber}
                  onChange={(e) => setRefNumber(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Quote Date</label>
                <input
                  type="date"
                  value={quoteDate}
                  onChange={(e) => setQuoteDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Prepared For (Passenger Summary)</label>
                <input
                  type="text"
                  value={preparedFor}
                  onChange={(e) => setPreparedFor(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Package Main Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Package Subtitle</label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Passenger Badge Pill</label>
                <input
                  type="text"
                  value={passengerBadge}
                  onChange={(e) => setPassengerBadge(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Summary Metrics */}
          <div>
            <h3 className="text-xs font-black text-primary-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Globe className="w-4 h-4" /> 2. Overview Cards (4 Grid Boxes)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Departure Airport</label>
                <input
                  type="text"
                  value={departureAirport}
                  onChange={(e) => setDepartureAirport(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Travel Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Travel End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Airline Carrier Name</label>
                <input
                  type="text"
                  value={airlineCarrier}
                  onChange={(e) => setAirlineCarrier(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Flight Builder */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-black text-primary-800 uppercase tracking-wider flex items-center gap-1.5">
                <Plane className="w-4 h-4" /> 3. Flight Itinerary Builder
              </h3>
              <button
                onClick={() => setShowPnrModal(true)}
                className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-lg hover:bg-indigo-100 flex items-center gap-1"
              >
                <FileText className="w-3.5 h-3.5" /> Auto-Fill via GDS PNR
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
              {/* Outbound */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs text-primary-900 uppercase flex items-center gap-1">
                  <Plane className="w-3.5 h-3.5 text-blue-700" /> Outbound Flight Details
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Route (e.g. LHR ➔ JED)"
                    value={outboundRoute}
                    onChange={(e) => setOutboundRoute(e.target.value)}
                    className="border rounded-lg px-3 py-1.5 text-xs font-bold"
                  />
                  <input
                    type="date"
                    value={outboundDepDate}
                    onChange={(e) => setOutboundDepDate(e.target.value)}
                    className="border rounded-lg px-3 py-1.5 text-xs"
                  />
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
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

                <input
                  type="text"
                  placeholder="Transit Badge (e.g. Transit in Amman (AMM): 1 hr 30 mins)"
                  value={outboundTransitText}
                  onChange={(e) => setOutboundTransitText(e.target.value)}
                  className="w-full border rounded-lg px-3 py-1.5 text-xs text-blue-900 font-semibold bg-blue-50/50"
                />

                <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
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

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Arrival Note"
                    value={outboundArrivalNote}
                    onChange={(e) => setOutboundArrivalNote(e.target.value)}
                    className="border rounded-lg px-3 py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Baggage Note"
                    value={outboundBaggage}
                    onChange={(e) => setOutboundBaggage(e.target.value)}
                    className="border rounded-lg px-3 py-1.5 text-xs"
                  />
                </div>
              </div>

              {/* Inbound */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs text-primary-900 uppercase flex items-center gap-1">
                  <Plane className="w-3.5 h-3.5 text-blue-700" /> Inbound Flight Details
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Route (e.g. MED ➔ LHR)"
                    value={inboundRoute}
                    onChange={(e) => setInboundRoute(e.target.value)}
                    className="border rounded-lg px-3 py-1.5 text-xs font-bold"
                  />
                  <input
                    type="date"
                    value={inboundDepDate}
                    onChange={(e) => setInboundDepDate(e.target.value)}
                    className="border rounded-lg px-3 py-1.5 text-xs"
                  />
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
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

                <input
                  type="text"
                  placeholder="Transit Badge (e.g. Transit in Amman (AMM): 3 hrs 00 mins)"
                  value={inboundTransitText}
                  onChange={(e) => setInboundTransitText(e.target.value)}
                  className="w-full border rounded-lg px-3 py-1.5 text-xs text-blue-900 font-semibold bg-blue-50/50"
                />

                <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
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

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Arrival Note"
                    value={inboundArrivalNote}
                    onChange={(e) => setInboundArrivalNote(e.target.value)}
                    className="border rounded-lg px-3 py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Baggage Note"
                    value={inboundBaggage}
                    onChange={(e) => setInboundBaggage(e.target.value)}
                    className="border rounded-lg px-3 py-1.5 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Hotels */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-black text-primary-800 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-4 h-4" /> 4. Hotel Accommodations Builder
              </h3>
              <button
                onClick={addHotel}
                className="px-2.5 py-1 bg-primary-50 text-primary-700 text-xs font-bold rounded-lg border border-primary-200 hover:bg-primary-100 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Hotel
              </button>
            </div>

            <div className="space-y-4">
              {hotels.map((hotel, idx) => (
                <div key={idx} className="p-4 border border-slate-200 rounded-xl bg-slate-50 relative space-y-3">
                  <button
                    onClick={() => removeHotel(idx)}
                    className="absolute top-3 right-3 text-slate-400 hover:text-red-600 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Hotel Name</label>
                      <input
                        type="text"
                        value={hotel.name}
                        onChange={(e) => {
                          const updated = [...hotels];
                          updated[idx].name = e.target.value;
                          setHotels(updated);
                        }}
                        className="w-full border rounded-lg px-3 py-1.5 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">City / Location</label>
                      <input
                        type="text"
                        value={hotel.location}
                        onChange={(e) => {
                          const updated = [...hotels];
                          updated[idx].location = e.target.value;
                          setHotels(updated);
                        }}
                        className="w-full border rounded-lg px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Star Rating</label>
                      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => {
                              const updated = [...hotels];
                              updated[idx].ratingStars = s;
                              updated[idx].ratingLabel = `(${s}-Star)`;
                              setHotels(updated);
                            }}
                            className="p-0.5"
                          >
                            <Star className={`w-4 h-4 ${s <= hotel.ratingStars ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                          </button>
                        ))}
                        <input
                          type="text"
                          value={hotel.ratingLabel}
                          onChange={(e) => {
                            const updated = [...hotels];
                            updated[idx].ratingLabel = e.target.value;
                            setHotels(updated);
                          }}
                          className="w-20 text-[11px] font-bold border-l pl-2 ml-1 border-slate-200 text-slate-700 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Check-in Date</label>
                      <input
                        type="date"
                        value={hotel.checkInDate}
                        onChange={(e) => {
                          const updated = [...hotels];
                          updated[idx].checkInDate = e.target.value;
                          setHotels(updated);
                        }}
                        className="w-full border rounded-lg px-3 py-1.5 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Check-out Date</label>
                      <input
                        type="date"
                        value={hotel.checkOutDate}
                        onChange={(e) => {
                          const updated = [...hotels];
                          updated[idx].checkOutDate = e.target.value;
                          setHotels(updated);
                        }}
                        className="w-full border rounded-lg px-3 py-1.5 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Stay Duration Label</label>
                      <input
                        type="text"
                        value={hotel.stayDuration}
                        onChange={(e) => {
                          const updated = [...hotels];
                          updated[idx].stayDuration = e.target.value;
                          setHotels(updated);
                        }}
                        className="w-full border rounded-lg px-3 py-1.5 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Room Type</label>
                      <input
                        type="text"
                        value={hotel.roomType}
                        onChange={(e) => {
                          const updated = [...hotels];
                          updated[idx].roomType = e.target.value;
                          setHotels(updated);
                        }}
                        className="w-full border rounded-lg px-3 py-1.5 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Board Basis</label>
                      <input
                        type="text"
                        value={hotel.boardBasis}
                        onChange={(e) => {
                          const updated = [...hotels];
                          updated[idx].boardBasis = e.target.value;
                          setHotels(updated);
                        }}
                        className="w-full border rounded-lg px-3 py-1.5 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Feature Highlight Badge</label>
                      <input
                        type="text"
                        value={hotel.featureBadge}
                        onChange={(e) => {
                          const updated = [...hotels];
                          updated[idx].featureBadge = e.target.value;
                          setHotels(updated);
                        }}
                        className="w-full border rounded-lg px-3 py-1.5 text-xs text-emerald-800 font-semibold"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: Transfers & Visa */}
          <div>
            <h3 className="text-xs font-black text-primary-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Car className="w-4 h-4" /> 5. Transfers & Visa Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="space-y-3">
                <h4 className="font-bold text-xs text-primary-900 uppercase">Ground Transfers Circuit</h4>
                <input
                  type="text"
                  value={transferTitle}
                  onChange={(e) => setTransferTitle(e.target.value)}
                  className="w-full border rounded-lg px-3 py-1.5 text-xs font-bold"
                />
                <div className="space-y-2">
                  {transferSectors.map((sec, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={sec.label}
                        onChange={(e) => {
                          const updated = [...transferSectors];
                          updated[i].label = e.target.value;
                          setTransferSectors(updated);
                        }}
                        className="flex-1 border rounded-lg px-3 py-1 text-xs"
                      />
                      <button onClick={() => removeSector(i)} className="text-slate-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button onClick={addSector} className="text-xs font-bold text-primary-600 hover:underline">
                    + Add Transfer Sector
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-xs text-primary-900 uppercase">Visa Authorisation</h4>
                <input
                  type="text"
                  value={visaTitle}
                  onChange={(e) => setVisaTitle(e.target.value)}
                  className="w-full border rounded-lg px-3 py-1.5 text-xs font-bold"
                />
                <input
                  type="text"
                  placeholder="Validity"
                  value={visaValidity}
                  onChange={(e) => setVisaValidity(e.target.value)}
                  className="w-full border rounded-lg px-3 py-1.5 text-xs"
                />
                <input
                  type="text"
                  placeholder="Eligibility"
                  value={visaEligibility}
                  onChange={(e) => setVisaEligibility(e.target.value)}
                  className="w-full border rounded-lg px-3 py-1.5 text-xs"
                />
                <input
                  type="text"
                  placeholder="Processing details"
                  value={visaProcessing}
                  onChange={(e) => setVisaProcessing(e.target.value)}
                  className="w-full border rounded-lg px-3 py-1.5 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 6: Pricing & Terms */}
          <div>
            <h3 className="text-xs font-black text-primary-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Tag className="w-4 h-4" /> 6. Pricing & Booking Terms
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Price Per Person (£)</label>
                <input
                  type="number"
                  value={pricePerPerson}
                  onChange={(e) => setPricePerPerson(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-emerald-800 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Passenger Count</label>
                <input
                  type="number"
                  value={passengerCount}
                  onChange={(e) => setPassengerCount(parseInt(e.target.value) || 1)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Total Package Price (£)</label>
                <input
                  type="number"
                  value={totalPackagePrice}
                  onChange={(e) => setTotalPackagePrice(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-extrabold text-emerald-900 outline-none"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Price Includes Text</label>
                <input
                  type="text"
                  value={priceIncludes}
                  onChange={(e) => setPriceIncludes(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Important Booking Terms</label>
                <textarea
                  rows={3}
                  value={importantTerms}
                  onChange={(e) => setImportantTerms(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-3 text-xs font-medium outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIVE QUOTATION PREVIEW & PRINTABLE DOCUMENT */}
      {(activeTab === 'preview' || activeTab === 'editor') && (
        <div className="max-w-4xl mx-auto">
          {/* Document Container matching PDF screenshot exact styling */}
          <div 
            ref={printRef}
            className="bg-white text-slate-900 p-8 sm:p-10 shadow-2xl rounded-none md:rounded-xl border border-slate-200 relative print:p-0 print:border-none print:shadow-none print:m-0 font-sans"
            style={{ minHeight: '1050px' }}
          >
            {/* Header: Company Logo & Quote Reference */}
            <div className="flex justify-between items-start border-b border-blue-600/30 pb-4 mb-6">
              <div>
                {companyInfo.logoPrimary ? (
                  <img src={companyInfo.logoPrimary} alt={companyInfo.companyName} className="h-10 object-contain mb-1" />
                ) : (
                  <div className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                    <Globe className="w-6 h-6 text-blue-900" />
                    <span>{companyInfo.companyName || 'Tooba Travels'}</span>
                  </div>
                )}
                {companyInfo.officeAddress && (
                  <p className="text-[10px] text-slate-500 font-medium">{companyInfo.officeAddress}</p>
                )}
              </div>

              <div className="text-right">
                <div className="inline-block bg-slate-900 text-white font-extrabold text-xs px-3 py-1 rounded-md tracking-wider">
                  {refNumber}
                </div>
                <div className="text-[11px] font-semibold text-slate-600 mt-1.5">
                  <span className="font-bold text-slate-800">Date:</span> {quoteDate}
                </div>
                <div className="text-[11px] font-semibold text-slate-600">
                  <span className="font-bold text-slate-800">Prepared For:</span> {preparedFor}
                </div>
              </div>
            </div>

            {/* Main Package Banner */}
            <div className="bg-gradient-to-r from-[#0d1b3e] to-[#12285a] text-white rounded-xl p-5 mb-6 flex justify-between items-center shadow-md">
              <div>
                <h1 className="text-xl font-black tracking-wide uppercase">{title}</h1>
                <p className="text-xs font-semibold text-blue-200 mt-0.5">{subtitle}</p>
              </div>
              <div className="bg-blue-950/80 border border-blue-400/40 text-blue-100 px-3.5 py-2 rounded-lg text-xs font-bold text-center leading-tight">
                {passengerBadge.split('•').map((part, i) => (
                  <div key={i}>{part.trim()}</div>
                ))}
              </div>
            </div>

            {/* Overview Summary 4-Grid Cards */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              <div className="bg-blue-50/50 border border-blue-200/60 rounded-xl p-3 text-center">
                <span className="block text-[9px] font-extrabold text-blue-900 uppercase tracking-wider mb-1">DEPARTURE AIRPORT</span>
                <span className="block text-xs font-black text-slate-900">{departureAirport}</span>
              </div>

              <div className="bg-blue-50/50 border border-blue-200/60 rounded-xl p-3 text-center">
                <span className="block text-[9px] font-extrabold text-blue-900 uppercase tracking-wider mb-1">TRAVEL DATES</span>
                <span className="block text-xs font-black text-slate-900">{travelDatesText}</span>
              </div>

              <div className="bg-blue-50/50 border border-blue-200/60 rounded-xl p-3 text-center">
                <span className="block text-[9px] font-extrabold text-blue-900 uppercase tracking-wider mb-1">TOTAL DURATION</span>
                <span className="block text-xs font-black text-slate-900">{totalDurationText}</span>
              </div>

              <div className="bg-blue-50/50 border border-blue-200/60 rounded-xl p-3 text-center">
                <span className="block text-[9px] font-extrabold text-blue-900 uppercase tracking-wider mb-1">AIRLINE CARRIER</span>
                <span className="block text-xs font-black text-slate-900">{airlineCarrier}</span>
              </div>
            </div>

            {/* Flight Itinerary Section */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Plane className="w-4 h-4 text-blue-800" />
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">Flight Itinerary</h2>
                <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {flightClass}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Outbound */}
                <div className="border border-blue-200 rounded-xl p-3.5 bg-blue-50/20">
                  <div className="flex justify-between items-center border-b border-blue-100 pb-2 mb-2">
                    <span className="text-xs font-black text-blue-950 flex items-center gap-1">
                      Outbound: {outboundRoute}
                    </span>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100/60 px-2 py-0.5 rounded">
                      {outboundDateText}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between font-bold text-slate-800">
                      <span>{outboundLeg1No} • {outboundLeg1Craft}</span>
                      <span>{outboundLeg1Dep} ➔ {outboundLeg1Arr}</span>
                    </div>

                    {outboundTransitText && (
                      <div className="bg-blue-100/60 text-blue-900 text-[10px] font-bold py-1 px-2 rounded text-center my-1">
                        {outboundTransitText}
                      </div>
                    )}

                    <div className="flex justify-between font-bold text-slate-800">
                      <span>{outboundLeg2No} • {outboundLeg2Craft}</span>
                      <span>{outboundLeg2Dep} ➔ {outboundLeg2Arr}</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-blue-100 flex justify-between items-center text-[10px] text-slate-500 font-semibold">
                    <span>{outboundArrivalNote}</span>
                    <span>{outboundBaggage}</span>
                  </div>
                </div>

                {/* Inbound */}
                <div className="border border-blue-200 rounded-xl p-3.5 bg-blue-50/20">
                  <div className="flex justify-between items-center border-b border-blue-100 pb-2 mb-2">
                    <span className="text-xs font-black text-blue-950 flex items-center gap-1">
                      Inbound: {inboundRoute}
                    </span>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100/60 px-2 py-0.5 rounded">
                      {inboundDateText}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between font-bold text-slate-800">
                      <span>{inboundLeg1No} • {inboundLeg1Craft}</span>
                      <span>{inboundLeg1Dep} ➔ {inboundLeg1Arr}</span>
                    </div>

                    {inboundTransitText && (
                      <div className="bg-blue-100/60 text-blue-900 text-[10px] font-bold py-1 px-2 rounded text-center my-1">
                        {inboundTransitText}
                      </div>
                    )}

                    <div className="flex justify-between font-bold text-slate-800">
                      <span>{inboundLeg2No} • {inboundLeg2Craft}</span>
                      <span>{inboundLeg2Dep} ➔ {inboundLeg2Arr}</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-blue-100 flex justify-between items-center text-[10px] text-slate-500 font-semibold">
                    <span>{inboundArrivalNote}</span>
                    <span>{inboundBaggage}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Hotel Accommodations Section */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-blue-800" />
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">Hotel Accommodations</h2>
                <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {hotelStaySummaryBadge}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {hotels.map((h, i) => (
                  <div key={i} className="border border-blue-200 rounded-xl p-3.5 bg-blue-50/20 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <h3 className="font-black text-slate-900 text-xs">{h.name}</h3>
                          <p className="text-[10px] text-slate-500 font-semibold">{h.location}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {renderStars(h.ratingStars)}
                          <span className="text-[10px] font-bold text-amber-700 ml-1">{h.ratingLabel}</span>
                        </div>
                      </div>

                      <div className="space-y-1 my-2 text-[11px]">
                        <div className="flex justify-between text-slate-600">
                          <span className="font-semibold text-slate-500">Stay Duration:</span>
                          <span className="font-bold text-slate-900">{h.stayDuration}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span className="font-semibold text-slate-500">Room Type:</span>
                          <span className="font-bold text-slate-900">{h.roomType}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span className="font-semibold text-slate-500">Board Basis:</span>
                          <span className="font-bold text-slate-900">{h.boardBasis}</span>
                        </div>
                      </div>
                    </div>

                    {h.featureBadge && (
                      <div className="mt-2 pt-2 border-t border-blue-100">
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>{h.featureBadge}</span>
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Ground Transfers & Visa Authorisation Section */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Car className="w-4 h-4 text-blue-800" />
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">Ground Transfers & Visa Authorisation</h2>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Ground Transfers */}
                <div className="border border-blue-200 rounded-xl p-3.5 bg-blue-50/20">
                  <h3 className="font-bold text-xs text-blue-950 mb-2 flex items-center gap-1.5">
                    <Car className="w-3.5 h-3.5 text-blue-700" /> {transferTitle}
                  </h3>
                  <ul className="space-y-1.5 text-[10px] text-slate-700 font-semibold">
                    {transferSectors.map((sec, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-700 inline-block mt-1 shrink-0" />
                        <span>{sec.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Visa */}
                <div className="border border-blue-200 rounded-xl p-3.5 bg-blue-50/20">
                  <h3 className="font-bold text-xs text-blue-950 mb-2 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-700" /> {visaTitle}
                  </h3>
                  <ul className="space-y-1.5 text-[10px] text-slate-700 font-semibold">
                    <li className="flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-700 inline-block mt-1 shrink-0" />
                      <span><strong className="text-slate-900">Validity:</strong> {visaValidity}</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-700 inline-block mt-1 shrink-0" />
                      <span><strong className="text-slate-900">Eligibility:</strong> {visaEligibility}</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-700 inline-block mt-1 shrink-0" />
                      <span><strong className="text-slate-900">Processing:</strong> {visaProcessing}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Price Banner */}
            <div className="bg-gradient-to-r from-[#0d1b3e] to-[#12285a] text-white rounded-xl p-4 mb-6 flex justify-between items-center shadow-lg">
              <div>
                <h3 className="text-sm font-black tracking-wider uppercase">ALL-INCLUSIVE PACKAGE PRICE</h3>
                <p className="text-[11px] font-semibold text-blue-200 mt-0.5">{priceIncludes}</p>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <span className="block text-[9px] font-extrabold text-blue-300 uppercase tracking-wider">PRICE PER PERSON</span>
                  <span className="text-lg font-black text-white">£{parseFloat(pricePerPerson || '0').toFixed(2)}</span>
                </div>

                <div className="text-right pl-6 border-l border-blue-400/30">
                  <span className="block text-[9px] font-extrabold text-blue-300 uppercase tracking-wider">TOTAL PACKAGE ({passengerCount} PAX)</span>
                  <span className="text-2xl font-black text-blue-300">£{parseFloat(totalPackagePrice || '0').toFixed(2)}</span>
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
              <FileText className="w-5 h-5 text-indigo-600" /> Smart GDS PNR / Flight Text Converter
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
