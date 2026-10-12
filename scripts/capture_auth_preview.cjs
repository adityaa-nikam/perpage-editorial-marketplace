const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

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
  console.log('Launching headless Chrome for visual verification...');
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

    async function capture(filename, { width = 1200, height = 800, url, dark = false, action = null }) {
      console.log(`Capturing ${filename}...`);
      await client.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 2,
        mobile: false
      });

      await client.send('Page.navigate', { url });
      await sleep(1500);

      if (dark) {
        await client.send('Runtime.evaluate', {
          expression: `document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark');`
        });
        await sleep(300);
      } else {
        await client.send('Runtime.evaluate', {
          expression: `document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light');`
        });
        await sleep(300);
      }

      if (action) {
        await client.send('Runtime.evaluate', { expression: action });
        await sleep(600);
      }

      const { data } = await client.send('Page.captureScreenshot', { format: 'png' });
      const outPath = path.join(ARTIFACT_DIR, filename);
      fs.writeFileSync(outPath, Buffer.from(data, 'base64'));
      console.log(`Saved screenshot to ${outPath}`);
    }

    // Capture Login Page (Light & Dark)
    await capture('login_preview_light.png', { url: 'http://localhost:3000/login', dark: false });
    await capture('login_preview_dark.png', { url: 'http://localhost:3000/login', dark: true });

    // Capture Register Page
    await capture('register_preview_light.png', { url: 'http://localhost:3000/register', dark: false });

    // Capture Home Page with wavy underline scrolled into view
    await capture('home_wavy_preview.png', {
      url: 'http://localhost:3000/home?noloader=1',
      action: `
        var el = document.querySelector('.proof-wavy-hero');
        if (el) {
          el.scrollIntoView({ behavior: 'instant', block: 'center' });
          if (typeof updateWavyScroll === 'function') updateWavyScroll();
        }
      `
    });

    console.log('All screenshots captured successfully!');
    client.close();
  } catch (err) {
    console.error('Capture error:', err);
  } finally {
    try {
      chrome.kill('SIGTERM');
    } catch (e) {}
  }
}

run();
