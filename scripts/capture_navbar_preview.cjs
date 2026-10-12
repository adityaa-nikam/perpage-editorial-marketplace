const { spawn } = require('child_process');
const fs = require('fs');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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
  const port = 9245;
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--disable-gpu',
    '--no-sandbox',
    'about:blank'
  ]);

  try {
    let targetWs = null;
    for (let i = 0; i < 20; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
        if (res.ok) {
          const t = await res.json();
          targetWs = t.webSocketDebuggerUrl;
          break;
        }
      } catch (e) {}
      await sleep(300);
    }

    const client = createClient(targetWs);
    await client.ready;
    await client.send('Page.enable');
    await client.send('DOM.enable');

    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 2,
      mobile: false
    });

    // Dark mode
    await client.send('Page.navigate', { url: 'http://localhost:3000/?noloader=1' });
    await sleep(800);
    await client.send('Runtime.evaluate', { expression: "document.documentElement.classList.add('dark')" });
    await sleep(200);

    const clip = { x: 0, y: 0, width: 1440, height: 90, scale: 2 };
    const shotDark = await client.send('Page.captureScreenshot', { format: 'png', clip });
    fs.writeFileSync('docs/visual-8-2/navbar-dark-preview.png', Buffer.from(shotDark.data, 'base64'));

    // Light mode
    await client.send('Runtime.evaluate', { expression: "document.documentElement.classList.remove('dark')" });
    await sleep(200);
    const shotLight = await client.send('Page.captureScreenshot', { format: 'png', clip });
    fs.writeFileSync('docs/visual-8-2/navbar-light-preview.png', Buffer.from(shotLight.data, 'base64'));

    console.log('✅ Captured navbar screenshots successfully!');
    client.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    chrome.kill();
  }
}
run();
