const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const port = 9228;
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    `--remote-debugging-port=${port}`,
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

    if (!targetWs) throw new Error('No target WS');

    const ws = new WebSocket(targetWs);
    let id = 1;
    const pending = new Map();
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.id && pending.has(d.id)) {
        pending.get(d.id)(d.result);
        pending.delete(d.id);
      }
    };
    await new Promise(r => ws.onopen = r);
    const send = (method, params = {}) => new Promise(r => {
      const reqId = id++;
      pending.set(reqId, r);
      ws.send(JSON.stringify({ id: reqId, method, params }));
    });

    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1600, deviceScaleFactor: 1.5, mobile: false });

    const filePath = 'file:///' + path.resolve(__dirname, '..', 'docs', 'visual-8-2', 'CONTACT_SHEET.html').replace(/\\/g, '/');
    await send('Page.navigate', { url: filePath });
    await sleep(2000);

    const ss = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.resolve(__dirname, '..', 'docs', 'visual-8-2', 'CONTACT_SHEET.png'), Buffer.from(ss.data, 'base64'));
    console.log('✅ CONTACT_SHEET.png captured successfully');
    ws.close();
  } catch (e) {
    console.error('Error:', e);
  } finally {
    chrome.kill();
  }
}

run();
