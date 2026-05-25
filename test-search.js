const http = require('http');

const options = {
  hostname: 'localhost',
  port: 4005,
  path: '/search?q=tr',
  method: 'GET',
  headers: {
    'X-Tenant-Id': '2',
    'X-User-Id': '1',
    'X-User-Role': 'COMPANY_ADMIN',
    'X-Gateway-Secret': process.env.GATEWAY_SECRET || 'supersecretgatewaykey'
  }
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => {
    data += chunk;
  });
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Body: ${data}`);
  });
});

req.on('error', error => {
  console.error(error);
});

req.end();
