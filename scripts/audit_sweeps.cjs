const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

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
  const eventListeners = new Map();

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(new Error(JSON.stringify(data.error)));
      else resolve(data.result);
    } else if (data.method && eventListeners.has(data.method)) {
      for (const listener of eventListeners.get(data.method)) {
        listener(data.params);
      }
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
    on: (method, callback) => {
      if (!eventListeners.has(method)) eventListeners.set(method, []);
      eventListeners.get(method).push(callback);
    },
    close: () => ws.close()
  };
}

const PAGES = [
  { name: 'Home', url: 'http://localhost:3000/' },
  { name: 'Writers', url: 'http://localhost:3000/writers' },
  { name: 'Writer Profile', url: 'http://localhost:3000/writers/64f1a2b3c4d5e6f7a8b9c0d1' },
  { name: 'About', url: 'http://localhost:3000/about' },
  { name: 'Login', url: 'http://localhost:3000/login' },
  { name: 'Register', url: 'http://localhost:3000/register' },
  { name: 'Deal Creation', url: 'http://localhost:3000/deal?writerId=64f1a2b3c4d5e6f7a8b9c0d1&mockUser=student' },
  { name: 'Dashboard Student', url: 'http://localhost:3000/dashboard?mockUser=student' },
  { name: 'Dashboard Writer', url: 'http://localhost:3000/dashboard?mockUser=writer' },
  { name: '404 Page', url: 'http://localhost:3000/non-existent-page-test' }
];

const VIEWPORTS = [320, 390, 768, 1024, 1440, 1920];

async function runAudits() {
  console.log('Starting headless Chrome for cross-cutting audits...');
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

    const consoleLogs = [];
    const failedNetwork = [];

    client.on('Runtime.consoleAPICalled', (params) => {
      const text = params.args.map(a => a.value || a.description || '').join(' ');
      if (params.type === 'error' || params.type === 'warning') {
        consoleLogs.push({ type: params.type, text });
      }
    });

    client.on('Network.responseReceived', (params) => {
      if (params.response.status >= 400 && !params.response.url.includes('non-existent-page-test')) {
        failedNetwork.push({ url: params.response.url, status: params.response.status });
      }
    });

    const auditResults = {
      responsive: [],
      headings: [],
      tapTargets: [],
      consoleErrors: [],
      networkErrors: [],
      noJsCheck: []
    };

    // 1. Audit Pages for Headings, Accessibility, Console & Network Errors
    console.log('\n--- Auditing Headings, Accessibility, and Console/Network ---');
    for (const page of PAGES) {
      console.log(`Auditing ${page.name}...`);
      await client.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
      await client.send('Page.navigate', { url: page.url });
      await sleep(1000);

      const pageInfo = await client.send('Runtime.evaluate', {
        expression: `(() => {
          const h1s = Array.from(document.querySelectorAll('h1')).map(h => h.innerText.trim());
          const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
            tag: h.tagName.toLowerCase(),
            text: h.innerText.trim()
          }));
          const skipLink = document.querySelector('a[href="#main-content"]') || document.querySelector('.skip-link');
          const title = document.title;
          const lang = document.documentElement.lang;
          const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea')).map(input => {
            const id = input.id;
            const label = id ? document.querySelector('label[for="' + id + '"]') : input.closest('label');
            const ariaLabel = input.getAttribute('aria-label') || input.getAttribute('aria-labelledby');
            return {
              id: id || input.name,
              hasLabel: Boolean(label || ariaLabel)
            };
          });

          return {
            title,
            lang,
            h1Count: h1s.length,
            h1s,
            headings,
            skipLink: Boolean(skipLink),
            inputsWithoutLabels: inputs.filter(i => !i.hasLabel)
          };
        })()`,
        returnByValue: true
      });

      auditResults.headings.push({
        page: page.name,
        url: page.url,
        ...pageInfo.result.value
      });

      // Test Dark mode console errors
      await client.send('Runtime.evaluate', {
        expression: `document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark');`
      });
      await sleep(300);
      await client.send('Runtime.evaluate', {
        expression: `document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light');`
      });
    }

    auditResults.consoleErrors = [...consoleLogs];
    auditResults.networkErrors = [...failedNetwork];

    // 2. Responsive Horizontal Scroll Audit across 320, 390, 768, 1024, 1440, 1920
    console.log('\n--- Auditing Responsive Viewport Overflow ---');
    for (const page of PAGES) {
      if (page.name === '404 Page') continue;
      for (const width of VIEWPORTS) {
        await client.send('Emulation.setDeviceMetricsOverride', {
          width,
          height: 800,
          deviceScaleFactor: 1,
          mobile: width < 768
        });
        await client.send('Page.navigate', { url: page.url });
        await sleep(800);

        const scrollCheck = await client.send('Runtime.evaluate', {
          expression: `(() => {
            const scrollWidth = document.scrollingElement.scrollWidth;
            const innerWidth = window.innerWidth;
            const hasHorizontalScroll = scrollWidth > innerWidth;
            return {
              scrollWidth,
              innerWidth,
              hasHorizontalScroll,
              diff: scrollWidth - innerWidth
            };
          })()`,
          returnByValue: true
        });

        auditResults.responsive.push({
          page: page.name,
          width,
          ...scrollCheck.result.value
        });
      }
    }

    // 3. No-JS Rendering Check
    console.log('\n--- Auditing No-JS Behavior ---');
    await client.send('Emulation.setScriptExecutionDisabled', { value: true });
    for (const page of PAGES.slice(0, 5)) {
      await client.send('Page.navigate', { url: page.url });
      await sleep(500);

      const noJsInfo = await client.send('Runtime.evaluate', {
        expression: `(() => {
          const bodyText = document.body ? document.body.innerText.trim() : '';
          const isContentVisible = bodyText.length > 50;
          return {
            hasBody: Boolean(document.body),
            isContentVisible,
            length: bodyText.length
          };
        })()`,
        returnByValue: true
      });

      auditResults.noJsCheck.push({
        page: page.name,
        ...noJsInfo.result.value
      });
    }
    await client.send('Emulation.setScriptExecutionDisabled', { value: false });

    fs.writeFileSync('scripts/audit_sweeps_results.json', JSON.stringify(auditResults, null, 2));
    console.log('\n✅ Audits finished! Results saved to scripts/audit_sweeps_results.json');
  } finally {
    chrome.kill();
  }
}

runAudits().catch(err => {
  console.error('Audit run failed:', err);
  process.exit(1);
});
