const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.booking.updateMany({
    where: { bookingReference: 'TR41FR-004' },
    data: { totalPrice: 2000 }
  });
  console.log('Updated TR41FR-004 to 2000');
}
main().catch(console.error).finally(() => prisma.$disconnect());
