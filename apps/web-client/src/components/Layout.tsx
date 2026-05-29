import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Navigation2, User, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { TechbarredLogo } from './TechbarredLogo';

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isDashboard = location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/super-admin');
  const { isAuthenticated, user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14">
            <div className="flex items-center">
              <Link to="/" className="flex-shrink-0 flex items-center gap-2 group">
                <div className="bg-primary-600 p-1.5 rounded-md group-hover:bg-primary-500 transition-colors">
                  <Navigation2 className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-900 to-primary-600 truncate">
                  Travel Booking Management System
                </span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <>
                  <div className="hidden md:flex flex-col items-end mr-1">
                    <span className="text-[13px] font-semibold text-slate-900">{user?.name || 'Traveler'}</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wide">
                      {user?.role === 'SUPER_ADMIN' ? 'SaaS Platform Admin' : 'Premium Member'}
                    </span>
                  </div>
                  <Link 
                    to={user?.role === 'SUPER_ADMIN' ? '/super-admin/dashboard' : '/dashboard'} 
                    className="p-1.5 text-slate-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors bg-slate-50 shadow-sm border border-slate-100"
                  >
                    <User className="h-4 w-4" />
                  </Link>
                  <button onClick={handleLogout} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                    <LogOut className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <Link to="/login" className="bg-primary-600 text-white hover:bg-primary-500 px-4 py-1.5 rounded-lg text-[13px] font-semibold shadow-sm transition-all hover:-translate-y-0.5">
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-grow">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          <Outlet />
        </motion.div>
      </main>

      {!isDashboard && (
        <footer className="bg-white border-t py-12 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center justify-center gap-6">
            <p className="text-slate-500 text-sm">&copy; 2026 Travel Booking Management System. All rights reserved.</p>
            <TechbarredLogo />
          </div>
        </footer>
      )}
    </div>
  );
}
