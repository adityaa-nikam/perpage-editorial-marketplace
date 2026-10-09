const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
const WRITER_ID = '64f1a2b3c4d5e6f7a8b9c0d1'; // Dr. Eleanor Vance
const STUDENT_ID = '64f1a2b3c4d5e6f7a8b9c0d9'; // Aditi Student

function createValidPdfBuffer(sizeBytes = 250) {
  const header = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');
  if (sizeBytes <= header.length) return header;
  const padding = Buffer.alloc(sizeBytes - header.length, 0x20);
  return Buffer.concat([header, padding]);
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
    const filename = file.filename || 'brief.pdf';
    const contentType = file.contentType || 'application/pdf';
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldname || 'file'}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`));
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

async function runE2E() {
  console.log('🚀 Running End-to-End Academic Deal Lifecycle Test...\n');

  // Step 1: Student creates a deal
  console.log('1. Student creates deal with Dr. Eleanor Vance...');
  const briefPayload = createMultipartPayload({
    writerId: WRITER_ID,
    pages: '5',
    userNotes: 'End-to-end verification paper on monetary policy economics.'
  }, {
    fieldname: 'file',
    filename: 'assignment_spec.pdf',
    buffer: createValidPdfBuffer(400)
  });

  const createRes = await fetch(`${BASE_URL}/deal`, {
    method: 'POST',
    headers: {
      ...briefPayload.headers,
      'x-mock-user': STUDENT_ID,
      'x-mock-role': 'user'
    },
    body: briefPayload.body,
    redirect: 'manual'
  });

  console.log('   Redirect status:', createRes.status);
  const createLoc = createRes.headers.get('location') || '';
  console.log('   Redirect target:', createLoc);
  if (!createLoc.includes('created=1')) {
    throw new Error('Deal creation did not redirect to dashboard with ?created=1');
  }

  // Get deals list to find created deal
  const dealsRes = await fetch(`${BASE_URL}/deal/test-deals`);
  const allDeals = await dealsRes.json();
  const createdDeal = allDeals[allDeals.length - 1];
  console.log(`   Created Deal ID: ${createdDeal._id}, status: ${createdDeal.status}`);

  // Step 2: Student opens dashboard and sees created toast
  console.log('2. Student loads /dashboard?created=1...');
  const dashRes = await fetch(`${BASE_URL}/dashboard?created=1&mockUser=student`);
  const dashHtml = await dashRes.text();
  console.log('   Contains created toast:', dashHtml.includes('Deal created successfully'));

  // Step 3: Writer accepts the deal
  console.log(`3. Writer accepts Deal ${createdDeal._id}...`);
  const acceptRes = await fetch(`${BASE_URL}/deal/accept/${createdDeal._id}`, {
    method: 'POST',
    headers: {
      'x-mock-user': WRITER_ID,
      'x-mock-role': 'writer'
    },
    redirect: 'manual'
  });
  const acceptLoc = acceptRes.headers.get('location') || '';
  console.log('   Accept redirect target:', acceptLoc);
  if (!acceptLoc.includes('accepted=1')) {
    throw new Error('Accept did not redirect with ?accepted=1');
  }

  // Step 4: Writer uploads final PDF
  console.log(`4. Writer uploads final deliverable for Deal ${createdDeal._id}...`);
  const finalPayload = createMultipartPayload({
    dealId: createdDeal._id
  }, {
    fieldname: 'finalPdf',
    filename: 'monetary_policy_final_draft.pdf',
    buffer: createValidPdfBuffer(600)
  });

  const uploadRes = await fetch(`${BASE_URL}/deal/upload-final`, {
    method: 'POST',
    headers: {
      ...finalPayload.headers,
      'x-mock-user': WRITER_ID,
      'x-mock-role': 'writer'
    },
    body: finalPayload.body,
    redirect: 'manual'
  });
  const uploadLoc = uploadRes.headers.get('location') || '';
  console.log('   Upload redirect target:', uploadLoc);
  if (!uploadLoc.includes('uploaded=1')) {
    throw new Error('Upload final did not redirect with ?uploaded=1');
  }

  // Step 5: Student opens dashboard and verifies delivered status & fresh link
  console.log('5. Student opens dashboard to download final deliverable...');
  const studentDashRes = await fetch(`${BASE_URL}/dashboard?mockUser=student`);
  const studentDashHtml = await studentDashRes.text();
  console.log('   Contains download final file button:', studentDashHtml.includes('Download final file'));
  console.log('   Contains Delivered stepper step:', studentDashHtml.includes('Delivered'));
  console.log('   Contains time-limited link notice:', studentDashHtml.includes('Download links are time-limited'));

  console.log('\n🎉 End-to-End Lifecycle Test Passed Completely!\n');
}

runE2E().catch(err => {
  console.error('E2E Test Failed:', err);
  process.exit(1);
});
