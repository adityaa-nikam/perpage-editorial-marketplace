const { execSync } = require('child_process');
const fs = require('fs');

const WRITER_ID = '6ac9698be050df3e1eb4d764';

const targets = [
  {
    name: 'deal',
    url: `http://localhost:3000/deal?writerId=${WRITER_ID}`
  },
  {
    name: 'dashboard',
    url: `http://localhost:3000/dashboard`
  }
];

const results = {};

for (const t of targets) {
  const outputPath = `scripts/lighthouse-${t.name}.json`;
  console.log(`Running mobile Lighthouse on ${t.url} with auth config...`);
  try {
    const cmd = `npx -y lighthouse "${t.url}" --config-path=scripts/lh-auth-config.json --output=json --output-path=${outputPath} --only-categories=performance,accessibility,best-practices,seo --form-factor=mobile --screenEmulation.mobile=true --throttling-method=simulate --chrome-flags="--headless=new --no-sandbox" --quiet`;
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

// Merge into summary
try {
  const summaryPath = 'scripts/lighthouse_summary.json';
  let summary = {};
  if (fs.existsSync(summaryPath)) {
    summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  }
  Object.assign(summary, results);
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log('\nFinal Lighthouse Mobile Summary:');
  console.log(JSON.stringify(summary, null, 2));
} catch (e) {
  console.error('Error updating summary:', e);
}
