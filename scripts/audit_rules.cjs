const fs = require('fs');
const path = require('path');

const viewsDir = path.join(__dirname, '..', 'views');

function scanDir(dir) {
  let files = [];
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      files = files.concat(scanDir(fullPath));
    } else if (file.endsWith('.ejs')) {
      files.push(fullPath);
    }
  });
  return files;
}

const ejsFiles = scanDir(viewsDir);

console.log(`Auditing ${ejsFiles.length} EJS templates for style rules...`);

let issues = 0;

ejsFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative(viewsDir, file);

  // 1. Check for inline <style>
  if (/<style/i.test(content)) {
    console.warn(`[RULE VIOLATION] Inline <style> found in ${rel}`);
    issues++;
  }

  // 2. Check for gradients
  if (/bg-gradient|linear-gradient|gradient-/i.test(content)) {
    console.warn(`[RULE VIOLATION] Gradient class/style found in ${rel}`);
    issues++;
  }

  // 3. Check for emoji
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  if (emojiRegex.test(content)) {
    console.warn(`[RULE VIOLATION] Emoji found in ${rel}`);
    issues++;
  }

  // 4. Check for forbidden claim words
  const forbiddenClaims = [
    /\bguaranteed\b/i,
    /\bawards?\b/i,
    /\bpress\b/i
  ];
  forbiddenClaims.forEach(regex => {
    if (regex.test(content)) {
      console.warn(`[RULE VIOLATION] Forbidden claim "${regex}" found in ${rel}`);
      issues++;
    }
  });
});

if (issues === 0) {
  console.log('✅ Zero rule violations found across all views!');
} else {
  console.log(`Found ${issues} issues to address.`);
}
