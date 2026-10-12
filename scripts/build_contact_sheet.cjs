const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VISUAL_DIR = path.join(ROOT, 'docs', 'visual-8-2');
const BEFORE_DIR = path.join(VISUAL_DIR, 'before');
const AFTER_DIR = path.join(VISUAL_DIR, 'after');
const CONTACT_SHEET_PATH = path.join(VISUAL_DIR, 'CONTACT_SHEET.html');

const comparisons = [
  { label: 'Landing Page (1440px Light — Paper Primary)', file: 'landing-1440-light.png' },
  { label: 'Landing Page (1440px Dark — Deep Obsidian)', file: 'landing-1440-dark.png' },
  { label: 'Landing Page (390px Mobile Light)', file: 'landing-390-light.png' },
  { label: 'Landing Page (390px Mobile Dark)', file: 'landing-390-dark.png' },

  { label: 'Editors Directory (1440px Light)', file: 'editors-1440-light.png' },
  { label: 'Editors Directory (1440px Dark)', file: 'editors-1440-dark.png' },
  { label: 'Editors Directory (390px Mobile Light)', file: 'editors-390-light.png' },
  { label: 'Editors Directory (390px Mobile Dark)', file: 'editors-390-dark.png' },

  { label: 'Editor Profile (1440px Light)', file: 'profile-1440-light.png' },
  { label: 'Editor Profile (1440px Dark)', file: 'profile-1440-dark.png' },
  { label: 'Editor Profile (390px Mobile Light)', file: 'profile-390-light.png' },
  { label: 'Editor Profile (390px Mobile Dark)', file: 'profile-390-dark.png' },

  { label: 'Login (1440px Light)', file: 'login-1440-light.png' },
  { label: 'Login (1440px Dark)', file: 'login-1440-dark.png' },
  { label: 'Login (390px Mobile Light)', file: 'login-390-light.png' },
  { label: 'Login (390px Mobile Dark)', file: 'login-390-dark.png' },

  { label: 'Dashboard (1440px Light)', file: 'dashboard-1440-light.png' },
  { label: 'Dashboard (1440px Dark)', file: 'dashboard-1440-dark.png' },
  { label: 'Dashboard (390px Mobile Light)', file: 'dashboard-390-light.png' },
  { label: 'Dashboard (390px Mobile Dark)', file: 'dashboard-390-dark.png' }
];

const heroMoments = [
  { label: 'Moment 1: Original Draft (Pending Status)', file: 'hero-01-original.png' },
  { label: 'Moment 2: Errors Struck in --mark', file: 'hero-02-marked.png' },
  { label: 'Moment 3: Caret Corrections Inserted', file: 'hero-03-corrected.png' },
  { label: 'Moment 4: Margin Note Revealed', file: 'hero-04-comment.png' },
  { label: 'Moment 5: Delivered Status & Calculations Agree', file: 'hero-05-delivered.png' }
];

const howItWorksSteps = [
  { label: 'Step 1: Browse Editors (Profile & Rate Preview)', file: 'how-it-works-step1.png' },
  { label: 'Step 2: Create a Deal (Upload & Math Preview)', file: 'how-it-works-step2.png' },
  { label: 'Step 3: Track to Delivery (Delivered & Download Preview)', file: 'how-it-works-step3.png' }
];

const specialCases = [
  { label: 'Hero Static State (prefers-reduced-motion: reduce)', file: 'hero-reduced-motion.png' },
  { label: 'Hero Static State (JavaScript Disabled)', file: 'hero-js-disabled.png' },
  { label: 'Brand Intro Loader (Mid-fade stroke animation)', file: 'intro-loader-midfade.png' }
];

let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PerPage Visual 8.2 Upgrade — Before & After Contact Sheet</title>
  <style>
    :root {
      --bg: #FAF8F5;
      --surface: #FFFFFF;
      --text: #141413;
      --muted: #5C5B56;
      --border: #E6E2D8;
      --mark: #C23B27;
      --accent: #1F3BB3;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 40px 24px;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    header {
      margin-bottom: 48px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border);
    }
    .eyebrow {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--mark);
      margin-bottom: 8px;
    }
    h1 {
      font-size: 32px;
      font-family: Georgia, serif;
      font-weight: normal;
      margin-bottom: 12px;
    }
    p.lead {
      color: var(--muted);
      font-size: 16px;
      max-width: 800px;
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      font-size: 11px;
      font-weight: 600;
      border-radius: 4px;
      background: #EAE6DD;
      margin-right: 8px;
    }
    .badge-before { background: #FDE8E8; color: #9B1C1C; }
    .badge-after { background: #DEF7EC; color: #03543F; }
    .section-title {
      font-size: 22px;
      font-family: Georgia, serif;
      margin: 48px 0 20px 0;
      padding-bottom: 8px;
      border-bottom: 2px solid var(--border);
    }
    .comparison-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 36px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }
    .panel {
      display: flex;
      flex-direction: column;
    }
    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      font-size: 13px;
      font-weight: 600;
    }
    .panel-img {
      border: 1px solid var(--border);
      border-radius: 4px;
      overflow: hidden;
      background: #eee;
    }
    .panel-img img {
      display: block;
      width: 100%;
      height: auto;
    }
    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: 24px;
      margin-bottom: 40px;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
    }
    .card-title {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 12px;
      color: var(--text);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="eyebrow">Visual 8.2 Audit & Verification</div>
      <h1>PerPage — Before &amp; After Visual Upgrade Contact Sheet</h1>
      <p class="lead">
        Comprehensive side-by-side comparison of Prompt 8.2 visual transformation: replacing generic AI/SaaS template tells with authentic publishing craft, self-hosted typography (Source Serif 4 &amp; Instrument Sans), proofreader marks motif, interactive tracked changes document sheet, and scroll-driven how-it-works layout.
      </p>
    </header>

    <h2 class="section-title">Core Views: Before vs. After (Side-by-Side)</h2>
`;

comparisons.forEach(item => {
  html += `
    <div class="comparison-grid">
      <div class="panel">
        <div class="panel-header">
          <span>${item.label}</span>
          <span class="badge badge-before">BEFORE (Prompt 8.1)</span>
        </div>
        <div class="panel-img">
          <img src="before/${item.file}" alt="Before: ${item.label}">
        </div>
      </div>
      <div class="panel">
        <div class="panel-header">
          <span>${item.label}</span>
          <span class="badge badge-after">AFTER (Visual 8.2 Human Design)</span>
        </div>
        <div class="panel-img">
          <img src="after/${item.file}" alt="After: ${item.label}">
        </div>
      </div>
    </div>
  `;
});

html += `
    <h2 class="section-title">Hero Tracked Changes Document Sheet: 5 Animation Moments</h2>
    <div class="card-grid">
`;

heroMoments.forEach(m => {
  html += `
      <div class="card">
        <div class="card-title">${m.label}</div>
        <div class="panel-img">
          <img src="after/${m.file}" alt="${m.label}">
        </div>
      </div>
  `;
});

html += `
    </div>

    <h2 class="section-title">How It Works: Scroll-Driven Sticky Step Sequence</h2>
    <div class="card-grid">
`;

howItWorksSteps.forEach(s => {
  html += `
      <div class="card">
        <div class="card-title">${s.label}</div>
        <div class="panel-img">
          <img src="after/${s.file}" alt="${s.label}">
        </div>
      </div>
  `;
});

html += `
    </div>

    <h2 class="section-title">Accessibility &amp; Brand Intro States</h2>
    <div class="card-grid">
`;

specialCases.forEach(sc => {
  html += `
      <div class="card">
        <div class="card-title">${sc.label}</div>
        <div class="panel-img">
          <img src="after/${sc.file}" alt="${sc.label}">
        </div>
      </div>
  `;
});

html += `
    </div>
  </div>
</body>
</html>
`;

fs.writeFileSync(CONTACT_SHEET_PATH, html, 'utf8');
console.log('✅ CONTACT_SHEET.html built successfully at:', CONTACT_SHEET_PATH);
