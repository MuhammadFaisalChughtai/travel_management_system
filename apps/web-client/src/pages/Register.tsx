import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Navigation2, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../api/axios';
import { useAuthStore } from '../store/authStore';

export function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore(state => state.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // 1. Register the user
      await api.post('/auth/register', { name, email, password });
      
      // 2. Automatically log them in after registration
      const loginResponse = await api.post('/auth/login', { email, password });
      
      setAuth(loginResponse.data.user, loginResponse.data.token);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to register. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-10 px-4 sm:px-6 lg:px-8">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="max-w-sm w-full space-y-6 bg-white p-6 sm:p-8 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100"
      >
        <div className="text-center">
          <div className="mx-auto h-10 w-10 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center mb-3">
            <Navigation2 className="h-5 w-5" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Create an account</h2>
          <p className="mt-1.5 text-xs text-slate-500">
            Start your journey with Travel Booking Management System
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-2.5 rounded-lg text-xs text-center font-medium">
            {error}
          </div>
        )}

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-3">
            <div>
              <label htmlFor="name" className="sr-only">Full name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  className="appearance-none rounded-lg relative block w-full pl-9 px-3 py-2.5 border border-slate-200 placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-[13px] transition-all"
                  placeholder="Full name"
                />
              </div>
            </div>
            <div>
              <label htmlFor="email-address" className="sr-only">Email address</label>
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
                  className="appearance-none rounded-lg relative block w-full pl-9 px-3 py-2.5 border border-slate-200 placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-[13px] transition-all"
                  placeholder="Email address"
                />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
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
                  autoComplete="new-password"
                  required
                  className="appearance-none rounded-lg relative block w-full pl-9 px-3 py-2.5 border border-slate-200 placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-[13px] transition-all"
                  placeholder="Password"
                />
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-[13px] font-semibold rounded-lg text-white bg-primary-600 hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 shadow-md shadow-primary-500/20 transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Create Account'
              )}
            </button>
          </div>
          
          <div className="text-center text-[11px] text-slate-600">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-500">
              Sign in instead
            </Link>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
