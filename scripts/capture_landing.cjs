const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const OUTPUT_DIR = 'C:\\Users\\adiit\\.gemini\\antigravity-ide\\brain\\f12073a1-d79a-4be4-8a02-d5fedffb70d1\\screenshots';
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
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
  console.log('Launching Chrome for landing page captures...');
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

    async function capture(filename, { width, height, isMobile = false, url, dark = false, fullPage = true, scriptBefore = null, clip = null }) {
      console.log(`Capturing ${filename}...`);
      await client.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 2,
        mobile: isMobile
      });

      await client.send('Page.navigate', { url });
      await sleep(1500); // Wait for fonts, alpine & rendering

      // Force theme
      await client.send('Runtime.evaluate', {
        expression: dark 
          ? `document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark');`
          : `document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light');`
      });
      await sleep(150);

      // Ensure all reveal-on-scroll elements are revealed for captures
      await client.send('Runtime.evaluate', {
        expression: `document.querySelectorAll('.reveal-on-scroll').forEach(el => el.classList.add('is-revealed'));`
      });
      await sleep(150);

      if (scriptBefore) {
        await client.send('Runtime.evaluate', { expression: scriptBefore });
        await sleep(400);
      }

      const params = { format: 'png' };
      if (clip) {
        params.clip = clip;
      } else if (fullPage) {
        params.captureBeyondViewport = true;
      }

      const shot = await client.send('Page.captureScreenshot', params);
      const buf = Buffer.from(shot.data, 'base64');
      const outPath = path.join(OUTPUT_DIR, filename);
      fs.writeFileSync(outPath, buf);
      console.log(`Saved ${outPath} (${buf.length} bytes)`);
    }

    // 1. Full-page screenshots at 1440px (light & dark)
    await capture('home_1440_light.png', { width: 1440, height: 900, url: 'http://localhost:3000/', dark: false, fullPage: true });
    await capture('home_1440_dark.png', { width: 1440, height: 900, url: 'http://localhost:3000/', dark: true, fullPage: true });

    // 2. Full-page screenshots at 768px (light & dark)
    await capture('home_768_light.png', { width: 768, height: 1024, url: 'http://localhost:3000/', dark: false, fullPage: true });
    await capture('home_768_dark.png', { width: 768, height: 1024, url: 'http://localhost:3000/', dark: true, fullPage: true });

    // 3. Full-page screenshots at 390px (light & dark)
    await capture('home_390_light.png', { width: 390, height: 844, isMobile: true, url: 'http://localhost:3000/', dark: false, fullPage: true });
    await capture('home_390_dark.png', { width: 390, height: 844, isMobile: true, url: 'http://localhost:3000/', dark: true, fullPage: true });

    // 4. Hero section logged out vs logged in (1440px)
    await capture('hero_logged_out.png', { 
      width: 1440, 
      height: 800, 
      url: 'http://localhost:3000/', 
      dark: false, 
      fullPage: false,
      clip: { x: 0, y: 64, width: 1440, height: 680, scale: 2 } 
    });

    await capture('hero_logged_in.png', { 
      width: 1440, 
      height: 800, 
      url: 'http://localhost:3000/?mockUser=1', 
      dark: false, 
      fullPage: false,
      clip: { x: 0, y: 64, width: 1440, height: 680, scale: 2 } 
    });

    // 5. Featured writers section: with data vs empty state (1440px)
    await capture('featured_writers_data.png', { 
      width: 1440, 
      height: 800, 
      url: 'http://localhost:3000/?mockWriters=1', 
      dark: false, 
      fullPage: false,
      scriptBefore: `
        const el = document.querySelectorAll('section')[3];
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
      `
    });

    await capture('featured_writers_empty.png', { 
      width: 1440, 
      height: 800, 
      url: 'http://localhost:3000/?empty=1', 
      dark: false, 
      fullPage: false,
      scriptBefore: `
        const el = document.querySelectorAll('section')[3];
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
      `
    });

    // 6. FAQ Accordion open with focus ring (1440px)
    await capture('faq_accordion_open.png', {
      width: 1440,
      height: 850,
      url: 'http://localhost:3000/',
      dark: false,
      fullPage: false,
      scriptBefore: `
        const faqSection = document.querySelectorAll('section')[5];
        if (faqSection) faqSection.scrollIntoView({ behavior: 'instant', block: 'start' });
        const btn = document.getElementById('faq-btn-1');
        if (btn) {
          btn.click();
          btn.focus();
        }
      `
    });

    console.log('All landing page captures completed successfully!');
    client.close();
  } finally {
    chrome.kill();
  }
}

run().catch(err => {
  console.error('Landing capture error:', err);
  process.exit(1);
});
