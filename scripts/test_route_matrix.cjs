const fs = require('fs');

const BASE_URL = 'http://localhost:3000';

const ROLES = {
  logged_out: {},
  student: { 'x-mock-user': '64f1a2b3c4d5e6f7a8b9c0d9', 'x-mock-role': 'user' },
  writer: { 'x-mock-user': '64f1a2b3c4d5e6f7a8b9c0d1', 'x-mock-role': 'writer', 'x-mock-rate': '150' },
  admin: { 'x-mock-user': '64f1a2b3c4d5e6f7a8b9c0d8', 'x-mock-role': 'admin' }
};

const ROUTES = [
  { method: 'GET', path: '/', name: 'Landing Page' },
  { method: 'GET', path: '/home', name: 'Home Route (redirects to /)' },
  { method: 'GET', path: '/about', name: 'About Page' },
  { method: 'GET', path: '/writers', name: 'Writers Directory' },
  { method: 'GET', path: '/writers/64f1a2b3c4d5e6f7a8b9c0d1', name: 'Writer Public Profile' },
  { method: 'GET', path: '/deal?writerId=64f1a2b3c4d5e6f7a8b9c0d1', name: 'Deal Commission Page' },
  { method: 'GET', path: '/dashboard', name: 'Dashboard' },
  { method: 'GET', path: '/profile/64f1a2b3c4d5e6f7a8b9c0d1', name: 'Profile Edit Page (Writer)' },
  { method: 'GET', path: '/profile/64f1a2b3c4d5e6f7a8b9c0d9', name: 'Profile Edit Page (Student)' },
  { method: 'GET', path: '/login', name: 'Login Page' },
  { method: 'GET', path: '/register', name: 'Register Page' },
  { method: 'GET', path: '/logout', name: 'Logout Endpoint' },
  { method: 'GET', path: '/auth/google', name: 'Google OAuth Start' },
  { method: 'GET', path: '/auth/github', name: 'GitHub OAuth Start' },
  { method: 'GET', path: '/health', name: 'System Health Check' },
  { method: 'GET', path: '/favicon.svg', name: 'Favicon' },
  { method: 'GET', path: '/css/app.css', name: 'Compiled Stylesheet' },
  { method: 'GET', path: '/logo.png', name: 'Brand Logo' },
  { method: 'GET', path: '/styleguide', name: 'Design Styleguide' },
  { method: 'GET', path: '/non-existent-page-url', name: 'Unknown URL (404)' },
  { method: 'POST', path: '/deal/accept/64f1a2b3c4d5e6f7a8b9d001', name: 'Deal Accept Handler' },
  { method: 'POST', path: '/deal/reject/64f1a2b3c4d5e6f7a8b9d001', name: 'Deal Reject Handler' },
  { method: 'POST', path: '/deal/upload-final', name: 'Deal Upload-Final Handler' }
];

async function runMatrix() {
  console.log('🧪 Executing Route and Role Matrix Test...\n');
  const matrix = [];

  for (const route of ROUTES) {
    const row = { method: route.method, path: route.path, name: route.name, results: {} };

    for (const [roleName, headers] of Object.entries(ROLES)) {
      try {
        const options = {
          method: route.method,
          headers: { ...headers },
          redirect: 'manual'
        };

        const res = await fetch(`${BASE_URL}${route.path}`, options);
        const status = res.status;
        const location = res.headers.get('location') || '';

        let desc = `${status}`;
        if (location) {
          desc += ` → ${location}`;
        }
        row.results[roleName] = desc;
      } catch (err) {
        row.results[roleName] = `ERR: ${err.message}`;
      }
    }
    matrix.push(row);
  }

  // Print Markdown Table
  console.log('| Route | Method | Logged Out | Student | Writer | Admin | Notes |');
  console.log('| :--- | :--- | :--- | :--- | :--- | :--- | :--- |');

  for (const r of matrix) {
    const lo = r.results.logged_out;
    const st = r.results.student;
    const wr = r.results.writer;
    const ad = r.results.admin;
    let note = '';
    if (lo.includes('302 → /login')) note = 'Auth-guarded';
    else if (r.path === '/health') note = '404 (mounted after 404 handler)';
    else if (r.path.includes('logout')) note = 'GET-based logout';
    else if (r.path.includes('accept') || r.path.includes('reject') || r.path.includes('upload-final')) {
      if (lo.includes('302 → /login')) note = 'Action guarded';
    }

    console.log(`| \`${r.path}\` | \`${r.method}\` | ${lo} | ${st} | ${wr} | ${ad} | ${note} |`);
  }

  fs.writeFileSync('scripts/route_matrix_results.json', JSON.stringify(matrix, null, 2));
  console.log('\nMatrix results saved to scripts/route_matrix_results.json');
}

runMatrix().catch(console.error);
