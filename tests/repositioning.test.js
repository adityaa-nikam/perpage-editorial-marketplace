import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

describe('PerPage Repositioning & Guardrails Test Suite', () => {

  describe('1. Guardrail A: /acceptable-use Policy Route', () => {
    it('GET /acceptable-use returns 200 with complete policy sections', async () => {
      const res = await fetch(`${BASE_URL}/acceptable-use`);
      assert.equal(res.status, 200);
      const html = await res.text();

      assert.ok(html.includes('Acceptable Use Policy'), 'Page title/heading present');
      assert.ok(html.includes('Platform Scope'), 'Platform scope section present');
      assert.ok(html.includes('Permitted Scope'), 'Permitted scope section present');
      assert.ok(html.includes('Prohibited Scope'), 'Prohibited scope section present');
      assert.ok(/client requirements/i.test(html), 'Client requirements section present');
      assert.ok(/institutional/i.test(html), 'Institutional rules section present');
      assert.ok(html.includes('Demonstration Project Notice'), 'Demo project disclaimer present');
      assert.ok(html.includes('No real payments are processed in this demo.'), 'Honest payment disclaimer present');
    });

    it('Policy is linked from footer', async () => {
      const res = await fetch(`${BASE_URL}/`);
      const html = await res.text();
      assert.ok(html.includes('href="/acceptable-use"'), 'Footer links to /acceptable-use');
    });
  });

  describe('2. Guardrail B: ownWork Checkbox & Validation on /deal', () => {
    it('GET /deal includes ownWork checkbox and exact label', async () => {
      const res = await fetch(`${BASE_URL}/deal?writerId=64f1a2b3c4d5e6f7a8b9c0d1&mockUser=1`);
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.ok(html.includes('name="ownWork"'), 'ownWork checkbox input exists');
      assert.ok(
        html.includes("This is my own work. I'm asking for editing or feedback, not for someone to write it for me."),
        'Exact required ownWork label must be present'
      );
      assert.ok(html.includes('href="/acceptable-use"'), 'Deal page links to /acceptable-use');
    });

    it('POST /deal without ownWork fails with 422 before file upload', async () => {
      // Create FormData without ownWork
      const formData = new FormData();
      formData.append('writerId', '64f1a2b3c4d5e6f7a8b9c0d1');
      formData.append('pages', '5');
      formData.append('userNotes', 'Please review my draft essay for flow.');
      // Attach a minimal mock PDF as field name 'file'
      const mockPdfBlob = new Blob(['%PDF-1.4 mock content'], { type: 'application/pdf' });
      formData.append('file', mockPdfBlob, 'test-draft.pdf');

      const res = await fetch(`${BASE_URL}/deal`, {
        method: 'POST',
        headers: {
          'Origin': BASE_URL,
          'Referer': `${BASE_URL}/deal?writerId=64f1a2b3c4d5e6f7a8b9c0d1`,
          'x-mock-user': '64f1a2b3c4d5e6f7a8b9c0d9',
          'x-mock-role': 'user'
        },
        body: formData
      });

      assert.equal(res.status, 422, 'Must return 422 Unprocessable Entity');
      const html = await res.text();
      assert.ok(
        html.includes("You must confirm that this is your own work and you are seeking editing or feedback."),
        'Validation error message must be shown'
      );
      assert.ok(html.includes('href="#ownWork"'), 'Error summary anchor to #ownWork must be present');
    });
  });

  describe('3. Required Text Statements on Landing Page & Roles', () => {
    it('Landing page hero and required statement', async () => {
      const res = await fetch(`${BASE_URL}/`);
      assert.equal(res.status, 200);
      const html = await res.text();

      assert.ok(html.includes('Find an editor. Agree a price. Improve your draft.'), 'Hero H1 correct');
      assert.ok(html.includes('Editors improve your writing. They do not write it for you.'), 'Required guardrail line present');
      assert.ok(html.includes('Editing Deal No. 1042'), 'Mockup editing deal title present');
      assert.ok(html.includes('Report draft, 12 pages'), 'Mockup draft details present');
      assert.ok(html.includes('report-draft.pdf'), 'Mockup brief file present');
      assert.ok(html.includes('Browse editors'), 'Browse editors button present');
      assert.ok(html.includes('Featured Editors'), 'Featured editors heading present');
      assert.ok(html.includes('Freelance Editor'), 'Freelance editor badge present');
    });

    it('Landing page contains the 3 required FAQ entries', async () => {
      const res = await fetch(`${BASE_URL}/`);
      const html = await res.text();

      // FAQ A: Will an editor write my document?
      assert.ok(html.includes('Will an editor write my document?'), 'FAQ A question present');
      assert.ok(html.includes('Editors work on text you wrote'), 'FAQ A answer present');

      // FAQ B: Is this allowed by my college?
      assert.ok(html.includes('Is this allowed by my college?'), 'FAQ B question present');
      assert.ok(html.includes("check your institution's specific honor code"), 'FAQ B answer present');

      // FAQ C: Is this a live service?
      assert.ok(html.includes('Is this a live service?'), 'FAQ C question present');
      assert.ok(html.includes('No real payments are processed in this demo.'), 'FAQ C exact required disclaimer line present');
    });

    it('Registration page contains editor guardrail statement and link', async () => {
      const res = await fetch(`${BASE_URL}/register`);
      assert.equal(res.status, 200);
      const html = await res.text();

      assert.ok(
        html.includes("You give feedback and edits on the client's own text. You do not write documents from scratch."),
        'Register page editor scope note present'
      );
      assert.ok(html.includes('href="/acceptable-use"'), 'Register page links to /acceptable-use');
    });

    it('Profile page contains editor guardrail statement', async () => {
      const res = await fetch(`${BASE_URL}/profile/64f1a2b3c4d5e6f7a8b9c0d1?mockUser=1`);
      assert.equal(res.status, 200);
      const html = await res.text();

      assert.ok(
        html.includes("You give feedback and edits on the client's own text. You do not write documents from scratch."),
        'Profile page editor scope note present'
      );
    });
  });

  describe('4. Navigation & Directory Repositioning', () => {
    it('Navbar displays "Editors" instead of "Writers"', async () => {
      const res = await fetch(`${BASE_URL}/`);
      const html = await res.text();

      assert.ok(html.includes('href="/writers"'), 'Navbar has link to /writers');
      assert.ok(/href="\/writers"[^>]*>[\s\n]*Editors[\s\n]*<\/a>/.test(html), 'Navbar link text is Editors');
    });

    it('Directory displays "Choose your editor"', async () => {
      const res = await fetch(`${BASE_URL}/writers`);
      assert.equal(res.status, 200);
      const html = await res.text();

      assert.ok(html.includes('Choose your editor'), 'Directory heading is Choose your editor');
      assert.ok(html.includes('Search by editor name'), 'Search placeholder mentions editor');
    });
  });

});
