const { execSync } = require('child_process');
const fs = require('fs');

const WRITER_ID = '6ac9698be050df3e1eb4d764';
const STUDENT_ID = '6ac9698be050df3e1eb4d76d';

const TARGETS = [
  { name: 'home', url: 'http://localhost:3000/' },
  { name: 'writers', url: 'http://localhost:3000/writers' },
  { name: 'writer-profile', url: `http://localhost:3000/writers/${WRITER_ID}` },
  { name: 'about', url: 'http://localhost:3000/about' },
  { name: 'login', url: 'http://localhost:3000/login' },
  { name: 'register', url: 'http://localhost:3000/register' },
  { 
    name: 'deal', 
    url: `http://localhost:3000/deal?writerId=${WRITER_ID}`,
    extraHeaders: JSON.stringify({ 'x-mock-user': STUDENT_ID, 'x-mock-role': 'user', 'x-mock-name': 'Julian Croft' })
  },
  { 
    name: 'dashboard', 
    url: `http://localhost:3000/dashboard`,
    extraHeaders: JSON.stringify({ 'x-mock-user': STUDENT_ID, 'x-mock-role': 'user', 'x-mock-name': 'Julian Croft' })
  }
];

const results = {};

for (const t of TARGETS) {
  const outputPath = `scripts/lighthouse-${t.name}.json`;
  console.log(`Running mobile Lighthouse on ${t.url}...`);
  try {
    const extraHeadersFlag = t.extraHeaders ? `--extra-headers='${t.extraHeaders}'` : '';
    const cmd = `npx -y lighthouse "${t.url}" --output=json --output-path=${outputPath} --only-categories=performance,accessibility,best-practices,seo --form-factor=mobile --screenEmulation.mobile=true --throttling-method=simulate --chrome-flags="--headless=new --no-sandbox" ${extraHeadersFlag} --quiet`;
    execSync(cmd, { stdio: 'inherit' });
    const data = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    results[t.name] = {
      performance: Math.round((data.categories.performance?.score || 0) * 100),
      accessibility: Math.round((data.categories.accessibility?.score || 0) * 100),
      bestPractices: Math.round((data.categories['best-practices']?.score || 0) * 100),
      seo: data.categories.seo?.score !== null ? Math.round((data.categories.seo?.score || 0) * 100) : 'N/A (noindex)',
      cls: data.audits['cumulative-layout-shift']?.numericValue || 0
    };
    console.log(`Results for ${t.name}:`, results[t.name]);
  } catch (err) {
    console.error(`Failed on ${t.name}:`, err.message);
    results[t.name] = { error: err.message };
  }
}

fs.writeFileSync('scripts/lighthouse_summary.json', JSON.stringify(results, null, 2));
console.log('\nFinal Lighthouse Mobile Summary:');
console.log(JSON.stringify(results, null, 2));
