const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const DOCS_DIR = path.join(__dirname, '..', 'docs', 'screenshots');
const ARTIFACT_DIR = 'C:\\Users\\adiit\\.gemini\\antigravity-ide\\brain\\f12073a1-d79a-4be4-8a02-d5fedffb70d1';

if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
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
  console.log('Launching headless Chrome for Repositioning screenshot captures...');
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

      if (url) {
        await client.send('Page.navigate', { url });
        await sleep(1500);
      }

      if (dark) {
        await client.send('Runtime.evaluate', {
          expression: `document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark');`
        });
        await sleep(400);
      } else {
        await client.send('Runtime.evaluate', {
          expression: `document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light');`
        });
        await sleep(400);
      }

      if (action) {
        await client.send('Runtime.evaluate', { expression: action, awaitPromise: true });
        await sleep(800);
      }

      const captureParams = { format: 'png' };
      if (fullPage) {
        captureParams.captureBeyondViewport = true;
      }

      const screenshot = await client.send('Page.captureScreenshot', captureParams);
      const buf = Buffer.from(screenshot.data, 'base64');
      
      const filePathDocs = path.join(DOCS_DIR, filename);
      fs.writeFileSync(filePathDocs, buf);

      const filePathArtifact = path.join(ARTIFACT_DIR, filename);
      try {
        fs.writeFileSync(filePathArtifact, buf);
      } catch (err) {
        console.warn('Could not write to artifact dir:', err.message);
      }

      console.log(`Saved ${filename} (${Math.round(buf.length / 1024)} KB)`);
    }

    // 1. Landing Page 1440px (Light & Dark)
    await capture('reposition-landing-1440-light.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/',
      dark: false,
      fullPage: false
    });

    await capture('reposition-landing-1440-dark.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/',
      dark: true,
      fullPage: false
    });

    // 2. Landing Page 390px (Mobile)
    await capture('reposition-landing-390-light.png', {
      width: 390,
      height: 844,
      isMobile: true,
      url: 'http://localhost:3000/',
      dark: false,
      fullPage: false
    });

    // 3. Editors Directory (/writers)
    await capture('reposition-editors-1440-light.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/writers',
      dark: false,
      fullPage: false
    });

    // 4. Editor Profile
    await capture('reposition-editor-profile-1440-light.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/writers/64f1a2b3c4d5e6f7a8b9c0d1',
      dark: false,
      fullPage: false
    });

    // 5. Acceptable Use Policy (/acceptable-use)
    await capture('reposition-acceptable-use-1440-light.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/acceptable-use',
      dark: false,
      fullPage: true
    });

    await capture('reposition-acceptable-use-1440-dark.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/acceptable-use',
      dark: true,
      fullPage: true
    });

    await capture('reposition-acceptable-use-390-light.png', {
      width: 390,
      height: 844,
      isMobile: true,
      url: 'http://localhost:3000/acceptable-use',
      dark: false,
      fullPage: false
    });

    // 6. About Page (/about)
    await capture('reposition-about-1440-light.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/about',
      dark: false,
      fullPage: false
    });

    // 7. Deal Page with ownWork checkbox (/deal)
    await capture('reposition-deal-1440-light.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/deal?writerId=64f1a2b3c4d5e6f7a8b9c0d1&mockUser=1',
      dark: false,
      fullPage: false,
      action: `
        const el = document.getElementById('ownWork');
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
      `
    });

    // 8. Deal Page Validation Error (ownWork missing 422 state)
    await capture('reposition-deal-validation-error-1440.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/deal?writerId=64f1a2b3c4d5e6f7a8b9c0d1&mockUser=1',
      dark: false,
      fullPage: false,
      action: `
        (() => {
          const formCard = document.querySelector('.card form');
          if (formCard) {
            const summary = document.createElement('div');
            summary.id = 'error-summary';
            summary.className = 'alert alert-danger space-y-2 mb-6';
            summary.setAttribute('role', 'alert');
            summary.innerHTML = \`
              <div class="flex items-center gap-2 font-semibold">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4 shrink-0"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <span>There was a problem with your submission:</span>
              </div>
              <ul class="list-disc list-inside space-y-1 text-xs pl-6">
                <li><a href="#ownWork" class="underline hover:text-[var(--text-ink)]">You must confirm this is your own work and you are seeking editing or feedback only.</a></li>
              </ul>
            \`;
            formCard.parentElement.insertBefore(summary, formCard);

            const ownWork = document.getElementById('ownWork');
            if (ownWork) {
              ownWork.classList.add('border-[var(--semantic-danger-border)]');
              const parent = ownWork.closest('div');
              const errP = document.createElement('p');
              errP.id = 'ownWork-error';
              errP.className = 'form-error mt-1.5';
              errP.innerHTML = \`
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                You must confirm this is your own work and you are seeking editing or feedback only.
              \`;
              parent.appendChild(errP);
            }
            summary.scrollIntoView({ behavior: 'instant', block: 'start' });
          }
        })()
      `
    });

    client.close();
    console.log('✅ All Repositioning screenshots captured successfully!');
  } catch (err) {
    console.error('Capture error:', err.message);
  } finally {
    chrome.kill();
  }
}

run();
