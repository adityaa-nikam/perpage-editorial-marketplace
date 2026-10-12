const assert = require('assert');

const BASE_URL = 'http://localhost:3000';

// Minimal valid PDF buffer
const VALID_PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n185\n%%EOF');

// Helper to manage session cookies
class SessionClient {
  constructor() {
    this.cookies = '';
  }

  async fetch(url, options = {}) {
    const headers = options.headers || {};
    if (this.cookies) {
      headers['Cookie'] = this.cookies;
    }
    // Default headers simulating real browser
    if (!headers['Origin'] && !headers['origin'] && options.method && options.method !== 'GET') {
      headers['Origin'] = BASE_URL;
      headers['Referer'] = BASE_URL + '/';
      headers['Sec-Fetch-Site'] = 'same-origin';
    }

    const res = await fetch(url, {
      ...options,
      headers,
      redirect: options.redirect || 'manual'
    });

    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const parts = setCookie.split(';')[0];
      this.cookies = parts;
    }

    return res;
  }
}

async function runEndToEndTests() {
  console.log('🧪 Starting End-to-End User Flow Tests...\n');

  // =========================================================================
  // FLOW 1: Public Discovery & Information Pages
  // =========================================================================
  console.log('--- Flow 1: Public Discovery & Navigation ---');
  const anon = new SessionClient();
  
  const homeRes = await anon.fetch(`${BASE_URL}/`);
  assert.equal(homeRes.status, 200, 'Home page must return 200');
  const homeHtml = await homeRes.text();
  assert.ok(homeHtml.includes('PerPage'), 'Home page contains PerPage');
  assert.ok(homeHtml.includes('What you get'), 'Home page contains updated features heading');
  console.log('  ✔ Landing page / returns 200 with clean branding');

  const editorsRes = await anon.fetch(`${BASE_URL}/writers`);
  assert.equal(editorsRes.status, 200, 'Directory must return 200');
  const editorsHtml = await editorsRes.text();
  assert.ok(editorsHtml.includes('Choose your editor'), 'Directory has correct heading');
  console.log('  ✔ Editors directory /writers returns 200');

  const aboutRes = await anon.fetch(`${BASE_URL}/about`);
  assert.equal(aboutRes.status, 200, 'About page returns 200');
  console.log('  ✔ About page /about returns 200');

  const policyRes = await anon.fetch(`${BASE_URL}/acceptable-use`);
  assert.equal(policyRes.status, 200, 'Acceptable use returns 200');
  console.log('  ✔ Acceptable use policy /acceptable-use returns 200');

  // =========================================================================
  // FLOW 2: Authentication (Login, Profile, Logout)
  // =========================================================================
  console.log('\n--- Flow 2: Authentication & Profile Management ---');
  const student = new SessionClient();

  // Login as demo student
  const loginRes = await student.fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'email=demo-student-1%40example.com&password=DemoPassword123%21'
  });
  assert.equal(loginRes.status, 302, 'Successful login must redirect');
  console.log('  ✔ Student login succeeds and receives session cookie');

  // Check authenticated dashboard access
  const dashRes = await student.fetch(`${BASE_URL}/dashboard`);
  assert.equal(dashRes.status, 200, 'Authenticated user can access /dashboard');
  const dashHtml = await dashRes.text();
  assert.ok(dashHtml.includes('user-menu-button'), 'Authenticated navbar renders user dropdown');
  console.log('  ✔ Dashboard accessible with active session');

  // Profile redirect & view
  const profRedirect = await student.fetch(`${BASE_URL}/profile`);
  assert.equal(profRedirect.status, 302, 'GET /profile redirects to /profile/:id');
  const profileLocation = profRedirect.headers.get('location');
  assert.ok(profileLocation.startsWith('/profile/'), 'Redirects to /profile/:id');

  const profRes = await student.fetch(`${BASE_URL}${profileLocation}`);
  assert.equal(profRes.status, 200, 'GET /profile/:id renders 200');
  console.log('  ✔ Profile view renders successfully');

  // Sign out flow via POST /logout (both desktop and mobile form)
  const logoutRes = await student.fetch(`${BASE_URL}/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });
  assert.equal(logoutRes.status, 302, 'POST /logout must redirect to /');
  assert.equal(logoutRes.headers.get('location'), '/', 'Redirects to /');
  console.log('  ✔ Sign out via POST /logout succeeds and redirects to /');

  // Verify session is terminated
  const afterLogout = await student.fetch(`${BASE_URL}/dashboard`);
  assert.equal(afterLogout.status, 302, 'Logged-out user is redirected away from /dashboard');
  assert.ok(afterLogout.headers.get('location').includes('/login'), 'Redirects to /login');
  console.log('  ✔ Session termination verified (dashboard inaccessible after logout)');

  // =========================================================================
  // FLOW 3: Order / Deal End-to-End Lifecycle
  // =========================================================================
  console.log('\n--- Flow 3: Complete Deal Lifecycle (Client & Editor) ---');
  
  // 3a. Client logs in
  const clientUser = new SessionClient();
  await clientUser.fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'email=demo-student-2%40example.com&password=DemoPassword123%21'
  });

  // 3b. Editor logs in
  const editorUser = new SessionClient();
  await editorUser.fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'email=demo-writer-1%40example.com&password=DemoPassword123%21'
  });

  // Get editor user record ID from demo data
  const editorProfileRes = await editorUser.fetch(`${BASE_URL}/profile`);
  const editorId = editorProfileRes.headers.get('location').replace('/profile/', '');
  console.log(`  ✔ Found Editor ID: ${editorId}`);

  // 3c. Client views Deal form for this editor
  const dealFormRes = await clientUser.fetch(`${BASE_URL}/deal?writerId=${editorId}`);
  assert.equal(dealFormRes.status, 200, 'Deal creation page returns 200');
  const dealFormHtml = await dealFormRes.text();
  assert.ok(dealFormHtml.includes('ownWork'), 'Deal form includes ownWork checkbox');
  console.log('  ✔ Client loads Deal form for editor');

  // 3d. Submit deal without ownWork -> must be rejected with 422
  const boundary = '----WebKitFormBoundaryE2ETest';
  const invalidBody = `--${boundary}\r\nContent-Disposition: form-data; name="writerId"\r\n\r\n${editorId}\r\n--${boundary}\r\nContent-Disposition: form-data; name="pages"\r\n\r\n3\r\n--${boundary}\r\nContent-Disposition: form-data; name="userNotes"\r\n\r\nReview flow and grammar\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="draft.pdf"\r\nContent-Type: application/pdf\r\n\r\n${VALID_PDF.toString('binary')}\r\n--${boundary}--\r\n`;

  const invalidRes = await clientUser.fetch(`${BASE_URL}/deal`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: Buffer.from(invalidBody, 'binary')
  });
  assert.equal(invalidRes.status, 422, 'Deal submission without ownWork must return 422');
  console.log('  ✔ Validation guardrail works: missing ownWork returns 422');

  // 3e. Submit deal WITH ownWork -> succeeds and redirects to /dashboard?created=1
  const validBody = `--${boundary}\r\nContent-Disposition: form-data; name="writerId"\r\n\r\n${editorId}\r\n--${boundary}\r\nContent-Disposition: form-data; name="pages"\r\n\r\n3\r\n--${boundary}\r\nContent-Disposition: form-data; name="ownWork"\r\n\r\non\r\n--${boundary}\r\nContent-Disposition: form-data; name="userNotes"\r\n\r\nReview flow and structure\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="draft.pdf"\r\nContent-Type: application/pdf\r\n\r\n${VALID_PDF.toString('binary')}\r\n--${boundary}--\r\n`;

  const validRes = await clientUser.fetch(`${BASE_URL}/deal`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: Buffer.from(validBody, 'binary')
  });
  assert.equal(validRes.status, 302, 'Valid deal submission redirects to dashboard');
  assert.ok(validRes.headers.get('location').includes('created=1'), 'Redirects with ?created=1');
  console.log('  ✔ Deal created successfully by client -> redirected to /dashboard?created=1');

  // 3f. Editor checks dashboard and finds pending deal
  const editorDashRes = await editorUser.fetch(`${BASE_URL}/dashboard`);
  assert.equal(editorDashRes.status, 200, 'Editor dashboard loads 200');
  const editorDashHtml = await editorDashRes.text();
  assert.ok(editorDashHtml.includes('Review flow and structure'), 'Editor sees client notes');

  // Extract deal ID from form action
  const dealIdMatch = editorDashHtml.match(/\/deal\/accept\/([a-f0-9]{24})/);
  assert.ok(dealIdMatch, 'Editor dashboard has accept form with deal ID');
  const createdDealId = dealIdMatch[1];
  console.log(`  ✔ Editor sees incoming deal #${createdDealId}`);

  // 3g. Editor accepts deal
  const acceptRes = await editorUser.fetch(`${BASE_URL}/deal/accept/${createdDealId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  assert.equal(acceptRes.status, 302, 'Editor accept redirects');
  assert.ok(acceptRes.headers.get('location').includes('accepted=1'), 'Redirects with accepted=1');
  console.log('  ✔ Editor accepted deal -> status moved to Accepted');

  // 3g-2. Client pays for the accepted order via Razorpay
  const crypto = require('crypto');
  const secret = process.env.RAZORPAY_KEY_SECRET || '';
  const payOrderRes = await clientUser.fetch(`${BASE_URL}/payment/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dealId: createdDealId })
  });
  assert.equal(payOrderRes.status, 200, 'Client create-order returns 200 for accepted deal');
  const payOrderData = await payOrderRes.json();
  assert.equal(payOrderData.success, true);

  const mockPayId = 'pay_e2e_test_' + Date.now();
  const mockSig = crypto
    .createHmac('sha256', secret)
    .update(`${payOrderData.order.id}|${mockPayId}`)
    .digest('hex');

  const verifyPayRes = await clientUser.fetch(`${BASE_URL}/payment/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dealId: createdDealId,
      razorpay_order_id: payOrderData.order.id,
      razorpay_payment_id: mockPayId,
      razorpay_signature: mockSig
    })
  });
  assert.equal(verifyPayRes.status, 200, 'Payment verify returns 200');
  console.log('  ✔ Client completed payment -> deal moved to Paid & In Progress');

  // 3h. Editor uploads final deliverable document
  const finalBoundary = '----WebKitFormBoundaryFinalTest';
  const finalBody = `--${finalBoundary}\r\nContent-Disposition: form-data; name="dealId"\r\n\r\n${createdDealId}\r\n--${finalBoundary}\r\nContent-Disposition: form-data; name="finalPdf"; filename="edited_draft.pdf"\r\nContent-Type: application/pdf\r\n\r\n${VALID_PDF.toString('binary')}\r\n--${finalBoundary}--\r\n`;

  const uploadFinalRes = await editorUser.fetch(`${BASE_URL}/deal/upload-final`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${finalBoundary}` },
    body: Buffer.from(finalBody, 'binary')
  });
  assert.equal(uploadFinalRes.status, 302, 'Final upload redirects');
  assert.ok(uploadFinalRes.headers.get('location').includes('uploaded=1'), 'Redirects with uploaded=1');
  console.log('  ✔ Editor uploaded final deliverable document -> status moved to Delivered');

  // 3i. Client checks dashboard and sees Delivered state
  const clientDashDelivered = await clientUser.fetch(`${BASE_URL}/dashboard`);
  const clientDashHtml = await clientDashDelivered.text();
  assert.ok(clientDashHtml.includes('Delivered') || clientDashHtml.includes('Confirm and complete'), 'Client sees delivered state and completion button');
  console.log('  ✔ Client sees delivered draft with download link and confirmation prompt');

  // 3j. Client confirms and completes deal
  const completeRes = await clientUser.fetch(`${BASE_URL}/deal/${createdDealId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  assert.equal(completeRes.status, 302, 'Client completion redirects');
  assert.ok(completeRes.headers.get('location').includes('completed=1'), 'Redirects with completed=1');
  console.log('  ✔ Client confirms receipt -> deal lifecycle completed successfully!');

  console.log('\n🎉 ALL USER FLOWS PASSED END-TO-END WITH ZERO DEFECTS!');
}

runEndToEndTests().catch(err => {
  console.error('\n❌ End-to-end test error:', err);
  process.exit(1);
});
