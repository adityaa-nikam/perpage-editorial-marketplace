const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const AFTER_DIR = path.join(__dirname, '..', 'docs', 'refinement', 'after');
if (!fs.existsSync(AFTER_DIR)) {
  fs.mkdirSync(AFTER_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getWsUrl() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      if (res.ok) {
        const json = await res.json();
        return json.webSocketDebuggerUrl;
      }
    } catch (e) {}
    await sleep(500);
  }
  throw new Error('Chrome remote debugging port not available');
}

function createClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(new Error(JSON.stringify(data.error)));
      else resolve(data.result);
    }
  };

  return {
    ws,
    ready: new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    }),
    send: (method, params = {}) => new Promise((resolve, reject) => {
      const reqId = id++;
      pending.set(reqId, { resolve, reject });
      ws.send(JSON.stringify({ id: reqId, method, params }));
    }),
    close: () => ws.close()
  };
}

async function run() {
  console.log('🚀 Launching headless Chrome for REFINED AFTER screenshots...');
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    'about:blank'
  ]);

  try {
    const wsUrl = await getWsUrl();
    const newPageRes = await fetch('http://127.0.0.1:9222/json/new?about:blank', { method: 'PUT' });
    const target = await newPageRes.json();
    const client = createClient(target.webSocketDebuggerUrl);
    await client.ready;

    await client.send('Page.enable');
    await client.send('DOM.enable');
    await client.send('Runtime.enable');
    await client.send('Network.enable');

    async function capture(filename, { width, height, isMobile = false, url, dark = false, headers = {} }) {
      process.stdout.write(`Capturing ${filename}... `);
      await client.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 2,
        mobile: isMobile
      });

      if (Object.keys(headers).length > 0) {
        await client.send('Network.setExtraHTTPHeaders', { headers });
      } else {
        await client.send('Network.setExtraHTTPHeaders', { headers: {} });
      }

      await client.send('Page.navigate', { url });
      await sleep(1000);

      if (dark) {
        await client.send('Runtime.evaluate', {
          expression: `document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark');`
        });
        await sleep(250);
      } else {
        await client.send('Runtime.evaluate', {
          expression: `document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light');`
        });
        await sleep(250);
      }

      const captureParams = {
        format: 'png',
        captureBeyondViewport: true
      };

      const screenshot = await client.send('Page.captureScreenshot', captureParams);
      const filePath = path.join(AFTER_DIR, filename);
      fs.writeFileSync(filePath, Buffer.from(screenshot.data, 'base64'));
      console.log(`Saved (${Math.round(screenshot.data.length * 0.75 / 1024)} KB)`);
    }

    // Seeded IDs
    const WRITER_ID = '6ac9698be050df3e1eb4d764'; // Dr. Arthur Pendelton
    const STUDENT_ID = '6ac9698be050df3e1eb4d76d'; // Julian Croft

    const PAGES = [
      { name: 'home', url: 'http://localhost:3000/' },
      { name: 'writers', url: 'http://localhost:3000/writers' },
      { name: 'writer-profile', url: `http://localhost:3000/writers/${WRITER_ID}` },
      { name: 'about', url: 'http://localhost:3000/about' },
      { name: 'login', url: 'http://localhost:3000/login' },
      { name: 'register', url: 'http://localhost:3000/register' },
      { 
        name: 'deal', 
        url: `http://localhost:3000/deal?writerId=${WRITER_ID}&mockUser=student`,
        headers: { 'x-mock-user': STUDENT_ID, 'x-mock-role': 'user', 'x-mock-name': 'Julian Croft' }
      },
      { 
        name: 'dashboard-student', 
        url: `http://localhost:3000/dashboard?mockUser=student`,
        headers: { 'x-mock-user': STUDENT_ID, 'x-mock-role': 'user', 'x-mock-name': 'Julian Croft' }
      },
      { 
        name: 'dashboard-writer', 
        url: `http://localhost:3000/dashboard?mockUser=writer`,
        headers: { 'x-mock-user': WRITER_ID, 'x-mock-role': 'writer', 'x-mock-name': 'Dr. Arthur Pendelton' }
      },
      { 
        name: 'profile-own', 
        url: `http://localhost:3000/profile/${WRITER_ID}?mockUser=1`,
        headers: { 'x-mock-user': WRITER_ID, 'x-mock-role': 'writer', 'x-mock-name': 'Dr. Arthur Pendelton' }
      },
      { name: '404', url: 'http://localhost:3000/non-existent-baseline-page' }
    ];

    for (const page of PAGES) {
      // 1. Desktop Light (1440)
      await capture(`${page.name}-light-1440.png`, {
        width: 1440,
        height: 900,
        url: page.url,
        dark: false,
        headers: page.headers || {}
      });

      // 2. Desktop Dark (1440)
      await capture(`${page.name}-dark-1440.png`, {
        width: 1440,
        height: 900,
        url: page.url,
        dark: true,
        headers: page.headers || {}
      });

      // 3. Mobile Light (390)
      await capture(`${page.name}-light-390.png`, {
        width: 390,
        height: 844,
        isMobile: true,
        url: page.url,
        dark: false,
        headers: page.headers || {}
      });

      // 4. Mobile Dark (390)
      await capture(`${page.name}-dark-390.png`, {
        width: 390,
        height: 844,
        isMobile: true,
        url: page.url,
        dark: true,
        headers: page.headers || {}
      });
    }

    client.close();
    console.log('\n✅ All Refined AFTER screenshots captured successfully in docs/refinement/after/!');
  } catch (err) {
    console.error('Capture error:', err.message);
  } finally {
    chrome.kill();
  }
}

run();
