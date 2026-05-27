import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function calculateAndSyncAgentMargin(bookingId: number) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        payments: true,
        vendorPayments: true,
        discounts: true,
        refunds: true
      }
    });

    if (!booking || !booking.agentId || !booking.agentName || booking.agentName === 'System / Auto' || booking.agentName === 'Any') {
      return;
    }

    if (booking.status !== 'confirmed') {
      // If it's not confirmed (e.g. cancelled), target margin is 0.
    }

    // 1. Calculate Base Profit
    const clientPayments = booking.payments.filter(p => !['Margin Paid to Agent', 'Credit Card Charges'].includes(p.paymentType)).reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);
    const vendorPayments = booking.vendorPayments.reduce((sum, vp) => sum + parseFloat(vp.amount.toString()), 0);
    const refundsFromVendor = booking.refunds.filter(r => r.direction === 'Refund from Vendor').reduce((sum, r) => sum + parseFloat(r.amount.toString()), 0);
    const refundsToClient = booking.refunds.filter(r => r.direction === 'Refund to Client').reduce((sum, r) => sum + parseFloat(r.amount.toString()), 0);
    const totalDiscounts = booking.discounts.reduce((sum, d) => sum + parseFloat(d.amount.toString()), 0);
    const creditCardCharges = booking.payments.filter(p => p.paymentType === 'Credit Card Charges').reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);

    const netReceived = clientPayments - refundsToClient;
    const netSent = vendorPayments - refundsFromVendor;
    const baseProfit = (netReceived - netSent) + totalDiscounts - creditCardCharges;

    // 2. Fetch Agent Margin Percentage
    let marginPercentage = 0;
    try {
      const authUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:4001';
      const res = await fetch(`${authUrl}/agents/by-name/${encodeURIComponent(booking.agentName)}`, {
        headers: { 'x-tenant-id': booking.tenantId.toString() }
      });
      if (res.ok) {
        const data = await res.json();
        const segments = data.agent?.marginSegments || [];
        const bookingTotal = parseFloat(booking.totalPrice.toString());
        const match = segments.find((s: any) => {
          const min = parseFloat(s.minAmount) || 0;
          const max = s.maxAmount ? parseFloat(s.maxAmount) : Infinity;
          return bookingTotal >= min && bookingTotal <= max;
        });
        if (match) marginPercentage = parseFloat(match.marginPercent) || 0;
      }
    } catch (e) {
      console.error('Failed to fetch agent margin in sync:', e);
    }

    let targetAgentMargin = booking.status === 'confirmed' ? (baseProfit * marginPercentage) / 100 : 0;
    
    // Ensure we don't drop below 0 margin if baseProfit is negative, unless they owe us?
    // Usually margin is 0 if profit is negative.
    if (targetAgentMargin < 0) targetAgentMargin = 0;

    // 3. Find current total MARGIN_EARNED in the ledger
    // We sum up the total credited to AGENT_RECEIVABLE for MARGIN_EARNED
    const existingMarginEarnedTx = await prisma.ledgerTransaction.findMany({
      where: { 
        tenantId: booking.tenantId, 
        referenceNumber: booking.bookingReference,
        type: 'MARGIN_EARNED' 
      },
      include: { entries: { include: { account: true } } }
    });

    let currentEarnedMargin = 0;
    for (const tx of existingMarginEarnedTx) {
      const assetEntry = tx.entries.find(e => e.account.accountType === 'AGENT_RECEIVABLE');
      if (assetEntry) {
        currentEarnedMargin += parseFloat(assetEntry.creditAmount.toString());
        currentEarnedMargin -= parseFloat(assetEntry.debitAmount.toString());
      }
    }

    // 4. Calculate Delta and Push Update
    const delta = targetAgentMargin - currentEarnedMargin;

    if (Math.abs(delta) > 0.01) {
      // Determine accounts
      let assetAccount = await prisma.ledgerAccount.findFirst({
        where: { tenantId: booking.tenantId, accountType: 'AGENT_RECEIVABLE', entityName: booking.agentName }
      });
      if (!assetAccount) {
        assetAccount = await prisma.ledgerAccount.create({
          data: { tenantId: booking.tenantId, accountType: 'AGENT_RECEIVABLE', entityName: booking.agentName }
        });
      }

      let expenseAccount = await prisma.ledgerAccount.findFirst({
        where: { tenantId: booking.tenantId, accountType: 'AGENT_COMMISSION_EXPENSE', entityName: booking.agentName }
      });
      if (!expenseAccount) {
        expenseAccount = await prisma.ledgerAccount.create({
          data: { tenantId: booking.tenantId, accountType: 'AGENT_COMMISSION_EXPENSE', entityName: booking.agentName }
        });
      }

      const tx = await prisma.ledgerTransaction.create({
        data: {
          tenantId: booking.tenantId,
          transactionDate: new Date(),
          referenceNumber: booking.bookingReference,
          description: `Automatic Margin Sync (Delta: ${delta > 0 ? '+' : ''}${delta.toFixed(2)})`,
          type: 'MARGIN_EARNED'
        }
      });

      if (delta > 0) {
        // Debit Expense, Credit Asset
        await prisma.ledgerEntry.createMany({
          data: [
            { transactionId: tx.id, accountId: expenseAccount.id, debitAmount: delta, creditAmount: 0 },
            { transactionId: tx.id, accountId: assetAccount.id, debitAmount: 0, creditAmount: delta }
          ]
        });
        await prisma.ledgerAccount.update({ where: { id: expenseAccount.id }, data: { balance: { increment: delta } } });
        await prisma.ledgerAccount.update({ where: { id: assetAccount.id }, data: { balance: { decrement: delta } } });
      } else {
        // Reverse: Credit Expense, Debit Asset
        const absDelta = Math.abs(delta);
        await prisma.ledgerEntry.createMany({
          data: [
            { transactionId: tx.id, accountId: expenseAccount.id, debitAmount: 0, creditAmount: absDelta },
            { transactionId: tx.id, accountId: assetAccount.id, debitAmount: absDelta, creditAmount: 0 }
          ]
        });
        await prisma.ledgerAccount.update({ where: { id: expenseAccount.id }, data: { balance: { decrement: absDelta } } });
        await prisma.ledgerAccount.update({ where: { id: assetAccount.id }, data: { balance: { increment: absDelta } } });
      }

      // Hit Auth-Service to update wallet
      try {
        const authUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:4001';
        await fetch(`${authUrl}/agents/${booking.agentId}/wallet/transaction`, {
          method: 'POST',
          headers: {
            'x-tenant-id': booking.tenantId.toString(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            amount: delta,
            transactionType: 'MARGIN_EARNED',
            referenceId: booking.bookingReference,
            notes: `Auto Margin Sync. Base Profit: £${baseProfit.toFixed(2)}, Margin: ${marginPercentage}%`
          })
        });
      } catch (e) {
        console.error('Failed to sync agent wallet with auth-service during auto margin', e);
      }
    }
  } catch (e) {
    console.error('calculateAndSyncAgentMargin error:', e);
  }
}
