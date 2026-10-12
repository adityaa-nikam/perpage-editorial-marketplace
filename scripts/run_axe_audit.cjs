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
  console.log('🧪 Starting axe-core automated accessibility audit across all pages and themes...');
  const port = 9231;
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

    const client = createClient(targetWs);
    await client.ready;

    await client.send('Page.enable');
    await client.send('DOM.enable');
    await client.send('Runtime.enable');

    // Fetch axe-core bundle
    const axeRes = await fetch('https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js');
    const axeSource = await axeRes.text();

    const pages = [
      { name: 'Landing (/)', url: 'http://localhost:3000/?noloader=1' },
      { name: 'Editors (/writers)', url: 'http://localhost:3000/writers' },
      { name: 'About (/about)', url: 'http://localhost:3000/about' },
      { name: 'Login (/login)', url: 'http://localhost:3000/login' },
      { name: 'Dashboard (/dashboard)', url: 'http://localhost:3000/dashboard?mockUser=1' }
    ];

    let totalCritical = 0;
    let totalSerious = 0;

    for (const p of pages) {
      for (const theme of ['light', 'dark']) {
        await client.send('Page.navigate', { url: p.url });
        await sleep(600);

        await client.send('Runtime.evaluate', {
          expression: `
            if ('${theme}' === 'dark') {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
          `
        });
        await sleep(200);

        // Inject axe
        await client.send('Runtime.evaluate', { expression: axeSource });

        // Run axe
        const auditRes = await client.send('Runtime.evaluate', {
          expression: `
            new Promise((resolve) => {
              axe.run(document, {
                runOnly: {
                  type: 'tag',
                  values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
                }
              }).then(results => {
                const critical = results.violations.filter(v => v.impact === 'critical');
                const serious = results.violations.filter(v => v.impact === 'serious');
                const moderate = results.violations.filter(v => v.impact === 'moderate');
                resolve({
                  criticalCount: critical.length,
                  seriousCount: serious.length,
                  moderateCount: moderate.length,
                  passesCount: results.passes.length,
                  criticalDetails: critical.map(v => ({ id: v.id, desc: v.description })),
                  seriousDetails: serious.map(v => ({ id: v.id, desc: v.description }))
                });
              });
            })
          `,
          awaitPromise: true,
          returnByValue: true
        });

        const r = auditRes.result.value;
        totalCritical += r.criticalCount;
        totalSerious += r.seriousCount;

        console.log(`  Page: ${p.name} [${theme.toUpperCase()}]`);
        console.log(`    Passes: ${r.passesCount} | Critical: ${r.criticalCount} | Serious: ${r.seriousCount} | Moderate: ${r.moderateCount}`);
        if (r.criticalCount > 0) console.warn('    Critical details:', r.criticalDetails);
        if (r.seriousCount > 0) console.warn('    Serious details:', r.seriousDetails);
      }
    }

    console.log(`\n🏁 Total Across All Pages & Themes: Critical = ${totalCritical}, Serious = ${totalSerious}`);
    if (totalCritical === 0 && totalSerious === 0) {
      console.log('✅ AXE AUDIT PASSED: ZERO CRITICAL AND ZERO SERIOUS VIOLATIONS!');
    }

    client.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    chrome.kill();
  }
}

run();
