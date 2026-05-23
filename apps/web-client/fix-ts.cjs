const fs = require('fs');
const path = require('path');

const modals = ['AddAccommodationModal.tsx', 'AddFlightModal.tsx', 'AddPassengerModal.tsx', 'AddTransportModal.tsx', 'AddVisaModal.tsx'].map(f => path.join('src/components/booking-modals', f));
const sections = ['FlightServicesSection.tsx', 'PassengersSection.tsx', 'StaysSection.tsx', 'SummaryLedgerSection.tsx', 'TransportServicesSection.tsx', 'VisaServicesSection.tsx'].map(f => path.join('src/components/booking-sections', f));
const root = ['src/components/BookingDetailsModal.tsx', 'src/components/AccordionSection.tsx'];

const allFiles = [...modals, ...sections, ...root];

allFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  
  // fix verbatimModuleSyntax
  content = content.replace(/import \{ ([^}]+) \} from '(\.\.\/)*types\/booking';/g, "import type { $1 } from '$2types/booking';");
  
  // fix React unused
  content = content.replace(/import React, \{/g, "import {");
  content = content.replace(/import React from 'react';\n/g, "");
  
  // fix specific unused variables
  content = content.replace(/AlertCircle, /g, "");
  content = content.replace(/onAdd:\s*\(\)\s*=>\s*void;/g, "");
  content = content.replace(/, onAdd/g, "");
  content = content.replace(/onAdd\(\)/g, "undefined");
  
  if (file.includes('BookingDetailsModal.tsx')) {
     content = content.replace(/Passenger, /g, "");
     content = content.replace(/FlightService, /g, "");
     content = content.replace(/TransportService, /g, "");
     content = content.replace(/Accommodation, /g, "");
     content = content.replace(/VisaService /g, "");
     content = content.replace(/, onUpdate/g, "");
  }
  
  fs.writeFileSync(file, content);
});

console.log("Fixes applied!");
