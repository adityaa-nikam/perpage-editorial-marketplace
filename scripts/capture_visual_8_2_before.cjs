const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const BEFORE_DIR = path.join(__dirname, '..', 'docs', 'visual-8-2', 'before');
if (!fs.existsSync(BEFORE_DIR)) {
  fs.mkdirSync(BEFORE_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
  console.log('🚀 Launching headless Chrome for visual-8-2 before screenshots...');
  const port = 9225;
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    'about:blank'
  ]);

  try {
    let targetWs = null;
    for (let i = 0; i < 20; i++) {
      try {
        const newPageRes = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
        if (newPageRes.ok) {
          const target = await newPageRes.json();
          targetWs = target.webSocketDebuggerUrl;
          break;
        }
      } catch (e) {}
      await sleep(400);
    }

    if (!targetWs) throw new Error('Could not get target WebSocket URL');

    const client = createClient(targetWs);
    await client.ready;

    await client.send('Page.enable');
    await client.send('DOM.enable');
    await client.send('Runtime.enable');

    // First find a valid editor ID
    let editorId = '6ac9698be050df3e1eb4d764';
    try {
      const writersRes = await fetch('http://localhost:3000/writers');
      const writersHtml = await writersRes.text();
      const match = writersHtml.match(/\/writers\/([a-f0-9]{24})/);
      if (match) editorId = match[1];
    } catch (e) {}

    const pages = [
      { name: 'landing', url: 'http://localhost:3000/' },
      { name: 'editors', url: 'http://localhost:3000/writers' },
      { name: 'profile', url: `http://localhost:3000/writers/${editorId}` },
      { name: 'login', url: 'http://localhost:3000/login' },
      { name: 'dashboard', url: 'http://localhost:3000/dashboard?mockUser=1' }
    ];

    const viewports = [
      { name: '1440', width: 1440, height: 900 },
      { name: '390', width: 390, height: 844, mobile: true }
    ];

    const themes = ['light', 'dark'];

    for (const page of pages) {
      console.log(`\nNavigating to ${page.name} (${page.url})...`);
      
      for (const vp of viewports) {
        await client.send('Emulation.setDeviceMetricsOverride', {
          width: vp.width,
          height: vp.height,
          deviceScaleFactor: 1,
          mobile: Boolean(vp.mobile)
        });

        for (const theme of themes) {
          await client.send('Page.navigate', { url: page.url });
          await sleep(1000);

          await client.send('Runtime.evaluate', {
            expression: `(() => {
              if ('${theme}' === 'dark') {
                document.documentElement.classList.add('dark');
                localStorage.setItem('theme', 'dark');
              } else {
                document.documentElement.classList.remove('dark');
                localStorage.setItem('theme', 'light');
              }
            })()`
          });
          await sleep(400);

          const filename = `${page.name}-${theme}-${vp.name}px.png`;
          const filepath = path.join(BEFORE_DIR, filename);

          const { data } = await client.send('Page.captureScreenshot', {
            format: 'png',
            captureBeyondViewport: false
          });

          fs.writeFileSync(filepath, Buffer.from(data, 'base64'));
          console.log(`  📸 Saved: ${filename}`);
        }
      }
    }

    client.close();
    console.log('\n✅ All visual-8-2 BEFORE screenshots captured successfully!');
  } catch (err) {
    console.error('❌ Screenshot error:', err);
  } finally {
    chrome.kill();
  }
}

run();
