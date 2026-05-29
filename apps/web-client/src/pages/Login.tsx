import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Navigation2, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../api/axios';
import { useAuthStore } from '../store/authStore';
import { TechbarredLogo } from '../components/TechbarredLogo';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore(state => state.setAuth);

  useEffect(() => {
    const rememberedEmail = localStorage.getItem('remembered_email');
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setErrorMessage('');

    try {
      const response = await api.post('/auth/login', { email, password });
      setAuth(response.data.user, response.data.token);
      
      if (rememberMe) {
        localStorage.setItem('remembered_email', email);
      } else {
        localStorage.removeItem('remembered_email');
      }

      if (response.data.user.role === 'SUPER_ADMIN') {
        navigate('/super-admin/dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to login');
      setErrorMessage(err.response?.data?.message || '');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50 relative overflow-hidden">
      {/* Sleek dark blue background decoration */}
      <div className="absolute top-0 left-0 w-full h-[40%] bg-primary-900 rounded-b-[50px] sm:rounded-b-[100px] lg:rounded-b-[150px] shadow-2xl z-0 pointer-events-none"></div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="max-w-sm w-full bg-white p-6 sm:p-8 rounded-2xl shadow-xl shadow-primary-900/10 border border-slate-100 relative z-10"
      >
        <div className="text-center mb-6">
          <div className="mx-auto h-12 w-12 bg-primary-900 text-white rounded-xl flex items-center justify-center mb-4 shadow-md shadow-primary-900/30">
            <Navigation2 className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight uppercase leading-tight">
            Travel Booking<br />
            <span className="text-primary-900">Management System</span>
          </h1>
          <p className="mt-2 text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
            Secure Agent Portal
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-xs flex flex-col gap-1 text-left mb-5 font-medium">
            <p className="font-bold">{error}</p>
            {errorMessage && (
              <p className="text-red-500 leading-relaxed font-normal">{errorMessage}</p>
            )}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-3">
            <div>
              <label htmlFor="email-address" className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Work Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
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
                  className="appearance-none rounded-lg relative block w-full pl-9 px-3 py-2.5 border border-slate-200 placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-900 focus:border-primary-900 text-[13px] transition-all bg-slate-50 font-medium"
                  placeholder="agent@company.com"
                />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
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
                  className="appearance-none rounded-lg relative block w-full pl-9 px-3 py-2.5 border border-slate-200 placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-900 focus:border-primary-900 text-[13px] transition-all bg-slate-50 font-medium"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-[11px]">
            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer text-slate-600 hover:text-slate-900 select-none font-medium">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 text-primary-900 focus:ring-primary-900 h-3.5 w-3.5 transition-colors"
                />
                <span>Remember me</span>
              </label>
            </div>

            <div>
              <a href="#" className="font-bold text-primary-900 hover:text-primary-700 transition-colors">
                Forgot password?
              </a>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent text-[13px] font-bold rounded-lg text-white bg-primary-900 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-900 shadow-md shadow-primary-900/20 transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  Access System
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>
        </form>
        <div className="mt-6 pt-5 border-t border-slate-100 flex justify-center">
          <TechbarredLogo />
        </div>
      </motion.div>
    </div>
  );
}
