const fs = require('fs');

async function crawlLinks() {
  const visited = new Set();
  const queue = [
    { url: 'http://localhost:3000/', role: 'logged_out' },
    { url: 'http://localhost:3000/writers', role: 'logged_out' },
    { url: 'http://localhost:3000/about', role: 'logged_out' },
    { url: 'http://localhost:3000/login', role: 'logged_out' },
    { url: 'http://localhost:3000/register', role: 'logged_out' },
    { url: 'http://localhost:3000/dashboard?mockUser=student', role: 'student' },
    { url: 'http://localhost:3000/dashboard?mockUser=writer', role: 'writer' },
    { url: 'http://localhost:3000/writers/64f1a2b3c4d5e6f7a8b9c0d1', role: 'logged_out' }
  ];

  const results = [];

  while (queue.length > 0) {
    const item = queue.shift();
    const key = item.url + '|' + item.role;
    if (visited.has(key)) continue;
    visited.add(key);

    try {
      const headers = {};
      if (item.role === 'student') {
        headers['x-mock-user'] = '64f1a2b3c4d5e6f7a8b9c0d9';
        headers['x-mock-role'] = 'user';
      } else if (item.role === 'writer') {
        headers['x-mock-user'] = '64f1a2b3c4d5e6f7a8b9c0d1';
        headers['x-mock-role'] = 'writer';
      }

      const res = await fetch(item.url, { headers, redirect: 'manual' });
      const status = res.status;
      const location = res.headers.get('location');

      results.push({ url: item.url, role: item.role, status, location });

      if (status === 200) {
        const html = await res.text();
        const linkMatches = [...html.matchAll(/href=["']([^"'#]+)["']/g)].map(m => m[1]);
        const formMatches = [...html.matchAll(/action=["']([^"']+)["']/g)].map(m => m[1]);
        const targets = [...linkMatches, ...formMatches];

        for (let target of targets) {
          if (target.startsWith('javascript:') || target.startsWith('mailto:') || target.startsWith('tel:') || target.startsWith('http://') || target.startsWith('https://')) {
            continue;
          }
          if (target.startsWith('/')) {
            const fullUrl = 'http://localhost:3000' + target;
            const targetKey = fullUrl + '|' + item.role;
            if (!visited.has(targetKey) && !queue.some(q => q.url === fullUrl && q.role === item.role)) {
              queue.push({ url: fullUrl, role: item.role });
            }
          }
        }
      }
    } catch (e) {
      results.push({ url: item.url, role: item.role, status: 'ERROR', error: e.message });
    }
  }

  console.log('Total crawled endpoints:', results.length);
  const issues = results.filter(r => r.status === 404 || r.status === 500 || r.status === 'ERROR');
  console.log('Issues found:', issues.length);
  if (issues.length > 0) {
    console.log(JSON.stringify(issues, null, 2));
  } else {
    console.log('All links crawled resolved successfully without 404, 500 or network error!');
  }

  fs.writeFileSync('scripts/crawl_results.json', JSON.stringify(results, null, 2));
}

crawlLinks();
