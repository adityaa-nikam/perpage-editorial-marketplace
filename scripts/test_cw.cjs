const { spawn } = require('child_process');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9226',
    '--disable-gpu',
    '--no-sandbox',
    'about:blank'
  ]);

  try {
    for (let i = 0; i < 20; i++) {
      try {
        const res = await fetch('http://127.0.0.1:9226/json/version');
        if (res.ok) break;
      } catch (e) {}
      await sleep(300);
    }

    const newPageRes = await fetch('http://127.0.0.1:9226/json/new?http://localhost:3000/', { method: 'PUT' });
    const target = await newPageRes.json();
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let id = 1;
    const send = (method, params = {}) => new Promise((resolve) => {
      const reqId = id++;
      const handler = (evt) => {
        const d = JSON.parse(evt.data);
        if (d.id === reqId) {
          ws.removeEventListener('message', handler);
          resolve(d.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: reqId, method, params }));
    });

    await new Promise(r => ws.onopen = r);
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 768, height: 900, deviceScaleFactor: 1, mobile: false });
    await sleep(800);

    const res = await send('Runtime.evaluate', {
      expression: `
        ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          innerWidth: window.innerWidth,
          hasHScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth
        })
      `,
      returnByValue: true
    });

    console.log('MEASUREMENTS AT 768px:', res.result.value);
    ws.close();
  } finally {
    chrome.kill();
  }
}

run();
