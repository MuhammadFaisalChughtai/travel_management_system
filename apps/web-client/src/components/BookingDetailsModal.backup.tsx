import React, { useEffect, useState } from "react";
import {
  X,
  Users,
  CreditCard,
  Hotel,
  FileText,
  Lock,
  Unlock,
  Loader2,
  AlertCircle,
  Calculator,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../api/axios";

interface Passenger {
  id: number;
  title: string | null;
  firstName: string;
  lastName: string;
  ageCategory: string;
  email: string | null;
  phoneNumber: string | null;
  passportNumber: string | null;
  passportExpiryDate: string | null;
  role: string | null;
}

interface Payment {
  id: number;
  amount: string;
  paymentMethod: string;
  paymentType: string;
  paidOn: string;
  notes: string | null;
}

interface VendorPayment {
  id: number;
  vendorName: string;
  amount: string;
  paymentStatus: string;
  paidOn: string | null;
  flightPnr: string | null;
  issueDate: string | null;
  reservationNumber: string | null;
  notes: string | null;
  totalPaid: string;
  totalRefunded: string;
  remainingDue: string;
}

interface Accommodation {
  id: number;
  vendorName: string;
  hotelName: string;
  city?: string | null;
  roomType: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
  mealType: string | null;
  reservationNumber: string | null;
  qty: number;
  price: string;
  currency: string | null;
  otherCurrency: string | null;
  conversionRate: string | null;
  issueDate: string | null;
  refundAmount: string;
  fineAmount: string;
  hotelConfirmationNumber: string | null;
  hotelAddress: string | null;
  lastCancellationDate: string | null;
}

interface FlightService {
  id: number;
  date: string | null;
  vendorName: string;
  flightNo: string;
  pnr: string;
  departedFrom: string;
  arrivedAt: string;
  departTime: string | null;
  arrivalTime: string | null;
  price: string;
  currency: string | null;
  issueDate: string | null;
  refundAmount: string;
  fineAmount: string;
  baggage: string | null;
  carryOnBaggage: string | null;
  checkedBaggage: string | null;
  flightClass: string | null;
}

interface TransportService {
  id: number;
  vendorName: string;
  vehicleType: string;
  departureDestination: string;
  arrivalDestination: string;
  date: string | null;
  departureTime: string | null;
  arrivalTime: string | null;
  flightNo: string | null;
  price: string;
  currency: string | null;
  otherCurrency: string | null;
  conversionRate: string | null;
  issueDate: string | null;
  refundAmount: string;
  fineAmount: string;
}

interface VisaService {
  id: number;
  vendorName: string;
  passportNumber: string;
  visaType: string;
  visaNumber: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  price: string;
  currency: string | null;
  otherCurrency: string | null;
  conversionRate: string | null;
  refundAmount: string;
  fineAmount: string;
}

interface BookingDetail {
  id: number;
  bookingReference: string;
  date: string;
  departureDate: string | null;
  agentName: string | null;
  totalPrice: string;
  paidAmount: string;
  refundAmount: string;
  cardPaymentCharges: string;
  cancellationCharges: string;
  remainingAmount: string;
  status: string;
  paymentStatus: string;
  lockedStatus: string;
  customers: Passenger[];
  payments: Payment[];
  vendorPayments: VendorPayment[];
  accommodations: Accommodation[];
  flightServices: FlightService[];
  transportServices: TransportService[];
  visaServices: VisaService[];
}

interface BookingDetailsModalProps {
  bookingId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export function BookingDetailsModal({
  bookingId,
  isOpen,
  onClose,
  onUpdate,
}: BookingDetailsModalProps) {
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<
    | "summary"
    | "passengers"
    | "accommodations"
    | "vendors"
    | "flightServices"
    | "transportServices"
    | "visaServices"
    | "invoice"
  >("summary");

  // Toggle state for collapsible add forms
  const [showAddForm, setShowAddForm] = useState(false);

  // Form Fields - Passenger
  const [pTitle, setPTitle] = useState("Mr");
  const [pFirstName, setPFirstName] = useState("");
  const [pLastName, setPLastName] = useState("");
  const [pAgeCategory, setPAgeCategory] = useState("Adult");
  const [pEmail, setPEmail] = useState("");
  const [pPhone, setPPhone] = useState("");
  const [pPassport, setPPassport] = useState("");
  const [pPassportExpiry, setPPassportExpiry] = useState("");
  const [pRole, setPRole] = useState("Family Member");

  // Form Fields - Payment Transaction
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Bank Transfer");
  const [payType, setPayType] = useState("Instalment");
  const [payDate, setPayDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [payNotes, setPayNotes] = useState("");

  // Form Fields - Vendor Payment
  const [vName, setVName] = useState("");
  const [vAmount, setVAmount] = useState("");
  const [vStatus, setVStatus] = useState("unpaid");
  const [vPaidOn, setVPaidOn] = useState("");
  const [vFlightPnr, setVFlightPnr] = useState("");
  const [vIssueDate, setVIssueDate] = useState("");
  const [vResNumber, setVResNumber] = useState("");
  const [vNotes, setVNotes] = useState("");
  const [vTotalPaid, setVTotalPaid] = useState("0");
  const [vTotalRefunded, setVTotalRefunded] = useState("0");

  // Form Fields - Accommodation
  const [aHotelName, setAHotelName] = useState("");
  const [aVendorName, setAVendorName] = useState("");
  const [aRoomType, setARoomType] = useState("Double");
  const [aCheckIn, setACheckIn] = useState("");
  const [aCheckOut, setACheckOut] = useState("");
  const [aMeal, setAMeal] = useState("Room Only");
  const [aQty, setAQty] = useState(1);
  const [aPrice, setAPrice] = useState("");
  const [aCurrency, setACurrency] = useState("GBP");
  const [aOtherCurrency, setAOtherCurrency] = useState("");
  const [aConversionRate, setAConversionRate] = useState("");
  const [aIssueDate, setAIssueDate] = useState("");
  const [aRefundAmount, setARefundAmount] = useState("0");
  const [aFineAmount, setAFineAmount] = useState("0");
  const [aResNumber, setAResNumber] = useState("");
  const [aConfNumber, setAConfNumber] = useState("");
  const [aAddress, setAAddress] = useState("");
  const [aLastCancellationDate, setALastCancellationDate] = useState("");

  // Form Fields - New Services
  const [flightForm, setFlightForm] = useState({
    date: "",
    vendorName: "",
    flightNo: "",
    pnr: "",
    departedFrom: "",
    arrivedAt: "",
    departTime: "",
    arrivalTime: "",
    price: "",
    currency: "GBP",
    issueDate: "",
    refundAmount: "0",
    fineAmount: "0",
    baggage: "",
    carryOnBaggage: "",
    checkedBaggage: "",
    flightClass: "Economy",
  });

  const [transportForm, setTransportForm] = useState({
    date: "",
    vendorName: "",
    vehicleType: "",
    departureDestination: "",
    arrivalDestination: "",
    departureTime: "",
    arrivalTime: "",
    flightNo: "",
    price: "",
    currency: "GBP",
    otherCurrency: "",
    conversionRate: "",
    issueDate: "",
    refundAmount: "0",
    fineAmount: "0",
  });

  const [visaForm, setVisaForm] = useState({
    vendorName: "",
    passportNumber: "",
    visaType: "",
    visaNumber: "",
    issueDate: "",
    expiryDate: "",
    price: "",
    currency: "GBP",
    otherCurrency: "",
    conversionRate: "",
    refundAmount: "0",
    fineAmount: "0",
  });

  const [actionLoading, setActionLoading] = useState(false);

  const fetchDetails = async () => {
    if (!bookingId) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/bookings/${bookingId}`);
      setBooking(res.data.booking);
    } catch (err: any) {
      console.error(err);
      setError(
        err.response?.data?.message || "Failed to fetch booking details",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && bookingId) {
      fetchDetails();
      setActiveTab("summary");
      setShowAddForm(false);
    } else {
      setBooking(null);
    }
  }, [bookingId, isOpen]);

  const handleToggleLock = async () => {
    if (!booking) return;
    const newLock = booking.lockedStatus === "locked" ? "unlocked" : "locked";
    try {
      const response = await api.patch(`/bookings/${booking.id}`, {
        lockedStatus: newLock,
      });
      setBooking({
        ...booking,
        lockedStatus: response.data.booking.lockedStatus,
      });
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error("Lock toggle failed:", err);
    }
  };

  const handleAddPassenger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingId) return;
    setActionLoading(true);
    try {
      await api.post(`/bookings/${bookingId}/passengers`, {
        title: pTitle,
        firstName: pFirstName,
        lastName: pLastName,
        ageCategory: pAgeCategory,
        email: pEmail || undefined,
        phoneNumber: pPhone || undefined,
        passportNumber: pPassport || undefined,
        passportExpiryDate: pPassportExpiry || undefined,
        role: pRole,
        agentName: booking?.agentName,
      });
      setPFirstName("");
      setPLastName("");
      setPEmail("");
      setPPhone("");
      setPPassport("");
      setPPassportExpiry("");
      setShowAddForm(false);
      fetchDetails();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingId) return;
    setActionLoading(true);
    try {
      await api.post(`/bookings/${bookingId}/payments`, {
        amount: parseFloat(payAmount),
        paymentMethod: payMethod,
        paymentType: payType,
        paidOn: payDate,
        notes: payNotes || undefined,
      });
      setPayAmount("");
      setPayNotes("");
      setShowAddForm(false);
      fetchDetails();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddVendorPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingId) return;
    setActionLoading(true);
    try {
      await api.post(`/bookings/${bookingId}/vendor-payments`, {
        vendorName: vName,
        amount: parseFloat(vAmount) || 0,
        paymentStatus: vStatus,
        paidOn: vPaidOn || undefined,
        flightPnr: vFlightPnr || undefined,
        issueDate: vIssueDate || undefined,
        reservationNumber: vResNumber || undefined,
        notes: vNotes || undefined,
        totalPaid: parseFloat(vTotalPaid) || 0,
        totalRefunded: parseFloat(vTotalRefunded) || 0,
      });
      setVName("");
      setVAmount("");
      setVFlightPnr("");
      setVResNumber("");
      setVNotes("");
      setVTotalPaid("0");
      setVTotalRefunded("0");
      setVPaidOn("");
      setShowAddForm(false);
      fetchDetails();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddAccommodation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingId) return;
    setActionLoading(true);
    try {
      await api.post(`/bookings/${bookingId}/accommodations`, {
        hotelName: aHotelName,
        vendorName: aVendorName,
        roomType: aRoomType,
        checkInDate: aCheckIn || undefined,
        checkOutDate: aCheckOut || undefined,
        mealType: aMeal,
        qty: aQty,
        price: parseFloat(aPrice) || 0,
        currency: aCurrency || undefined,
        otherCurrency: aOtherCurrency || undefined,
        conversionRate: aConversionRate
          ? parseFloat(aConversionRate)
          : undefined,
        issueDate: aIssueDate || undefined,
        refundAmount: parseFloat(aRefundAmount) || 0,
        fineAmount: parseFloat(aFineAmount) || 0,
        reservationNumber: aResNumber || undefined,
        hotelConfirmationNumber: aConfNumber || undefined,
        hotelAddress: aAddress || undefined,
        lastCancellationDate: aLastCancellationDate || undefined,
      });
      setAHotelName("");
      setAVendorName("");
      setAResNumber("");
      setAConfNumber("");
      setAAddress("");
      setAPrice("");
      setACurrency("GBP");
      setAOtherCurrency("");
      setAConversionRate("");
      setAIssueDate("");
      setARefundAmount("0");
      setAFineAmount("0");
      setALastCancellationDate("");
      setShowAddForm(false);
      fetchDetails();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddFlight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingId) return;
    setActionLoading(true);
    try {
      await api.post(`/bookings/${bookingId}/flight-services`, {
        ...flightForm,
        price: parseFloat(flightForm.price) || 0,
        refundAmount: parseFloat(flightForm.refundAmount) || 0,
        fineAmount: parseFloat(flightForm.fineAmount) || 0,
      });
      setFlightForm({
        date: "",
        vendorName: "",
        flightNo: "",
        pnr: "",
        departedFrom: "",
        arrivedAt: "",
        departTime: "",
        arrivalTime: "",
        price: "",
        currency: "GBP",
        issueDate: "",
        refundAmount: "0",
        fineAmount: "0",
        baggage: "",
        carryOnBaggage: "",
        checkedBaggage: "",
        flightClass: "Economy",
      });
      setShowAddForm(false);
      fetchDetails();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddTransport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingId) return;
    setActionLoading(true);
    try {
      await api.post(`/bookings/${bookingId}/transport-services`, {
        ...transportForm,
        price: parseFloat(transportForm.price) || 0,
        conversionRate: transportForm.conversionRate
          ? parseFloat(transportForm.conversionRate)
          : undefined,
        refundAmount: parseFloat(transportForm.refundAmount) || 0,
        fineAmount: parseFloat(transportForm.fineAmount) || 0,
      });
      setTransportForm({
        date: "",
        vendorName: "",
        vehicleType: "",
        departureDestination: "",
        arrivalDestination: "",
        departureTime: "",
        arrivalTime: "",
        flightNo: "",
        price: "",
        currency: "GBP",
        otherCurrency: "",
        conversionRate: "",
        issueDate: "",
        refundAmount: "0",
        fineAmount: "0",
      });
      setShowAddForm(false);
      fetchDetails();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddVisa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingId) return;
    setActionLoading(true);
    try {
      await api.post(`/bookings/${bookingId}/visa-services`, {
        ...visaForm,
        price: parseFloat(visaForm.price) || 0,
        conversionRate: visaForm.conversionRate
          ? parseFloat(visaForm.conversionRate)
          : undefined,
        refundAmount: parseFloat(visaForm.refundAmount) || 0,
        fineAmount: parseFloat(visaForm.fineAmount) || 0,
      });
      setVisaForm({
        vendorName: "",
        passportNumber: "",
        visaType: "",
        visaNumber: "",
        issueDate: "",
        expiryDate: "",
        price: "",
        currency: "GBP",
        otherCurrency: "",
        conversionRate: "",
        refundAmount: "0",
        fineAmount: "0",
      });
      setShowAddForm(false);
      fetchDetails();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "EMPTY";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-US", {
        month: "long",
        day: "2-digit",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const formatPrice = (val: string | number | null | undefined) => {
    if (val === undefined || val === null || val === "") return "EMPTY";
    const num = parseFloat(String(val));
    if (isNaN(num)) return "EMPTY";
    return num.toFixed(2); // returns "0.00" for zero, not EMPTY
  };

  // State for calculator modal
  const [showCalculator, setShowCalculator] = useState(false);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          className="bg-white rounded-[16px] border border-slate-200 shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden z-10"
        >
          {/* Header */}
          <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800">
                Booking Details - {booking?.bookingReference || "..."}
              </span>

              {!loading && booking && (
                <div className="flex items-center gap-1.5 ml-2">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                      booking.paymentStatus === "paid"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : booking.paymentStatus === "partially_paid"
                          ? "bg-amber-500/10 text-amber-600"
                          : "bg-rose-500/10 text-rose-600"
                    }`}
                  >
                    {booking.paymentStatus}
                  </span>

                  <button
                    onClick={handleToggleLock}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold border transition-colors ${
                      booking.lockedStatus === "locked"
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}
                  >
                    {booking.lockedStatus === "locked" ? (
                      <Lock className="w-2.5 h-2.5" />
                    ) : (
                      <Unlock className="w-2.5 h-2.5" />
                    )}
                    {booking.lockedStatus.toUpperCase()}
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Container */}
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
              <span className="text-slate-400 text-[11px] font-semibold">
                Loading data...
              </span>
            </div>
          ) : error || !booking ? (
            <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
              <AlertCircle className="w-8 h-8 text-rose-500" />
              <p className="text-slate-600 text-xs font-semibold">
                {error || "Booking ledger not found"}
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
              {/* Tab Navigation Column */}
              <div className="w-full md:w-44 bg-slate-50 border-r border-slate-200 p-2 flex flex-row md:flex-col gap-0.5 flex-shrink-0 overflow-x-auto md:overflow-x-visible">
                {[
                  { id: "summary", label: "Summary & Ledger", icon: FileText },
                  {
                    id: "passengers",
                    label: `Passengers (${booking.customers.length})`,
                    icon: Users,
                  },
                  {
                    id: "accommodations",
                    label: `Stays (${booking.accommodations.length})`,
                    icon: Hotel,
                  },
                  {
                    id: "vendors",
                    label: `Vendor Costs (${booking.vendorPayments?.length || 0})`,
                    icon: CreditCard,
                  },
                  {
                    id: "flightServices",
                    label: `Flight Services (${booking.flightServices?.length || 0})`,
                    icon: FileText,
                  },
                  {
                    id: "transportServices",
                    label: `Transport Services (${booking.transportServices?.length || 0})`,
                    icon: CreditCard,
                  },
                  {
                    id: "visaServices",
                    label: `Visa Services (${booking.visaServices?.length || 0})`,
                    icon: FileText,
                  },
                  { id: "invoice", label: `Invoice`, icon: FileText },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      setShowAddForm(false);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold text-left whitespace-nowrap transition-all ${
                      activeTab === tab.id
                        ? "bg-white text-primary-600 shadow-sm border border-slate-200"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <tab.icon className="w-3.5 h-3.5 flex-shrink-0" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Active Tab Panel (Scrollable content) */}
              <div className="flex-1 p-4 overflow-y-auto max-h-[calc(92vh-40px)] space-y-4">
                {/* -------------------------------------------
                    TAB: SUMMARY & LEDGER
                    ------------------------------------------- */}
                {activeTab === "summary" && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Booking Details key-value card */}
                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm self-start">
                      <table className="w-full text-left border-collapse text-[10.5px]">
                        <tbody>
                          <tr className="border-b border-slate-200">
                            <td className="px-3 py-2 bg-slate-50/50 font-bold text-slate-500 w-1/3 border-r border-slate-200">
                              BOOKING REFERENCE
                            </td>
                            <td className="px-3 py-2 text-slate-800 font-bold font-mono">
                              {booking.bookingReference}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-3 py-2 bg-slate-50/50 font-bold text-slate-500 border-r border-slate-200">
                              DATE
                            </td>
                            <td className="px-3 py-2 text-slate-700">
                              {formatDate(booking.date)}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-3 py-2 bg-slate-50/50 font-bold text-slate-500 border-r border-slate-200">
                              DEPARTURE DATE
                            </td>
                            <td className="px-3 py-2 text-slate-700">
                              {formatDate(booking.departureDate)}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-3 py-2 bg-slate-50/50 font-bold text-slate-500 border-r border-slate-200">
                              AGENT
                            </td>
                            <td className="px-3 py-2">
                              <a
                                href="#"
                                className="text-amber-600 hover:text-amber-700 font-bold underline"
                              >
                                {booking.agentName || "System"}
                              </a>
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-3 py-2 bg-slate-50/50 font-bold text-slate-500 border-r border-slate-200">
                              CUSTOMERS
                            </td>
                            <td className="px-3 py-2 text-slate-600 leading-normal">
                              {booking.customers.length === 0
                                ? "EMPTY"
                                : booking.customers
                                    .map(
                                      (c) =>
                                        `${c.firstName} ${c.lastName} (Age: ${c.ageCategory || "Adult"})`,
                                    )
                                    .join(", ")}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-3 py-2 bg-slate-50/50 font-bold text-slate-500 border-r border-slate-200">
                              TOTAL PRICE
                            </td>
                            <td className="px-3 py-2 text-slate-800 font-bold">
                              £{formatPrice(booking.totalPrice)}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-3 py-2 bg-slate-50/50 font-bold text-slate-500 border-r border-slate-200">
                              STATUS
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                  booking.status === "confirmed"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {booking.status}
                              </span>
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-3 py-2 bg-slate-50/50 font-bold text-slate-500 border-r border-slate-200">
                              PAID AMOUNT
                            </td>
                            <td className="px-3 py-2 text-emerald-600 font-bold">
                              £{formatPrice(booking.paidAmount)}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-3 py-2 bg-slate-50/50 font-bold text-slate-500 border-r border-slate-200">
                              REFUND AMOUNT
                            </td>
                            <td className="px-3 py-2 text-rose-500">
                              £{formatPrice(booking.refundAmount)}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-3 py-2 bg-slate-50/50 font-bold text-slate-500 border-r border-slate-200">
                              CARD PAYMENT CHARGES
                            </td>
                            <td className="px-3 py-2 text-slate-700">
                              £{formatPrice(booking.cardPaymentCharges)}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-3 py-2 bg-slate-50/50 font-bold text-slate-500 border-r border-slate-200">
                              CANCELLATION CHARGES
                            </td>
                            <td className="px-3 py-2 text-slate-700">
                              £{formatPrice(booking.cancellationCharges)}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-3 py-2 bg-slate-50/50 font-bold text-slate-500 border-r border-slate-200">
                              REMAINING AMOUNT
                            </td>
                            <td className="px-3 py-2 text-rose-600 font-bold">
                              £{formatPrice(booking.remainingAmount)}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-3 py-2 bg-slate-50/50 font-bold text-slate-500 border-r border-slate-200">
                              PAYMENT STATUS
                            </td>
                            <td className="px-3 py-2">
                              <span className="bg-amber-100 border border-amber-200 text-amber-800 px-1.5 py-0.5 rounded text-[8px] font-black uppercase">
                                {booking.paymentStatus}
                              </span>
                            </td>
                          </tr>
                          <tr>
                            <td className="px-3 py-2 bg-slate-50/50 font-bold text-slate-500 border-r border-slate-200">
                              LOCKED STATUS
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-black border uppercase ${
                                  booking.lockedStatus === "locked"
                                    ? "bg-rose-50 text-rose-700 border-rose-100"
                                    : "bg-emerald-50 text-emerald-700 border-emerald-100"
                                }`}
                              >
                                {booking.lockedStatus}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Transactions Ledger */}
                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm self-start">
                      <div className="bg-slate-900 px-3 py-2 flex justify-between items-center">
                        <h4 className="text-[11px] font-bold text-white tracking-wide">
                          Booking Transactions
                        </h4>
                        <button
                          onClick={() => setShowAddForm(!showAddForm)}
                          className="text-[9px] font-bold text-white hover:text-amber-200 transition-colors"
                        >
                          {showAddForm ? "CANCEL" : "RECORD TRANSACTION"}
                        </button>
                      </div>

                      {/* Add payment form inside summary */}
                      <AnimatePresence>
                        {showAddForm && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden border-b border-slate-200 bg-slate-50"
                          >
                            <form
                              onSubmit={handleAddPayment}
                              className="p-3 space-y-2 text-[10px] font-semibold text-slate-600"
                            >
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-slate-500 mb-0.5">
                                    Amount (£)
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={payAmount}
                                    onChange={(e) =>
                                      setPayAmount(e.target.value)
                                    }
                                    className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-slate-800 text-[10px]"
                                    placeholder="4215"
                                  />
                                </div>
                                <div>
                                  <label className="block text-slate-500 mb-0.5">
                                    Date
                                  </label>
                                  <input
                                    type="date"
                                    required
                                    value={payDate}
                                    onChange={(e) => setPayDate(e.target.value)}
                                    className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-slate-800 text-[10px]"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-slate-500 mb-0.5">
                                    Method
                                  </label>
                                  <select
                                    value={payMethod}
                                    onChange={(e) =>
                                      setPayMethod(e.target.value)
                                    }
                                    className="w-full border border-slate-200 rounded px-1.5 py-1 bg-white outline-none text-slate-800 text-[10px]"
                                  >
                                    <option>Bank Transfer</option>
                                    <option>Card Payment</option>
                                    <option>Cash</option>
                                    <option>Direct Debit</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-slate-500 mb-0.5">
                                    Type
                                  </label>
                                  <select
                                    value={payType}
                                    onChange={(e) => setPayType(e.target.value)}
                                    className="w-full border border-slate-200 rounded px-1.5 py-1 bg-white outline-none text-slate-800 text-[10px]"
                                  >
                                    <option>Instalment</option>
                                    <option>Full Payment</option>
                                    <option>Security Deposit</option>
                                  </select>
                                </div>
                              </div>

                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Notes
                                </label>
                                <input
                                  type="text"
                                  value={payNotes}
                                  onChange={(e) => setPayNotes(e.target.value)}
                                  className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-slate-800 text-[10px]"
                                  placeholder="Transaction reference..."
                                />
                              </div>

                              <div className="flex justify-end pt-1">
                                <button
                                  type="submit"
                                  disabled={actionLoading}
                                  className="bg-primary-600 text-white font-bold text-[9px] px-3 py-1 rounded hover:bg-primary-500"
                                >
                                  {actionLoading
                                    ? "RECORDING..."
                                    : "LOG TRANSACTION"}
                                </button>
                              </div>
                            </form>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Payments list table */}
                      {booking.payments.length === 0 ? (
                        <p className="text-[10px] text-slate-400 text-center py-4 bg-slate-50/20 font-medium">
                          No Transactions
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-[10px] min-w-[380px]">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                                <th className="px-3 py-2">AMOUNT</th>
                                <th className="px-3 py-2">PAYMENT METHOD</th>
                                <th className="px-3 py-2">PAID ON</th>
                                <th className="px-3 py-2">NOTES</th>
                                <th className="px-3 py-2">PAYMENT METHOD</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                              {booking.payments.map((p) => (
                                <tr key={p.id} className="hover:bg-slate-50/30">
                                  <td className="px-3 py-1.5 font-bold text-slate-800">
                                    £
                                    {Number(p.amount).toLocaleString(
                                      undefined,
                                      { minimumFractionDigits: 2 },
                                    )}
                                  </td>
                                  <td className="px-3 py-1.5 text-slate-700">
                                    {p.paymentType}
                                  </td>
                                  <td className="px-3 py-1.5 font-mono text-slate-400">
                                    {formatDate(p.paidOn)}
                                  </td>
                                  <td className="px-3 py-1.5 text-slate-400 max-w-[120px] truncate">
                                    {p.notes || "—"}
                                  </td>
                                  <td className="px-3 py-1.5 text-slate-600">
                                    {p.paymentMethod}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* -------------------------------------------
                    TAB: PASSENGERS
                    ------------------------------------------- */}
                {activeTab === "passengers" && (
                  <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                    <div className="bg-slate-900 px-3 py-2 flex justify-between items-center">
                      <h4 className="text-[11px] font-bold text-white tracking-wide">
                        Passengers
                      </h4>
                      <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="text-[9px] font-bold text-white hover:text-amber-200 transition-colors"
                      >
                        {showAddForm ? "CANCEL" : "ADD PASSENGER"}
                      </button>
                    </div>

                    {/* Add Passenger Form */}
                    <AnimatePresence>
                      {showAddForm && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden border-b border-slate-200 bg-slate-50"
                        >
                          <form
                            onSubmit={handleAddPassenger}
                            className="p-3 space-y-2 text-[10px] font-semibold text-slate-600"
                          >
                            <div className="grid grid-cols-4 gap-2">
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Title
                                </label>
                                <select
                                  value={pTitle}
                                  onChange={(e) => setPTitle(e.target.value)}
                                  className="w-full border border-slate-200 rounded p-1 bg-white outline-none text-[10px]"
                                >
                                  <option>Mr</option>
                                  <option>Mrs</option>
                                  <option>Ms</option>
                                  <option>Miss</option>
                                </select>
                              </div>
                              <div className="col-span-2">
                                <label className="block text-slate-500 mb-0.5">
                                  First Name
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={pFirstName}
                                  onChange={(e) =>
                                    setPFirstName(e.target.value)
                                  }
                                  className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-[10px]"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Last Name
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={pLastName}
                                  onChange={(e) => setPLastName(e.target.value)}
                                  className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-[10px]"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Age Category
                                </label>
                                <select
                                  value={pAgeCategory}
                                  onChange={(e) =>
                                    setPAgeCategory(e.target.value)
                                  }
                                  className="w-full border border-slate-200 rounded p-1 bg-white outline-none text-[10px]"
                                >
                                  <option>Adult</option>
                                  <option>Youth</option>
                                  <option>Child</option>
                                  <option>Infant</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Email
                                </label>
                                <input
                                  type="email"
                                  value={pEmail}
                                  onChange={(e) => setPEmail(e.target.value)}
                                  className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-[10px]"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Phone Number
                                </label>
                                <input
                                  type="text"
                                  value={pPhone}
                                  onChange={(e) => setPPhone(e.target.value)}
                                  className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-[10px]"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Passport Number
                                </label>
                                <input
                                  type="text"
                                  value={pPassport}
                                  onChange={(e) => setPPassport(e.target.value)}
                                  className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-[10px]"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Passport Expiry
                                </label>
                                <input
                                  type="date"
                                  value={pPassportExpiry}
                                  onChange={(e) =>
                                    setPPassportExpiry(e.target.value)
                                  }
                                  className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-[10px]"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Role
                                </label>
                                <select
                                  value={pRole}
                                  onChange={(e) => setPRole(e.target.value)}
                                  className="w-full border border-slate-200 rounded p-1 bg-white outline-none text-[10px]"
                                >
                                  <option>Leader</option>
                                  <option>Family Member</option>
                                  <option>Company Guest</option>
                                </select>
                              </div>
                            </div>

                            <div className="flex justify-end pt-1">
                              <button
                                type="submit"
                                disabled={actionLoading}
                                className="bg-primary-600 text-white font-bold text-[9px] px-3 py-1 rounded hover:bg-primary-500"
                              >
                                {actionLoading ? "SAVING..." : "ADD PASSENGER"}
                              </button>
                            </div>
                          </form>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Passengers table */}
                    {booking.customers.length === 0 ? (
                      <p className="text-[10px] text-slate-400 text-center py-6 bg-slate-50/20 font-medium">
                        No Passengers mapped to this ledger entry.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-[10px] min-w-[800px]">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                              <th className="px-3 py-2">TITLE</th>
                              <th className="px-3 py-2">FIRST NAME</th>
                              <th className="px-3 py-2">LAST NAME</th>
                              <th className="px-3 py-2">AGE</th>
                              <th className="px-3 py-2">EMAIL</th>
                              <th className="px-3 py-2">PHONE NUMBER</th>
                              <th className="px-3 py-2">
                                PASSPORT EXPIRY DATE
                              </th>
                              <th className="px-3 py-2">AGENT</th>
                              <th className="px-3 py-2">ROLE</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                            {booking.customers.map((c) => (
                              <tr key={c.id} className="hover:bg-slate-50/30">
                                <td className="px-3 py-1.5">
                                  {c.title || "—"}
                                </td>
                                <td className="px-3 py-1.5 font-bold text-slate-800">
                                  {c.firstName}
                                </td>
                                <td className="px-3 py-1.5 font-bold text-slate-800">
                                  {c.lastName}
                                </td>
                                <td className="px-3 py-1.5">
                                  {c.ageCategory || "Adult"}
                                </td>
                                <td className="px-3 py-1.5 text-slate-500">
                                  {c.email || "0"}
                                </td>
                                <td className="px-3 py-1.5 font-mono text-slate-500">
                                  {c.phoneNumber || "—"}
                                </td>
                                <td className="px-3 py-1.5 text-slate-400">
                                  {formatDate(c.passportExpiryDate)}
                                </td>
                                <td className="px-3 py-1.5">
                                  <a
                                    href="#"
                                    className="text-amber-600 hover:text-amber-700 font-bold underline"
                                  >
                                    {booking.agentName || "System"}
                                  </a>
                                </td>
                                <td className="px-3 py-1.5 text-slate-500">
                                  {c.role || "Family Member"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* -------------------------------------------
                    TAB: STAYS (ACCOMMODATIONS)
                    ------------------------------------------- */}
                {activeTab === "accommodations" && (
                  <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                    <div className="bg-slate-900 px-3 py-2 flex justify-between items-center">
                      <h4 className="text-[11px] font-bold text-white tracking-wide">
                        Accommodation Services
                      </h4>
                      <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="text-[9px] font-bold text-white hover:text-amber-200 transition-colors"
                      >
                        {showAddForm ? "CANCEL" : "BOOK HOTEL"}
                      </button>
                    </div>

                    {/* Book Hotel Form */}
                    <AnimatePresence>
                      {showAddForm && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden border-b border-slate-200 bg-slate-50"
                        >
                          <form
                            onSubmit={handleAddAccommodation}
                            className="p-3 space-y-2 text-[10px] font-semibold text-slate-600"
                          >
                            <div className="grid grid-cols-4 gap-2">
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Hotel Name
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={aHotelName}
                                  onChange={(e) =>
                                    setAHotelName(e.target.value)
                                  }
                                  className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-[10px]"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Vendor Provider
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={aVendorName}
                                  onChange={(e) =>
                                    setAVendorName(e.target.value)
                                  }
                                  className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-[10px]"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Room Type
                                </label>
                                <input
                                  type="text"
                                  value={aRoomType}
                                  onChange={(e) => setARoomType(e.target.value)}
                                  className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-[10px]"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Meal Board
                                </label>
                                <input
                                  type="text"
                                  value={aMeal}
                                  onChange={(e) => setAMeal(e.target.value)}
                                  className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-[10px]"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-4 gap-2">
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Check In Date
                                </label>
                                <input
                                  type="date"
                                  required
                                  value={aCheckIn}
                                  onChange={(e) => setACheckIn(e.target.value)}
                                  className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-[10px]"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Check Out Date
                                </label>
                                <input
                                  type="date"
                                  required
                                  value={aCheckOut}
                                  onChange={(e) => setACheckOut(e.target.value)}
                                  className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-[10px]"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Qty
                                </label>
                                <input
                                  type="number"
                                  required
                                  value={aQty}
                                  onChange={(e) =>
                                    setAQty(parseInt(e.target.value) || 1)
                                  }
                                  className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-[10px]"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Price (£)
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  required
                                  value={aPrice}
                                  onChange={(e) => setAPrice(e.target.value)}
                                  className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-[10px]"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-4 gap-2">
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Currency
                                </label>
                                <input
                                  type="text"
                                  value={aCurrency}
                                  onChange={(e) => setACurrency(e.target.value)}
                                  className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-[10px]"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Other Currency
                                </label>
                                <input
                                  type="text"
                                  value={aOtherCurrency}
                                  onChange={(e) =>
                                    setAOtherCurrency(e.target.value)
                                  }
                                  className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-[10px]"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Conversion Rate
                                </label>
                                <input
                                  type="number"
                                  step="0.0001"
                                  value={aConversionRate}
                                  onChange={(e) =>
                                    setAConversionRate(e.target.value)
                                  }
                                  className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-[10px]"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Issue Date
                                </label>
                                <input
                                  type="date"
                                  value={aIssueDate}
                                  onChange={(e) =>
                                    setAIssueDate(e.target.value)
                                  }
                                  className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-[10px]"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-4 gap-2">
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Refund Amount
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={aRefundAmount}
                                  onChange={(e) =>
                                    setARefundAmount(e.target.value)
                                  }
                                  className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-[10px]"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Fine Amount
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={aFineAmount}
                                  onChange={(e) =>
                                    setAFineAmount(e.target.value)
                                  }
                                  className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-[10px]"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Res ID
                                </label>
                                <input
                                  type="text"
                                  value={aResNumber}
                                  onChange={(e) =>
                                    setAResNumber(e.target.value)
                                  }
                                  className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-[10px]"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Conf Code
                                </label>
                                <input
                                  type="text"
                                  value={aConfNumber}
                                  onChange={(e) =>
                                    setAConfNumber(e.target.value)
                                  }
                                  className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-[10px]"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Hotel Address
                                </label>
                                <input
                                  type="text"
                                  value={aAddress}
                                  onChange={(e) => setAAddress(e.target.value)}
                                  className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-[10px]"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Last Cancellation Date
                                </label>
                                <input
                                  type="date"
                                  value={aLastCancellationDate}
                                  onChange={(e) =>
                                    setALastCancellationDate(e.target.value)
                                  }
                                  className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-[10px]"
                                />
                              </div>
                            </div>

                            <div className="flex justify-end pt-1">
                              <button
                                type="submit"
                                disabled={actionLoading}
                                className="bg-primary-600 text-white font-bold text-[9px] px-3 py-1 rounded hover:bg-primary-500"
                              >
                                {actionLoading
                                  ? "BOOKING..."
                                  : "LOG ACCOMMODATION"}
                              </button>
                            </div>
                          </form>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Stays List Table */}
                    {booking.accommodations.length === 0 ? (
                      <p className="text-[10px] text-slate-400 text-center py-6 bg-slate-50/20 font-medium">
                        No accommodations recorded.
                      </p>
                    ) : (
                      <div className="overflow-x-auto w-full">
                        <table className="w-full text-left border-collapse text-[10px] min-w-[1400px]">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                              <th className="px-3 py-2">VENDOR</th>
                              <th className="px-3 py-2">HOTEL NAME</th>
                              <th className="px-3 py-2">ROOM TYPE</th>
                              <th className="px-3 py-2">CHECK IN DATE</th>
                              <th className="px-3 py-2">CHECK OUT DATE</th>
                              <th className="px-3 py-2">MEAL TYPE</th>
                              <th className="px-3 py-2">RESERVATION NUMBER</th>
                              <th className="px-3 py-2">QTY</th>
                              <th className="px-3 py-2">PRICE</th>
                              <th className="px-3 py-2">CURRENCY</th>
                              <th className="px-3 py-2">OTHER CURRENCY</th>
                              <th className="px-3 py-2">CONVERSION RATE</th>
                              <th className="px-3 py-2">ISSUE DATE</th>
                              <th className="px-3 py-2">REFUND AMOUNT</th>
                              <th className="px-3 py-2">FINE AMOUNT</th>
                              <th className="px-3 py-2">
                                HOTEL CONFIRMATION NUMBER
                              </th>
                              <th className="px-3 py-2">HOTEL ADDRESS</th>
                              <th className="px-3 py-2">
                                LAST CANCELLATION DATE
                              </th>
                              <th className="px-3 py-2 text-center">ACTIONS</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                            {booking.accommodations.map((a) => (
                              <tr key={a.id} className="hover:bg-slate-50/30">
                                <td className="px-3 py-1.5">
                                  <a
                                    href="#"
                                    className="text-amber-600 hover:text-amber-700 font-bold underline"
                                  >
                                    {a.vendorName}
                                  </a>
                                </td>
                                <td className="px-3 py-1.5 font-bold text-slate-800">
                                  {a.hotelName}
                                </td>
                                <td className="px-3 py-1.5">
                                  {a.roomType || "EMPTY"}
                                </td>
                                <td className="px-3 py-1.5 font-mono text-slate-500">
                                  {formatDate(a.checkInDate)}
                                </td>
                                <td className="px-3 py-1.5 font-mono text-slate-500">
                                  {formatDate(a.checkOutDate)}
                                </td>
                                <td className="px-3 py-1.5">
                                  {a.mealType || "EMPTY"}
                                </td>
                                <td className="px-3 py-1.5 font-mono">
                                  {a.reservationNumber || "EMPTY"}
                                </td>
                                <td className="px-3 py-1.5 font-bold text-slate-800">
                                  {a.qty}
                                </td>
                                <td className="px-3 py-1.5 text-slate-800">
                                  £{formatPrice(a.price)}
                                </td>
                                <td className="px-3 py-1.5 font-mono text-slate-400">
                                  {a.currency || "EMPTY"}
                                </td>
                                <td className="px-3 py-1.5 font-mono text-slate-400">
                                  {a.otherCurrency || "EMPTY"}
                                </td>
                                <td className="px-3 py-1.5 font-mono text-slate-500">
                                  {a.conversionRate || "EMPTY"}
                                </td>
                                <td className="px-3 py-1.5 font-mono text-slate-400">
                                  {formatDate(a.issueDate)}
                                </td>
                                <td className="px-3 py-1.5 text-rose-500">
                                  {formatPrice(a.refundAmount)}
                                </td>
                                <td className="px-3 py-1.5 text-rose-500">
                                  {formatPrice(a.fineAmount)}
                                </td>
                                <td className="px-3 py-1.5 font-mono text-slate-800">
                                  {a.hotelConfirmationNumber || "EMPTY"}
                                </td>
                                <td
                                  className="px-3 py-1.5 max-w-xs truncate text-slate-400"
                                  title={a.hotelAddress || ""}
                                >
                                  {a.hotelAddress || "EMPTY"}
                                </td>
                                <td className="px-3 py-1.5 font-mono text-slate-400">
                                  {formatDate(a.lastCancellationDate)}
                                </td>
                                <td className="px-3 py-1.5 text-center">
                                  <button className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-[9px] px-2 py-0.5 rounded shadow transition-colors">
                                    Voucher
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* -------------------------------------------
                    TAB: VENDOR PAYMENTS
                    ------------------------------------------- */}
                {activeTab === "vendors" && (
                  <div className="space-y-4">
                    {/* Header bar and cost creation form trigger */}
                    <div className="bg-slate-900 px-3 py-2 flex justify-between items-center rounded-t-lg shadow-sm">
                      <h4 className="text-[11px] font-bold text-white tracking-wide">
                        Vendor Payments
                      </h4>
                      <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="text-[9px] font-bold text-white hover:text-amber-200 transition-colors"
                      >
                        {showAddForm ? "CANCEL" : "RECORD COST"}
                      </button>
                    </div>

                    {/* Record Vendor Cost Form */}
                    <AnimatePresence>
                      {showAddForm && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden border-x border-b border-slate-200 bg-slate-50 rounded-b-lg"
                        >
                          <form
                            onSubmit={handleAddVendorPayment}
                            className="p-3 space-y-2 text-[10px] font-semibold text-slate-600"
                          >
                            <div className="grid grid-cols-4 gap-2">
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Vendor Provider
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={vName}
                                  onChange={(e) => setVName(e.target.value)}
                                  className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-[10px]"
                                  placeholder="Polani Travel"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Total Cost (£)
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  required
                                  value={vAmount}
                                  onChange={(e) => setVAmount(e.target.value)}
                                  className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-[10px]"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Paid to Vendor (£)
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={vTotalPaid}
                                  onChange={(e) =>
                                    setVTotalPaid(e.target.value)
                                  }
                                  className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-[10px]"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Status
                                </label>
                                <select
                                  value={vStatus}
                                  onChange={(e) => setVStatus(e.target.value)}
                                  className="w-full border border-slate-200 rounded px-1.5 py-1 bg-white outline-none text-[10px]"
                                >
                                  <option value="unpaid">Unpaid</option>
                                  <option value="paid">Paid</option>
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-4 gap-2">
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Paid On Date
                                </label>
                                <input
                                  type="date"
                                  value={vPaidOn}
                                  onChange={(e) => setVPaidOn(e.target.value)}
                                  className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-[10px]"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Flight PNR Code
                                </label>
                                <input
                                  type="text"
                                  value={vFlightPnr}
                                  onChange={(e) =>
                                    setVFlightPnr(e.target.value)
                                  }
                                  className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-[10px] font-mono"
                                  placeholder="GX4HS6"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Issue Date
                                </label>
                                <input
                                  type="date"
                                  value={vIssueDate}
                                  onChange={(e) =>
                                    setVIssueDate(e.target.value)
                                  }
                                  className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-[10px]"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Reservation ID
                                </label>
                                <input
                                  type="text"
                                  value={vResNumber}
                                  onChange={(e) =>
                                    setVResNumber(e.target.value)
                                  }
                                  className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-[10px] font-mono"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Total Refunded (£)
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={vTotalRefunded}
                                  onChange={(e) =>
                                    setVTotalRefunded(e.target.value)
                                  }
                                  className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-[10px]"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 mb-0.5">
                                  Notes
                                </label>
                                <input
                                  type="text"
                                  value={vNotes}
                                  onChange={(e) => setVNotes(e.target.value)}
                                  className="w-full border border-slate-200 rounded px-2 py-1 bg-white outline-none text-[10px]"
                                />
                              </div>
                            </div>

                            <div className="flex justify-end pt-1">
                              <button
                                type="submit"
                                disabled={actionLoading}
                                className="bg-primary-600 text-white font-bold text-[9px] px-3 py-1 rounded hover:bg-primary-500"
                              >
                                {actionLoading
                                  ? "RECORDING..."
                                  : "LOG COST INVOICE"}
                              </button>
                            </div>
                          </form>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Cost cards list matching vertical key-value screenshots */}
                    {booking.vendorPayments.length === 0 ? (
                      <p className="text-[10px] text-slate-400 text-center py-6 bg-slate-50/20 font-medium rounded-lg border border-slate-200">
                        No vendor costs tracked.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {booking.vendorPayments.map((v) => (
                          <div
                            key={v.id}
                            className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm"
                          >
                            {/* Invoice detail table */}
                            <table className="w-full text-left border-collapse text-[10.5px]">
                              <tbody>
                                <tr className="border-b border-slate-200">
                                  <td className="px-3 py-1.5 bg-slate-50/50 font-bold text-slate-500 w-1/3 border-r border-slate-200">
                                    ID
                                  </td>
                                  <td className="px-3 py-1.5 text-slate-800 font-mono">
                                    {v.id}
                                  </td>
                                </tr>
                                <tr className="border-b border-slate-200">
                                  <td className="px-3 py-1.5 bg-slate-50/50 font-bold text-slate-500 border-r border-slate-200">
                                    VENDOR
                                  </td>
                                  <td className="px-3 py-1.5">
                                    <a
                                      href="#"
                                      className="text-amber-600 hover:text-amber-700 font-bold underline"
                                    >
                                      {v.vendorName}
                                    </a>
                                  </td>
                                </tr>
                                <tr className="border-b border-slate-200">
                                  <td className="px-3 py-1.5 bg-slate-50/50 font-bold text-slate-500 border-r border-slate-200">
                                    AMOUNT
                                  </td>
                                  <td className="px-3 py-1.5 text-slate-800 font-bold">
                                    £{formatPrice(v.amount)}
                                  </td>
                                </tr>
                                <tr className="border-b border-slate-200">
                                  <td className="px-3 py-1.5 bg-slate-50/50 font-bold text-slate-500 border-r border-slate-200">
                                    PAYMENT STATUS
                                  </td>
                                  <td className="px-3 py-1.5">
                                    <span
                                      className={`inline-block px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider ${
                                        v.paymentStatus === "paid"
                                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                          : "bg-amber-100 text-amber-800 border border-amber-200"
                                      }`}
                                    >
                                      {v.paymentStatus}
                                    </span>
                                  </td>
                                </tr>
                                <tr className="border-b border-slate-200">
                                  <td className="px-3 py-1.5 bg-slate-50/50 font-bold text-slate-500 border-r border-slate-200">
                                    PAID ON
                                  </td>
                                  <td className="px-3 py-1.5 text-slate-700">
                                    {formatDate(v.paidOn)}
                                  </td>
                                </tr>
                                <tr className="border-b border-slate-200">
                                  <td className="px-3 py-1.5 bg-slate-50/50 font-bold text-slate-500 border-r border-slate-200">
                                    FLIGHT PNR
                                  </td>
                                  <td className="px-3 py-1.5 text-slate-700 font-mono">
                                    {v.flightPnr || "EMPTY"}
                                  </td>
                                </tr>
                                <tr className="border-b border-slate-200">
                                  <td className="px-3 py-1.5 bg-slate-50/50 font-bold text-slate-500 border-r border-slate-200">
                                    ISSUE DATE
                                  </td>
                                  <td className="px-3 py-1.5 text-slate-700">
                                    {formatDate(v.issueDate)}
                                  </td>
                                </tr>
                                <tr className="border-b border-slate-200">
                                  <td className="px-3 py-1.5 bg-slate-50/50 font-bold text-slate-500 border-r border-slate-200">
                                    RESERVATION NUMBER
                                  </td>
                                  <td className="px-3 py-1.5 text-slate-700 font-mono">
                                    {v.reservationNumber || "EMPTY"}
                                  </td>
                                </tr>
                                <tr className="border-b border-slate-200">
                                  <td className="px-3 py-1.5 bg-slate-50/50 font-bold text-slate-500 border-r border-slate-200">
                                    NOTES
                                  </td>
                                  <td className="px-3 py-1.5 text-slate-500 leading-normal">
                                    {v.notes || "EMPTY"}
                                  </td>
                                </tr>
                                <tr className="border-b border-slate-200">
                                  <td className="px-3 py-1.5 bg-slate-50/50 font-bold text-slate-500 border-r border-slate-200">
                                    TOTAL PAID
                                  </td>
                                  <td className="px-3 py-1.5 text-slate-800">
                                    £{formatPrice(v.totalPaid)}
                                  </td>
                                </tr>
                                <tr className="border-b border-slate-200">
                                  <td className="px-3 py-1.5 bg-slate-50/50 font-bold text-slate-500 border-r border-slate-200">
                                    TOTAL REFUNDED
                                  </td>
                                  <td className="px-3 py-1.5 text-slate-800">
                                    £{formatPrice(v.totalRefunded)}
                                  </td>
                                </tr>
                                <tr>
                                  <td className="px-3 py-1.5 bg-slate-50/50 font-bold text-slate-500 border-r border-slate-200">
                                    REMAINING DUE
                                  </td>
                                  <td className="px-3 py-1.5 text-rose-600 font-bold">
                                    £{formatPrice(v.remainingDue)}
                                  </td>
                                </tr>
                              </tbody>
                            </table>

                            {/* Sub Transactions block */}
                            <div className="border-t border-slate-200 bg-slate-50/50 px-3 py-2 text-[10px] text-slate-500">
                              <span className="font-bold text-slate-700 block mb-1">
                                Transactions
                              </span>
                              <a
                                href="#"
                                className="text-primary-500 hover:text-primary-700 underline text-[10px] font-semibold"
                                onClick={(e) => e.preventDefault()}
                              >
                                No Transactions
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* -------------------------------------------
                    TAB: FLIGHT SERVICES
                    ------------------------------------------- */}
                {activeTab === "flightServices" && (
                  <div className="w-full animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-slate-900 text-white px-4 py-2 font-bold text-[11px] uppercase tracking-wider rounded-t-lg shadow-sm flex justify-between items-center">
                      <span>Flight Services</span>
                      <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="bg-primary-600 hover:bg-primary-500 px-3 py-1.5 rounded-md shadow transition-colors text-[10px]"
                      >
                        {showAddForm ? "Cancel" : "+ Add Flight"}
                      </button>
                    </div>
                    {showAddForm && (
                      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                          <div className="bg-slate-900 text-white px-4 py-3 font-bold text-[12px] uppercase tracking-wider flex justify-between items-center">
                            <span>Add Flight Service</span>
                            <button
                              type="button"
                              onClick={() => setShowAddForm(false)}
                              className="text-white/60 hover:text-white"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="p-4 bg-slate-50">
                            <form
                              onSubmit={handleAddFlight}
                              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
                            >
                              {Object.keys(flightForm).map((key) => (
                                <div key={key}>
                                  <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    {key.replace(/([A-Z])/g, " $1").trim()}
                                  </label>
                                  <input
                                    type={
                                      key.toLowerCase().includes("date")
                                        ? "date"
                                        : key.toLowerCase().includes("time")
                                          ? "time"
                                          : key
                                                .toLowerCase()
                                                .includes("amount") ||
                                              key === "price"
                                            ? "number"
                                            : "text"
                                    }
                                    step={
                                      key.toLowerCase().includes("amount") ||
                                      key === "price"
                                        ? "0.01"
                                        : undefined
                                    }
                                    value={(flightForm as any)[key]}
                                    onChange={(e) =>
                                      setFlightForm({
                                        ...flightForm,
                                        [key]: e.target.value,
                                      })
                                    }
                                    required={[
                                      "vendorName",
                                      "flightNo",
                                      "pnr",
                                      "departedFrom",
                                      "arrivedAt",
                                      "price",
                                    ].includes(key)}
                                    className="w-full border border-slate-200 rounded px-2 py-1.5 text-[11px] outline-none focus:border-primary-500"
                                  />
                                </div>
                              ))}
                              <div className="col-span-full flex justify-end mt-4 pt-4 border-t border-slate-200 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setShowAddForm(false)}
                                  className="px-4 py-2 text-slate-500 font-bold text-[11px] hover:bg-slate-200 rounded"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  disabled={actionLoading}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 px-4 rounded shadow disabled:opacity-50 text-[11px]"
                                >
                                  {actionLoading
                                    ? "Saving..."
                                    : "Save Flight Service"}
                                </button>
                              </div>
                            </form>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="bg-white border border-slate-200 border-t-0 rounded-b-lg overflow-x-auto shadow-sm">
                      <table className="w-full text-left border-collapse whitespace-nowrap min-w-max text-[10px]">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-2.5">DATE</th>
                            <th className="px-3 py-2.5">VENDOR</th>
                            <th className="px-3 py-2.5">FLIGHT NO</th>
                            <th className="px-3 py-2.5">PNR</th>
                            <th className="px-3 py-2.5">DEPARTED FROM</th>
                            <th className="px-3 py-2.5">ARRIVED AT</th>
                            <th className="px-3 py-2.5">DEPART TIME</th>
                            <th className="px-3 py-2.5">ARRIVAL TIME</th>
                            <th className="px-3 py-2.5">PRICE</th>
                            <th className="px-3 py-2.5">CURRENCY</th>
                            <th className="px-3 py-2.5">ISSUE DATE</th>
                            <th className="px-3 py-2.5">REFUND AMOUNT</th>
                            <th className="px-3 py-2.5">FINE AMOUNT</th>
                            <th className="px-3 py-2.5">BAGGAGE</th>
                            <th className="px-3 py-2.5">CARRY ON BAGGAGE</th>
                            <th className="px-3 py-2.5">CHECKED BAGGAGE</th>
                            <th className="px-3 py-2.5">FLIGHT CLASS</th>
                            <th className="px-3 py-2.5">ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(booking.flightServices?.length
                            ? booking.flightServices
                            : []
                          ).map((v, i) => (
                            <tr
                              key={v.id || i}
                              className={
                                i % 2 === 0
                                  ? "bg-white hover:bg-slate-50/50"
                                  : "bg-slate-50/50 hover:bg-slate-100/50"
                              }
                            >
                              <td className="px-3 py-2.5 text-slate-600 font-medium">
                                {formatDate(v.date)}
                              </td>
                              <td className="px-3 py-2.5">
                                <a
                                  href="#"
                                  className="text-amber-500 hover:text-amber-600 underline font-semibold"
                                >
                                  {v.vendorName}
                                </a>
                              </td>
                              <td className="px-3 py-2.5 text-slate-700">
                                {v.flightNo}
                              </td>
                              <td className="px-3 py-2.5 text-slate-700 font-mono">
                                {v.pnr}
                              </td>
                              <td className="px-3 py-2.5 text-slate-700 whitespace-pre-wrap min-w-[120px] leading-tight">
                                {v.departedFrom}
                              </td>
                              <td className="px-3 py-2.5 text-slate-700 whitespace-pre-wrap min-w-[120px] leading-tight">
                                {v.arrivedAt}
                              </td>
                              <td className="px-3 py-2.5 text-slate-700">
                                {v.departTime}
                              </td>
                              <td className="px-3 py-2.5 text-slate-700">
                                {v.arrivalTime}
                              </td>
                              <td className="px-3 py-2.5 text-slate-700 font-semibold">
                                {formatPrice(v.price)}
                              </td>
                              <td className="px-3 py-2.5 text-slate-600 uppercase">
                                {v.currency || "GBP"}
                              </td>
                              <td className="px-3 py-2.5 text-slate-600">
                                {formatDate(v.issueDate)}
                              </td>
                              <td className="px-3 py-2.5 text-slate-600">
                                {formatPrice(v.refundAmount)}
                              </td>
                              <td className="px-3 py-2.5 text-slate-600">
                                {formatPrice(v.fineAmount)}
                              </td>
                              <td className="px-3 py-2.5 text-slate-700 whitespace-pre-wrap min-w-[100px] leading-tight">
                                {v.baggage || ""}
                              </td>
                              <td className="px-3 py-2.5 text-slate-700">
                                {v.carryOnBaggage || ""}
                              </td>
                              <td className="px-3 py-2.5 text-slate-700">
                                {v.checkedBaggage || ""}
                              </td>
                              <td className="px-3 py-2.5 text-slate-700">
                                {v.flightClass || "Economy"}
                              </td>
                              <td className="px-3 py-2.5">
                                <button className="bg-primary-600 hover:bg-primary-500 text-white px-3 py-1 rounded-full font-bold text-[9px] shadow-sm transition-colors uppercase">
                                  Voucher
                                </button>
                              </td>
                            </tr>
                          ))}
                          {(!booking.flightServices ||
                            booking.flightServices.length === 0) && (
                            <tr>
                              <td
                                colSpan={18}
                                className="px-3 py-8 text-center text-slate-400 font-medium"
                              >
                                No Flight Services recorded.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* -------------------------------------------
                    TAB: TRANSPORT SERVICES
                    ------------------------------------------- */}
                {activeTab === "transportServices" && (
                  <div className="w-full animate-in fade-in zoom-in-95 duration-200 flex flex-col gap-3">
                    <div>
                      <div className="bg-slate-900 text-white px-4 py-2 font-bold text-[11px] uppercase tracking-wider rounded-t-lg shadow-sm flex justify-between items-center">
                        <span>Transport Services</span>
                        <button
                          onClick={() => setShowAddForm(!showAddForm)}
                          className="bg-primary-600 hover:bg-primary-500 px-3 py-1.5 rounded-md shadow transition-colors text-[10px]"
                        >
                          {showAddForm ? "Cancel" : "+ Add Transport"}
                        </button>
                      </div>
                      {showAddForm && (
                        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="bg-slate-900 text-white px-4 py-3 font-bold text-[12px] uppercase tracking-wider flex justify-between items-center">
                              <span>Add Transport Service</span>
                              <button
                                type="button"
                                onClick={() => setShowAddForm(false)}
                                className="text-white/60 hover:text-white"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="p-4 bg-slate-50">
                              <form
                                onSubmit={handleAddTransport}
                                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
                              >
                                {Object.keys(transportForm).map((key) => (
                                  <div key={key}>
                                    <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                      {key.replace(/([A-Z])/g, " $1").trim()}
                                    </label>
                                    <input
                                      type={
                                        key.toLowerCase().includes("date")
                                          ? "date"
                                          : key.toLowerCase().includes("time")
                                            ? "time"
                                            : key
                                                  .toLowerCase()
                                                  .includes("amount") ||
                                                key === "price" ||
                                                key
                                                  .toLowerCase()
                                                  .includes("rate")
                                              ? "number"
                                              : "text"
                                      }
                                      step={
                                        key.toLowerCase().includes("amount") ||
                                        key === "price" ||
                                        key.toLowerCase().includes("rate")
                                          ? "0.01"
                                          : undefined
                                      }
                                      value={(transportForm as any)[key]}
                                      onChange={(e) =>
                                        setTransportForm({
                                          ...transportForm,
                                          [key]: e.target.value,
                                        })
                                      }
                                      required={[
                                        "vendorName",
                                        "vehicleType",
                                        "departureDestination",
                                        "arrivalDestination",
                                        "price",
                                      ].includes(key)}
                                      className="w-full border border-slate-200 rounded px-2 py-1.5 text-[11px] outline-none focus:border-primary-500"
                                    />
                                  </div>
                                ))}
                                <div className="col-span-full flex justify-end mt-4 pt-4 border-t border-slate-200 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setShowAddForm(false)}
                                    className="px-4 py-2 text-slate-500 font-bold text-[11px] hover:bg-slate-200 rounded"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 px-4 rounded shadow disabled:opacity-50 text-[11px]"
                                  >
                                    {actionLoading
                                      ? "Saving..."
                                      : "Save Transport Service"}
                                  </button>
                                </div>
                              </form>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="bg-white border border-slate-200 border-t-0 rounded-b-lg overflow-x-auto shadow-sm">
                        <table className="w-full text-left border-collapse whitespace-nowrap min-w-max text-[10px]">
                          <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                            <tr>
                              <th className="px-3 py-2.5">VENDOR</th>
                              <th className="px-3 py-2.5">VEHICLE TYPE</th>
                              <th className="px-3 py-2.5">
                                DEPARTURE DESTINATION
                              </th>
                              <th className="px-3 py-2.5">
                                ARRIVAL DESTINATION
                              </th>
                              <th className="px-3 py-2.5">DATE</th>
                              <th className="px-3 py-2.5">DEPARTURE TIME</th>
                              <th className="px-3 py-2.5">ARRIVAL TIME</th>
                              <th className="px-3 py-2.5">FLIGHT NO</th>
                              <th className="px-3 py-2.5">PRICE</th>
                              <th className="px-3 py-2.5">CURRENCY</th>
                              <th className="px-3 py-2.5">OTHER CURRENCY</th>
                              <th className="px-3 py-2.5">CONVERSION RATE</th>
                              <th className="px-3 py-2.5">ISSUE DATE</th>
                              <th className="px-3 py-2.5">REFUND AMOUNT</th>
                              <th className="px-3 py-2.5">FINE AMOUNT</th>
                              <th className="px-3 py-2.5">ACTIONS</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(booking.transportServices?.length
                              ? booking.transportServices
                              : []
                            ).map((v, i) => (
                              <tr
                                key={v.id || i}
                                className={
                                  i % 2 === 0
                                    ? "bg-white hover:bg-slate-50/50"
                                    : "bg-slate-50/50 hover:bg-slate-100/50"
                                }
                              >
                                <td className="px-3 py-2.5">
                                  <a
                                    href="#"
                                    className="text-amber-500 hover:text-amber-600 underline font-semibold"
                                  >
                                    {v.vendorName}
                                  </a>
                                </td>
                                <td className="px-3 py-2.5 text-slate-700">
                                  {v.vehicleType}
                                </td>
                                <td className="px-3 py-2.5 text-slate-700 whitespace-pre-wrap min-w-[120px] leading-tight">
                                  {v.departureDestination}
                                </td>
                                <td className="px-3 py-2.5 text-slate-700 whitespace-pre-wrap min-w-[120px] leading-tight">
                                  {v.arrivalDestination}
                                </td>
                                <td className="px-3 py-2.5 text-slate-600 font-medium">
                                  {formatDate(v.date)}
                                </td>
                                <td className="px-3 py-2.5 text-slate-700">
                                  {v.departureTime}
                                </td>
                                <td className="px-3 py-2.5 text-slate-700">
                                  {v.arrivalTime}
                                </td>
                                <td className="px-3 py-2.5 text-slate-700">
                                  {v.flightNo}
                                </td>
                                <td className="px-3 py-2.5 text-slate-700 font-semibold">
                                  {formatPrice(v.price)}
                                </td>
                                <td className="px-3 py-2.5 text-slate-600 uppercase">
                                  {v.currency || ""}
                                </td>
                                <td className="px-3 py-2.5 text-slate-600 uppercase">
                                  {v.otherCurrency || ""}
                                </td>
                                <td className="px-3 py-2.5 text-slate-600">
                                  {v.conversionRate || ""}
                                </td>
                                <td className="px-3 py-2.5 text-slate-600">
                                  {formatDate(v.issueDate)}
                                </td>
                                <td className="px-3 py-2.5 text-slate-600">
                                  {formatPrice(v.refundAmount)}
                                </td>
                                <td className="px-3 py-2.5 text-slate-600">
                                  {formatPrice(v.fineAmount)}
                                </td>
                                <td className="px-3 py-2.5">
                                  <button className="bg-primary-600 hover:bg-primary-500 text-white px-3 py-1 rounded-full font-bold text-[9px] shadow-sm transition-colors uppercase">
                                    Voucher
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {(!booking.transportServices ||
                              booking.transportServices.length === 0) && (
                              <tr>
                                <td
                                  colSpan={16}
                                  className="px-3 py-8 text-center text-slate-400 font-medium"
                                >
                                  No Transport Services recorded.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div>
                      <button className="bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-full font-bold text-[10px] shadow-sm transition-colors mt-2 uppercase tracking-wide">
                        Generate Individual Vendor Transport Voucher
                      </button>
                    </div>
                  </div>
                )}

                {/* -------------------------------------------
                    TAB: VISA SERVICES
                    ------------------------------------------- */}
                {activeTab === "visaServices" && (
                  <div className="w-full animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-slate-900 text-white px-4 py-2 font-bold text-[11px] uppercase tracking-wider rounded-t-lg shadow-sm flex justify-between items-center">
                      <span>Visa Services</span>
                      <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="bg-primary-600 hover:bg-primary-500 px-3 py-1.5 rounded-md shadow transition-colors text-[10px]"
                      >
                        {showAddForm ? "Cancel" : "+ Add Visa"}
                      </button>
                    </div>
                    {showAddForm && (
                      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                          <div className="bg-slate-900 text-white px-4 py-3 font-bold text-[12px] uppercase tracking-wider flex justify-between items-center">
                            <span>Add Visa Service</span>
                            <button
                              type="button"
                              onClick={() => setShowAddForm(false)}
                              className="text-white/60 hover:text-white"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="p-4 bg-slate-50">
                            <form
                              onSubmit={handleAddVisa}
                              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
                            >
                              {Object.keys(visaForm).map((key) => (
                                <div key={key}>
                                  <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    {key.replace(/([A-Z])/g, " $1").trim()}
                                  </label>
                                  <input
                                    type={
                                      key.toLowerCase().includes("date")
                                        ? "date"
                                        : key.toLowerCase().includes("time")
                                          ? "time"
                                          : key
                                                .toLowerCase()
                                                .includes("amount") ||
                                              key === "price" ||
                                              key.toLowerCase().includes("rate")
                                            ? "number"
                                            : "text"
                                    }
                                    step={
                                      key.toLowerCase().includes("amount") ||
                                      key === "price" ||
                                      key.toLowerCase().includes("rate")
                                        ? "0.01"
                                        : undefined
                                    }
                                    value={(visaForm as any)[key]}
                                    onChange={(e) =>
                                      setVisaForm({
                                        ...visaForm,
                                        [key]: e.target.value,
                                      })
                                    }
                                    required={[
                                      "vendorName",
                                      "passportNumber",
                                      "visaType",
                                      "price",
                                    ].includes(key)}
                                    className="w-full border border-slate-200 rounded px-2 py-1.5 text-[11px] outline-none focus:border-primary-500"
                                  />
                                </div>
                              ))}
                              <div className="col-span-full flex justify-end mt-4 pt-4 border-t border-slate-200 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setShowAddForm(false)}
                                  className="px-4 py-2 text-slate-500 font-bold text-[11px] hover:bg-slate-200 rounded"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  disabled={actionLoading}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 px-4 rounded shadow disabled:opacity-50 text-[11px]"
                                >
                                  {actionLoading
                                    ? "Saving..."
                                    : "Save Visa Service"}
                                </button>
                              </div>
                            </form>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="bg-white border border-slate-200 border-t-0 rounded-b-lg overflow-x-auto shadow-sm">
                      <table className="w-full text-left border-collapse whitespace-nowrap min-w-max text-[10px]">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-2.5">VENDOR</th>
                            <th className="px-3 py-2.5">PASSPORT NUMBER</th>
                            <th className="px-3 py-2.5">VISA TYPE</th>
                            <th className="px-3 py-2.5">VISA NUMBER</th>
                            <th className="px-3 py-2.5">ISSUE DATE</th>
                            <th className="px-3 py-2.5">EXPIRY DATE</th>
                            <th className="px-3 py-2.5">PRICE</th>
                            <th className="px-3 py-2.5">CURRENCY</th>
                            <th className="px-3 py-2.5">OTHER CURRENCY</th>
                            <th className="px-3 py-2.5">CONVERSION RATE</th>
                            <th className="px-3 py-2.5">REFUND AMOUNT</th>
                            <th className="px-3 py-2.5">FINE AMOUNT</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(booking.visaServices?.length
                            ? booking.visaServices
                            : []
                          ).map((v, i) => (
                            <tr
                              key={v.id || i}
                              className={
                                i % 2 === 0
                                  ? "bg-white hover:bg-slate-50/50"
                                  : "bg-slate-50/50 hover:bg-slate-100/50"
                              }
                            >
                              <td className="px-3 py-2.5">
                                <a
                                  href="#"
                                  className="text-amber-500 hover:text-amber-600 underline font-semibold"
                                >
                                  {v.vendorName}
                                </a>
                              </td>
                              <td className="px-3 py-2.5 text-slate-700">
                                {v.passportNumber}
                              </td>
                              <td className="px-3 py-2.5 text-slate-700">
                                {v.visaType}
                              </td>
                              <td className="px-3 py-2.5 text-slate-700">
                                {v.visaNumber}
                              </td>
                              <td className="px-3 py-2.5 text-slate-600">
                                {formatDate(v.issueDate)}
                              </td>
                              <td className="px-3 py-2.5 text-slate-600">
                                {formatDate(v.expiryDate)}
                              </td>
                              <td className="px-3 py-2.5 text-slate-700 font-semibold">
                                {formatPrice(v.price)}
                              </td>
                              <td className="px-3 py-2.5 text-slate-600 uppercase">
                                {v.currency || ""}
                              </td>
                              <td className="px-3 py-2.5 text-slate-600 uppercase">
                                {v.otherCurrency || ""}
                              </td>
                              <td className="px-3 py-2.5 text-slate-600">
                                {v.conversionRate || ""}
                              </td>
                              <td className="px-3 py-2.5 text-slate-600">
                                {formatPrice(v.refundAmount)}
                              </td>
                              <td className="px-3 py-2.5 text-slate-600">
                                {formatPrice(v.fineAmount)}
                              </td>
                            </tr>
                          ))}
                          {(!booking.visaServices ||
                            booking.visaServices.length === 0) && (
                            <tr>
                              <td
                                colSpan={12}
                                className="px-3 py-8 text-center text-slate-400 font-medium"
                              >
                                No Visa Services recorded.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* -------------------------------------------
                    TAB: INVOICE
                    ------------------------------------------- */}
                {activeTab === "invoice" && (
                  <div className="w-full animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-slate-900 text-white px-4 py-3 font-bold text-[11px] uppercase tracking-wider rounded-t-lg shadow-sm">
                      Invoice
                    </div>
                    <div className="bg-white border border-slate-200 border-t-0 rounded-b-lg shadow-sm p-4 relative">
                      <table className="w-full text-left border-collapse text-[11px] font-semibold">
                        <tbody>
                          <tr className="border-b border-slate-100">
                            <td className="py-3 px-2 text-slate-500 w-1/4">
                              TOTAL AMOUNT
                            </td>
                            <td className="py-3 px-2 text-slate-800">
                              {formatPrice(booking.totalPrice)}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-100">
                            <td className="py-3 px-2 text-slate-500">
                              PAID AMOUNT
                            </td>
                            <td className="py-3 px-2 text-slate-800">
                              {formatPrice(booking.paidAmount)}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-100">
                            <td className="py-3 px-2 text-slate-500">
                              REMAINING AMOUNT
                            </td>
                            <td className="py-3 px-2 text-slate-800">
                              {formatPrice(booking.remainingAmount)}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-100">
                            <td className="py-3 px-2 text-slate-500">
                              ISSUED AT
                            </td>
                            <td className="py-3 px-2 text-slate-800">
                              {formatDate(booking.date)}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-3 px-2 text-slate-500">STATUS</td>
                            <td className="py-3 px-2 text-slate-800">
                              {booking.paymentStatus}
                            </td>
                          </tr>
                        </tbody>
                      </table>

                      <div className="mt-4 flex justify-between items-end border-t border-slate-100 pt-4">
                        <a
                          href="#"
                          className="text-primary-600 hover:text-primary-500 underline text-[10px] font-bold pb-1 block"
                        >
                          View Invoice
                        </a>
                        <button
                          onClick={() => setShowCalculator((prev) => !prev)}
                          className="bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-lg font-bold text-[11px] shadow-sm transition-colors flex items-center gap-1.5"
                        >
                          <Calculator className="w-3.5 h-3.5" />
                          Calculator
                        </button>
                      </div>

                      {/* Inline Calculator Overlay within Invoice tab */}
                      {showCalculator && (
                        <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-4 shadow-sm animate-in fade-in slide-in-from-top-2">
                          <h5 className="text-[11px] font-bold text-slate-700 mb-3">
                            Quick Cost Calculator
                          </h5>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[10px] font-semibold text-slate-600">
                            <div>
                              <label className="block text-slate-400 mb-1">
                                Total Invoice (£)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                defaultValue={parseFloat(
                                  booking?.totalPrice || "0",
                                ).toFixed(2)}
                                className="w-full border border-slate-200 rounded px-2.5 py-1.5 bg-white outline-none text-[11px]"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-400 mb-1">
                                Total Vendor Cost (£)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                defaultValue={booking?.vendorPayments
                                  .reduce(
                                    (s, v) => s + parseFloat(v.amount || "0"),
                                    0,
                                  )
                                  .toFixed(2)}
                                className="w-full border border-slate-200 rounded px-2.5 py-1.5 bg-white outline-none text-[11px]"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-400 mb-1 text-emerald-600 font-bold">
                                Gross Profit (£)
                              </label>
                              <div className="w-full border border-emerald-200 bg-emerald-50 rounded px-2.5 py-1.5 text-emerald-700 font-black text-[11px]">
                                £
                                {(
                                  parseFloat(booking?.totalPrice || "0") -
                                  booking?.vendorPayments.reduce(
                                    (s, v) => s + parseFloat(v.amount || "0"),
                                    0,
                                  )
                                ).toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
