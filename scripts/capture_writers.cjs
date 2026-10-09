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
  console.log('Launching headless Chrome for writers pages captures...');
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

    async function capture(filename, { width, height, isMobile = false, url, dark = false, fullPage = true, scriptBefore = null }) {
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
      await sleep(200);

      if (scriptBefore) {
        await client.send('Runtime.evaluate', { expression: scriptBefore });
        await sleep(300);
      }

      const params = { format: 'png' };
      if (fullPage) {
        params.captureBeyondViewport = true;
      }

      const shot = await client.send('Page.captureScreenshot', params);
      const buf = Buffer.from(shot.data, 'base64');
      const outPath = path.join(OUTPUT_DIR, filename);
      fs.writeFileSync(outPath, buf);
      console.log(`Saved ${outPath} (${buf.length} bytes)`);
    }

    const WRITER_ID = '64f1a2b3c4d5e6f7a8b9c0d1'; // Eleanor Vance
    const EMPTY_WRITER_ID = '64f1a2b3c4d5e6f7a8b9c0d7'; // Kavita Patel (no bio, rate 0)

    // 1. /writers at 1440px, 768px, 390px (Light & Dark)
    await capture('writers_1440_light.png', { width: 1440, height: 900, url: 'http://localhost:3000/writers', dark: false });
    await capture('writers_1440_dark.png', { width: 1440, height: 900, url: 'http://localhost:3000/writers', dark: true });
    await capture('writers_768_light.png', { width: 768, height: 1024, url: 'http://localhost:3000/writers', dark: false });
    await capture('writers_768_dark.png', { width: 768, height: 1024, url: 'http://localhost:3000/writers', dark: true });
    await capture('writers_390_light.png', { width: 390, height: 844, isMobile: true, url: 'http://localhost:3000/writers', dark: false });
    await capture('writers_390_dark.png', { width: 390, height: 844, isMobile: true, url: 'http://localhost:3000/writers', dark: true });

    // 2. /writers/:id at 1440px, 768px, 390px (Light & Dark)
    await capture('writer_profile_1440_light.png', { width: 1440, height: 900, url: `http://localhost:3000/writers/${WRITER_ID}`, dark: false });
    await capture('writer_profile_1440_dark.png', { width: 1440, height: 900, url: `http://localhost:3000/writers/${WRITER_ID}`, dark: true });
    await capture('writer_profile_768_light.png', { width: 768, height: 1024, url: `http://localhost:3000/writers/${WRITER_ID}`, dark: false });
    await capture('writer_profile_768_dark.png', { width: 768, height: 1024, url: `http://localhost:3000/writers/${WRITER_ID}`, dark: true });
    await capture('writer_profile_390_light.png', { width: 390, height: 844, isMobile: true, url: `http://localhost:3000/writers/${WRITER_ID}`, dark: false });
    await capture('writer_profile_390_dark.png', { width: 390, height: 844, isMobile: true, url: `http://localhost:3000/writers/${WRITER_ID}`, dark: true });

    // 3. /profile/:id at 1440px and 390px (Light & Dark)
    await capture('profile_1440_light.png', { width: 1440, height: 900, url: `http://localhost:3000/profile/${WRITER_ID}?mockUser=1`, dark: false });
    await capture('profile_1440_dark.png', { width: 1440, height: 900, url: `http://localhost:3000/profile/${WRITER_ID}?mockUser=1`, dark: true });
    await capture('profile_390_light.png', { width: 390, height: 844, isMobile: true, url: `http://localhost:3000/profile/${WRITER_ID}?mockUser=1`, dark: false });
    await capture('profile_390_dark.png', { width: 390, height: 844, isMobile: true, url: `http://localhost:3000/profile/${WRITER_ID}?mockUser=1`, dark: true });

    // 4. State Screenshots
    // Listing with search term
    await capture('writers_search_term.png', { width: 1440, height: 900, url: 'http://localhost:3000/writers?q=Chen', dark: false });
    // Listing with zero results / empty state
    await capture('writers_filtered_empty.png', { width: 1440, height: 900, url: 'http://localhost:3000/writers?q=NonexistentQueryXYZ', dark: false });
    // Writer with no bio and no rate
    await capture('writer_profile_no_bio_no_rate.png', { width: 1440, height: 900, url: `http://localhost:3000/writers/${EMPTY_WRITER_ID}`, dark: false });
    // Invalid-id 404
    await capture('writer_404_invalid_id.png', { width: 1440, height: 900, url: 'http://localhost:3000/writers/invalid-id-xyz', dark: false });

    // Order card variants
    // Logged-out variant
    await capture('order_card_logged_out.png', { width: 1440, height: 900, url: `http://localhost:3000/writers/${WRITER_ID}`, dark: false });
    // Logged-in variant
    await capture('order_card_logged_in.png', { width: 1440, height: 900, url: `http://localhost:3000/writers/${WRITER_ID}?mockUser=1`, dark: false });
    // Own-profile variant
    await capture('order_card_own_profile.png', { width: 1440, height: 900, url: `http://localhost:3000/writers/${WRITER_ID}?mockUser=own`, dark: false });

    console.log('✅ All writer screenshots captured successfully!');
    client.close();
  } catch (err) {
    console.error('❌ Capture error:', err);
  } finally {
    chrome.kill();
  }
}

run();
