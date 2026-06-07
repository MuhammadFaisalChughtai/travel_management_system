import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Navigation2, User, LogOut, Bell, Check, X, Eye, Loader2, History, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { TechbarredLogo } from './TechbarredLogo';
import { useEffect, useState, useRef } from 'react';
import { api } from '../api/axios';
import toast from 'react-hot-toast';

export function formatPendingNotes(notes: string | null | undefined): string {
  if (!notes) return 'No description provided.';
  
  if (notes.startsWith('[PENDING_VENDOR_PAYMENT] ')) {
    try {
      const jsonStr = notes.replace('[PENDING_VENDOR_PAYMENT] ', '');
      const data = JSON.parse(jsonStr);
      let desc = `Vendor Payment of £${Number(data.amount).toFixed(2)} to ${data.vendorName || 'Unknown Vendor'}.`;
      if (data.flightPnr) desc += ` PNR: ${data.flightPnr}.`;
      if (data.notes) desc += ` (Notes: ${data.notes})`;
      return desc;
    } catch (e) {
      return notes;
    }
  }
  
  if (notes.startsWith('[PENDING_DISCOUNT] ')) {
    try {
      const jsonStr = notes.replace('[PENDING_DISCOUNT] ', '');
      const data = JSON.parse(jsonStr);
      let desc = `Discount of £${Number(data.amount).toFixed(2)} on ${data.vendorCategory || 'Service'} service (${data.serviceName || 'Unknown'}).`;
      if (data.notes) desc += ` (Notes: ${data.notes})`;
      return desc;
    } catch (e) {
      return notes;
    }
  }
  
  if (notes.startsWith('[PENDING_REFUND] ')) {
    try {
      const jsonStr = notes.replace('[PENDING_REFUND] ', '');
      const data = JSON.parse(jsonStr);
      let desc = `${data.direction || 'Refund'} of £${Number(data.amount).toFixed(2)} on ${data.vendorCategory || 'Service'} service (${data.serviceName || 'Unknown'}).`;
      if (data.notes) desc += ` (Notes: ${data.notes})`;
      return desc;
    } catch (e) {
      return notes;
    }
  }
  
  if (notes.startsWith('[PENDING_BULK_VENDOR_PAYMENT] ')) {
    try {
      const jsonStr = notes.replace('[PENDING_BULK_VENDOR_PAYMENT] ', '');
      const data = JSON.parse(jsonStr);
      let desc = `Bulk Vendor Payment of £${Number(data.amount).toFixed(2)} to ${data.vendorName || 'Unknown Vendor'}.`;
      if (data.notes) desc += ` (Notes: ${data.notes})`;
      return desc;
    } catch (e) {
      return notes;
    }
  }
  
  return notes;
}

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isDashboard = location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/super-admin');
  const { isAuthenticated, user, logout } = useAuthStore();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeApproval, setActiveApproval] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isAdmin = user && ['COMPANY_ADMIN', 'MAIN_COMPANY_ADMIN', 'ADMIN'].includes(user.role || '');

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/finance/notifications');
      setNotifications(res.data.notifications || []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 20000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, isAdmin]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notif: any) => {
    setShowDropdown(false);
    if (notif.type === 'PAYMENT_APPROVAL' && notif.referenceId) {
      try {
        const res = await api.get(`/finance/payments/${notif.referenceId}`);
        setActiveApproval({
          notification: notif,
          payment: res.data.payment
        });
      } catch (err) {
        console.error('Failed to load payment details:', err);
        toast.error('Failed to load payment details');
      }
    } else {
      try {
        await api.post(`/finance/notifications/${notif.id}/read`);
        fetchNotifications();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleApprove = async (paymentId: number) => {
    setSubmitting(true);
    try {
      await api.post(`/finance/payments/${paymentId}/approve`);
      toast.success('Transaction approved successfully');
      setActiveApproval(null);
      fetchNotifications();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to approve transaction');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (paymentId: number) => {
    setSubmitting(true);
    try {
      await api.post(`/finance/payments/${paymentId}/reject`);
      toast.success('Transaction rejected successfully');
      setActiveApproval(null);
      fetchNotifications();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to reject transaction');
    } finally {
      setSubmitting(false);
    }
  };

  const [notifTab, setNotifTab] = useState<'new' | 'history'>('new');

  const handleMarkAllRead = async () => {
    const unread = notifications.filter(n => !n.isRead);
    await Promise.all(unread.map(n => api.post(`/finance/notifications/${n.id}/read`).catch(() => {})));
    fetchNotifications();
  };

  const handleDismissNotification = async (notifId: number) => {
    try {
      await api.post(`/finance/notifications/${notifId}/read`);
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const isToday = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const unreadNotifications = notifications.filter(n => !n.isRead && isToday(n.createdAt));
  const unreadCount = unreadNotifications.length;
  // Tab split: "New" = unread pending approvals; "History" = everything today
  const newTabItems = notifications.filter(n => !n.isRead && isToday(n.createdAt));
  const historyTabItems = notifications.filter(n => isToday(n.createdAt));

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
                  {/* Notification Bell */}
                  {isAdmin && (
                    <div className="relative" ref={dropdownRef}>
                      <button 
                        onClick={() => setShowDropdown(!showDropdown)} 
                        className="p-1.5 text-slate-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors relative bg-slate-50 shadow-sm border border-slate-100"
                        title="Notifications"
                      >
                        <Bell className="h-4 w-4" />
                        {unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-[8px] font-bold w-3.5 h-3.5 flex items-center justify-center border border-white">
                            {unreadCount > 9 ? '9+' : unreadCount}
                          </span>
                        )}
                      </button>

                      <AnimatePresence>
                        {showDropdown && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute right-0 mt-2 w-96 bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-2xl z-[60] overflow-hidden flex flex-col"
                            style={{ maxHeight: '520px' }}
                          >
                            {/* Header */}
                            <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 shrink-0">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                  <Bell className="w-3.5 h-3.5 text-amber-500" /> Notifications
                                </span>
                                {unreadCount > 0 && (
                                  <button onClick={handleMarkAllRead} className="text-[10px] font-bold text-primary-600 hover:text-primary-800 hover:underline transition-colors">
                                    Mark all read
                                  </button>
                                )}
                              </div>
                              {/* Tabs */}
                              <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
                                <button
                                  onClick={() => setNotifTab('new')}
                                  className={`flex-1 text-[10px] font-bold py-1 rounded-md transition-all ${
                                    notifTab === 'new' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                  }`}
                                >
                                  New {unreadCount > 0 && <span className="ml-1 bg-red-500 text-white rounded-full px-1.5 py-0.5 text-[9px]">{unreadCount}</span>}
                                </button>
                                <button
                                  onClick={() => setNotifTab('history')}
                                  className={`flex-1 text-[10px] font-bold py-1 rounded-md transition-all flex items-center justify-center gap-1 ${
                                    notifTab === 'history' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                  }`}
                                >
                                  <History className="w-3 h-3" /> All History ({historyTabItems.length})
                                </button>
                              </div>
                            </div>

                            {/* List */}
                            <div className="overflow-y-auto flex-1 divide-y divide-slate-50">
                              {(() => {
                                const items = notifTab === 'new' ? newTabItems : historyTabItems;
                                if (items.length === 0) {
                                  return (
                                    <div className="p-8 text-center">
                                      <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                                      <p className="text-slate-400 text-xs font-medium">
                                        {notifTab === 'new' ? 'No new notifications.' : 'No notification history yet.'}
                                      </p>
                                    </div>
                                  );
                                }
                                return items.map((notif: any) => {
                                  // Determine visual state from notification metadata
                                  const isPending = !notif.isRead && notif.type === 'PAYMENT_APPROVAL';
                                  const isRejected = notif.isRead && notif.type === 'PAYMENT_APPROVAL' && notif.title?.toLowerCase().includes('reject');
                                  return (
                                    <div 
                                      key={notif.id} 
                                      className={`p-3.5 flex gap-2.5 items-start cursor-pointer hover:bg-slate-50 transition-colors relative ${
                                        !notif.isRead ? 'bg-amber-50/30' : 'bg-white'
                                      }`}
                                      onClick={() => handleNotificationClick(notif)}
                                    >
                                      {/* Unread dot */}
                                      {!notif.isRead && (
                                        <span className="absolute top-3.5 left-1.5 w-1.5 h-1.5 bg-amber-500 rounded-full" />
                                      )}
                                      <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                                        isPending ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                        isRejected ? 'bg-red-50 text-red-500 border border-red-100' :
                                        'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                      }`}>
                                        <Bell className="w-3.5 h-3.5" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-1">
                                          <span className="text-[11px] font-extrabold text-slate-800 tracking-wide leading-tight">{notif.title}</span>
                                          {/* Status pill */}
                                          {notif.type === 'PAYMENT_APPROVAL' && (
                                            <span className={`shrink-0 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${
                                              notif.isRead ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-700'
                                            }`}>
                                              {notif.isRead ? 'Reviewed' : '⏳ Pending'}
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-[10px] text-slate-500 font-medium leading-normal mt-1 break-words line-clamp-2">{notif.message}</p>
                                        <div className="flex items-center justify-between mt-1.5">
                                          <span className="text-[9px] text-slate-400 font-mono">
                                            <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                                            {new Date(notif.createdAt).toLocaleString()}
                                          </span>
                                          {!notif.isRead && (
                                            <button 
                                              onClick={(e) => { e.stopPropagation(); handleDismissNotification(notif.id); }}
                                              className="text-[9px] text-slate-400 hover:text-slate-600 font-bold hover:underline"
                                            >
                                              Dismiss
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  <div className="hidden md:flex flex-col items-end mr-1">
                    <span className="text-[13px] font-semibold text-slate-900">{user?.name || 'Traveler'}</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wide">
                      {user?.role === 'SUPER_ADMIN' ? 'SaaS Platform Admin' : user?.role === 'COMPANY_ADMIN' ? 'Company Admin' : user?.role === 'MAIN_COMPANY_ADMIN' ? 'Main Admin' : 'Agent'}
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

      {/* Transaction Approval Modal */}
      <AnimatePresence>
        {activeApproval && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActiveApproval(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 15 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Dynamic Header color and text based on status */}
              {(() => {
                const status = activeApproval.payment?.status;
                let bgClass = "from-amber-600 to-amber-700";
                let iconColor = "text-amber-200";
                let headerText = "Review Transaction Log";
                let subText = "Pending approval request submitted by Agent";
                let Icon = Bell;
                let animateClass = "animate-bounce";

                if (status === 'approved') {
                  bgClass = "from-emerald-600 to-emerald-700";
                  iconColor = "text-emerald-200";
                  headerText = "Transaction Approved ✓";
                  subText = "This transaction has been successfully processed and logged to ledger";
                  Icon = Check;
                  animateClass = "";
                } else if (status === 'rejected') {
                  bgClass = "from-red-600 to-red-700";
                  iconColor = "text-red-200";
                  headerText = "Transaction Rejected ✗";
                  subText = "This transaction request has been rejected";
                  Icon = X;
                  animateClass = "";
                }

                return (
                  <div className={`bg-gradient-to-r ${bgClass} text-white px-6 py-4 flex justify-between items-center shadow-inner shrink-0 transition-all duration-300`}>
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-5 h-5 ${iconColor} ${animateClass}`} />
                      <div>
                        <h3 className="font-extrabold text-white text-sm tracking-wide uppercase leading-none">{headerText}</h3>
                        <p className={`${status === 'approved' ? 'text-emerald-100' : status === 'rejected' ? 'text-red-100' : 'text-amber-100'} text-[10px] mt-1 font-normal`}>{subText}</p>
                      </div>
                    </div>
                    <button onClick={() => setActiveApproval(null)} className="text-white/60 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                  </div>
                );
              })()}

              <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-white/50 text-xs">
                <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-100 rounded-2xl p-4 font-semibold text-slate-600">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Booking Reference</span>
                    <span className="text-slate-800 font-mono text-sm bg-white border border-slate-100 px-2 py-0.5 rounded">{activeApproval.payment?.booking?.bookingReference || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Payment Amount</span>
                    <span className="text-slate-900 font-bold text-base">£{Number(activeApproval.payment?.amount).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Payment Method / Type</span>
                    <span className="text-slate-800">{activeApproval.payment?.paymentMethod} • {activeApproval.payment?.paymentType}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Logged By</span>
                    <span className="text-slate-800 font-bold">{activeApproval.payment?.loggedByName || 'Agent'} ({activeApproval.payment?.loggedByRole})</span>
                  </div>
                  {activeApproval.payment?.status && (
                    <div className="col-span-2 border-t border-slate-100 pt-3">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Approval Status</span>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        activeApproval.payment.status === 'approved' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                          : activeApproval.payment.status === 'rejected'
                          ? 'bg-red-50 text-red-700 border border-red-100'
                          : 'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        {activeApproval.payment.status === 'approved' && <Check className="w-3 h-3 text-emerald-600" />}
                        {activeApproval.payment.status === 'rejected' && <X className="w-3 h-3 text-red-600" />}
                        {activeApproval.payment.status === 'pending' && <Clock className="w-3 h-3 text-amber-500 animate-spin" />}
                        {activeApproval.payment.status}
                      </span>
                    </div>
                  )}
                  <div className="col-span-2 border-t border-slate-100 pt-3">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Notes / Description</span>
                    <p className="text-slate-700 italic font-medium">{formatPendingNotes(activeApproval.payment?.notes)}</p>
                  </div>
                </div>

                {activeApproval.payment?.evidenceUrl && (
                  <div className="space-y-2">
                    <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wide">Bank Transaction Evidence</span>
                    <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-slate-50 flex items-center justify-center max-h-60 relative group shadow-sm">
                      <img 
                        src={activeApproval.payment.evidenceUrl} 
                        alt="Bank evidence" 
                        className="object-contain max-h-60 w-full hover:scale-[1.02] transition-transform duration-300"
                      />
                      <a 
                        href={activeApproval.payment.evidenceUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="absolute bottom-3 right-3 bg-slate-900/80 hover:bg-slate-900 text-white p-2 rounded-xl flex items-center gap-1.5 shadow backdrop-blur-xs text-[10px] font-bold transition-all hover:scale-105 active:scale-95"
                      >
                        <Eye className="w-3.5 h-3.5" /> Full Size
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <div className={`bg-slate-50 border-t border-slate-200/60 p-4 shrink-0 flex items-center gap-3 ${
                activeApproval.payment?.status === 'approved' || activeApproval.payment?.status === 'rejected'
                  ? 'justify-end'
                  : 'justify-between'
              }`}>
                {(activeApproval.payment?.status !== 'approved' && activeApproval.payment?.status !== 'rejected') && (
                  <button 
                    onClick={() => handleReject(activeApproval.payment.id)} 
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-[11px] font-bold uppercase tracking-wider disabled:opacity-50 transition-colors"
                  >
                    Reject & Log
                  </button>
                )}
                <div className="flex gap-2">
                  <button 
                    onClick={() => setActiveApproval(null)} 
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-[11px] font-bold"
                  >
                    Cancel
                  </button>
                  {(activeApproval.payment?.status !== 'approved' && activeApproval.payment?.status !== 'rejected') && (
                    <button 
                      onClick={() => handleApprove(activeApproval.payment.id)} 
                      disabled={submitting}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl text-[11px] font-bold shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 uppercase tracking-wider disabled:opacity-50 transition-all hover:-translate-y-0.5 active:translate-y-0"
                    >
                      {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Approve Log
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
