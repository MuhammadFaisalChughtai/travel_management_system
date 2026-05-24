import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../api/axios';
import { useAuthStore } from '../store/authStore';
import { TechbarredLogo } from '../components/TechbarredLogo';

export function SuperAdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore(state => state.setAuth);

  useEffect(() => {
    const rememberedEmail = localStorage.getItem('remembered_admin_email');
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/login', { 
        email, 
        password, 
        isSuperAdmin: true 
      });
      
      setAuth(response.data.user, response.data.token);

      if (rememberMe) {
        localStorage.setItem('remembered_admin_email', email);
      } else {
        localStorage.removeItem('remembered_admin_email');
      }

      navigate('/super-admin/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid credentials or access denied');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50 relative overflow-hidden">
      {/* Sleek dark blue background decoration */}
      <div className="absolute top-0 left-0 w-full h-[45%] bg-slate-900 rounded-b-[100px] sm:rounded-b-[200px] lg:rounded-b-[300px] shadow-2xl z-0 pointer-events-none"></div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="max-w-md w-full bg-white p-8 sm:p-10 rounded-3xl shadow-2xl shadow-slate-900/20 border border-slate-100 relative z-10"
      >
        <div className="text-center mb-8">
          <div className="mx-auto h-14 w-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-slate-900/30">
            <Shield className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase leading-tight">
            Travel Booking<br />
            <span className="text-slate-900">Management System</span>
          </h1>
          <p className="mt-3 text-xs sm:text-sm font-semibold text-slate-500 uppercase tracking-widest">
            Global Admin Portal
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-xs sm:text-sm flex flex-col gap-1 text-left mb-6 font-medium">
            <p className="font-bold">{error}</p>
          </div>
        )}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email-address" className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Super Admin Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="appearance-none rounded-xl relative block w-full pl-10 px-3.5 py-3 border border-slate-200 placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent sm:text-sm transition-all bg-slate-50 font-medium"
                  placeholder="admin@platform.com"
                />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="appearance-none rounded-xl relative block w-full pl-10 px-3.5 py-3 border border-slate-200 placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent sm:text-sm transition-all bg-slate-50 font-medium"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs">
            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer text-slate-600 hover:text-slate-900 select-none font-medium">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 h-4 w-4 transition-colors"
                />
                <span>Remember me</span>
              </label>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-slate-900 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 shadow-lg shadow-slate-900/30 transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  Access Command Center
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>
        </form>
        <div className="mt-8 pt-6 border-t border-slate-100/10">
          <TechbarredLogo className="[&_span]:text-slate-300 [&>div>span]:text-white [&>div>span>span]:bg-white" />
        </div>
      </motion.div>
    </div>
  );
}
