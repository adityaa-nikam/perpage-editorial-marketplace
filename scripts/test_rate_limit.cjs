const http = require('http');

async function sendRequest() {
  return new Promise((resolve, reject) => {
    const postData = 'email=nonexistent@example.com&password=wrongpassword';
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/login',
      method: 'POST',
      headers: {
        'Origin': 'http://localhost:3000',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body
        });
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('Testing rate limiter on POST /login (10 failed attempts allowed per 15 mins)...');
  let hit429 = false;
  let retryAfter = null;

  for (let i = 1; i <= 15; i++) {
    const res = await sendRequest();
    console.log(`Attempt ${i}: Status ${res.statusCode}`);
    if (res.statusCode === 429) {
      hit429 = true;
      retryAfter = res.headers['retry-after'];
      console.log(`✅ Rate limit triggered on attempt ${i}!`);
      console.log(`   Status: 429`);
      console.log(`   Retry-After: ${retryAfter}`);
      console.log(`   RateLimit-Policy: ${res.headers['ratelimit-policy'] || 'N/A'}`);
      console.log(`   HTML renders 429 error view: ${res.body.includes('Too many requests')}`);
      break;
    }
  }

  if (!hit429) {
    console.error('❌ Failed to trigger 429 rate limit!');
    process.exit(1);
  } else {
    console.log('\nRate limit test succeeded!');
  }
}

run();
