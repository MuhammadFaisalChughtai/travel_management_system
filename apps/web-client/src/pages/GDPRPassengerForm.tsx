import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Shield, AlertTriangle, CheckCircle, Mail, Phone, Calendar, User, FileText, Check } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export default function GDPRPassengerForm() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [bookingRef, setBookingRef] = useState('');
  const [companyName, setCompanyName] = useState('');

  // Form State
  const [title, setTitle] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [passportExpiryDate, setPassportExpiryDate] = useState('');
  const [ageCategory, setAgeCategory] = useState('Adult');
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
        const { passenger, bookingReference, companyName: brandName } = res.data;

        setBookingRef(bookingReference || '');
        setCompanyName(brandName || 'Your Travel Provider');

        // Populate fields
        setTitle(passenger.title || '');
        setFirstName(passenger.firstName || '');
        setLastName(passenger.lastName || '');
        setEmail(passenger.email || '');
        setPhoneNumber(passenger.phoneNumber || '');
        setPassportNumber(passenger.passportNumber || '');
        setAgeCategory(passenger.ageCategory || 'Adult');
        
        if (passenger.passportExpiryDate) {
          // Format as YYYY-MM-DD for date input
          const expDate = new Date(passenger.passportExpiryDate);
          if (!isNaN(expDate.getTime())) {
            setPassportExpiryDate(expDate.toISOString().split('T')[0]);
          }
        }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('First Name and Last Name are required.');
      return;
    }
    if (!gdprConsent) {
      toast.error('You must consent to the privacy policy to submit your information.');
      return;
    }

    setSubmitting(true);
    try {
      await axios.put(`${API_BASE_URL}/public/passenger-info/${encodeURIComponent(token!)}`, {
        title,
        firstName,
        lastName,
        email,
        phoneNumber,
        passportNumber,
        passportExpiryDate: passportExpiryDate || null,
        ageCategory,
        gdprConsent
      });
      setSuccess(true);
      toast.success('Information submitted securely!');
    } catch (err: any) {
      console.error('Submission failed:', err);
      const serverMsg = err?.response?.data?.message || err?.message || 'Failed to submit traveler information.';
      toast.error(serverMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="relative flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-slate-300 font-semibold animate-pulse">Establishing secure connection...</p>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800/80 backdrop-blur-lg border border-slate-700 p-8 rounded-3xl shadow-2xl text-center">
          <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-rose-500/20">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Verification Failed</h2>
          <p className="text-slate-400 text-sm mb-6">{errorMsg}</p>
          <div className="text-[11px] text-slate-500">
            If you believe this is a mistake, please contact your travel booking agent directly.
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800/80 backdrop-blur-lg border border-slate-700 p-8 rounded-3xl shadow-2xl text-center">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20 animate-bounce">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Thank You</h2>
          <p className="text-emerald-400 font-semibold text-sm mb-4">Travel details submitted securely</p>
          <p className="text-slate-300 text-sm mb-6 leading-relaxed">
            Your passport information and passenger details have been encrypted and updated for booking <strong>{bookingRef}</strong>. You may close this tab now.
          </p>
          <div className="p-4 bg-slate-700/50 rounded-2xl border border-slate-600/50 flex items-center gap-3 justify-center text-[11px] text-slate-400">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>UK GDPR Compliant Encryption Active</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-955 flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <Toaster position="top-right" />
      {/* Decorative Gradients */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-2xl w-full mx-auto bg-slate-905/80 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative z-10">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white relative">
          <div className="absolute top-4 right-4 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border border-white/10">
            <Shield className="w-3.5 h-3.5 text-emerald-300" /> Secure Link
          </div>
          <h1 className="text-2xl font-black mb-1">{companyName}</h1>
          <p className="text-white/80 text-xs font-semibold uppercase tracking-wider">Booking Ref: {bookingRef}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <User className="w-5 h-5 text-blue-400" /> Passenger Details
            </h2>
            <p className="text-slate-400 text-xs mt-1">Please ensure details match your passport exactly.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Title</label>
              <select
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 focus:outline-none transition-colors"
              >
                <option value="">Select...</option>
                <option value="Mr">Mr</option>
                <option value="Mrs">Mrs</option>
                <option value="Ms">Ms</option>
                <option value="Miss">Miss</option>
                <option value="Dr">Dr</option>
                <option value="Prof">Prof</option>
              </select>
            </div>

            {/* First Name */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">First Name(s)</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="As printed on passport"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-550 focus:border-blue-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Last Name */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Last Name / Surname</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="As printed on passport"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-550 focus:border-blue-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Age Category</label>
              <select
                value={ageCategory}
                onChange={(e) => setAgeCategory(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 focus:outline-none transition-colors"
              >
                <option value="Adult">Adult</option>
                <option value="Child">Child</option>
                <option value="Infant">Infant</option>
              </select>
            </div>
          </div>

          <div className="border-b border-slate-800 pb-4 pt-2">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-400" /> Contact Details
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-white text-sm placeholder-slate-550 focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+44 7123 456789"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-white text-sm placeholder-slate-550 focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="border-b border-slate-800 pb-4 pt-2">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" /> Passport Details
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Passport Number */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Passport Number</label>
              <input
                type="text"
                value={passportNumber}
                onChange={(e) => setPassportNumber(e.target.value)}
                placeholder="Enter passport number"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-550 focus:border-blue-500 focus:outline-none transition-colors uppercase font-mono tracking-wider"
              />
            </div>

            {/* Passport Expiry */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Passport Expiry Date</label>
              <div className="relative">
                <Calendar className="absolute right-4 top-3.5 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  type="date"
                  value={passportExpiryDate}
                  onChange={(e) => setPassportExpiryDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          {/* UK GDPR Consent */}
          <div className="bg-slate-955 p-6 rounded-2xl border border-slate-800/80 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="relative flex items-center mt-1">
                <input
                  type="checkbox"
                  id="gdpr"
                  checked={gdprConsent}
                  onChange={(e) => setGdprConsent(e.target.checked)}
                  className="peer w-5 h-5 border-2 border-slate-700 bg-slate-800 rounded-md checked:bg-blue-600 checked:border-blue-600 focus:ring-0 focus:outline-none cursor-pointer appearance-none transition-all"
                />
                <Check className="w-3.5 h-3.5 text-white absolute left-0.5 pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" />
              </div>
              <label htmlFor="gdpr" className="text-xs text-slate-300 font-medium leading-relaxed select-none cursor-pointer">
                I explicitly consent to the secure storage and processing of my passport and personal data for the sole purpose of booking and delivering travel services, in strict compliance with the <strong className="text-blue-400">UK GDPR</strong> and Data Protection Act 2018. My details will not be used for marketing purposes.
              </label>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Saving Information...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4" /> Submit Travel Details
              </>
            )}
          </button>
        </form>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-[10px] text-slate-500 flex flex-col gap-1 items-center z-10">
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-emerald-500/80" />
          <span>AES-256 Encrypted Transfer Protocol Active</span>
        </div>
        <span>Powered by {companyName} Travel Systems. All rights reserved.</span>
      </div>
    </div>
  );
}
