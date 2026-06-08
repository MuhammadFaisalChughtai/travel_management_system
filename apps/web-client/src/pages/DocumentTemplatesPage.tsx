import { useState, useEffect } from 'react';
import { api } from '../api/axios';
import toast from 'react-hot-toast';
import { 
  Layout, Settings, Code, Eye, RefreshCw, Save, Plus, AlertCircle, 
  Globe, Building2, Mail, Phone, ShieldCheck, PlusCircle, Upload, X, Loader2,
  Palette, Check, ArrowUp, ArrowDown, Trash2
} from 'lucide-react';

interface Template {
  id: number;
  name: string;
  type: string;
  version: number;
  status: string;
  structureHtml: string;
  structureCss: string;
  updatedAt: string;
}

const DEFAULT_HTML_TEMPLATE = `<div class="invoice-box" style="font-family: 'Inter', system-ui, sans-serif; max-width: 800px; margin: auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 16px; background: #fff; color: #334155;">
  <!-- Header: Branding & Metadata -->
  <div style="display: flex; justify-content: space-between; align-items: start; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 24px;">
    <div>
      <div style="margin-bottom: 8px;">{{company.logoPrimary}}</div>
      <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #0f172a;">{{company.name}}</h2>
      <p style="margin: 4px 0 0; font-size: 11px; color: #64748b;">{{company.address}}</p>
      <p style="margin: 2px 0 0; font-size: 11px; color: #64748b;">Email: {{company.email}} | Tel: {{company.phone}}</p>
    </div>
    <div style="text-align: right;">
      <h1 style="margin: 0 0 10px; font-size: 28px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px; text-transform: uppercase;">Invoice / Receipt</h1>
      <p style="margin: 2px 0; font-size: 12px; font-weight: bold; color: #475569;">Booking Ref: <span style="font-family: monospace; font-size: 13px; color: #6366f1;">{{booking.reference}}</span></p>
      <p style="margin: 2px 0; font-size: 11px; color: #64748b;">Document Date: {{booking.date}}</p>
      <p style="margin: 2px 0; font-size: 11px; color: #64748b;">Agent Broker: {{booking.agent}}</p>
    </div>
  </div>

  <!-- Relational Passenger Manifest Block -->
  <div style="margin-bottom: 24px;">
    <h3 style="margin: 0 0 8px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Relational Manifest Block (Passengers)</h3>
    {{tables.passengers}}
  </div>

  <!-- Flight Itinerary Leg Array -->
  <div style="margin-bottom: 24px;">
    <h3 style="margin: 0 0 8px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Flight Segment Array</h3>
    {{tables.flights}}
  </div>

  <!-- Services & Adjustments Table -->
  <div style="margin-bottom: 24px;">
    <h3 style="margin: 0 0 8px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Calculated Ledger Entries</h3>
    {{tables.services}}
  </div>

  <!-- Financial Variance Settlement Summary -->
  <div style="display: flex; justify-content: flex-end; margin-bottom: 32px;">
    <div style="width: 250px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; color: #64748b;">
        <span>Total Gross Value:</span>
        <span style="font-weight: 700; color: #334155;">£{{booking.amountGross}}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
        <span>Confirmed Paid:</span>
        <span style="font-weight: 700; color: #10b981;">£{{booking.amountSettled}}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 800; color: #0f172a; pt-1;">
        <span>Balance Due:</span>
        <span style="color: #6366f1;">£{{booking.amountDue}}</span>
      </div>
    </div>
  </div>

  <!-- Legal provisions & Regulatory fine print -->
  <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 12px 16px; margin-bottom: 30px; font-size: 10px; color: #78350f; line-height: 1.5;">
    <h4 style="margin: 0 0 4px; font-weight: 800; text-transform: uppercase; font-size: 10px; color: #b45309;">Legal Terms, Conditions & Regulatory Disclaimers</h4>
    <p style="margin: 0 0 6px;"><strong>General Booking:</strong> Balances must be settled prior to departure. Tickets are non-refundable/non-transferable once generated.</p>
    <p style="margin: 0;"><strong>Destination Specific Rules (Visa/Umrah/Hajj):</strong> Clients travelling under specialized visa frameworks agree to all dynamic health screening regulations, border entry restrictions, and regulatory authority guidelines. No package changes allowed post visa validation.</p>
  </div>

  <!-- Footer Signature & Multi-Channel Address -->
  <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; display: flex; justify-content: space-between; align-items: end; font-size: 10px; color: #94a3b8;">
    <div>
      <p style="margin: 2px 0;"><strong>Digital Signature Hash:</strong></p>
      <p style="margin: 2px 0; font-family: monospace; font-size: 9px; color: #64748b; word-break: break-all; max-width: 320px;">{{document.signature}}</p>
      <p style="margin: 2px 0;">Generated context secure signature timeline: {{document.timestamp}}</p>
    </div>
    <div style="text-align: right;">
      <p style="margin: 2px 0; color: #64748b;"><strong>{{company.name}} Support Channels</strong></p>
      <p style="margin: 2px 0;">Office: {{company.address}}</p>
      <p style="margin: 2px 0;">WhatsApp Chat: {{company.whatsapp}}</p>
    </div>
  </div>
</div>`;

const DEFAULT_CSS_TEMPLATE = `/* Invoice Styling Rules */
.invoice-box {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
}
@media print {
  body {
    background: #fff !important;
  }
  .invoice-box {
    box-shadow: none !important;
    border: none !important;
    padding: 0 !important;
  }
}`;

const SERVICE_BLUEPRINTS = [
  {
    id: 'flight_voucher',
    name: 'Flight Operational Voucher Blueprint',
    type: 'VOUCHER',
    description: 'Renders complete itinerary operational details, dual PNRs, baggage rules, guest manifest, and support contact chains. Completely pricing-free.',
    css: `.voucher-box { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05); }`,
    html: `<div class="voucher-box" style="font-family: 'Inter', system-ui, sans-serif; max-width: 800px; margin: auto; padding: 30px; border: 1px solid #cbd5e1; border-radius: 16px; background: #fff; color: #334155;">
  <div style="display: flex; justify-content: space-between; align-items: start; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px;">
    <div>
      <div style="margin-bottom: 8px;">{{company.logoPrimary}}</div>
      <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #0f172a;">{{company.name}}</h2>
      <p style="margin: 4px 0 0; font-size: 11px; color: #64748b;">{{company.address}}</p>
    </div>
    <div style="text-align: right;">
      <h1 style="margin: 0 0 10px; font-size: 24px; font-weight: 900; color: #3b82f6; text-transform: uppercase;">Flight Voucher</h1>
      <p style="margin: 2px 0; font-size: 12px; font-weight: bold; color: #475569;">Booking Ref: <span style="font-family: monospace; font-size: 13px; color: #3b82f6;">{{booking.reference}}</span></p>
      <p style="margin: 2px 0; font-size: 11px; color: #64748b;">Issue Date: {{booking.date}}</p>
    </div>
  </div>

  <div style="margin-bottom: 24px;">
    <h3 style="margin: 0 0 8px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Traveler Manifest</h3>
    {{tables.passengers}}
  </div>

  <div style="margin-bottom: 24px;">
    <h3 style="margin: 0 0 8px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Flight Itinerary Legs</h3>
    {{tables.flights}}
  </div>

  <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 12px 16px; margin-bottom: 30px; font-size: 10px; color: #0369a1; line-height: 1.5;">
    <h4 style="margin: 0 0 4px; font-weight: 800; text-transform: uppercase; font-size: 10px; color: #0284c7;">Operational Instructions & Dispatch Phone Chains</h4>
    <p style="margin: 0 0 6px;"><strong>Ticketing & PNR Issues:</strong> Please contact our high-volume support line at {{company.phone}} or email {{company.email}} immediately. For airport assistance, reference the PNR codes listed in the table.</p>
    <p style="margin: 0;"><strong>Baggage policy:</strong> Ensure baggage allowances match checked limits. Passengers must arrive at the terminal 3 hours before departure.</p>
  </div>

  <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; display: flex; justify-content: space-between; align-items: end; font-size: 10px; color: #94a3b8;">
    <div>
      <p style="margin: 2px 0;"><strong>Electronic Verification Hash:</strong></p>
      <p style="margin: 2px 0; font-family: monospace; font-size: 9px; color: #64748b; word-break: break-all; max-width: 320px;">{{document.signature}}</p>
    </div>
    <div style="text-align: right;">
      <p style="margin: 2px 0;">WhatsApp Chat Updates: {{company.whatsapp}}</p>
      <p style="margin: 2px 0;">Fulfillment Time: {{document.timestamp}}</p>
    </div>
  </div>
</div>`
  },
  {
    id: 'hotel_voucher',
    name: 'Accommodation Voucher Blueprint',
    type: 'VOUCHER',
    description: 'Renders guest names, hotel confirmation numbers, room counts, check-in schedules, and catering. Completely pricing-free.',
    css: `.voucher-box { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05); }`,
    html: `<div class="voucher-box" style="font-family: 'Inter', system-ui, sans-serif; max-width: 800px; margin: auto; padding: 30px; border: 1px solid #cbd5e1; border-radius: 16px; background: #fff; color: #334155;">
  <div style="display: flex; justify-content: space-between; align-items: start; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px;">
    <div>
      <div style="margin-bottom: 8px;">{{company.logoPrimary}}</div>
      <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #0f172a;">{{company.name}}</h2>
      <p style="margin: 4px 0 0; font-size: 11px; color: #64748b;">{{company.address}}</p>
    </div>
    <div style="text-align: right;">
      <h1 style="margin: 0 0 10px; font-size: 24px; font-weight: 900; color: #10b981; text-transform: uppercase;">Accommodation Voucher</h1>
      <p style="margin: 2px 0; font-size: 12px; font-weight: bold; color: #475569;">Booking Ref: <span style="font-family: monospace; font-size: 13px; color: #10b981;">{{booking.reference}}</span></p>
      <p style="margin: 2px 0; font-size: 11px; color: #64748b;">Issue Date: {{booking.date}}</p>
    </div>
  </div>

  <div style="margin-bottom: 24px;">
    <h3 style="margin: 0 0 8px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Guest Manifest</h3>
    {{tables.passengers}}
  </div>

  <div style="margin-bottom: 24px;">
    <h3 style="margin: 0 0 8px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Hotel Stay Details</h3>
    {{tables.hotels}}
  </div>

  <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 12px 16px; margin-bottom: 30px; font-size: 10px; color: #166534; line-height: 1.5;">
    <h4 style="margin: 0 0 4px; font-weight: 800; text-transform: uppercase; font-size: 10px; color: #15803d;">Check-in / Check-out & Catering Instructions</h4>
    <p style="margin: 0 0 6px;"><strong>Hotel check-in:</strong> Present this voucher alongside passport at check-in. Rooms are guaranteed for occupancy as per booking specifications.</p>
    <p style="margin: 0;"><strong>Support Contacts:</strong> For reservation modifications or emergency logistics support, contact our supplier hotline at {{company.phone}}.</p>
  </div>

  <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; display: flex; justify-content: space-between; align-items: end; font-size: 10px; color: #94a3b8;">
    <div>
      <p style="margin: 2px 0;"><strong>Electronic Verification Hash:</strong></p>
      <p style="margin: 2px 0; font-family: monospace; font-size: 9px; color: #64748b; word-break: break-all; max-width: 320px;">{{document.signature}}</p>
    </div>
    <div style="text-align: right;">
      <p style="margin: 2px 0;">WhatsApp Desk: {{company.whatsapp}}</p>
      <p style="margin: 2px 0;">Fulfillment Time: {{document.timestamp}}</p>
    </div>
  </div>
</div>`
  },
  {
    id: 'transport_voucher',
    name: 'Ground Transport Voucher Blueprint',
    type: 'VOUCHER',
    description: 'Renders shuttle timings, pickup addresses, dropoff terminal gates, vehicle classes, and dispatch phone chains. Completely pricing-free.',
    css: `.voucher-box { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05); }`,
    html: `<div class="voucher-box" style="font-family: 'Inter', system-ui, sans-serif; max-width: 800px; margin: auto; padding: 30px; border: 1px solid #cbd5e1; border-radius: 16px; background: #fff; color: #334155;">
  <div style="display: flex; justify-content: space-between; align-items: start; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px;">
    <div>
      <div style="margin-bottom: 8px;">{{company.logoPrimary}}</div>
      <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #0f172a;">{{company.name}}</h2>
      <p style="margin: 4px 0 0; font-size: 11px; color: #64748b;">{{company.address}}</p>
    </div>
    <div style="text-align: right;">
      <h1 style="margin: 0 0 10px; font-size: 24px; font-weight: 900; color: #6366f1; text-transform: uppercase;">Transport Voucher</h1>
      <p style="margin: 2px 0; font-size: 12px; font-weight: bold; color: #475569;">Booking Ref: <span style="font-family: monospace; font-size: 13px; color: #6366f1;">{{booking.reference}}</span></p>
      <p style="margin: 2px 0; font-size: 11px; color: #64748b;">Issue Date: {{booking.date}}</p>
    </div>
  </div>

  <div style="margin-bottom: 24px;">
    <h3 style="margin: 0 0 8px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Traveler Manifest</h3>
    {{tables.passengers}}
  </div>

  <div style="margin-bottom: 24px;">
    <h3 style="margin: 0 0 8px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Transfer & Shuttle Details</h3>
    {{tables.transports}}
  </div>

  <div style="background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 12px; padding: 12px 16px; margin-bottom: 30px; font-size: 10px; color: #3730a3; line-height: 1.5;">
    <h4 style="margin: 0 0 4px; font-weight: 800; text-transform: uppercase; font-size: 10px; color: #4338ca;">Driver Check-in & Dispatch Logistics</h4>
    <p style="margin: 0 0 6px;"><strong>Pickup Verification:</strong> Please be ready at the designated pickup point 15 minutes prior to departure. The driver will verify traveler names using passenger passports.</p>
    <p style="margin: 0;"><strong>Emergency Dispatch hotline:</strong> In case of delay, contact the logistics hub at {{company.phone}} immediately.</p>
  </div>

  <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; display: flex; justify-content: space-between; align-items: end; font-size: 10px; color: #94a3b8;">
    <div>
      <p style="margin: 2px 0;"><strong>Electronic Verification Hash:</strong></p>
      <p style="margin: 2px 0; font-family: monospace; font-size: 9px; color: #64748b; word-break: break-all; max-width: 320px;">{{document.signature}}</p>
    </div>
    <div style="text-align: right;">
      <p style="margin: 2px 0;">WhatsApp updates: {{company.whatsapp}}</p>
      <p style="margin: 2px 0;">Fulfillment Time: {{document.timestamp}}</p>
    </div>
  </div>
</div>`
  },
  {
    id: 'visa_specialty_voucher',
    name: 'Visa & Entry Voucher Blueprint',
    type: 'VOUCHER',
    description: 'Renders visa approvals, validation windows, passport numbers, and specialty operational requirements. Completely pricing-free.',
    css: `.voucher-box { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05); }`,
    html: `<div class="voucher-box" style="font-family: 'Inter', system-ui, sans-serif; max-width: 800px; margin: auto; padding: 30px; border: 1px solid #cbd5e1; border-radius: 16px; background: #fff; color: #334155;">
  <div style="display: flex; justify-content: space-between; align-items: start; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px;">
    <div>
      <div style="margin-bottom: 8px;">{{company.logoPrimary}}</div>
      <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #0f172a;">{{company.name}}</h2>
      <p style="margin: 4px 0 0; font-size: 11px; color: #64748b;">{{company.address}}</p>
    </div>
    <div style="text-align: right;">
      <h1 style="margin: 0 0 10px; font-size: 24px; font-weight: 900; color: #f59e0b; text-transform: uppercase;">Visa & Entry Voucher</h1>
      <p style="margin: 2px 0; font-size: 12px; font-weight: bold; color: #475569;">Booking Ref: <span style="font-family: monospace; font-size: 13px; color: #f59e0b;">{{booking.reference}}</span></p>
      <p style="margin: 2px 0; font-size: 11px; color: #64748b;">Issue Date: {{booking.date}}</p>
    </div>
  </div>

  <div style="margin-bottom: 24px;">
    <h3 style="margin: 0 0 8px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Traveler Passenger List</h3>
    {{tables.passengers}}
  </div>

  <div style="margin-bottom: 24px;">
    <h3 style="margin: 0 0 8px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Visa Approvals</h3>
    {{tables.visas}}
  </div>

  <div style="margin-bottom: 24px;">
    <h3 style="margin: 0 0 8px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Custom Specialty Services</h3>
    {{tables.specialties}}
  </div>

  <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; padding: 12px 16px; margin-bottom: 30px; font-size: 10px; color: #78350f; line-height: 1.5;">
    <h4 style="margin: 0 0 4px; font-weight: 800; text-transform: uppercase; font-size: 10px; color: #b45309;">Visa Controls & Border Entry Checklist</h4>
    <p style="margin: 0 0 6px;"><strong>Regulatory compliance:</strong> Ensure visa categories match travelers' purposes. Carry printed copies of all visa approvals along with certificates of health checks where applicable.</p>
    <p style="margin: 0;"><strong>Border Assistance:</strong> Contact visa operations at {{company.phone}} or email {{company.email}} in case of regulatory delays.</p>
  </div>

  <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; display: flex; justify-content: space-between; align-items: end; font-size: 10px; color: #94a3b8;">
    <div>
      <p style="margin: 2px 0;"><strong>Electronic Verification Hash:</strong></p>
      <p style="margin: 2px 0; font-family: monospace; font-size: 9px; color: #64748b; word-break: break-all; max-width: 320px;">{{document.signature}}</p>
    </div>
    <div style="text-align: right;">
      <p style="margin: 2px 0;">WhatsApp Support channel: {{company.whatsapp}}</p>
      <p style="margin: 2px 0;">Fulfillment Time: {{document.timestamp}}</p>
    </div>
  </div>
</div>`
  }
];

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
        <span style="font-weight: 700; color: #334155;">£{{booking.amountGross}}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; color: #64748b; border-bottom: 1px solid ${primaryColor}15; padding-bottom: 8px;">
        <span>Confirmed Paid:</span>
        <span style="font-weight: 700; color: #10b981;">£{{booking.amountSettled}}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 800; color: #0f172a; padding-top: 4px;">
        <span>Balance Due:</span>
        <span style="color: ${primaryColor}; font-weight: 900;">£{{booking.amountDue}}</span>
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

  // Footer Signature & Multi-Channel Address
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
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#25d366" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
        WhatsApp Support Desk
      </p>
      <p style="margin: 2px 0; font-size: 9px; font-family: monospace; color: #64748b;">{{company.whatsapp}}</p>`;
    }

    html += `
    </div>
  </div>`;
  }

  html += `\n</div>`;

  // Build CSS
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

export function DocumentTemplatesPage() {
  const [activeTab, setActiveTab] = useState<'studio' | 'catalog' | 'profile'>('studio');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(false);

  // Visual/Code mode states
  const [editMode, setEditMode] = useState<'visual' | 'code'>('visual');
  const [visualConfig, setVisualConfig] = useState<VisualConfig | null>(null);

  // Studio States
  const [tempName, setTempName] = useState('');
  const [tempType, setTempType] = useState('INVOICE');
  const [tempStatus, setTempStatus] = useState('Draft');
  const [tempHtml, setTempHtml] = useState(DEFAULT_HTML_TEMPLATE);
  const [tempCss, setTempCss] = useState(DEFAULT_CSS_TEMPLATE);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  // Profile States
  const [profile, setProfile] = useState({
    companyName: 'Tooba Travels Ltd',
    logoPrimary: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=120',
    logoSecondary: '',
    officeAddress: 'Registered Office: 123 Travel Tower, London, UK',
    emailSender: 'operations@toobatravels.co.uk',
    landlineFormat: '+44 20 7946 0958',
    whatsappWebhook: 'https://api.whatsapp.com/send?phone=442079460958'
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [uploadingPrimary, setUploadingPrimary] = useState(false);
  const [uploadingSecondary, setUploadingSecondary] = useState(false);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'primary' | 'secondary') => {
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
        setProfile(prev => ({ ...prev, logoPrimary: res.data.url }));
        toast.success('Primary logo uploaded successfully');
      } else {
        setProfile(prev => ({ ...prev, logoSecondary: res.data.url }));
        toast.success('Secondary logo uploaded successfully');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to upload logo');
    } finally {
      if (type === 'primary') setUploadingPrimary(false);
      else setUploadingSecondary(false);
    }
  };



  // Variable Guide tokens with flags for structural isolation
  const tokensGuide = [
    { token: '{{company.name}}', desc: 'Active company name from profile', isFinancial: false, isVoucherOnly: false },
    { token: '{{company.logoPrimary}}', desc: 'Primary branding logo element', isFinancial: false, isVoucherOnly: false },
    { token: '{{company.logoSecondary}}', desc: 'Secondary branding element', isFinancial: false, isVoucherOnly: false },
    { token: '{{company.address}}', desc: 'Registered office location', isFinancial: false, isVoucherOnly: false },
    { token: '{{company.email}}', desc: 'Corporate support pipeline', isFinancial: false, isVoucherOnly: false },
    { token: '{{company.phone}}', desc: 'Central hotline phone format', isFinancial: false, isVoucherOnly: false },
    { token: '{{company.whatsapp}}', desc: 'WhatsApp API webhook link', isFinancial: false, isVoucherOnly: false },
    { token: '{{booking.reference}}', desc: 'Unique transaction identifier', isFinancial: false, isVoucherOnly: false },
    { token: '{{booking.date}}', desc: 'Booking creation timestamp', isFinancial: false, isVoucherOnly: false },
    { token: '{{booking.agent}}', desc: 'Assigned broker name', isFinancial: false, isVoucherOnly: false },
    { token: '{{booking.amountGross}}', desc: 'Gross liability sum (Invoice only)', isFinancial: true, isVoucherOnly: false },
    { token: '{{booking.amountSettled}}', desc: 'Verified settled payments (Invoice only)', isFinancial: true, isVoucherOnly: false },
    { token: '{{booking.amountDue}}', desc: 'Outstanding liability balance (Invoice only)', isFinancial: true, isVoucherOnly: false },
    { token: '{{tables.passengers}}', desc: 'Tabular passenger manifest', isFinancial: false, isVoucherOnly: false },
    { token: '{{tables.flights}}', desc: 'Tabular flight legs', isFinancial: false, isVoucherOnly: false },
    { token: '{{tables.hotels}}', desc: 'Tabular hotel stay records (Voucher only)', isFinancial: false, isVoucherOnly: true },
    { token: '{{tables.transports}}', desc: 'Tabular transport pickup details (Voucher only)', isFinancial: false, isVoucherOnly: true },
    { token: '{{tables.visas}}', desc: 'Tabular visa approvals (Voucher only)', isFinancial: false, isVoucherOnly: true },
    { token: '{{tables.specialties}}', desc: 'Tabular custom specialty services (Voucher only)', isFinancial: false, isVoucherOnly: true },
    { token: '{{tables.payments}}', desc: 'Tabular payment receipt ledger (Invoice only)', isFinancial: true, isVoucherOnly: false },
    { token: '{{tables.services}}', desc: 'Tabular invoices items overview (Invoice only)', isFinancial: true, isVoucherOnly: false },
    { token: '{{document.signature}}', desc: 'Verification cryptographic hash', isFinancial: false, isVoucherOnly: false },
    { token: '{{document.timestamp}}', desc: 'Timeline generation', isFinancial: false, isVoucherOnly: false },
  ];

  // Helper to insert token at text area cursor
  const insertToken = (token: string) => {
    setTempHtml(prev => prev + '\n' + token);
    toast.success(`Inserted token: ${token}`);
  };

  // Filtered tokens based on template type
  const filteredTokens = tokensGuide.filter(t => {
    if (tempType === 'VOUCHER') {
      return !t.isFinancial;
    } else {
      return !t.isVoucherOnly;
    }
  });

  // Fetch templates & profile context on load
  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await api.get('/finance/templates');
      setTemplates(res.data.templates || []);
      if (res.data.templates?.length > 0 && !selectedTemplate) {
        handleSelectTemplate(res.data.templates[0]);
      }
    } catch (err) {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async () => {
    try {
      setProfileLoading(true);

      // 1. Fetch official company details from active tenant profile
      let tenantDetails = {
        name: 'Tooba Travels Ltd',
        logo: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=120',
        location: 'Registered Office: 123 Travel Tower, London, UK',
        email: 'operations@toobatravels.co.uk',
        phone: '+44 20 7946 0958'
      };

      try {
        const tenantRes = await api.get('/auth/tenants/profile');
        if (tenantRes.data.tenant) {
          const t = tenantRes.data.tenant;
          tenantDetails = {
            name: t.name || tenantDetails.name,
            logo: t.logo || tenantDetails.logo,
            location: t.location || tenantDetails.location,
            email: t.email || tenantDetails.email,
            phone: t.phone || tenantDetails.phone
          };
        }
      } catch (err) {
        console.error('Failed to fetch auth tenant profile:', err);
      }

      // 2. Fetch the template-studio specific context
      const res = await api.get('/finance/company-context');
      if (res.data.companyContext) {
        const ctx = res.data.companyContext;
        setProfile({
          companyName: ctx.companyName || tenantDetails.name,
          logoPrimary: ctx.logoPrimary || tenantDetails.logo,
          logoSecondary: ctx.logoSecondary || '',
          officeAddress: ctx.officeAddress || tenantDetails.location,
          emailSender: ctx.emailSender || tenantDetails.email,
          landlineFormat: ctx.landlineFormat || tenantDetails.phone,
          whatsappWebhook: ctx.whatsappWebhook || `https://api.whatsapp.com/send?phone=${(ctx.landlineFormat || tenantDetails.phone).replace(/[^0-9+]/g, '')}`
        });
      } else {
        // Fallback to active tenant info directly
        setProfile({
          companyName: tenantDetails.name,
          logoPrimary: tenantDetails.logo,
          logoSecondary: '',
          officeAddress: tenantDetails.location,
          emailSender: tenantDetails.email,
          landlineFormat: tenantDetails.phone,
          whatsappWebhook: `https://api.whatsapp.com/send?phone=${tenantDetails.phone.replace(/[^0-9+]/g, '')}`
        });
      }
    } catch (err) {
      toast.error('Failed to load company context');
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchProfile();
  }, []);

  const handleSelectTemplate = (t: Template) => {
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
    
    triggerPreview(t.id);
  };

  const triggerPreview = async (templateId: number) => {
    try {
      setPreviewLoading(true);
      const res = await api.get(`/finance/templates/${templateId}/preview`);
      setPreviewHtml(res.data.previewHtml || '');
    } catch (err) {
      console.error(err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const updateVisualConfig = (updates: Partial<VisualConfig>) => {
    if (!visualConfig) return;
    const newConfig = { ...visualConfig, ...updates };
    setVisualConfig(newConfig);
    const generated = generateTemplateFromVisualConfig(newConfig, tempType);
    setTempHtml(generated.html + `\n<!-- VISUAL_CONFIG: ${JSON.stringify(newConfig)} -->`);
    setTempCss(generated.css);
  };

  const addSection = (type: VisualSection['type']) => {
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

    updateVisualConfig({
      sections: [...visualConfig.sections, newSection]
    });
    toast.success('Added new section: ' + defaultTitle);
  };

  const removeSection = (id: string) => {
    if (!visualConfig) return;
    const target = visualConfig.sections.find(s => s.id === id);
    if (!target) return;
    updateVisualConfig({
      sections: visualConfig.sections.filter(s => s.id !== id)
    });
    toast.success('Removed section: ' + target.title);
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    if (!visualConfig) return;
    const newSections = [...visualConfig.sections];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newSections.length) return;
    
    // Swap
    const temp = newSections[index];
    newSections[index] = newSections[targetIndex];
    newSections[targetIndex] = temp;
    
    updateVisualConfig({ sections: newSections });
  };

  const updateSectionTitle = (id: string, title: string) => {
    if (!visualConfig) return;
    updateVisualConfig({
      sections: visualConfig.sections.map(s => s.id === id ? { ...s, title } : s)
    });
  };

  const updateSectionBody = (id: string, body: string) => {
    if (!visualConfig) return;
    updateVisualConfig({
      sections: visualConfig.sections.map(s => s.id === id ? { ...s, body } : s)
    });
  };

  const handleCreateNewClick = () => {
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

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempName) {
      toast.error('Template Name is required');
      return;
    }

    // Client-side validation: enforce Voucher structural isolation
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

    try {
      setLoading(true);
      if (selectedTemplate) {
        // Update template
        await api.put(`/finance/templates/${selectedTemplate.id}`, {
          name: tempName,
          status: tempStatus,
          structureHtml: tempHtml,
          structureCss: tempCss
        });
        toast.success('Template updated successfully');
      } else {
        // Create template
        const res = await api.post('/finance/templates', {
          name: tempName,
          type: tempType,
          status: tempStatus,
          structureHtml: tempHtml,
          structureCss: tempCss
        });
        toast.success('Template created successfully');
        handleSelectTemplate(res.data.template);
      }
      fetchTemplates();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setProfileLoading(true);
      await api.put('/finance/company-context', profile);
      toast.success('Company Profile Context updated');
      fetchProfile();
    } catch (err) {
      toast.error('Failed to update profile settings');
    } finally {
      setProfileLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Layout className="w-6 h-6 text-primary-600" /> Invoicing & Voucher Studio
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Configure enterprise-level templates, dynamic variable substitution tags, and company profile branding contexts.
          </p>
        </div>
        
        {/* Workspace Tab selector */}
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/40 text-[10px] font-bold shadow-sm">
          <button 
            onClick={() => setActiveTab('studio')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all duration-200 ${
              activeTab === 'studio' 
                ? 'bg-white text-primary-700 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Code className="w-3.5 h-3.5" /> Template Design Studio
          </button>
          <button 
            onClick={() => setActiveTab('catalog')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all duration-200 ${
              activeTab === 'catalog' 
                ? 'bg-white text-primary-700 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layout className="w-3.5 h-3.5" /> Service Blueprint Catalog
          </button>
          <button 
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all duration-200 ${
              activeTab === 'profile' 
                ? 'bg-white text-primary-700 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Settings className="w-3.5 h-3.5" /> Active Company Profile Context
          </button>
        </div>
      </div>

      {activeTab === 'studio' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* Left Panel: Selector & Editor */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* List selector */}
            <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-sm space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wide">Template Layout Matrix</span>
                <button 
                  onClick={handleCreateNewClick}
                  className="flex items-center gap-1 bg-primary-50 text-primary-700 hover:bg-primary-100 px-3 py-1 rounded-xl text-[10px] font-bold transition-all"
                >
                  <Plus className="w-3 h-3" /> Create Template
                </button>
              </div>

              {loading && templates.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 font-bold flex items-center justify-center gap-1.5">
                  <RefreshCw className="w-4 h-4 animate-spin text-primary-500" /> Loading templates...
                </div>
              ) : templates.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 font-medium">No templates created. Click Create Template to start.</div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleSelectTemplate(t)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all text-xs flex justify-between items-center ${
                        selectedTemplate?.id === t.id
                          ? 'bg-primary-50 border-primary-200/50 shadow-xs'
                          : 'bg-slate-50/50 border-slate-100 hover:bg-slate-50'
                      }`}
                    >
                      <div className="space-y-0.5 truncate">
                        <div className="font-extrabold text-slate-700 truncate">{t.name}</div>
                        <div className="text-[9px] text-slate-400 font-bold tracking-wide uppercase">{t.type} • v{t.version}</div>
                      </div>
                      <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        t.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {t.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Editor Box */}
            <form onSubmit={handleSaveTemplate} className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-50 pb-2.5">
                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wide">
                  {selectedTemplate ? `Edit Template v${selectedTemplate.version}` : 'Design New Template'}
                </span>
                <span className="text-[9px] text-slate-400 font-mono font-medium">Standardized Token Syntax Engine</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wide mb-1">Template Name</label>
                  <input 
                    type="text"
                    required
                    value={tempName}
                    onChange={e => setTempName(e.target.value)}
                    placeholder="e.g. Executive Invoice Layout"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-700 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wide mb-1">Status flag</label>
                  <select
                    value={tempStatus}
                    onChange={e => setTempStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-700 outline-none focus:border-primary-500"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Active">Active</option>
                    <option value="Deprecated">Deprecated</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wide mb-1">Template Type</label>
                  <select
                    value={tempType}
                    disabled={!!selectedTemplate}
                    onChange={e => {
                      const newType = e.target.value;
                      setTempType(newType);
                      if (editMode === 'visual') {
                        const newConfig = defaultVisualConfig(newType);
                        setVisualConfig(newConfig);
                        const generated = generateTemplateFromVisualConfig(newConfig, newType);
                        setTempHtml(generated.html + `\n<!-- VISUAL_CONFIG: ${JSON.stringify(newConfig)} -->`);
                        setTempCss(generated.css);
                      } else {
                        if (newType === 'VOUCHER') {
                          setTempHtml(bp => bp === DEFAULT_HTML_TEMPLATE ? SERVICE_BLUEPRINTS[0].html : bp);
                        } else {
                          setTempHtml(DEFAULT_HTML_TEMPLATE);
                        }
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-700 outline-none focus:border-primary-500 disabled:opacity-60 font-sans"
                  >
                    <option value="INVOICE">INVOICE</option>
                    <option value="VOUCHER">VOUCHER</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedTemplate) triggerPreview(selectedTemplate.id);
                    }}
                    className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 px-3.5 py-2 rounded-xl text-[10px] font-extrabold transition-all flex items-center justify-center gap-1 font-sans"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh Preview
                  </button>
                </div>
              </div>

              {/* Edit Mode Switcher */}
              <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-[10px] font-bold shadow-xs">
                <button 
                  type="button"
                  onClick={() => {
                    if (!visualConfig) {
                      const newConfig = defaultVisualConfig(tempType);
                      setVisualConfig(newConfig);
                      const generated = generateTemplateFromVisualConfig(newConfig, tempType);
                      setTempHtml(generated.html + `\n<!-- VISUAL_CONFIG: ${JSON.stringify(newConfig)} -->`);
                      setTempCss(generated.css);
                    }
                    setEditMode('visual');
                  }}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg transition-all ${
                    editMode === 'visual' 
                      ? 'bg-white text-primary-700 shadow-xs font-black' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Palette className="w-3.5 h-3.5" /> Visual Builder
                </button>
                <button 
                  type="button"
                  onClick={() => setEditMode('code')}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg transition-all ${
                    editMode === 'code' 
                      ? 'bg-white text-primary-700 shadow-xs font-black' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Code className="w-3.5 h-3.5" /> Code Editor
                </button>
              </div>

              {/* Specific Service Selector Tags for HTML token insertion */}
              {editMode === 'visual' && visualConfig ? (
                <div className="space-y-4 text-xs font-semibold text-slate-600">
                  {/* Theme Presets */}
                  <div className="space-y-2 border-b border-slate-100 pb-3">
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wide block">Design Preset Styles</span>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Theme Color</label>
                        <div className="flex gap-2 items-center">
                          {[
                            { name: 'indigo', color: '#4f46e5' },
                            { name: 'blue', color: '#2563eb' },
                            { name: 'emerald', color: '#059669' },
                            { name: 'slate', color: '#475569' },
                            { name: 'amber', color: '#d97706' }
                          ].map(t => (
                            <button
                              key={t.name}
                              type="button"
                              onClick={() => updateVisualConfig({ themeColor: t.name })}
                              className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${
                                visualConfig.themeColor === t.name 
                                  ? 'border-slate-800 ring-2 ring-primary-500/20 scale-110' 
                                  : 'border-slate-200 hover:scale-105'
                              }`}
                              style={{ backgroundColor: t.color }}
                            >
                              {visualConfig.themeColor === t.name && <Check className="w-3 h-3 text-white" />}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Font Family</label>
                        <select
                          value={visualConfig.fontFamily}
                          onChange={e => updateVisualConfig({ fontFamily: e.target.value })}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-[10px] text-slate-700 outline-none focus:border-primary-500 bg-white"
                        >
                          <option value="Inter">Inter (Clean Modern)</option>
                          <option value="Roboto">Roboto (Crisp Technical)</option>
                          <option value="Outfit">Outfit (Premium Rounded)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Document Title and Header toggles */}
                  <div className="space-y-3 border-b border-slate-100 pb-3">
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wide block">Header Configuration</span>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Document Title Display</label>
                      <input 
                        type="text"
                        value={visualConfig.title}
                        onChange={e => updateVisualConfig({ title: e.target.value })}
                        placeholder="e.g. Service Voucher"
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-[10px] text-slate-700 outline-none focus:border-primary-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg border border-slate-100 transition-colors">
                        <input 
                          type="checkbox" 
                          checked={visualConfig.showLogoPrimary} 
                          onChange={e => updateVisualConfig({ showLogoPrimary: e.target.checked })}
                          className="rounded text-primary-600 focus:ring-primary-500"
                        />
                        <span>Show Primary Logo</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg border border-slate-100 transition-colors">
                        <input 
                          type="checkbox" 
                          checked={visualConfig.showLogoSecondary} 
                          onChange={e => updateVisualConfig({ showLogoSecondary: e.target.checked })}
                          className="rounded text-primary-600 focus:ring-primary-500"
                        />
                        <span>Show Secondary Logo</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg border border-slate-100 transition-colors">
                        <input 
                          type="checkbox" 
                          checked={visualConfig.showAddress} 
                          onChange={e => updateVisualConfig({ showAddress: e.target.checked })}
                          className="rounded text-primary-600 focus:ring-primary-500"
                        />
                        <span>Show Registered Address</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg border border-slate-100 transition-colors">
                        <input 
                          type="checkbox" 
                          checked={visualConfig.showEmail} 
                          onChange={e => updateVisualConfig({ showEmail: e.target.checked })}
                          className="rounded text-primary-600 focus:ring-primary-500"
                        />
                        <span>Show Corporate Email</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg border border-slate-100 transition-colors">
                        <input 
                          type="checkbox" 
                          checked={visualConfig.showPhone} 
                          onChange={e => updateVisualConfig({ showPhone: e.target.checked })}
                          className="rounded text-primary-600 focus:ring-primary-500"
                        />
                        <span>Show Hotline Landline</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg border border-slate-100 transition-colors">
                        <input 
                          type="checkbox" 
                          checked={visualConfig.showWhatsapp} 
                          onChange={e => updateVisualConfig({ showWhatsapp: e.target.checked })}
                          className="rounded text-primary-600 focus:ring-primary-500"
                        />
                        <span>Show WhatsApp Contact</span>
                      </label>
                    </div>
                  </div>

                  {/* Dynamic Sections layout manager */}
                  <div className="space-y-4 border-b border-slate-100 pb-4">
                    <div className="flex justify-between items-center pb-1 border-b border-slate-100/50">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide">Document Layout Sections</span>
                      <span className="text-[9px] text-slate-400 font-semibold">Rearrange, Rename, or Delete sections</span>
                    </div>

                    {/* Section Cards List */}
                    {visualConfig.sections && visualConfig.sections.length > 0 ? (
                      <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                        {visualConfig.sections.map((sec, idx) => {
                          let blockTypeName = '';
                          switch (sec.type) {
                            case 'passengers': blockTypeName = 'Passenger Manifest List'; break;
                            case 'flights': blockTypeName = 'Flight Details Table'; break;
                            case 'hotels': blockTypeName = 'Hotel Stay Details Table'; break;
                            case 'transports': blockTypeName = 'Ground Transport Table'; break;
                            case 'visas': blockTypeName = 'Visa Approvals Table'; break;
                            case 'specialties': blockTypeName = 'Specialty Services Table'; break;
                            case 'services': blockTypeName = 'Price Breakdown Table'; break;
                            case 'payments': blockTypeName = 'Payments Receipt Table'; break;
                            case 'balances': blockTypeName = 'Total Balance Due Box'; break;
                            case 'custom_text': blockTypeName = 'Custom Text Box'; break;
                          }

                          const isFirst = idx === 0;
                          const isLast = idx === visualConfig.sections.length - 1;

                          return (
                            <div key={sec.id} className="bg-slate-50/60 border border-slate-200/50 rounded-xl p-3 space-y-2 relative shadow-xs hover:border-slate-300 transition-colors">
                              <div className="flex justify-between items-center">
                                <span className="text-[9px] font-extrabold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                  {blockTypeName}
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    disabled={isFirst}
                                    onClick={() => moveSection(idx, 'up')}
                                    title="Move Section Up"
                                    className="p-1 rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-30 transition-all"
                                  >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isLast}
                                    onClick={() => moveSection(idx, 'down')}
                                    title="Move Section Down"
                                    className="p-1 rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-30 transition-all"
                                  >
                                    <ArrowDown className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeSection(sec.id)}
                                    title="Delete Section"
                                    className="p-1 rounded-md text-red-400 hover:bg-red-50 hover:text-red-600 transition-all"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Title Editor */}
                              <div>
                                <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Section Title</label>
                                <input 
                                  type="text"
                                  value={sec.title}
                                  onChange={e => updateSectionTitle(sec.id, e.target.value)}
                                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-700 outline-none focus:border-primary-500 bg-white"
                                  placeholder="e.g. Terms & Conditions"
                                />
                              </div>

                              {/* Custom Text Area */}
                              {sec.type === 'custom_text' && (
                                <div>
                                  <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Text Box Content</label>
                                  <textarea
                                    rows={3}
                                    value={sec.body || ''}
                                    onChange={e => updateSectionBody(sec.id, e.target.value)}
                                    className="w-full p-2 border border-slate-200 rounded-lg text-[10px] text-slate-600 outline-none focus:border-primary-500 bg-white font-sans"
                                    placeholder="Type your notes or document text here..."
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-4 text-center text-slate-400 text-[10px] font-bold bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        No sections inside layout. Add one below!
                      </div>
                    )}

                    {/* Add Section Widget */}
                    <div className="bg-slate-50/50 border border-dashed border-slate-200 rounded-xl p-3 space-y-2">
                      <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wide">Add a New Section / Table</label>
                      <div className="flex gap-2">
                        <select
                          id="new-section-select"
                          className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-700 outline-none bg-white focus:border-primary-500"
                        >
                          <option value="passengers">Passenger Details Table</option>
                          <option value="custom_text">Custom Text / Notes Box</option>
                          {tempType === 'VOUCHER' ? (
                            <>
                              <option value="flights">Flight Details Table</option>
                              <option value="hotels">Hotel Stay Details Table</option>
                              <option value="transports">Ground Transport Details Table</option>
                              <option value="visas">Visa Approvals Table</option>
                              <option value="specialties">Specialty Services Checklist Table</option>
                            </>
                          ) : (
                            <>
                              <option value="services">Itemized Prices Table</option>
                              <option value="payments">Client Payments History Table</option>
                              <option value="balances">Overall Balances Box</option>
                            </>
                          )}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const selectEl = document.getElementById('new-section-select') as HTMLSelectElement | null;
                            if (selectEl) {
                              addSection(selectEl.value as any);
                            }
                          }}
                          className="bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-all flex items-center gap-1 shrink-0 active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Block
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Footer Security features */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wide block">Footer security & stamp</span>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg border border-slate-100 transition-colors">
                        <input 
                          type="checkbox" 
                          checked={visualConfig.showSignature} 
                          onChange={e => updateVisualConfig({ showSignature: e.target.checked })}
                          className="rounded text-primary-600 focus:ring-primary-500"
                        />
                        <span>Show Electronic verification seal</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg border border-slate-100 transition-colors">
                        <input 
                          type="checkbox" 
                          checked={visualConfig.showTimestamp} 
                          onChange={e => updateVisualConfig({ showTimestamp: e.target.checked })}
                          className="rounded text-primary-600 focus:ring-primary-500"
                        />
                        <span>Show Generation timeline</span>
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* HTML / CSS Raw Code Editor */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wide">Structure HTML code</label>
                      {tempType === 'VOUCHER' && (
                        <div className="flex items-center gap-1">
                          <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-wider">Insert:</span>
                          <button type="button" onClick={() => insertToken('{{tables.flights}}')} className="bg-slate-100 hover:bg-slate-200 text-primary-600 px-1.5 py-0.5 rounded text-[8px] font-extrabold transition-colors">Flight</button>
                          <button type="button" onClick={() => insertToken('{{tables.hotels}}')} className="bg-slate-100 hover:bg-slate-200 text-primary-600 px-1.5 py-0.5 rounded text-[8px] font-extrabold transition-colors">Hotel</button>
                          <button type="button" onClick={() => insertToken('{{tables.transports}}')} className="bg-slate-100 hover:bg-slate-200 text-primary-600 px-1.5 py-0.5 rounded text-[8px] font-extrabold transition-colors">Transport</button>
                          <button type="button" onClick={() => insertToken('{{tables.visas}}')} className="bg-slate-100 hover:bg-slate-200 text-primary-600 px-1.5 py-0.5 rounded text-[8px] font-extrabold transition-colors">Visa</button>
                          <button type="button" onClick={() => insertToken('{{tables.specialties}}')} className="bg-slate-100 hover:bg-slate-200 text-primary-600 px-1.5 py-0.5 rounded text-[8px] font-extrabold transition-colors">Specialty</button>
                        </div>
                      )}
                    </div>
                    <textarea
                      rows={10}
                      value={tempHtml}
                      onChange={e => setTempHtml(e.target.value)}
                      className="w-full p-3 border border-slate-200 rounded-2xl text-[10px] font-mono text-slate-700 outline-none focus:border-primary-500 bg-slate-50/50"
                      placeholder="<div>{{company.name}}...</div>"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wide mb-1">Layout CSS stylesheet</label>
                    <textarea
                      rows={4}
                      value={tempCss}
                      onChange={e => setTempCss(e.target.value)}
                      className="w-full p-3 border border-slate-200 rounded-2xl text-[10px] font-mono text-slate-700 outline-none focus:border-primary-500 bg-slate-50/50"
                      placeholder=".invoice-box { ... }"
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-primary-500/25 flex items-center justify-center gap-1.5 active:scale-[0.98] font-sans"
              >
                <Save className="w-4 h-4" /> {selectedTemplate ? 'Save Template Changes' : 'Write Template to Storage'}
              </button>
            </form>

            {/* Variable Tokens Guide */}
            {editMode === 'code' && (
              <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-sm space-y-2.5">
                <div className="flex justify-between items-center border-b border-slate-50 pb-1">
                  <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wide block">Dynamic Variables Framework</span>
                  <span className="text-[8px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold uppercase">
                    {tempType === 'VOUCHER' ? 'Voucher Filters Enabled' : 'All Fields Available'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] max-h-36 overflow-y-auto pr-1">
                  {filteredTokens.map((t, i) => (
                    <div key={i} className="bg-slate-50/60 p-2 rounded-xl border border-slate-100">
                      <span className="font-mono font-extrabold text-indigo-600 block">{t.token}</span>
                      <span className="text-[9px] text-slate-500 font-semibold mt-0.5 block leading-tight">{t.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Right Panel: Sandbox preview frame */}
          <div className="lg:col-span-7 bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4 flex flex-col h-[760px]">
            <div className="flex justify-between items-center border-b border-slate-50 pb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 leading-tight">Sandbox Isolated responsive frame</h3>
                  <span className="text-[9px] text-emerald-600 font-extrabold block">✓ Dynamic substitutions compiled</span>
                </div>
              </div>
              
              {previewLoading && (
                <span className="text-[10px] text-slate-400 flex items-center gap-1.5 font-bold">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary-500" /> Re-compiling preview...
                </span>
              )}
            </div>

            {/* iframe sandbox view */}
            <div className="flex-1 bg-slate-50 rounded-2xl overflow-hidden border border-slate-200/50 shadow-inner relative flex flex-col">
              <iframe
                title="Template Preview"
                className="w-full h-full border-none flex-grow bg-white"
                sandbox="allow-scripts"
                srcDoc={`
                  <!DOCTYPE html>
                  <html>
                    <head>
                      <meta charset="utf-8">
                      <style>${tempCss}</style>
                      <script src="https://cdn.tailwindcss.com"></script>
                    </head>
                    <body class="bg-slate-50 p-4">
                      ${previewHtml || tempHtml}
                    </body>
                  </html>
                `}
              />
            </div>
            
            <div className="text-[9px] text-slate-400 flex items-center gap-1 border-t border-slate-50 pt-2 font-medium">
              <AlertCircle className="w-3.5 h-3.5 text-slate-400" /> HTML preview is fully sandboxed. Printing/saving as PDF utilizes client-side layout rendering triggers.
            </div>
          </div>

        </div>
      )}

      {activeTab === 'catalog' && (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-800">Service Blueprint Catalog</h2>
            <p className="text-slate-500 text-xs mt-0.5">Spin up brand-consistent operational layouts for new corporate service offerings instantly without editing source code.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {SERVICE_BLUEPRINTS.map((bp) => (
              <div key={bp.id} className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4 hover:shadow-md transition-all flex flex-col justify-between">
                <div className="space-y-2">
                  <span className="text-[9px] font-extrabold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full uppercase tracking-wider">{bp.type}</span>
                  <h3 className="text-sm font-black text-slate-800">{bp.name}</h3>
                  <p className="text-slate-500 text-xs leading-relaxed">{bp.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTemplate(null);
                    setTempName(bp.name);
                    setTempType(bp.type);
                    setTempStatus('Draft');
                    setTempHtml(bp.html);
                    setTempCss(bp.css);
                    setPreviewHtml('');
                    setActiveTab('studio');
                    toast.success(`Blueprint loaded! Review and save to storage.`);
                  }}
                  className="w-full mt-4 bg-primary-50 hover:bg-primary-100 text-primary-700 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
                >
                  <PlusCircle className="w-4 h-4" /> Spin Up Blueprint Layout
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
          <form onSubmit={handleSaveProfile} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="border-b border-slate-50 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-800">Operational baseline values & corporate branding</h2>
                <p className="text-slate-400 text-[10px] font-semibold mt-0.5 uppercase tracking-wider">Configure variables injected dynamically into templates</p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    setProfileLoading(true);
                    const tenantRes = await api.get('/auth/tenants/profile');
                    if (tenantRes.data.tenant) {
                      const t = tenantRes.data.tenant;
                      setProfile(prev => ({
                        ...prev,
                        companyName: t.name || prev.companyName,
                        logoPrimary: t.logo || prev.logoPrimary,
                        officeAddress: t.location || prev.officeAddress,
                        emailSender: t.email || prev.emailSender,
                        landlineFormat: t.phone || prev.landlineFormat,
                        whatsappWebhook: t.phone ? `https://api.whatsapp.com/send?phone=${t.phone.replace(/[^0-9+]/g, '')}` : prev.whatsappWebhook
                      }));
                      toast.success('Successfully synced details from your Company Settings!');
                    } else {
                      toast.error('No company profile found to sync.');
                    }
                  } catch (err) {
                    toast.error('Failed to sync company settings.');
                  } finally {
                    setProfileLoading(false);
                  }
                }}
                className="flex items-center gap-1.5 bg-primary-50 text-primary-700 hover:bg-primary-100 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Auto-Fetch from Company Settings
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">Company Name *</label>
                <div className="relative">
                  <Building2 className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={profile.companyName}
                    onChange={e => setProfile({ ...profile, companyName: e.target.value })}
                    placeholder="e.g. Tooba Travels Ltd"
                    className="w-full pl-9 pr-3.5 py-2.5 border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-700 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">System Email pipeline *</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={profile.emailSender}
                    onChange={e => setProfile({ ...profile, emailSender: e.target.value })}
                    placeholder="e.g. operations@toobatravels.co.uk"
                    className="w-full pl-9 pr-3.5 py-2.5 border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-700 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">Primary Logo (Upload)</label>
                {profile.logoPrimary ? (
                  <div className="flex items-center justify-between p-2.5 border border-slate-200 rounded-xl bg-slate-50/50">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-white border border-slate-100 flex items-center justify-center shrink-0 shadow-xs">
                        <img src={profile.logoPrimary} alt="Primary Logo" className="max-h-full max-w-full object-contain" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold text-slate-700 block truncate">Primary Logo Active</span>
                        <a href={profile.logoPrimary} target="_blank" rel="noreferrer" className="text-[9px] text-primary-600 hover:underline font-semibold block">View Original</a>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setProfile({ ...profile, logoPrimary: '' })}
                      className="p-1 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative border-2 border-dashed border-slate-200 hover:border-primary-400 rounded-xl p-3.5 transition-colors bg-slate-50/30 flex flex-col items-center justify-center text-center cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => handleLogoUpload(e, 'primary')}
                      disabled={uploadingPrimary}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    {uploadingPrimary ? (
                      <div className="flex flex-col items-center gap-1">
                        <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Uploading...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-slate-400">
                        <Upload className="w-4 h-4 text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-600 block">Click to upload Primary Logo</span>
                        <span className="text-[8px] text-slate-400 block">PNG, JPEG up to 10MB</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">Secondary Logo (Upload)</label>
                {profile.logoSecondary ? (
                  <div className="flex items-center justify-between p-2.5 border border-slate-200 rounded-xl bg-slate-50/50">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-white border border-slate-100 flex items-center justify-center shrink-0 shadow-xs">
                        <img src={profile.logoSecondary} alt="Secondary Logo" className="max-h-full max-w-full object-contain" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold text-slate-700 block truncate">Secondary Logo Active</span>
                        <a href={profile.logoSecondary} target="_blank" rel="noreferrer" className="text-[9px] text-primary-600 hover:underline font-semibold block">View Original</a>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setProfile({ ...profile, logoSecondary: '' })}
                      className="p-1 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative border-2 border-dashed border-slate-200 hover:border-primary-400 rounded-xl p-3.5 transition-colors bg-slate-50/30 flex flex-col items-center justify-center text-center cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => handleLogoUpload(e, 'secondary')}
                      disabled={uploadingSecondary}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    {uploadingSecondary ? (
                      <div className="flex flex-col items-center gap-1">
                        <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Uploading...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-slate-400">
                        <Upload className="w-4 h-4 text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-600 block">Click to upload Secondary Logo</span>
                        <span className="text-[8px] text-slate-400 block">PNG, JPEG up to 10MB</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">Hotline landline *</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={profile.landlineFormat}
                    onChange={e => setProfile({ ...profile, landlineFormat: e.target.value })}
                    placeholder="+44 20 7946 0958"
                    className="w-full pl-9 pr-3.5 py-2.5 border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-700 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">WhatsApp Webhook URL</label>
                <div className="relative">
                  <Globe className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="url"
                    value={profile.whatsappWebhook || ''}
                    onChange={e => setProfile({ ...profile, whatsappWebhook: e.target.value })}
                    placeholder="e.g. https://api.whatsapp.com/..."
                    className="w-full pl-9 pr-3.5 py-2.5 border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-700 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20 font-mono text-[10px]"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">Registered Office Address</label>
              <textarea
                rows={3}
                value={profile.officeAddress || ''}
                onChange={e => setProfile({ ...profile, officeAddress: e.target.value })}
                placeholder="Registered Office: 123 Travel Tower, London, UK"
                className="w-full p-3 border border-slate-200 rounded-2xl text-[11px] font-semibold text-slate-700 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={profileLoading}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/25 flex items-center justify-center gap-1.5 active:scale-[0.98]"
            >
              {profileLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Saving Context Details...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Apply Context & Branding Rules
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
