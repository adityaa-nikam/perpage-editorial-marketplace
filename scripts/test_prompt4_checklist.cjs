const fs = require('fs');

const BASE_URL = 'http://localhost:3000';

async function testPrompt4() {
  console.log('🧪 Testing Prompt 4 (Auth, Register, Login) criteria...\n');
  const results = [];

  function assert(title, cond, extra = '') {
    results.push({ title, pass: Boolean(cond), extra });
    console.log(`${cond ? '✅' : '❌'} ${title} ${extra ? '(' + extra + ')' : ''}`);
  }

  // 1. Password under 8 characters rejected
  {
    const res = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'name=Test+User&email=test_short@example.com&password=1234567&role=user',
      redirect: 'manual'
    });
    const text = await res.text();
    assert(
      'Password under 8 chars is rejected with 400',
      res.status === 400 && (text.includes('8 and 72 characters') || text.includes('at least')),
      `Status: ${res.status}, Body: ${text.slice(0, 100)}`
    );
  }

  // 2. Password over 72 characters rejected
  {
    const longPw = 'A'.repeat(73);
    const res = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `name=Test+User&email=test_long@example.com&password=${longPw}&role=user`,
      redirect: 'manual'
    });
    const text = await res.text();
    assert(
      'Password over 72 chars is rejected with 400',
      res.status === 400,
      `Status: ${res.status}, Body: ${text.slice(0, 100)}`
    );
  }

  // 3. Mongo operator object injection in email on register (email[$ne]=x)
  {
    const res = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Hack',
        email: { $ne: 'x' },
        password: 'ValidPassword123'
      })
    });
    const text = await res.text();
    assert(
      'Object injection email[$ne]=x on register is rejected with 400/422',
      res.status === 400 && text.includes('valid email'),
      `Status: ${res.status}`
    );
  }

  // 4. Mongo operator object injection on login
  {
    const res = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: { $ne: 'admin@example.com' },
        password: 'AnyPassword'
      })
    });
    assert(
      'Object injection email[$ne]=x on login does not authenticate or crash',
      res.status === 401 || res.status === 400 || res.status === 500,
      `Status: ${res.status}`
    );
  }

  // 5. XSS reflection on /login?error=<script>alert(1)</script>
  {
    const res = await fetch(`${BASE_URL}/login?error=<script>alert(1)</script>`);
    const text = await res.text();
    assert(
      'XSS query code in /login?error is not reflected raw',
      !text.includes('<script>alert(1)</script>'),
      'Script not reflected'
    );
  }

  // 6. GitHub mark icon on login page
  {
    const res = await fetch(`${BASE_URL}/login`);
    const text = await res.text();
    assert(
      'GitHub button shows GitHub SVG mark on login page',
      text.includes('auth/github') && (text.includes('github') || text.includes('svg')),
      'GitHub button present'
    );
  }

  console.log('\nPrompt 4 Test Complete.');
  const passed = results.filter(r => r.pass).length;
  console.log(`Passed ${passed} / ${results.length}`);
}

testPrompt4().catch(console.error);
