const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps', 'web-client', 'src', 'App.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const heroStartIndex = content.indexOf('function Hero() {');
const appStartIndex = content.indexOf('function App() {');

if (heroStartIndex === -1 || appStartIndex === -1) {
  console.error("Could not find boundaries.");
  process.exit(1);
}

const newHero = `function Hero() {
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
              <Link to="/register" className="bg-gradient-to-r from-primary-600 to-indigo-600 text-white px-6 py-3 rounded-xl text-[15px] font-medium hover:shadow-lg hover:shadow-primary-500/20 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2">
                Start your 14-day free trial <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/login" className="bg-slate-800/40 text-slate-300 border border-slate-700 px-6 py-3 rounded-xl text-[15px] font-medium hover:bg-slate-700 hover:text-white transition-all backdrop-blur-sm flex items-center justify-center">
                Agent Login
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Dashboard Mockup Showcase */}
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-2 mb-24 z-10">
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
          className="rounded-2xl p-2 bg-gradient-to-b from-slate-800/80 to-slate-900/40 shadow-2xl shadow-indigo-500/10 border border-slate-700/50"
        >
          <div className="rounded-xl overflow-hidden bg-[#0a0f1c] border border-slate-800/80 relative group">
            <img 
              src="/dashboard-mockup.png" 
              alt="TravelBooker Dashboard Interface" 
              className="w-full object-cover transform transition-transform duration-700 group-hover:scale-[1.01] opacity-95 group-hover:opacity-100" 
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
          </div>
        </motion.div>
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
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Simple, scalable <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-600">pricing.</span></h2>
            <p className="text-base text-slate-400 max-w-xl mx-auto">No hidden fees. Cancel anytime. Choose the plan that grows with your agency.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto items-start">
            
            {/* Starter Plan */}
            <div className="bg-slate-900/40 backdrop-blur-md p-8 rounded-2xl border border-slate-800/60 flex flex-col hover:border-slate-700 transition-colors">
              <h3 className="text-lg font-medium text-slate-400 mb-1">Starter</h3>
              <div className="mb-6 flex items-baseline gap-1"><span className="text-4xl font-bold text-white">£49</span><span className="text-sm text-slate-500">/mo</span></div>
              <ul className="space-y-4 mb-8 flex-1">
                {['Up to 3 Agents', 'Basic CRM & Engine', 'Standard Reporting', 'Email Support'].map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-slate-300"><CheckCircle2 className="h-4 w-4 text-slate-500" /> {f}</li>
                ))}
              </ul>
              <Link to="/register" className="block text-center w-full py-3 rounded-lg border border-slate-700 text-[14px] text-white font-medium hover:bg-slate-800 transition-colors">Select Starter</Link>
            </div>

            {/* Professional Plan (Highlighted) */}
            <div className="bg-gradient-to-b from-primary-900/20 to-slate-900/50 backdrop-blur-md p-8 rounded-2xl border border-primary-500/40 flex flex-col relative transform md:-translate-y-2 shadow-xl shadow-primary-900/10">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary-500 to-indigo-500 text-white px-3 py-1 rounded-full text-[10px] font-bold tracking-wider shadow-sm">MOST POPULAR</div>
              <h3 className="text-lg font-medium text-primary-300 mb-1">Professional</h3>
              <div className="mb-4 flex items-baseline gap-1"><span className="text-5xl font-bold text-white">£149</span><span className="text-sm text-primary-400/70">/mo</span></div>
              <p className="text-[13px] text-slate-400 mb-6 border-b border-slate-800/60 pb-6">Everything in Starter, plus tools to automate finances.</p>
              <ul className="space-y-4 mb-8 flex-1">
                {['Unlimited Agents', 'Full Ledger Accounting', 'Margin Rules Engine', 'Vendor Management', 'Priority Support'].map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-slate-200"><CheckCircle2 className="h-4 w-4 text-primary-400" /> {f}</li>
                ))}
              </ul>
              <Link to="/register" className="block text-center w-full py-3 rounded-lg bg-gradient-to-r from-primary-600 to-indigo-600 text-[14px] text-white font-medium hover:shadow-md hover:shadow-primary-600/20 transition-all hover:-translate-y-0.5">Start 14-Day Trial</Link>
            </div>

            {/* Enterprise Plan */}
            <div className="bg-slate-900/40 backdrop-blur-md p-8 rounded-2xl border border-slate-800/60 flex flex-col hover:border-slate-700 transition-colors">
              <h3 className="text-lg font-medium text-slate-400 mb-1">Enterprise</h3>
              <div className="mb-6 flex items-baseline gap-1"><span className="text-4xl font-bold text-white">Custom</span></div>
              <ul className="space-y-4 mb-8 flex-1">
                {['White-labeling', 'Dedicated Manager', 'Custom API Integrations', '99.99% SLA Guarantee'].map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-slate-300"><CheckCircle2 className="h-4 w-4 text-slate-500" /> {f}</li>
                ))}
              </ul>
              <Link to="/register" className="block text-center w-full py-3 rounded-lg border border-slate-700 text-[14px] text-white font-medium hover:bg-slate-800 transition-colors">Contact Sales</Link>
            </div>

          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="border-t border-slate-800/40 bg-[#070A12] py-20 text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Ready to scale your agency?</h2>
        <p className="text-base text-slate-400 mb-8">Join hundreds of agencies that are already using TravelBooker.</p>
        <Link to="/register" className="inline-flex bg-white text-slate-900 px-8 py-3 rounded-xl text-[15px] font-semibold hover:bg-slate-100 transition-colors shadow-lg shadow-white/5">
          Get Started For Free
        </Link>
      </div>
    </div>
  );
}
`;

const finalContent = content.substring(0, heroStartIndex) + newHero + '\n' + content.substring(appStartIndex);
fs.writeFileSync(filePath, finalContent, 'utf8');
console.log("Successfully rewrote Hero component to polished, scaled down SaaS design.");
