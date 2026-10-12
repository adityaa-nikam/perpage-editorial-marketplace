const { spawn } = require('child_process');

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
    ready: new Promise(r => { ws.onopen = r; }),
    send: (method, params = {}) => new Promise((resolve, reject) => {
      const reqId = id++;
      pending.set(reqId, { resolve, reject });
      ws.send(JSON.stringify({ id: reqId, method, params }));
    }),
    close: () => ws.close()
  };
}

async function run() {
  const port = 9233;
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
          targetWs = (await res.json()).webSocketDebuggerUrl;
          break;
        }
      } catch (e) {}
      await sleep(300);
    }

    const client = createClient(targetWs);
    await client.ready;
    await client.send('Page.enable');
    await client.send('DOM.enable');
    await client.send('Runtime.enable');

    await client.send('Page.navigate', { url: 'http://localhost:3000/dashboard?mockUser=1' });
    await sleep(800);
    await client.send('Runtime.evaluate', { expression: `document.documentElement.classList.add('dark');` });
    await sleep(300);

    const axeRes = await fetch('https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js');
    await client.send('Runtime.evaluate', { expression: await axeRes.text() });

    const audit = await client.send('Runtime.evaluate', {
      expression: `
        axe.run().then(res => {
          return res.violations.map(v => ({
            id: v.id,
            impact: v.impact,
            nodes: v.nodes.map(n => ({ html: n.html, target: n.target, failureSummary: n.failureSummary }))
          }));
        })
      `,
      awaitPromise: true,
      returnByValue: true
    });

    console.log('Dashboard violations in dark mode:', JSON.stringify(audit.result.value, null, 2));
    client.close();
  } finally {
    chrome.kill();
  }
}

run();
