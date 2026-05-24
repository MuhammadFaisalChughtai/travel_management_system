import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { HotelSearch } from './pages/HotelSearch';
import { Dashboard } from './pages/Dashboard';
import { SuperAdminDashboard } from './pages/SuperAdminDashboard';
import { SuperAdminLogin } from './pages/SuperAdminLogin';
import { BookingDetailsPage } from './pages/BookingDetailsPage';
import { Search } from 'lucide-react';
import { motion } from 'framer-motion';

function Hero() {
  return (
    <div className="relative bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="relative z-10 pb-8 bg-white sm:pb-16 md:pb-20 lg:max-w-2xl lg:w-full lg:pb-28 xl:pb-32">
          <main className="mt-10 mx-auto max-w-7xl px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-28">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="sm:text-center lg:text-left"
            >
              <h1 className="text-4xl tracking-tight font-extrabold text-slate-900 sm:text-5xl md:text-6xl">
                <span className="block xl:inline">Discover your next</span>{' '}
                <span className="block text-primary-600 xl:inline">great adventure</span>
              </h1>
              <p className="mt-3 text-base text-slate-500 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
                Book flights, hotels, and experiences all in one place. We offer the best prices and seamless booking experiences for modern travelers.
              </p>
              
              <div className="mt-8 bg-white p-4 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100">
                <div className="flex gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                    <input type="text" placeholder="Where are you going?" className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-transparent rounded-xl focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all" />
                  </div>
                  <button className="bg-primary-600 text-white px-8 py-3 rounded-xl hover:bg-primary-500 font-medium shadow-lg shadow-primary-500/30 transition-all hover:-translate-y-0.5">
                    Search
                  </button>
                </div>
              </div>
            </motion.div>
          </main>
        </div>
      </div>
      <div className="lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2">
        <img
          className="h-56 w-full object-cover sm:h-72 md:h-96 lg:w-full lg:h-full"
          src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?ixlib=rb-4.0.3&auto=format&fit=crop&w=1721&q=80"
          alt="Travel"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent lg:via-white/20"></div>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ className: 'text-sm font-semibold rounded-xl shadow-lg border border-slate-100', success: { iconTheme: { primary: '#10b981', secondary: 'white' } }, error: { iconTheme: { primary: '#ef4444', secondary: 'white' } } }} />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Hero />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Navigate to="/login" replace />} />
          <Route path="hotels" element={<HotelSearch />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="bookings/:id" element={<BookingDetailsPage />} />
          <Route path="super-admin/login" element={<SuperAdminLogin />} />
          <Route path="super-admin/dashboard" element={<SuperAdminDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
