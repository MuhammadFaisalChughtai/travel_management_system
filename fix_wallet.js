fetch('http://localhost:4001/agents/2/wallet/transaction', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-tenant-id': '2'
  },
  body: JSON.stringify({
    amount: -1.00,
    transactionType: 'MARGIN_PAID_OUT',
    referenceId: 'TR41FR-004',
    notes: 'Margin Paid to Agent via Booking.'
  })
}).then(r => r.text()).then(console.log).catch(console.error);
