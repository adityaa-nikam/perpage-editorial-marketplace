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
    await sleep(300);
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
  console.log('Generating apple-touch-icon.png via Chrome CDP...');
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-sandbox',
    'about:blank'
  ]);

  try {
    await getWsUrl();
    const newPageRes = await fetch('http://127.0.0.1:9222/json/new?about:blank', { method: 'PUT' });
    const target = await newPageRes.json();
    const client = createClient(target.webSocketDebuggerUrl);
    await client.ready;

    await client.send('Page.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 180,
      height: 180,
      deviceScaleFactor: 1,
      mobile: false
    });

    const html = `data:text/html,<!DOCTYPE html><html><head><meta charset="utf-8"><style>* { box-sizing: border-box; margin: 0; padding: 0; } body { width: 180px; height: 180px; background: %230E0F12; display: flex; align-items: center; justify-content: center; overflow: hidden; } .p-mark { font-family: Georgia, serif; font-size: 130px; font-weight: bold; color: %23FAFAF7; line-height: 1; margin-top: -6px; user-select: none; } </style></head><body><div class="p-mark">P</div></body></html>`;

    await client.send('Page.navigate', { url: html });
    await sleep(600);

    const shot = await client.send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(shot.data, 'base64');
    const outPath = path.join(__dirname, '..', 'public', 'apple-touch-icon.png');
    fs.writeFileSync(outPath, buf);
    console.log('Successfully wrote', outPath, `(${buf.length} bytes)`);

    client.close();
  } finally {
    chrome.kill();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
