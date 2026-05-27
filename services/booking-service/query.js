const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.booking.findFirst({
  where: { bookingReference: 'TR41FR-004' },
  include: { payments: true, vendorPayments: true, refunds: true, flightServices: true, accommodations: true, transportServices: true, visaServices: true }
}).then(b => {
  console.log('TR41FR-004');
  console.dir(b, { depth: null });
  return p.booking.findFirst({
    where: { bookingReference: 'TRSS2R-003' },
    include: { payments: true, vendorPayments: true, refunds: true }
  });
}).then(b => {
  console.log('TRSS2R-003');
  console.dir(b, { depth: null });
}).finally(() => p.$disconnect());
