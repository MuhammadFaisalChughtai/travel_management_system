import { PrismaClient } from '@prisma/client-booking';

const prisma = new PrismaClient();

async function main() {
  console.log('--- STARTING VENDOR PAYMENTS DATABASE FIX ---');

  // 1. Fetch general vendor account
  const generalVendor = await prisma.ledgerAccount.findFirst({
    where: { accountType: 'VENDOR_PAYABLE', entityName: 'General Vendors' }
  });

  if (!generalVendor) {
    console.error('General Vendors account not found');
    return;
  }

  // 2. Fetch or create Polani Travels LTD account
  let polaniVendor = await prisma.ledgerAccount.findFirst({
    where: { accountType: 'VENDOR_PAYABLE', entityName: 'Polani Travels LTD' }
  });

  if (!polaniVendor) {
    console.log('Polani Travels LTD account not found, creating it...');
    polaniVendor = await prisma.ledgerAccount.create({
      data: {
        tenantId: generalVendor.tenantId,
        accountType: 'VENDOR_PAYABLE',
        entityName: 'Polani Travels LTD',
        balance: 0.00
      }
    });
  }

  console.log(`General Vendors Account ID: ${generalVendor.id}`);
  console.log(`Polani Travels LTD Account ID: ${polaniVendor.id}`);

  // 3. Find ledger entries for General Vendors that mention "Polani" in the transaction description
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      accountId: generalVendor.id,
      transaction: {
        description: {
          contains: 'Polani',
          mode: 'insensitive'
        }
      }
    },
    include: {
      transaction: true
    }
  });

  console.log(`Found ${entries.length} entries matching 'Polani' under General Vendors.`);

  // 4. Update the entries and log details
  for (const entry of entries) {
    console.log(`Moving entry ID ${entry.id} (Amount Debit: £${entry.debitAmount}, Credit: £${entry.creditAmount}) - Desc: "${entry.transaction.description}"`);
    await prisma.ledgerEntry.update({
      where: { id: entry.id },
      data: { accountId: polaniVendor.id }
    });
  }

  // 5. Recalculate balance for General Vendors
  const genEntries = await prisma.ledgerEntry.findMany({
    where: { accountId: generalVendor.id }
  });
  const genBalance = genEntries.reduce((sum: number, e: any) => sum + Number(e.creditAmount) - Number(e.debitAmount), 0);
  await prisma.ledgerAccount.update({
    where: { id: generalVendor.id },
    data: { balance: genBalance }
  });
  console.log(`Recalculated General Vendors balance: £${genBalance}`);

  // 6. Recalculate balance for Polani Travels LTD
  const polaniEntries = await prisma.ledgerEntry.findMany({
    where: { accountId: polaniVendor.id }
  });
  const polaniBalance = polaniEntries.reduce((sum: number, e: any) => sum + Number(e.creditAmount) - Number(e.debitAmount), 0);
  await prisma.ledgerAccount.update({
    where: { id: polaniVendor.id },
    data: { balance: polaniBalance }
  });
  console.log(`Recalculated Polani Travels LTD balance: £${polaniBalance}`);

  console.log('--- DATABASE FIX COMPLETED ---');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
