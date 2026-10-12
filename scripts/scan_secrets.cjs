const { execSync } = require('child_process');

const patterns = [
  'AKIA',
  'mongodb://',
  'mongodb+srv://',
  'client_secret',
  'AWS_SECRET_ACCESS_KEY'
];

console.log('🔒 Scanning Git History & Working Tree for Secrets...\n');

for (const pat of patterns) {
  try {
    const out = execSync(`git log --all -S "${pat}" --pretty=format:"%h - %an: %s"`, { encoding: 'utf8' }).trim();
    if (out) {
      console.log(`Pattern "${pat}" found in commits:`);
      console.log(out);
    } else {
      console.log(`Pattern "${pat}": No occurrences in git history.`);
    }
  } catch (e) {
    console.log(`Pattern "${pat}": none found.`);
  }
}

console.log('\n--- Scanning Working Tree ---');
for (const pat of patterns) {
  try {
    const out = execSync(`git grep -n -I "${pat}" -- ":!node_modules" ":!scripts" ":!package-lock.json"`, { encoding: 'utf8' }).trim();
    if (out) {
      console.log(`Pattern "${pat}" found in tracked files:`);
      // Sanitize: do not print secret values
      out.split('\n').forEach(line => {
        const [file, lineNo] = line.split(':');
        console.log(`  File: ${file}:${lineNo} (contains key pattern)`);
      });
    } else {
      console.log(`Pattern "${pat}": clean in working tree.`);
    }
  } catch (e) {
    console.log(`Pattern "${pat}": clean in working tree.`);
  }
}
