import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load allowlist
const allowlistPath = path.join(rootDir, 'config', 'vocab-allowlist.json');
let allowlist = { allowed: [] };
if (fs.existsSync(allowlistPath)) {
  try {
    allowlist = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
  } catch (err) {
    console.error('⚠️ Could not parse vocab-allowlist.json:', err.message);
  }
}

const BANNED_TERMS = [
  'secure',
  'securely',
  'encrypted',
  'verified',
  'guarantee',
  'milestone',
  'specialt',
  'currently open',
  'security model',
  'database schema',
  'backed directly',
  'pipeline status'
];

function getFiles(dir, exts) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      results = results.concat(getFiles(full, exts));
    } else if (exts.some(ext => item.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

const targetFiles = [
  ...getFiles(path.join(rootDir, 'views'), ['.ejs', '.html']),
  ...getFiles(path.join(rootDir, 'config'), ['.js', '.json']).filter(f => !f.endsWith('vocab-allowlist.json')),
  path.join(rootDir, 'README.md'),
  path.join(rootDir, 'package.json')
].filter(f => fs.existsSync(f));

let violations = [];

for (const filePath of targetFiles) {
  const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    for (const term of BANNED_TERMS) {
      const regex = new RegExp(`\\b${term}|${term}`, 'i');
      if (regex.test(line)) {
        // Check allowlist
        const isAllowed = (allowlist.allowed || []).some(entry => {
          const entryFile = (entry.file || '').replace(/\\/g, '/');
          if (entryFile !== relPath) return false;
          if (entry.term && entry.term.toLowerCase() !== term.toLowerCase()) return false;
          if (entry.pattern) {
            const patRegex = new RegExp(entry.pattern, 'i');
            return patRegex.test(line);
          }
          return true;
        });

        if (!isAllowed) {
          violations.push({
            file: relPath,
            line: index + 1,
            term: term,
            content: line.trim()
          });
        }
      }
    }
  });
}

console.log(`🔍 Audited ${targetFiles.length} files for banned vocabulary...`);

if (violations.length > 0) {
  console.error(`\n❌ Found ${violations.length} unapproved vocabulary violation(s):`);
  violations.forEach(v => {
    console.error(`  - ${v.file}:${v.line} [matched "${v.term}"]: ${v.content}`);
  });
  console.error('\nTo approve legitimate code identifiers, add an entry to config/vocab-allowlist.json.');
  process.exit(1);
} else {
  console.log(`✅ All ${targetFiles.length} files passed vocabulary checks with zero violations.`);
  process.exit(0);
}
