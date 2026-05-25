const axios = require('axios');

async function test() {
  try {
    // Assuming tenant 1, user 1
    const res = await axios.patch('http://localhost:4005/1/flight-services/1', {
      isPaidToVendor: true
    }, {
      headers: {
        'x-tenant-id': '1',
        'x-user-id': '1',
        'x-user-role': 'Administrator'
      }
    });
    console.log("Success:", res.data);
  } catch (err) {
    console.error("Error:", err.response ? err.response.data : err.message);
  }
}

test();
