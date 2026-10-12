const fs = require('fs');
const path = require('path');

const FONTS_DIR = path.join(__dirname, '..', 'public', 'fonts');
if (!fs.existsSync(FONTS_DIR)) {
  fs.mkdirSync(FONTS_DIR, { recursive: true });
}

async function downloadFonts() {
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  // 1. Source Serif 4 Variable
  console.log('Fetching Source Serif 4 CSS...');
  const res1 = await fetch('https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400..700&display=swap', {
    headers: { 'User-Agent': ua }
  });
  const css1 = await res1.text();

  // Find latin block
  const latin1Match = css1.match(/\/\* latin \*\/\s*@font-face\s*\{[^}]*src:\s*url\((https:[^)]+\.woff2)\)/);
  if (latin1Match) {
    const fontUrl = latin1Match[1];
    console.log('Downloading Source Serif 4 Latin:', fontUrl);
    const fontRes = await fetch(fontUrl);
    const buf = Buffer.from(await fontRes.arrayBuffer());
    fs.writeFileSync(path.join(FONTS_DIR, 'source-serif-4-latin-var.woff2'), buf);
    console.log(`Saved source-serif-4-latin-var.woff2 (${buf.length} bytes)`);
  } else {
    console.warn('Could not match latin subset for Source Serif 4');
  }

  // 2. Instrument Sans Variable
  console.log('Fetching Instrument Sans CSS...');
  const res2 = await fetch('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400..700&display=swap', {
    headers: { 'User-Agent': ua }
  });
  const css2 = await res2.text();

  const latin2Match = css2.match(/\/\* latin \*\/\s*@font-face\s*\{[^}]*src:\s*url\((https:[^)]+\.woff2)\)/);
  if (latin2Match) {
    const fontUrl = latin2Match[1];
    console.log('Downloading Instrument Sans Latin:', fontUrl);
    const fontRes = await fetch(fontUrl);
    const buf = Buffer.from(await fontRes.arrayBuffer());
    fs.writeFileSync(path.join(FONTS_DIR, 'instrument-sans-latin-var.woff2'), buf);
    console.log(`Saved instrument-sans-latin-var.woff2 (${buf.length} bytes)`);
  } else {
    console.warn('Could not match latin subset for Instrument Sans');
  }

  // Also download italic variant for Source Serif 4 if available
  const res3 = await fetch('https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@1,8..60,400..700&display=swap', {
    headers: { 'User-Agent': ua }
  });
  const css3 = await res3.text();
  const latin3Match = css3.match(/\/\* latin \*\/\s*@font-face\s*\{[^}]*src:\s*url\((https:[^)]+\.woff2)\)/);
  if (latin3Match) {
    const fontUrl = latin3Match[1];
    const fontRes = await fetch(fontUrl);
    const buf = Buffer.from(await fontRes.arrayBuffer());
    fs.writeFileSync(path.join(FONTS_DIR, 'source-serif-4-latin-italic-var.woff2'), buf);
    console.log(`Saved source-serif-4-latin-italic-var.woff2 (${buf.length} bytes)`);
  }
}

downloadFonts().catch(console.error);
