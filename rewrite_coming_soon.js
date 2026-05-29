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
    <div className="bg-[#0B0F19] font-sans text-slate-300 selection:bg-primary-500/30 selection:text-primary-100 overflow-hidden min-h-screen flex flex-col">
      {/* Dynamic Glowing Background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[800px] pointer-events-none opacity-50 blur-[100px] mix-blend-screen" style={{
        background: 'radial-gradient(circle at center, rgba(99, 102, 241, 0.15) 0%, rgba(16, 185, 129, 0.05) 40%, transparent 70%)'
      }}></div>

      {/* Hero Section */}
      <div className="relative flex-grow flex flex-col justify-center pt-24 pb-16 sm:pt-32 sm:pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center w-full">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/60 border border-slate-700/50 text-[13px] font-semibold text-emerald-400 mb-8 backdrop-blur-md shadow-lg shadow-emerald-900/20">
              <Sparkles className="h-4 w-4" /> Coming Soon: TravelBooker 2.0
            </div>
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold text-white tracking-tight mb-8 leading-[1.1]">
              The future of <br className="hidden sm:block"/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-primary-400 to-emerald-400">Travel Management</span>
            </h1>
            <p className="mt-4 text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-12 font-light leading-relaxed">
              We're building the ultimate B2B operating system for modern travel agencies. Unify bookings, automate vendor margins, and empower your agents.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link to="/register" className="bg-gradient-to-r from-primary-600 to-indigo-600 text-white px-8 py-3.5 rounded-xl text-base font-semibold hover:shadow-xl hover:shadow-primary-500/20 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2">
                Join the Beta Waitlist <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/login" className="bg-slate-800/40 text-slate-300 border border-slate-700 px-8 py-3.5 rounded-xl text-base font-semibold hover:bg-slate-700 hover:text-white transition-all backdrop-blur-sm flex items-center justify-center">
                Agent Login
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Trusted By Banner (Subtle) */}
      <div className="border-y border-slate-800/30 bg-slate-900/20 backdrop-blur-md py-12 mt-auto relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-[11px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-8">Currently in private beta with select agencies</p>
          <div className="flex flex-wrap justify-center gap-10 sm:gap-16 opacity-30 grayscale hover:grayscale-0 transition-all duration-700">
             <div className="flex items-center gap-2"><Globe2 className="h-6 w-6"/> <span className="text-xl font-bold tracking-tighter">WanderGroup</span></div>
             <div className="flex items-center gap-2"><Sparkles className="h-6 w-6"/> <span className="text-xl font-bold tracking-tighter">OasisTravel</span></div>
             <div className="flex items-center gap-2"><Zap className="h-6 w-6"/> <span className="text-xl font-bold tracking-tighter">NexusTours</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
`;

const finalContent = content.substring(0, heroStartIndex) + newHero + '\n' + content.substring(appStartIndex);
fs.writeFileSync(filePath, finalContent, 'utf8');
console.log("Successfully rewrote Hero component to Coming Soon layout.");
