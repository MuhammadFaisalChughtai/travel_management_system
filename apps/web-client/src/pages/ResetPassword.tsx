import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, ArrowRight, Navigation2, Loader2, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../api/axios';
import toast from 'react-hot-toast';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid or missing password reset token.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      await api.post('/auth/reset-password', { token, password });
      setIsSuccess(true);
      toast.success('Password reset successfully!');
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reset password. The link may have expired.');
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
            Reset Your<br />
            <span className="text-primary-900">Password</span>
          </h1>
          <p className="mt-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
            Enter a new password for your account
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-xs text-left mb-5 font-medium">
            <p className="font-bold">{error}</p>
          </div>
        )}

        {isSuccess ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-4 py-4"
          >
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm uppercase">Success!</h3>
            <p className="text-[11px] text-slate-600 font-medium">Your password has been reset successfully. Redirecting you to the login screen in a few seconds...</p>
            <button
              onClick={() => navigate('/login')}
              className="mt-2 text-[11px] font-bold text-primary-900 hover:text-primary-700 underline"
            >
              Go to Login page immediately
            </button>
          </motion.div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide">New Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full pl-9 pr-3.5 py-2 border border-slate-200 bg-white rounded-lg text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Confirm New Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className="w-full pl-9 pr-3.5 py-2 border border-slate-200 bg-white rounded-lg text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700"
                  />
                </div>
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
                    Resetting...
                  </>
                ) : (
                  <>
                    Reset Password
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-700 transition-colors"
              >
                Back to Login
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
