const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const DOCS_DIR = path.join(__dirname, '..', 'docs', 'screenshots');
const ARTIFACT_DIR = 'C:\\Users\\adiit\\.gemini\\antigravity-ide\\brain\\f12073a1-d79a-4be4-8a02-d5fedffb70d1';

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
  console.log('Launching headless Chrome for OAuth and Profile screenshot captures...');
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

    async function capture(filename, { width, height, url, action = null }) {
      console.log(`Capturing ${filename}...`);
      await client.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 2,
        mobile: false
      });

      await client.send('Page.navigate', { url });
      await sleep(1500);

      if (action) {
        await client.send('Runtime.evaluate', { expression: action, awaitPromise: true });
        await sleep(600);
      }

      const screenshot = await client.send('Page.captureScreenshot', { format: 'png' });
      const buf = Buffer.from(screenshot.data, 'base64');
      
      fs.writeFileSync(path.join(DOCS_DIR, filename), buf);
      try {
        fs.writeFileSync(path.join(ARTIFACT_DIR, filename), buf);
      } catch (err) {}

      console.log(`Saved ${filename} (${Math.round(buf.length / 1024)} KB)`);
    }

    // 1. Main Page showing logged in Navbar with user avatar and dropdown open
    await capture('google-pfp-navbar-mainpage.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/?mockUser=1',
      action: `
        const btn = document.getElementById('user-menu-button');
        if (btn) btn.click();
      `
    });

    // 2. Profile Page showing Google account avatar and identity section
    await capture('google-pfp-profile-page.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/profile/64f1a2b3c4d5e6f7a8b9c0d1?mockUser=1'
    });

    client.close();
    console.log('✅ Google OAuth and Profile screenshots captured successfully!');
  } catch (err) {
    console.error('Capture error:', err.message);
  } finally {
    chrome.kill();
  }
}

run();
