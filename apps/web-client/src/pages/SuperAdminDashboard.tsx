import toast from 'react-hot-toast';
import React, { useEffect, useState } from 'react';
import { 
  Building2, Plus, Users, Shield, RefreshCw, CheckCircle, 
  AlertTriangle, Upload, Edit, Calendar, MapPin, Briefcase, 
  Mail, Phone, Clock, X, LogOut, Settings, Inbox, Server, Key,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../api/axios';
import { TechbarredLogo } from '../components/TechbarredLogo';

interface Tenant {
  id: number;
  name: string;
  domain: string | null;
  status: string;
  logo: string | null;
  description: string | null;
  industry: string | null;
  location: string | null;
  email: string | null;
  phone: string | null;
  subscriptionPlan: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  _count?: {
    users: number;
  };
  createdAt: string;
}

interface DemoRequest {
  id: number;
  fullName: string;
  email: string;
  companyName: string;
  phoneNumber: string | null;
  agencySize: string | null;
  gdsSystems: string | null;
  message: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface SmtpSettings {
  host: string;
  port: string;
  secure: boolean;
  user: string;
  pass: string;
}

export function SuperAdminDashboard() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();
  
  // Active Tab State
  const [activeTab, setActiveTab] = useState<'tenants' | 'demos' | 'settings'>('tenants');

  // Data State
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  // SMTP Settings State
  const [smtpSettings, setSmtpSettings] = useState<SmtpSettings>({
    host: '',
    port: '',
    secure: false,
    user: '',
    pass: ''
  });
  const [loadingSmtp, setLoadingSmtp] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);

  // Demo Requests State
  const [demoRequests, setDemoRequests] = useState<DemoRequest[]>([]);
  const [loadingDemos, setLoadingDemos] = useState(false);
  const [updatingDemoId, setUpdatingDemoId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedDemo, setSelectedDemo] = useState<DemoRequest | null>(null);
  
  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyDomain, setNewCompanyDomain] = useState('');
  const [newCompanyLogo, setNewCompanyLogo] = useState('');
  const [newCompanyDescription, setNewCompanyDescription] = useState('');
  const [newCompanyIndustry, setNewCompanyIndustry] = useState('');
  const [newCompanyLocation, setNewCompanyLocation] = useState('');
  const [newCompanyEmail, setNewCompanyEmail] = useState('');
  const [newCompanyPhone, setNewCompanyPhone] = useState('');
  const [newCompanyPlan, setNewCompanyPlan] = useState('trial');
  const [newCompanyTrialDays, setNewCompanyTrialDays] = useState(14);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [editName, setEditName] = useState('');
  const [editDomain, setEditDomain] = useState('');
  const [editLogo, setEditLogo] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIndustry, setEditIndustry] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPlan, setEditPlan] = useState('trial');
  const [editStatus, setEditStatus] = useState('active');
  const [editTrialEndsAt, setEditTrialEndsAt] = useState('');
  const [editError, setEditError] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'SUPER_ADMIN') {
      navigate('/super-admin/login');
      return;
    }

    if (activeTab === 'tenants') {
      fetchTenants();
    } else if (activeTab === 'demos') {
      fetchDemoRequests();
    } else if (activeTab === 'settings') {
      fetchSmtpSettings();
    }
  }, [isAuthenticated, user, navigate, activeTab]);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const response = await api.get('/auth/tenants');
      setTenants(response.data.tenants);
    } catch (error) {
      console.error('Failed to fetch tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSmtpSettings = async () => {
    setLoadingSmtp(true);
    try {
      const response = await api.get('/auth/system-settings/smtp');
      if (response.data?.settings) {
        setSmtpSettings(response.data.settings);
      }
    } catch (error) {
      console.error('Failed to fetch SMTP settings:', error);
      toast.error('Failed to load SMTP settings');
    } finally {
      setLoadingSmtp(false);
    }
  };

  const fetchDemoRequests = async () => {
    setLoadingDemos(true);
    try {
      const response = await api.get('/auth/demo-requests');
      if (response.data?.requests) {
        setDemoRequests(response.data.requests);
      }
    } catch (error) {
      console.error('Failed to fetch Demo Requests:', error);
      toast.error('Failed to load demo requests');
    } finally {
      setLoadingDemos(false);
    }
  };

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSmtp(true);
    try {
      await api.post('/auth/system-settings/smtp', {
        host: smtpSettings.host,
        port: parseInt(smtpSettings.port),
        secure: smtpSettings.secure,
        user: smtpSettings.user,
        pass: smtpSettings.pass
      });
      toast.success('SMTP Settings saved successfully');
    } catch (error: any) {
      console.error('Failed to save SMTP settings:', error);
      toast.error(error.response?.data?.error || 'Failed to save SMTP settings');
    } finally {
      setSavingSmtp(false);
    }
  };

  const handleUpdateDemoStatus = async (id: number, newStatus: string) => {
    setUpdatingDemoId(id);
    try {
      const response = await api.patch(`/auth/demo-requests/${id}`, { status: newStatus });
      setDemoRequests(demoRequests.map(req => req.id === id ? response.data.request : req));
      toast.success(`Demo status updated to ${newStatus}`);
    } catch (error) {
      console.error('Failed to update demo request status:', error);
      toast.error('Failed to update demo request');
    } finally {
      setUpdatingDemoId(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/super-admin/login');
  };

  // Handles uploading logo to the MinIO media endpoint
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/auth/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      if (isEdit) {
        setEditLogo(response.data.url);
      } else {
        setNewCompanyLogo(response.data.url);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to upload logo image');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');

    try {
      const response = await api.post('/auth/tenants', {
        name: newCompanyName,
        domain: newCompanyDomain || undefined,
        status: 'active',
        logo: newCompanyLogo || undefined,
        description: newCompanyDescription || undefined,
        industry: newCompanyIndustry || undefined,
        location: newCompanyLocation || undefined,
        email: newCompanyEmail || undefined,
        phone: newCompanyPhone || undefined,
        subscriptionPlan: newCompanyPlan,
        trialDurationDays: newCompanyPlan === 'trial' ? newCompanyTrialDays : undefined,
        adminEmail: newAdminEmail,
        adminPassword: newAdminPassword
      });
      
      setTenants([...tenants, response.data.tenant]);
      
      // Reset form fields
      setNewCompanyName('');
      setNewCompanyDomain('');
      setNewCompanyLogo('');
      setNewCompanyDescription('');
      setNewCompanyIndustry('');
      setNewCompanyLocation('');
      setNewCompanyEmail('');
      setNewCompanyPhone('');
      setNewCompanyPlan('trial');
      setNewCompanyTrialDays(14);
      setNewAdminEmail('');
      setNewAdminPassword('');
      setIsCreateModalOpen(false);
    } catch (err: any) {
      setSubmitError(err.response?.data?.error || 'Failed to create company');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setEditName(tenant.name);
    setEditDomain(tenant.domain || '');
    setEditLogo(tenant.logo || '');
    setEditDescription(tenant.description || '');
    setEditIndustry(tenant.industry || '');
    setEditLocation(tenant.location || '');
    setEditEmail(tenant.email || '');
    setEditPhone(tenant.phone || '');
    setEditPlan(tenant.subscriptionPlan);
    setEditStatus(tenant.status);
    
    // Format date string for HTML date input: YYYY-MM-DD
    if (tenant.trialEndsAt) {
      setEditTrialEndsAt(new Date(tenant.trialEndsAt).toISOString().split('T')[0]);
    } else {
      setEditTrialEndsAt('');
    }
    
    setEditError('');
    setIsEditModalOpen(true);
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;
    setIsUpdating(true);
    setEditError('');

    try {
      const response = await api.put(`/auth/tenants/${editingTenant.id}`, {
        name: editName,
        domain: editDomain || null,
        status: editStatus,
        logo: editLogo || null,
        description: editDescription || null,
        industry: editIndustry || null,
        location: editLocation || null,
        email: editEmail || null,
        phone: editPhone || null,
        subscriptionPlan: editPlan,
        subscriptionStatus: editPlan === 'trial' ? 'trial' : 'active',
        trialEndsAt: editPlan === 'trial' && editTrialEndsAt ? new Date(editTrialEndsAt).toISOString() : null
      });

      // Update local state list
      setTenants(tenants.map(t => t.id === editingTenant.id ? response.data.tenant : t));
      setIsEditModalOpen(false);
      setEditingTenant(null);
    } catch (err: any) {
      setEditError(err.response?.data?.error || 'Failed to update company');
    } finally {
      setIsUpdating(false);
    }
  };

  if (!user || user.role !== 'SUPER_ADMIN') return null;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex-shrink-0 hidden md:flex flex-col justify-between">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <Shield className="h-6 w-6 text-primary-600" />
            <div>
              <h2 className="font-bold text-slate-900">SaaS Admin</h2>
              <p className="text-xs text-primary-600 font-semibold uppercase tracking-wider">Global Access</p>
            </div>
          </div>
          
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('tenants')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left font-medium transition-colors ${
                activeTab === 'tenants' ? 'bg-primary-50 text-primary-600' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Building2 className="h-5 w-5" />
              Companies (Tenants)
            </button>
            <button
              onClick={() => setActiveTab('demos')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left font-medium transition-colors ${
                activeTab === 'demos' ? 'bg-primary-50 text-primary-600' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Inbox className="h-5 w-5" />
              Demo Requests
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left font-medium transition-colors ${
                activeTab === 'settings' ? 'bg-primary-50 text-primary-600' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Settings className="h-5 w-5" />
              SMTP Settings
            </button>
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

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                {activeTab === 'tenants' && 'SaaS Command Center'}
                {activeTab === 'demos' && 'Demo Requests'}
                {activeTab === 'settings' && 'SMTP Configuration'}
              </h1>
              <p className="text-slate-500 mt-1">
                {activeTab === 'tenants' && 'Manage global enterprise tenants, database workspaces, and subscription access.'}
                {activeTab === 'demos' && 'Manage incoming B2B demo leads, view company profile details, and track follow-ups.'}
                {activeTab === 'settings' && 'Manage platform SMTP settings for verification, notifications, and customer emails.'}
              </p>
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  if (activeTab === 'tenants') fetchTenants();
                  else if (activeTab === 'demos') fetchDemoRequests();
                  else if (activeTab === 'settings') fetchSmtpSettings();
                }}
                className="p-2 border border-slate-200 bg-white rounded-xl hover:bg-slate-100 transition-colors"
                title="Refresh Data"
              >
                <RefreshCw className={`h-5 w-5 text-slate-600 ${(loading || loadingDemos || loadingSmtp) ? 'animate-spin' : ''}`} />
              </button>
              {activeTab === 'tenants' && (
                <button 
                  onClick={() => setIsCreateModalOpen(true)}
                  className="bg-primary-600 text-white px-5 py-2.5 rounded-xl hover:bg-primary-500 font-medium shadow-md shadow-primary-500/20 transition-all hover:-translate-y-0.5 flex items-center gap-2"
                >
                  <Plus className="h-5 w-5" />
                  Add Company
                </button>
              )}
            </div>
          </div>

          {/* Stats Bar */}
          {activeTab === 'tenants' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-primary-50 text-primary-600 rounded-xl">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Total Companies</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{tenants.length}</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Active Staff Users</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {tenants.reduce((acc, curr) => acc + (curr._count?.users || 0), 0)}
                  </p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">System Health</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">100% Operational</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'demos' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-primary-50 text-primary-600 rounded-xl">
                  <Inbox className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Total Demo Requests</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{demoRequests.length}</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Pending Response</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {demoRequests.filter(r => r.status === 'pending').length}
                  </p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Contacted Leads</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">
                    {demoRequests.filter(r => r.status === 'contacted').length}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-primary-50 text-primary-600 rounded-xl">
                  <Server className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">SMTP Host</p>
                  <p className="text-lg font-bold text-slate-900 mt-1 truncate max-w-[200px]" title={smtpSettings.host}>
                    {smtpSettings.host || 'smtp.gmail.com'}
                  </p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Mail className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Sender Account</p>
                  <p className="text-lg font-bold text-slate-900 mt-1 truncate max-w-[200px]" title={smtpSettings.user}>
                    {smtpSettings.user || 'muhammadfaisalchughtai@gmail.com'}
                  </p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Activity className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Mail Client Status</p>
                  <p className="text-lg font-bold text-emerald-600 mt-1">Configured</p>
                </div>
              </div>
            </div>
          )}

          {/* Active Tab Panel */}
          {activeTab === 'tenants' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-slate-900">Registered Companies</h3>
              </div>
              
              {loading && tenants.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary-600 mb-2" />
                  Loading SaaS metrics...
                </div>
              ) : tenants.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <Building2 className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                  <p className="font-medium text-lg text-slate-700">No companies registered yet</p>
                  <p className="text-sm mt-1">Click the button in the top right to register your first enterprise client.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-400 bg-slate-50/20">
                        <th className="px-6 py-4">Company Info</th>
                        <th className="px-6 py-4">Industry / Location</th>
                        <th className="px-6 py-4">Contact Info</th>
                        <th className="px-6 py-4">Subscription Plan</th>
                        <th className="px-6 py-4">Trial Expiry / Status</th>
                        <th className="px-6 py-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
                      {tenants.map(tenant => {
                        const isTrial = tenant.subscriptionPlan === 'trial';
                        const isExpired = isTrial && tenant.trialEndsAt && new Date() > new Date(tenant.trialEndsAt);
                        const isSuspended = tenant.status === 'suspended';

                        return (
                          <tr key={tenant.id} className="hover:bg-slate-50/30 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                {tenant.logo ? (
                                  <img 
                                    src={tenant.logo} 
                                    alt={`${tenant.name} Logo`} 
                                    className="w-10 h-10 rounded-xl object-contain border border-slate-100 bg-slate-50 p-1"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                                    <Building2 className="w-5 h-5" />
                                  </div>
                                )}
                                <div>
                                  <span className="font-semibold text-slate-900 block">{tenant.name}</span>
                                  <span className="text-xs font-mono text-slate-400">{tenant.domain}.travelbooker.com</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="space-y-1">
                                <span className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                                  <Briefcase className="w-3.5 h-3.5 text-slate-400" /> {tenant.industry || 'Unspecified'}
                                </span>
                                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                                  <MapPin className="w-3.5 h-3.5 text-slate-400" /> {tenant.location || 'Unspecified'}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="space-y-1">
                                {tenant.email && (
                                  <span className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                                    <Mail className="w-3.5 h-3.5 text-slate-400" /> {tenant.email}
                                  </span>
                                )}
                                {tenant.phone && (
                                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <Phone className="w-3.5 h-3.5 text-slate-400" /> {tenant.phone}
                                  </span>
                                )}
                                {!tenant.email && !tenant.phone && <span className="text-slate-400 text-xs">No contact added</span>}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
                                tenant.subscriptionPlan === 'lifetime' 
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm'
                                  : tenant.subscriptionPlan === 'active'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                    : 'bg-amber-50 text-amber-700 border border-amber-100'
                              }`}>
                                {tenant.subscriptionPlan}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              {isTrial ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <Clock className={`w-4 h-4 ${isExpired ? 'text-red-500' : 'text-slate-400'}`} />
                                    <span className={`text-xs font-semibold ${isExpired ? 'text-red-600' : 'text-slate-700'}`}>
                                      {isExpired ? 'Trial Expired' : 'Active Trial'}
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-slate-400 block font-mono">
                                    {tenant.trialEndsAt ? new Date(tenant.trialEndsAt).toLocaleDateString() : 'N/A'}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  {isSuspended ? (
                                    <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-100">
                                      Suspended
                                    </span>
                                  ) : (
                                    <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                      Active
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={() => openEditModal(tenant)}
                                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors border border-slate-200 shadow-sm inline-flex items-center gap-1"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                Manage
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'demos' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-slate-50/50">
                <h3 className="font-bold text-slate-900">Demo Request Submissions</h3>
                <div className="flex gap-2">
                  {['all', 'pending', 'contacted'].map((statusOption) => (
                    <button
                      key={statusOption}
                      onClick={() => setFilterStatus(statusOption)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase border transition-all ${
                        filterStatus === statusOption
                          ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {statusOption}
                    </button>
                  ))}
                </div>
              </div>

              {loadingDemos && demoRequests.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary-600 mb-2" />
                  Loading demo requests...
                </div>
              ) : demoRequests.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <Inbox className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                  <p className="font-medium text-lg text-slate-700">No demo requests found</p>
                  <p className="text-sm mt-1">Incoming demo requests from the public landing page will appear here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-400 bg-slate-50/20">
                        <th className="px-6 py-4">Contact Info</th>
                        <th className="px-6 py-4">Company Details</th>
                        <th className="px-6 py-4">GDS Systems</th>
                        <th className="px-6 py-4">Request Message</th>
                        <th className="px-6 py-4">Submitted At</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
                      {demoRequests
                        .filter(req => filterStatus === 'all' ? true : req.status === filterStatus)
                        .map(req => {
                          const isPending = req.status === 'pending';

                          return (
                            <tr key={req.id} className="hover:bg-slate-50/30 transition-colors">
                              <td className="px-6 py-4">
                                <div className="space-y-0.5">
                                  <span className="font-semibold text-slate-900 block">{req.fullName}</span>
                                  <span className="text-xs text-slate-400 font-mono block">{req.email}</span>
                                  {req.phoneNumber && (
                                    <span className="text-xs text-slate-500 block">{req.phoneNumber}</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="space-y-0.5">
                                  <span className="font-semibold text-slate-900 block">{req.companyName}</span>
                                  {req.agencySize && (
                                    <span className="text-xs text-slate-500 block">Size: {req.agencySize}</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg">
                                  {req.gdsSystems || 'None / Unknown'}
                                </span>
                              </td>
                              <td className="px-6 py-4 max-w-[200px]">
                                <p className="text-xs text-slate-500 truncate" title={req.message || ''}>
                                  {req.message || <span className="italic text-slate-400">No message</span>}
                                </p>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-xs text-slate-500 font-mono">
                                  {new Date(req.createdAt).toLocaleDateString()} {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
                                  req.status === 'contacted'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                    : 'bg-amber-50 text-amber-700 border border-amber-100'
                                }`}>
                                  {req.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => setSelectedDemo(req)}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors border border-slate-200 shadow-sm"
                                  >
                                    View
                                  </button>
                                  {isPending ? (
                                    <button
                                      onClick={() => handleUpdateDemoStatus(req.id, 'contacted')}
                                      disabled={updatingDemoId === req.id}
                                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors border border-emerald-700 shadow-sm disabled:opacity-50"
                                    >
                                      Mark Contacted
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleUpdateDemoStatus(req.id, 'pending')}
                                      disabled={updatingDemoId === req.id}
                                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition-colors border border-amber-700 shadow-sm disabled:opacity-50"
                                    >
                                      Mark Pending
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 max-w-3xl">
              <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                <div className="p-2.5 bg-primary-50 text-primary-600 rounded-xl">
                  <Server className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">SMTP Server Settings</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Configure platform-wide SMTP settings for outgoing emails and demo confirmations.</p>
                </div>
              </div>

              {loadingSmtp ? (
                <div className="p-12 text-center text-slate-500">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary-600 mb-2" />
                  Loading configuration...
                </div>
              ) : (
                <form onSubmit={handleSaveSmtp} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">SMTP Host *</label>
                      <input 
                        type="text" 
                        required 
                        value={smtpSettings.host}
                        onChange={e => setSmtpSettings({ ...smtpSettings, host: e.target.value })}
                        placeholder="smtp.gmail.com" 
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm transition-all font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">SMTP Port *</label>
                      <input 
                        type="text" 
                        required 
                        value={smtpSettings.port}
                        onChange={e => setSmtpSettings({ ...smtpSettings, port: e.target.value })}
                        placeholder="587" 
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm transition-all font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">SMTP User (Sender Email) *</label>
                      <input 
                        type="email" 
                        required 
                        value={smtpSettings.user}
                        onChange={e => setSmtpSettings({ ...smtpSettings, user: e.target.value })}
                        placeholder="example@gmail.com" 
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm transition-all font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">SMTP Password / App Secret *</label>
                      <div className="relative">
                        <Key className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                        <input 
                          type="password" 
                          required 
                          value={smtpSettings.pass}
                          onChange={e => setSmtpSettings({ ...smtpSettings, pass: e.target.value })}
                          placeholder="••••••••••••" 
                          className="w-full pl-9 pr-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 py-1">
                    <input 
                      type="checkbox" 
                      id="secure"
                      checked={smtpSettings.secure}
                      onChange={e => setSmtpSettings({ ...smtpSettings, secure: e.target.checked })}
                      className="w-4 h-4 rounded text-primary-600 border-slate-300 focus:ring-primary-500"
                    />
                    <label htmlFor="secure" className="text-sm font-semibold text-slate-700 cursor-pointer select-none">
                      Enable SSL / Secure Connection (Secure on port 465, STARTTLS on port 587)
                    </label>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <button 
                      type="submit" 
                      disabled={savingSmtp}
                      className="bg-primary-600 text-white px-5 py-2.5 rounded-xl hover:bg-primary-500 text-sm font-semibold shadow-md shadow-primary-500/20 disabled:opacity-75 transition-all flex items-center gap-2"
                    >
                      {savingSmtp ? 'Saving Settings...' : 'Save Configuration'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Add Company Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-lg p-7 relative z-10 overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between mb-4 border-b border-slate-100 pb-4 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary-50 text-primary-600 rounded-xl">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Add New Company</h3>
                    <p className="text-slate-500 text-xs mt-0.5">Register a brand new enterprise tenant in the SaaS system.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {submitError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4 flex items-center gap-2 flex-shrink-0">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Modal Body (Scrollable) */}
              <form onSubmit={handleCreateCompany} className="space-y-5 overflow-y-auto pr-1 flex-1">
                {/* Logo Upload Box */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Company Logo</label>
                  <div className="flex items-center gap-4">
                    {newCompanyLogo ? (
                      <div className="relative group">
                        <img 
                          src={newCompanyLogo} 
                          alt="Uploaded Logo" 
                          className="w-16 h-16 rounded-2xl object-contain border border-slate-200 bg-slate-50 p-1.5"
                        />
                        <button 
                          type="button"
                          onClick={() => setNewCompanyLogo('')}
                          className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 shadow-md transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="w-16 h-16 rounded-2xl border-2 border-dashed border-slate-300 hover:border-primary-500 flex flex-col items-center justify-center cursor-pointer bg-slate-50 hover:bg-primary-50/20 transition-all">
                        {logoUploading ? (
                          <RefreshCw className="w-5 h-5 animate-spin text-primary-500" />
                        ) : (
                          <>
                            <Upload className="w-5 h-5 text-slate-400" />
                            <span className="text-[10px] text-slate-400 mt-1 font-semibold">Upload</span>
                          </>
                        )}
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => handleLogoUpload(e, false)} 
                          disabled={logoUploading}
                        />
                      </label>
                    )}
                    <div className="text-xs text-slate-400">
                      Upload PNG or JPG company logo. Media is hosted on the local MinIO storage.
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Company Name *</label>
                    <input 
                      type="text" 
                      required 
                      value={newCompanyName}
                      onChange={e => setNewCompanyName(e.target.value)}
                      placeholder="Acme Corp" 
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Workspace Domain Name *</label>
                    <div className="relative flex items-center">
                      <input 
                        type="text" 
                        required
                        value={newCompanyDomain}
                        onChange={e => setNewCompanyDomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        placeholder="acme" 
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm transition-all font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Industry</label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        value={newCompanyIndustry}
                        onChange={e => setNewCompanyIndustry(e.target.value)}
                        placeholder="e.g. Technology" 
                        className="w-full pl-9 pr-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Location</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        value={newCompanyLocation}
                        onChange={e => setNewCompanyLocation(e.target.value)}
                        placeholder="e.g. San Francisco, CA" 
                        className="w-full pl-9 pr-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contact Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <input 
                        type="email" 
                        value={newCompanyEmail}
                        onChange={e => setNewCompanyEmail(e.target.value)}
                        placeholder="admin@acme.com" 
                        className="w-full pl-9 pr-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm transition-all font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contact Phone</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <input 
                        type="tel" 
                        value={newCompanyPhone}
                        onChange={e => setNewCompanyPhone(e.target.value)}
                        placeholder="+1 (555) 019-2834" 
                        className="w-full pl-9 pr-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Company Description</label>
                  <textarea 
                    rows={2}
                    value={newCompanyDescription}
                    onChange={e => setNewCompanyDescription(e.target.value)}
                    placeholder="Short description of the company profile..." 
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm transition-all"
                  />
                </div>

                {/* Initial Admin Credentials */}
                <div className="bg-primary-50/40 p-4 rounded-2xl border border-primary-100/50 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary-700">Initial Company Administrator</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Email *</label>
                      <input 
                        type="email" 
                        required 
                        value={newAdminEmail}
                        onChange={e => setNewAdminEmail(e.target.value)}
                        placeholder="admin@domain.com"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs transition-all font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Password *</label>
                      <input 
                        type="password" 
                        required 
                        value={newAdminPassword}
                        onChange={e => setNewAdminPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs transition-all"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400">These credentials allow the company admin to sign in first. They can later reset this password.</p>
                </div>

                {/* Subscription Options */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Subscription Configuration</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Select Access Plan</label>
                      <select 
                        value={newCompanyPlan}
                        onChange={e => setNewCompanyPlan(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs"
                      >
                        <option value="trial">Free Trial Access</option>
                        <option value="active">Standard Active Access</option>
                        <option value="lifetime">Lifetime Unlimited Access</option>
                      </select>
                    </div>

                    {newCompanyPlan === 'trial' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Trial Period (Days)</label>
                        <input 
                          type="number" 
                          min={0}
                          value={newCompanyTrialDays}
                          onChange={e => setNewCompanyTrialDays(parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 flex-shrink-0">
                  <button 
                    type="button" 
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 text-sm font-medium text-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting || logoUploading}
                    className="bg-primary-600 text-white px-5 py-2.5 rounded-xl hover:bg-primary-500 text-sm font-semibold shadow-md shadow-primary-500/20 disabled:opacity-75 disabled:hover:translate-y-0 transition-all flex items-center gap-2"
                  >
                    {isSubmitting ? 'Registering...' : 'Register Company'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit / Manage Company Modal */}
      <AnimatePresence>
        {isEditModalOpen && editingTenant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsEditModalOpen(false);
                setEditingTenant(null);
              }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-lg p-7 relative z-10 overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between mb-4 border-b border-slate-100 pb-4 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-100 text-slate-700 rounded-xl border border-slate-200">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Manage: {editingTenant.name}</h3>
                    <p className="text-slate-500 text-xs mt-0.5">Manage details, plans, and subscription settings for this workspace.</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingTenant(null);
                  }}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {editError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4 flex items-center gap-2 flex-shrink-0">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Modal Body */}
              <form onSubmit={handleUpdateCompany} className="space-y-5 overflow-y-auto pr-1 flex-1">
                {/* Logo Upload */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Company Logo</label>
                  <div className="flex items-center gap-4">
                    {editLogo ? (
                      <div className="relative group">
                        <img 
                          src={editLogo} 
                          alt="Uploaded Logo" 
                          className="w-16 h-16 rounded-2xl object-contain border border-slate-200 bg-slate-50 p-1.5"
                        />
                        <button 
                          type="button"
                          onClick={() => setEditLogo('')}
                          className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 shadow-md transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="w-16 h-16 rounded-2xl border-2 border-dashed border-slate-300 hover:border-primary-500 flex flex-col items-center justify-center cursor-pointer bg-slate-50 hover:bg-primary-50/20 transition-all">
                        {logoUploading ? (
                          <RefreshCw className="w-5 h-5 animate-spin text-primary-500" />
                        ) : (
                          <>
                            <Upload className="w-5 h-5 text-slate-400" />
                            <span className="text-[10px] text-slate-400 mt-1 font-semibold">Upload</span>
                          </>
                        )}
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => handleLogoUpload(e, true)} 
                          disabled={logoUploading}
                        />
                      </label>
                    )}
                    <div className="text-xs text-slate-400">
                      Change PNG or JPG logo.
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Company Name *</label>
                    <input 
                      type="text" 
                      required 
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Workspace Domain *</label>
                    <input 
                      type="text" 
                      required
                      value={editDomain}
                      onChange={e => setEditDomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Industry</label>
                    <input 
                      type="text" 
                      value={editIndustry}
                      onChange={e => setEditIndustry(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Location</label>
                    <input 
                      type="text" 
                      value={editLocation}
                      onChange={e => setEditLocation(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contact Email</label>
                    <input 
                      type="email" 
                      value={editEmail}
                      onChange={e => setEditEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm transition-all font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contact Phone</label>
                    <input 
                      type="tel" 
                      value={editPhone}
                      onChange={e => setEditPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Company Description</label>
                  <textarea 
                    rows={2}
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm transition-all"
                  />
                </div>

                {/* Edit Subscriptions */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Subscription Status & Plan</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Access Plan</label>
                      <select 
                        value={editPlan}
                        onChange={e => setEditPlan(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs"
                      >
                        <option value="trial">Free Trial Access</option>
                        <option value="active">Standard Active Access</option>
                        <option value="lifetime">Lifetime Unlimited Access</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Account Workspace Status</label>
                      <select 
                        value={editStatus}
                        onChange={e => setEditStatus(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs"
                      >
                        <option value="active">Active (Access Allowed)</option>
                        <option value="suspended">Suspended (Access Blocked)</option>
                      </select>
                    </div>
                  </div>

                  {editPlan === 'trial' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Trial Expiration Date</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input 
                          type="date" 
                          value={editTrialEndsAt}
                          onChange={e => setEditTrialEndsAt(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Edit Actions */}
                <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 flex-shrink-0">
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsEditModalOpen(false);
                      setEditingTenant(null);
                    }}
                    className="px-4 py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 text-sm font-medium text-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isUpdating || logoUploading}
                    className="bg-primary-600 text-white px-5 py-2.5 rounded-xl hover:bg-primary-500 text-sm font-semibold shadow-md shadow-primary-500/20 disabled:opacity-75 disabled:hover:translate-y-0 transition-all flex items-center gap-2"
                  >
                    {isUpdating ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Demo Request Modal */}
      <AnimatePresence>
        {selectedDemo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDemo(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-lg p-7 relative z-10 overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between mb-4 border-b border-slate-100 pb-4 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary-50 text-primary-600 rounded-xl">
                    <Inbox className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Demo Request Details</h3>
                    <p className="text-slate-500 text-xs mt-0.5">Review lead details and update contact status.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedDemo(null)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="space-y-4 overflow-y-auto pr-1 flex-1 text-sm text-slate-600">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Full Name</span>
                    <span className="text-slate-900 font-medium block mt-0.5">{selectedDemo.fullName}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Email Address</span>
                    <span className="text-slate-950 font-medium block mt-0.5 font-mono">{selectedDemo.email}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Company Name</span>
                    <span className="text-slate-900 font-medium block mt-0.5">{selectedDemo.companyName}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Phone Number</span>
                    <span className="text-slate-900 font-medium block mt-0.5">{selectedDemo.phoneNumber || 'N/A'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Agency Size</span>
                    <span className="text-slate-900 font-medium block mt-0.5">{selectedDemo.agencySize || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">GDS Systems</span>
                    <span className="inline-block mt-0.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg">
                      {selectedDemo.gdsSystems || 'None / Unknown'}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Submission Date</span>
                  <span className="text-slate-900 font-medium block mt-0.5">
                    {new Date(selectedDemo.createdAt).toLocaleDateString()} {new Date(selectedDemo.createdAt).toLocaleTimeString()}
                  </span>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Message</span>
                  <p className="text-slate-700 whitespace-pre-wrap text-xs leading-relaxed">
                    {selectedDemo.message || <span className="italic text-slate-400">No message provided.</span>}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Current Status:</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${
                    selectedDemo.status === 'contacted'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      : 'bg-amber-50 text-amber-700 border border-amber-100'
                  }`}>
                    {selectedDemo.status}
                  </span>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 flex-shrink-0">
                <button 
                  type="button" 
                  onClick={() => setSelectedDemo(null)}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 text-sm font-medium text-slate-600 transition-colors"
                >
                  Close
                </button>
                {selectedDemo.status === 'pending' ? (
                  <button 
                    type="button" 
                    disabled={updatingDemoId === selectedDemo.id}
                    onClick={async () => {
                      await handleUpdateDemoStatus(selectedDemo.id, 'contacted');
                      // Update the status locally in the modal
                      setSelectedDemo(prev => prev ? { ...prev, status: 'contacted' } : null);
                    }}
                    className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-500 text-sm font-semibold shadow-md shadow-emerald-500/20 disabled:opacity-75 transition-all flex items-center gap-2"
                  >
                    {updatingDemoId === selectedDemo.id ? 'Updating...' : 'Mark as Contacted'}
                  </button>
                ) : (
                  <button 
                    type="button" 
                    disabled={updatingDemoId === selectedDemo.id}
                    onClick={async () => {
                      await handleUpdateDemoStatus(selectedDemo.id, 'pending');
                      // Update the status locally in the modal
                      setSelectedDemo(prev => prev ? { ...prev, status: 'pending' } : null);
                    }}
                    className="bg-amber-600 text-white px-5 py-2.5 rounded-xl hover:bg-amber-500 text-sm font-semibold shadow-md shadow-amber-500/20 disabled:opacity-75 transition-all flex items-center gap-2"
                  >
                    {updatingDemoId === selectedDemo.id ? 'Updating...' : 'Mark as Pending'}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Background Watermark Logo */}
      <div className="fixed bottom-6 right-8 pointer-events-none z-0 opacity-40 mix-blend-multiply">
        <TechbarredLogo />
      </div>
    </div>
  );
}
