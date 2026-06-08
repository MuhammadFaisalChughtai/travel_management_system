import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { HotelSearch } from './pages/HotelSearch';
import { Dashboard } from './pages/Dashboard';
import { SuperAdminDashboard } from './pages/SuperAdminDashboard';
import { SuperAdminLogin } from './pages/SuperAdminLogin';
import { BookingDetailsPage } from './pages/BookingDetailsPage';
import GDPRPassengerForm from './pages/GDPRPassengerForm';
import { 
  ArrowRight, CheckCircle2, Shield, Users, CreditCard, Sparkles, 
  BarChart3, Globe2, Zap, Mail, Phone, Building2, MessageSquare, Loader2, X 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthRoute } from './components/AuthRoute';
import { api } from './api/axios';


import { User as LucideUser } from 'lucide-react';

function Hero() {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    companyName: '',
    phoneNumber: '',
    agencySize: '',
    gdsSystems: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/auth/request-demo', formData);
      toast.success("Demo request submitted! We will contact you shortly.");
      setIsDemoModalOpen(false);
      setFormData({
        fullName: '',
        email: '',
        companyName: '',
        phoneNumber: '',
        agencySize: '',
        gdsSystems: '',
        message: ''
      });
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || err.response?.data?.error || "Failed to submit demo request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#0B0F19] font-sans text-slate-300 selection:bg-primary-500/30 selection:text-primary-100 overflow-hidden">
      {/* Dynamic Glowing Background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] pointer-events-none opacity-40 blur-3xl mix-blend-screen" style={{
        background: 'radial-gradient(circle at center, rgba(99, 102, 241, 0.15) 0%, rgba(16, 185, 129, 0.05) 30%, transparent 60%)'
      }}></div>

      {/* Hero Section */}
      <div className="relative pt-24 pb-16 sm:pt-32 sm:pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/40 border border-slate-700/50 text-[13px] text-primary-400 mb-6 backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5" /> Introducing TravelBooker 2.0
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-6 leading-[1.15]">
              The OS for modern <br className="hidden sm:block"/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-primary-400 to-emerald-400">Travel Agencies</span>
            </h1>
            <p className="mt-4 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto mb-10 font-light leading-relaxed">
              Unify your bookings, manage vendor margins, and empower your agents with our all-in-one, enterprise-grade B2B platform.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button onClick={() => setIsDemoModalOpen(true)} className="bg-gradient-to-r from-primary-600 to-indigo-600 text-white px-6 py-3 rounded-xl text-[15px] font-medium hover:shadow-lg hover:shadow-primary-500/20 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2">
                Request a Demo <ArrowRight className="h-4 w-4" />
              </button>
              <Link to="/login" className="bg-slate-800/40 text-slate-300 border border-slate-700 px-6 py-3 rounded-xl text-[15px] font-medium hover:bg-slate-700 hover:text-white transition-all backdrop-blur-sm flex items-center justify-center">
                Agent Login
              </Link>
            </div>
          </motion.div>
        </div>
      </div>


      {/* Trusted By Banner */}
      <div className="border-y border-slate-800/40 bg-slate-900/30 backdrop-blur-sm py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-6">Trusted by 500+ travel agencies worldwide</p>
          <div className="flex flex-wrap justify-center gap-10 sm:gap-16 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
             <div className="flex items-center gap-2"><Globe2 className="h-6 w-6"/> <span className="text-xl font-bold tracking-tighter">WanderGroup</span></div>
             <div className="flex items-center gap-2"><Sparkles className="h-6 w-6"/> <span className="text-xl font-bold tracking-tighter">OasisTravel</span></div>
             <div className="flex items-center gap-2"><Zap className="h-6 w-6"/> <span className="text-xl font-bold tracking-tighter">NexusTours</span></div>
          </div>
        </div>
      </div>

      {/* Bento Box Features Section */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24 relative">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Everything you need to <span className="text-primary-400">scale.</span></h2>
          <p className="text-base text-slate-400 max-w-xl mx-auto">Replace fragmented spreadsheets with a unified, intelligent operating system.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {/* Large Feature 1 */}
          <div className="md:col-span-2 bg-gradient-to-br from-slate-800/40 to-slate-900/40 p-8 rounded-2xl border border-slate-800/60 hover:border-primary-500/30 transition-colors group">
            <div className="bg-primary-500/10 w-12 h-12 rounded-xl flex items-center justify-center mb-6 border border-primary-500/20 group-hover:bg-primary-500/20 transition-colors">
              <BarChart3 className="h-6 w-6 text-primary-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Real-Time Ledger & Margin Engine</h3>
            <p className="text-sm text-slate-400 leading-relaxed max-w-lg">
              Automatically calculate vendor margins, track agent commissions, and reconcile payments across multiple currencies. Our double-entry ledger ensures perfectly balanced books without manual data entry.
            </p>
          </div>

          {/* Small Feature 1 */}
          <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 p-8 rounded-2xl border border-slate-800/60 hover:border-indigo-500/30 transition-colors group">
            <div className="bg-indigo-500/10 w-12 h-12 rounded-xl flex items-center justify-center mb-6 border border-indigo-500/20 group-hover:bg-indigo-500/20 transition-colors">
              <Users className="h-6 w-6 text-indigo-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-3">Agent Workspaces</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Create isolated workspaces. Control permissions, set custom commission rates, and track individual performance KPIs.
            </p>
          </div>

          {/* Small Feature 2 */}
          <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 p-8 rounded-2xl border border-slate-800/60 hover:border-emerald-500/30 transition-colors group">
            <div className="bg-emerald-500/10 w-12 h-12 rounded-xl flex items-center justify-center mb-6 border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-colors">
              <Shield className="h-6 w-6 text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-3">Vendor Registry</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Centralize your suppliers. Store contracts, track volume tiers, and auto-apply negotiated discounts directly at checkout.
            </p>
          </div>

          {/* Large Feature 2 */}
          <div className="md:col-span-2 bg-gradient-to-br from-slate-800/40 to-slate-900/40 p-8 rounded-2xl border border-slate-800/60 hover:border-purple-500/30 transition-colors group relative overflow-hidden">
            <div className="absolute right-0 top-0 w-48 h-48 bg-purple-500/10 blur-3xl rounded-full pointer-events-none"></div>
            <div className="bg-purple-500/10 w-12 h-12 rounded-xl flex items-center justify-center mb-6 border border-purple-500/20 group-hover:bg-purple-500/20 transition-colors relative z-10">
              <CreditCard className="h-6 w-6 text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3 relative z-10">Frictionless B2B Payments</h3>
            <p className="text-sm text-slate-400 leading-relaxed max-w-lg relative z-10">
              Issue invoices instantly, collect deposits, and manage corporate wallets. Handle refunds and partial payments seamlessly while keeping cash flow transparent.
            </p>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="py-24 border-t border-slate-800/40 bg-[#0B0F19] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary-900/10 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Pricing <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-600">coming soon.</span></h2>
            <p className="text-base text-slate-400 max-w-xl mx-auto">We are finalizing our transparent pricing model. Join the waitlist to get early access pricing.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto items-start">
            
            {/* Starter Plan */}
            <div className="bg-slate-900/40 backdrop-blur-md p-8 rounded-2xl border border-slate-800/60 flex flex-col hover:border-slate-700 transition-colors">
              <h3 className="text-lg font-medium text-slate-400 mb-1">Starter</h3>
              <div className="mb-6 flex items-baseline gap-1"><span className="text-4xl font-bold text-white">TBA</span></div>
              <ul className="space-y-4 mb-8 flex-1">
                {['Up to 3 Agents', 'Basic CRM & Engine', 'Standard Reporting', 'Email Support'].map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-slate-300"><CheckCircle2 className="h-4 w-4 text-slate-500" /> {f}</li>
                ))}
              </ul>
              <button onClick={() => setIsDemoModalOpen(true)} className="block text-center w-full py-3 rounded-lg border border-slate-700 text-[14px] text-white font-medium hover:bg-slate-800 transition-colors">Request a Demo</button>
            </div>

            {/* Professional Plan (Highlighted) */}
            <div className="bg-gradient-to-b from-primary-900/20 to-slate-900/50 backdrop-blur-md p-8 rounded-2xl border border-primary-500/40 flex flex-col relative transform md:-translate-y-2 shadow-xl shadow-primary-900/10">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary-500 to-indigo-500 text-white px-3 py-1 rounded-full text-[10px] font-bold tracking-wider shadow-sm">MOST POPULAR</div>
              <h3 className="text-lg font-medium text-primary-300 mb-1">Professional</h3>
              <div className="mb-4 flex items-baseline gap-1"><span className="text-5xl font-bold text-white">TBA</span></div>
              <p className="text-[13px] text-slate-400 mb-6 border-b border-slate-800/60 pb-6">Everything in Starter, plus tools to automate finances.</p>
              <ul className="space-y-4 mb-8 flex-1">
                {['Unlimited Agents', 'Full Ledger Accounting', 'Margin Rules Engine', 'Vendor Management', 'Priority Support'].map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-slate-200"><CheckCircle2 className="h-4 w-4 text-primary-400" /> {f}</li>
                ))}
              </ul>
              <button onClick={() => setIsDemoModalOpen(true)} className="block text-center w-full py-3 rounded-lg bg-gradient-to-r from-primary-600 to-indigo-600 text-[14px] text-white font-medium hover:shadow-md hover:shadow-primary-600/20 transition-all hover:-translate-y-0.5">Request a Demo</button>
            </div>

            {/* Enterprise Plan */}
            <div className="bg-slate-900/40 backdrop-blur-md p-8 rounded-2xl border border-slate-800/60 flex flex-col hover:border-slate-700 transition-colors">
              <h3 className="text-lg font-medium text-slate-400 mb-1">Enterprise</h3>
              <div className="mb-6 flex items-baseline gap-1"><span className="text-4xl font-bold text-white">TBA</span></div>
              <ul className="space-y-4 mb-8 flex-1">
                {['White-labeling', 'Dedicated Manager', 'Custom API Integrations', '99.99% SLA Guarantee'].map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-slate-300"><CheckCircle2 className="h-4 w-4 text-slate-500" /> {f}</li>
                ))}
              </ul>
              <button onClick={() => setIsDemoModalOpen(true)} className="block text-center w-full py-3 rounded-lg border border-slate-700 text-[14px] text-white font-medium hover:bg-slate-800 transition-colors">Request a Demo</button>
            </div>

          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="border-t border-slate-800/40 bg-[#070A12] py-20 text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Ready to scale your agency?</h2>
        <p className="text-base text-slate-400 mb-8">Join the waitlist to be notified when TravelBooker goes live.</p>
        <button onClick={() => setIsDemoModalOpen(true)} className="inline-flex bg-white text-slate-900 px-8 py-3 rounded-xl text-[15px] font-semibold hover:bg-slate-100 transition-colors shadow-lg shadow-white/5">
          Request a Demo
        </button>
      </div>

      {/* Request Demo Modal */}
      <AnimatePresence>
        {isDemoModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDemoModalOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden max-h-[90vh] flex flex-col font-sans"
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-primary-900 to-indigo-900 text-white px-6 py-4 flex justify-between items-center shadow-inner flex-shrink-0">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-indigo-300" />
                  <div>
                    <h3 className="font-bold text-[14px] tracking-wide uppercase leading-none">Request a Demo</h3>
                    <p className="text-indigo-200/70 text-[10px] mt-1 font-normal">Experience the B2B OS for modern travel agencies.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDemoModalOpen(false)}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Form */}
              <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 flex flex-col min-h-0">
                <div className="p-6 space-y-4 flex-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Full Name *</label>
                      <div className="relative">
                        <LucideUser className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          required
                          value={formData.fullName}
                          onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                          placeholder="John Doe"
                          className="w-full pl-9 pr-3.5 py-2 border border-slate-200 bg-white/70 rounded-lg text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700 placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Work Email *</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                          type="email"
                          required
                          value={formData.email}
                          onChange={e => setFormData({ ...formData, email: e.target.value })}
                          placeholder="john@agency.com"
                          className="w-full pl-9 pr-3.5 py-2 border border-slate-200 bg-white/70 rounded-lg text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700 placeholder:text-slate-400 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Company Name *</label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          required
                          value={formData.companyName}
                          onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                          placeholder="Apex Travels"
                          className="w-full pl-9 pr-3.5 py-2 border border-slate-200 bg-white/70 rounded-lg text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700 placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Phone Number</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                          type="tel"
                          value={formData.phoneNumber}
                          onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
                          placeholder="+1 (555) 000-0000"
                          className="w-full pl-9 pr-3.5 py-2 border border-slate-200 bg-white/70 rounded-lg text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700 placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Agency Size</label>
                      <select
                        value={formData.agencySize}
                        onChange={e => setFormData({ ...formData, agencySize: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 bg-white/70 rounded-lg text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700"
                      >
                        <option className="text-slate-800 bg-white" value="">Select staff count</option>
                        <option className="text-slate-800 bg-white" value="1-5 agents">1-5 agents</option>
                        <option className="text-slate-800 bg-white" value="6-20 agents">6-20 agents</option>
                        <option className="text-slate-800 bg-white" value="21-100 agents">21-100 agents</option>
                        <option className="text-slate-800 bg-white" value="100+ agents">100+ agents</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Primary GDS / Systems</label>
                      <select
                        value={formData.gdsSystems}
                        onChange={e => setFormData({ ...formData, gdsSystems: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 bg-white/70 rounded-lg text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700"
                      >
                        <option className="text-slate-800 bg-white" value="">Select primary system</option>
                        <option className="text-slate-800 bg-white" value="Amadeus">Amadeus</option>
                        <option className="text-slate-800 bg-white" value="Sabre">Sabre</option>
                        <option className="text-slate-800 bg-white" value="Travelport">Travelport / Galileo</option>
                        <option className="text-slate-800 bg-white" value="Multiple">Multiple Systems</option>
                        <option className="text-slate-800 bg-white" value="Other / None">Other / None</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Message / Custom Requirements</label>
                    <div className="relative">
                      <MessageSquare className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <textarea
                        rows={2}
                        value={formData.message}
                        onChange={e => setFormData({ ...formData, message: e.target.value })}
                        placeholder="Tell us about your agency needs..."
                        className="w-full pl-9 pr-3.5 py-2 border border-slate-200 bg-white/70 rounded-lg text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700 placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Submit Actions */}
                <div className="bg-slate-50/50 p-5 border-t border-slate-200 flex justify-end items-center backdrop-blur-md flex-shrink-0">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsDemoModalOpen(false)}
                      className="px-5 py-2.5 rounded-xl text-[11px] font-bold text-slate-600 hover:bg-slate-200/50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-2.5 rounded-xl text-[11px] font-bold shadow-lg shadow-primary-600/30 transition-all uppercase tracking-wide active:scale-95 flex items-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        'Request Demo'
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ className: 'text-sm font-semibold rounded-xl shadow-lg border border-slate-100', success: { iconTheme: { primary: '#10b981', secondary: 'white' } }, error: { iconTheme: { primary: '#ef4444', secondary: 'white' } } }} />
      <Routes>
        <Route path="passenger-info/:token" element={<GDPRPassengerForm />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Hero />} />
          
          {/* Public authentication routes */}
          <Route element={<AuthRoute />}>
            <Route path="login" element={<Login />} />
            <Route path="super-admin/login" element={<SuperAdminLogin />} />
          </Route>
          
          <Route path="register" element={<Navigate to="/login" replace />} />
          <Route path="hotels" element={<HotelSearch />} />
          
          {/* Agent protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="dashboard/:tab" element={<Dashboard />} />
            <Route path="bookings/:id" element={<BookingDetailsPage />} />
          </Route>
          
          {/* Super Admin protected routes */}
          <Route element={<ProtectedRoute requireSuperAdmin />}>
            <Route path="super-admin/dashboard" element={<SuperAdminDashboard />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
