const http = require('http');
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
    } catch (e) {
      // wait
    }
    await sleep(500);
  }
  throw new Error('Chrome remote debugging port not available');
}

function createClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 1;
  const pending = new Map();
  const events = [];

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
  console.log('Launching Chrome...');
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
    console.log('Connecting to Chrome CDP at:', wsUrl);

    // Create a new target/page
    const newPageRes = await fetch('http://127.0.0.1:9222/json/new?about:blank', { method: 'PUT' });
    const target = await newPageRes.json();
    const client = createClient(target.webSocketDebuggerUrl);
    await client.ready;

    await client.send('Page.enable');
    await client.send('DOM.enable');
    await client.send('Runtime.enable');

    async function capture(filename, { width, height, isMobile = false, url, dark = false, scriptBefore = null, clip = null }) {
      console.log(`Capturing ${filename}...`);
      await client.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 2,
        mobile: isMobile
      });

      await client.send('Page.navigate', { url });
      await sleep(1500); // Wait for fonts, alpine, and rendering

      // Apply theme
      await client.send('Runtime.evaluate', {
        expression: dark 
          ? `document.documentElement.classList.add('dark'); localStorage.setItem('perpage-theme', 'dark');`
          : `document.documentElement.classList.remove('dark'); localStorage.setItem('perpage-theme', 'light');`
      });
      await sleep(300);

      if (scriptBefore) {
        await client.send('Runtime.evaluate', { expression: scriptBefore });
        await sleep(600);
      }

      const params = { format: 'png' };
      if (clip) {
        params.clip = clip;
      }

      const shot = await client.send('Page.captureScreenshot', params);
      const buf = Buffer.from(shot.data, 'base64');
      const outPath = path.join(OUTPUT_DIR, filename);
      fs.writeFileSync(outPath, buf);
      console.log(`Saved ${outPath} (${buf.length} bytes)`);
    }

    // 1. Styleguide at 1440px light and dark
    await capture('styleguide_1440_light.png', { width: 1440, height: 1100, url: 'http://localhost:3000/styleguide', dark: false });
    await capture('styleguide_1440_dark.png', { width: 1440, height: 1100, url: 'http://localhost:3000/styleguide', dark: true });

    // 2. Styleguide at 768px light and dark
    await capture('styleguide_768_light.png', { width: 768, height: 1024, url: 'http://localhost:3000/styleguide', dark: false });
    await capture('styleguide_768_dark.png', { width: 768, height: 1024, url: 'http://localhost:3000/styleguide', dark: true });

    // 3. Styleguide at 390px light and dark
    await capture('styleguide_390_light.png', { width: 390, height: 844, isMobile: true, url: 'http://localhost:3000/styleguide', dark: false });
    await capture('styleguide_390_dark.png', { width: 390, height: 844, isMobile: true, url: 'http://localhost:3000/styleguide', dark: true });

    // 4. Navbar logged out (1440px)
    await capture('navbar_logged_out.png', { 
      width: 1440, 
      height: 350, 
      url: 'http://localhost:3000/styleguide', 
      dark: false,
      clip: { x: 0, y: 0, width: 1440, height: 200, scale: 2 }
    });

    // 5. Navbar logged in (dropdown open at 1440px)
    await capture('navbar_logged_in_dropdown.png', { 
      width: 1440, 
      height: 450, 
      url: 'http://localhost:3000/styleguide?mockUser=1', 
      dark: false,
      scriptBefore: `
        const btn = document.getElementById('user-menu-button');
        if (btn) btn.click();
      `,
      clip: { x: 0, y: 0, width: 1440, height: 350, scale: 2 }
    });

    // 6. Navbar mobile menu open (390px)
    await capture('navbar_mobile_menu_open.png', { 
      width: 390, 
      height: 700, 
      isMobile: true,
      url: 'http://localhost:3000/styleguide', 
      dark: false,
      scriptBefore: `
        const menuBtn = document.querySelector('button[aria-label="Open mobile menu"]');
        if (menuBtn) menuBtn.click();
      `
    });

    // 7. Styleguide Components section (Buttons, Inputs, Cards, etc.)
    await capture('styleguide_components_light.png', {
      width: 1440,
      height: 1300,
      url: 'http://localhost:3000/styleguide',
      dark: false,
      scriptBefore: `window.scrollTo(0, 1150);`
    });
    await capture('styleguide_components_dark.png', {
      width: 1440,
      height: 1300,
      url: 'http://localhost:3000/styleguide',
      dark: true,
      scriptBefore: `window.scrollTo(0, 1150);`
    });

    // 8. Styleguide Stepper, Data Table & Modals
    await capture('styleguide_table_stepper_light.png', {
      width: 1440,
      height: 1300,
      url: 'http://localhost:3000/styleguide',
      dark: false,
      scriptBefore: `window.scrollTo(0, 2600);`
    });

    console.log('All screenshots captured successfully!');
    client.close();
  } finally {
    chrome.kill();
  }
}

run().catch(err => {
  console.error('Error during capture:', err);
  process.exit(1);
});
