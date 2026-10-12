const { spawn } = require('child_process');
const path = require('path');

process.env.NODE_ENV = 'production';
process.env.PORT = '3001';

console.log('🚀 Simulating Render production boot in clean copy...');
console.log('Environment:', { NODE_ENV: process.env.NODE_ENV, PORT: process.env.PORT });

const server = spawn('node', ['index.js'], {
  cwd: path.resolve(__dirname, '..', 'scratch', 'render_sim'),
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe']
});

let output = '';
server.stdout.on('data', async d => {
  const str = d.toString();
  output += str;
  process.stdout.write(str);
  if (str.includes('Server running at') || str.includes('Server started successfully')) {
    setTimeout(async () => {
      try {
        const res = await fetch('http://localhost:3001/styleguide');
        console.log(`\n>>> GET /styleguide in production status: ${res.status} (Expected: 404)`);
        const resHome = await fetch('http://localhost:3001/');
        console.log(`>>> GET / in production status: ${resHome.status} (Expected: 200)`);
      } catch (err) {
        console.log('Fetch error:', err.message);
      } finally {
        server.kill();
        console.log('Render production boot simulation complete.\n');
        process.exit(0);
      }
    }, 500);
  }
});

server.stderr.on('data', d => {
  const str = d.toString();
  output += str;
  process.stderr.write(str);
});

setTimeout(() => {
  console.log('Timeout reached');
  server.kill();
  process.exit(0);
}, 20000);
