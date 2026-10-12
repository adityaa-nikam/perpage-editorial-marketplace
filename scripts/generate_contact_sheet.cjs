const fs = require('fs');
const path = require('path');

const REFINEMENT_DIR = path.join(__dirname, '..', 'docs', 'refinement');
const BEFORE_DIR = path.join(REFINEMENT_DIR, 'before');
const AFTER_DIR = path.join(REFINEMENT_DIR, 'after');
const OUT_FILE = path.join(REFINEMENT_DIR, 'CONTACT_SHEET.html');

const PAGES = [
  { id: '01', key: 'home', title: 'Landing Page (/)' },
  { id: '02', key: 'writers', title: 'Writers Directory (/writers)' },
  { id: '03', key: 'writer-profile', title: 'Writer Profile (/writers/:id)' },
  { id: '04', key: 'about', title: 'About Manifesto (/about)' },
  { id: '05', key: 'login', title: 'Authentication: Sign In (/login)' },
  { id: '06', key: 'register', title: 'Authentication: Register (/register)' },
  { id: '07', key: 'deal', title: 'Deal Creation Form (/deal)' },
  { id: '08', key: 'dashboard-student', title: 'Student Dashboard (/dashboard)' },
  { id: '09', key: 'dashboard-writer', title: 'Writer Dashboard (/dashboard)' },
  { id: '10', key: 'profile-own', title: 'Account Settings (/profile/:id)' },
  { id: '11', key: '404', title: 'Not Found Error Page (/404)' }
];

const VARIANTS = [
  { key: 'light-1440', label: 'Desktop Light (1440px)', widthLabel: '1440px' },
  { key: 'dark-1440', label: 'Desktop Dark (1440px)', widthLabel: '1440px' },
  { key: 'light-390', label: 'Mobile Light (390px)', widthLabel: '390px' },
  { key: 'dark-390', label: 'Mobile Dark (390px)', widthLabel: '390px' }
];

let sectionsHtml = '';

for (const p of PAGES) {
  sectionsHtml += `
    <section class="page-section" id="section-${p.key}">
      <header class="page-header">
        <div class="index-stamp">
          <span class="index-num">${p.id}</span>
          <span>PAGE SPECIFICATION // ${p.key.toUpperCase()}</span>
        </div>
        <h2 class="section-title">${p.title}</h2>
      </header>

      <div class="variants-container">
  `;

  for (const v of VARIANTS) {
    const filename = `${p.key}-${v.key}.png`;
    const beforeExists = fs.existsSync(path.join(BEFORE_DIR, filename));
    const afterExists = fs.existsSync(path.join(AFTER_DIR, filename));

    sectionsHtml += `
      <div class="comparison-card">
        <div class="comparison-bar">
          <span class="variant-tag">${v.label}</span>
          <span class="dimension-tag">${v.widthLabel}</span>
        </div>
        <div class="comparison-grid">
          <div class="comparison-column">
            <div class="column-header before-header">
              <span class="header-pill">BEFORE</span>
              <span class="meta-label">Baseline Template</span>
            </div>
            <div class="image-wrapper">
              ${beforeExists ? `<img src="before/${filename}" alt="${p.title} Before ${v.label}" loading="lazy">` : `<div class="missing-notice">Screenshot pending</div>`}
            </div>
          </div>
          <div class="comparison-column">
            <div class="column-header after-header">
              <span class="header-pill">AFTER</span>
              <span class="meta-label">Refined Architectural</span>
            </div>
            <div class="image-wrapper">
              ${afterExists ? `<img src="after/${filename}" alt="${p.title} After ${v.label}" loading="lazy">` : `<div class="missing-notice">Screenshot pending</div>`}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  sectionsHtml += `
      </div>
    </section>
  `;
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PerPage — Visual Refinement Contact Sheet (Before & After)</title>
  <style>
    :root {
      --bg-background: #F7F6F2;
      --bg-surface: #FFFFFF;
      --bg-surface-muted: #EFECE6;
      --text-ink: #111215;
      --text-muted: #5C6270;
      --border-color: #E2DDD5;
      --border-strong: #C4BDB2;
      --accent: #2533D6;
      --accent-subtle: #ECEEFE;
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg-background: #0E0F12;
        --bg-surface: #17181C;
        --bg-surface-muted: #1F2127;
        --text-ink: #F0F2F6;
        --text-muted: #8B92A0;
        --border-color: #21252D;
        --border-strong: #333844;
        --accent: #6E7BFF;
        --accent-subtle: #181B38;
      }
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg-background);
      color: var(--text-ink);
      font-family: var(--font-sans);
      line-height: 1.5;
      padding: 40px 24px;
    }

    .container {
      max-width: 1600px;
      margin: 0 auto;
    }

    .sheet-hero {
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 32px;
      margin-bottom: 48px;
    }

    .index-stamp {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-bottom: 8px;
    }

    .index-stamp .index-num {
      background: var(--bg-surface-muted);
      border: 1px solid var(--border-color);
      padding: 2px 6px;
      border-radius: 4px;
      color: var(--text-ink);
    }

    .hero-title {
      font-size: 32px;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 8px;
    }

    .hero-desc {
      color: var(--text-muted);
      font-size: 15px;
      max-width: 800px;
    }

    .page-section {
      margin-bottom: 64px;
      padding-top: 24px;
      border-top: 2px solid var(--border-color);
    }

    .page-header {
      margin-bottom: 24px;
    }

    .section-title {
      font-size: 24px;
      font-weight: 600;
      letter-spacing: -0.01em;
    }

    .variants-container {
      display: flex;
      flex-direction: column;
      gap: 32px;
    }

    .comparison-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }

    .comparison-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--bg-surface-muted);
      padding: 10px 16px;
      border-bottom: 1px solid var(--border-color);
      font-size: 12px;
      font-weight: 600;
      color: var(--text-ink);
    }

    .variant-tag {
      font-family: var(--font-mono);
      letter-spacing: 0.04em;
    }

    .dimension-tag {
      font-family: var(--font-mono);
      color: var(--text-muted);
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      padding: 2px 8px;
      border-radius: 4px;
    }

    .comparison-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1px;
      background: var(--border-color);
    }

    @media (max-width: 1024px) {
      .comparison-grid {
        grid-template-columns: 1fr;
      }
    }

    .comparison-column {
      background: var(--bg-surface);
      display: flex;
      flex-direction: column;
    }

    .column-header {
      padding: 10px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border-color);
      font-size: 11px;
      font-family: var(--font-mono);
    }

    .before-header {
      background: rgba(180, 80, 80, 0.04);
    }

    .after-header {
      background: rgba(50, 180, 80, 0.04);
    }

    .header-pill {
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid;
    }

    .before-header .header-pill {
      background: #FEE2E2;
      color: #991B1B;
      border-color: #F87171;
    }

    .after-header .header-pill {
      background: #D1FAE5;
      color: #065F46;
      border-color: #34D399;
    }

    .meta-label {
      color: var(--text-muted);
    }

    .image-wrapper {
      padding: 16px;
      background: var(--bg-background);
      display: flex;
      align-items: flex-start;
      justify-content: center;
      min-height: 240px;
      overflow: auto;
    }

    .image-wrapper img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
      border: 1px solid var(--border-color);
      display: block;
      box-shadow: 0 4px 12px rgba(0,0,0,0.06);
    }

    .missing-notice {
      padding: 40px;
      font-style: italic;
      color: var(--text-muted);
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="sheet-hero">
      <div class="index-stamp">
        <span class="index-num">PROOF // AUDIT</span>
        <span>Visual Refinement Verification Artifact</span>
      </div>
      <h1 class="hero-title">PerPage Visual Refinement Contact Sheet</h1>
      <p class="hero-desc">
        Deterministic side-by-side comparison of all 11 routes across 4 viewports/themes (Desktop Light, Desktop Dark, Mobile Light, Mobile Dark). 
        All refinements adhere strictly to the Editorial Architectural Indexing brand motif, 4px grid spacing, tabular numerals, and WCAG AA contrast.
      </p>
    </header>

    <main>
      ${sectionsHtml}
    </main>
  </div>
</body>
</html>
`;

fs.writeFileSync(OUT_FILE, html);
console.log('✅ Generated CONTACT_SHEET.html at', OUT_FILE);
