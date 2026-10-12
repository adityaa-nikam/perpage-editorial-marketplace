const fs = require('fs');

async function testHostileContent() {
  console.log('🧪 Testing Hostile Content Injection & Layout Resilience...\n');

  // Test 1: Deal notes with 2000 chars including <img src=x onerror=alert(1)>
  const xssPayload = '<img src=x onerror=alert(1)> ' + 'Lorem ipsum dolor sit amet '.repeat(70);
  const trimmedNotes = xssPayload.slice(0, 2000);

  const fd = new FormData();
  fd.append('writerId', '64f1a2b3c4d5e6f7a8b9c0d1');
  fd.append('pages', '4');
  fd.append('userNotes', trimmedNotes);
  const blob = new Blob(['%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n'], { type: 'application/pdf' });
  fd.append('file', blob, 'notes_test.pdf');

  const createRes = await fetch('http://localhost:3000/deal', {
    method: 'POST',
    headers: {
      'x-mock-user': '64f1a2b3c4d5e6f7a8b9c0d9',
      'x-mock-role': 'user'
    },
    body: fd,
    redirect: 'manual'
  });

  console.log('1. Deal Creation with 2000-char XSS payload status:', createRes.status, createRes.headers.get('location'));

  // Test 2: Check student and writer dashboard rendering for XSS escaping
  const studentDash = await fetch('http://localhost:3000/dashboard?mockUser=student');
  const studentHtml = await studentDash.text();

  const writerDash = await fetch('http://localhost:3000/dashboard?mockUser=writer');
  const writerHtml = await writerDash.text();

  const studentEscaped = !studentHtml.includes('<img src=x onerror=alert(1)>') && studentHtml.includes('&lt;img src=x');
  const writerEscaped = !writerHtml.includes('<img src=x onerror=alert(1)>') && writerHtml.includes('&lt;img src=x');

  console.log('2. Student Dashboard XSS payload properly escaped:', studentEscaped);
  console.log('3. Writer Dashboard XSS payload properly escaped:', writerEscaped);

  // Test 3: Check Writer Profile with 80-char unbroken name and 500-char bio
  // Let's inspect writer card in writers list and writer profile
  const longName = 'A'.repeat(80);
  const longBio = 'B'.repeat(500);

  console.log('4. CSS break-words rule check on writer card and notes...');
  const css = fs.readFileSync('public/css/app.css', 'utf8');
  const hasWordBreak = css.includes('break-words') || css.includes('overflow-wrap: break-word') || css.includes('word-break: break-word');
  console.log('   break-words utility compiled in CSS:', hasWordBreak);

  if (studentEscaped && writerEscaped && hasWordBreak) {
    console.log('\n🎉 ALL HOSTILE CONTENT CHECKS PASSED!');
  } else {
    console.log('\n⚠️ Some hostile checks failed.');
  }
}

testHostileContent().catch(e => console.error(e));
