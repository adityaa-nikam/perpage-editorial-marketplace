const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const VIEWPORTS = [320, 390, 768, 1024, 1440, 1920];

const PAGES = [
  { name: 'home', url: 'http://localhost:3000/' },
  { name: 'writers', url: 'http://localhost:3000/writers' },
  { name: 'writer-profile', url: 'http://localhost:3000/writers/6ac9698be050df3e1eb4d764' },
  { name: 'about', url: 'http://localhost:3000/about' },
  { name: 'login', url: 'http://localhost:3000/login' },
  { name: 'register', url: 'http://localhost:3000/register' },
  { name: 'deal', url: 'http://localhost:3000/deal?writerId=6ac9698be050df3e1eb4d764&mockUser=student', headers: { 'x-mock-user': '6ac9698be050df3e1eb4d76d', 'x-mock-role': 'user', 'x-mock-name': 'Julian Croft' } },
  { name: 'dashboard-student', url: 'http://localhost:3000/dashboard?mockUser=student', headers: { 'x-mock-user': '6ac9698be050df3e1eb4d76d', 'x-mock-role': 'user', 'x-mock-name': 'Julian Croft' } },
  { name: 'dashboard-writer', url: 'http://localhost:3000/dashboard?mockUser=writer', headers: { 'x-mock-user': '6ac9698be050df3e1eb4d764', 'x-mock-role': 'writer', 'x-mock-name': 'Dr. Arthur Pendelton' } },
  { name: 'profile-own', url: 'http://localhost:3000/profile/6ac9698be050df3e1eb4d764?mockUser=1', headers: { 'x-mock-user': '6ac9698be050df3e1eb4d764', 'x-mock-role': 'writer', 'x-mock-name': 'Dr. Arthur Pendelton' } },
  { name: '404', url: 'http://localhost:3000/non-existent-page' }
];

async function run() {
  console.log('Testing Horizontal Overflow at [320, 390, 768, 1024, 1440, 1920]px across all 11 routes...');
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9227',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    'about:blank'
  ]);

  let failures = [];

  try {
    for (let i = 0; i < 20; i++) {
      try {
        const res = await fetch('http://127.0.0.1:9227/json/version');
        if (res.ok) break;
      } catch (e) {}
      await sleep(300);
    }

    const newPageRes = await fetch('http://127.0.0.1:9227/json/new?about:blank', { method: 'PUT' });
    const target = await newPageRes.json();
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let id = 1;
    const send = (method, params = {}) => new Promise((resolve) => {
      const reqId = id++;
      const handler = (evt) => {
        const d = JSON.parse(evt.data);
        if (d.id === reqId) {
          ws.removeEventListener('message', handler);
          resolve(d.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: reqId, method, params }));
    });

    await new Promise(r => ws.onopen = r);
    await send('Page.enable');
    await send('Network.enable');

    for (const page of PAGES) {
      if (page.headers) {
        await send('Network.setExtraHTTPHeaders', { headers: page.headers });
      } else {
        await send('Network.setExtraHTTPHeaders', { headers: {} });
      }

      for (const w of VIEWPORTS) {
        await send('Emulation.setDeviceMetricsOverride', {
          width: w,
          height: 900,
          deviceScaleFactor: 1,
          mobile: w < 768
        });

        await send('Page.navigate', { url: page.url });
        await sleep(400);

        const evalRes = await send('Runtime.evaluate', {
          expression: `({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth })`,
          returnByValue: true
        });

        const val = evalRes.result.value;
        if (val.scrollWidth > val.clientWidth) {
          const diff = val.scrollWidth - val.clientWidth;
          console.error(`❌ Horizontal overflow on ${page.name} at ${w}px: scrollWidth=${val.scrollWidth}, clientWidth=${val.clientWidth} (+${diff}px)`);
          failures.push({ page: page.name, viewport: w, diff });
        }
      }
      process.stdout.write(`✔ ${page.name} (checked 6 viewports)\n`);
    }

    ws.close();

    if (failures.length === 0) {
      console.log('\n✅ PASS: Zero horizontal scroll on all 11 pages across all viewports (320, 390, 768, 1024, 1440, 1920px)!');
    } else {
      console.error(`\n❌ Total failures: ${failures.length}`);
      process.exit(1);
    }
  } finally {
    chrome.kill();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
