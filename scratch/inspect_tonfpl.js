const path = require('path');
process.env.DATABASE_URL = "postgresql://postgres:password@127.0.0.1:5432/travel_platform?schema=public";
const { PrismaClient } = require(path.resolve(__dirname, '../services/booking-service/node_modules/@prisma/client-booking'));
const prisma = new PrismaClient();

async function inspectBooking() {
  const booking = await prisma.booking.findFirst({
    where: { bookingReference: 'TONFPL-002' },
    include: {
      payments: true,
      flightServices: true,
      hotelServices: true,
      transportServices: true,
      visaServices: true,
    }
  });

  if (!booking) {
    console.log("Booking TONFPL-002 not found");
    return;
  }

  console.log("=== BOOKING ===");
  console.log("ID:", booking.id, "Ref:", booking.bookingReference, "MarginStatus:", booking.marginStatus);
  console.log("\n=== PAYMENTS ===");
  console.log(booking.payments);

  const ledgerTransactions = await prisma.ledgerTransaction.findMany({
    where: { referenceNumber: 'TONFPL-002' },
    include: { entries: true }
  });

  console.log("\n=== LEDGER TRANSACTIONS ===");
  console.log(JSON.stringify(ledgerTransactions, null, 2));

  await prisma.$disconnect();
}

inspectBooking().catch(console.error);
