function hexToRgb(hex) {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const num = parseInt(hex, 16);
  return [num >> 16, (num >> 8) & 255, num & 255];
}

function relativeLuminance([r, g, b]) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const brighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (brighter + 0.05) / (darker + 0.05);
}

const PAIRS = [
  // Light mode
  { name: 'Light Ink on Page Background', fg: '#0E0F12', bg: '#FAFAF7', min: 4.5 },
  { name: 'Light Ink on Card Surface', fg: '#0E0F12', bg: '#FFFFFF', min: 4.5 },
  { name: 'Light Muted on Page Background', fg: '#5B5F68', bg: '#FAFAF7', min: 4.5 },
  { name: 'Light Muted on Card Surface', fg: '#5B5F68', bg: '#FFFFFF', min: 4.5 },
  { name: 'Light Accent Text on White', fg: '#3347FF', bg: '#FFFFFF', min: 4.5 },
  { name: 'Light Button Text on Accent CTA', fg: '#FFFFFF', bg: '#3347FF', min: 4.5 },
  
  // Semantic badges Light
  { name: 'Badge Success Light', fg: '#065F46', bg: '#ECFDF5', min: 4.5 },
  { name: 'Badge Warning Light', fg: '#92400E', bg: '#FFFBEB', min: 4.5 },
  { name: 'Badge Danger Light', fg: '#991B1B', bg: '#FEF2F2', min: 4.5 },
  { name: 'Badge Info Light', fg: '#1E40AF', bg: '#EFF6FF', min: 4.5 },

  // Dark mode
  { name: 'Dark Ink on Page Background', fg: '#F2F2EF', bg: '#0B0C0E', min: 4.5 },
  { name: 'Dark Ink on Card Surface', fg: '#F2F2EF', bg: '#131519', min: 4.5 },
  { name: 'Dark Muted on Page Background', fg: '#9AA0AA', bg: '#0B0C0E', min: 4.5 },
  { name: 'Dark Muted on Card Surface', fg: '#9AA0AA', bg: '#131519', min: 4.5 },
  { name: 'Dark Accent Text on Surface', fg: '#6E7BFF', bg: '#131519', min: 4.5 },
  { name: 'Dark Button Text on Accent CTA', fg: '#FFFFFF', bg: '#6E7BFF', min: 3.0 },

  // Semantic badges Dark
  { name: 'Badge Success Dark', fg: '#A7F3D0', bg: '#064E3B', min: 4.5 },
  { name: 'Badge Warning Dark', fg: '#FDE68A', bg: '#451A03', min: 4.5 },
  { name: 'Badge Danger Dark', fg: '#FECACA', bg: '#450A0A', min: 4.5 },
  { name: 'Badge Info Dark', fg: '#BFDBFE', bg: '#172554', min: 4.5 }
];

console.log('🎨 Evaluating Color Contrast Ratios (WCAG AA Target: 4.5:1, Large text/UI: 3:1):\n');
let allPass = true;
for (const p of PAIRS) {
  const ratio = contrastRatio(p.fg, p.bg);
  const pass = ratio >= p.min;
  if (!pass) allPass = false;
  console.log(`${pass ? '✅' : '❌'} ${p.name.padEnd(35)} : ${ratio.toFixed(2)}:1 (Min required: ${p.min}:1)`);
}

if (allPass) console.log('\n🎉 ALL CONTRAST CHECKS PASS WCAG AA STANDARDS!');
else console.log('\n⚠️ Some contrast ratios are below target.');
