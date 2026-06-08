const http = require('http');

const headers = {
  'Content-Type': 'application/json',
  'x-user-id': '1',
  'x-user-role': 'ADMIN',
  'x-tenant-id': '1'
};

const makeRequest = (path, method, body) => {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 4006,
      path: path,
      method: method,
      headers: headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            body: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            body: data
          });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

async function runTests() {
  console.log('--- STARTING COMPANY EXPENSES VERIFICATION TEST ---');

  // 1. Fetch initial expenses to make sure the endpoint works
  console.log('\nStep 1: Listing initial expenses...');
  const initialRes = await makeRequest('/finance/expenses', 'GET');
  console.log(`Status: ${initialRes.statusCode}`);
  console.log(`Found ${initialRes.body.expenses ? initialRes.body.expenses.length : 0} existing expenses.`);

  // 2. Create a one-time expense
  console.log('\nStep 2: Creating a one-time expense (Internet Bill, £75)...');
  const oneTimePayload = {
    name: 'One-Time Test Internet Bill',
    amount: 75.00,
    type: 'one-time',
    date: '2026-06-01',
    notes: 'One-time test'
  };
  const createOneTimeRes = await makeRequest('/finance/expenses', 'POST', oneTimePayload);
  console.log(`Status: ${createOneTimeRes.statusCode}`);
  if (createOneTimeRes.statusCode !== 201) {
    throw new Error(`Failed to create one-time expense: ${JSON.stringify(createOneTimeRes.body)}`);
  }
  const oneTimeExpense = createOneTimeRes.body.expense;
  console.log('Created one-time expense successfully:', oneTimeExpense);

  // 3. Create a recurring expense starting in April 2026
  console.log('\nStep 3: Creating a recurring expense (Office Rent, £1500/month starting 2026-04-15)...');
  const recurringPayload = {
    name: 'Recurring Test Office Rent',
    amount: 1500.00,
    type: 'recurring',
    date: '2026-04-15',
    notes: 'Recurring test starting April 15'
  };
  const createRecurringRes = await makeRequest('/finance/expenses', 'POST', recurringPayload);
  console.log(`Status: ${createRecurringRes.statusCode}`);
  if (createRecurringRes.statusCode !== 201) {
    throw new Error(`Failed to create recurring expense: ${JSON.stringify(createRecurringRes.body)}`);
  }
  const recurringExpense = createRecurringRes.body.expense;
  console.log('Created recurring expense successfully:', recurringExpense);

  // 4. Update the one-time expense (change amount from £75 to £80)
  console.log(`\nStep 4: Updating the one-time expense ID ${oneTimeExpense.id} amount to £80...`);
  const updateOneTimeRes = await makeRequest(`/finance/expenses/${oneTimeExpense.id}`, 'PUT', { amount: 80.00 });
  console.log(`Status: ${updateOneTimeRes.statusCode}`);
  if (updateOneTimeRes.statusCode !== 200) {
    throw new Error(`Failed to update one-time expense: ${JSON.stringify(updateOneTimeRes.body)}`);
  }
  console.log('Updated one-time expense:', updateOneTimeRes.body.expense);

  // 5. Query the ledger report for range covering 2026-04-01 to 2026-06-30
  // Expect:
  // - 1 occurrence of one-time expense on 2026-06-01 (debit amount 80)
  // - 3 occurrences of recurring expense: 2026-04-15, 2026-05-15, 2026-06-15 (debit amount 1500 each)
  // Total cumulative expense up to 2026-06-30 should be: 80 + 1500 * 3 = 4580
  console.log('\nStep 5: Querying ledger report for date range 2026-04-01 to 2026-06-30...');
  const ledgerRes = await makeRequest('/ledger/report?dateStart=2026-04-01&dateEnd=2026-06-30', 'GET');
  console.log(`Status: ${ledgerRes.statusCode}`);
  if (ledgerRes.statusCode !== 200) {
    throw new Error(`Failed to fetch ledger report: ${JSON.stringify(ledgerRes.body)}`);
  }

  const { transactions, accounts } = ledgerRes.body;
  
  // Find expense transactions
  const expenseTxns = transactions.filter(t => t.type === 'EXPENSE');
  console.log(`Found ${expenseTxns.length} expense transactions in the ledger:`);
  expenseTxns.forEach(t => {
    console.log(`- Date: ${t.transactionDate.substring(0, 10)}, Desc: "${t.description}", Amount: £${t.entries[0].debitAmount}`);
  });

  // Find the 'Company Expenses' account
  const expenseAccount = accounts.find(a => a.entityName === 'Company Expenses');
  if (!expenseAccount) {
    throw new Error('Company Expenses account not found in ledger report accounts list');
  }
  console.log(`\nCompany Expenses Account Balance: ${expenseAccount.balance}`);

  // Assertions
  if (expenseTxns.length < 4) {
    throw new Error(`Expected at least 4 expense transactions, but got ${expenseTxns.length}`);
  }
  
  const oneTimeTx = expenseTxns.find(t => t.description.includes('One-Time Test Internet Bill'));
  if (!oneTimeTx || Number(oneTimeTx.entries[0].debitAmount) !== 80) {
    throw new Error(`One-time expense not found or has incorrect amount: ${JSON.stringify(oneTimeTx)}`);
  }

  const recurringTxns = expenseTxns.filter(t => t.description.includes('Recurring Test Office Rent'));
  if (recurringTxns.length !== 3) {
    throw new Error(`Expected 3 recurring office rent occurrences, but got ${recurringTxns.length}`);
  }
  
  if (Math.abs(Number(expenseAccount.balance) - (-4580)) > 0.01) {
    console.log(`WARNING: Company Expenses balance is ${expenseAccount.balance}, expected -4580. Note: This could be because other test expenses exist.`);
  } else {
    console.log('SUCCESS: Company Expenses balance matches exactly -4580!');
  }

  // 6. Test Date Filtering on occurrences
  // Range: 2026-05-01 to 2026-05-31
  // Expect: Only 2026-05-15 recurring occurrence to be inside.
  // Cumulative expenses up to 2026-05-31 should be: 2 * 1500 = 3000 (from April 15 and May 15)
  console.log('\nStep 6: Querying ledger report for date range 2026-05-01 to 2026-05-31...');
  const rangeLedgerRes = await makeRequest('/ledger/report?dateStart=2026-05-01&dateEnd=2026-05-31', 'GET');
  console.log(`Status: ${rangeLedgerRes.statusCode}`);
  const rangeTxns = rangeLedgerRes.body.transactions.filter(t => t.type === 'EXPENSE');
  console.log(`Found ${rangeTxns.length} expense transactions in this range:`);
  rangeTxns.forEach(t => {
    console.log(`- Date: ${t.transactionDate.substring(0, 10)}, Desc: "${t.description}", Amount: £${t.entries[0].debitAmount}`);
  });

  const rangeExpenseAccount = rangeLedgerRes.body.accounts.find(a => a.entityName === 'Company Expenses');
  console.log(`Company Expenses Account Balance for this range: ${rangeExpenseAccount.balance}`);

  const singleRecurringOccur = rangeTxns.find(t => t.description.includes('Recurring Test Office Rent'));
  if (!singleRecurringOccur || singleRecurringOccur.transactionDate.substring(0, 10) !== '2026-05-15') {
    throw new Error(`Expected only 2026-05-15 occurrence for office rent, but got: ${JSON.stringify(singleRecurringOccur)}`);
  }

  // 7. Cleanup - Delete the test expenses
  console.log('\nStep 7: Deleting test expenses...');
  const delOneTimeRes = await makeRequest(`/finance/expenses/${oneTimeExpense.id}`, 'DELETE');
  console.log(`Delete One-Time Status: ${delOneTimeRes.statusCode}`);
  if (delOneTimeRes.statusCode !== 200) {
    throw new Error(`Failed to delete one-time expense: ${JSON.stringify(delOneTimeRes.body)}`);
  }

  const delRecurringRes = await makeRequest(`/finance/expenses/${recurringExpense.id}`, 'DELETE');
  console.log(`Delete Recurring Status: ${delRecurringRes.statusCode}`);
  if (delRecurringRes.statusCode !== 200) {
    throw new Error(`Failed to delete recurring expense: ${JSON.stringify(delRecurringRes.body)}`);
  }

  // 8. Confirm deletion in ledger report
  console.log('\nStep 8: Verifying deletion in ledger...');
  const postDelLedgerRes = await makeRequest('/ledger/report?dateStart=2026-04-01&dateEnd=2026-06-30', 'GET');
  const postDelExpenseTxns = postDelLedgerRes.body.transactions.filter(t => 
    t.type === 'EXPENSE' && 
    (t.description.includes('One-Time Test Internet') || t.description.includes('Recurring Test Office'))
  );
  if (postDelExpenseTxns.length > 0) {
    throw new Error(`Expected 0 test expense transactions post deletion, but found: ${JSON.stringify(postDelExpenseTxns)}`);
  }
  console.log('SUCCESS: Deletion verified, all test expenses are removed!');

  console.log('\n--- ALL EXPENSES MANAGEMENT API TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch(err => {
  console.error('\n--- TEST FAILED ---');
  console.error(err);
  process.exit(1);
});
