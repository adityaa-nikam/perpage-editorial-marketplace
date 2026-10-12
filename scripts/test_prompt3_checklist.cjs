const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
const VALID_WRITER_ID = '64f1a2b3c4d5e6f7a8b9c0d1';
const VALID_UNKNOWN_ID = '64f1a2b3c4d5e6f7a8b9c999';
const NON_WRITER_ID = '64f1a2b3c4d5e6f7a8b9c0d9';

async function testPrompt3() {
  console.log('🧪 Testing Prompt 3 (/writers and writer profile) criteria...\n');
  const results = [];

  function assert(title, cond, extra = '') {
    results.push({ title, pass: Boolean(cond), extra });
    console.log(`${cond ? '✅' : '❌'} ${title} ${extra ? '(' + extra + ')' : ''}`);
  }

  // 1. Hostile Query params on /writers
  const hostileQueries = [
    { q: 'q=.*', desc: 'Regex dot-star' },
    { q: 'q=(', desc: 'Unclosed regex paren' },
    { q: 'q[$ne]=x', desc: 'Mongo operator object injection' },
    { q: 'q=' + 'A'.repeat(500), desc: '500-character search query' },
    { q: 'page=0', desc: 'Page 0' },
    { q: 'page=-1', desc: 'Negative page' },
    { q: 'page=abc', desc: 'Non-numeric page' },
    { q: 'page=9999', desc: 'Out-of-range page' },
    { q: 'sort=invalid_column', desc: 'Unknown sort option' }
  ];

  for (const hq of hostileQueries) {
    const res = await fetch(`${BASE_URL}/writers?${hq.q}`);
    const text = await res.text();
    assert(
      `Search param test (${hq.desc}) renders HTTP 200 without crash`,
      res.status === 200 && text.includes('Choose your writer'),
      `Status: ${res.status}`
    );
  }

  // 2. /writers/garbage -> 404 view, not crash
  {
    const res = await fetch(`${BASE_URL}/writers/garbage_id_123`);
    const text = await res.text();
    assert(
      '/writers/garbage returns 404 writerNotFound view',
      res.status === 404 && text.includes('Writer Not Found'),
      `Status: ${res.status}`
    );
  }

  // 3. /writers/<valid unknown id> -> 404 view, not crash
  {
    const res = await fetch(`${BASE_URL}/writers/${VALID_UNKNOWN_ID}`);
    const text = await res.text();
    assert(
      '/writers/<valid unknown id> returns 404 writerNotFound view',
      res.status === 404 && text.includes('Writer Not Found'),
      `Status: ${res.status}`
    );
  }

  // 4. /writers/<non-writer id> -> 404 view, not crash
  {
    const res = await fetch(`${BASE_URL}/writers/${NON_WRITER_ID}`);
    const text = await res.text();
    assert(
      '/writers/<non-writer id> returns 404 writerNotFound view',
      res.status === 404 && text.includes('Writer Not Found'),
      `Status: ${res.status}`
    );
  }

  // 5. Valid writer profile renders cleanly
  {
    const res = await fetch(`${BASE_URL}/writers/${VALID_WRITER_ID}`);
    const text = await res.text();
    assert(
      'Valid writer profile renders HTTP 200 with name and details',
      res.status === 200 && text.includes('Dr. Eleanor Vance'),
      `Status: ${res.status}`
    );

    // 6. Privacy: No email, address, password hash on public profile
    assert(
      'No email leaked in public writer profile HTML',
      !text.includes('eleanor@oxford.ac.uk') && !text.includes('@example.com'),
      'No email found'
    );
    assert(
      'No address leaked in public writer profile HTML',
      !text.includes('addressLine') && !text.includes('postalCode'),
      'No address found'
    );
    assert(
      'No password hash leaked in public writer profile HTML',
      !text.includes('$2a$') && !text.includes('$2b$'),
      'No hash found'
    );

    // 7. Content honesty: No ratings, reviews, response-time claims
    assert(
      'No ratings claim on writer profile',
      !text.includes('rating') && !text.includes('★★★★★'),
      'Ratings absent'
    );
    assert(
      'No 5.0 score claim on writer profile',
      !text.includes('5.0'),
      '5.0 absent'
    );
    assert(
      'No response time claim on writer profile',
      !text.includes('response time') && !text.includes('replies in'),
      'Response time absent'
    );
    assert(
      'No verified claim on writer profile',
      !text.includes('verified writer') && !text.includes('verified badge'),
      'Verified claim absent'
    );
    assert(
      'No guarantee claim on writer profile',
      !text.includes('guarantee') && !text.includes('money-back'),
      'Guarantee claim absent'
    );
  }

  console.log('\nPrompt 3 Test Complete.');
  const passed = results.filter(r => r.pass).length;
  console.log(`Passed ${passed} / ${results.length}`);
}

testPrompt3().catch(console.error);
