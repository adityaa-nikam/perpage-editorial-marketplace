const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'docs', 'screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
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
  console.log('Launching headless Chrome for Prompt 7 screenshot captures...');
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

    async function capture(filename, { width, height, isMobile = false, url, dark = false, fullPage = false, action = null }) {
      console.log(`Capturing ${filename}...`);
      await client.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 2,
        mobile: isMobile
      });

      await client.send('Page.navigate', { url });
      await sleep(1200);

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
        await sleep(400);
      }

      const captureParams = { format: 'png' };
      if (fullPage) {
        captureParams.captureBeyondViewport = true;
      }

      const screenshot = await client.send('Page.captureScreenshot', captureParams);
      const filePath = path.join(SCREENSHOTS_DIR, filename);
      fs.writeFileSync(filePath, Buffer.from(screenshot.data, 'base64'));
      console.log(`Saved ${filename} (${Math.round(screenshot.data.length * 0.75 / 1024)} KB)`);
    }

    // 1. /about at 1440px (light & dark)
    await capture('about-light-1440.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/about',
      dark: false,
      fullPage: true
    });

    await capture('about-dark-1440.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/about',
      dark: true,
      fullPage: true
    });

    // 2. /about at 390px (light & dark)
    await capture('about-light-390.png', {
      width: 390,
      height: 844,
      isMobile: true,
      url: 'http://localhost:3000/about',
      dark: false,
      fullPage: true
    });

    await capture('about-dark-390.png', {
      width: 390,
      height: 844,
      isMobile: true,
      url: 'http://localhost:3000/about',
      dark: true,
      fullPage: true
    });

    // 3. 404 Page at 1440px (light & dark)
    await capture('error-404-light-1440.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/non-existent-page-demo',
      dark: false,
      fullPage: true
    });

    await capture('error-404-dark-1440.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/non-existent-page-demo',
      dark: true,
      fullPage: true
    });

    // 4. 404 Page at 390px (light & dark)
    await capture('error-404-light-390.png', {
      width: 390,
      height: 844,
      isMobile: true,
      url: 'http://localhost:3000/non-existent-page-demo',
      dark: false,
      fullPage: true
    });

    await capture('error-404-dark-390.png', {
      width: 390,
      height: 844,
      isMobile: true,
      url: 'http://localhost:3000/non-existent-page-demo',
      dark: true,
      fullPage: true
    });

    // 5. Status error pages: 403, 429, 500
    await capture('error-403-1440.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/test-error/403',
      dark: false,
      fullPage: true
    });

    await capture('error-429-1440.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/test-error/429',
      dark: false,
      fullPage: true
    });

    await capture('error-500-1440.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/test-error/500',
      dark: false,
      fullPage: true
    });

    // 6. Logged-in navbar showing user dropdown with Sign Out button
    await capture('navbar-logged-in-logout.png', {
      width: 1440,
      height: 600,
      url: 'http://localhost:3000/dashboard?mockUser=1',
      dark: false,
      action: `
        const btn = document.getElementById('user-menu-button');
        if (btn) btn.click();
      `
    });

    client.close();
    console.log('✅ Screenshots captured successfully!');
  } catch (err) {
    console.error('Capture error:', err.message);
  } finally {
    chrome.kill();
  }
}

run();
