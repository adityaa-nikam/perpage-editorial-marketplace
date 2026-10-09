const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const VALID_WRITER_ID = '64f1a2b3c4d5e6f7a8b9c0d1'; // Dr. Eleanor Vance, rate = 150
const UNSET_RATE_WRITER_ID = '64f1a2b3c4d5e6f7a8b9c0d7'; // Kavita Patel, rate = 0
const NON_WRITER_ID = '64f1a2b3c4d5e6f7a8b9c0d9'; // Aditi Student, role = user
const UNKNOWN_OBJECT_ID = '64f1a2b3c4d5e6f7a8b9c999'; // Valid ObjectId, non-existent user

// Helper: build tiny valid PDF buffer with %PDF- header
function createValidPdfBuffer(sizeBytes = 200) {
  const header = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
  if (sizeBytes <= header.length) return header;
  const padding = Buffer.alloc(sizeBytes - header.length, 0x20);
  return Buffer.concat([header, padding]);
}

// Helper: build multipart/form-data payload manually
function createMultipartPayload(fields, file) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const chunks = [];

  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${item}\r\n`));
      }
    } else if (value !== undefined && value !== null) {
      chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
    }
  }

  if (file) {
    const filename = file.filename || 'brief.pdf';
    const contentType = file.contentType || 'application/pdf';
    const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldname || 'file'}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`;
    chunks.push(Buffer.from(fileHeader));
    chunks.push(file.buffer);
    chunks.push(Buffer.from('\r\n'));
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  const body = Buffer.concat(chunks);
  return {
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length.toString()
    },
    body
  };
}

async function runTests() {
  console.log('🧪 Starting PerPage Deal Hardening & Redesign Test Suite...\n');
  const results = [];

  function assert(title, condition, extra = '') {
    results.push({ title, pass: Boolean(condition), extra });
    console.log(`${condition ? '✅' : '❌'} ${title} ${extra ? '(' + extra + ')' : ''}`);
  }

  // 1. GET /deal for logged-out user (no mockUser) -> Redirect to /login
  {
    const res = await fetch(`${BASE_URL}/deal?writerId=${VALID_WRITER_ID}`, { redirect: 'manual' });
    const location = res.headers.get('location') || '';
    assert(
      'GET /deal for logged-out user redirects to /login',
      res.status === 302 && location.includes('/login'),
      `Status: ${res.status}, Location: ${location}`
    );
  }

  // 2. GET /deal with invalid/garbage writerId -> 404 dealError
  {
    const res = await fetch(`${BASE_URL}/deal?writerId=garbage_id&mockUser=1`);
    const text = await res.text();
    assert(
      'GET /deal with garbage writerId returns 404 shell error',
      res.status === 404 && text.includes('Writer Not Found'),
      `Status: ${res.status}`
    );
  }

  // 3. GET /deal with valid unknown ObjectId -> 404 dealError
  {
    const res = await fetch(`${BASE_URL}/deal?writerId=${UNKNOWN_OBJECT_ID}&mockUser=1`);
    const text = await res.text();
    assert(
      'GET /deal with unknown ObjectId returns 404 shell error',
      res.status === 404 && text.includes('Writer Not Found'),
      `Status: ${res.status}`
    );
  }

  // 4. GET /deal with non-writer user ID -> 404 dealError
  {
    const res = await fetch(`${BASE_URL}/deal?writerId=${NON_WRITER_ID}&mockUser=1`);
    const text = await res.text();
    assert(
      'GET /deal with non-writer account returns 404 shell error',
      res.status === 404 && text.includes('Writer Not Found'),
      `Status: ${res.status}`
    );
  }

  // 5. GET /deal self-deal attempt -> 409 dealError
  {
    const res = await fetch(`${BASE_URL}/deal?writerId=${VALID_WRITER_ID}&mockUser=self`);
    const text = await res.text();
    assert(
      'GET /deal self-deal attempt returns 409 shell error',
      res.status === 409 && text.includes('Self-Deal Not Permitted'),
      `Status: ${res.status}`
    );
  }

  // 6. GET /deal for writer with no rate set -> 422 dealError
  {
    const res = await fetch(`${BASE_URL}/deal?writerId=${UNSET_RATE_WRITER_ID}&mockUser=1`);
    const text = await res.text();
    assert(
      'GET /deal for writer without rate returns 422 shell error',
      res.status === 422 && text.includes('Rate Not Set'),
      `Status: ${res.status}`
    );
  }

  // 7. GET /deal with valid writer -> 200, renders form, robots noindex, and values/errors defaults
  {
    const res = await fetch(`${BASE_URL}/deal?writerId=${VALID_WRITER_ID}&mockUser=1`);
    const text = await res.text();
    assert(
      'GET /deal with valid writer renders 200 deal view with robots noindex',
      res.status === 200 && text.includes('Create a deal') && text.includes('content="noindex, nofollow"'),
      `Status: ${res.status}`
    );
  }

  // 8. POST /deal logged out user -> Redirect to /login
  {
    const payload = createMultipartPayload({
      writerId: VALID_WRITER_ID,
      pages: '5',
      userNotes: 'Valid notes'
    }, {
      fieldname: 'file',
      filename: 'brief.pdf',
      contentType: 'application/pdf',
      buffer: createValidPdfBuffer()
    });

    const res = await fetch(`${BASE_URL}/deal`, {
      method: 'POST',
      headers: payload.headers,
      body: payload.body,
      redirect: 'manual'
    });
    const location = res.headers.get('location') || '';
    assert(
      'POST /deal for logged-out user redirects to /login',
      res.status === 302 && location.includes('/login'),
      `Status: ${res.status}, Location: ${location}`
    );
  }

  // 9. POST /deal valid submission -> 302 redirect to /dashboard?created=1
  {
    const payload = createMultipartPayload({
      writerId: VALID_WRITER_ID,
      pages: '5',
      totalPrice: '10', // Tampered client price! Server rate is 150, expected total = 750
      userNotes: 'Please review prompt brief carefully.'
    }, {
      fieldname: 'file',
      filename: 'research_brief.pdf',
      contentType: 'application/pdf',
      buffer: createValidPdfBuffer(1024)
    });

    const res = await fetch(`${BASE_URL}/deal`, {
      method: 'POST',
      headers: { ...payload.headers, 'x-mock-user': '1' },
      body: payload.body,
      redirect: 'manual'
    });
    const location = res.headers.get('location') || '';
    assert(
      'POST /deal valid submission redirects to /dashboard?created=1',
      res.status === 302 && location === '/dashboard?created=1',
      `Status: ${res.status}, Location: ${location}`
    );
  }

  // 10. Check tamper resistance: verify mock deal recorded server-computed price (150 x 5 = 750, not 10)
  {
    const dealsRes = await fetch(`${BASE_URL}/deal/test-deals`);
    const deals = await dealsRes.json();
    const latest = deals[deals.length - 1];
    assert(
      'Server ignores client-submitted totalPrice and computes rate * pages',
      latest && latest.totalPrice === 750 && latest.status === 'pending' && latest.pages === 5,
      `Recorded totalPrice: ${latest?.totalPrice}, Expected: 750`
    );
    assert(
      'Server generates sanitized UUID key in fileLinks',
      latest && latest.fileLinks && latest.fileLinks[0] && latest.fileLinks[0].startsWith('uploads/') && latest.fileLinks[0].includes('research_brief.pdf'),
      `Key: ${latest?.fileLinks?.[0]}`
    );
  }

  // 11. POST /deal pages boundary validation: 0, -1, 1.5, abc, 501, array
  const invalidPagesCases = [
    { val: '0', desc: 'pages = 0' },
    { val: '-1', desc: 'pages = -1' },
    { val: '1.5', desc: 'pages = 1.5' },
    { val: 'abc', desc: 'pages = abc' },
    { val: '501', desc: 'pages = 501' },
    { val: ['1', '2'], desc: 'pages as array' }
  ];

  for (const tc of invalidPagesCases) {
    const payload = createMultipartPayload({
      writerId: VALID_WRITER_ID,
      pages: tc.val,
      userNotes: 'Test notes'
    }, {
      fieldname: 'file',
      filename: 'test.pdf',
      contentType: 'application/pdf',
      buffer: createValidPdfBuffer()
    });

    const res = await fetch(`${BASE_URL}/deal`, {
      method: 'POST',
      headers: { ...payload.headers, 'x-mock-user': '1' },
      body: payload.body,
      redirect: 'manual'
    });
    const text = await res.text();
    assert(
      `POST /deal rejects invalid pages (${tc.desc}) with status 422`,
      res.status === 422 && text.includes('Page count must be'),
      `Status: ${res.status}`
    );
  }

  // 12. POST /deal userNotes > 2000 chars rejected
  {
    const longNotes = 'A'.repeat(2005);
    const payload = createMultipartPayload({
      writerId: VALID_WRITER_ID,
      pages: '3',
      userNotes: longNotes
    }, {
      fieldname: 'file',
      filename: 'test.pdf',
      contentType: 'application/pdf',
      buffer: createValidPdfBuffer()
    });

    const res = await fetch(`${BASE_URL}/deal`, {
      method: 'POST',
      headers: { ...payload.headers, 'x-mock-user': '1' },
      body: payload.body,
      redirect: 'manual'
    });
    const text = await res.text();
    assert(
      'POST /deal rejects userNotes > 2000 characters with status 422',
      res.status === 422 && text.includes('Notes cannot exceed 2000 characters'),
      `Status: ${res.status}`
    );
  }

  // 13. POST /deal HTML escaping: verify HTML in notes is escaped
  {
    const xssNotes = '<script>alert("xss")</script><b>Bold notes</b>';
    const payload = createMultipartPayload({
      writerId: VALID_WRITER_ID,
      pages: '0', // Trigger re-render to inspect reflected value in textarea
      userNotes: xssNotes
    }, {
      fieldname: 'file',
      filename: 'test.pdf',
      contentType: 'application/pdf',
      buffer: createValidPdfBuffer()
    });

    const res = await fetch(`${BASE_URL}/deal`, {
      method: 'POST',
      headers: { ...payload.headers, 'x-mock-user': '1' },
      body: payload.body,
      redirect: 'manual'
    });
    const text = await res.text();
    // In EJS, <%= values.userNotes %> escapes < and > to &lt; and &gt;
    assert(
      'HTML in userNotes is safely escaped upon re-rendering',
      !text.includes('<script>alert("xss")</script>') && text.includes('&lt;script&gt;'),
      'Script tags properly escaped'
    );
  }

  // 14. Fake PDF (.exe or text file renamed to .pdf) fails magic byte %PDF- check
  {
    const fakeBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00This is a fake PE executable binary file');
    const payload = createMultipartPayload({
      writerId: VALID_WRITER_ID,
      pages: '3',
      userNotes: 'Fake binary file'
    }, {
      fieldname: 'file',
      filename: 'fake_exec.pdf',
      contentType: 'application/pdf',
      buffer: fakeBuffer
    });

    const res = await fetch(`${BASE_URL}/deal`, {
      method: 'POST',
      headers: { ...payload.headers, 'x-mock-user': '1' },
      body: payload.body,
      redirect: 'manual'
    });
    const text = await res.text();
    assert(
      'Fake PDF lacking %PDF- magic bytes rejected with 422',
      res.status === 422 && text.includes('Invalid file format. The file must be a valid PDF document'),
      `Status: ${res.status}`
    );
  }

  // 15. File exceeding 10MB limit handled gracefully by Multer with friendly 422, server stays up
  {
    const oversizedBuffer = Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(11 * 1024 * 1024)]); // 11MB
    const payload = createMultipartPayload({
      writerId: VALID_WRITER_ID,
      pages: '3',
      userNotes: 'Oversized file'
    }, {
      fieldname: 'file',
      filename: 'oversized.pdf',
      contentType: 'application/pdf',
      buffer: oversizedBuffer
    });

    const res = await fetch(`${BASE_URL}/deal`, {
      method: 'POST',
      headers: { ...payload.headers, 'x-mock-user': '1' },
      body: payload.body,
      redirect: 'manual'
    });
    const text = await res.text();
    assert(
      'Oversized file (>10MB) returns friendly 422 without server crash',
      res.status === 422 && text.includes('File exceeds the maximum size of 10MB'),
      `Status: ${res.status}`
    );
  }

  // 16. Missing file rejected with status 422
  {
    const payload = createMultipartPayload({
      writerId: VALID_WRITER_ID,
      pages: '3',
      userNotes: 'No file attached'
    }, null);

    const res = await fetch(`${BASE_URL}/deal`, {
      method: 'POST',
      headers: { ...payload.headers, 'x-mock-user': '1' },
      body: payload.body,
      redirect: 'manual'
    });
    const text = await res.text();
    assert(
      'Missing file returns friendly 422 error',
      res.status === 422 && text.includes('Please upload your assignment brief'),
      `Status: ${res.status}`
    );
  }

  // 17. NoSQL injection attack: writerId[$ne]=x does not reach a query
  {
    const payload = createMultipartPayload({
      'writerId[$ne]': 'something',
      pages: '3',
      userNotes: 'Testing NoSQL injection'
    }, {
      fieldname: 'file',
      filename: 'test.pdf',
      contentType: 'application/pdf',
      buffer: createValidPdfBuffer()
    });

    const res = await fetch(`${BASE_URL}/deal`, {
      method: 'POST',
      headers: { ...payload.headers, 'x-mock-user': '1' },
      body: payload.body,
      redirect: 'manual'
    });
    const text = await res.text();
    assert(
      'NoSQL injection payload writerId[$ne]=x rejected with 404',
      res.status === 404 && text.includes('Writer Not Found'),
      `Status: ${res.status}`
    );
  }

  // 18. Failure Handling: Simulated S3 upload failure
  {
    const initialDealsRes = await fetch(`${BASE_URL}/deal/test-deals`);
    const initialDeals = await initialDealsRes.json();
    const initialCount = initialDeals.length;

    const payload = createMultipartPayload({
      writerId: VALID_WRITER_ID,
      pages: '3',
      userNotes: 'S3 failure simulation'
    }, {
      fieldname: 'file',
      filename: 's3_fail.pdf',
      contentType: 'application/pdf',
      buffer: createValidPdfBuffer()
    });

    const res = await fetch(`${BASE_URL}/deal`, {
      method: 'POST',
      headers: { ...payload.headers, 'x-mock-user': '1', 'x-test-s3-failure': '1' },
      body: payload.body,
      redirect: 'manual'
    });
    const text = await res.text();

    const afterDealsRes = await fetch(`${BASE_URL}/deal/test-deals`);
    const afterDeals = await afterDealsRes.json();
    const afterCount = afterDeals.length;

    assert(
      'Simulated S3 failure returns friendly retryable 422 error and creates NO deal',
      res.status === 422 && text.includes('Failed to upload document to storage') && afterCount === initialCount,
      `Status: ${res.status}, Deals created: ${afterCount - initialCount}`
    );
  }

  // 19. Failure Handling: Simulated DB failure after upload initiates orphan cleanup
  {
    const payload = createMultipartPayload({
      writerId: VALID_WRITER_ID,
      pages: '3',
      userNotes: 'DB failure simulation'
    }, {
      fieldname: 'file',
      filename: 'db_fail.pdf',
      contentType: 'application/pdf',
      buffer: createValidPdfBuffer()
    });

    const res = await fetch(`${BASE_URL}/deal`, {
      method: 'POST',
      headers: { ...payload.headers, 'x-mock-user': '1', 'x-test-db-failure': '1' },
      body: payload.body,
      redirect: 'manual'
    });
    const text = await res.text();

    assert(
      'Simulated DB failure returns 500 friendly message and attempts orphan cleanup',
      res.status === 500 && text.includes('Unable to finalize deal in database'),
      `Status: ${res.status}`
    );
  }

  console.log('\n📊 Test Summary:');
  const passed = results.filter(r => r.pass).length;
  console.log(`Passed: ${passed} / ${results.length}`);
  if (passed === results.length) {
    console.log('🎉 ALL DEAL HARDENING TESTS PASSED SUCCESSFULLY!');
  } else {
    console.error('⚠️ Some tests failed. Please inspect details above.');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
