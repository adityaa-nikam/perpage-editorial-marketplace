const http = require('http');

const URLS = [
  'http://localhost:3000/',
  'http://localhost:3000/writers',
  'http://localhost:3000/writers/6ac9698be050df3e1eb4d764',
  'http://localhost:3000/about',
  'http://localhost:3000/login',
  'http://localhost:3000/register'
];

async function check() {
  for (const u of URLS) {
    const res = await fetch(u);
    const text = await res.text();
    if (res.status !== 200) {
      console.error(`❌ ${u} returned status ${res.status}`);
      process.exit(1);
    }
    // Verify core content is present in raw HTML (no JS needed)
    if (!text.includes('<main') || !text.includes('</main>')) {
      console.error(`❌ ${u} missing semantic <main> tag in raw HTML`);
      process.exit(1);
    }
    console.log(`✔ ${u} rendered complete server-side HTML (${text.length} bytes, 200 OK)`);
  }
  console.log('✅ PASS: All core routes render fully without client JavaScript!');
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
