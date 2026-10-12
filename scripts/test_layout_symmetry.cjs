const { spawn } = require('child_process');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-sandbox',
    'about:blank'
  ]);

  try {
    for (let i = 0; i < 20; i++) {
      try {
        const res = await fetch('http://127.0.0.1:9222/json/version');
        if (res.ok) break;
      } catch (e) {}
      await sleep(300);
    }

    const newPageRes = await fetch('http://127.0.0.1:9222/json/new?about:blank', { method: 'PUT' });
    const target = await newPageRes.json();
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let id = 1;
    const pending = new Map();
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && pending.has(data.id)) {
        pending.get(data.id).resolve(data.result);
      }
    };
    await new Promise(r => ws.onopen = r);
    const send = (method, params = {}) => new Promise(resolve => {
      const reqId = id++;
      pending.set(reqId, { resolve });
      ws.send(JSON.stringify({ id: reqId, method, params }));
    });

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.navigate', { url: 'http://localhost:3000/' });
    await sleep(1500);

    const widths = [320, 390, 768, 1024, 1440, 1920];
    for (const w of widths) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false
      });
      await sleep(300);

      const evalRes = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const docWidth = document.documentElement.scrollWidth;
            const winWidth = window.innerWidth;
            const hasScroll = docWidth > winWidth;
            
            // Check stepper connector
            const stepperLine = document.querySelector('.timeline-stepper .stepper-step:last-child .stepper-line');
            const allStepperLines = Array.from(document.querySelectorAll('.timeline-stepper .stepper-line')).map(el => {
              const rect = el.getBoundingClientRect();
              const card = el.closest('.card');
              const cardRect = card ? card.getBoundingClientRect() : null;
              return {
                right: rect.right,
                cardRight: cardRect ? cardRect.right : null,
                extendsOut: cardRect ? rect.right > cardRect.right + 0.5 : false
              };
            });

            const sections = Array.from(document.querySelectorAll('section, nav, footer')).map(el => {
              const rect = el.getBoundingClientRect();
              const inner = el.querySelector('.max-w-6xl, .max-w-4xl') || (el.classList.contains('max-w-6xl') || el.classList.contains('max-w-4xl') ? el : null);
              const innerRect = inner ? inner.getBoundingClientRect() : null;
              return {
                tag: el.tagName,
                id: el.id,
                width: rect.width,
                left: rect.left,
                right: rect.right,
                marginLeft: innerRect ? Math.round(innerRect.left) : Math.round(rect.left),
                marginRight: innerRect ? Math.round(docWidth - innerRect.right) : Math.round(docWidth - rect.right),
                marginRightClient: innerRect ? Math.round(document.documentElement.clientWidth - innerRect.right) : Math.round(document.documentElement.clientWidth - rect.right)
              };
            });

            return { width: winWidth, docWidth, hasScroll, allStepperLines, sections };
          })()
        `,
        returnByValue: true
      });

      console.log(`=== Viewport: ${w}px ===`);
      const val = evalRes.result.value;
      console.log(`ScrollWidth: ${val.docWidth}, HasScroll: ${val.hasScroll}`);
      console.log('Stepper lines check:', JSON.stringify(val.allStepperLines));
      if (w === 1440) {
        console.log('1440px sections margins (left vs right relative to clientWidth):');
        val.sections.forEach(s => {
          if (s.tag === 'SECTION' || s.tag === 'FOOTER') {
            console.log(`  ${s.tag}#${s.id || ''}: Left=${s.marginLeft}px, Right=${s.marginRightClient}px, Diff=${Math.abs(s.marginLeft - s.marginRightClient)}px`);
          }
        });
      }
    }

    ws.close();
  } finally {
    chrome.kill();
  }
}
run();
