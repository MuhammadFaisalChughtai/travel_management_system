import React, { useEffect, useState, useMemo } from 'react';
import { 
  Home, 
  Calendar, 
  CreditCard, 
  Settings, 
  LogOut, 
  Loader2, 
  Plus, 
  X, 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  Activity, 
  Target, 
  CalendarRange, 
  BarChart3, 
  Compass,
  Users,
  Award,
  CheckCircle,
  Building,
  Mail,
  Phone,
  Globe,
  MapPin,
  Lock,
  Unlock,
  
  Filter, Hash,
  UserCog,
  Shield,
  Search,
  User
} from 'lucide-react';
import { BookingRefSearchModal, CustomerSearchModal, AgentSearchModal, DateRangeSearchModal, PaymentStatusSearchModal } from '../components/booking-modals/SearchModals';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../api/axios';
import { TechbarredLogo } from '../components/TechbarredLogo';
import { VendorsPage } from './VendorsPage';
import { TeamManagement } from './TeamManagement';
import { FinancePage } from './FinancePage';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell, 
  ComposedChart, 
  Bar, 
  Line, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar
} from 'recharts';
import { BookingDetailsModal } from '../components/BookingDetailsModal';
import { AgentsPage } from './AgentsPage';

const SIDEBAR_ITEMS = [
  { id: 'overview', icon: Home, label: 'Overview' },
  { id: 'bookings', icon: Calendar, label: 'My Bookings' },
  { id: 'agents', icon: Users, label: 'Agents' },
  { id: 'vendors', icon: UserCog, label: 'Vendors Registry' },
  { id: 'payments', icon: CreditCard, label: 'Finance & Payments' },
  { id: 'team', icon: Shield, label: 'Team & Permissions' },
  { id: 'settings', icon: Settings, label: 'Settings' },
];

export function Dashboard() {
  const { user, logout, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Sidebar navigation tab state
  const [sidebarTab, setSidebarTab] = useState<'overview' | 'bookings' | 'agents' | 'vendors' | 'payments' | 'team' | 'settings'>('overview');

  // Overview sub-tab state (Overview Analytics vs Agent Analytics)
  const [dashboardTab, setDashboardTab] = useState<'overview' | 'agents'>('overview');

  // Timeframe selector for the main revenue chart
  const [timeframe, setTimeframe] = useState<'daily' | 'monthly' | 'quarterly' | 'biannual' | 'yearly'>('monthly');

  // Booking details modal state
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Create booking state variables
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRef, setNewRef] = useState('');
  const [newPrice, setNewPrice] = useState('1500');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newAgent, setNewAgent] = useState('Sarah Jenkins');
  const [createLoading, setCreateLoading] = useState(false);
  const [dbAgents, setDbAgents] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    const fetchAgentsList = async () => {
      try {
        const res = await api.get('/agents');
        setDbAgents(res.data.agents || []);
      } catch (err) {
        console.error('Failed to fetch agents', err);
      }
    };
    fetchAgentsList();
  }, []);

  // Simulated company settings state
  const [companyInfo] = useState({
    name: 'TravelBooker Workspace',
    logo: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80',
    domain: 'travelbooker.co.uk',
    description: 'Bespoke global luxury travel operators and package reservation engines.',
    industry: 'Travel & Hospitality',
    location: 'London, UK',
    email: 'operations@travelbooker.co.uk',
    phone: '+44 20 7946 0958',
    plan: 'Premium Subscription (Active)',
  });

  // Filter States
  const defaultFilters = {
    id: '',
    dateStart: '',
    dateEnd: '',
    departureDateStart: '',
    departureDateEnd: '',
    bookingReference: '',
    agentName: 'Any',
    customerName: '',
    customerEmail: '',
    status: 'Any',
    isLocked: 'Any',
    paymentStatus: 'Any',
    customerPhone: '',
    createdAtStart: '',
    createdAtEnd: ''
  };
  const [filters, setFilters] = useState(defaultFilters);
  const [activeSearchModal, setActiveSearchModal] = useState<string | null>(null);
  const userRole = localStorage.getItem('userRole') || '';

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'Any') {
          params.append(key, value);
        }
      });
      const response = await api.get(`/bookings/my-bookings?${params.toString()}`);
      setBookings(response.data.bookings);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleLock = async (e: React.MouseEvent, bookingId: number, currentLock: boolean) => {
    e.stopPropagation();
    try {
      await api.patch(`/bookings/${bookingId}`, { isLocked: !currentLock });
      fetchBookings();
      import('react-hot-toast').then(m => m.default.success(currentLock ? 'Booking unlocked' : 'Booking locked'));
    } catch (err) {
      import('react-hot-toast').then(m => m.default.error('Failed to update lock status'));
    }
  };



  const performClearFilters = async () => {
    setFilters(defaultFilters);
    try {
      setLoading(true);
      const response = await api.get('/bookings/my-bookings');
      setBookings(response.data.bookings);
    } catch (error) {
      console.error('Failed to clear filters:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    const prefix = companyInfo.name.substring(0, 2).toUpperCase();
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    setNewRef(`${prefix}${randomStr}`);
    setShowCreateModal(true);
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchBookings();
  }, [isAuthenticated, navigate]);

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      await api.post('/bookings', {
        bookingReference: newRef,
        totalPrice: parseFloat(newPrice) || 0,
        date: new Date(newDate).toISOString(),
        customers: [],
        agentName: newAgent
      });
      setNewRef('');
      setShowCreateModal(false);
      fetchBookings();
    } catch (err) {
      console.error('Create booking failed:', err);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const stats = useMemo(() => {
    const totalActualRevenue = bookings.reduce((sum, b) => sum + (parseFloat(b.totalPrice) || 0), 0);
    const bookingCount = bookings.length;
    
    const baselineRevenue = 328400; 
    const totalRevenue = baselineRevenue + totalActualRevenue;
    const totalVolume = 158 + bookingCount;
    const currentAov = totalVolume > 0 ? totalRevenue / totalVolume : 0;

    return {
      actualRevenue: totalActualRevenue,
      totalRevenue,
      totalVolume,
      aov: currentAov,
      growth: 14.8, 
      conversionRate: 3.24 
    };
  }, [bookings]);

  const revenueChartData = useMemo(() => {
    const getActualSum = (filterFn: (b: any) => boolean) => {
      return bookings.filter(filterFn).reduce((sum, b) => sum + (parseFloat(b.totalPrice) || 0), 0);
    };

    switch (timeframe) {
      case 'daily':
        return Array.from({ length: 14 }).map((_, idx) => {
          const d = new Date();
          d.setDate(d.getDate() - (13 - idx));
          const dateStr = d.toISOString().split('T')[0];
          const actualSum = getActualSum(b => b.date.startsWith(dateStr));
          const baseline = 800 + Math.sin(idx * 0.8) * 300 + (idx % 3 === 0 ? 400 : 0);
          return {
            label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            Revenue: parseFloat((baseline + actualSum).toFixed(2)),
            Target: 1200
          };
        });

      case 'monthly':
      default:
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const currentMonthIdx = new Date().getMonth();
        return Array.from({ length: 12 }).map((_, idx) => {
          const mIdx = (currentMonthIdx - 11 + idx + 12) % 12;
          const actualSum = getActualSum(b => {
            const bDate = new Date(b.date);
            return bDate.getMonth() === mIdx && bDate.getFullYear() === (new Date().getFullYear() - (mIdx > currentMonthIdx ? 1 : 0));
          });
          const seasonalCurve = [15000, 18000, 22000, 28000, 35000, 48000, 52000, 49000, 38000, 29000, 21000, 24000];
          const base = seasonalCurve[mIdx];
          return {
            label: months[mIdx],
            Revenue: base + actualSum,
            Target: parseFloat((base * 1.15).toFixed(0))
          };
        });

      case 'quarterly':
        return [
          { label: 'Q3 2025', Base: 88000, Target: 90000 },
          { label: 'Q4 2025', Base: 94000, Target: 95000 },
          { label: 'Q1 2026', Base: 76000, Target: 85000 },
          { label: 'Q2 2026', Base: 105000, Target: 100000 }
        ].map((q, idx) => {
          const actualSum = getActualSum(b => {
            const bDate = new Date(b.date);
            const qIdx = Math.floor(bDate.getMonth() / 3);
            if (idx === 0) return bDate.getFullYear() === 2025 && qIdx === 2; 
            if (idx === 1) return bDate.getFullYear() === 2025 && qIdx === 3; 
            if (idx === 2) return bDate.getFullYear() === 2026 && qIdx === 0; 
            return bDate.getFullYear() === 2026 && qIdx === 1; 
          });
          return {
            label: q.label,
            Revenue: q.Base + actualSum,
            Target: q.Target
          };
        });

      case 'biannual':
        return [
          { label: 'H1 2024', Base: 165000, Target: 160000 },
          { label: 'H2 2024', Base: 185000, Target: 180000 },
          { label: 'H1 2025', Base: 198000, Target: 200000 },
          { label: 'H2 2025', Base: 235000, Target: 220000 }
        ].map((h, idx) => {
          const actualSum = getActualSum(b => {
            const bDate = new Date(b.date);
            const isFirstHalf = bDate.getMonth() < 6;
            if (idx === 0) return bDate.getFullYear() === 2024 && isFirstHalf;
            if (idx === 1) return bDate.getFullYear() === 2024 && !isFirstHalf;
            if (idx === 2) return bDate.getFullYear() === 2025 && isFirstHalf;
            return bDate.getFullYear() === 2025 && !isFirstHalf;
          });
          return {
            label: h.label,
            Revenue: h.Base + actualSum,
            Target: h.Target
          };
        });

      case 'yearly':
        const years = [2022, 2023, 2024, 2025, 2026];
        return years.map(yr => {
          const actualSum = getActualSum(b => new Date(b.date).getFullYear() === yr);
          const baseMap: Record<number, number> = {
            2022: 240000, 2023: 285000, 2024: 350000, 2025: 433000, 2026: 220000
          };
          const targetMap: Record<number, number> = {
            2022: 230000, 2023: 275000, 2024: 340000, 2025: 410000, 2026: 480000
          };
          return {
            label: String(yr),
            Revenue: baseMap[yr] + actualSum,
            Target: targetMap[yr]
          };
        });
    }
  }, [timeframe, bookings]);

  const channelData = useMemo(() => {
    let flights = 45;
    let hotels = 30;
    let packages = 15;
    let tours = 10;

    bookings.forEach((_, idx) => {
      const remainder = idx % 4;
      if (remainder === 0) flights += 1;
      else if (remainder === 1) hotels += 1;
      else if (remainder === 2) packages += 1;
      else tours += 1;
    });

    const total = flights + hotels + packages + tours;
    return [
      { name: 'Custom Packages', value: total > 0 ? Math.round((packages / total) * 100) : 0, color: '#6366f1' },
      { name: 'Hotel Bookings', value: total > 0 ? Math.round((hotels / total) * 100) : 0, color: '#3b82f6' },
      { name: 'Flight Services', value: total > 0 ? Math.round((flights / total) * 100) : 0, color: '#10b981' },
      { name: 'Local Excursions', value: total > 0 ? Math.round((tours / total) * 100) : 0, color: '#f59e0b' }
    ];
  }, [bookings]);

  const weeklyRadarData = useMemo(() => {
    const days = [
      { day: 'Mon', Base: 40 }, { day: 'Tue', Base: 48 }, { day: 'Wed', Base: 55 },
      { day: 'Thu', Base: 68 }, { day: 'Fri', Base: 85 }, { day: 'Sat', Base: 92 }, { day: 'Sun', Base: 60 }
    ];

    bookings.forEach(b => {
      const dayIdx = new Date(b.date).getDay();
      const mappedIdx = dayIdx === 0 ? 6 : dayIdx - 1;
      days[mappedIdx].Base += 5;
    });

    return days.map(d => ({
      subject: d.day,
      Sales: d.Base,
      AOV: Math.round(d.Base * 22)
    }));
  }, [bookings]);

  const composedVolumeData = useMemo(() => {
    const monthlyBaselines = [
      { month: 'Nov', Vol: 18, Aov: 1420 },
      { month: 'Dec', Vol: 24, Aov: 1580 },
      { month: 'Jan', Vol: 15, Aov: 1390 },
      { month: 'Feb', Vol: 19, Aov: 1450 },
      { month: 'Mar', Vol: 28, Aov: 1610 },
      { month: 'Apr', Vol: 35, Aov: 1720 }
    ];

    bookings.forEach((b) => {
      const monthStr = new Date(b.date).toLocaleDateString('en-US', { month: 'short' });
      const target = monthlyBaselines.find(m => m.month === monthStr);
      if (target) {
        target.Vol += 1;
        target.Aov = Math.round((target.Aov * (target.Vol - 1) + (parseFloat(b.totalPrice) || 1200)) / target.Vol);
      }
    });

    return monthlyBaselines;
  }, [bookings]);

  const agentsAnalytics = useMemo(() => {
    const baseAgentPerformance: Record<string, { revenue: number, bookings: number, color: string, badgeColor: string }> = {
      'Sarah Jenkins': { revenue: 85000, bookings: 35, color: '#6366f1', badgeColor: 'bg-indigo-50 text-indigo-600' },
      'Michael Chang': { revenue: 98000, bookings: 42, color: '#3b82f6', badgeColor: 'bg-primary-50 text-primary-600' },
      'Emily Watson': { revenue: 62000, bookings: 28, color: '#10b981', badgeColor: 'bg-emerald-50 text-emerald-600' },
      'Alex Rodriguez': { revenue: 74000, bookings: 31, color: '#f59e0b', badgeColor: 'bg-amber-50 text-amber-600' },
      'David Miller': { revenue: 52000, bookings: 22, color: '#ec4899', badgeColor: 'bg-pink-50 text-pink-600' },
      'System / Auto': { revenue: 15400, bookings: 11, color: '#94a3b8', badgeColor: 'bg-slate-100 text-slate-600' }
    };

    bookings.forEach(b => {
      const agent = b.agentName || 'System / Auto';
      const price = parseFloat(b.totalPrice) || 0;
      
      if (baseAgentPerformance[agent]) {
        baseAgentPerformance[agent].revenue += price;
        baseAgentPerformance[agent].bookings += 1;
      } else {
        baseAgentPerformance[agent] = {
          revenue: price,
          bookings: 1,
          color: '#8b5cf6',
          badgeColor: 'bg-purple-50 text-purple-600'
        };
      }
    });

    const performanceList = Object.entries(baseAgentPerformance).map(([name, data]) => ({
      name,
      ...data,
      aov: data.bookings > 0 ? data.revenue / data.bookings : 0
    })).sort((a, b) => b.revenue - a.revenue);

    const months = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'];
    const monthlyTrends = months.map((m, monthIdx) => {
      const row: Record<string, any> = { label: m };
      row['Sarah Jenkins'] = 11000 + monthIdx * 2000 + (monthIdx % 2 === 0 ? 1000 : 0);
      row['Michael Chang'] = 13000 + monthIdx * 1800 + (monthIdx % 3 === 0 ? -1200 : 800);
      row['Emily Watson'] = 8000 + monthIdx * 1500 + (monthIdx === 4 ? 3000 : 0);
      row['Alex Rodriguez'] = 9500 + monthIdx * 1400;
      row['David Miller'] = 7000 + monthIdx * 1200 + (monthIdx % 2 === 1 ? 1500 : 0);
      row['System / Auto'] = 2000 + (monthIdx % 3) * 500;

      bookings.forEach(b => {
        const agent = b.agentName || 'System / Auto';
        const bDate = new Date(b.date);
        const bMonthStr = bDate.toLocaleDateString('en-US', { month: 'short' });
        if (bMonthStr === m && row[agent] !== undefined) {
          row[agent] += parseFloat(b.totalPrice) || 0;
        }
      });

      return row;
    });

    return {
      performanceList,
      monthlyTrends
    };
  }, [bookings]);

  if (!user) return null;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-slate-50/50">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white border-r border-slate-200/80 flex-shrink-0 hidden md:flex flex-col justify-between">
        <div className="p-6">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-500 flex items-center justify-center text-white font-extrabold text-xl shadow-md shadow-primary-500/20">
              {user.name ? user.name.substring(0, 2).toUpperCase() : 'JD'}
            </div>
            <div>
              <h2 className="font-bold text-slate-800 tracking-tight leading-tight">{user.name || 'Traveler'}</h2>
              <span className="inline-block mt-0.5 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">Workspace User</span>
            </div>
          </div>
          
          <nav className="space-y-1.5">
            {SIDEBAR_ITEMS.map((item) => {
              // Hide Team & Permissions from Agents
              if (item.id === 'team' && user?.role === 'AGENT') return null;

              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setSidebarTab(item.id as any)}
                  className={`flex items-center gap-3 w-full px-4 py-3 rounded-2xl transition-all duration-200 text-left font-semibold text-xs ${
                    sidebarTab === item.id 
                      ? 'bg-primary-500 text-white shadow-md shadow-primary-500/25' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
        
        <div className="p-6 border-t border-slate-100 flex flex-col gap-6">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 text-red-500 hover:bg-red-50/80 w-full px-4 py-3 rounded-2xl font-semibold transition-all duration-200 text-xs text-left"
          >
            <LogOut className="h-4.5 w-4.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto space-y-6">
        
        {sidebarTab === 'agents' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <AgentsPage />
          </div>
        )}

        {sidebarTab === 'vendors' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <VendorsPage />
          </div>
        )}

        {sidebarTab === 'team' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <TeamManagement />
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {sidebarTab === 'overview' && (
          <>
            {/* Navigation & Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Sales & Operations Intelligence</h1>
                <p className="text-slate-500 mt-1">Real-time ledger analytics, bookings statistics, and multi-agent performance.</p>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/40 text-[10px] font-bold">
                  <button 
                    onClick={() => setDashboardTab('overview')}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all duration-200 ${
                      dashboardTab === 'overview' 
                        ? 'bg-white text-primary-600 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5" /> Company Overview
                  </button>
                  <button 
                    onClick={() => setDashboardTab('agents')}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all duration-200 ${
                      dashboardTab === 'agents' 
                        ? 'bg-white text-primary-600 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" /> Agent Performance
                  </button>
                </div>

                <button 
                  onClick={handleOpenCreateModal}
                  className="flex items-center gap-2 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-primary-500/25 active:scale-95"
                >
                  <Plus className="h-4 w-4" /> New Booking
                </button>
              </div>
            </div>

            {dashboardTab === 'overview' ? (
              <>
                {/* Core KPI Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300"
                  >
                    <div className="absolute right-0 top-0 h-24 w-24 bg-primary-50 rounded-bl-full -z-10 opacity-40 group-hover:scale-110 transition-transform duration-300" />
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-xs font-bold">Gross Booking Revenue</span>
                      <div className="h-8 w-8 bg-primary-100 text-primary-600 rounded-xl flex items-center justify-center">
                        <DollarSign className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="text-xl font-black text-slate-900 mt-3">
                      £{stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="flex items-center gap-0.5 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                        <TrendingUp className="h-3 w-3" /> +{stats.growth}%
                      </span>
                      <span className="text-slate-400 text-[10px] font-medium">vs last period</span>
                    </div>
                  </motion.div>

                  <motion.div 
                    initial={{ opacity: 0, y: 15 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: 0.05 }}
                    className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300"
                  >
                    <div className="absolute right-0 top-0 h-24 w-24 bg-primary-50 rounded-bl-full -z-10 opacity-40 group-hover:scale-110 transition-transform duration-300" />
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-xs font-bold">Average Order Value (AOV)</span>
                      <div className="h-8 w-8 bg-primary-100 text-primary-600 rounded-xl flex items-center justify-center">
                        <ShoppingBag className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="text-xl font-black text-slate-900 mt-3">
                      £{stats.aov.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="flex items-center gap-0.5 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                        <TrendingUp className="h-3 w-3" /> +4.2%
                      </span>
                      <span className="text-slate-400 text-[10px] font-medium">from last month</span>
                    </div>
                  </motion.div>

                  <motion.div 
                    initial={{ opacity: 0, y: 15 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: 0.1 }}
                    className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300"
                  >
                    <div className="absolute right-0 top-0 h-24 w-24 bg-indigo-50 rounded-bl-full -z-10 opacity-40 group-hover:scale-110 transition-transform duration-300" />
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-xs font-bold">Orders Processed</span>
                      <div className="h-8 w-8 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                        <Activity className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="text-xl font-black text-slate-900 mt-3">
                      {stats.totalVolume}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="flex items-center gap-0.5 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                        <TrendingUp className="h-3 w-3" /> +9.1%
                      </span>
                      <span className="text-slate-400 text-[10px] font-medium">monthly growth</span>
                    </div>
                  </motion.div>

                  <motion.div 
                    initial={{ opacity: 0, y: 15 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: 0.15 }}
                    className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300"
                  >
                    <div className="absolute right-0 top-0 h-24 w-24 bg-amber-50 rounded-bl-full -z-10 opacity-40 group-hover:scale-110 transition-transform duration-300" />
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-xs font-bold">Q2 Target Progress</span>
                      <div className="h-8 w-8 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                        <Target className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="text-xl font-black text-slate-900 mt-3">
                      {Math.min(100, Math.round((stats.totalRevenue / 400000) * 100))}%
                    </p>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2.5 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full transition-all duration-1000"
                        style={{ width: `${Math.min(100, Math.round((stats.totalRevenue / 400000) * 100))}%` }}
                      />
                    </div>
                  </motion.div>
                </div>

                {/* Main Area Chart */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: 0.2 }}
                  className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-5"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50 pb-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                        <CalendarRange className="h-4.5 w-4.5 text-primary-500" /> Sales Revenue History
                      </h3>
                      <p className="text-[11px] text-slate-500">Track company invoicing, sales pipeline, and platform growth timelines.</p>
                    </div>

                    <div className="flex flex-wrap gap-1 bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/40 text-[10px] font-bold">
                      {[
                        { id: 'daily', label: 'Daily' },
                        { id: 'monthly', label: 'Monthly' },
                        { id: 'quarterly', label: 'Quarterly' },
                        { id: 'biannual', label: 'Bi-Annual' },
                        { id: 'yearly', label: 'Yearly' }
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setTimeframe(tab.id as any)}
                          className={`px-2.5 py-1.5 rounded-lg transition-all duration-200 ${
                            timeframe === tab.id 
                              ? 'bg-white text-primary-600 shadow-sm border border-slate-100/50' 
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="w-full h-[300px] text-[10px] font-mono">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorTarget" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} stroke="#94a3b8" tickMargin={10} />
                        <YAxis tickLine={false} axisLine={false} stroke="#94a3b8" tickFormatter={value => `£${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`} tickMargin={10} />
                        <Tooltip formatter={(value: any) => [`£${Number(value).toLocaleString()}`, '']} />
                        <Legend iconType="circle" />
                        <Area name="Invoiced Revenue" type="monotone" dataKey="Revenue" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                        <Area name="Projected Target" type="monotone" dataKey="Target" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" fillOpacity={1} fill="url(#colorTarget)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>

                {/* Secondary Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: 0.25 }}
                    className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <Compass className="h-4 w-4 text-primary-500" /> Booking Breakdown
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">Revenue percentage share by purchase channel.</p>
                    </div>

                    <div className="h-[160px] w-full relative flex items-center justify-center my-3">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={channelData} cx="50%" cy="50%" innerRadius={48} outerRadius={66} paddingAngle={3} dataKey="value">
                            {channelData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: any) => [`${value}%`, 'Share']} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute text-center">
                        <span className="block text-[8px] uppercase font-bold text-slate-400">Total</span>
                        <span className="text-base font-black text-slate-800">{bookings.length + 158}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-600 border-t border-slate-50 pt-3">
                      {channelData.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="truncate">{item.name}</span>
                          <span className="ml-auto text-[9px] text-slate-400 font-mono">{item.value}%</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>

                  <motion.div 
                    initial={{ opacity: 0, y: 20 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: 0.3 }}
                    className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <BarChart3 className="h-4 w-4 text-primary-500" /> Weekly Distribution
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">Booking intensity heatmap by days of the week.</p>
                    </div>

                    <div className="h-[170px] w-full text-[9px] my-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={weeklyRadarData}>
                          <PolarGrid stroke="#f1f5f9" />
                          <PolarAngleAxis dataKey="subject" stroke="#94a3b8" />
                          <PolarRadiusAxis angle={30} domain={[0, 120]} stroke="#cbd5e1" tick={false} />
                          <Radar name="Invoices" dataKey="Sales" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                          <Tooltip />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="text-[9px] text-slate-400 text-center border-t border-slate-50 pt-2 font-medium">
                      Peak operational load is observed mid-week and Fridays.
                    </div>
                  </motion.div>

                  <motion.div 
                    initial={{ opacity: 0, y: 20 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: 0.35 }}
                    className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <Activity className="h-4 w-4 text-indigo-500" /> Volume vs Basket Value
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">Monthly booking volume alongside Average Order Value.</p>
                    </div>

                    <div className="h-[170px] w-full text-[8px] font-mono my-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={composedVolumeData} margin={{ top: 10, right: -5, left: -25, bottom: 0 }}>
                          <CartesianGrid stroke="#f8fafc" vertical={false} />
                          <XAxis dataKey="month" tickLine={false} axisLine={false} stroke="#94a3b8" />
                          <YAxis yAxisId="left" tickLine={false} axisLine={false} stroke="#94a3b8" />
                          <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} stroke="#10b981" />
                          <Tooltip />
                          <Bar yAxisId="left" dataKey="Vol" name="Invoices" fill="#818cf8" radius={[3, 3, 0, 0]} maxBarSize={16} />
                          <Line yAxisId="right" type="monotone" dataKey="Aov" name="Basket (£)" stroke="#10b981" strokeWidth={1.5} dot={{ r: 2 }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="text-[9px] text-slate-400 text-center border-t border-slate-50 pt-2 flex justify-around font-semibold">
                      <span className="flex items-center gap-1 font-sans"><div className="w-1.5 h-1.5 bg-indigo-400 rounded-full" /> Volume</span>
                      <span className="flex items-center gap-1 font-sans"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> AOV Value</span>
                    </div>
                  </motion.div>
                </div>
              </>
            ) : (
              <>
                {/* Agent KPI Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }} 
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300"
                  >
                    <div className="absolute right-0 top-0 h-24 w-24 bg-indigo-50 rounded-bl-full -z-10 opacity-40 group-hover:scale-110 transition-transform duration-300" />
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-xs font-bold">Top Performing Agent</span>
                      <div className="h-8 w-8 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                        <Award className="w-4.5 h-4.5" />
                      </div>
                    </div>
                    <p className="text-lg font-black text-slate-900 mt-3 truncate">
                      {agentsAnalytics.performanceList[0]?.name || 'Sarah Jenkins'}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2 text-[10px]">
                      <span className="text-emerald-600 font-bold">
                        £{(agentsAnalytics.performanceList[0]?.revenue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                      <span className="text-slate-400 font-medium">total sales</span>
                    </div>
                  </motion.div>

                  <motion.div 
                    initial={{ opacity: 0, y: 15 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: 0.05 }}
                    className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300"
                  >
                    <div className="absolute right-0 top-0 h-24 w-24 bg-emerald-50 rounded-bl-full -z-10 opacity-40 group-hover:scale-110 transition-transform duration-300" />
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-xs font-bold">Active Agent Bookings</span>
                      <div className="h-8 w-8 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                        <Users className="w-4.5 h-4.5" />
                      </div>
                    </div>
                    <p className="text-lg font-black text-slate-900 mt-3">
                      {agentsAnalytics.performanceList.reduce((sum, item) => sum + item.bookings, 0)}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-400">
                      <span className="text-slate-500 font-bold">
                        {agentsAnalytics.performanceList.filter(a => a.name !== 'System / Auto').length} agents
                      </span>
                      <span className="font-medium">in roster list</span>
                    </div>
                  </motion.div>

                  <motion.div 
                    initial={{ opacity: 0, y: 15 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: 0.1 }}
                    className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300"
                  >
                    <div className="absolute right-0 top-0 h-24 w-24 bg-primary-50 rounded-bl-full -z-10 opacity-40 group-hover:scale-110 transition-transform duration-300" />
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-xs font-bold">Average Agent Invoice</span>
                      <div className="h-8 w-8 bg-primary-100 text-primary-600 rounded-xl flex items-center justify-center">
                        <DollarSign className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="text-lg font-black text-slate-900 mt-3">
                      £{Math.round(agentsAnalytics.performanceList.reduce((sum, item) => sum + item.revenue, 0) / Math.max(1, agentsAnalytics.performanceList.reduce((sum, item) => sum + item.bookings, 0))).toLocaleString()}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2 text-[10px] text-emerald-600 font-bold">
                      <TrendingUp className="h-3 w-3" /> +2.8% AOV growth
                    </div>
                  </motion.div>

                  <motion.div 
                    initial={{ opacity: 0, y: 15 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: 0.15 }}
                    className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300"
                  >
                    <div className="absolute right-0 top-0 h-24 w-24 bg-pink-50 rounded-bl-full -z-10 opacity-40 group-hover:scale-110 transition-transform duration-300" />
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-xs font-bold">Agent Leader Share</span>
                      <div className="h-8 w-8 bg-pink-100 text-pink-600 rounded-xl flex items-center justify-center">
                        <Target className="w-4.5 h-4.5" />
                      </div>
                    </div>
                    <p className="text-lg font-black text-slate-900 mt-3">
                      {Math.round(((agentsAnalytics.performanceList[0]?.revenue || 0) / Math.max(1, stats.totalRevenue)) * 100)}%
                    </p>
                    <div className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-400 font-medium">
                      Contributed by {agentsAnalytics.performanceList[0]?.name || 'Sarah Jenkins'}
                    </div>
                  </motion.div>
                </div>

                {/* Agent trend charts */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }} 
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm lg:col-span-2 space-y-4"
                  >
                    <div>
                      <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <CalendarRange className="h-4 w-4 text-indigo-500" /> Agent Monthly Revenue Trend
                      </h3>
                      <p className="text-[10px] text-slate-500">Timeline comparison of individual agent invoice values over the last 6 months.</p>
                    </div>

                    <div className="w-full h-[240px] text-[9px] font-mono">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={agentsAnalytics.monthlyTrends}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} />
                          <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} tickFormatter={value => `£${(value / 1000).toFixed(0)}k`} />
                          <Tooltip formatter={(value) => `£${Number(value).toLocaleString()}`} />
                          <Legend iconType="circle" />
                          <Line type="monotone" dataKey="Sarah Jenkins" stroke="#6366f1" strokeWidth={2} dot={{ r: 2 }} />
                          <Line type="monotone" dataKey="Michael Chang" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} />
                          <Line type="monotone" dataKey="Emily Watson" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />
                          <Line type="monotone" dataKey="Alex Rodriguez" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
                          <Line type="monotone" dataKey="David Miller" stroke="#ec4899" strokeWidth={2} dot={{ r: 2 }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </motion.div>

                  <motion.div 
                    initial={{ opacity: 0, y: 20 }} 
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <Compass className="h-4 w-4 text-indigo-500" /> Sales Revenue Distribution
                      </h4>
                      <p className="text-[10px] text-slate-500">Direct agent contribution percentages.</p>
                    </div>

                    <div className="h-[140px] w-full relative flex items-center justify-center my-3">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={agentsAnalytics.performanceList} cx="50%" cy="50%" innerRadius={44} outerRadius={60} paddingAngle={2} dataKey="revenue">
                            {agentsAnalytics.performanceList.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => `£${Number(value).toLocaleString()}`} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute text-center">
                        <span className="block text-[8px] uppercase font-bold text-slate-400">Total</span>
                        <span className="text-sm font-black text-slate-800">
                          £{Math.round(agentsAnalytics.performanceList.reduce((sum, i) => sum + i.revenue, 0) / 1000)}k
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[9px] font-bold text-slate-600 border-t border-slate-50 pt-3">
                      {agentsAnalytics.performanceList.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="truncate">{item.name}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </div>

                {/* Agent Leaderboard Table */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3.5"
                >
                  <div>
                    <h3 className="text-sm font-black text-slate-800">Agent Performance Leaderboard</h3>
                    <p className="text-[10px] text-slate-500">Overview of booking counts, average booking values, and revenue rankings.</p>
                  </div>

                  <div className="overflow-x-auto text-[10px]">
                    <table className="w-full text-left border-collapse">
                      <thead>
                      <tr className="bg-slate-50/50 text-slate-400 font-bold uppercase border-b border-slate-100">
                        <th className="py-3 px-5">Invoice Reference</th>
                        <th className="py-3 px-5">Departure Date</th>
                        <th className="py-3 px-5">Assigned Agent</th>
                        <th className="py-3 px-5 text-right">Invoice Price</th>
                        <th className="py-3 px-5 text-right">Remaining</th>
                        <th className="py-3 px-5 text-right">Total Sent</th>
                        <th className="py-3 px-5 text-right">Agent Margin</th>
                        <th className="py-3 px-5 text-right">Total Profit</th>
                        <th className="py-3 px-5 text-center">Lock Status</th>
                        <th className="py-3 px-5 text-center">Payment Badge</th>
                        <th className="py-3 px-5 text-center">Actions</th>
                      </tr>
                    </thead>
                      <tbody className="divide-y divide-slate-50">
                        {agentsAnalytics.performanceList.map((agent, index) => (
                          <tr key={agent.name} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 font-extrabold text-slate-500">#{index + 1}</td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold ${agent.badgeColor}`}>
                                  {agent.name.substring(0, 2).toUpperCase()}
                                </span>
                                <span className="font-bold text-slate-900">{agent.name}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-600">{agent.bookings}</td>
                            <td className="py-2.5 px-3 text-right font-semibold text-slate-700">£{Math.round(agent.aov).toLocaleString()}</td>
                            <td className="py-2.5 px-3 text-right font-black text-slate-900">£{Math.round(agent.revenue).toLocaleString()}</td>
                            <td className="py-2.5 px-3 text-right">
                              <span className="inline-flex items-center gap-0.5 text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded font-bold text-[9px]">
                                +{12 - index * 1.5}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              </>
            )}

            {/* Bottom active operations ledger */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: 0.4 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Active Operations Ledger</h3>
                <button 
                  onClick={handleOpenCreateModal}
                  className="flex items-center gap-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-sm transition-all"
                >
                  <Plus className="h-3.5 w-3.5" /> Log Invoice
                </button>
              </div>
              
              <div className="space-y-3">
                {loading ? (
                  <div className="flex justify-center p-12 bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <Loader2 className="h-6 w-6 text-primary-600 animate-spin" />
                  </div>
                ) : bookings.length > 0 ? (
                  bookings.slice(0, 5).map((trip, idx) => (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }} 
                      animate={{ opacity: 1, x: 0 }} 
                      transition={{ delay: 0.1 + (idx * 0.05) }}
                      key={trip.id || idx} 
                      className="bg-white p-3.5 rounded-2xl border border-slate-100/80 shadow-sm flex items-center gap-4 hover:border-primary-200 hover:shadow-md transition-all cursor-pointer"
                      onClick={() => {
                        setSelectedBookingId(trip.id);
                        setIsDetailsModalOpen(true);
                      }}
                    >
                      <div className="h-11 w-11 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
                        <Calendar className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <h4 className="font-bold text-slate-900 truncate">Invoice {trip.bookingReference}</h4>
                          <span className="text-[8px] bg-indigo-50 text-indigo-600 font-bold px-1.5 py-0.5 rounded uppercase">
                            {idx % 4 === 0 ? 'Flights' : idx % 4 === 1 ? 'Hotels' : idx % 4 === 2 ? 'Packages' : 'Excursion'}
                          </span>
                          {trip.agentName && (
                            <span className="text-[8px] bg-slate-100 text-slate-500 font-medium px-1.5 py-0.5 rounded">
                              Agent: {trip.agentName}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-400 text-[10px] mt-0.5">Processed: {new Date(trip.date).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div className="text-xs">
                          <p className="font-black text-slate-800">£{Number(trip.totalPrice).toFixed(2)}</p>
                          <span className="text-[8px] text-emerald-500 font-bold uppercase tracking-wider block mt-0.5">
                            {trip.status}
                          </span>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBookingId(trip.id);
                            setIsDetailsModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 border border-slate-200 text-slate-600 hover:text-primary-600 hover:border-primary-200 hover:bg-primary-50 rounded-lg text-[10px] font-bold transition-all"
                        >
                          Inspect
                        </button>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm text-center">
                    <p className="text-slate-500 text-xs mb-3">No recent sales operations or bookings recorded.</p>
                    <button 
                      onClick={handleOpenCreateModal}
                      className="bg-primary-50 text-primary-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-primary-100 transition-colors"
                    >
                      Record first invoice
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}

        {/* TAB 2: MY BOOKINGS LIST */}
        {sidebarTab === 'bookings' && (
          <div className="space-y-5">
            {/* Header Block */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">My Bookings Workspace</h1>
                <p className="text-slate-500 text-xs mt-0.5">Manage package bookings, invoices, lock statuses and financial records.</p>
              </div>
              <div className="flex items-center gap-2">
                
                <button 
                  onClick={handleOpenCreateModal}
                  className="flex items-center gap-1.5 bg-primary-600 text-white hover:bg-primary-500 px-4.5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-primary-500/20 active:scale-95 transition-all"
                >
                  <Plus className="h-4 w-4" /> New Booking
                </button>
              </div>
            </div>

            {/* Main Layout for Filters and Table */}
            <div className="flex flex-col gap-5">
              
              {/* Modal-Driven Search & Filter Bar */}
              <div className="bg-white px-6 py-4 flex items-center justify-between gap-4 border-b border-slate-100 rounded-t-3xl shadow-sm">
                <div className="flex flex-wrap items-center gap-3 w-full">
                  <div className="flex items-center gap-2 text-slate-500 font-bold text-[10px] mr-2 uppercase tracking-wider">
                    <Filter className="w-3.5 h-3.5 text-primary-500" /> Filters:
                  </div>
                  <button onClick={() => setActiveSearchModal('ref')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${filters.bookingReference ? 'bg-primary-50 border-primary-200 text-primary-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'}`}>
                    <Hash className="w-3.5 h-3.5 inline mr-1.5" /> PNR / Ref: {filters.bookingReference || 'All'}
                  </button>
                  <button onClick={() => setActiveSearchModal('customer')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${filters.customerName || filters.customerPhone || filters.customerEmail ? 'bg-primary-50 border-primary-200 text-primary-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'}`}>
                    <User className="w-3.5 h-3.5 inline mr-1.5" /> Customer: {filters.customerName || filters.customerPhone || filters.customerEmail || 'All'}
                  </button>
                  <button onClick={() => setActiveSearchModal('agent')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${filters.agentName !== 'Any' ? 'bg-primary-50 border-primary-200 text-primary-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'}`}>
                    <Users className="w-3.5 h-3.5 inline mr-1.5" /> Agent: {filters.agentName}
                  </button>
                  <button onClick={() => setActiveSearchModal('departure')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${filters.departureDateStart || filters.departureDateEnd ? 'bg-primary-50 border-primary-200 text-primary-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'}`}>
                    <Calendar className="w-3.5 h-3.5 inline mr-1.5" /> Departure
                  </button>
                  <button onClick={() => setActiveSearchModal('created')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${filters.dateStart || filters.dateEnd ? 'bg-primary-50 border-primary-200 text-primary-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'}`}>
                    <Calendar className="w-3.5 h-3.5 inline mr-1.5" /> Created At
                  </button>
                  <button onClick={() => setActiveSearchModal('payment')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${filters.paymentStatus !== 'Any' ? 'bg-primary-50 border-primary-200 text-primary-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'}`}>
                    <CreditCard className="w-3.5 h-3.5 inline mr-1.5" /> Status: {filters.paymentStatus.replace('_', ' ').toUpperCase()}
                  </button>
                  
                  {Object.values(filters).some(v => v && v !== 'Any') && (
                    <button onClick={() => { performClearFilters(); }} className="ml-auto text-rose-500 hover:text-rose-600 text-[10px] uppercase tracking-wide font-black underline transition-colors">
                      Clear All
                    </button>
                  )}
                </div>
              </div>
              
              {/* Search Modals */}
              <BookingRefSearchModal isOpen={activeSearchModal === 'ref'} onClose={() => setActiveSearchModal(null)} currentValue={filters.bookingReference} onApply={(val: any) => { setFilters({...filters, bookingReference: val}); setActiveSearchModal(null); setTimeout(fetchBookings, 0); }} />
              <CustomerSearchModal isOpen={activeSearchModal === 'customer'} onClose={() => setActiveSearchModal(null)} currentValue={filters.customerName} onApply={(val: any) => { setFilters({...filters, customerName: val, customerPhone: val, customerEmail: val}); setActiveSearchModal(null); setTimeout(fetchBookings, 0); }} />
              <AgentSearchModal isOpen={activeSearchModal === 'agent'} onClose={() => setActiveSearchModal(null)} agents={dbAgents} currentValue={filters.agentName} onApply={(val: any) => { setFilters({...filters, agentName: val}); setActiveSearchModal(null); setTimeout(fetchBookings, 0); }} />
              <DateRangeSearchModal title="Departure Date Range" isOpen={activeSearchModal === 'departure'} onClose={() => setActiveSearchModal(null)} currentValue={{start: filters.departureDateStart, end: filters.departureDateEnd}} onApply={(val: any) => { setFilters({...filters, departureDateStart: val.start, departureDateEnd: val.end}); setActiveSearchModal(null); setTimeout(fetchBookings, 0); }} />
              <DateRangeSearchModal title="Creation Date Range" isOpen={activeSearchModal === 'created'} onClose={() => setActiveSearchModal(null)} currentValue={{start: filters.dateStart, end: filters.dateEnd}} onApply={(val: any) => { setFilters({...filters, dateStart: val.start, dateEnd: val.end}); setActiveSearchModal(null); setTimeout(fetchBookings, 0); }} />
              <PaymentStatusSearchModal isOpen={activeSearchModal === 'payment'} onClose={() => setActiveSearchModal(null)} currentValue={filters.paymentStatus} onApply={(val: any) => { setFilters({...filters, paymentStatus: val}); setActiveSearchModal(null); setTimeout(fetchBookings, 0); }} />
              
              {/* Main List Section */}
              <div className="flex-1 w-full min-w-0">
                {/* Bookings Table List */}
            {loading ? (
              <div className="flex justify-center p-12 bg-white rounded-3xl border border-slate-100">
                <Loader2 className="h-6 w-6 text-primary-500 animate-spin" />
              </div>
            ) : bookings.length === 0 ? (
              <div className="bg-white p-16 text-center border border-slate-100 rounded-3xl flex flex-col items-center justify-center min-h-[400px]">
                <div className="bg-slate-50 w-24 h-24 rounded-full flex items-center justify-center mb-6">
                  <Search className="w-10 h-10 text-slate-300" />
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-2">No records found</h3>
                <p className="text-slate-500 text-sm font-medium max-w-sm mb-6">We couldn't find any bookings matching your current search criteria. Please try adjusting your filters.</p>
                <button 
                  onClick={performClearFilters}
                  className="bg-primary-50 hover:bg-primary-100 text-primary-700 px-6 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                >
                  <X className="w-4 h-4" /> Clear All Filters
                </button>
              </div>
            ) : (
              <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden text-[11px]">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 text-slate-400 font-bold uppercase border-b border-slate-100">
                        <th className="py-3 px-5">Invoice Reference</th>
                        <th className="py-3 px-5">Departure Date</th>
                        <th className="py-3 px-5">Assigned Agent</th>
                        <th className="py-3 px-5 text-right">Invoice Price</th>
                        <th className="py-3 px-5 text-right">Remaining</th>
                        <th className="py-3 px-5 text-right">Total Sent</th>
                        <th className="py-3 px-5 text-right">Agent Margin</th>
                        <th className="py-3 px-5 text-right">Total Profit</th>
                        <th className="py-3 px-5 text-center">Lock Status</th>
                        <th className="py-3 px-5 text-center">Payment Badge</th>
                        <th className="py-3 px-5 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-slate-600 font-medium">
                      {bookings.map((b) => {
                        const bookingTotal = Number(b.totalPrice) || 0;
                        const clientPayments = b.payments?.filter((p: any) => p.paymentType === 'Received from Client').reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || 0;
                        const vendorPayments = b.payments?.filter((p: any) => p.paymentType === 'Sent to Vendor').reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || 0;
                        const totalDiscounts = b.discounts?.reduce((sum: number, d: any) => sum + (Number(d.amount) || 0), 0) || 0;
                        const refundsToClient = b.refunds?.filter((r: any) => r.direction === 'Refund to Client').reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0) || 0;
                        const refundsFromVendor = b.refunds?.filter((r: any) => r.direction === 'Refund from Vendor').reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0) || 0;

                        const totalReceived = clientPayments - refundsToClient;
                        const totalSent = vendorPayments - refundsFromVendor;
                        const remainingAmount = bookingTotal - totalReceived;
                        
                        const netProfit = (totalReceived - totalSent) + totalDiscounts;

                        const bookingAgent = dbAgents.find(a => a.name === b.agentName);
                        let marginPercentage = 0;
                        if (bookingAgent && (bookingAgent as any).marginSegments && (bookingAgent as any).marginSegments.length > 0) {
                          const match = (bookingAgent as any).marginSegments.find((s: any) => 
                            bookingTotal >= Number(s.minAmount) && (!s.maxAmount || bookingTotal <= Number(s.maxAmount))
                          );
                          if (match) marginPercentage = Number(match.marginPercent);
                        }
                        const agentMargin = (netProfit * marginPercentage) / 100;

                        return (
                        <tr 
                          key={b.id} 
                          className="hover:bg-slate-50/40 transition-colors cursor-pointer"
                          onClick={() => {
                            setSelectedBookingId(b.id);
                            setIsDetailsModalOpen(true);
                          }}
                        >
                          <td className="py-3.5 px-5 font-black text-slate-900">{b.bookingReference}</td>
                          <td className="py-3.5 px-5 font-mono text-slate-500">{b.departureDate ? new Date(b.departureDate).toLocaleDateString() : 'N/A'}</td>
                          <td className="py-3.5 px-5 font-bold text-slate-700">{b.agentName || 'System'}</td>
                          <td className="py-3.5 px-5 text-right font-black text-slate-900">£{Number(b.totalPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="py-3.5 px-5 text-right font-bold text-amber-500">£{remainingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="py-3.5 px-5 text-right font-bold text-rose-500">£{totalSent.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="py-3.5 px-5 text-right font-bold text-blue-500">£{agentMargin.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="py-3.5 px-5 text-right font-black text-emerald-600">£{netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="py-3.5 px-5 text-center" onClick={e => e.stopPropagation()}>
                            <button 
                              onClick={(e) => toggleLock(e, b.id, b.isLocked)}
                              disabled={userRole === 'AGENT'}
                              className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold transition-all ${
                                b.isLocked ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                              } ${userRole === 'AGENT' ? 'opacity-70 cursor-not-allowed' : ''}`}>
                              {b.isLocked ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                              {b.isLocked ? 'LOCKED' : 'UNLOCKED'}
                            </button>
                          </td>
                          <td className="py-3.5 px-5 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              b.paymentStatus === 'paid' 
                                ? 'bg-emerald-50 text-emerald-700' 
                                : b.paymentStatus === 'partially_paid' 
                                ? 'bg-amber-50 text-amber-700' 
                                : 'bg-rose-50 text-rose-700'
                            }`}>
                              {b.paymentStatus.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-center" onClick={e => e.stopPropagation()}>
                            <button 
                              onClick={() => {
                                setSelectedBookingId(b.id);
                                setIsDetailsModalOpen(true);
                              }}
                              className="bg-primary-50 text-primary-600 hover:bg-primary-100 font-bold px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
              </div>
            </div> {/* End of Main Flex Layout */}
          </div>
        )}

        {/* TAB 3: PAYMENTS TRANSACTIONS LIST */}
        {sidebarTab === 'payments' && (
          <FinancePage bookings={bookings} onRefresh={fetchBookings} />
        )}

        {/* TAB 4: COMPANY SETTINGS */}
        {sidebarTab === 'settings' && (
          <div className="space-y-6 max-w-3xl">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Company Profile & Workspace Settings</h1>
              <p className="text-slate-500 text-xs mt-0.5">Manage subscription details, logos, domains, and agency metadata.</p>
            </div>

            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6">
              
              {/* Header profile cards */}
              <div className="flex flex-col sm:flex-row items-center gap-5 border-b border-slate-50 pb-5">
                <img 
                  src={companyInfo.logo} 
                  alt="Company Logo" 
                  className="w-20 h-20 rounded-2xl object-cover shadow-md border border-slate-100" 
                />
                <div className="space-y-1 text-center sm:text-left">
                  <h3 className="text-lg font-black text-slate-900">{companyInfo.name}</h3>
                  <p className="text-xs text-slate-400 font-semibold">{companyInfo.plan}</p>
                  <span className="inline-block bg-primary-50 text-primary-600 font-black text-[9px] px-2 py-0.5 rounded-full mt-1.5 uppercase">
                    Active Tenant Workspace
                  </span>
                </div>
              </div>

              {/* Grid of properties */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4.5 text-xs">
                <div>
                  <label className="block text-slate-400 font-bold mb-1 uppercase text-[9px]">Domain name</label>
                  <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-100 font-semibold text-slate-700">
                    <Globe className="w-4 h-4 text-slate-400" />
                    <span>{companyInfo.domain}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1 uppercase text-[9px]">Industry Segment</label>
                  <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-100 font-semibold text-slate-700">
                    <Building className="w-4 h-4 text-slate-400" />
                    <span>{companyInfo.industry}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1 uppercase text-[9px]">Email Inbox</label>
                  <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-100 font-semibold text-slate-700">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span>{companyInfo.email}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1 uppercase text-[9px]">Phone Hot-line</label>
                  <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-100 font-semibold text-slate-700">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span>{companyInfo.phone}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1 uppercase text-[9px]">Location Address</label>
                  <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-100 font-semibold text-slate-700">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span>{companyInfo.location}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1 uppercase text-[9px]">Subscription Tier</label>
                  <div className="flex items-center gap-2 bg-emerald-50 px-3.5 py-2.5 rounded-xl border border-emerald-100 font-bold text-emerald-700">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Lifetime Access Subscription</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1 uppercase text-[9px]">Workspace Description</label>
                <p className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100/50 font-medium text-slate-600 text-xs leading-relaxed">
                  {companyInfo.description}
                </p>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* Slide-over / Modal Form for Create Booking */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-lg shadow-2xl w-full max-w-sm relative z-10 overflow-hidden flex flex-col"
            >
              {/* Dark Sleek Header */}
              <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
                <h3 className="text-[11px] font-bold tracking-wide uppercase">New Invoice / Booking</h3>
                <button 
                  type="button" 
                  onClick={() => setShowCreateModal(false)}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateBooking} className="p-4 space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Booking Ref / PNR</label>
                  <input 
                    type="text" 
                    required 
                    value={newRef}
                    onChange={e => setNewRef(e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-xl px-3 py-2 text-slate-800 text-[13px] uppercase font-bold outline-none transition-all"
                    placeholder="E.G. GX4HS6"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Booking Date</label>
                  <input 
                    type="date" 
                    required 
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-xl px-3 py-2 text-slate-800 text-[13px] font-medium outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Booking Agent</label>
                  <select 
                    value={newAgent}
                    onChange={e => setNewAgent(e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-xl px-3 py-2 text-slate-800 text-[13px] font-medium outline-none transition-all cursor-pointer"
                  >
                    <option value="System / Auto">System / Auto</option>
                    {dbAgents.map(agent => (
                      <option key={agent.id} value={agent.name}>{agent.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Total Price (£)</label>
                  <input 
                    type="number" 
                    required 
                    value={newPrice}
                    onChange={e => setNewPrice(e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-xl px-3 py-2 text-slate-800 text-[13px] font-bold outline-none transition-all"
                    placeholder="0.00"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4 mt-3 border-t border-slate-100">
                  <button 
                    type="button" 
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-[12px] font-bold text-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={createLoading}
                    className="bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white px-4 py-1.5 rounded text-[10px] font-bold active:scale-95 transition-all"
                  >
                    {createLoading ? 'Creating...' : 'Log Invoice'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Booking Details Workspace Modal */}
      <BookingDetailsModal 
        bookingId={selectedBookingId}
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        onUpdate={fetchBookings}
      />

      {/* Background Watermark Logo */}
      <div className="fixed bottom-6 right-8 pointer-events-none z-0 opacity-40 mix-blend-multiply">
        <TechbarredLogo />
      </div>

    </div>
  );
}
