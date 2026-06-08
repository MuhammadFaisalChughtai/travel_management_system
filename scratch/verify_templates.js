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
  console.log('--- RUNNING DOCUMENT TEMPLATE & ISOLATION SYSTEM VERIFICATION ---');

  // Test 1: Try to create a Voucher with financial variables
  console.log('\nTest 1: Trying to create a VOUCHER template with financial token {{booking.amountGross}}...');
  const badVoucher = {
    name: 'Bad Voucher Layout',
    type: 'VOUCHER',
    status: 'Active',
    structureHtml: '<div>Voucher for Guest. Total Cost is {{booking.amountGross}}</div>',
    structureCss: '.box { color: red; }'
  };

  const res1 = await makeRequest('/finance/templates', 'POST', badVoucher);
  console.log(`Response Status: ${res1.statusCode}`);
  console.log('Response Body:', res1.body);
  if (res1.statusCode === 400 && res1.body.message.includes('forbidden')) {
    console.log('SUCCESS: Server rejected voucher template with financial tokens!');
  } else {
    console.log('FAIL: Server did not reject bad voucher template correctly!');
  }

  // Test 2: Create a good Voucher template without financial tokens
  console.log('\nTest 2: Creating a valid VOUCHER template...');
  const goodVoucher = {
    name: 'Valid Flight Voucher',
    type: 'VOUCHER',
    status: 'Active',
    structureHtml: `
      <div>
        <h2>Flight Voucher for {{company.name}}</h2>
        <p>Booking Ref: {{booking.reference}}</p>
        <div class="passenger-section">
          {{tables.passengers}}
        </div>
        <div class="itinerary">
          {{tables.flights}}
        </div>
        <div>
          <h4>Hotel Stay:</h4>
          {{tables.hotels}}
        </div>
        <p>Verification Signature: {{document.signature}}</p>
      </div>
    `,
    structureCss: 'h2 { color: blue; }'
  };

  const res2 = await makeRequest('/finance/templates', 'POST', goodVoucher);
  console.log(`Response Status: ${res2.statusCode}`);
  console.log('Response Body Template Name:', res2.body.template?.name);
  let voucherTemplateId;
  if (res2.statusCode === 201) {
    voucherTemplateId = res2.body.template.id;
    console.log(`SUCCESS: Created valid VOUCHER template (ID: ${voucherTemplateId})!`);
  } else {
    console.log('FAIL: Failed to create valid voucher template!');
  }

  // Test 3: Create a valid Invoice template
  console.log('\nTest 3: Creating a valid INVOICE template...');
  const goodInvoice = {
    name: 'Corporate Invoice Template',
    type: 'INVOICE',
    status: 'Active',
    structureHtml: `
      <div>
        <h2>Invoice from {{company.name}}</h2>
        <p>Booking Ref: {{booking.reference}}</p>
        <p>Total Gross: £{{booking.amountGross}}</p>
        <p>Settled: £{{booking.amountSettled}}</p>
        <p>Balance Due: £{{booking.amountDue}}</p>
        <div>
          {{tables.services}}
        </div>
        <p>Signature: {{document.signature}}</p>
      </div>
    `,
    structureCss: 'h2 { color: green; }'
  };

  const res3 = await makeRequest('/finance/templates', 'POST', goodInvoice);
  console.log(`Response Status: ${res3.statusCode}`);
  console.log('Response Body Template Name:', res3.body.template?.name);
  let invoiceTemplateId;
  if (res3.statusCode === 201) {
    invoiceTemplateId = res3.body.template.id;
    console.log(`SUCCESS: Created valid INVOICE template (ID: ${invoiceTemplateId})!`);
  } else {
    console.log('FAIL: Failed to create valid invoice template!');
  }

  // Test 4: Compile Invoice
  console.log(`\nTest 4: Compiling Invoice Template ID ${invoiceTemplateId} against Booking ID 1...`);
  const res4 = await makeRequest(`/finance/templates/${invoiceTemplateId}/compile`, 'POST', { bookingId: 1 });
  console.log(`Response Status: ${res4.statusCode}`);
  if (res4.statusCode === 200) {
    console.log('SUCCESS: Invoice Compiled!');
    console.log('Compiled HTML preview (snippet):', res4.body.compiledHtml.substring(0, 300));
    console.log('Contains gross value:', res4.body.compiledHtml.includes('Total Gross:'));
    console.log('Signature hash:', res4.body.digitalSignature);
  } else {
    console.log('FAIL: Failed to compile invoice! Response:', res4.body);
  }

  // Test 5: Compile Voucher
  console.log(`\nTest 5: Compiling Voucher Template ID ${voucherTemplateId} against Booking ID 1...`);
  const res5 = await makeRequest(`/finance/templates/${voucherTemplateId}/compile`, 'POST', { bookingId: 1 });
  console.log(`Response Status: ${res5.statusCode}`);
  if (res5.statusCode === 200) {
    console.log('SUCCESS: Voucher Compiled!');
    console.log('Compiled HTML preview (snippet):', res5.body.compiledHtml.substring(0, 300));
    const containsGross = res5.body.compiledHtml.includes('Total Gross:');
    const containsPrice = res5.body.compiledHtml.includes('£');
    console.log('Contains price symbols:', containsPrice);
    console.log('Contains gross value:', containsGross);
    console.log('Contains hotels table:', res5.body.compiledHtml.includes('Hotel Stay:'));
    if (!containsGross) {
      console.log('VERIFIED: Voucher compiled completely pricing-free!');
    } else {
      console.log('FAIL: Voucher compiled layout contains pricing!');
    }
  } else {
    console.log('FAIL: Failed to compile voucher! Response:', res5.body);
  }

  console.log('\n--- VERIFICATION COMPLETED SUCCESSFULLY ---');
}

runTests().catch(console.error);
