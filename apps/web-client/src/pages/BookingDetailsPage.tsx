import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Plus, Users, CreditCard, Hotel, FileText, Lock, Unlock, Clock, 
  ArrowLeft, Calculator, X, User, AlertCircle, Receipt, Upload, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { api } from '../api/axios';
import { useAuthStore } from '../store/authStore';
import { useCurrency } from '../utils/currency';

// Interfaces matching the updated Prisma schema
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
  agentName: string | null;
  role: string | null;
}

interface Payment {
  id: number;
  amount: string;
  paymentMethod: string;
  paymentType: string;
  paidOn: string;
  notes: string | null;
  status?: string;
  evidenceUrl?: string | null;
  loggedByRole?: string | null;
  loggedByName?: string | null;
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
  refundAmount: string;
  fineAmount: string;
  hotelConfirmationNumber: string | null;
  hotelAddress: string | null;
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
}

export function BookingDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { symbol, format } = useCurrency();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Active form modal type
  const [activeModal, setActiveModal] = useState<'none' | 'passenger' | 'payment' | 'vendor' | 'accommodation'>('none');
  
  // Interactive mini calculator widget toggles
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [calcBase, setCalcBase] = useState('');
  const [calcTax, setCalcTax] = useState('');
  const [calcMarkup, setCalcMarkup] = useState('');
  const [calcResult, setCalcResult] = useState<number | null>(null);

  // Form Fields - Passenger
  const [pTitle, setPTitle] = useState('Mr');
  const [pFirstName, setPFirstName] = useState('');
  const [pLastName, setPLastName] = useState('');
  const [pAgeCategory, setPAgeCategory] = useState('Adult');
  const [pEmail, setPEmail] = useState('');
  const [pPhone, setPPhone] = useState('');
  const [pPassport, setPPassport] = useState('');
  const [pPassportExpiry, setPPassportExpiry] = useState('');
  const [pRole, setPRole] = useState('Family Member');

  // Form Fields - Payment Transaction
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Bank Transfer');
  const [payType, setPayType] = useState('Instalment');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payNotes, setPayNotes] = useState('');
  const [payEvidenceUrl, setPayEvidenceUrl] = useState('');
  const [uploadingEvidence, setUploadingEvidence] = useState(false);

  // Form Fields - Vendor Payment
  const [vName, setVName] = useState('');
  const [vAmount, setVAmount] = useState('');
  const [vStatus, setVStatus] = useState('unpaid');
  const [vFlightPnr, setVFlightPnr] = useState('');
  const [vIssueDate, setVIssueDate] = useState('');
  const [vResNumber, setVResNumber] = useState('');
  const [vNotes, setVNotes] = useState('');
  const [vTotalPaid, setVTotalPaid] = useState('0');

  // Form Fields - Accommodation
  const [aHotelName, setAHotelName] = useState('');
  const [aVendorName, setAVendorName] = useState('');
  const [aRoomType, setARoomType] = useState('Double');
  const [aCheckIn, setACheckIn] = useState('');
  const [aCheckOut, setACheckOut] = useState('');
  const [aMeal, setAMeal] = useState('Room Only');
  const [aQty, setAQty] = useState(1);
  const [aPrice, setAPrice] = useState('');
  const [aResNumber, setAResNumber] = useState('');
  const [aConfNumber, setAConfNumber] = useState('');
  const [aAddress, setAAddress] = useState('');

  useEffect(() => {
    fetchBookingDetails();
  }, [id]);

  const fetchBookingDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/bookings/${id}`);
      setBooking(response.data.booking);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to fetch booking details');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLock = async () => {
    if (!booking) return;
    const newLock = booking.lockedStatus === 'locked' ? 'unlocked' : 'locked';
    try {
      const response = await api.patch(`/bookings/${booking.id}`, { lockedStatus: newLock });
      setBooking({ ...booking, lockedStatus: response.data.booking.lockedStatus });
    } catch (err) {
      console.error('Lock toggle failed:', err);
    }
  };

  const handleAddPassenger = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/bookings/${id}/passengers`, {
        title: pTitle,
        firstName: pFirstName,
        lastName: pLastName,
        ageCategory: pAgeCategory,
        email: pEmail,
        phoneNumber: pPhone,
        passportNumber: pPassport,
        passportExpiryDate: pPassportExpiry || undefined,
        role: pRole,
        agentName: user?.name
      });
      
      // Reset & close
      setPFirstName('');
      setPLastName('');
      setPEmail('');
      setPPhone('');
      setPPassport('');
      setPPassportExpiry('');
      setActiveModal('none');
      fetchBookingDetails();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/bookings/${id}/payments`, {
        amount: parseFloat(payAmount),
        paymentMethod: payMethod,
        paymentType: payType,
        paidOn: payDate,
        notes: payNotes,
        evidenceUrl: payEvidenceUrl || undefined,
        loggedByName: user?.name || undefined
      });

      setPayAmount('');
      setPayNotes('');
      setPayEvidenceUrl('');
      setActiveModal('none');
      fetchBookingDetails();
      toast.success(user?.role === 'AGENT' ? 'Transaction logged for admin approval' : 'Transaction registered successfully');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || 'Failed to register transaction');
    }
  };

  const handleEvidenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingEvidence(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/auth/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setPayEvidenceUrl(response.data.url);
      toast.success('Evidence uploaded successfully');
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to upload evidence');
    } finally {
      setUploadingEvidence(false);
    }
  };

  const handleAddVendorPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/bookings/${id}/vendor-payments`, {
        vendorName: vName,
        amount: parseFloat(vAmount),
        paymentStatus: vStatus,
        flightPnr: vFlightPnr || undefined,
        issueDate: vIssueDate || undefined,
        reservationNumber: vResNumber || undefined,
        notes: vNotes || undefined,
        totalPaid: parseFloat(vTotalPaid)
      });

      setVName('');
      setVAmount('');
      setVFlightPnr('');
      setVResNumber('');
      setVNotes('');
      setVTotalPaid('0');
      setActiveModal('none');
      fetchBookingDetails();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddAccommodation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/bookings/${id}/accommodations`, {
        hotelName: aHotelName,
        vendorName: aVendorName,
        roomType: aRoomType,
        checkInDate: aCheckIn || undefined,
        checkOutDate: aCheckOut || undefined,
        mealType: aMeal,
        qty: aQty,
        price: parseFloat(aPrice),
        reservationNumber: aResNumber || undefined,
        hotelConfirmationNumber: aConfNumber || undefined,
        hotelAddress: aAddress || undefined
      });

      setAHotelName('');
      setAVendorName('');
      setAResNumber('');
      setAConfNumber('');
      setAAddress('');
      setActiveModal('none');
      fetchBookingDetails();
    } catch (err) {
      console.error(err);
    }
  };

  const runCalculator = () => {
    const base = parseFloat(calcBase) || 0;
    const tax = parseFloat(calcTax) || 0;
    const markup = parseFloat(calcMarkup) || 0;
    setCalcResult(base + tax + markup);
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Clock className="h-8 w-8 animate-spin text-primary-600 mr-2" />
        <span className="text-slate-500 font-semibold">Loading booking workspace...</span>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="max-w-2xl mx-auto mt-16 p-8 bg-white border border-red-100 rounded-3xl text-center shadow-lg">
        <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-800">Workspace Error</h2>
        <p className="text-slate-500 mt-2">{error || 'Booking not found'}</p>
        <button 
          onClick={() => navigate('/dashboard')} 
          className="mt-6 inline-flex items-center gap-2 bg-primary-600 text-white px-5 py-2.5 rounded-xl font-semibold shadow-md shadow-primary-500/20 hover:bg-primary-500"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen py-8 px-4 sm:px-6 lg:px-8 relative pb-24">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Back and Page Actions */}
        <div className="flex justify-between items-center">
          <button 
            onClick={() => navigate('/dashboard')} 
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-semibold"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Bookings
          </button>
          
          <div className="flex gap-3">
            <button 
              onClick={handleToggleLock}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-colors shadow-sm ${
                booking.lockedStatus === 'locked' 
                  ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' 
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              {booking.lockedStatus === 'locked' ? (
                <>
                  <Lock className="h-4 w-4" /> Locked Status
                </>
              ) : (
                <>
                  <Unlock className="h-4 w-4" /> Unlocked Status
                </>
              )}
            </button>
          </div>
        </div>

        {/* Hero Section */}
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wider bg-primary-50 text-primary-600 px-3 py-1 rounded-full">
                Workspace PNR
              </span>
              <span className="font-mono text-sm text-slate-400">ID: {booking.id}</span>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Booking Ref: <span className="text-primary-600">{booking.bookingReference}</span>
            </h1>
            <p className="text-slate-500 font-medium flex items-center gap-2">
              <User className="h-4 w-4 text-slate-400" />
              Agent assigned: <span className="text-slate-800 font-semibold">{booking.agentName || 'System Automated'}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="text-center p-2 border-r border-slate-200 last:border-0">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Price</p>
              <p className="text-lg font-bold text-slate-900 mt-1">{format(booking.totalPrice)}</p>
            </div>
            <div className="text-center p-2 border-r border-slate-200 last:border-0">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Paid Amount</p>
              <p className="text-lg font-bold text-emerald-600 mt-1">{format(booking.paidAmount)}</p>
            </div>
            <div className="text-center p-2 border-r border-slate-200 last:border-0">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Remaining</p>
              <p className="text-lg font-bold text-red-500 mt-1">{format(booking.remainingAmount)}</p>
            </div>
            <div className="text-center p-2">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Status</p>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold mt-1 ${
                booking.paymentStatus === 'paid' 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                  : booking.paymentStatus === 'partially_paid'
                  ? 'bg-amber-50 text-amber-700 border border-amber-100'
                  : 'bg-red-50 text-red-700 border border-red-100'
              }`}>
                {booking.paymentStatus.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Grid Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Info Blocks */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Passengers Block */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary-600" />
                  <h3 className="font-bold text-slate-900">Passengers</h3>
                </div>
                <button 
                  onClick={() => setActiveModal('passenger')}
                  className="flex items-center gap-1.5 text-xs font-bold text-primary-600 bg-primary-50 px-3 py-1.5 rounded-xl hover:bg-primary-100 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Passenger
                </button>
              </div>

              {booking.customers.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  No passengers associated with this booking record.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase bg-slate-50/20">
                        <th className="px-6 py-3">Title</th>
                        <th className="px-6 py-3">Full Name</th>
                        <th className="px-6 py-3">Category</th>
                        <th className="px-6 py-3">Email & Phone</th>
                        <th className="px-6 py-3">Passport Expiry</th>
                        <th className="px-6 py-3">Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                      {booking.customers.map(c => (
                        <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-3.5 text-slate-400">{c.title || 'Mr'}</td>
                          <td className="px-6 py-3.5 font-bold text-slate-900">{c.firstName} {c.lastName}</td>
                          <td className="px-6 py-3.5">
                            <span className={`inline-block px-2 py-0.5 rounded-full font-semibold ${
                              c.ageCategory === 'Adult' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {c.ageCategory}
                            </span>
                          </td>
                          <td className="px-6 py-3.5">
                            <div>{c.email || 'N/A'}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{c.phoneNumber || ''}</div>
                          </td>
                          <td className="px-6 py-3.5 font-mono text-slate-500">
                            {c.passportExpiryDate ? new Date(c.passportExpiryDate).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="px-6 py-3.5 text-slate-500">{c.role || 'Member'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Accommodation Services */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <Hotel className="h-5 w-5 text-primary-600" />
                  <h3 className="font-bold text-slate-900">Accommodation Services</h3>
                </div>
                <button 
                  onClick={() => setActiveModal('accommodation')}
                  className="flex items-center gap-1.5 text-xs font-bold text-primary-600 bg-primary-50 px-3 py-1.5 rounded-xl hover:bg-primary-100 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Book Hotel
                </button>
              </div>

              {booking.accommodations.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  No accommodation services registered for this stay.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase bg-slate-50/20">
                        <th className="px-6 py-3">Vendor & Hotel</th>
                        <th className="px-6 py-3">Room & Meal</th>
                        <th className="px-6 py-3">Dates</th>
                        <th className="px-6 py-3">Qty & Price</th>
                        <th className="px-6 py-3">Conf Number</th>
                        <th className="px-6 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                      {booking.accommodations.map(a => (
                        <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-3.5">
                            <div className="font-bold text-slate-900">{a.hotelName}</div>
                            <div className="text-[10px] text-primary-600 font-bold uppercase">{a.vendorName}</div>
                          </td>
                          <td className="px-6 py-3.5">
                            <div>{a.roomType || 'Standard'}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{a.mealType || 'Breakfast included'}</div>
                          </td>
                          <td className="px-6 py-3.5 font-mono text-slate-500">
                            <div>{a.checkInDate ? new Date(a.checkInDate).toLocaleDateString() : 'N/A'}</div>
                            <div className="text-[10px] text-slate-400">to {a.checkOutDate ? new Date(a.checkOutDate).toLocaleDateString() : 'N/A'}</div>
                          </td>
                          <td className="px-6 py-3.5">
                            <span className="font-bold text-slate-800">{format(a.price)}</span>
                            <span className="text-slate-400 text-[10px] ml-1">x {a.qty}</span>
                          </td>
                          <td className="px-6 py-3.5 font-mono text-slate-500">{a.hotelConfirmationNumber || 'Pending'}</td>
                          <td className="px-6 py-3.5">
                            <button className="bg-primary-600 text-white font-semibold text-[10px] px-2.5 py-1 rounded-lg hover:bg-primary-500">
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

            {/* Vendor Payments */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary-600" />
                  <h3 className="font-bold text-slate-900">Vendor Payments</h3>
                </div>
                <button 
                  onClick={() => setActiveModal('vendor')}
                  className="flex items-center gap-1.5 text-xs font-bold text-primary-600 bg-primary-50 px-3 py-1.5 rounded-xl hover:bg-primary-100 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Record Payment
                </button>
              </div>

              {booking.vendorPayments.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  No vendor invoice details found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase bg-slate-50/20">
                        <th className="px-6 py-3">Vendor Name</th>
                        <th className="px-6 py-3">PNR / Reservation</th>
                        <th className="px-6 py-3">Cost Amount</th>
                        <th className="px-6 py-3">Paid / Remaining</th>
                        <th className="px-6 py-3">Payment Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                      {booking.vendorPayments.map(v => (
                        <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-3.5 font-bold text-slate-900">{v.vendorName}</td>
                          <td className="px-6 py-3.5 font-mono text-slate-500">
                            <div>PNR: {v.flightPnr || 'N/A'}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">Res: {v.reservationNumber || 'N/A'}</div>
                          </td>
                          <td className="px-6 py-3.5 font-bold text-slate-800">{format(v.amount)}</td>
                          <td className="px-6 py-3.5">
                            <div className="text-emerald-600">Paid: {format(v.totalPaid)}</div>
                            <div className="text-red-500 text-[10px] mt-0.5">Due: {format(v.remainingDue)}</div>
                          </td>
                          <td className="px-6 py-3.5">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                              v.paymentStatus === 'paid' 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                : 'bg-amber-50 text-amber-700 border border-amber-100'
                            }`}>
                              {v.paymentStatus.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>

          {/* Right Sidebar - Financials & Transactions */}
          <div className="space-y-8">
            
            {/* Booking Details / Status Fields */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
                <FileText className="h-4.5 w-4.5 text-primary-600" />
                Ledger Settings
              </h3>
              
              <div className="space-y-3.5 text-xs font-semibold text-slate-500">
                <div className="flex justify-between items-center">
                  <span>Booking Reference</span>
                  <span className="font-mono text-slate-900 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                    {booking.bookingReference}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Creation Date</span>
                  <span className="text-slate-900 font-mono">
                    {new Date(booking.date).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Departure Date</span>
                  <span className="text-slate-900 font-mono">
                    {booking.departureDate ? new Date(booking.departureDate).toLocaleDateString() : 'Pending'}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                  <span>Card Charges</span>
                  <span className="text-slate-800">{format(booking.cardPaymentCharges)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Cancellation Fees</span>
                  <span className="text-slate-800">{format(booking.cancellationCharges)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Refund Amount</span>
                  <span className="text-slate-800 text-red-500">- {format(booking.refundAmount)}</span>
                </div>
              </div>
            </div>

            {/* Transactions / Payments Block */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4.5 w-4.5 text-primary-600" />
                  <h3 className="font-bold text-slate-900 text-sm">Transactions</h3>
                </div>
                <button 
                  onClick={() => setActiveModal('payment')}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-primary-600 transition-colors"
                  title="Add Transaction"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {booking.payments.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No payment transactions recorded yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {booking.payments.map(p => (
                    <div key={p.id} className="p-4 hover:bg-slate-50/30 transition-colors flex justify-between items-start gap-3">
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900">{format(p.amount)}</span>
                          {/* Status Badge */}
                          <span className={`inline-block px-1.5 py-0.2 rounded text-[8px] font-extrabold tracking-wide uppercase ${
                            p.status === 'pending'
                              ? 'bg-amber-50 text-amber-600 border border-amber-100'
                              : p.status === 'rejected'
                              ? 'bg-rose-50 text-rose-600 border border-rose-100'
                              : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          }`}>
                            {p.status || 'approved'}
                          </span>
                        </div>
                        <div className="text-slate-400 text-[10px] mt-0.5 font-mono flex items-center gap-1.5 flex-wrap">
                          <span>{p.paymentMethod} • {p.paymentType}</span>
                          {p.loggedByName && (
                            <span className="text-slate-400/80">({p.loggedByName})</span>
                          )}
                        </div>
                        {p.notes && <p className="text-[10px] text-slate-500 italic mt-1 font-medium break-words leading-relaxed">{p.notes}</p>}
                        
                        {/* Evidence Attachment */}
                        {p.evidenceUrl && (
                          <div className="mt-1.5">
                            <a 
                              href={p.evidenceUrl} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="inline-flex items-center gap-1 text-[9px] font-extrabold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-lg border border-indigo-100/50 transition-colors"
                            >
                              <Receipt className="w-3 h-3 text-indigo-500" /> Receipt Screenshot
                            </a>
                          </div>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono shrink-0">
                        {new Date(p.paidOn).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

      {/* Floating Modern Calculator Trigger */}
      <div className="fixed bottom-6 right-6 z-40">
        <button 
          onClick={() => setIsCalculatorOpen(!isCalculatorOpen)}
          className="bg-amber-500 hover:bg-amber-600 text-white p-4 rounded-full shadow-lg shadow-amber-500/30 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
          title="Calculator Helper"
        >
          <Calculator className="h-6 w-6" />
        </button>
      </div>

      {/* Floating Calculator Overlay */}
      <AnimatePresence>
        {isCalculatorOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-40 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-800 p-5 w-80 space-y-4"
          >
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <Calculator className="h-4 w-4 text-amber-500" />
                Ledger Calculator
              </h4>
              <button 
                onClick={() => setIsCalculatorOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">{`Base Price (${symbol})`}</label>
                <input 
                  type="number" 
                  value={calcBase}
                  onChange={e => setCalcBase(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 text-white"
                  placeholder="e.g. 500.00"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">{`Taxes / Fees (${symbol})`}</label>
                <input 
                  type="number" 
                  value={calcTax}
                  onChange={e => setCalcTax(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 text-white"
                  placeholder="e.g. 45.00"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">{`Agent Markup (${symbol})`}</label>
                <input 
                  type="number" 
                  value={calcMarkup}
                  onChange={e => setCalcMarkup(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 text-white"
                  placeholder="e.g. 100.00"
                />
              </div>
              
              <button 
                onClick={runCalculator}
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold py-2 rounded-lg transition-colors mt-2"
              >
                Calculate Sum
              </button>

              {calcResult !== null && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center mt-3">
                  <p className="text-slate-400 text-[10px] uppercase font-semibold">Calculated Total</p>
                  <p className="text-xl font-bold text-amber-500 mt-1">{symbol}{calcResult.toFixed(2)}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slide-over / Modal Form System */}
      <AnimatePresence>
        {activeModal !== 'none' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveModal('none')}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-lg p-6 relative z-10 overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              
              {/* Passenger Modal Form */}
              {activeModal === 'passenger' && (
                <form onSubmit={handleAddPassenger} className="space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 bg-primary-50 text-primary-600 rounded-xl">
                      <Users className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">Add Passenger</h3>
                      <p className="text-slate-500 text-xs">Register passenger details to this workspace manifest.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Title</label>
                      <select 
                        value={pTitle}
                        onChange={e => setPTitle(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-2 py-2 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                      >
                        <option>Mr</option>
                        <option>Mrs</option>
                        <option>Ms</option>
                        <option>Miss</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-500 mb-1">First Name</label>
                      <input 
                        type="text" 
                        required 
                        value={pFirstName}
                        onChange={e => setPFirstName(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="John"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Last Name</label>
                      <input 
                        type="text" 
                        required 
                        value={pLastName}
                        onChange={e => setPLastName(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Age Group</label>
                      <select 
                        value={pAgeCategory}
                        onChange={e => setPAgeCategory(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-2 py-2 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                      >
                        <option>Adult</option>
                        <option>Youth</option>
                        <option>Child</option>
                        <option>Infant</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Email</label>
                      <input 
                        type="email" 
                        value={pEmail}
                        onChange={e => setPEmail(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="john.doe@domain.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Phone Number</label>
                      <input 
                        type="text" 
                        value={pPhone}
                        onChange={e => setPPhone(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="e.g. +44 7815..."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Passport Number</label>
                      <input 
                        type="text" 
                        value={pPassport}
                        onChange={e => setPPassport(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Passport Expiry Date</label>
                      <input 
                        type="date" 
                        value={pPassportExpiry}
                        onChange={e => setPPassportExpiry(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                      {pPassportExpiry && new Date(pPassportExpiry) <= new Date(new Date().setMonth(new Date().getMonth() + 6)) && (
                        <div className="mt-2 text-[10px] flex items-center gap-1.5 text-red-600 bg-red-50 p-1.5 rounded border border-red-100 font-semibold">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Warning: Passport expires in 6 months or less.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Role / Assignment</label>
                    <select 
                      value={pRole}
                      onChange={e => setPRole(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-2 py-2 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                    >
                      <option>Leader</option>
                      <option>Family Member</option>
                      <option>Company Guest</option>
                    </select>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button 
                      type="button" 
                      onClick={() => setActiveModal('none')}
                      className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-semibold text-slate-500"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="bg-primary-600 hover:bg-primary-500 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md shadow-primary-500/20"
                    >
                      Save Passenger
                    </button>
                  </div>
                </form>
              )}

              {/* Payment / Transaction Form */}
              {activeModal === 'payment' && (
                <form onSubmit={handleAddPayment} className="space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 bg-primary-50 text-primary-600 rounded-xl">
                      <CreditCard className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">Record Transaction</h3>
                      <p className="text-slate-500 text-xs">Record incoming customer payment towards the ledger.</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">{`Payment Amount (${symbol})`}</label>
                    <input 
                      type="number" 
                      step="0.01"
                      required 
                      value={payAmount}
                      onChange={e => setPayAmount(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                      placeholder="e.g. 4215.00"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Payment Method</label>
                      <select 
                        value={payMethod}
                        onChange={e => setPayMethod(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-2 py-2 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                      >
                        <option>Bank Transfer</option>
                        <option>Card Payment</option>
                        <option>Cash</option>
                        <option>Direct Debit</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Transaction Type</label>
                      <select 
                        value={payType}
                        onChange={e => setPayType(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-2 py-2 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                      >
                        <option>Instalment</option>
                        <option>Full Payment</option>
                        <option>Security Deposit</option>
                        <option>Margin Paid to Agent</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Payment Date</label>
                    <input 
                      type="date" 
                      required
                      value={payDate}
                      onChange={e => setPayDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Reference Notes</label>
                    <textarea 
                      value={payNotes}
                      onChange={e => setPayNotes(e.target.value)}
                      rows={3}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                      placeholder="Enter optional description..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                      Evidence / Receipt Screenshot {user?.role === 'AGENT' && <span className="text-rose-500 font-bold">*</span>}
                    </label>
                    
                    {payEvidenceUrl ? (
                      <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <div className="flex items-center gap-2.5 truncate">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0">
                            <img src={payEvidenceUrl} alt="Receipt preview" className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-bold text-slate-700 truncate text-left">Evidence uploaded successfully</p>
                            <a href={payEvidenceUrl} target="_blank" rel="noreferrer" className="text-[10px] text-indigo-600 hover:text-indigo-700 underline font-medium">View Full Image</a>
                          </div>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setPayEvidenceUrl('')}
                          className="p-1 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                          title="Remove upload"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="relative border-2 border-dashed border-slate-200 hover:border-primary-400 rounded-xl p-4 transition-colors bg-slate-50/50 flex flex-col items-center justify-center text-center cursor-pointer">
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={handleEvidenceUpload}
                          disabled={uploadingEvidence}
                          required={user?.role === 'AGENT'}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                        />
                        {uploadingEvidence ? (
                          <div className="flex flex-col items-center gap-2 py-1">
                            <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
                            <span className="text-[11px] font-semibold text-slate-500">Uploading screenshot to storage...</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <div className="p-2 bg-slate-100 text-slate-500 rounded-lg border border-slate-200">
                              <Upload className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-[11px] font-bold text-slate-700 block">Click to upload bank transfer screenshot</span>
                              <span className="text-[9px] text-slate-400 block mt-0.5">JPEG, PNG up to 10MB</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button 
                      type="button" 
                      onClick={() => setActiveModal('none')}
                      className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-semibold text-slate-500"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="bg-primary-600 hover:bg-primary-500 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md shadow-primary-500/20"
                    >
                      Record Transaction
                    </button>
                  </div>
                </form>
              )}

              {/* Vendor Payment Form */}
              {activeModal === 'vendor' && (
                <form onSubmit={handleAddVendorPayment} className="space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 bg-primary-50 text-primary-600 rounded-xl">
                      <Receipt className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">Add Vendor Invoice</h3>
                      <p className="text-slate-500 text-xs">Record supplier costs and balances for flights/activities.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Vendor Name</label>
                      <input 
                        type="text" 
                        required 
                        value={vName}
                        onChange={e => setVName(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="e.g. Polani Travel Ltd"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">{`Total Cost Amount (${symbol})`}</label>
                      <input 
                        type="number" 
                        step="0.01"
                        required 
                        value={vAmount}
                        onChange={e => setVAmount(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="3736.90"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Flight PNR</label>
                      <input 
                        type="text" 
                        value={vFlightPnr}
                        onChange={e => setVFlightPnr(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary-500 outline-none font-mono"
                        placeholder="GX4HS6"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Reservation Number</label>
                      <input 
                        type="text" 
                        value={vResNumber}
                        onChange={e => setVResNumber(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary-500 outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Issue Date</label>
                      <input 
                        type="date" 
                        value={vIssueDate}
                        onChange={e => setVIssueDate(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">{`Paid Amount to Vendor (${symbol})`}</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={vTotalPaid}
                        onChange={e => setVTotalPaid(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Payment Status</label>
                    <select 
                      value={vStatus}
                      onChange={e => setVStatus(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-2 py-2 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                    >
                      <option value="unpaid">Unpaid</option>
                      <option value="partially_paid">Partially Paid</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Invoice Notes</label>
                    <textarea 
                      value={vNotes}
                      onChange={e => setVNotes(e.target.value)}
                      rows={2}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button 
                      type="button" 
                      onClick={() => setActiveModal('none')}
                      className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-semibold text-slate-500"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="bg-primary-600 hover:bg-primary-500 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md shadow-primary-500/20"
                    >
                      Save Invoice
                    </button>
                  </div>
                </form>
              )}

              {/* Accommodation service Form */}
              {activeModal === 'accommodation' && (
                <form onSubmit={handleAddAccommodation} className="space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 bg-primary-50 text-primary-600 rounded-xl">
                      <Hotel className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">Add Hotel Stay</h3>
                      <p className="text-slate-500 text-xs">Record hotel accommodation reservation details.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Hotel Name</label>
                      <input 
                        type="text" 
                        required 
                        value={aHotelName}
                        onChange={e => setAHotelName(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="e.g. Al Shohda Hotel"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Vendor / Provider</label>
                      <input 
                        type="text" 
                        required 
                        value={aVendorName}
                        onChange={e => setAVendorName(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="e.g. Emaar Group"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Room Type</label>
                      <input 
                        type="text" 
                        value={aRoomType}
                        onChange={e => setARoomType(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="e.g. Quad Room"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Meal Plan</label>
                      <input 
                        type="text" 
                        value={aMeal}
                        onChange={e => setAMeal(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="Breakfast included"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Check In Date</label>
                      <input 
                        type="date" 
                        value={aCheckIn}
                        onChange={e => setACheckIn(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Check Out Date</label>
                      <input 
                        type="date" 
                        value={aCheckOut}
                        onChange={e => setACheckOut(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Qty</label>
                      <input 
                        type="number" 
                        value={aQty}
                        onChange={e => setAQty(parseInt(e.target.value) || 1)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-500 mb-1">{`Price per Room (${symbol})`}</label>
                      <input 
                        type="number" 
                        step="0.01"
                        required 
                        value={aPrice}
                        onChange={e => setAPrice(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Reservation Number</label>
                      <input 
                        type="text" 
                        value={aResNumber}
                        onChange={e => setAResNumber(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary-500 outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Confirmation Number</label>
                      <input 
                        type="text" 
                        value={aConfNumber}
                        onChange={e => setAConfNumber(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary-500 outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Hotel Address</label>
                    <textarea 
                      value={aAddress}
                      onChange={e => setAAddress(e.target.value)}
                      rows={2}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button 
                      type="button" 
                      onClick={() => setActiveModal('none')}
                      className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-semibold text-slate-500"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="bg-primary-600 hover:bg-primary-500 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md shadow-primary-500/20"
                    >
                      Save Stay
                    </button>
                  </div>
                </form>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
