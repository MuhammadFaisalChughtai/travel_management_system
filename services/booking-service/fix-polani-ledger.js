const { PrismaClient } = require('@prisma/client-booking');
const prisma = new PrismaClient();

async function run() {
  try {
    console.log("Starting ledger correction for Polani Travels LTD...");

    // 1. Update the existing transaction 5 to be £2,000
    await prisma.ledgerEntry.update({
      where: { id: 5 },
      data: { debitAmount: 2000 }
    });

    await prisma.ledgerTransaction.update({
      where: { id: 5 },
      data: {
        description: "Bulk payment to vendor Polani Travels LTD. Allocated to 2 service(s) on booking(s): TOSD8U-001, TO8SZA-002",
        referenceNumber: "TOSD8U-001, TO8SZA-002"
      }
    });

    // 2. Create the new £200 overpayment transaction
    const overpaymentTx = await prisma.ledgerTransaction.create({
      data: {
        tenantId: 1,
        transactionDate: new Date("2026-06-03"),
        description: "Overpayment hold for future use (Vendor Wallet credit) for Polani Travels LTD",
        type: "PAYMENT",
        referenceNumber: "TOSD8U-001, TO8SZA-002"
      }
    });

    await prisma.ledgerEntry.create({
      data: {
        transactionId: overpaymentTx.id,
        accountId: 2,
        debitAmount: 200,
        creditAmount: 0
      }
    });

    // 3. Update Polani Travels LTD ledger account balance to -200
    await prisma.ledgerAccount.update({
      where: { id: 2 },
      data: { balance: -200 }
    });

    console.log("Ledger correction completed successfully!");
  } catch (err) {
    console.error("Failed to correct ledger:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
