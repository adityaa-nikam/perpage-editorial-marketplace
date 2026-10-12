const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const AFTER_DIR = path.join(__dirname, '..', 'docs', 'visual-8-2', 'after');
if (!fs.existsSync(AFTER_DIR)) {
  fs.mkdirSync(AFTER_DIR, { recursive: true });
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
  console.log('🚀 Launching headless Chrome for visual-8-2 AFTER screenshots...');
  const port = 9226;
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

    // Find valid editor ID
    let editorId = '6ac9698be050df3e1eb4d764';
    try {
      const writersRes = await fetch('http://localhost:3000/writers');
      const writersHtml = await writersRes.text();
      const match = writersHtml.match(/\/writers\/([a-f0-9]{24})/);
      if (match) editorId = match[1];
    } catch (e) {}

    const pages = [
      { name: 'landing', url: 'http://localhost:3000/?noloader=1' },
      { name: 'editors', url: 'http://localhost:3000/writers' },
      { name: 'profile', url: `http://localhost:3000/writers/${editorId}` },
      { name: 'login', url: 'http://localhost:3000/login' },
      { name: 'dashboard', url: 'http://localhost:3000/dashboard?mockUser=1' }
    ];

    const viewports = [
      { name: '1440', width: 1440, height: 900 },
      { name: '390', width: 390, height: 844, mobile: true }
    ];

    // 1. Capture base 20 screenshots (light and dark)
    for (const page of pages) {
      for (const vp of viewports) {
        for (const theme of ['light', 'dark']) {
          console.log(`📸 Capturing ${page.name} - ${vp.name}px - ${theme}...`);
          
          await client.send('Emulation.setDeviceMetricsOverride', {
            width: vp.width,
            height: vp.height,
            deviceScaleFactor: 2,
            mobile: !!vp.mobile
          });

          await client.send('Page.navigate', { url: page.url });
          await sleep(1000);

          await client.send('Runtime.evaluate', {
            expression: `
              (function() {
                if ('${theme}' === 'dark') {
                  document.documentElement.classList.add('dark');
                  localStorage.setItem('theme', 'dark');
                } else {
                  document.documentElement.classList.remove('dark');
                  localStorage.setItem('theme', 'light');
                }
              })()
            `
          });
          await sleep(400);

          const ss = await client.send('Page.captureScreenshot', {
            format: 'png',
            captureBeyondViewport: false
          });

          const filename = `${page.name}-${vp.name}-${theme}.png`;
          fs.writeFileSync(path.join(AFTER_DIR, filename), Buffer.from(ss.data, 'base64'));
          console.log(`  ✓ Saved ${filename}`);
        }
      }
    }

    // 2. Hero animation 5 moments (1440px, light theme)
    console.log('📸 Capturing Hero animation moments...');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 2,
      mobile: false
    });

    const heroMoments = [
      {
        name: 'hero-01-original.png',
        setup: `
          const sheet = document.querySelector('.hero-doc-sheet');
          if (sheet) {
            sheet.querySelectorAll('.hero-anim-strike').forEach(s => s.classList.remove('proof-strike'));
            sheet.querySelectorAll('.hero-anim-insert').forEach(i => i.style.opacity = '0');
            const comment = sheet.querySelector('.hero-anim-comment');
            if (comment) comment.style.opacity = '0';
            const pending = sheet.querySelector('.hero-anim-status-pending');
            const deliv = sheet.querySelector('.hero-anim-status-delivered');
            if (pending) pending.style.display = 'inline-flex';
            if (deliv) deliv.style.display = 'none';
          }
        `
      },
      {
        name: 'hero-02-marked.png',
        setup: `
          const sheet = document.querySelector('.hero-doc-sheet');
          if (sheet) {
            sheet.querySelectorAll('.hero-anim-strike').forEach(s => {
              s.style.setProperty('--strike-scale', '1');
              s.querySelector('::after') || s.classList.add('proof-strike');
            });
            sheet.querySelectorAll('.hero-anim-insert').forEach(i => i.style.opacity = '0');
            const comment = sheet.querySelector('.hero-anim-comment');
            if (comment) comment.style.opacity = '0';
            const pending = sheet.querySelector('.hero-anim-status-pending');
            const deliv = sheet.querySelector('.hero-anim-status-delivered');
            if (pending) pending.style.display = 'inline-flex';
            if (deliv) deliv.style.display = 'none';
          }
        `
      },
      {
        name: 'hero-03-corrected.png',
        setup: `
          const sheet = document.querySelector('.hero-doc-sheet');
          if (sheet) {
            sheet.querySelectorAll('.hero-anim-strike').forEach(s => s.classList.add('proof-strike'));
            sheet.querySelectorAll('.hero-anim-insert').forEach(i => {
              i.style.opacity = '1';
              i.style.transform = 'translateY(0)';
            });
            const comment = sheet.querySelector('.hero-anim-comment');
            if (comment) comment.style.opacity = '0';
          }
        `
      },
      {
        name: 'hero-04-comment.png',
        setup: `
          const sheet = document.querySelector('.hero-doc-sheet');
          if (sheet) {
            sheet.querySelectorAll('.hero-anim-strike').forEach(s => s.classList.add('proof-strike'));
            sheet.querySelectorAll('.hero-anim-insert').forEach(i => {
              i.style.opacity = '1';
              i.style.transform = 'translateY(0)';
            });
            const comment = sheet.querySelector('.hero-anim-comment');
            if (comment) {
              comment.style.opacity = '1';
              comment.style.transform = 'scale(1) translateY(0)';
            }
          }
        `
      },
      {
        name: 'hero-05-delivered.png',
        setup: `
          const sheet = document.querySelector('.hero-doc-sheet');
          if (sheet) {
            sheet.querySelectorAll('.hero-anim-strike').forEach(s => s.classList.add('proof-strike'));
            sheet.querySelectorAll('.hero-anim-insert').forEach(i => {
              i.style.opacity = '1';
              i.style.transform = 'translateY(0)';
            });
            const comment = sheet.querySelector('.hero-anim-comment');
            if (comment) {
              comment.style.opacity = '1';
              comment.style.transform = 'scale(1) translateY(0)';
            }
            const pending = sheet.querySelector('.hero-anim-status-pending');
            const deliv = sheet.querySelector('.hero-anim-status-delivered');
            if (pending) pending.style.display = 'none';
            if (deliv) {
              deliv.style.display = 'inline-flex';
              deliv.style.opacity = '1';
            }
          }
        `
      }
    ];

    for (const moment of heroMoments) {
      await client.send('Page.navigate', { url: 'http://localhost:3000/?noloader=1' });
      await sleep(600);
      await client.send('Runtime.evaluate', { expression: moment.setup });
      await sleep(300);

      // Clip hero element
      const heroClipRes = await client.send('Runtime.evaluate', {
        expression: `
          (function() {
            const el = document.querySelector('section:first-of-type');
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
          })()
        `,
        returnByValue: true
      });

      let clip = heroClipRes.result && heroClipRes.result.value;
      const ssParams = { format: 'png' };
      if (clip && clip.width > 0 && clip.height > 0) {
        ssParams.clip = { x: clip.x, y: clip.y, width: clip.width, height: clip.height, scale: 1 };
      }

      const ss = await client.send('Page.captureScreenshot', ssParams);
      fs.writeFileSync(path.join(AFTER_DIR, moment.name), Buffer.from(ss.data, 'base64'));
      console.log(`  ✓ Saved ${moment.name}`);
    }

    // 3. Hero with Reduced Motion
    console.log('📸 Capturing Hero with reduced motion...');
    await client.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    });
    await client.send('Page.navigate', { url: 'http://localhost:3000/?noloader=1' });
    await sleep(600);
    const ssRM = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(AFTER_DIR, 'hero-reduced-motion.png'), Buffer.from(ssRM.data, 'base64'));
    console.log('  ✓ Saved hero-reduced-motion.png');

    // Reset media
    await client.send('Emulation.setEmulatedMedia', { features: [] });

    // 4. Hero with JS Disabled
    console.log('📸 Capturing Hero with JS disabled...');
    await client.send('Emulation.setScriptExecutionDisabled', { value: true });
    await client.send('Page.navigate', { url: 'http://localhost:3000/?noloader=1' });
    await sleep(800);
    const ssNoJS = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(AFTER_DIR, 'hero-js-disabled.png'), Buffer.from(ssNoJS.data, 'base64'));
    console.log('  ✓ Saved hero-js-disabled.png');

    // Re-enable JS
    await client.send('Emulation.setScriptExecutionDisabled', { value: false });

    // 5. How It Works Section at Each Step (1, 2, 3)
    console.log('📸 Capturing How It Works steps...');
    for (const stepNum of [1, 2, 3]) {
      await client.send('Page.navigate', { url: 'http://localhost:3000/?noloader=1#how-it-works' });
      await sleep(500);
      await client.send('Runtime.evaluate', {
        expression: `
          (function() {
            const el = document.getElementById('how-it-works');
            if (el && el._x_dataStack && el._x_dataStack[0]) {
              el._x_dataStack[0].activeStep = ${stepNum};
            }
            if (el) el.scrollIntoView();
          })()
        `
      });
      await sleep(300);

      const sectionClipRes = await client.send('Runtime.evaluate', {
        expression: `
          (function() {
            const el = document.getElementById('how-it-works');
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
          })()
        `,
        returnByValue: true
      });

      let clip = sectionClipRes.result && sectionClipRes.result.value;
      const ssParams = { format: 'png' };
      if (clip && clip.width > 0 && clip.height > 0) {
        ssParams.clip = { x: clip.x, y: clip.y, width: clip.width, height: clip.height, scale: 1 };
      }

      const ssStep = await client.send('Page.captureScreenshot', ssParams);
      const filename = `how-it-works-step${stepNum}.png`;
      fs.writeFileSync(path.join(AFTER_DIR, filename), Buffer.from(ssStep.data, 'base64'));
      console.log(`  ✓ Saved ${filename}`);
    }

    // 6. Brand Intro Loader mid-fade
    console.log('📸 Capturing Brand Intro loader mid-fade...');
    // Clear sessionStorage & navigate freshly
    await client.send('Page.navigate', { url: 'http://localhost:3000/' });
    // Capture at 350ms where the stroke is drawing and intro is visible
    await sleep(350);
    const ssIntro = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(AFTER_DIR, 'intro-loader-midfade.png'), Buffer.from(ssIntro.data, 'base64'));
    console.log('  ✓ Saved intro-loader-midfade.png');

    console.log('🎉 All AFTER screenshots captured successfully!');
    client.close();
  } catch (err) {
    console.error('❌ Error during capture:', err);
  } finally {
    chrome.kill();
  }
}

run();
