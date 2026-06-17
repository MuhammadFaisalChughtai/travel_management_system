import toast from 'react-hot-toast';
import React, { useEffect, useState } from 'react';
import { 
  Building2, Plus, Users, Shield, RefreshCw, CheckCircle, 
  AlertTriangle, Upload, Edit, Calendar, MapPin, Briefcase, 
  Mail, Phone, Clock, X, LogOut, Settings, Inbox, Server, Key,
  Activity, Layout, Trash2, ArrowUp, ArrowDown, Save,
  Loader2, FileText, Globe
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

interface VisualSection {
  id: string;
  type: 'passengers' | 'flights' | 'hotels' | 'transports' | 'visas' | 'specialties' | 'services' | 'payments' | 'balances' | 'custom_text';
  title: string;
  body?: string;
}

interface VisualConfig {
  themeColor: string;
  fontFamily: string;
  title: string;
  showLogoPrimary: boolean;
  showLogoSecondary: boolean;
  showAddress: boolean;
  showPhone: boolean;
  showEmail: boolean;
  showWhatsapp: boolean;
  sections: VisualSection[];
  showSignature: boolean;
  showTimestamp: boolean;
}

const defaultVisualConfig = (type: string): VisualConfig => ({
  themeColor: 'indigo',
  fontFamily: 'Inter',
  title: type === 'INVOICE' ? 'Invoice / Receipt' : 'Service Voucher',
  showLogoPrimary: true,
  showLogoSecondary: false,
  showAddress: true,
  showPhone: true,
  showEmail: true,
  showWhatsapp: true,
  sections: type === 'INVOICE'
    ? [
        { id: 'sec-1', type: 'passengers', title: 'Passenger Manifest' },
        { id: 'sec-2', type: 'flights', title: 'Flight Itinerary Details' },
        { id: 'sec-3', type: 'hotels', title: 'Hotel Booking Details' },
        { id: 'sec-4', type: 'transports', title: 'Ground Transport Details' },
        { id: 'sec-5', type: 'services', title: 'Itemized Price Breakdown' },
        { id: 'sec-6', type: 'payments', title: 'Payments Receipt Log' },
        { id: 'sec-7', type: 'balances', title: 'Financial Balance Summary' },
        { id: 'sec-8', type: 'custom_text', title: 'Terms & Conditions', body: 'All balances must be settled prior to departure. Tickets and dynamic packages are non-refundable/non-transferable once validated and issued.' }
      ]
    : [
        { id: 'sec-1', type: 'passengers', title: 'Traveler Manifest' },
        { id: 'sec-2', type: 'flights', title: 'Flight Itinerary Legs' },
        { id: 'sec-3', type: 'hotels', title: 'Hotel Stay Details' },
        { id: 'sec-4', type: 'transports', title: 'Ground Transport & Shuttle Pickups' },
        { id: 'sec-5', type: 'visas', title: 'Visa & Borders Approvals' },
        { id: 'sec-6', type: 'specialties', title: 'Specialty Services Checklist' },
        { id: 'sec-7', type: 'custom_text', title: 'Operational Instructions', body: 'Present this operational voucher at the check-in terminal or gate along with traveler passports. For assistance, contact the support channels listed below.' }
      ],
  showSignature: true,
  showTimestamp: true
});

function generateTemplateFromVisualConfig(config: VisualConfig, _type: string) {
  const themes: Record<string, { primary: string; secondary: string; text: string; bg: string }> = {
    indigo: { primary: '#4f46e5', secondary: '#818cf8', text: '#312e81', bg: '#f5f3ff' },
    blue: { primary: '#2563eb', secondary: '#60a5fa', text: '#1e3a8a', bg: '#eff6ff' },
    emerald: { primary: '#059669', secondary: '#34d399', text: '#064e3b', bg: '#ecfdf5' },
    slate: { primary: '#475569', secondary: '#94a3b8', text: '#0f172a', bg: '#f8fafc' },
    amber: { primary: '#d97706', secondary: '#fbbf24', text: '#78350f', bg: '#fffbeb' }
  };

  const selectedTheme = themes[config.themeColor] || themes.indigo;
  const primaryColor = selectedTheme.primary;
  const fontStack = config.fontFamily === 'Outfit' 
    ? "'Outfit', system-ui, sans-serif" 
    : config.fontFamily === 'Roboto'
    ? "'Roboto', system-ui, sans-serif"
    : "'Inter', system-ui, sans-serif";

  // Build HTML
  let html = `<div class="doc-container" style="font-family: ${fontStack}; max-width: 800px; margin: auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 16px; background: #fff; color: #334155; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);">`;

  // Header: Branding & Metadata
  html += `
  <!-- Header: Branding & Metadata -->
  <div style="display: flex; justify-content: space-between; align-items: start; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 24px;">
    <div>
      <div style="margin-bottom: 12px; display: flex; gap: 10px; align-items: center;">`;
  
  if (config.showLogoPrimary) {
    html += `\n        <div>{{company.logoPrimary}}</div>`;
  }
  if (config.showLogoSecondary) {
    html += `\n        <div>{{company.logoSecondary}}</div>`;
  }
  
  html += `\n      </div>
      <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #0f172a;">{{company.name}}</h2>`;

  if (config.showAddress) {
    html += `\n      <p style="margin: 4px 0 0; font-size: 11px; color: #64748b;">{{company.address}}</p>`;
  }

  if (config.showEmail || config.showPhone) {
    const contactParts = [];
    if (config.showEmail) contactParts.push(`Email: {{company.email}}`);
    if (config.showPhone) contactParts.push(`Tel: {{company.phone}}`);
    html += `\n      <p style="margin: 2px 0 0; font-size: 11px; color: #64748b;">${contactParts.join(' | ')}</p>`;
  }

  html += `
    </div>
    <div style="text-align: right;">
      <h1 style="margin: 0 0 10px; font-size: 26px; font-weight: 900; color: ${primaryColor}; letter-spacing: -0.5px; text-transform: uppercase;">${config.title}</h1>
      <p style="margin: 2px 0; font-size: 12px; font-weight: bold; color: #475569;">Booking Ref: <span style="font-family: monospace; font-size: 13px; color: ${primaryColor}; font-weight: 800;">{{booking.reference}}</span></p>
      <p style="margin: 2px 0; font-size: 11px; color: #64748b;">Issue Date: {{booking.date}}</p>
      <p style="margin: 2px 0; font-size: 11px; color: #64748b;">Assigned Agent: {{booking.agent}}</p>
    </div>
  </div>`;

  // Render Dynamic Sections in order
  const sections = config.sections || [];
  sections.forEach(sec => {
    if (sec.type === 'passengers') {
      html += `
  <!-- Passengers Section -->
  <div style="margin-bottom: 24px;">
    <h3 style="margin: 0 0 8px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${primaryColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
      ${sec.title}
    </h3>
    {{tables.passengers}}
  </div>`;
    } else if (sec.type === 'flights') {
      html += `
  <!-- Flight Details Section -->
  <div style="margin-bottom: 24px;">
    <h3 style="margin: 0 0 8px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${primaryColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3.5c-.5-.5-2.5 0-4 1.5L13.5 8.5 5.3 6.7 3 9l8 4-4.5 4.5H4L2 22l4.5-2v-2.5L11 13l4 8z"></path></svg>
      ${sec.title}
    </h3>
    {{tables.flights}}
  </div>`;
    } else if (sec.type === 'hotels') {
      html += `
  <!-- Hotel Stay Section -->
  <div style="margin-bottom: 24px;">
    <h3 style="margin: 0 0 8px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${primaryColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
      ${sec.title}
    </h3>
    {{tables.hotels}}
  </div>`;
    } else if (sec.type === 'transports') {
      html += `
  <!-- Transport details Section -->
  <div style="margin-bottom: 24px;">
    <h3 style="margin: 0 0 8px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${primaryColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><rect x="1" y="3" width="22" height="13" rx="2" ry="2"></rect><path d="M5 21v-2h14v2"></path><path d="M18 16V3"></path><path d="M6 16V3"></path></svg>
      ${sec.title}
    </h3>
    {{tables.transports}}
  </div>`;
    } else if (sec.type === 'visas') {
      html += `
  <!-- Visa Section -->
  <div style="margin-bottom: 24px;">
    <h3 style="margin: 0 0 8px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${primaryColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
      ${sec.title}
    </h3>
    {{tables.visas}}
  </div>`;
    } else if (sec.type === 'specialties') {
      html += `
  <!-- Specialties Section -->
  <div style="margin-bottom: 24px;">
    <h3 style="margin: 0 0 8px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${primaryColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
      ${sec.title}
    </h3>
    {{tables.specialties}}
  </div>`;
    } else if (sec.type === 'services') {
      html += `
  <!-- Services Breakdown Section -->
  <div style="margin-bottom: 24px;">
    <h3 style="margin: 0 0 8px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${primaryColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="9"></line><line x1="9" y1="13" x2="15" y2="13"></line><line x1="9" y1="17" x2="15" y2="17"></line></svg>
      ${sec.title}
    </h3>
    {{tables.services}}
  </div>`;
    } else if (sec.type === 'payments') {
      html += `
  <!-- Payment logs Section -->
  <div style="margin-bottom: 24px;">
    <h3 style="margin: 0 0 8px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${primaryColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12" y2="18"></line><line x1="2" y1="10" x2="22" y2="10"></line></svg>
      ${sec.title}
    </h3>
    {{tables.payments}}
  </div>`;
    } else if (sec.type === 'balances') {
      html += `
  <!-- Financial Summary Section -->
  <div style="display: flex; justify-content: flex-end; margin-bottom: 32px;">
    <div style="width: 260px; background: ${selectedTheme.bg}; border: 1px solid ${primaryColor}20; border-radius: 12px; padding: 16px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; color: #64748b;">
        <span>Total Gross Value:</span>
        <span style="font-weight: 700; color: #334155;">{{booking.currencySymbol}}{{booking.amountGross}}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; color: #64748b; border-bottom: 1px solid ${primaryColor}15; padding-bottom: 8px;">
        <span>Confirmed Paid:</span>
        <span style="font-weight: 700; color: #10b981;">{{booking.currencySymbol}}{{booking.amountSettled}}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 800; color: #0f172a; padding-top: 4px;">
        <span>Balance Due:</span>
        <span style="color: ${primaryColor}; font-weight: 900;">{{booking.currencySymbol}}{{booking.amountDue}}</span>
      </div>
    </div>
  </div>`;
    } else if (sec.type === 'custom_text') {
      html += `
  <!-- Custom Text Section -->
  <div style="margin-bottom: 24px; background: ${selectedTheme.bg}; border-radius: 12px; padding: 16px; border: 1px solid ${primaryColor}15; color: ${selectedTheme.text}; line-height: 1.5;">
    <h3 style="margin: 0 0 8px; font-size: 11px; font-weight: 800; color: ${primaryColor}; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${primaryColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
      ${sec.title}
    </h3>
    <p style="margin: 0; font-size: 10px; line-height: 1.5;">${(sec.body || '').replace(/\n/g, '<br>')}</p>
  </div>`;
    }
  });

  if (config.showSignature || config.showTimestamp || config.showWhatsapp) {
    html += `
  <!-- Footer Signature & Multi-Channel Address -->
  <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; display: flex; justify-content: space-between; align-items: end; font-size: 10px; color: #94a3b8;">
    <div>`;

    if (config.showSignature) {
      html += `
      <p style="margin: 2px 0; font-weight: bold; color: #64748b;">Digital Verification Seal</p>
      <p style="margin: 2px 0; font-family: monospace; font-size: 9px; color: #64748b; word-break: break-all; max-width: 320px;">{{document.signature}}</p>`;
    }

    if (config.showTimestamp) {
      html += `
      <p style="margin: 2px 0; font-size: 9px;">Generated secure hash timeline: {{document.timestamp}}</p>`;
    }

    html += `
    </div>
    <div style="text-align: right;">`;

    if (config.showWhatsapp) {
      html += `
      <p style="margin: 2px 0; color: #64748b; font-weight: bold; display: inline-flex; align-items: center; gap: 4px;">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#25d366" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
        WhatsApp Support Desk
      </p>
      <p style="margin: 2px 0; font-size: 9px; font-family: monospace; color: #64748b;">{{company.whatsapp}}</p>`;
    }

    html += `
    </div>
  </div>`;
  }

  html += `\n</div>`;

  let css = `/* Generated Template Stylesheet */
.doc-container {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
}
@media print {
  body {
    background: #fff !important;
  }
  .doc-container {
    box-shadow: none !important;
    border: none !important;
    padding: 0 !important;
  }
}`;

  return { html, css };
}

export function SuperAdminDashboard() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();
  
  // Active Tab State
  const [activeTab, setActiveTab] = useState<'tenants' | 'demos' | 'settings' | 'templates'>('tenants');

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
  const [newCompanyCurrency, setNewCompanyCurrency] = useState('GBP');
  const [newCompanyPlan, setNewCompanyPlan] = useState('trial');
  const [newCompanyTrialDays, setNewCompanyTrialDays] = useState(14);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [editName, setEditName] = useState('');
  const [editDomain, setEditDomain] = useState('');
  const [editLogo, setEditLogo] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIndustry, setEditIndustry] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCurrency, setEditCurrency] = useState('GBP');
  const [editPlan, setEditPlan] = useState('trial');
  const [editStatus, setEditStatus] = useState('active');
  const [editTrialEndsAt, setEditTrialEndsAt] = useState('');
  const [editError, setEditError] = useState('');
  const [createModalTab, setCreateModalTab] = useState<'general' | 'admin' | 'subscription'>('general');
  const [editModalTab, setEditModalTab] = useState<'general' | 'contact' | 'subscription' | 'admin'>('general');
  const [adminUser, setAdminUser] = useState<{ id: number; email: string; name: string } | null>(null);
  const [fetchingAdmin, setFetchingAdmin] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  // Invoicing & Voucher Templates States
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'studio' | 'profile'>('studio');

  // Visual/Code Template Editor States
  const [editMode, setEditMode] = useState<'visual' | 'code'>('visual');
  const [visualConfig, setVisualConfig] = useState<VisualConfig | null>(null);
  const [tempName, setTempName] = useState('');
  const [tempType, setTempType] = useState('INVOICE');
  const [tempStatus, setTempStatus] = useState('Draft');
  const [tempHtml, setTempHtml] = useState('');
  const [tempCss, setTempCss] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Tenant Branding Context States
  const [tenantProfile, setTenantProfile] = useState({
    companyName: '',
    logoPrimary: '',
    logoSecondary: '',
    officeAddress: '',
    emailSender: '',
    landlineFormat: '',
    whatsappWebhook: ''
  });
  const [tenantProfileLoading, setTenantProfileLoading] = useState(false);
  const [uploadingPrimary, setUploadingPrimary] = useState(false);
  const [uploadingSecondary, setUploadingSecondary] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'SUPER_ADMIN') {
      navigate('/super-admin/login');
      return;
    }

    if (activeTab === 'tenants' || activeTab === 'templates') {
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

  // Template Manager helpers
  const handleSelectTenantTemplate = (t: any, tenantId: number) => {
    setSelectedTemplate(t);
    setTempName(t.name);
    setTempType(t.type);
    setTempStatus(t.status);
    setTempHtml(t.structureHtml);
    setTempCss(t.structureCss);
    
    // Extract VisualConfig comment
    const match = t.structureHtml.match(/<!-- VISUAL_CONFIG: (.*) -->/);
    if (match) {
      try {
        const parsed = JSON.parse(match[1]);
        setVisualConfig(parsed);
        setEditMode('visual');
      } catch (err) {
        setVisualConfig(defaultVisualConfig(t.type));
        setEditMode('code');
      }
    } else {
      setVisualConfig(null);
      setEditMode('code');
    }
    
    triggerTenantPreview(t.id, tenantId);
  };

  const triggerTenantPreview = async (templateId: number, tenantId: number) => {
    try {
      setPreviewLoading(true);
      const res = await api.get(`/finance/templates/${templateId}/preview`, { params: { tenantId } });
      setPreviewHtml(res.data.previewHtml || '');
    } catch (err) {
      console.error(err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const fetchTenantTemplates = async (tenantId: number) => {
    setTemplatesLoading(true);
    try {
      const res = await api.get('/finance/templates', { params: { tenantId } });
      setTemplates(res.data.templates || []);
      if (res.data.templates?.length > 0) {
        handleSelectTenantTemplate(res.data.templates[0], tenantId);
      } else {
        setSelectedTemplate(null);
        setVisualConfig(null);
        setPreviewHtml('');
      }
    } catch (err) {
      toast.error('Failed to load company templates');
    } finally {
      setTemplatesLoading(false);
    }
  };

  const fetchTenantProfile = async (tenantId: number) => {
    setTenantProfileLoading(true);
    try {
      const currentTenant = tenants.find(t => t.id === tenantId);
      const tenantDetails = {
        name: currentTenant?.name || 'Company Name',
        logo: currentTenant?.logo || '',
        location: currentTenant?.location || '',
        email: currentTenant?.email || '',
        phone: currentTenant?.phone || ''
      };

      const res = await api.get('/finance/company-context', { params: { tenantId } });
      if (res.data.companyContext) {
        const ctx = res.data.companyContext;
        setTenantProfile({
          companyName: ctx.companyName || tenantDetails.name,
          logoPrimary: ctx.logoPrimary || tenantDetails.logo,
          logoSecondary: ctx.logoSecondary || '',
          officeAddress: ctx.officeAddress || tenantDetails.location,
          emailSender: ctx.emailSender || tenantDetails.email,
          landlineFormat: ctx.landlineFormat || tenantDetails.phone,
          whatsappWebhook: ctx.whatsappWebhook || `https://api.whatsapp.com/send?phone=${(ctx.landlineFormat || tenantDetails.phone).replace(/[^0-9+]/g, '')}`
        });
      }
    } catch (err) {
      toast.error('Failed to load company branding details');
    } finally {
      setTenantProfileLoading(false);
    }
  };

  const updateTenantVisualConfig = (updates: Partial<VisualConfig>) => {
    if (!visualConfig) return;
    const newConfig = { ...visualConfig, ...updates };
    setVisualConfig(newConfig);
    const generated = generateTemplateFromVisualConfig(newConfig, tempType);
    setTempHtml(generated.html + `\n<!-- VISUAL_CONFIG: ${JSON.stringify(newConfig)} -->`);
    setTempCss(generated.css);
  };

  const addTenantSection = (type: VisualSection['type']) => {
    if (!visualConfig) return;
    const newId = `sec-${Date.now()}`;
    let defaultTitle = '';
    let defaultBody = '';
    
    switch (type) {
      case 'passengers': defaultTitle = 'Passenger Details'; break;
      case 'flights': defaultTitle = 'Flight Details'; break;
      case 'hotels': defaultTitle = 'Hotel Details'; break;
      case 'transports': defaultTitle = 'Ground Transport Details'; break;
      case 'visas': defaultTitle = 'Visa Approvals'; break;
      case 'specialties': defaultTitle = 'Speciality Services'; break;
      case 'services': defaultTitle = 'Itemized Pricing'; break;
      case 'payments': defaultTitle = 'Payments Log'; break;
      case 'balances': defaultTitle = 'Financial Summary'; break;
      case 'custom_text': 
        defaultTitle = 'Important Notes'; 
        defaultBody = 'Write notes or additional instructions here...'; 
        break;
    }

    const newSection: VisualSection = {
      id: newId,
      type,
      title: defaultTitle,
      body: defaultBody
    };

    updateTenantVisualConfig({
      sections: [...visualConfig.sections, newSection]
    });
    toast.success('Added new section: ' + defaultTitle);
  };

  const removeTenantSection = (id: string) => {
    if (!visualConfig) return;
    const target = visualConfig.sections.find(s => s.id === id);
    if (!target) return;
    updateTenantVisualConfig({
      sections: visualConfig.sections.filter(s => s.id !== id)
    });
    toast.success('Removed section: ' + target.title);
  };

  const moveTenantSection = (index: number, direction: 'up' | 'down') => {
    if (!visualConfig) return;
    const newSections = [...visualConfig.sections];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newSections.length) return;
    
    const temp = newSections[index];
    newSections[index] = newSections[targetIndex];
    newSections[targetIndex] = temp;
    
    updateTenantVisualConfig({ sections: newSections });
  };

  const updateTenantSectionTitle = (id: string, title: string) => {
    if (!visualConfig) return;
    updateTenantVisualConfig({
      sections: visualConfig.sections.map(s => s.id === id ? { ...s, title } : s)
    });
  };

  const updateTenantSectionBody = (id: string, body: string) => {
    if (!visualConfig) return;
    updateTenantVisualConfig({
      sections: visualConfig.sections.map(s => s.id === id ? { ...s, body } : s)
    });
  };

  const handleCreateNewTenantTemplateClick = () => {
    setSelectedTemplate(null);
    setTempName('');
    setTempType('INVOICE');
    setTempStatus('Draft');
    const defaultConfig = defaultVisualConfig('INVOICE');
    setVisualConfig(defaultConfig);
    const generated = generateTemplateFromVisualConfig(defaultConfig, 'INVOICE');
    setTempHtml(generated.html + `\n<!-- VISUAL_CONFIG: ${JSON.stringify(defaultConfig)} -->`);
    setTempCss(generated.css);
    setEditMode('visual');
    setPreviewHtml('');
  };

  const handleSaveTenantTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantId) return;
    if (!tempName) {
      toast.error('Template Name is required');
      return;
    }

    if (tempType === 'VOUCHER') {
      const financialTokens = [
        'booking.amountGross',
        'booking.amountSettled',
        'booking.amountDue',
        'tables.payments',
        'tables.services'
      ];
      const foundFinancialToken = financialTokens.find(token => tempHtml.includes(token));
      if (foundFinancialToken) {
        toast.error(`Error: Vouchers are strictly forbidden from containing financial variables (e.g. ${foundFinancialToken})`);
        return;
      }
    }

    setSavingTemplate(true);
    try {
      if (selectedTemplate) {
        await api.put(`/finance/templates/${selectedTemplate.id}`, {
          tenantId: selectedTenantId,
          name: tempName,
          status: tempStatus,
          structureHtml: tempHtml,
          structureCss: tempCss
        });
        toast.success('Template updated successfully');
      } else {
        const res = await api.post('/finance/templates', {
          tenantId: selectedTenantId,
          name: tempName,
          type: tempType,
          status: tempStatus,
          structureHtml: tempHtml,
          structureCss: tempCss
        });
        toast.success('Template created successfully');
        setSelectedTemplate(res.data.template);
      }
      const resList = await api.get('/finance/templates', { params: { tenantId: selectedTenantId } });
      setTemplates(resList.data.templates || []);
      if (!selectedTemplate && resList.data.templates?.length > 0) {
        const justCreated = resList.data.templates.find((x: any) => x.name === tempName && x.type === tempType);
        if (justCreated) {
          handleSelectTenantTemplate(justCreated, selectedTenantId);
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save template');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleSaveTenantProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantId) return;
    setTenantProfileLoading(true);
    try {
      await api.put('/finance/company-context', {
        ...tenantProfile,
        tenantId: selectedTenantId
      });
      toast.success('Company Profile Context updated');
      fetchTenantProfile(selectedTenantId);
    } catch (err) {
      toast.error('Failed to update profile settings');
    } finally {
      setTenantProfileLoading(false);
    }
  };

  const handleTenantLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'primary' | 'secondary') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (type === 'primary') setUploadingPrimary(true);
    else setUploadingSecondary(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/auth/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (type === 'primary') {
        setTenantProfile(prev => ({ ...prev, logoPrimary: res.data.url }));
        toast.success('Primary logo uploaded successfully');
      } else {
        setTenantProfile(prev => ({ ...prev, logoSecondary: res.data.url }));
        toast.success('Secondary logo uploaded successfully');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to upload logo');
    } finally {
      if (type === 'primary') setUploadingPrimary(false);
      else setUploadingSecondary(false);
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
        currency: newCompanyCurrency,
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
      setNewCompanyCurrency('GBP');
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

  const fetchTenantAdmin = async (tenantId: number) => {
    setFetchingAdmin(true);
    setAdminUser(null);
    try {
      const response = await api.get('/auth/users', {
        headers: { 'x-tenant-id': String(tenantId) }
      });
      const users = response.data?.users || [];
      const admin = users.find((u: any) => u.role === 'MAIN_COMPANY_ADMIN') || users.find((u: any) => u.role === 'COMPANY_ADMIN');
      if (admin) {
        setAdminUser({
          id: admin.id,
          email: admin.email,
          name: admin.name || ''
        });
      }
    } catch (err) {
      console.error('Failed to fetch tenant admin:', err);
    } finally {
      setFetchingAdmin(false);
    }
  };

  const handleResetAdminPassword = async () => {
    if (!editingTenant || !adminUser || !resetPassword) return;
    if (resetPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }
    
    setIsResettingPassword(true);
    try {
      await api.patch(
        `/auth/users/${adminUser.id}`,
        { password: resetPassword },
        { headers: { 'x-tenant-id': String(editingTenant.id) } }
      );
      toast.success('Administrator password updated successfully');
      setResetPassword('');
    } catch (err: any) {
      const errMsg = err.response?.data?.error || 'Failed to reset administrator password';
      toast.error(errMsg);
    } finally {
      setIsResettingPassword(false);
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
    setEditCurrency((tenant as any).currency || 'GBP');
    setEditPlan(tenant.subscriptionPlan);
    setEditStatus(tenant.status);
    
    // Format date string for HTML date input: YYYY-MM-DD
    if (tenant.trialEndsAt) {
      setEditTrialEndsAt(new Date(tenant.trialEndsAt).toISOString().split('T')[0]);
    } else {
      setEditTrialEndsAt('');
    }
    
    setEditError('');
    setResetPassword('');
    setEditModalTab('general');
    setIsEditModalOpen(true);
    fetchTenantAdmin(tenant.id);
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;
    setIsUpdating(true);
    setEditError('');

    try {
      // If resetPassword is set, update it
      if (adminUser && resetPassword) {
        if (resetPassword.length < 6) {
          throw new Error('Admin password must be at least 6 characters long');
        }
        await api.patch(
          `/auth/users/${adminUser.id}`,
          { password: resetPassword },
          { headers: { 'x-tenant-id': String(editingTenant.id) } }
        );
        toast.success('Administrator password updated successfully');
      }

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
        currency: editCurrency,
        subscriptionPlan: editPlan,
        subscriptionStatus: editPlan === 'trial' ? 'trial' : 'active',
        trialEndsAt: editPlan === 'trial' && editTrialEndsAt ? new Date(editTrialEndsAt).toISOString() : null
      });

      // Update local state list
      setTenants(tenants.map(t => t.id === editingTenant.id ? response.data.tenant : t));
      setIsEditModalOpen(false);
      setEditingTenant(null);
    } catch (err: any) {
      setEditError(err.response?.data?.error || err.message || 'Failed to update company');
    } finally {
      setIsUpdating(false);
    }
  };

  if (!user || user.role !== 'SUPER_ADMIN') return null;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-52 bg-white border-r border-slate-200 flex-shrink-0 hidden md:flex flex-col justify-between">
        <div className="p-3.5">
          <div className="flex items-center gap-2 mb-5 px-1">
            <Shield className="h-4 w-4 text-primary-600" />
            <div>
              <h2 className="font-extrabold text-[12px] text-slate-900 tracking-tight leading-none">SaaS Admin</h2>
              <p className="text-[8.5px] text-primary-600 font-bold uppercase tracking-wider mt-0.5">Global Access</p>
            </div>
          </div>
          
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('tenants')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg w-full text-left text-[11px] font-bold transition-all ${
                activeTab === 'tenants' ? 'bg-primary-50 text-primary-600' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Building2 className="h-4 w-4" />
              Companies (Tenants)
            </button>
            <button
              onClick={() => setActiveTab('demos')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg w-full text-left text-[11px] font-bold transition-all ${
                activeTab === 'demos' ? 'bg-primary-50 text-primary-600' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Inbox className="h-4 w-4" />
              Demo Requests
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg w-full text-left text-[11px] font-bold transition-all ${
                activeTab === 'settings' ? 'bg-primary-50 text-primary-600' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Settings className="h-4 w-4" />
              SMTP Settings
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg w-full text-left text-[11px] font-bold transition-all ${
                activeTab === 'templates' ? 'bg-primary-50 text-primary-600' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Layout className="h-4 w-4" />
              Invoicing & Vouchers
            </button>
          </nav>
        </div>
        
        <div className="p-3.5 border-t border-slate-100 flex flex-col">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-red-500 hover:bg-red-50/80 w-full px-3 py-2 rounded-lg font-bold transition-all duration-200 text-[11px] text-left"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-5 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {activeTab === 'tenants' && 'SaaS Command Center'}
                {activeTab === 'demos' && 'Demo Requests'}
                {activeTab === 'settings' && 'SMTP Configuration'}
                {activeTab === 'templates' && 'Invoicing & Voucher Studio'}
              </h1>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {activeTab === 'tenants' && 'Manage global enterprise tenants, database workspaces, and subscription access.'}
                {activeTab === 'demos' && 'Manage incoming B2B demo leads, view company profile details, and track follow-ups.'}
                {activeTab === 'settings' && 'Manage platform SMTP settings for verification, notifications, and customer emails.'}
                {activeTab === 'templates' && 'Dynamically design and override documents layouts, sections, and brandings for any registered enterprise.'}
              </p>
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  if (activeTab === 'tenants') fetchTenants();
                  else if (activeTab === 'demos') fetchDemoRequests();
                  else if (activeTab === 'settings') fetchSmtpSettings();
                  else if (activeTab === 'templates' && selectedTenantId) {
                    fetchTenantTemplates(selectedTenantId);
                    fetchTenantProfile(selectedTenantId);
                  }
                }}
                className="p-1.5 border border-slate-200 bg-white rounded-lg hover:bg-slate-100 transition-colors flex items-center justify-center"
                title="Refresh Data"
              >
                <RefreshCw className={`h-4 w-4 text-slate-600 ${(loading || loadingDemos || loadingSmtp || templatesLoading || tenantProfileLoading) ? 'animate-spin' : ''}`} />
              </button>
              {activeTab === 'tenants' && (
                <button 
                  onClick={() => {
                    setCreateModalTab('general');
                    setIsCreateModalOpen(true);
                  }}
                  className="bg-primary-600 text-white px-3.5 py-1.5 rounded-lg hover:bg-primary-500 text-xs font-bold shadow-md shadow-primary-500/10 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Add Company
                </button>
              )}
            </div>
          </div>

          {/* Stats Bar */}
          {activeTab === 'tenants' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                <div className="p-2 bg-primary-50 text-primary-600 rounded-lg">
                  <Building2 className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">Total Companies</p>
                  <p className="text-base font-black text-slate-900 mt-0.5">{tenants.length}</p>
                </div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                  <Users className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">Active Staff Users</p>
                  <p className="text-base font-black text-slate-900 mt-0.5">
                    {tenants.reduce((acc, curr) => acc + (curr._count?.users || 0), 0)}
                  </p>
                </div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <CheckCircle className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">System Health</p>
                  <p className="text-base font-black text-emerald-600 mt-0.5">100% Operational</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'demos' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                <div className="p-2 bg-primary-50 text-primary-600 rounded-lg">
                  <Inbox className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">Total Demo Requests</p>
                  <p className="text-base font-black text-slate-900 mt-0.5">{demoRequests.length}</p>
                </div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                  <Clock className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">Pending Response</p>
                  <p className="text-base font-black text-slate-900 mt-0.5">
                    {demoRequests.filter(r => r.status === 'pending').length}
                  </p>
                </div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <CheckCircle className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">Contacted Leads</p>
                  <p className="text-base font-black text-emerald-600 mt-0.5">
                    {demoRequests.filter(r => r.status === 'contacted').length}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                <div className="p-2 bg-primary-50 text-primary-600 rounded-lg">
                  <Server className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">SMTP Host</p>
                  <p className="text-xs font-bold text-slate-900 mt-0.5 truncate max-w-[200px]" title={smtpSettings.host}>
                    {smtpSettings.host || 'smtp.gmail.com'}
                  </p>
                </div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Mail className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">Sender Account</p>
                  <p className="text-xs font-bold text-slate-900 mt-0.5 truncate max-w-[200px]" title={smtpSettings.user}>
                    {smtpSettings.user || 'muhammadfaisalchughtai@gmail.com'}
                  </p>
                </div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <Activity className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">Mail Client Status</p>
                  <p className="text-xs font-bold text-emerald-600 mt-0.5">Configured</p>
                </div>
              </div>
            </div>
          )}

          {/* Active Tab Panel */}
          {activeTab === 'tenants' && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider">Registered Companies</h3>
              </div>
              
              {loading && tenants.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary-600 mb-2" />
                  Loading SaaS metrics...
                </div>
              ) : tenants.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <Building2 className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                  <p className="font-bold text-sm text-slate-700">No companies registered yet</p>
                  <p className="text-xs mt-1 text-slate-400">Click the button in the top right to register your first enterprise client.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50/35">
                        <th className="px-4 py-2.5">Company Info</th>
                        <th className="px-4 py-2.5">Industry / Location</th>
                        <th className="px-4 py-2.5">Contact Info</th>
                        <th className="px-4 py-2.5">Subscription Plan</th>
                        <th className="px-4 py-2.5">Trial Expiry / Status</th>
                        <th className="px-4 py-2.5 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                      {tenants.map(tenant => {
                        const isTrial = tenant.subscriptionPlan === 'trial';
                        const isExpired = isTrial && tenant.trialEndsAt && new Date() > new Date(tenant.trialEndsAt);
                        const isSuspended = tenant.status === 'suspended';

                        return (
                          <tr key={tenant.id} className="hover:bg-slate-50/30 transition-colors">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                {tenant.logo ? (
                                  <img 
                                    src={tenant.logo} 
                                    alt={`${tenant.name} Logo`} 
                                    className="w-7 h-7 rounded-lg object-contain border border-slate-100 bg-slate-50 p-0.5"
                                  />
                                ) : (
                                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                                    <Building2 className="w-4 h-4" />
                                  </div>
                                )}
                                <div>
                                  <span className="font-bold text-slate-900 block">{tenant.name}</span>
                                  <span className="text-[10px] font-mono text-slate-400">{tenant.domain}.travelbooker.com</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="space-y-0.5">
                                <span className="flex items-center gap-1 text-[11px] text-slate-600 font-medium">
                                  <Briefcase className="w-3 h-3 text-slate-400" /> {tenant.industry || 'Unspecified'}
                                </span>
                                <span className="flex items-center gap-1 text-[10px] text-slate-500">
                                  <MapPin className="w-3 h-3 text-slate-400" /> {tenant.location || 'Unspecified'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="space-y-0.5">
                                {tenant.email && (
                                  <span className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                                    <Mail className="w-3 h-3 text-slate-400" /> {tenant.email}
                                  </span>
                                )}
                                {tenant.phone && (
                                  <span className="flex items-center gap-1 text-[10px] text-slate-500">
                                    <Phone className="w-3 h-3 text-slate-400" /> {tenant.phone}
                                  </span>
                                )}
                                {!tenant.email && !tenant.phone && <span className="text-slate-400 text-[10px]">No contact added</span>}
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                                tenant.subscriptionPlan === 'lifetime' 
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm'
                                  : tenant.subscriptionPlan === 'active'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                    : 'bg-amber-50 text-amber-700 border border-amber-100'
                              }`}>
                                {tenant.subscriptionPlan}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              {isTrial ? (
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1">
                                    <Clock className={`w-3.5 h-3.5 ${isExpired ? 'text-red-500' : 'text-slate-400'}`} />
                                    <span className={`text-[11px] font-bold ${isExpired ? 'text-red-600' : 'text-slate-700'}`}>
                                      {isExpired ? 'Trial Expired' : 'Active Trial'}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-400 block font-mono">
                                    {tenant.trialEndsAt ? new Date(tenant.trialEndsAt).toLocaleDateString() : 'N/A'}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  {isSuspended ? (
                                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-100">
                                      Suspended
                                    </span>
                                  ) : (
                                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                      Active
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <button
                                onClick={() => openEditModal(tenant)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors border border-slate-200 shadow-sm inline-flex items-center gap-1"
                              >
                                <Edit className="w-3 h-3" />
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
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-2 bg-slate-50/50">
                <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider">Demo Request Submissions</h3>
                <div className="flex gap-1.5">
                  {['all', 'pending', 'contacted'].map((statusOption) => (
                    <button
                      key={statusOption}
                      onClick={() => setFilterStatus(statusOption)}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase border transition-all ${
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
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary-600 mb-2" />
                  Loading demo requests...
                </div>
              ) : demoRequests.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <Inbox className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                  <p className="font-bold text-sm text-slate-700">No demo requests found</p>
                  <p className="text-xs mt-1 text-slate-400">Incoming demo requests from the public landing page will appear here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50/35">
                        <th className="px-4 py-2.5">Contact Info</th>
                        <th className="px-4 py-2.5">Company Details</th>
                        <th className="px-4 py-2.5">GDS Systems</th>
                        <th className="px-4 py-2.5">Request Message</th>
                        <th className="px-4 py-2.5">Submitted At</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                      {demoRequests
                        .filter(req => filterStatus === 'all' ? true : req.status === filterStatus)
                        .map(req => {
                          const isPending = req.status === 'pending';

                          return (
                            <tr key={req.id} className="hover:bg-slate-50/30 transition-colors">
                              <td className="px-4 py-2.5">
                                <div className="space-y-0.5">
                                  <span className="font-bold text-slate-900 block">{req.fullName}</span>
                                  <span className="text-[10px] text-slate-400 font-mono block">{req.email}</span>
                                  {req.phoneNumber && (
                                    <span className="text-[10px] text-slate-500 block">{req.phoneNumber}</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="space-y-0.5">
                                  <span className="font-bold text-slate-900 block">{req.companyName}</span>
                                  {req.agencySize && (
                                    <span className="text-[10px] text-slate-500 block">Size: {req.agencySize}</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="text-[10px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                                  {req.gdsSystems || 'None / Unknown'}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 max-w-[200px]">
                                <p className="text-xs text-slate-500 truncate" title={req.message || ''}>
                                  {req.message || <span className="italic text-slate-400">No message</span>}
                                </p>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {new Date(req.createdAt).toLocaleDateString()} {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                                  req.status === 'contacted'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                    : 'bg-amber-50 text-amber-700 border border-amber-100'
                                }`}>
                                  {req.status}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => setSelectedDemo(req)}
                                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors border border-slate-200 shadow-sm"
                                  >
                                    View
                                  </button>
                                  {isPending ? (
                                    <button
                                      onClick={() => handleUpdateDemoStatus(req.id, 'contacted')}
                                      disabled={updatingDemoId === req.id}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors border border-emerald-700 shadow-sm disabled:opacity-50"
                                    >
                                      Mark Contacted
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleUpdateDemoStatus(req.id, 'pending')}
                                      disabled={updatingDemoId === req.id}
                                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors border border-amber-700 shadow-sm disabled:opacity-50"
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
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 max-w-2xl">
              <div className="flex items-center gap-2.5 mb-4 border-b border-slate-100 pb-3">
                <div className="p-2 bg-primary-50 text-primary-600 rounded-lg">
                  <Server className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">SMTP Server Settings</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">Configure platform-wide SMTP settings for outgoing emails and demo confirmations.</p>
                </div>
              </div>

              {loadingSmtp ? (
                <div className="p-12 text-center text-slate-500">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary-600 mb-2" />
                  Loading configuration...
                </div>
              ) : (
                <form onSubmit={handleSaveSmtp} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">SMTP Host *</label>
                      <input 
                        type="text" 
                        required 
                        value={smtpSettings.host}
                        onChange={e => setSmtpSettings({ ...smtpSettings, host: e.target.value })}
                        placeholder="smtp.gmail.com" 
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs transition-all font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">SMTP Port *</label>
                      <input 
                        type="text" 
                        required 
                        value={smtpSettings.port}
                        onChange={e => setSmtpSettings({ ...smtpSettings, port: e.target.value })}
                        placeholder="587" 
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs transition-all font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">SMTP User (Sender Email) *</label>
                      <input 
                        type="email" 
                        required 
                        value={smtpSettings.user}
                        onChange={e => setSmtpSettings({ ...smtpSettings, user: e.target.value })}
                        placeholder="example@gmail.com" 
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs transition-all font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">SMTP Password / App Secret *</label>
                      <div className="relative">
                        <Key className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                        <input 
                          type="password" 
                          required 
                          value={smtpSettings.pass}
                          onChange={e => setSmtpSettings({ ...smtpSettings, pass: e.target.value })}
                          placeholder="••••••••••••" 
                          className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs transition-all font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 py-0.5">
                    <input 
                      type="checkbox" 
                      id="secure"
                      checked={smtpSettings.secure}
                      onChange={e => setSmtpSettings({ ...smtpSettings, secure: e.target.checked })}
                      className="w-3.5 h-3.5 rounded text-primary-600 border-slate-300 focus:ring-primary-500"
                    />
                    <label htmlFor="secure" className="text-xs font-bold text-slate-600 cursor-pointer select-none">
                      Enable SSL / Secure Connection (Secure on port 465, STARTTLS on port 587)
                    </label>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex justify-end">
                    <button 
                      type="submit" 
                      disabled={savingSmtp}
                      className="bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md shadow-primary-500/10 active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      {savingSmtp ? 'Saving Settings...' : 'Save Configuration'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Building2 className="w-6 h-6 text-primary-600" />
                  <div>
                    <h3 className="font-bold text-slate-900">Select Company Context</h3>
                    <p className="text-xs text-slate-500">Pick a registered company to configure their invoicing, vouchers, and branding assets.</p>
                  </div>
                </div>
                <select
                  value={selectedTenantId || ''}
                  onChange={(e) => {
                    const tId = e.target.value ? parseInt(e.target.value) : null;
                    setSelectedTenantId(tId);
                    if (tId) {
                      fetchTenantTemplates(tId);
                      fetchTenantProfile(tId);
                    }
                  }}
                  className="w-full sm:w-64 px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                >
                  <option value="">-- Choose Company --</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.domain || 'no-domain'})</option>
                  ))}
                </select>
              </div>

              {selectedTenantId ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Sidebar: Templates List */}
                  <div className="lg:col-span-3 space-y-4">
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                        <h4 className="font-bold text-slate-900 text-sm">Company Layouts</h4>
                        <button
                          onClick={handleCreateNewTenantTemplateClick}
                          className="p-1.5 hover:bg-slate-50 text-primary-600 rounded-lg transition-colors border border-slate-200/60"
                          title="Create New Template"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      {templatesLoading ? (
                        <div className="py-6 text-center text-slate-400 text-xs">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto text-primary-600 mb-2" />
                          Loading templates...
                        </div>
                      ) : templates.length === 0 ? (
                        <div className="py-6 text-center text-slate-400 text-xs">
                          No templates configured.
                        </div>
                      ) : (
                        <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
                          {templates.map(t => (
                            <button
                              key={t.id}
                              onClick={() => handleSelectTenantTemplate(t, selectedTenantId)}
                              className={`w-full text-left p-2.5 rounded-xl transition-all border flex flex-col gap-1 ${
                                selectedTemplate?.id === t.id
                                  ? 'bg-primary-50/50 border-primary-200 text-primary-700 shadow-sm font-semibold'
                                  : 'border-transparent text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <span className="text-xs truncate block font-medium">{t.name}</span>
                              <div className="flex justify-between items-center text-[10px]">
                                <span className={`px-1.5 py-0.5 rounded-md font-bold tracking-wide ${
                                  t.type === 'INVOICE' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                                }`}>{t.type}</span>
                                <span className={`px-1.5 py-0.5 rounded-md ${
                                  t.status === 'Active' ? 'bg-emerald-50 text-emerald-700 font-bold' : 'bg-slate-100 text-slate-500'
                                }`}>{t.status}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Tab Menu */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-2 flex flex-col gap-1">
                      <button
                        onClick={() => setActiveSubTab('studio')}
                        className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-colors ${
                          activeSubTab === 'studio' ? 'bg-primary-50 text-primary-600' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Layout className="w-4 h-4" /> Layout Builder
                      </button>
                      <button
                        onClick={() => setActiveSubTab('profile')}
                        className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-colors ${
                          activeSubTab === 'profile' ? 'bg-primary-50 text-primary-600' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Globe className="w-4 h-4" /> Branding Assets
                      </button>
                    </div>
                  </div>

                  {/* Main Work Area */}
                  <div className="lg:col-span-9 space-y-6">
                    {activeSubTab === 'profile' ? (
                      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                        <h3 className="font-bold text-slate-900 text-base mb-1">Branding context settings</h3>
                        <p className="text-xs text-slate-500 mb-6">These parameters fill template tags like company address, sender email, logos and support lines.</p>

                        {tenantProfileLoading ? (
                          <div className="p-12 text-center text-slate-500">
                            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary-600 mb-2" />
                            Loading settings...
                          </div>
                        ) : (
                          <form onSubmit={handleSaveTenantProfile} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                              <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Official Company Name *</label>
                                <input
                                  type="text"
                                  required
                                  value={tenantProfile.companyName}
                                  onChange={e => setTenantProfile({ ...tenantProfile, companyName: e.target.value })}
                                  placeholder="Company Name"
                                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Corporate Sender Email</label>
                                <input
                                  type="email"
                                  value={tenantProfile.emailSender}
                                  onChange={e => setTenantProfile({ ...tenantProfile, emailSender: e.target.value })}
                                  placeholder="operations@company.com"
                                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                              <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Primary Branding Logo URL</label>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={tenantProfile.logoPrimary}
                                    onChange={e => setTenantProfile({ ...tenantProfile, logoPrimary: e.target.value })}
                                    placeholder="https://..."
                                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                                  />
                                  <label className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 flex items-center justify-center cursor-pointer min-w-[100px]">
                                    {uploadingPrimary ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Upload Logo'}
                                    <input type="file" accept="image/*" className="hidden" onChange={e => handleTenantLogoUpload(e, 'primary')} />
                                  </label>
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Secondary Branding Logo URL</label>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={tenantProfile.logoSecondary}
                                    onChange={e => setTenantProfile({ ...tenantProfile, logoSecondary: e.target.value })}
                                    placeholder="https://..."
                                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                                  />
                                  <label className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 flex items-center justify-center cursor-pointer min-w-[100px]">
                                    {uploadingSecondary ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Upload Logo'}
                                    <input type="file" accept="image/*" className="hidden" onChange={e => handleTenantLogoUpload(e, 'secondary')} />
                                  </label>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                              <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Office Landlines / Helpline Format</label>
                                <input
                                  type="text"
                                  value={tenantProfile.landlineFormat}
                                  onChange={e => setTenantProfile({ ...tenantProfile, landlineFormat: e.target.value })}
                                  placeholder="+44 20 7946 0958"
                                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">WhatsApp Webhook API URL</label>
                                <input
                                  type="text"
                                  value={tenantProfile.whatsappWebhook}
                                  onChange={e => setTenantProfile({ ...tenantProfile, whatsappWebhook: e.target.value })}
                                  placeholder="https://api.whatsapp.com/send?phone=..."
                                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Office Physical Address</label>
                              <textarea
                                value={tenantProfile.officeAddress}
                                onChange={e => setTenantProfile({ ...tenantProfile, officeAddress: e.target.value })}
                                placeholder="123 Travel Tower, London, UK"
                                rows={2}
                                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm resize-none"
                              />
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex justify-end">
                              <button
                                type="submit"
                                disabled={tenantProfileLoading}
                                className="bg-primary-600 hover:bg-primary-500 text-white px-5 py-2.5 rounded-xl font-semibold shadow-md shadow-primary-500/20 text-sm flex items-center gap-2"
                              >
                                <Save className="w-4 h-4" /> Save Context
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Visual Editor Form */}
                        <div className="lg:col-span-6 space-y-6">
                          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                            <form onSubmit={handleSaveTenantTemplate} className="space-y-6">
                              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                                <h3 className="font-bold text-slate-900 text-base">
                                  {selectedTemplate ? 'Template Layout Settings' : 'Create New Document Design'}
                                </h3>
                                <div className="flex gap-1.5 bg-slate-100 p-0.5 rounded-xl border border-slate-200/50">
                                  <button
                                    type="button"
                                    onClick={() => setEditMode('visual')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                      editMode === 'visual' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                  >
                                    Visual Builder
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditMode('code')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                      editMode === 'code' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                  >
                                    Code
                                  </button>
                                </div>
                              </div>

                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Layout Name *</label>
                                    <input
                                      type="text"
                                      required
                                      value={tempName}
                                      onChange={e => setTempName(e.target.value)}
                                      placeholder="e.g. Elegant Flight Invoice"
                                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Status</label>
                                    <select
                                      value={tempStatus}
                                      onChange={e => setTempStatus(e.target.value)}
                                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs"
                                    >
                                      <option value="Draft">Draft</option>
                                      <option value="Active">Active</option>
                                      <option value="Deprecated">Deprecated</option>
                                    </select>
                                  </div>
                                </div>

                                {!selectedTemplate && (
                                  <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Document Type *</label>
                                    <select
                                      value={tempType}
                                      onChange={e => {
                                        setTempType(e.target.value);
                                        const defaultConfig = defaultVisualConfig(e.target.value);
                                        setVisualConfig(defaultConfig);
                                        const generated = generateTemplateFromVisualConfig(defaultConfig, e.target.value);
                                        setTempHtml(generated.html + `\n<!-- VISUAL_CONFIG: ${JSON.stringify(defaultConfig)} -->`);
                                        setTempCss(generated.css);
                                      }}
                                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs"
                                    >
                                      <option value="INVOICE">INVOICE (Includes financial details)</option>
                                      <option value="VOUCHER">VOUCHER (Strictly price-free)</option>
                                    </select>
                                  </div>
                                )}

                                {editMode === 'code' ? (
                                  <div className="space-y-4">
                                    <div>
                                      <label className="block text-xs font-bold text-slate-600 uppercase mb-1">HTML Skeleton Layout</label>
                                      <textarea
                                        value={tempHtml}
                                        onChange={e => setTempHtml(e.target.value)}
                                        rows={12}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs font-mono"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-bold text-slate-600 uppercase mb-1">CSS Stylesheet</label>
                                      <textarea
                                        value={tempCss}
                                        onChange={e => setTempCss(e.target.value)}
                                        rows={6}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs font-mono"
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  visualConfig ? (
                                    <div className="space-y-6">
                                      {/* Design Styling Options */}
                                      <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 grid grid-cols-2 gap-4">
                                        <div>
                                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Color Theme</label>
                                          <div className="flex gap-1">
                                            {['indigo', 'blue', 'emerald', 'slate', 'amber'].map(theme => (
                                              <button
                                                key={theme}
                                                type="button"
                                                onClick={() => updateTenantVisualConfig({ themeColor: theme })}
                                                className={`w-6 h-6 rounded-full border transition-all ${
                                                  visualConfig.themeColor === theme ? 'ring-2 ring-primary-500 ring-offset-1 scale-110' : 'opacity-70'
                                                } ${
                                                  theme === 'indigo' ? 'bg-indigo-600' :
                                                  theme === 'blue' ? 'bg-blue-600' :
                                                  theme === 'emerald' ? 'bg-emerald-600' :
                                                  theme === 'slate' ? 'bg-slate-600' : 'bg-amber-600'
                                                }`}
                                              />
                                            ))}
                                          </div>
                                        </div>
                                        <div>
                                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Font Stack</label>
                                          <select
                                            value={visualConfig.fontFamily}
                                            onChange={e => updateTenantVisualConfig({ fontFamily: e.target.value })}
                                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs"
                                          >
                                            <option value="Inter">Inter UI</option>
                                            <option value="Outfit">Outfit Minimal</option>
                                            <option value="Roboto">Roboto Classic</option>
                                          </select>
                                        </div>
                                      </div>

                                      {/* Metadata checkboxes */}
                                      <div className="bg-slate-50/30 p-4 rounded-xl border border-slate-100 space-y-2 text-xs">
                                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1.5">Active Header Elements</label>
                                        <div className="grid grid-cols-2 gap-2">
                                          <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                                            <input type="checkbox" checked={visualConfig.showLogoPrimary} onChange={e => updateTenantVisualConfig({ showLogoPrimary: e.target.checked })} className="rounded text-primary-600 border-slate-200" />
                                            <span>Primary Logo</span>
                                          </label>
                                          <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                                            <input type="checkbox" checked={visualConfig.showLogoSecondary} onChange={e => updateTenantVisualConfig({ showLogoSecondary: e.target.checked })} className="rounded text-primary-600 border-slate-200" />
                                            <span>Secondary Logo</span>
                                          </label>
                                          <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                                            <input type="checkbox" checked={visualConfig.showAddress} onChange={e => updateTenantVisualConfig({ showAddress: e.target.checked })} className="rounded text-primary-600 border-slate-200" />
                                            <span>Office Address</span>
                                          </label>
                                          <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                                            <input type="checkbox" checked={visualConfig.showEmail} onChange={e => updateTenantVisualConfig({ showEmail: e.target.checked })} className="rounded text-primary-600 border-slate-200" />
                                            <span>Office Email</span>
                                          </label>
                                          <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                                            <input type="checkbox" checked={visualConfig.showPhone} onChange={e => updateTenantVisualConfig({ showPhone: e.target.checked })} className="rounded text-primary-600 border-slate-200" />
                                            <span>Helpline number</span>
                                          </label>
                                          <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                                            <input type="checkbox" checked={visualConfig.showWhatsapp} onChange={e => updateTenantVisualConfig({ showWhatsapp: e.target.checked })} className="rounded text-primary-600 border-slate-200" />
                                            <span>WhatsApp Desk</span>
                                          </label>
                                        </div>
                                      </div>

                                      {/* Sections cards list */}
                                      <div className="space-y-3">
                                        <label className="block text-[10px] font-bold text-slate-600 uppercase">Document Layout Sections</label>
                                        
                                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                          {visualConfig.sections.map((sec, idx) => (
                                            <div key={sec.id} className="border border-slate-100 bg-slate-50/50 p-3 rounded-xl flex flex-col gap-2 shadow-sm relative group hover:border-slate-200">
                                              <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-bold text-primary-600 uppercase tracking-wide">
                                                  {sec.type === 'custom_text' ? 'Text block' : 'Table: ' + sec.type}
                                                </span>
                                                <div className="flex items-center gap-1">
                                                  <button type="button" disabled={idx === 0} onClick={() => moveTenantSection(idx, 'up')} className="p-1 hover:bg-white border border-transparent hover:border-slate-200 rounded-md transition-all text-slate-500 disabled:opacity-30">
                                                    <ArrowUp className="w-3.5 h-3.5" />
                                                  </button>
                                                  <button type="button" disabled={idx === visualConfig.sections.length - 1} onClick={() => moveTenantSection(idx, 'down')} className="p-1 hover:bg-white border border-transparent hover:border-slate-200 rounded-md transition-all text-slate-500 disabled:opacity-30">
                                                    <ArrowDown className="w-3.5 h-3.5" />
                                                  </button>
                                                  <button type="button" onClick={() => removeTenantSection(sec.id)} className="p-1 hover:bg-red-50 text-red-500 border border-transparent hover:border-red-200 rounded-md transition-all">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                  </button>
                                                </div>
                                              </div>

                                              <div className="space-y-2">
                                                <input
                                                  type="text"
                                                  value={sec.title}
                                                  onChange={e => updateTenantSectionTitle(sec.id, e.target.value)}
                                                  placeholder="Section Title"
                                                  className="w-full bg-white px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-primary-500 focus:outline-none"
                                                />
                                                {sec.type === 'custom_text' && (
                                                  <textarea
                                                    value={sec.body || ''}
                                                    onChange={e => updateTenantSectionBody(sec.id, e.target.value)}
                                                    placeholder="Write custom notes, payment info, guidelines here..."
                                                    rows={3}
                                                    className="w-full bg-white px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-primary-500 focus:outline-none resize-none"
                                                  />
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>

                                        {/* Block insertion dropdown */}
                                        <div className="flex gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                          <select
                                            id="tenant-add-block-select"
                                            className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none"
                                            defaultValue=""
                                          >
                                            <option value="" disabled>-- Add Block --</option>
                                            <option value="passengers">Passenger Manifest</option>
                                            <option value="flights">Flight Itineraries</option>
                                            <option value="hotels">Hotel stay Details</option>
                                            <option value="transports">Ground Transport details</option>
                                            <option value="visas">Visa Approvals</option>
                                            <option value="specialties">Speciality Services Checklist</option>
                                            <option value="custom_text">Custom Text Box</option>
                                            {tempType === 'INVOICE' && (
                                              <>
                                                <option value="services">Itemized Services Table</option>
                                                <option value="payments">Client Payments Log</option>
                                                <option value="balances">Financial Balance Box</option>
                                              </>
                                            )}
                                          </select>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const el = document.getElementById('tenant-add-block-select') as HTMLSelectElement;
                                              if (el?.value) {
                                                addTenantSection(el.value as any);
                                                el.value = '';
                                              } else {
                                                toast.error('Select a block type first');
                                              }
                                            }}
                                            className="bg-primary-600 hover:bg-primary-500 text-white px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                                          >
                                            <Plus className="w-3.5 h-3.5" /> Insert
                                          </button>
                                        </div>
                                      </div>

                                      {/* Bottom verification switches */}
                                      <div className="bg-slate-50/20 p-4 rounded-xl border border-slate-100 space-y-2 text-xs">
                                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1.5">Footer Seal Elements</label>
                                        <div className="grid grid-cols-2 gap-2">
                                          <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                                            <input type="checkbox" checked={visualConfig.showSignature} onChange={e => updateTenantVisualConfig({ showSignature: e.target.checked })} className="rounded text-primary-600 border-slate-200" />
                                            <span>Signature Seal</span>
                                          </label>
                                          <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                                            <input type="checkbox" checked={visualConfig.showTimestamp} onChange={e => updateTenantVisualConfig({ showTimestamp: e.target.checked })} className="rounded text-primary-600 border-slate-200" />
                                            <span>Secure Timestamp</span>
                                          </label>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-center py-6 text-slate-400 text-xs">
                                      Please switch to Code mode or load a visual template.
                                    </div>
                                  )
                                )}
                              </div>

                              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                                <button
                                  type="submit"
                                  disabled={savingTemplate}
                                  className="bg-primary-600 hover:bg-primary-500 text-white px-5 py-2.5 rounded-xl font-semibold shadow-md shadow-primary-500/20 text-xs flex items-center gap-2"
                                >
                                  {savingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                  Save Template
                                </button>
                              </div>
                            </form>
                          </div>
                        </div>

                        {/* Real-time Preview Pane */}
                        <div className="lg:col-span-6 space-y-6">
                          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sticky top-6">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                              <h3 className="font-bold text-slate-900 text-base">Live Preview</h3>
                              {selectedTemplate && (
                                <span className="text-[10px] font-bold text-slate-400 font-mono">
                                  Template ID: {selectedTemplate.id}
                                </span>
                              )}
                            </div>

                            {previewLoading ? (
                              <div className="flex flex-col items-center justify-center py-32 text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                <RefreshCw className="w-8 h-8 animate-spin text-primary-600 mb-2" />
                                Generating real-time layout compilation...
                              </div>
                            ) : previewHtml ? (
                              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-slate-100/50 p-4">
                                <iframe
                                  srcDoc={`
                                    <!DOCTYPE html>
                                    <html>
                                      <head>
                                        <style>
                                          body { margin: 0; padding: 0; background: transparent; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
                                          ${tempCss}
                                        </style>
                                      </head>
                                      <body>
                                        ${previewHtml}
                                      </body>
                                    </html>
                                  `}
                                  title="Layout Preview"
                                  className="w-full min-h-[500px] border-0 bg-white rounded-xl shadow-inner"
                                />
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center py-32 text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                <FileText className="w-12 h-12 text-slate-300 mb-3" />
                                No layout compilation generated. Create a new design or edit one to compile.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center text-slate-500">
                  <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                  <p className="font-semibold text-lg text-slate-700">No Company Selected</p>
                  <p className="text-sm mt-1 max-w-md mx-auto">Please choose an enterprise tenant from the dropdown selection at the top to access and customize their document layout templates.</p>
                </div>
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
              className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-2xl p-5 relative z-10 overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between mb-3 border-b border-slate-100 pb-3 flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-primary-50 text-primary-600 rounded-lg">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Add New Company</h3>
                    <p className="text-slate-500 text-[10px] mt-0.5">Register a brand new enterprise tenant in the SaaS system.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {submitError && (
                <div className="bg-red-50 text-red-600 p-2.5 rounded-lg text-xs mb-3 flex items-center gap-1.5 flex-shrink-0">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Tab Switcher */}
              <div className="flex border border-slate-100 bg-slate-50/50 p-1 rounded-xl mb-4 shrink-0">
                {(['general', 'admin', 'subscription'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setCreateModalTab(tab)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold capitalize tracking-wide transition-all ${
                      createModalTab === tab
                        ? 'bg-white text-primary-600 shadow-xs border border-slate-200/40'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tab === 'general' ? 'General' : tab === 'admin' ? 'Initial Admin' : 'Subscription'}
                  </button>
                ))}
              </div>

              {/* Modal Body */}
              <form onSubmit={handleCreateCompany} className="flex flex-col flex-1 min-h-0">
                <div className="space-y-4 overflow-y-auto pr-0.5 flex-1 min-h-[280px] max-h-[450px]">
                  
                  {/* TAB 1: GENERAL INFO */}
                  {createModalTab === 'general' && (
                    <div className="space-y-3">
                      {/* Logo Upload Box */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Company Logo</label>
                        <div className="flex items-center gap-3">
                          {newCompanyLogo ? (
                            <div className="relative group">
                              <img 
                                src={newCompanyLogo} 
                                alt="Uploaded Logo" 
                                className="w-12 h-12 rounded-lg object-contain border border-slate-200 bg-slate-50 p-1"
                              />
                              <button 
                                type="button"
                                onClick={() => setNewCompanyLogo('')}
                                className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 shadow-md transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <label className="w-12 h-12 rounded-lg border-2 border-dashed border-slate-300 hover:border-primary-500 flex flex-col items-center justify-center cursor-pointer bg-slate-50 hover:bg-primary-50/20 transition-all">
                              {logoUploading ? (
                                <RefreshCw className="w-4 h-4 animate-spin text-primary-500" />
                              ) : (
                                <>
                                  <Upload className="w-4 h-4 text-slate-400" />
                                  <span className="text-[8px] text-slate-400 mt-0.5 font-bold">Upload</span>
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
                          <div className="text-[10px] text-slate-400 leading-tight">
                            Upload PNG or JPG company logo. Media is hosted on the local MinIO storage.
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Company Name *</label>
                          <input 
                            type="text" 
                            required 
                            value={newCompanyName}
                            onChange={e => setNewCompanyName(e.target.value)}
                            placeholder="Acme Corp" 
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs transition-all font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Workspace Domain *</label>
                          <input 
                            type="text" 
                            required
                            value={newCompanyDomain}
                            onChange={e => setNewCompanyDomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                            placeholder="acme" 
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs transition-all font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Industry</label>
                          <div className="relative">
                            <Briefcase className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                            <input 
                              type="text" 
                              value={newCompanyIndustry}
                              onChange={e => setNewCompanyIndustry(e.target.value)}
                              placeholder="e.g. Technology" 
                              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs transition-all font-semibold"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Location</label>
                          <div className="relative">
                            <MapPin className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                            <input 
                              type="text" 
                              value={newCompanyLocation}
                              onChange={e => setNewCompanyLocation(e.target.value)}
                              placeholder="e.g. London, UK" 
                              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs transition-all font-semibold"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Default Currency *</label>
                          <select 
                            value={newCompanyCurrency}
                            onChange={e => setNewCompanyCurrency(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs transition-all font-semibold bg-white text-slate-800"
                          >
                            <option value="GBP">GBP (£)</option>
                            <option value="EUR">EUR (€)</option>
                            <option value="PKR">PKR (Rs)</option>
                            <option value="USD">USD ($)</option>
                            <option value="AED">AED (AED)</option>
                            <option value="MYR">MYR (RM)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: INITIAL ADMIN */}
                  {createModalTab === 'admin' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Contact Email</label>
                          <div className="relative">
                            <Mail className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                            <input 
                              type="email" 
                              value={newCompanyEmail}
                              onChange={e => setNewCompanyEmail(e.target.value)}
                              placeholder="admin@acme.com" 
                              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs transition-all font-mono"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Contact Phone</label>
                          <div className="relative">
                            <Phone className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                            <input 
                              type="tel" 
                              value={newCompanyPhone}
                              onChange={e => setNewCompanyPhone(e.target.value)}
                              placeholder="+1 (555) 019-2834" 
                              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs transition-all font-semibold"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Company Description</label>
                        <textarea 
                          rows={2}
                          value={newCompanyDescription}
                          onChange={e => setNewCompanyDescription(e.target.value)}
                          placeholder="Short description of the company profile..." 
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs transition-all font-medium h-16 resize-none"
                        />
                      </div>

                      <div className="bg-primary-50/40 p-3.5 rounded-xl border border-primary-100/50 space-y-2.5">
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-primary-700">Initial Workspace Administrator</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Admin Email *</label>
                            <input 
                              type="email" 
                              required={createModalTab === 'admin'}
                              value={newAdminEmail}
                              onChange={e => setNewAdminEmail(e.target.value)}
                              placeholder="admin@domain.com"
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs transition-all font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Admin Password *</label>
                            <input 
                              type="password" 
                              required={createModalTab === 'admin'}
                              value={newAdminPassword}
                              onChange={e => setNewAdminPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs transition-all"
                            />
                          </div>
                        </div>
                        <p className="text-[9px] text-slate-400 leading-normal">These credentials allow the first admin to sign in and set up team workspace.</p>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: SUBSCRIPTION & PLAN */}
                  {createModalTab === 'subscription' && (
                    <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Subscription Configuration</h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-1">Select Access Plan</label>
                          <select 
                            value={newCompanyPlan}
                            onChange={e => setNewCompanyPlan(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs font-semibold"
                          >
                            <option value="trial">Free Trial Access</option>
                            <option value="active">Standard Active Access</option>
                            <option value="lifetime">Lifetime Unlimited Access</option>
                          </select>
                        </div>

                        {newCompanyPlan === 'trial' && (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-1">Trial Period (Days)</label>
                            <input 
                              type="number" 
                              min={0}
                              value={newCompanyTrialDays}
                              onChange={e => setNewCompanyTrialDays(parseInt(e.target.value) || 0)}
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs font-mono"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Actions */}
                <div className="flex gap-2 justify-end pt-3 border-t border-slate-100 flex-shrink-0 mt-3">
                  <button 
                    type="button" 
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-xs font-bold text-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting || logoUploading}
                    className="bg-primary-600 hover:bg-primary-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-md shadow-primary-500/10 active:scale-95 transition-all flex items-center gap-1.5"
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
              className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-2xl p-5 relative z-10 overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between mb-3 border-b border-slate-100 pb-3 flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-slate-100 text-slate-700 rounded-lg border border-slate-200">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Manage: {editingTenant.name}</h3>
                    <p className="text-slate-500 text-[10px] mt-0.5">Manage details, plans, and subscription settings for this workspace.</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingTenant(null);
                  }}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {editError && (
                <div className="bg-red-50 text-red-600 p-2.5 rounded-lg text-xs mb-3 flex items-center gap-1.5 flex-shrink-0">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Tab Switcher */}
              <div className="flex border border-slate-100 bg-slate-50/50 p-1 rounded-xl mb-4 shrink-0">
                {(['general', 'contact', 'subscription', 'admin'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setEditModalTab(tab)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold capitalize tracking-wide transition-all ${
                      editModalTab === tab
                        ? 'bg-white text-primary-600 shadow-xs border border-slate-200/40'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tab === 'general' ? 'General' : tab === 'contact' ? 'Contact' : tab === 'subscription' ? 'Subscription' : 'Admin User'}
                  </button>
                ))}
              </div>

              {/* Modal Body */}
              <form onSubmit={handleUpdateCompany} className="flex flex-col flex-1 min-h-0">
                <div className="space-y-4 overflow-y-auto pr-0.5 flex-1 min-h-[260px] max-h-[450px]">
                  
                  {/* TAB 1: GENERAL */}
                  {editModalTab === 'general' && (
                    <div className="space-y-3">
                      {/* Logo Upload */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Company Logo</label>
                        <div className="flex items-center gap-3">
                          {editLogo ? (
                            <div className="relative group">
                              <img 
                                src={editLogo} 
                                alt="Uploaded Logo" 
                                className="w-12 h-12 rounded-lg object-contain border border-slate-200 bg-slate-50 p-1"
                              />
                              <button 
                                type="button"
                                onClick={() => setEditLogo('')}
                                className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 shadow-md transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <label className="w-12 h-12 rounded-lg border-2 border-dashed border-slate-300 hover:border-primary-500 flex flex-col items-center justify-center cursor-pointer bg-slate-50 hover:bg-primary-50/20 transition-all">
                              {logoUploading ? (
                                <RefreshCw className="w-4 h-4 animate-spin text-primary-500" />
                              ) : (
                                <>
                                  <Upload className="w-4 h-4 text-slate-400" />
                                  <span className="text-[8px] text-slate-400 mt-0.5 font-bold">Upload</span>
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
                          <div className="text-[10px] text-slate-400 leading-tight">
                            Change PNG or JPG logo. Media is hosted on the local MinIO storage.
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Company Name *</label>
                          <input 
                            type="text" 
                            required 
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs transition-all font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Workspace Domain *</label>
                          <input 
                            type="text" 
                            required
                            value={editDomain}
                            onChange={e => setEditDomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs transition-all font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Industry</label>
                          <input 
                            type="text" 
                            value={editIndustry}
                            onChange={e => setEditIndustry(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs transition-all font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Location</label>
                          <input 
                            type="text" 
                            value={editLocation}
                            onChange={e => setEditLocation(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs transition-all font-semibold"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Default Currency *</label>
                          <select 
                            value={editCurrency}
                            onChange={e => setEditCurrency(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs transition-all font-semibold bg-white text-slate-800"
                          >
                            <option value="GBP">GBP (£)</option>
                            <option value="EUR">EUR (€)</option>
                            <option value="PKR">PKR (Rs)</option>
                            <option value="USD">USD ($)</option>
                            <option value="AED">AED (AED)</option>
                            <option value="MYR">MYR (RM)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: CONTACT */}
                  {editModalTab === 'contact' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Contact Email</label>
                          <input 
                            type="email" 
                            value={editEmail}
                            onChange={e => setEditEmail(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs transition-all font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Contact Phone</label>
                          <input 
                            type="tel" 
                            value={editPhone}
                            onChange={e => setEditPhone(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs transition-all font-semibold"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Company Description</label>
                        <textarea 
                          rows={2}
                          value={editDescription}
                          onChange={e => setEditDescription(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs transition-all font-medium h-24 resize-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* TAB 3: SUBSCRIPTION */}
                  {editModalTab === 'subscription' && (
                    <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Subscription Status & Plan</h4>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-1">Access Plan</label>
                          <select 
                            value={editPlan}
                            onChange={e => setEditPlan(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs font-semibold"
                          >
                            <option value="trial">Free Trial Access</option>
                            <option value="active">Standard Active Access</option>
                            <option value="lifetime">Lifetime Unlimited Access</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-1">Account Workspace Status</label>
                          <select 
                            value={editStatus}
                            onChange={e => setEditStatus(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs font-semibold"
                          >
                            <option value="active">Active (Access Allowed)</option>
                            <option value="suspended">Suspended (Access Blocked)</option>
                          </select>
                        </div>
                      </div>

                      {editPlan === 'trial' && (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-1">Trial Expiration Date</label>
                          <div className="relative">
                            <Calendar className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                            <input 
                              type="date" 
                              value={editTrialEndsAt}
                              onChange={e => setEditTrialEndsAt(e.target.value)}
                              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs font-mono"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 4: ADMIN USER */}
                  {editModalTab === 'admin' && (
                    <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Company Administrator Account</h4>
                      
                      {fetchingAdmin ? (
                        <div className="flex flex-col items-center justify-center py-6 gap-2">
                          <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
                          <span className="text-[10px] text-slate-400 font-bold">Loading administrator details...</span>
                        </div>
                      ) : adminUser ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-1">Administrator Email (Logged-in User)</label>
                            <input
                              type="text"
                              readOnly
                              value={adminUser.email}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-500 text-xs font-mono select-all focus:outline-none"
                            />
                          </div>
                          
                          <div className="pt-2 border-t border-slate-200">
                            <label className="block text-[10px] font-bold text-slate-600 mb-1">Reset Password</label>
                            <div className="flex gap-2">
                              <input
                                type="password"
                                placeholder="Enter new password"
                                value={resetPassword}
                                onChange={e => setResetPassword(e.target.value)}
                                className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs font-mono"
                              />
                              <button
                                type="button"
                                disabled={isResettingPassword || !resetPassword}
                                onClick={handleResetAdminPassword}
                                className="bg-slate-800 hover:bg-slate-700 disabled:bg-slate-200 text-white disabled:text-slate-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-1 shrink-0"
                              >
                                {isResettingPassword ? 'Resetting...' : 'Reset'}
                              </button>
                            </div>
                            <p className="text-[9px] text-slate-400 mt-1">
                              Password resets take effect immediately. Minimum 6 characters required.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-amber-50 text-amber-800 p-3 rounded-lg text-xs border border-amber-100 flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block">No Administrator Account Found</span>
                            <span className="text-[10px]">No MAIN_COMPANY_ADMIN or COMPANY_ADMIN user was identified for this company.</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Edit Actions */}
                <div className="flex gap-2 justify-end pt-3 border-t border-slate-100 flex-shrink-0 mt-3">
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsEditModalOpen(false);
                      setEditingTenant(null);
                    }}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-xs font-bold text-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isUpdating || logoUploading}
                    className="bg-primary-600 hover:bg-primary-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-md shadow-primary-500/10 active:scale-95 transition-all flex items-center gap-1.5"
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
