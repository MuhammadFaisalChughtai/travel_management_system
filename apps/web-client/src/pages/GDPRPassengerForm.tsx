import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { 
  Shield, AlertTriangle, CheckCircle, Mail, Phone, Calendar, 
  User, FileText, Check, UploadCloud, Trash2, ChevronRight, 
  ChevronLeft, AlertCircle, Info, Image as ImageIcon
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

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
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [gdprConsent, setGdprConsent] = useState(false);

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
          role: p.role || 'Passenger'
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

  const handlePassportUpload = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds 10MB limit.');
      return;
    }

    setUploadingIdx(idx);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const url = response.data.url;
      setPassengers(prev => prev.map((p, i) => i === idx ? { ...p, passportImage: url } : p));
      toast.success('Passport photo uploaded successfully!');
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(err.response?.data?.error || 'Failed to upload passport photo.');
    } finally {
      setUploadingIdx(null);
    }
  };

  const handleRemovePassport = (idx: number) => {
    setPassengers(prev => prev.map((p, i) => i === idx ? { ...p, passportImage: '' } : p));
    toast.success('Passport photo removed.');
  };

  const updateField = (idx: number, field: keyof PassengerData, value: any) => {
    setPassengers(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
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
    return !!(p.firstName.trim() && p.lastName.trim() && p.passportNumber.trim() && p.passportExpiryDate && p.dob && p.passportImage);
  };

  const getMissingFields = (p: PassengerData) => {
    const missing = [];
    if (!p.firstName.trim()) missing.push('First Name');
    if (!p.lastName.trim()) missing.push('Last Name');
    if (!p.passportNumber.trim()) missing.push('Passport Number');
    if (!p.passportExpiryDate) missing.push('Passport Expiry');
    if (!p.dob) missing.push('Date of Birth');
    if (!p.passportImage) missing.push('Passport Copy');
    return missing;
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
            <span>UK GDPR Compliant Database Encryption Enabled</span>
          </div>
        </div>
      </div>
    );
  }

  const currentPassenger = passengers[activeIdx];

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
          
          {/* Passenger Tabs Sidebar (Only shown if passengers.length > 1) */}
          {passengers.length > 1 && (
            <div className="w-full lg:w-[280px] bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-4 shrink-0 space-y-2.5">
              <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-2 mb-3">Travelers List</h3>
              <div className="space-y-1.5 max-h-[350px] lg:max-h-none overflow-y-auto pr-1">
                {passengers.map((p, idx) => {
                  const complete = isPassengerComplete(p);
                  const isActive = idx === activeIdx;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setActiveIdx(idx)}
                      className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        isActive 
                          ? 'bg-gradient-to-r from-blue-600/10 to-indigo-600/15 border-blue-500/50 text-white shadow-lg shadow-blue-500/5' 
                          : 'bg-slate-950/20 border-slate-800/80 text-slate-400 hover:bg-slate-800/35 hover:text-slate-200'
                      }`}
                    >
                      <div className="truncate min-w-0">
                        <p className="text-[12px] font-bold truncate">
                          {p.firstName || p.lastName ? `${p.firstName} ${p.lastName}` : `Traveler #${idx + 1}`}
                        </p>
                        <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider block mt-0.5">
                          {p.role || 'Passenger'} &bull; {p.ageCategory}
                        </span>
                      </div>
                      
                      {complete ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                          <Check className="w-3 h-3" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0" title="Missing details">
                          <AlertCircle className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
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

                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Age Category</label>
                    <select
                      value={currentPassenger.ageCategory}
                      onChange={(e) => updateField(activeIdx, 'ageCategory', e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-all cursor-pointer"
                    >
                      <option value="Adult" className="bg-slate-900">Adult</option>
                      <option value="Child" className="bg-slate-900">Child</option>
                      <option value="Infant" className="bg-slate-900">Infant</option>
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Date of Birth (DOB) *</label>
                    <div className="relative">
                      <Calendar className="absolute right-4 top-3.5 w-4 h-4 text-slate-500 pointer-events-none" />
                      <input
                        type="date"
                        required
                        max={new Date().toISOString().split('T')[0]}
                        value={currentPassenger.dob}
                        onChange={(e) => updateField(activeIdx, 'dob', e.target.value)}
                        className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-all"
                      />
                    </div>
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
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Email Address</label>
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
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Phone Number</label>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Passport Number *</label>
                    <input
                      type="text"
                      required
                      value={currentPassenger.passportNumber}
                      onChange={(e) => updateField(activeIdx, 'passportNumber', e.target.value)}
                      placeholder="Enter passport number"
                      className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none transition-all uppercase font-mono tracking-wider"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Passport Expiry Date *</label>
                    <div className="relative">
                      <Calendar className="absolute right-4 top-3.5 w-4 h-4 text-slate-500 pointer-events-none" />
                      <input
                        type="date"
                        required
                        value={currentPassenger.passportExpiryDate}
                        onChange={(e) => updateField(activeIdx, 'passportExpiryDate', e.target.value)}
                        className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Passport Photo Upload Block */}
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                      Upload Passport Copy *
                    </label>
                    
                    {currentPassenger.passportImage ? (
                      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4">
                        <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-850 overflow-hidden flex items-center justify-center shrink-0">
                          {currentPassenger.passportImage.match(/\.(jpeg|jpg|gif|png)$/i) ? (
                            <img src={currentPassenger.passportImage} alt="Passport Preview" className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="w-8 h-8 text-indigo-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 text-center sm:text-left">
                          <p className="text-xs font-bold text-white truncate">Passport Uploaded Successfully</p>
                          <a 
                            href={currentPassenger.passportImage} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-[10px] font-extrabold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-wider mt-1 inline-block"
                          >
                            View Document &rarr;
                          </a>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemovePassport(activeIdx)}
                          className="py-2 px-3 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-xl border border-rose-500/20 text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove
                        </button>
                      </div>
                    ) : (
                      <div className="relative group border-2 border-dashed border-slate-800 hover:border-indigo-500/50 bg-slate-955/40 hover:bg-slate-950/20 rounded-2xl transition-all cursor-pointer">
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          id={`passport-file-${activeIdx}`}
                          onChange={(e) => handlePassportUpload(activeIdx, e)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="p-8 text-center flex flex-col items-center justify-center">
                          <div className={`w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mb-4 transition-transform group-hover:scale-110 ${uploadingIdx === activeIdx ? 'animate-pulse' : ''}`}>
                            {uploadingIdx === activeIdx ? (
                              <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <UploadCloud className="w-6 h-6" />
                            )}
                          </div>
                          <p className="text-xs font-bold text-slate-200">
                            {uploadingIdx === activeIdx ? 'Uploading File...' : 'Upload Passport Image or PDF'}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-1 font-medium">JPEG, PNG or PDF formats. Max file size: 10MB.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

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
              I explicitly consent to the secure storage and processing of my passport details and all personal traveler information for the sole purpose of booking and delivering travel services, in strict compliance with the <strong className="text-indigo-400">UK GDPR</strong> and Data Protection Act 2018. My details will not be used for marketing purposes.
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
    </div>
  );
}
