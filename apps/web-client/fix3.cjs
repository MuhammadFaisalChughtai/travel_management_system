const fs = require('fs');

let addF = fs.readFileSync('src/components/booking-modals/AddFlightModal.tsx', 'utf8');
addF = addF.replace(/value=\{form\.ticketNumber\}/g, "value={form.ticketNumber || ''}");
addF = addF.replace(/, AlertCircle/g, "");
fs.writeFileSync('src/components/booking-modals/AddFlightModal.tsx', addF);

const sections = [
  'FlightServicesSection.tsx', 'PassengersSection.tsx', 'StaysSection.tsx',
  'TransportServicesSection.tsx', 'VisaServicesSection.tsx'
];

sections.forEach(s => {
  let p = 'src/components/booking-sections/' + s;
  let c = fs.readFileSync(p, 'utf8');
  c = c.replace(/onAdd:\s*\(\)\s*=>\s*void;/g, "");
  c = c.replace(/, onAdd \}/g, "}");
  fs.writeFileSync(p, c);
});
