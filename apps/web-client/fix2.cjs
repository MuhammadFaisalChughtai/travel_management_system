const fs = require('fs');
const path = require('path');

const modals = ['AddAccommodationModal.tsx', 'AddFlightModal.tsx', 'AddPassengerModal.tsx', 'AddTransportModal.tsx', 'AddVisaModal.tsx'].map(f => path.join('src/components/booking-modals', f));
const sections = ['FlightServicesSection.tsx', 'PassengersSection.tsx', 'StaysSection.tsx', 'SummaryLedgerSection.tsx', 'TransportServicesSection.tsx', 'VisaServicesSection.tsx'].map(f => path.join('src/components/booking-sections', f));
const root = ['src/components/BookingDetailsModal.tsx'];

[...modals, ...sections].forEach(f => {
  if (!fs.existsSync(f)) return;
  let content = fs.readFileSync(f, 'utf8');
  
  // Fix the import path
  content = content.replace(/from '\.\.\/types\/booking'/g, "from '../../types/booking'");
  
  // Fix onAdd missing in props interface
  if (f.includes('Section.tsx') && !f.includes('SummaryLedger')) {
    if (!content.includes('onAdd?: () => void;')) {
       content = content.replace(/interface ([a-zA-Z]+Props) \{/, "interface $1 {\n  onAdd?: () => void;");
    }
    // Fix onAdd missing in function parameters
    if (!content.includes(', onAdd }')) {
       content = content.replace(/\{ ([a-z]+) \}: ([a-zA-Z]+Props)/i, "{ $1, onAdd }: $2");
    }
  }
  
  fs.writeFileSync(f, content);
});

let bdm = fs.readFileSync('src/components/BookingDetailsModal.tsx', 'utf8');
bdm = bdm.replace(/showAddsetShowAddPassenger/g, "showAddPassenger, setShowAddPassenger");
fs.writeFileSync('src/components/BookingDetailsModal.tsx', bdm);

let addF = fs.readFileSync('src/components/booking-modals/AddFlightModal.tsx', 'utf8');
addF = addF.replace(/setForm\(prev => \(\{/g, "setForm((prev: any) => ({");
fs.writeFileSync('src/components/booking-modals/AddFlightModal.tsx', addF);

console.log("Fixes applied!");
