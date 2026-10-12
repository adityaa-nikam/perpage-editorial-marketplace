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
  const port = 9230;
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

    console.log('--- 1. Horizontal Scroll Check across Breakpoints (320, 390, 768, 1024, 1440, 1920) ---');
    const breakpoints = [320, 390, 768, 1024, 1440, 1920];
    for (const bp of breakpoints) {
      await client.send('Emulation.setDeviceMetricsOverride', { width: bp, height: 900, deviceScaleFactor: 1, mobile: bp < 768 });
      await client.send('Page.navigate', { url: 'http://localhost:3000/?noloader=1' });
      await sleep(500);

      const checkRes = await client.send('Runtime.evaluate', {
        expression: `
          (function() {
            const docWidth = document.documentElement.clientWidth;
            const scrollWidth = document.documentElement.scrollWidth;
            const bodyScrollWidth = document.body.scrollWidth;
            const maxScroll = Math.max(scrollWidth, bodyScrollWidth);
            return {
              docWidth,
              scrollWidth: maxScroll,
              hasOverflow: maxScroll > docWidth
            };
          })()
        `,
        returnByValue: true
      });

      const res = checkRes.result.value;
      console.log(`  Width ${bp}px: clientWidth=${res.docWidth}, scrollWidth=${res.scrollWidth}, hasOverflow=${res.hasOverflow}`);
    }

    console.log('\n--- 2. Symmetric Margins Check at 1440px on Every Landing Section ---');
    await client.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await client.send('Page.navigate', { url: 'http://localhost:3000/?noloader=1' });
    await sleep(600);

    const marginRes = await client.send('Runtime.evaluate', {
      expression: `
        (function() {
          const sections = document.querySelectorAll('main > section');
          const clientW = document.documentElement.clientWidth;
          const results = [];
          sections.forEach((sec, idx) => {
            const container = sec.querySelector('.max-w-6xl') || sec.querySelector('.max-w-4xl') || (sec.classList.contains('max-w-6xl') || sec.classList.contains('max-w-4xl') ? sec : null);
            if (container) {
              const rect = container.getBoundingClientRect();
              const leftMargin = rect.left;
              const rightMargin = clientW - rect.right;
              const diff = Math.abs(leftMargin - rightMargin);
              results.push({
                index: idx + 1,
                leftMargin: Math.round(leftMargin),
                rightMargin: Math.round(rightMargin),
                diff: Math.round(diff),
                isSymmetric: diff <= 1
              });
            } else {
              results.push({
                index: idx + 1,
                isFullWidth: true
              });
            }
          });
          return results;
        })()
      `,
      returnByValue: true
    });

    marginRes.result.value.forEach(m => {
      if (m.isFullWidth) {
        console.log(`  Section ${m.index} (Full-width ink band): 100% width — Symmetric`);
      } else {
        console.log(`  Section ${m.index}: left=${m.leftMargin}px, right=${m.rightMargin}px, diff=${m.diff}px — Symmetric: ${m.isSymmetric}`);
      }
    });

    console.log('\n--- 3. Keyboard Accessibility & Focus Ring Walkthrough ---');
    const kbRes = await client.send('Runtime.evaluate', {
      expression: `
        (function() {
          const focusables = Array.from(document.querySelectorAll('a, button, input, [tabindex]:not([tabindex="-1"])'));
          const pauseBtn = document.querySelector('button[aria-label*="animation"]');
          const replayBtn = document.querySelector('button[aria-label="Replay animation"]');
          
          let focusRingVisible = false;
          if (pauseBtn) {
            pauseBtn.focus();
            const cs = window.getComputedStyle(pauseBtn);
            focusRingVisible = cs.outlineStyle !== 'none' || cs.boxShadow.includes('rgba') || cs.outlineWidth !== '0px';
          }
          
          return {
            totalFocusable: focusables.length,
            hasPauseBtn: !!pauseBtn,
            hasReplayBtn: !!replayBtn,
            focusRingVisible
          };
        })()
      `,
      returnByValue: true
    });
    console.log('  Keyboard controls audit:', kbRes.result.value);

    console.log('\n--- 4. Performance & Core Web Vitals (LCP & CLS) ---');
    // Test without intro
    await client.send('Page.navigate', { url: 'http://localhost:3000/?noloader=1' });
    await sleep(1500);
    const vitalsWithoutIntro = await client.send('Runtime.evaluate', {
      expression: `
        (function() {
          const navEntries = performance.getEntriesByType('navigation');
          const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
          const layoutShifts = performance.getEntriesByType('layout-shift');
          let cls = 0;
          layoutShifts.forEach(ls => { if (!ls.hadRecentInput) cls += ls.value; });
          const lcp = lcpEntries.length > 0 ? lcpEntries[lcpEntries.length - 1].startTime : (navEntries[0] ? navEntries[0].domContentLoadedEventEnd : 0);
          return { lcp: Math.round(lcp), cls: Number(cls.toFixed(4)) };
        })()
      `,
      returnByValue: true
    });

    // Test with intro (fresh navigation)
    await client.send('Runtime.evaluate', { expression: 'sessionStorage.clear();' });
    await client.send('Page.navigate', { url: 'http://localhost:3000/' });
    await sleep(1500);
    const vitalsWithIntro = await client.send('Runtime.evaluate', {
      expression: `
        (function() {
          const navEntries = performance.getEntriesByType('navigation');
          const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
          const layoutShifts = performance.getEntriesByType('layout-shift');
          let cls = 0;
          layoutShifts.forEach(ls => { if (!ls.hadRecentInput) cls += ls.value; });
          const lcp = lcpEntries.length > 0 ? lcpEntries[lcpEntries.length - 1].startTime : (navEntries[0] ? navEntries[0].domContentLoadedEventEnd : 0);
          return { lcp: Math.round(lcp), cls: Number(cls.toFixed(4)) };
        })()
      `,
      returnByValue: true
    });

    console.log(`  Without brand intro: LCP = ${vitalsWithoutIntro.result.value.lcp}ms, CLS = ${vitalsWithoutIntro.result.value.cls}`);
    console.log(`  With brand intro:    LCP = ${vitalsWithIntro.result.value.lcp}ms, CLS = ${vitalsWithIntro.result.value.cls}`);
    const delta = vitalsWithIntro.result.value.lcp - vitalsWithoutIntro.result.value.lcp;
    console.log(`  LCP delta: ${delta}ms (${delta <= 200 ? 'PASSED: < 200ms regression threshold' : 'FLAGGED'})`);

    client.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    chrome.kill();
  }
}

run();
