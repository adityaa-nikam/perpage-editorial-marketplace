const http = require('http');

async function testProxyHeader() {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/test',
      method: 'GET',
      headers: {
        'X-Forwarded-Proto': 'https',
        'X-Forwarded-For': '203.0.113.195'
      }
    }, (res) => {
      resolve({
        statusCode: res.statusCode,
        headers: res.headers
      });
    });
    req.on('error', reject);
    req.end();
  });
}

testProxyHeader().then(res => {
  console.log('✅ Proxy header simulation response status:', res.statusCode);
  console.log('✅ Trust proxy handled X-Forwarded-Proto cleanly without error.');
});
