const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const vendorPayments = await prisma.vendorPayment.findMany({ include: { booking: true } });
  let count = 0;
  for (const payment of vendorPayments) {
    // Check if it already has a ledger transaction with this reference and date
    const existing = await prisma.ledgerTransaction.findFirst({
      where: {
        referenceNumber: payment.booking.bookingReference,
        transactionDate: payment.paidOn,
        type: 'PAYMENT',
        description: { contains: 'Vendor Payment' }
      }
    });
    if (existing) continue;

    let vendorAccount = await prisma.ledgerAccount.findFirst({
      where: { tenantId: payment.tenantId, accountType: 'VENDOR_PAYABLE', entityName: payment.vendorName }
    });
    if (!vendorAccount) {
      vendorAccount = await prisma.ledgerAccount.create({
        data: { tenantId: payment.tenantId, accountType: 'VENDOR_PAYABLE', entityName: payment.vendorName }
      });
    }

    const mainTx = await prisma.ledgerTransaction.create({
      data: {
        tenantId: payment.tenantId,
        transactionDate: payment.paidOn,
        referenceNumber: payment.booking.bookingReference,
        description: `Vendor Payment via Cash/Transfer to ${payment.vendorName}. ${payment.notes || ''}`,
        type: 'PAYMENT'
      }
    });

    await prisma.ledgerEntry.create({
      data: {
        transactionId: mainTx.id,
        accountId: vendorAccount.id,
        debitAmount: payment.amount,
        creditAmount: 0
      }
    });

    await prisma.ledgerAccount.update({
      where: { id: vendorAccount.id },
      data: { balance: { decrement: payment.amount } }
    });
    count++;
  }
  console.log(`Synced ${count} historical VENDOR payments to ledger.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
