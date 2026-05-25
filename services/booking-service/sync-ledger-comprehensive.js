const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getOrCreateCustomerAccount(tenantId, customerName) {
  let acc = await prisma.ledgerAccount.findFirst({
    where: { tenantId, accountType: 'CUSTOMER_RECEIVABLE', entityName: customerName }
  });
  if (!acc) {
    acc = await prisma.ledgerAccount.create({
      data: { tenantId, accountType: 'CUSTOMER_RECEIVABLE', entityName: customerName }
    });
  }
  return acc;
}

async function getOrCreateVendorAccount(tenantId, vendorName) {
  let acc = await prisma.ledgerAccount.findFirst({
    where: { tenantId, accountType: 'VENDOR_PAYABLE', entityName: vendorName }
  });
  if (!acc) {
    acc = await prisma.ledgerAccount.create({
      data: { tenantId, accountType: 'VENDOR_PAYABLE', entityName: vendorName }
    });
  }
  return acc;
}

async function main() {
  let countFees = 0, countDiscounts = 0, countRefunds = 0, countVendors = 0;

  // 1. Credit Card Fees from BookingPayments
  const payments = await prisma.bookingPayment.findMany({ include: { booking: true } });
  for (const p of payments) {
    if (p.notes && p.notes.includes('Credit Card Charge: £')) {
      const match = p.notes.match(/Credit Card Charge: £([\d.]+)/);
      if (match) {
        const fee = parseFloat(match[1]);
        const existing = await prisma.ledgerTransaction.findFirst({
          where: { referenceNumber: p.booking.bookingReference, type: 'FEE', transactionDate: p.paidOn }
        });
        if (!existing) {
          const acc = await getOrCreateCustomerAccount(p.tenantId, p.booking.agentName || 'Direct Client');
          const tx = await prisma.ledgerTransaction.create({
            data: {
              tenantId: p.tenantId,
              transactionDate: p.paidOn,
              referenceNumber: p.booking.bookingReference,
              description: 'Credit Card Processing Fee',
              type: 'FEE'
            }
          });
          await prisma.ledgerEntry.create({
            data: { transactionId: tx.id, accountId: acc.id, debitAmount: fee, creditAmount: 0 }
          });
          await prisma.ledgerAccount.update({
            where: { id: acc.id },
            data: { balance: { increment: fee } }
          });
          countFees++;
        }
      }
    }
  }

  // 2. Vendor Payments
  const vendorPayments = await prisma.vendorPayment.findMany({ include: { booking: true } });
  for (const vp of vendorPayments) {
    const existing = await prisma.ledgerTransaction.findFirst({
      where: { referenceNumber: vp.booking.bookingReference, type: 'PAYMENT', description: { contains: vp.vendorName } }
    });
    if (!existing) {
      const acc = await getOrCreateVendorAccount(vp.tenantId, vp.vendorName);
      const tx = await prisma.ledgerTransaction.create({
        data: {
          tenantId: vp.tenantId,
          transactionDate: vp.paidOn || new Date(),
          referenceNumber: vp.booking.bookingReference,
          description: `Vendor Payment to ${vp.vendorName}. ${vp.notes || ''}`,
          type: 'PAYMENT'
        }
      });
      await prisma.ledgerEntry.create({
        data: { transactionId: tx.id, accountId: acc.id, debitAmount: vp.amount, creditAmount: 0 }
      });
      await prisma.ledgerAccount.update({
        where: { id: acc.id },
        data: { balance: { decrement: vp.amount } }
      });
      countVendors++;
    }
  }

  // 3. Booking Discounts
  const discounts = await prisma.bookingDiscount.findMany({ include: { booking: true } });
  for (const d of discounts) {
    const existing = await prisma.ledgerTransaction.findFirst({
      where: { referenceNumber: d.booking.bookingReference, type: 'DISCOUNT', transactionDate: d.date }
    });
    if (!existing) {
      const acc = await getOrCreateCustomerAccount(d.tenantId, d.booking.agentName || 'Direct Client');
      const tx = await prisma.ledgerTransaction.create({
        data: {
          tenantId: d.tenantId,
          transactionDate: d.date,
          referenceNumber: d.booking.bookingReference,
          description: `Discount applied to ${d.vendorCategory} - ${d.serviceName || ''}. ${d.notes || ''}`,
          type: 'DISCOUNT'
        }
      });
      await prisma.ledgerEntry.create({
        data: { transactionId: tx.id, accountId: acc.id, debitAmount: 0, creditAmount: d.amount }
      });
      await prisma.ledgerAccount.update({
        where: { id: acc.id },
        data: { balance: { decrement: d.amount } }
      });
      countDiscounts++;
    }
  }

  // 4. Booking Refunds
  const refunds = await prisma.bookingRefund.findMany({ include: { booking: true } });
  for (const r of refunds) {
    const existing = await prisma.ledgerTransaction.findFirst({
      where: { referenceNumber: r.booking.bookingReference, type: 'REFUND', transactionDate: r.date }
    });
    if (!existing) {
      const tx = await prisma.ledgerTransaction.create({
        data: {
          tenantId: r.tenantId,
          transactionDate: r.date,
          referenceNumber: r.booking.bookingReference,
          description: `${r.direction} for ${r.vendorCategory} - ${r.serviceName || ''}. ${r.notes || ''}`,
          type: 'REFUND'
        }
      });
      
      if (r.direction === 'Refund to Client') {
        const acc = await getOrCreateCustomerAccount(r.tenantId, r.booking.agentName || 'Direct Client');
        await prisma.ledgerEntry.create({
          data: { transactionId: tx.id, accountId: acc.id, debitAmount: r.amount, creditAmount: 0 }
        });
        await prisma.ledgerAccount.update({
          where: { id: acc.id },
          data: { balance: { increment: r.amount } }
        });
      } else {
        const acc = await getOrCreateVendorAccount(r.tenantId, r.vendorCategory);
        await prisma.ledgerEntry.create({
          data: { transactionId: tx.id, accountId: acc.id, debitAmount: 0, creditAmount: r.amount }
        });
        await prisma.ledgerAccount.update({
          where: { id: acc.id },
          data: { balance: { increment: r.amount } }
        });
      }
      countRefunds++;
    }
  }

  console.log(`Synced ${countFees} CC fees, ${countVendors} vendor payments, ${countDiscounts} discounts, ${countRefunds} refunds.`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
