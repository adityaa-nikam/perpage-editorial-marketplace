const { spawn } = require('child_process');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9228',
    '--disable-gpu',
    '--no-sandbox',
    'about:blank'
  ]);

  try {
    for (let i = 0; i < 20; i++) {
      try {
        const res = await fetch('http://127.0.0.1:9228/json/version');
        if (res.ok) break;
      } catch (e) {}
      await sleep(300);
    }

    const newPageRes = await fetch('http://127.0.0.1:9228/json/new?about:blank', { method: 'PUT' });
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
    await send('Emulation.setDeviceMetricsOverride', {
      width: 768,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    await send('Page.navigate', { url: 'http://localhost:3000/' });
    await sleep(1000);

    const res = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const list = [];
          document.querySelectorAll('*').forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.right > 768.1) {
              list.push({
                tag: el.tagName,
                cls: (el.className || '').toString().slice(0, 50),
                right: r.right,
                width: r.width,
                text: (el.innerText || '').slice(0, 30).replace(/\\n/g, ' ')
              });
            }
          });
          return {
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
            list
          };
        })()
      `,
      returnByValue: true
    });

    console.log('RESULT:', JSON.stringify(res.result.value, null, 2));
    ws.close();
  } finally {
    chrome.kill();
  }
}

run();
