const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.bookingPayment.count();
  const vp = await prisma.vendorPayment.count();
  const acc = await prisma.ledgerAccount.count();
  const txn = await prisma.ledgerTransaction.count();
  
  console.log('Total Booking Payments:', p);
  console.log('Total Vendor Payments:', vp);
  console.log('Total Ledger Accounts:', acc);
  console.log('Total Ledger Transactions:', txn);
}
main().catch(console.error).finally(() => prisma.$disconnect());
