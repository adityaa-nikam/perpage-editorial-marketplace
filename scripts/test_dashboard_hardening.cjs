const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

// Test accounts & IDs
const WRITER_A_ID = '64f1a2b3c4d5e6f7a8b9c0d1'; // Dr. Eleanor Vance
const WRITER_B_ID = '64f1a2b3c4d5e6f7a8b9c0d2'; // Marcus Aurelius
const STUDENT_ID = '64f1a2b3c4d5e6f7a8b9c0d9';  // Aditi Student

// Deals from MOCK_DEALS
const DEAL_PENDING_WRITER_A = '64f1a2b3c4d5e6f7a8b9d001';   // status: pending, writer: A, user: student
const DEAL_ACCEPTED_WRITER_A = '64f1a2b3c4d5e6f7a8b9d002';  // status: accepted, writer: A, user: student
const DEAL_DELIVERED_WRITER_A = '64f1a2b3c4d5e6f7a8b9d003'; // status: accepted with final, writer: A
const DEAL_REJECTED_WRITER_A = '64f1a2b3c4d5e6f7a8b9d004';  // status: rejected, writer: A
const UNKNOWN_OBJECT_ID = '64f1a2b3c4d5e6f7a8b9d999';

// Helpers
function createValidPdfBuffer(sizeBytes = 250) {
  const header = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');
  if (sizeBytes <= header.length) return header;
  const padding = Buffer.alloc(sizeBytes - header.length, 0x20);
  return Buffer.concat([header, padding]);
}

function createFakePdfBuffer(sizeBytes = 250) {
  return Buffer.from('NOT_A_REAL_PDF_THIS_IS_PLAIN_TEXT_CONTENT'.repeat(10));
}

function createMultipartPayload(fields, file) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const chunks = [];

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) {
      chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
    }
  }

  if (file) {
    const filename = file.filename || 'final_paper.pdf';
    const contentType = file.contentType || 'application/pdf';
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldname || 'finalPdf'}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`));
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
  console.log('🧪 Starting PerPage Dashboard & Actions Hardening Test Suite...\n');
  try {
    await fetch(`${BASE_URL}/deal/reset-mocks`, { method: 'POST' });
  } catch (e) {}
  const results = [];

  function assert(title, condition, extra = '') {
    results.push({ title, pass: Boolean(condition), extra });
    console.log(`${condition ? '✅' : '❌'} ${title} ${extra ? '(' + extra + ')' : ''}`);
  }

  // ==========================================
  // CRITERION 3: AUTHORIZATION & GUARDS TESTS
  // ==========================================
  console.log('\n--- 1. Authorization & Role Guards ---');

  // 1.1 Unauthenticated requests to /dashboard redirect to /login
  {
    const res = await fetch(`${BASE_URL}/dashboard`, { redirect: 'manual' });
    const location = res.headers.get('location') || '';
    assert(
      'Unauthenticated GET /dashboard redirects to /login',
      res.status === 302 && location.includes('/login'),
      `Status: ${res.status}, Location: ${location}`
    );
  }

  // 1.2 Unauthenticated POST to /deal/accept/:id redirects to /login
  {
    const res = await fetch(`${BASE_URL}/deal/accept/${DEAL_PENDING_WRITER_A}`, { method: 'POST', redirect: 'manual' });
    const location = res.headers.get('location') || '';
    assert(
      'Unauthenticated POST /deal/accept/:id redirects to /login',
      res.status === 302 && location.includes('/login'),
      `Status: ${res.status}`
    );
  }

  // 1.3 Unauthenticated POST to /deal/reject/:id redirects to /login
  {
    const res = await fetch(`${BASE_URL}/deal/reject/${DEAL_PENDING_WRITER_A}`, { method: 'POST', redirect: 'manual' });
    const location = res.headers.get('location') || '';
    assert(
      'Unauthenticated POST /deal/reject/:id redirects to /login',
      res.status === 302 && location.includes('/login'),
      `Status: ${res.status}`
    );
  }

  // 1.4 Unauthenticated POST to /deal/upload-final redirects to /login
  {
    const payload = createMultipartPayload({ dealId: DEAL_ACCEPTED_WRITER_A }, { buffer: createValidPdfBuffer() });
    const res = await fetch(`${BASE_URL}/deal/upload-final`, {
      method: 'POST',
      headers: payload.headers,
      body: payload.body,
      redirect: 'manual'
    });
    const location = res.headers.get('location') || '';
    assert(
      'Unauthenticated POST /deal/upload-final redirects to /login',
      res.status === 302 && location.includes('/login'),
      `Status: ${res.status}`
    );
  }

  // 1.5 Writer B cannot accept Writer A's deal (forbidden)
  {
    const res = await fetch(`${BASE_URL}/deal/accept/${DEAL_PENDING_WRITER_A}`, {
      method: 'POST',
      headers: { 'x-mock-user': WRITER_B_ID, 'x-mock-role': 'writer' },
      redirect: 'manual'
    });
    const location = res.headers.get('location') || '';
    assert(
      'Writer B cannot accept Writer A\'s deal (redirects to /dashboard?error=forbidden)',
      location.includes('error=forbidden'),
      `Location: ${location}`
    );
  }

  // 1.6 Writer B cannot reject Writer A's deal (forbidden)
  {
    const res = await fetch(`${BASE_URL}/deal/reject/${DEAL_PENDING_WRITER_A}`, {
      method: 'POST',
      headers: { 'x-mock-user': WRITER_B_ID, 'x-mock-role': 'writer' },
      redirect: 'manual'
    });
    const location = res.headers.get('location') || '';
    assert(
      'Writer B cannot reject Writer A\'s deal (redirects to /dashboard?error=forbidden)',
      location.includes('error=forbidden'),
      `Location: ${location}`
    );
  }

  // 1.7 Writer B cannot upload final for Writer A's deal (forbidden)
  {
    const payload = createMultipartPayload({ dealId: DEAL_ACCEPTED_WRITER_A }, { buffer: createValidPdfBuffer() });
    const res = await fetch(`${BASE_URL}/deal/upload-final`, {
      method: 'POST',
      headers: { ...payload.headers, 'x-mock-user': WRITER_B_ID, 'x-mock-role': 'writer' },
      body: payload.body,
      redirect: 'manual'
    });
    const location = res.headers.get('location') || '';
    assert(
      'Writer B cannot upload final for Writer A\'s deal (redirects to /dashboard?error=forbidden)',
      location.includes('error=forbidden'),
      `Location: ${location}`
    );
  }

  // 1.8 Student cannot accept any deal (forbidden)
  {
    const res = await fetch(`${BASE_URL}/deal/accept/${DEAL_PENDING_WRITER_A}`, {
      method: 'POST',
      headers: { 'x-mock-user': STUDENT_ID, 'x-mock-role': 'user' },
      redirect: 'manual'
    });
    const location = res.headers.get('location') || '';
    assert(
      'Student cannot accept a deal (redirects to /dashboard?error=forbidden)',
      location.includes('error=forbidden'),
      `Location: ${location}`
    );
  }

  // 1.9 Student cannot reject any deal (forbidden)
  {
    const res = await fetch(`${BASE_URL}/deal/reject/${DEAL_PENDING_WRITER_A}`, {
      method: 'POST',
      headers: { 'x-mock-user': STUDENT_ID, 'x-mock-role': 'user' },
      redirect: 'manual'
    });
    const location = res.headers.get('location') || '';
    assert(
      'Student cannot reject a deal (redirects to /dashboard?error=forbidden)',
      location.includes('error=forbidden'),
      `Location: ${location}`
    );
  }

  // 1.10 Student cannot upload final file (forbidden)
  {
    const payload = createMultipartPayload({ dealId: DEAL_ACCEPTED_WRITER_A }, { buffer: createValidPdfBuffer() });
    const res = await fetch(`${BASE_URL}/deal/upload-final`, {
      method: 'POST',
      headers: { ...payload.headers, 'x-mock-user': STUDENT_ID, 'x-mock-role': 'user' },
      body: payload.body,
      redirect: 'manual'
    });
    const location = res.headers.get('location') || '';
    assert(
      'Student cannot upload final file (redirects to /dashboard?error=forbidden)',
      location.includes('error=forbidden'),
      `Location: ${location}`
    );
  }

  // 1.11 Accept on non-pending deal -> invalid_state
  {
    const res = await fetch(`${BASE_URL}/deal/accept/${DEAL_ACCEPTED_WRITER_A}`, {
      method: 'POST',
      headers: { 'x-mock-user': WRITER_A_ID, 'x-mock-role': 'writer' },
      redirect: 'manual'
    });
    const location = res.headers.get('location') || '';
    assert(
      'Accept on non-pending deal returns error=invalid_state',
      location.includes('error=invalid_state'),
      `Location: ${location}`
    );
  }

  // 1.12 Reject on non-pending deal -> invalid_state
  {
    const res = await fetch(`${BASE_URL}/deal/reject/${DEAL_ACCEPTED_WRITER_A}`, {
      method: 'POST',
      headers: { 'x-mock-user': WRITER_A_ID, 'x-mock-role': 'writer' },
      redirect: 'manual'
    });
    const location = res.headers.get('location') || '';
    assert(
      'Reject on non-pending deal returns error=invalid_state',
      location.includes('error=invalid_state'),
      `Location: ${location}`
    );
  }

  // 1.13 Upload final on non-accepted/non-in-progress deal -> invalid_state
  {
    const payload = createMultipartPayload({ dealId: DEAL_REJECTED_WRITER_A }, { buffer: createValidPdfBuffer() });
    const res = await fetch(`${BASE_URL}/deal/upload-final`, {
      method: 'POST',
      headers: { ...payload.headers, 'x-mock-user': WRITER_A_ID, 'x-mock-role': 'writer' },
      body: payload.body,
      redirect: 'manual'
    });
    const location = res.headers.get('location') || '';
    assert(
      'Upload final on rejected deal returns error=invalid_state',
      location.includes('error=invalid_state'),
      `Location: ${location}`
    );
  }

  // 1.14 Garbage deal id parameter -> error=not_found without CastError
  {
    const res = await fetch(`${BASE_URL}/deal/accept/garbage_id_123`, {
      method: 'POST',
      headers: { 'x-mock-user': WRITER_A_ID, 'x-mock-role': 'writer' },
      redirect: 'manual'
    });
    const location = res.headers.get('location') || '';
    assert(
      'Garbage deal ID parameter returns error=not_found with no 500 crash',
      location.includes('error=not_found') && res.status === 302,
      `Status: ${res.status}, Location: ${location}`
    );
  }

  // 1.15 Valid but unknown deal ObjectId -> error=not_found
  {
    const res = await fetch(`${BASE_URL}/deal/accept/${UNKNOWN_OBJECT_ID}`, {
      method: 'POST',
      headers: { 'x-mock-user': WRITER_A_ID, 'x-mock-role': 'writer' },
      redirect: 'manual'
    });
    const location = res.headers.get('location') || '';
    assert(
      'Valid unknown deal ObjectId returns error=not_found',
      location.includes('error=not_found') && res.status === 302,
      `Status: ${res.status}, Location: ${location}`
    );
  }

  // ==========================================
  // CRITERION 4: FINAL FILE UPLOAD TESTS
  // ==========================================
  console.log('\n--- 2. File Upload Validation & S3 Failure Handling ---');

  // 2.1 Fake PDF (renamed text file lacking %PDF- bytes) -> upload_type
  {
    const payload = createMultipartPayload({ dealId: DEAL_ACCEPTED_WRITER_A }, {
      buffer: createFakePdfBuffer(),
      filename: 'fake_paper.pdf',
      contentType: 'application/pdf'
    });
    const res = await fetch(`${BASE_URL}/deal/upload-final`, {
      method: 'POST',
      headers: { ...payload.headers, 'x-mock-user': WRITER_A_ID, 'x-mock-role': 'writer' },
      body: payload.body,
      redirect: 'manual'
    });
    const location = res.headers.get('location') || '';
    assert(
      'Fake PDF lacking %PDF- header is rejected with error=upload_type',
      location.includes('error=upload_type'),
      `Location: ${location}`
    );
  }

  // 2.2 Missing file -> upload_missing
  {
    const payload = createMultipartPayload({ dealId: DEAL_ACCEPTED_WRITER_A }, null);
    const res = await fetch(`${BASE_URL}/deal/upload-final`, {
      method: 'POST',
      headers: { ...payload.headers, 'x-mock-user': WRITER_A_ID, 'x-mock-role': 'writer' },
      body: payload.body,
      redirect: 'manual'
    });
    const location = res.headers.get('location') || '';
    assert(
      'Missing file upload is rejected with error=upload_missing',
      location.includes('error=upload_missing'),
      `Location: ${location}`
    );
  }

  // 2.3 File exceeding 10MB -> upload_size
  {
    const payload = createMultipartPayload({ dealId: DEAL_ACCEPTED_WRITER_A }, {
      buffer: Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(11 * 1024 * 1024)]),
      filename: 'huge_paper.pdf',
      contentType: 'application/pdf'
    });
    const res = await fetch(`${BASE_URL}/deal/upload-final`, {
      method: 'POST',
      headers: { ...payload.headers, 'x-mock-user': WRITER_A_ID, 'x-mock-role': 'writer' },
      body: payload.body,
      redirect: 'manual'
    });
    const location = res.headers.get('location') || '';
    assert(
      'File exceeding 10MB limit is rejected with error=upload_size without 500 crash',
      location.includes('error=upload_size'),
      `Location: ${location}`
    );
  }

  // 2.4 Simulated S3 storage failure -> upload_failed with rollback
  {
    const payload = createMultipartPayload({ dealId: DEAL_ACCEPTED_WRITER_A }, {
      buffer: createValidPdfBuffer(),
      filename: 'test_s3_fail.pdf'
    });
    const res = await fetch(`${BASE_URL}/deal/upload-final`, {
      method: 'POST',
      headers: {
        ...payload.headers,
        'x-mock-user': WRITER_A_ID,
        'x-mock-role': 'writer',
        'x-test-s3-failure': '1'
      },
      body: payload.body,
      redirect: 'manual'
    });
    const location = res.headers.get('location') || '';
    assert(
      'Simulated S3 failure catches cleanly and redirects with error=upload_failed',
      location.includes('error=upload_failed'),
      `Location: ${location}`
    );
  }

  // 2.5 Verify upload form is present for accepted deal without final file
  {
    const res = await fetch(`${BASE_URL}/dashboard?mockUser=writer`);
    const text = await res.text();
    assert(
      'Upload form with action="/deal/upload-final" and enctype="multipart/form-data" is present for accepted deal',
      text.includes('action="/deal/upload-final"') && text.includes('enctype="multipart/form-data"'),
      'Upload form present'
    );
  }

  // 2.6 Valid PDF upload -> redirects to /dashboard?uploaded=1
  {
    const payload = createMultipartPayload({ dealId: DEAL_ACCEPTED_WRITER_A }, {
      buffer: createValidPdfBuffer(),
      filename: 'valid_final_draft.pdf'
    });
    const res = await fetch(`${BASE_URL}/deal/upload-final`, {
      method: 'POST',
      headers: {
        ...payload.headers,
        'x-mock-user': WRITER_A_ID,
        'x-mock-role': 'writer'
      },
      body: payload.body,
      redirect: 'manual'
    });
    const location = res.headers.get('location') || '';
    assert(
      'Valid PDF upload succeeds and redirects to /dashboard?uploaded=1',
      location.includes('uploaded=1'),
      `Location: ${location}`
    );
  }

  // ==========================================
  // CRITERION 5: QUERY PARAMETER TAMPER TESTS
  // ==========================================
  console.log('\n--- 3. Query Parameter Tampering & Whitelisting ---');

  const tamperCases = [
    { url: '/dashboard?status[$ne]=x&mockUser=student', desc: 'status[$ne]=x object injection' },
    { url: '/dashboard?status=garbage_status&mockUser=student', desc: 'Invalid status string' },
    { url: '/dashboard?view=invalid_view&mockUser=student', desc: 'Invalid view string' },
    { url: '/dashboard?page=0&mockUser=student', desc: 'Page 0' },
    { url: '/dashboard?page=-1&mockUser=student', desc: 'Negative page' },
    { url: '/dashboard?page=abc&mockUser=student', desc: 'Non-numeric page' },
    { url: '/dashboard?page=9999&mockUser=student', desc: 'Very large page' },
    { url: '/dashboard?status[]=pending&status[]=active&mockUser=student', desc: 'Array status query' },
  ];

  for (const tc of tamperCases) {
    const res = await fetch(`${BASE_URL}${tc.url}`);
    const text = await res.text();
    assert(
      `Tamper test: ${tc.desc} renders HTTP 200 without crash`,
      res.status === 200 && text.includes('Welcome back'),
      `Status: ${res.status}`
    );
  }

  // ==========================================
  // CRITERION 6: NOTICE & XSS SAFETY TESTS
  // ==========================================
  console.log('\n--- 4. Notice & XSS Safety ---');

  // 6.1 Reflected XSS injection in error query param
  {
    const res = await fetch(`${BASE_URL}/dashboard?error=<script>alert(1)</script>&mockUser=student`);
    const text = await res.text();
    assert(
      'Arbitrary error query param is ignored and NOT reflected as raw HTML/script',
      !text.includes('<script>alert(1)</script>') && !text.includes('alert(1)'),
      'Script not reflected'
    );
  }

  // 6.2 Whitelisted error code renders safe text
  {
    const res = await fetch(`${BASE_URL}/dashboard?error=forbidden&mockUser=student`);
    const text = await res.text();
    assert(
      'Whitelisted error code forbidden maps to friendly server message',
      text.includes('You are not authorized to perform that action on this deal.'),
      'Safe message present'
    );
  }

  // 6.3 Success query code renders safe toast and alert
  {
    const res = await fetch(`${BASE_URL}/dashboard?accepted=1&mockUser=writer`);
    const text = await res.text();
    assert(
      'Success code accepted=1 maps to friendly server message',
      text.includes('Deal accepted.') && text.includes('toast border-[var(--semantic-success-border)]'),
      'Success toast markup present'
    );
  }

  // ==========================================
  // CRITERION 7: FINAL-LINK FRESHNESS & UNAVAILABLE FALLBACK
  // ==========================================
  console.log('\n--- 5. Final Download Link Freshness & Fallback ---');

  {
    const res1 = await fetch(`${BASE_URL}/dashboard?mockUser=student`);
    const text1 = await res1.text();
    await new Promise(r => setTimeout(r, 100));
    const res2 = await fetch(`${BASE_URL}/dashboard?mockUser=student`);
    const text2 = await res2.text();

    // Check for download links or unavailable fallback
    const hasDownloadBtn = text1.includes('Download final file') || text1.includes('Download delivered draft');
    assert(
      'Dashboard renders download action button or time-limited link for delivered deal',
      hasDownloadBtn,
      'Delivered deal button present'
    );
  }

  // ==========================================
  // CRITERION 8: PRIVACY AUDIT (NO LEAKAGE)
  // ==========================================
  console.log('\n--- 6. Counterpart Data Privacy Audit ---');

  {
    const res = await fetch(`${BASE_URL}/dashboard?mockUser=student`);
    const text = await res.text();
    assert(
      'No counterpart email leaked into student dashboard HTML',
      !text.includes('eleanor@oxford.ac.uk') && !text.includes('@example.com'),
      'No emails found'
    );
    assert(
      'No password hash strings present in dashboard HTML',
      !text.includes('$2a$') && !text.includes('$2b$'),
      'No bcrypt hashes'
    );
    assert(
      'No physical address fields leaked into dashboard HTML',
      !text.includes('addressLine') && !text.includes('postalCode'),
      'No addresses found'
    );
  }

  // ==========================================
  // CRITERION 10: NO-JS ACCESSIBILITY AUDIT
  // ==========================================
  console.log('\n--- 7. No-JS Server-Rendered Elements ---');

  {
    const res = await fetch(`${BASE_URL}/dashboard?accepted=1&mockUser=writer`);
    const text = await res.text();
    assert(
      'Noscript fallback alert is present for notice codes',
      text.includes('<noscript>') && text.includes('alert alert-success'),
      'Noscript alert present'
    );
    assert(
      'Accept form uses standard POST action and submit button',
      text.includes('action="/deal/accept/') && text.includes('method="POST"'),
      'Standard form markup present'
    );
  }

  // SUMMARY
  console.log('\n==========================================');
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('==========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
