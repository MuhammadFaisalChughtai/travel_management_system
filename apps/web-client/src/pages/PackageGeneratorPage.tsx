import { useState, useEffect, useRef } from 'react';
import { 
  Printer, Save, Sparkles, Plus, Trash2, Plane, 
  Building2, Car, ShieldCheck, RefreshCw, FileText, Globe
} from 'lucide-react';
import { api } from '../api/axios';
import { useAuthStore } from '../store/authStore';
import { toast } from 'react-hot-toast';

interface HotelItem {
  name: string;
  location: string;
  rating: string;
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
  const [savedPackages, setSavedPackages] = useState<any[]>([]);

  // Company / Tenant Context
  const [companyInfo, setCompanyInfo] = useState({
    companyName: 'Tooba Travels',
    logoPrimary: '',
    officeAddress: '',
    emailSender: '',
    landlineFormat: ''
  });

  // Quotation State
  const [quoteId, setQuoteId] = useState<number | null>(null);
  const [refNumber, setRefNumber] = useState('REF: TT-UMR-950');
  const [quoteDate, setQuoteDate] = useState('13 September 2026');
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

  // Outbound Flight
  const [outboundTitle, setOutboundTitle] = useState('Outbound: LHR ➔ JED');
  const [outboundDate, setOutboundDate] = useState('Mon, 09 Nov 2026');
  const [outboundLeg1Flight, setOutboundLeg1Flight] = useState('RJ 112 • Boeing 787-9');
  const [outboundLeg1Time, setOutboundLeg1Time] = useState('16:05 LHR (T3) ➔ 00:05 AMM (+1)');
  const [outboundTransit, setOutboundTransit] = useState('Transit in Amman (AMM): 1 hr 30 mins');
  const [outboundLeg2Flight, setOutboundLeg2Flight] = useState('RJ 704 • Boeing 787');
  const [outboundLeg2Time, setOutboundLeg2Time] = useState('01:35 AMM ➔ 03:45 JED (T1)');
  const [outboundArrivalNote, setOutboundArrivalNote] = useState('Arrival: Tue, 10 Nov (03:45)');
  const [outboundBaggage, setOutboundBaggage] = useState('Baggage: 1x 23kg + Cabin Bag (pp)');

  // Inbound Flight
  const [inboundTitle, setInboundTitle] = useState('Inbound: MED ➔ LHR');
  const [inboundDate, setInboundDate] = useState('Thu, 19 Nov 2026');
  const [inboundLeg1Flight, setInboundLeg1Flight] = useState('RJ 723 • Boeing 787-8');
  const [inboundLeg1Time, setInboundLeg1Time] = useState('07:00 MED ➔ 08:55 AMM');
  const [inboundTransit, setInboundTransit] = useState('Transit in Amman (AMM): 3 hrs 00 mins');
  const [inboundLeg2Flight, setInboundLeg2Flight] = useState('RJ 111 • Boeing 787-9');
  const [inboundLeg2Time, setInboundLeg2Time] = useState('11:55 AMM ➔ 14:20 LHR (T3)');
  const [inboundArrivalNote, setInboundArrivalNote] = useState('Arrival: Thu, 19 Nov (14:20)');
  const [inboundBaggage, setInboundBaggage] = useState('Baggage: 1x 23kg + Cabin Bag (pp)');

  // Hotels
  const [hotelStaySummaryBadge, setHotelStaySummaryBadge] = useState('9 Nights Total Stay');
  const [hotels, setHotels] = useState<HotelItem[]>([
    {
      name: 'voco Makkah',
      location: 'Makkah Al-Mukarramah',
      rating: '★★★★ (4-Star)',
      stayDuration: '5 Nights (10 Nov – 15 Nov 2026)',
      roomType: 'Quad Room (for 2 Pax)',
      boardBasis: 'Room Only',
      featureBadge: '✔ 24/7 Dedicated Haram Shuttle Bus Service'
    },
    {
      name: 'Millennium Taiba Hotel',
      location: 'Madinah Al-Munawwarah',
      rating: '★★★★★ (Luxury)',
      stayDuration: '4 Nights (15 Nov – 19 Nov 2026)',
      roomType: 'Superior Room King Bed (City View)',
      boardBasis: 'Room Only',
      featureBadge: '✔ Steps from Al-Masjid an-Nabawi Courtyard'
    }
  ]);

  // Transfers & Visa
  const [transferTitle, setTransferTitle] = useState('Private AC Vehicle Circuit');
  const [transferSectors, setTransferSectors] = useState<SectorItem[]>([
    { label: 'Jeddah Airport (JED) ➔ voco Makkah Hotel' },
    { label: 'Makkah Hotel ➔ Millennium Taiba Madinah' },
    { label: 'Millennium Taiba Madinah ➔ Madinah Airport (MED)' }
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

  // Fetch company context & saved packages
  useEffect(() => {
    fetchCompanyContext();
    fetchSavedPackages();
  }, []);

  // Auto calculate dates and total package price
  useEffect(() => {
    if (startDate && endDate) {
      try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 0) {
          setTotalDurationText(`${diffDays + 1} Days / ${diffDays} Nights`);
          setHotelStaySummaryBadge(`${diffDays} Nights Total Stay`);
        }
        
        const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
        const startFmt = start.toLocaleDateString('en-GB', options);
        const endFmt = end.toLocaleDateString('en-GB', options);
        setTravelDatesText(`${startFmt} – ${endFmt}`);
      } catch (e) {}
    }
  }, [startDate, endDate]);

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
    setQuoteDate('13 September 2026');
    setPreparedFor('2 Adults (British Passports)');
    setTitle('UMRAH PACKAGE QUOTATION');
    setSubtitle('10 Days / 9 Nights Tailored Spiritual Journey');
    setPassengerBadge('2 Passengers • British Citizens');
    
    setDepartureAirport('London Heathrow (LHR)');
    setStartDate('2026-11-09');
    setEndDate('2026-11-19');
    setTravelDatesText('09 Nov – 19 Nov 2026');
    setTotalDurationText('10 Days / 9 Nights');
    setAirlineCarrier('Royal Jordanian');
    setFlightClass('Royal Jordanian • Economy Class');

    setOutboundTitle('Outbound: LHR ➔ JED');
    setOutboundDate('Mon, 09 Nov 2026');
    setOutboundLeg1Flight('RJ 112 • Boeing 787-9');
    setOutboundLeg1Time('16:05 LHR (T3) ➔ 00:05 AMM (+1)');
    setOutboundTransit('Transit in Amman (AMM): 1 hr 30 mins');
    setOutboundLeg2Flight('RJ 704 • Boeing 787');
    setOutboundLeg2Time('01:35 AMM ➔ 03:45 JED (T1)');
    setOutboundArrivalNote('Arrival: Tue, 10 Nov (03:45)');
    setOutboundBaggage('Baggage: 1x 23kg + Cabin Bag (pp)');

    setInboundTitle('Inbound: MED ➔ LHR');
    setInboundDate('Thu, 19 Nov 2026');
    setInboundLeg1Flight('RJ 723 • Boeing 787-8');
    setInboundLeg1Time('07:00 MED ➔ 08:55 AMM');
    setInboundTransit('Transit in Amman (AMM): 3 hrs 00 mins');
    setInboundLeg2Flight('RJ 111 • Boeing 787-9');
    setInboundLeg2Time('11:55 AMM ➔ 14:20 LHR (T3)');
    setInboundArrivalNote('Arrival: Thu, 19 Nov (14:20)');
    setInboundBaggage('Baggage: 1x 23kg + Cabin Bag (pp)');

    setHotelStaySummaryBadge('9 Nights Total Stay');
    setHotels([
      {
        name: 'voco Makkah',
        location: 'Makkah Al-Mukarramah',
        rating: '★★★★ (4-Star)',
        stayDuration: '5 Nights (10 Nov – 15 Nov 2026)',
        roomType: 'Quad Room (for 2 Pax)',
        boardBasis: 'Room Only',
        featureBadge: '✔ 24/7 Dedicated Haram Shuttle Bus Service'
      },
      {
        name: 'Millennium Taiba Hotel',
        location: 'Madinah Al-Munawwarah',
        rating: '★★★★★ (Luxury)',
        stayDuration: '4 Nights (15 Nov – 19 Nov 2026)',
        roomType: 'Superior Room King Bed (City View)',
        boardBasis: 'Room Only',
        featureBadge: '✔ Steps from Al-Masjid an-Nabawi Courtyard'
      }
    ]);

    setTransferTitle('Private AC Vehicle Circuit');
    setTransferSectors([
      { label: 'Jeddah Airport (JED) ➔ voco Makkah Hotel' },
      { label: 'Makkah Hotel ➔ Millennium Taiba Madinah' },
      { label: 'Millennium Taiba Madinah ➔ Madinah Airport (MED)' }
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

    toast.success('Loaded Umrah Quotation Sample Preset!');
    setActiveTab('preview');
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
          title: outboundTitle,
          date: outboundDate,
          leg1Flight: outboundLeg1Flight,
          leg1Time: outboundLeg1Time,
          transit: outboundTransit,
          leg2Flight: outboundLeg2Flight,
          leg2Time: outboundLeg2Time,
          arrivalNote: outboundArrivalNote,
          baggage: outboundBaggage
        },
        flightInboundJson: {
          title: inboundTitle,
          date: inboundDate,
          leg1Flight: inboundLeg1Flight,
          leg1Time: inboundLeg1Time,
          transit: inboundTransit,
          leg2Flight: inboundLeg2Flight,
          leg2Time: inboundLeg2Time,
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
      setQuoteDate(new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }));
      setPreparedFor(item.preparedFor || '');
      setTitle(item.title || 'UMRAH PACKAGE QUOTATION');
      setSubtitle(item.subtitle || '');
      setPassengerBadge(item.passengerBadge || '');

      setDepartureAirport(item.departureAirport || '');
      setTravelDatesText(item.travelDates || '');
      setTotalDurationText(item.totalDuration || '');
      setAirlineCarrier(item.airlineCarrier || '');
      setFlightClass(item.flightClass || '');

      if (item.flightOutboundJson) {
        const out = typeof item.flightOutboundJson === 'string' ? JSON.parse(item.flightOutboundJson) : item.flightOutboundJson;
        setOutboundTitle(out.title || '');
        setOutboundDate(out.date || '');
        setOutboundLeg1Flight(out.leg1Flight || '');
        setOutboundLeg1Time(out.leg1Time || '');
        setOutboundTransit(out.transit || '');
        setOutboundLeg2Flight(out.leg2Flight || '');
        setOutboundLeg2Time(out.leg2Time || '');
        setOutboundArrivalNote(out.arrivalNote || '');
        setOutboundBaggage(out.baggage || '');
      }

      if (item.flightInboundJson) {
        const inb = typeof item.flightInboundJson === 'string' ? JSON.parse(item.flightInboundJson) : item.flightInboundJson;
        setInboundTitle(inb.title || '');
        setInboundDate(inb.date || '');
        setInboundLeg1Flight(inb.leg1Flight || '');
        setInboundLeg1Time(inb.leg1Time || '');
        setInboundTransit(inb.transit || '');
        setInboundLeg2Flight(inb.leg2Flight || '');
        setInboundLeg2Time(inb.leg2Time || '');
        setInboundArrivalNote(inb.arrivalNote || '');
        setInboundBaggage(inb.baggage || '');
      }

      if (item.hotelsJson) {
        const h = typeof item.hotelsJson === 'string' ? JSON.parse(item.hotelsJson) : item.hotelsJson;
        if (Array.isArray(h)) setHotels(h);
      }

      if (item.transfersJson) {
        const tr = typeof item.transfersJson === 'string' ? JSON.parse(item.transfersJson) : item.transfersJson;
        setTransferTitle(tr.title || '');
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

      toast.success(`Loaded quotation ${item.referenceNumber}`);
      setActiveTab('preview');
    } catch (err) {
      console.error(err);
      toast.error('Failed to parse package data');
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

  const handlePrint = () => {
    window.print();
  };

  const addHotel = () => {
    setHotels([
      ...hotels,
      {
        name: 'Hotel Name',
        location: 'Location',
        rating: '★★★★ (4-Star)',
        stayDuration: '3 Nights',
        roomType: 'Double Room',
        boardBasis: 'Room Only',
        featureBadge: '✔ Great Location'
      }
    ]);
  };

  const removeHotel = (index: number) => {
    setHotels(hotels.filter((_, i) => i !== index));
  };

  const addSector = () => {
    setTransferSectors([...transferSectors, { label: 'New Transfer Sector' }]);
  };

  const removeSector = (index: number) => {
    setTransferSectors(transferSectors.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-slate-100 p-3 sm:p-6 font-sans">
      {/* Top Header Controls (Hide on print) */}
      <div className="print:hidden max-w-6xl mx-auto mb-6 bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-500" />
            Umrah & Holiday Package Quotation Builder
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            Logged in as <span className="text-primary-700 font-bold">{user?.name || user?.email}</span> • {companyInfo.companyName}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleLoadUmrahPreset}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-all flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw className="w-4 h-4 text-amber-600" />
            Load Sample Umrah Quotation
          </button>

          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'preview' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📄 Live Quotation
            </button>
            <button
              onClick={() => setActiveTab('editor')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'editor' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ✏️ Edit Fields
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'saved' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📁 Saved ({savedPackages.length})
            </button>
          </div>

          <button
            onClick={handleSavePackage}
            disabled={saving}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : quoteId ? 'Update Package' : 'Save Package'}
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            Print / Export PDF
          </button>
        </div>
      </div>

      {/* SAVED PACKAGES TAB */}
      {activeTab === 'saved' && (
        <div className="print:hidden max-w-6xl mx-auto bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-600" /> Saved Package Quotations
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
            <h2 className="text-lg font-bold text-slate-800">Customize Quotation Fields</h2>
            <button onClick={() => setActiveTab('preview')} className="text-xs font-bold text-primary-600 hover:underline">
              Switch to Live Preview →
            </button>
          </div>

          {/* Section 1: Header & Meta */}
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-3 text-primary-800">1. Header & Quote Meta</h3>
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
                  type="text"
                  value={quoteDate}
                  onChange={(e) => setQuoteDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Prepared For</label>
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
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-3 text-primary-800">2. Overview Cards (4 Grid Boxes)</h3>
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
                <label className="block text-xs font-bold text-slate-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Airline Carrier</label>
                <input
                  type="text"
                  value={airlineCarrier}
                  onChange={(e) => setAirlineCarrier(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Flights */}
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-3 text-primary-800">3. Flight Itinerary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
              {/* Outbound */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs text-primary-900 uppercase">Outbound Flight Details</h4>
                <input
                  type="text"
                  placeholder="Outbound Title"
                  value={outboundTitle}
                  onChange={(e) => setOutboundTitle(e.target.value)}
                  className="w-full border rounded-lg px-3 py-1.5 text-xs"
                />
                <input
                  type="text"
                  placeholder="Outbound Date"
                  value={outboundDate}
                  onChange={(e) => setOutboundDate(e.target.value)}
                  className="w-full border rounded-lg px-3 py-1.5 text-xs"
                />
                <input
                  type="text"
                  placeholder="Leg 1 Flight"
                  value={outboundLeg1Flight}
                  onChange={(e) => setOutboundLeg1Flight(e.target.value)}
                  className="w-full border rounded-lg px-3 py-1.5 text-xs"
                />
                <input
                  type="text"
                  placeholder="Leg 1 Route & Times"
                  value={outboundLeg1Time}
                  onChange={(e) => setOutboundLeg1Time(e.target.value)}
                  className="w-full border rounded-lg px-3 py-1.5 text-xs"
                />
                <input
                  type="text"
                  placeholder="Transit Badge"
                  value={outboundTransit}
                  onChange={(e) => setOutboundTransit(e.target.value)}
                  className="w-full border rounded-lg px-3 py-1.5 text-xs"
                />
                <input
                  type="text"
                  placeholder="Leg 2 Flight"
                  value={outboundLeg2Flight}
                  onChange={(e) => setOutboundLeg2Flight(e.target.value)}
                  className="w-full border rounded-lg px-3 py-1.5 text-xs"
                />
                <input
                  type="text"
                  placeholder="Leg 2 Route & Times"
                  value={outboundLeg2Time}
                  onChange={(e) => setOutboundLeg2Time(e.target.value)}
                  className="w-full border rounded-lg px-3 py-1.5 text-xs"
                />
                <input
                  type="text"
                  placeholder="Arrival Note"
                  value={outboundArrivalNote}
                  onChange={(e) => setOutboundArrivalNote(e.target.value)}
                  className="w-full border rounded-lg px-3 py-1.5 text-xs"
                />
                <input
                  type="text"
                  placeholder="Baggage Note"
                  value={outboundBaggage}
                  onChange={(e) => setOutboundBaggage(e.target.value)}
                  className="w-full border rounded-lg px-3 py-1.5 text-xs"
                />
              </div>

              {/* Inbound */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs text-primary-900 uppercase">Inbound Flight Details</h4>
                <input
                  type="text"
                  placeholder="Inbound Title"
                  value={inboundTitle}
                  onChange={(e) => setInboundTitle(e.target.value)}
                  className="w-full border rounded-lg px-3 py-1.5 text-xs"
                />
                <input
                  type="text"
                  placeholder="Inbound Date"
                  value={inboundDate}
                  onChange={(e) => setInboundDate(e.target.value)}
                  className="w-full border rounded-lg px-3 py-1.5 text-xs"
                />
                <input
                  type="text"
                  placeholder="Leg 1 Flight"
                  value={inboundLeg1Flight}
                  onChange={(e) => setInboundLeg1Flight(e.target.value)}
                  className="w-full border rounded-lg px-3 py-1.5 text-xs"
                />
                <input
                  type="text"
                  placeholder="Leg 1 Route & Times"
                  value={inboundLeg1Time}
                  onChange={(e) => setInboundLeg1Time(e.target.value)}
                  className="w-full border rounded-lg px-3 py-1.5 text-xs"
                />
                <input
                  type="text"
                  placeholder="Transit Badge"
                  value={inboundTransit}
                  onChange={(e) => setInboundTransit(e.target.value)}
                  className="w-full border rounded-lg px-3 py-1.5 text-xs"
                />
                <input
                  type="text"
                  placeholder="Leg 2 Flight"
                  value={inboundLeg2Flight}
                  onChange={(e) => setInboundLeg2Flight(e.target.value)}
                  className="w-full border rounded-lg px-3 py-1.5 text-xs"
                />
                <input
                  type="text"
                  placeholder="Leg 2 Route & Times"
                  value={inboundLeg2Time}
                  onChange={(e) => setInboundLeg2Time(e.target.value)}
                  className="w-full border rounded-lg px-3 py-1.5 text-xs"
                />
                <input
                  type="text"
                  placeholder="Arrival Note"
                  value={inboundArrivalNote}
                  onChange={(e) => setInboundArrivalNote(e.target.value)}
                  className="w-full border rounded-lg px-3 py-1.5 text-xs"
                />
                <input
                  type="text"
                  placeholder="Baggage Note"
                  value={inboundBaggage}
                  onChange={(e) => setInboundBaggage(e.target.value)}
                  className="w-full border rounded-lg px-3 py-1.5 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Hotels */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider text-primary-800">4. Hotel Accommodations</h3>
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
                    <input
                      type="text"
                      placeholder="Hotel Name"
                      value={hotel.name}
                      onChange={(e) => {
                        const updated = [...hotels];
                        updated[idx].name = e.target.value;
                        setHotels(updated);
                      }}
                      className="border rounded-lg px-3 py-1.5 text-xs font-bold"
                    />
                    <input
                      type="text"
                      placeholder="Location (e.g. Makkah Al-Mukarramah)"
                      value={hotel.location}
                      onChange={(e) => {
                        const updated = [...hotels];
                        updated[idx].location = e.target.value;
                        setHotels(updated);
                      }}
                      className="border rounded-lg px-3 py-1.5 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Rating (e.g. ★★★★ (4-Star))"
                      value={hotel.rating}
                      onChange={(e) => {
                        const updated = [...hotels];
                        updated[idx].rating = e.target.value;
                        setHotels(updated);
                      }}
                      className="border rounded-lg px-3 py-1.5 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Stay Duration"
                      value={hotel.stayDuration}
                      onChange={(e) => {
                        const updated = [...hotels];
                        updated[idx].stayDuration = e.target.value;
                        setHotels(updated);
                      }}
                      className="border rounded-lg px-3 py-1.5 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Room Type"
                      value={hotel.roomType}
                      onChange={(e) => {
                        const updated = [...hotels];
                        updated[idx].roomType = e.target.value;
                        setHotels(updated);
                      }}
                      className="border rounded-lg px-3 py-1.5 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Board Basis"
                      value={hotel.boardBasis}
                      onChange={(e) => {
                        const updated = [...hotels];
                        updated[idx].boardBasis = e.target.value;
                        setHotels(updated);
                      }}
                      className="border rounded-lg px-3 py-1.5 text-xs"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Feature Badge (e.g. ✔ 24/7 Dedicated Haram Shuttle Bus Service)"
                    value={hotel.featureBadge}
                    onChange={(e) => {
                      const updated = [...hotels];
                      updated[idx].featureBadge = e.target.value;
                      setHotels(updated);
                    }}
                    className="w-full border rounded-lg px-3 py-1.5 text-xs text-emerald-800 font-semibold"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: Transfers & Visa */}
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-3 text-primary-800">5. Transfers & Visa Details</h3>
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
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-3 text-primary-800">6. Pricing & Booking Terms</h3>
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
                    <Globe className="w-6 h-6 text-blue-800" />
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
                      {outboundTitle}
                    </span>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100/60 px-2 py-0.5 rounded">
                      {outboundDate}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between font-bold text-slate-800">
                      <span>{outboundLeg1Flight}</span>
                      <span>{outboundLeg1Time}</span>
                    </div>

                    <div className="bg-blue-100/60 text-blue-900 text-[10px] font-bold py-1 px-2 rounded text-center my-1">
                      {outboundTransit}
                    </div>

                    <div className="flex justify-between font-bold text-slate-800">
                      <span>{outboundLeg2Flight}</span>
                      <span>{outboundLeg2Time}</span>
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
                      {inboundTitle}
                    </span>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100/60 px-2 py-0.5 rounded">
                      {inboundDate}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between font-bold text-slate-800">
                      <span>{inboundLeg1Flight}</span>
                      <span>{inboundLeg1Time}</span>
                    </div>

                    <div className="bg-blue-100/60 text-blue-900 text-[10px] font-bold py-1 px-2 rounded text-center my-1">
                      {inboundTransit}
                    </div>

                    <div className="flex justify-between font-bold text-slate-800">
                      <span>{inboundLeg2Flight}</span>
                      <span>{inboundLeg2Time}</span>
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
                        <span className="text-[10px] font-bold text-amber-600">{h.rating}</span>
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
                        <span className="inline-block bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {h.featureBadge}
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
                        <span className="text-blue-700 font-bold">•</span>
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
                      <span className="text-blue-700 font-bold">•</span>
                      <span><strong className="text-slate-900">Validity:</strong> {visaValidity}</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-blue-700 font-bold">•</span>
                      <span><strong className="text-slate-900">Eligibility:</strong> {visaEligibility}</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-blue-700 font-bold">•</span>
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
    </div>
  );
}
