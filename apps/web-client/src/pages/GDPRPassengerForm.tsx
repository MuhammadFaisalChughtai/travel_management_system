import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { 
  Shield, AlertTriangle, CheckCircle, Mail, Phone, Calendar, 
  User, FileText, Check, ChevronRight, 
  ChevronLeft, AlertCircle, Info, Upload, Plus, Trash2
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { AnimatePresence } from 'framer-motion';
import { PassportOcrScannerModal } from '../components/booking-modals/PassportOcrScannerModal';
import { ManageAdditionalDocumentsModal } from '../components/booking-modals/ManageAdditionalDocumentsModal';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

interface PassengerData {
  id: number;
  title: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  passportNumber: string;
  passportExpiryDate: string;
  dob: string;
  passportImage: string;
  ageCategory: string;
  role: string;
  nationality?: string;
  issuingCountry?: string;
  documents?: any[];
}

export default function GDPRPassengerForm() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [bookingRef, setBookingRef] = useState('');
  const [companyName, setCompanyName] = useState('');

  // Form State
  const [passengers, setPassengers] = useState<PassengerData[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [gdprConsent, setGdprConsent] = useState(false);

  // Checklist options & Modal triggers
  const [collectPassport, setCollectPassport] = useState(true);
  const [collectAdditional, setCollectAdditional] = useState(false);
  const [showOcrScanner, setShowOcrScanner] = useState(false);
  const [showManageDocuments, setShowManageDocuments] = useState(false);

  const currentPassenger = passengers[activeIdx];

  // Sync checklist state when switching active passenger
  useEffect(() => {
    if (currentPassenger) {
      setCollectPassport(true);
      setCollectAdditional(!!(currentPassenger.documents && currentPassenger.documents.length > 0));
    }
  }, [activeIdx, currentPassenger?.id]);

  useEffect(() => {
    const fetchPassengerInfo = async () => {
      if (!token) {
        setErrorMsg('Invalid or missing security token.');
        setLoading(false);
        return;
      }
      try {
        const res = await axios.get(`${API_BASE_URL}/public/passenger-info/${encodeURIComponent(token)}`);
        const { passengers: fetchedPassengers, bookingReference, companyName: brandName, primaryPassengerId: primaryId } = res.data;

        setBookingRef(bookingReference || '');
        setCompanyName(brandName || 'Your Travel Provider');

        // Map passengers to standard form format (ensuring fields are never null/undefined)
        const mapped = (fetchedPassengers || []).map((p: any) => ({
          id: p.id,
          title: p.title || '',
          firstName: p.firstName || '',
          lastName: p.lastName || '',
          email: p.email || '',
          phoneNumber: p.phoneNumber || '',
          passportNumber: p.passportNumber || '',
          passportExpiryDate: p.passportExpiryDate ? new Date(p.passportExpiryDate).toISOString().split('T')[0] : '',
          dob: p.dob ? new Date(p.dob).toISOString().split('T')[0] : '',
          passportImage: p.passportImage || '',
          ageCategory: p.ageCategory || 'Adult',
          role: p.role || 'Passenger',
          nationality: p.nationality || '',
          issuingCountry: p.issuingCountry || '',
          documents: p.documents || []
        }));

        setPassengers(mapped);
        
        // Find index of primary passenger to activate it first
        const pIdx = mapped.findIndex((p: any) => p.id === primaryId);
        setActiveIdx(pIdx !== -1 ? pIdx : 0);
        setLoading(false);
      } catch (err: any) {
        console.error('Failed to load passenger info:', err);
        const serverMsg = err?.response?.data?.message || err?.message || 'The link is invalid, expired, or unavailable.';
        setErrorMsg(serverMsg);
        setLoading(false);
      }
    };

    fetchPassengerInfo();
  }, [token]);



  const updateField = (idx: number, field: keyof PassengerData, value: any) => {
    setPassengers(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };

  const handleAddPassenger = () => {
    const tempId = Math.floor(Math.random() * -100000);
    const newPassenger: PassengerData = {
      id: tempId,
      title: '',
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      passportNumber: '',
      passportExpiryDate: '',
      dob: '',
      passportImage: '',
      ageCategory: 'Adult',
      role: 'Passenger',
      nationality: '',
      issuingCountry: '',
      documents: []
    };
    setPassengers([...passengers, newPassenger]);
    setActiveIdx(passengers.length);
    toast.success('New traveler added! Please fill in their details.');
  };

  const handleRemovePassenger = (idxToRemove: number) => {
    if (passengers.length <= 1) {
      toast.error('At least one traveler is required.');
      return;
    }
    const passengerToRemove = passengers[idxToRemove];
    if (passengerToRemove.id > 0) {
      toast.error('Only newly added travelers can be removed.');
      return;
    }
    
    const newPassengers = passengers.filter((_, idx) => idx !== idxToRemove);
    setPassengers(newPassengers);
    
    // Adjust active index
    if (activeIdx >= newPassengers.length) {
      setActiveIdx(newPassengers.length - 1);
    } else if (activeIdx === idxToRemove && activeIdx > 0) {
      setActiveIdx(activeIdx - 1);
    }
    toast.success('Traveler removed.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Verification check for all fields
    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];
      if (!p.firstName.trim() || !p.lastName.trim()) {
        toast.error(`Passenger #${i + 1} (${p.role || 'Passenger'}): First Name and Last Name are required.`);
        setActiveIdx(i);
        return;
      }
    }

    if (!gdprConsent) {
      toast.error('You must consent to the privacy policy to submit your information.');
      return;
    }

    setSubmitting(true);
    try {
      await axios.put(`${API_BASE_URL}/public/passenger-info/${encodeURIComponent(token!)}`, {
        passengers,
        gdprConsent
      });
      setSuccess(true);
      toast.success('Travel details submitted securely!');
    } catch (err: any) {
      console.error('Submission failed:', err);
      const serverMsg = err?.response?.data?.message || err?.message || 'Failed to submit traveler information.';
      toast.error(serverMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const isPassengerComplete = (p: PassengerData) => {
    return !!(
      p.firstName.trim() && 
      p.lastName.trim() && 
      p.passportNumber.trim() && 
      p.passportExpiryDate && 
      p.dob && 
      p.passportImage &&
      p.nationality?.trim() &&
      p.issuingCountry?.trim()
    );
  };

  const getMissingFields = (p: PassengerData) => {
    const missing = [];
    if (!p.firstName.trim()) missing.push('First Name');
    if (!p.lastName.trim()) missing.push('Last Name');
    if (!p.passportNumber.trim()) missing.push('Passport Number');
    if (!p.passportExpiryDate) missing.push('Passport Expiry');
    if (!p.dob) missing.push('Date of Birth');
    if (!p.passportImage) missing.push('Passport Copy');
    if (!p.nationality?.trim()) missing.push('Nationality');
    if (!p.issuingCountry?.trim()) missing.push('Issuing Country');
    return missing;
  };

  const calculateAgeCategory = (dobString: string) => {
    if (!dobString) return;
    const birthDate = new Date(dobString);
    if (isNaN(birthDate.getTime())) return;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    if (age < 2) {
      return "Infant";
    } else if (age < 15) {
      return "Child";
    } else {
      return "Adult";
    }
  };

  const getPassportExpiryStatus = (expiryDateStr?: string) => {
    if (!expiryDateStr) return null;
    const expiryDate = new Date(expiryDateStr);
    if (isNaN(expiryDate.getTime())) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiryDate.setHours(0, 0, 0, 0);

    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(today.getMonth() + 6);
    sixMonthsFromNow.setHours(0, 0, 0, 0);

    if (expiryDate < today) {
      return {
        type: "expired",
        message: "Passport has expired!",
        bgColor: "bg-rose-500/10",
        textColor: "text-rose-400",
        borderColor: "border-rose-500/20",
        iconColor: "text-rose-450"
      };
    } else if (expiryDate < sixMonthsFromNow) {
      return {
        type: "warning",
        message: "Passport is going to expire within the next 6 months!",
        bgColor: "bg-amber-500/10",
        textColor: "text-amber-400",
        borderColor: "border-amber-500/20",
        iconColor: "text-amber-400"
      };
    }
    return null;
  };

  // Auto-calculate and update age category whenever current passenger's DOB changes
  useEffect(() => {
    if (currentPassenger?.dob) {
      const category = calculateAgeCategory(currentPassenger.dob);
      if (category && category !== currentPassenger.ageCategory) {
        updateField(activeIdx, 'ageCategory', category);
      }
    }
  }, [currentPassenger?.dob, activeIdx]);

  const leaderIndex = passengers.findIndex(p => p.role === 'Leader' || p.role === 'leader') !== -1 
    ? passengers.findIndex(p => p.role === 'Leader' || p.role === 'leader') 
    : 0;
  const isCurrentLeader = activeIdx === leaderIndex;

  const handleApplyLeaderContact = (field: 'email' | 'phoneNumber') => {
    const leader = passengers[leaderIndex];
    if (leader) {
      updateField(activeIdx, field, leader[field] || '');
      toast.success(`Copied ${field === 'email' ? 'email address' : 'phone number'} from booking leader.`);
    } else {
      toast.error('No leader passenger found to copy from.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070A13] flex items-center justify-center p-4">
        <div className="relative flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-6 text-slate-400 font-semibold animate-pulse tracking-wider text-sm">Establishing Secure AES-256 Connection...</p>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-[#070A13] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl text-center">
          <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-rose-500/20">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-white mb-2 tracking-tight">Secure Connection Failed</h2>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">{errorMsg}</p>
          <div className="text-[11px] text-slate-500 bg-slate-950/50 p-4 rounded-xl border border-slate-900">
            If you believe this is a mistake, please contact your travel booking advisor directly.
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#070A13] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl text-center">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20 animate-bounce">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Submission Successful</h2>
          <p className="text-emerald-400 font-bold text-sm mb-4">Travel details encrypted & stored</p>
          <p className="text-slate-300 text-sm mb-6 leading-relaxed">
            Your passport information and passenger details have been successfully uploaded for Booking Reference <strong>{bookingRef}</strong>. You may safely close this tab now.
          </p>
          <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 flex items-center gap-3 justify-center text-[11px] text-slate-400">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>GDPR Compliant Database Encryption Enabled</span>
          </div>
        </div>
      </div>
    );
  }

  // currentPassenger is defined at the top of the component

  return (
    <div className="min-h-screen bg-[#070A13] text-slate-100 flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      <Toaster position="top-right" />
      
      {/* Dynamic Glowwatermarks */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-5xl w-full mx-auto flex flex-col gap-6 relative z-10">
        
        {/* Sleek Top Branding Strip */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">{companyName}</h1>
            <p className="text-slate-400 text-xs mt-0.5 font-bold uppercase tracking-wider">Booking Reference: <span className="text-indigo-400 font-extrabold">{bookingRef}</span></p>
          </div>
          <div className="bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 text-slate-300">
            <Shield className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> Secure GDPR Link
          </div>
        </div>

        {/* Main Workspace: Sidebar + active form */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          
          {/* Passenger Tabs Sidebar (Always shown if passengers.length >= 1) */}
          {passengers.length >= 1 && (
            <div className="w-full lg:w-[280px] bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-4 shrink-0 space-y-4">
              <div className="flex justify-between items-center px-2 mb-1">
                <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Travelers List</h3>
                <span className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full text-[9px] font-extrabold border border-indigo-500/20">
                  {passengers.length} total
                </span>
              </div>
              
              <div className="space-y-1.5 max-h-[350px] lg:max-h-none overflow-y-auto pr-1">
                {passengers.map((p, idx) => {
                  const complete = isPassengerComplete(p);
                  const isActive = idx === activeIdx;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setActiveIdx(idx)}
                      className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        isActive 
                          ? 'bg-gradient-to-r from-blue-600/10 to-indigo-600/15 border-blue-500/50 text-white shadow-lg shadow-blue-500/5' 
                          : 'bg-slate-950/20 border-slate-800/80 text-slate-400 hover:bg-slate-800/35 hover:text-slate-200'
                      }`}
                    >
                      <div className="truncate min-w-0 flex-1">
                        <p className="text-[12px] font-bold truncate">
                          {p.firstName || p.lastName ? `${p.firstName} ${p.lastName}` : `Traveler #${idx + 1}`}
                        </p>
                        <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider block mt-0.5">
                          {p.role || 'Passenger'} &bull; {p.ageCategory}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {p.id < 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemovePassenger(idx);
                            }}
                            className="p-1 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 hover:text-rose-350 transition-all cursor-pointer"
                            title="Remove traveler"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {complete ? (
                          <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-550 shrink-0" title="Missing details">
                            <AlertCircle className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleAddPassenger}
                className="w-full py-2.5 px-3 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/25 hover:border-indigo-500/40 text-indigo-400 hover:text-indigo-300 rounded-2xl text-[10px] font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Traveler
              </button>
            </div>
          )}

          {/* Active Passenger Form Card */}
          <div className="flex-1 w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            
            {/* Form Wizard Navigation Bar (Only for multi-passenger bookings) */}
            {passengers.length > 1 && (
              <div className="bg-slate-950/60 border-b border-slate-800/80 px-6 py-3.5 flex justify-between items-center text-xs text-slate-400">
                <span className="font-bold">
                  Editing Traveler <span className="text-white font-extrabold">{activeIdx + 1}</span> of <span className="text-white font-extrabold">{passengers.length}</span>
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={activeIdx === 0}
                    onClick={() => setActiveIdx(prev => prev - 1)}
                    className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900 disabled:hover:text-slate-400 transition-all cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={activeIdx === passengers.length - 1}
                    onClick={() => setActiveIdx(prev => prev + 1)}
                    className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900 disabled:hover:text-slate-400 transition-all cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Main Form Fields */}
            {currentPassenger && (
              <div className="p-8 space-y-6">
                
                {/* Section: Traveler Personal details */}
                <div className="border-b border-slate-800/80 pb-4">
                  <h2 className="text-md font-bold text-white flex items-center gap-2">
                    <User className="w-4.5 h-4.5 text-indigo-400" /> Traveler Profile ({currentPassenger.role || 'Passenger'})
                  </h2>
                  <p className="text-slate-450 text-[11px] mt-0.5">Details must match your passport exactly.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-6 gap-5">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Title</label>
                    <select
                      value={currentPassenger.title}
                      onChange={(e) => updateField(activeIdx, 'title', e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-all cursor-pointer"
                    >
                      <option value="" className="bg-slate-900">Select...</option>
                      <option value="Mr" className="bg-slate-900">Mr</option>
                      <option value="Mrs" className="bg-slate-900">Mrs</option>
                      <option value="Ms" className="bg-slate-900">Ms</option>
                      <option value="Miss" className="bg-slate-900">Miss</option>
                      <option value="Dr" className="bg-slate-900">Dr</option>
                      <option value="Prof" className="bg-slate-900">Prof</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">First Name(s)</label>
                    <input
                      type="text"
                      required
                      value={currentPassenger.firstName}
                      onChange={(e) => updateField(activeIdx, 'firstName', e.target.value)}
                      placeholder="As printed on passport"
                      className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none transition-all"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Last Name / Surname</label>
                    <input
                      type="text"
                      required
                      value={currentPassenger.lastName}
                      onChange={(e) => updateField(activeIdx, 'lastName', e.target.value)}
                      placeholder="As printed on passport"
                      className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none transition-all"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Age Category</label>
                    <select
                      value={currentPassenger.ageCategory}
                      onChange={(e) => updateField(activeIdx, 'ageCategory', e.target.value)}
                      className="w-full bg-slate-955/60 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-all cursor-pointer"
                    >
                      <option value="Adult" className="bg-slate-900">Adult</option>
                      <option value="Child" className="bg-slate-900">Child</option>
                      <option value="Infant" className="bg-slate-900">Infant</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Date of Birth (DOB) *</label>
                    <div className="relative">
                      <Calendar className="absolute right-4 top-3.5 w-4 h-4 text-slate-550 pointer-events-none" />
                      <input
                        type="date"
                        required
                        max={new Date().toISOString().split('T')[0]}
                        value={currentPassenger.dob}
                        onChange={(e) => {
                          updateField(activeIdx, 'dob', e.target.value);
                          const category = calculateAgeCategory(e.target.value);
                          if (category) {
                            updateField(activeIdx, 'ageCategory', category);
                          }
                        }}
                        className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Nationality</label>
                    <input
                      type="text"
                      placeholder="e.g. United Kingdom"
                      value={currentPassenger.nationality || ''}
                      onChange={(e) => updateField(activeIdx, 'nationality', e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-650 focus:outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Section: Contact Details */}
                <div className="border-b border-slate-800/80 pb-4 pt-2">
                  <h2 className="text-md font-bold text-white flex items-center gap-2">
                    <Mail className="w-4.5 h-4.5 text-indigo-400" /> Contact Details
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Email Address</label>
                      {!isCurrentLeader && (
                        <button
                          type="button"
                          onClick={() => handleApplyLeaderContact('email')}
                          className="text-[9px] text-indigo-400 hover:text-indigo-300 hover:underline font-extrabold uppercase tracking-wide transition-all"
                        >
                          Same as Leader
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Mail className="absolute left-4 top-3.5 w-4 h-4 text-slate-550" />
                      <input
                        type="email"
                        value={currentPassenger.email}
                        onChange={(e) => updateField(activeIdx, 'email', e.target.value)}
                        placeholder="name@example.com"
                        className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 rounded-xl pl-11 pr-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Phone Number</label>
                      {!isCurrentLeader && (
                        <button
                          type="button"
                          onClick={() => handleApplyLeaderContact('phoneNumber')}
                          className="text-[9px] text-indigo-400 hover:text-indigo-300 hover:underline font-extrabold uppercase tracking-wide transition-all"
                        >
                          Same as Leader
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Phone className="absolute left-4 top-3.5 w-4 h-4 text-slate-550" />
                      <input
                        type="tel"
                        value={currentPassenger.phoneNumber}
                        onChange={(e) => updateField(activeIdx, 'phoneNumber', e.target.value)}
                        placeholder="+44 7123 456789"
                        className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 rounded-xl pl-11 pr-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Section: Passport details & Upload */}
                <div className="border-b border-slate-800/80 pb-4 pt-2">
                  <h2 className="text-md font-bold text-white flex items-center gap-2">
                    <FileText className="w-4.5 h-4.5 text-indigo-400" /> Passport Verification
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Passport Number *</label>
                    <input
                      type="text"
                      required
                      value={currentPassenger.passportNumber}
                      onChange={(e) => updateField(activeIdx, 'passportNumber', e.target.value)}
                      placeholder="Enter passport number"
                      className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-655 focus:outline-none transition-all uppercase font-mono tracking-wider"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Issuing Country</label>
                    <input
                      type="text"
                      placeholder="e.g. United Kingdom"
                      value={currentPassenger.issuingCountry || ''}
                      onChange={(e) => updateField(activeIdx, 'issuingCountry', e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-655 focus:outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Passport Expiry Date *</label>
                    <div className="relative">
                      <Calendar className="absolute right-4 top-3.5 w-4 h-4 text-slate-550 pointer-events-none" />
                      <input
                        type="date"
                        required
                        value={currentPassenger.passportExpiryDate}
                        onChange={(e) => updateField(activeIdx, 'passportExpiryDate', e.target.value)}
                        className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Expiry Warning Alert Banner */}
                {(() => {
                  const status = getPassportExpiryStatus(currentPassenger.passportExpiryDate);
                  if (!status) return null;
                  return (
                    <div className={`mt-3 flex items-center gap-2 p-3 ${status.bgColor} ${status.textColor} rounded-xl border ${status.borderColor} text-[11px] font-bold`}>
                      <AlertTriangle className={`w-4 h-4 ${status.iconColor} shrink-0`} />
                      <span>{status.message}</span>
                    </div>
                  );
                })()}

                {/* Documents to Collect Checklist */}
                <div className="border border-slate-800/80 rounded-2xl p-5 space-y-3 bg-slate-950/20">
                  <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5 border-b border-slate-800/50 pb-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                    DOCUMENTS TO COLLECT
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex items-center gap-3 p-3 bg-slate-955/60 hover:bg-slate-900/40 border border-slate-800 rounded-xl cursor-pointer transition-all">
                      <input
                        type="checkbox"
                        checked={collectPassport}
                        onChange={(e) => setCollectPassport(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-650 focus:ring-0 border-slate-800 bg-slate-900 checked:bg-indigo-650 checked:border-indigo-650 accent-indigo-600 cursor-pointer"
                      />
                      <span className="text-[11px] font-bold text-slate-300">
                        Collect Passport details & scan
                      </span>
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-slate-955/60 hover:bg-slate-900/40 border border-slate-800 rounded-xl cursor-pointer transition-all">
                      <input
                        type="checkbox"
                        checked={collectAdditional}
                        onChange={(e) => setCollectAdditional(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-650 focus:ring-0 border-slate-800 bg-slate-900 checked:bg-indigo-650 checked:border-indigo-650 accent-indigo-600 cursor-pointer"
                      />
                      <span className="text-[11px] font-bold text-slate-300">
                        Collect Additional documents
                      </span>
                    </label>
                  </div>
                </div>

                {/* Passport Scan Panel */}
                {collectPassport && (
                  <div className="border border-slate-800/80 rounded-2xl p-5 space-y-3 bg-slate-950/20">
                    <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-800/50 pb-1.5">
                      <FileText className="w-3.5 h-3.5 text-indigo-400" />
                      PASSPORT SCAN / PHOTO
                    </h4>
                    {currentPassenger.passportImage ? (
                      <div className="p-3.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-emerald-455" />
                          <span className="text-[11px] font-bold">
                            Passport Scan Uploaded
                          </span>
                        </div>
                        <div className="flex gap-3.5 text-[10px] font-extrabold uppercase tracking-wider">
                          <a
                            href={currentPassenger.passportImage}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-400 hover:text-white transition-colors"
                          >
                            View
                          </a>
                          <button
                            type="button"
                            onClick={() => setShowOcrScanner(true)}
                            className="text-indigo-400 hover:text-indigo-300 transition-colors"
                          >
                            Replace
                          </button>
                          <button
                            type="button"
                            onClick={() => updateField(activeIdx, 'passportImage', '')}
                            className="text-rose-450 hover:text-rose-350 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => setShowOcrScanner(true)}
                        className="border border-dashed border-slate-800 hover:border-indigo-500/50 rounded-xl p-6 bg-slate-950/20 hover:bg-slate-955/40 flex flex-col items-center justify-center text-center cursor-pointer transition-all"
                      >
                        <Upload className="w-5 h-5 text-indigo-400 mb-2" />
                        <span className="text-[11px] font-bold text-slate-200">
                          Scan or upload passport details page
                        </span>
                        <span className="text-[9px] text-slate-505 mt-1 font-medium">
                          PDF, JPEG, or PNG up to 10MB
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Additional Documents Panel */}
                {collectAdditional && (
                  <div className="border border-slate-800/80 rounded-2xl p-5 space-y-3 bg-slate-950/20">
                    <div className="flex justify-between items-center mb-1 border-b border-slate-800/50 pb-1.5">
                      <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-indigo-400" />
                        ADDITIONAL DOCUMENTS
                      </h4>
                      <span className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full text-[9px] font-extrabold border border-indigo-500/20">
                        {(currentPassenger.documents || []).length} files
                      </span>
                    </div>

                    {(currentPassenger.documents || []).length > 0 && (
                      <div className="max-h-[160px] overflow-y-auto pr-1 space-y-2">
                        {(currentPassenger.documents || []).map((doc, idx) => (
                          <div
                            key={doc.id || idx}
                            className="flex items-center justify-between p-3 border border-slate-800 bg-slate-955/60 rounded-xl text-[11px] hover:border-slate-700 transition-colors"
                          >
                            <span className="font-bold text-slate-200 truncate max-w-[180px]">
                              {doc.title}
                            </span>
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-indigo-400 hover:text-indigo-300 font-extrabold uppercase tracking-wider"
                            >
                              View
                            </a>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowManageDocuments(true)}
                      className="w-full bg-slate-955/60 hover:bg-slate-950 text-slate-300 border border-slate-800 py-3 rounded-xl text-[11px] font-bold transition-all uppercase tracking-wider hover:border-slate-700"
                    >
                      Manage Documents
                    </button>
                  </div>
                )}

                {/* Completeness Warning message */}
                {!isPassengerComplete(currentPassenger) && (
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex gap-3 text-amber-300">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] font-bold">Incomplete details for this traveler</p>
                      <p className="text-[10px] text-slate-450 mt-1 leading-relaxed">
                        Still missing: <span className="font-semibold text-amber-200">{getMissingFields(currentPassenger).join(', ')}</span>. Please make sure to fill all fields before submitting.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Global Footer Submissions Form Section */}
        <form onSubmit={handleSubmit} className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 space-y-5">
          <div className="flex items-start gap-4">
            <div className="relative flex items-center mt-1">
              <input
                type="checkbox"
                id="global-gdpr"
                checked={gdprConsent}
                required
                onChange={(e) => setGdprConsent(e.target.checked)}
                className="peer w-5 h-5 border-2 border-slate-700 bg-slate-955 rounded-md checked:bg-indigo-600 checked:border-indigo-600 focus:ring-0 focus:outline-none cursor-pointer appearance-none transition-all shrink-0"
              />
              <Check className="w-3.5 h-3.5 text-white absolute left-0.5 pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" />
            </div>
            <label htmlFor="global-gdpr" className="text-xs text-slate-350 leading-relaxed font-medium select-none cursor-pointer">
              I explicitly consent to the secure storage and processing of my passport details and all personal traveler information for the sole purpose of booking and delivering travel services, in strict compliance with the <strong className="text-indigo-400">GDPR</strong> and applicable Data Protection regulations. My details will not be used for marketing purposes.
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-sm py-4.5 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Saving Travelers Information...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 text-emerald-300" /> Submit All Travel Details
              </>
            )}
          </button>
        </form>

        {/* Dynamic Branded encrypted footer */}
        <div className="text-center text-[10px] text-slate-500 flex flex-col gap-1 items-center pb-8 mt-2">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-500/80 animate-pulse" />
            <span className="font-semibold uppercase tracking-wider">AES-256 Encrypted Transfer Protocol Active</span>
          </div>
          <span className="font-medium">Powered by {companyName} Travel Systems. All rights reserved.</span>
        </div>
      </div>

      {/* Child modals */}
      <AnimatePresence>
        {showOcrScanner && (
          <PassportOcrScannerModal
            isOpen={showOcrScanner}
            onClose={() => setShowOcrScanner(false)}
            isPublic={true}
            onApply={(ocrData) => {
              updateField(activeIdx, 'firstName', ocrData.firstName || currentPassenger.firstName);
              updateField(activeIdx, 'lastName', ocrData.lastName || currentPassenger.lastName);
              updateField(activeIdx, 'passportNumber', ocrData.passportNumber || currentPassenger.passportNumber);
              updateField(activeIdx, 'dob', ocrData.dob || currentPassenger.dob);
              updateField(activeIdx, 'passportExpiryDate', ocrData.passportExpiryDate || currentPassenger.passportExpiryDate);
              updateField(activeIdx, 'passportImage', ocrData.passportImage || currentPassenger.passportImage);
              updateField(activeIdx, 'nationality', ocrData.nationality || currentPassenger.nationality);
              updateField(activeIdx, 'issuingCountry', ocrData.issuingCountry || currentPassenger.issuingCountry);
              toast.success("Passport OCR details applied!");
            }}
          />
        )}

        {showManageDocuments && (
          <ManageAdditionalDocumentsModal
            isOpen={showManageDocuments}
            onClose={() => setShowManageDocuments(false)}
            bookingId={null}
            isPublic={true}
            documents={currentPassenger.documents || []}
            onChange={(updatedDocs) => {
              updateField(activeIdx, 'documents', updatedDocs);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
