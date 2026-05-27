fetch('http://localhost:4001/agents/1/wallet/transaction', {
  method: 'POST',
  headers: {
    'x-tenant-id': '2',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: -20,
    transactionType: 'MARGIN_PAID_OUT',
    referenceId: 'Manual Sync',
    notes: 'Vendor Payment via Booking (Manual Sync)'
  })
}).then(r=>r.json()).then(console.log).catch(console.error);
