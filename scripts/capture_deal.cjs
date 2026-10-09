const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const OUTPUT_DIR = 'C:\\Users\\adiit\\.gemini\\antigravity-ide\\brain\\f12073a1-d79a-4be4-8a02-d5fedffb70d1\\screenshots';
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

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
    await sleep(500);
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
  console.log('Launching headless Chrome for deal page captures...');
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    'about:blank'
  ]);

  try {
    const wsUrl = await getWsUrl();
    const newPageRes = await fetch('http://127.0.0.1:9222/json/new?about:blank', { method: 'PUT' });
    const target = await newPageRes.json();
    const client = createClient(target.webSocketDebuggerUrl);
    await client.ready;

    await client.send('Page.enable');
    await client.send('DOM.enable');
    await client.send('Runtime.enable');

    async function capture(filename, { width, height, isMobile = false, url, dark = false, fullPage = true, scriptBefore = null }) {
      console.log(`Capturing ${filename}...`);
      await client.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 2,
        mobile: isMobile
      });

      await client.send('Page.navigate', { url });
      await sleep(1500); // Wait for fonts, alpine & rendering

      // Force theme
      await client.send('Runtime.evaluate', {
        expression: dark 
          ? `document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark');`
          : `document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light');`
      });
      await sleep(300);

      if (scriptBefore) {
        await client.send('Runtime.evaluate', { expression: scriptBefore });
        await sleep(500);
      }

      const params = { format: 'png' };
      if (fullPage) {
        params.captureBeyondViewport = true;
      }

      const shot = await client.send('Page.captureScreenshot', params);
      const buf = Buffer.from(shot.data, 'base64');
      const outPath = path.join(OUTPUT_DIR, filename);
      fs.writeFileSync(outPath, buf);
      console.log(`Saved ${outPath} (${buf.length} bytes)`);
    }

    const WRITER_ID = '64f1a2b3c4d5e6f7a8b9c0d1'; // Eleanor Vance
    const EMPTY_WRITER_ID = '64f1a2b3c4d5e6f7a8b9c0d7'; // Kavita Patel (rate = 0)

    // 1. Core Viewports: 1440px and 390px in Light & Dark (4 total)
    await capture('deal_1440_light.png', {
      width: 1440,
      height: 900,
      url: `http://localhost:3000/deal?writerId=${WRITER_ID}&mockUser=1`,
      dark: false
    });

    await capture('deal_1440_dark.png', {
      width: 1440,
      height: 900,
      url: `http://localhost:3000/deal?writerId=${WRITER_ID}&mockUser=1`,
      dark: true
    });

    await capture('deal_390_light.png', {
      width: 390,
      height: 844,
      isMobile: true,
      url: `http://localhost:3000/deal?writerId=${WRITER_ID}&mockUser=1`,
      dark: false
    });

    await capture('deal_390_dark.png', {
      width: 390,
      height: 844,
      isMobile: true,
      url: `http://localhost:3000/deal?writerId=${WRITER_ID}&mockUser=1`,
      dark: true
    });

    // 2. State: File selected row (Alpine display)
    await capture('deal_file_selected.png', {
      width: 1440,
      height: 900,
      url: `http://localhost:3000/deal?writerId=${WRITER_ID}&mockUser=1`,
      dark: false,
      scriptBefore: `
        (() => {
          const el = document.querySelector('[x-data^="dealForm"]');
          if (el && window.Alpine) {
            const data = window.Alpine.$data(el);
            data.selectedFile = {
              name: 'econometrics_term_paper_syllabus_2026.pdf',
              size: 2450000
            };
            data.clientFileError = '';
          }
        })()
      `
    });

    // 3. State: File too large (>10MB client feedback)
    await capture('deal_file_too_large.png', {
      width: 1440,
      height: 900,
      url: `http://localhost:3000/deal?writerId=${WRITER_ID}&mockUser=1`,
      dark: false,
      scriptBefore: `
        (() => {
          const el = document.querySelector('[x-data^="dealForm"]');
          if (el && window.Alpine) {
            const data = window.Alpine.$data(el);
            data.clientFileError = 'File exceeds the maximum size of 10MB.';
            data.selectedFile = {
              name: 'huge_research_archive_presentation.pdf',
              size: 15728640
            };
          }
        })()
      `
    });

    // 4. State: Wrong file type (non-PDF client feedback)
    await capture('deal_wrong_file_type.png', {
      width: 1440,
      height: 900,
      url: `http://localhost:3000/deal?writerId=${WRITER_ID}&mockUser=1`,
      dark: false,
      scriptBefore: `
        (() => {
          const el = document.querySelector('[x-data^="dealForm"]');
          if (el && window.Alpine) {
            const data = window.Alpine.$data(el);
            data.clientFileError = 'Only PDF documents are accepted.';
            data.selectedFile = {
              name: 'assignment_specifications.docx',
              size: 450000
            };
          }
        })()
      `
    });

    // 5. State: Loading state on submit (spinner + uploading + muted caption)
    await capture('deal_loading_state.png', {
      width: 1440,
      height: 900,
      url: `http://localhost:3000/deal?writerId=${WRITER_ID}&mockUser=1`,
      dark: false,
      scriptBefore: `
        (() => {
          const el = document.querySelector('[x-data^="dealForm"]');
          if (el && window.Alpine) {
            const data = window.Alpine.$data(el);
            data.isSubmitting = true;
          }
        })()
      `
    });

    // 6. State: Validation errors with error summary Alert (simulate server re-render on invalid submit)
    await capture('deal_validation_errors.png', {
      width: 1440,
      height: 900,
      url: `http://localhost:3000/deal?writerId=${WRITER_ID}&mockUser=1`,
      dark: false,
      scriptBefore: `
        (() => {
          // Inject error summary and field error borders to demonstrate exact server error state
          const formCard = document.querySelector('.card form');
          const summary = document.createElement('div');
          summary.id = 'error-summary';
          summary.className = 'alert alert-danger space-y-2 mb-6';
          summary.setAttribute('role', 'alert');
          summary.innerHTML = \`
            <div class="flex items-center gap-2 font-semibold">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4 shrink-0"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              <span>There was a problem with your submission:</span>
            </div>
            <ul class="list-disc list-inside space-y-1 text-xs pl-6">
              <li><a href="#pages" class="underline hover:text-[var(--text-ink)]">Page count must be between 1 and 500.</a></li>
              <li><a href="#file" class="underline hover:text-[var(--text-ink)]">Please upload your assignment brief (PDF).</a></li>
            </ul>
            <p class="text-xs italic pt-1 border-t border-[var(--semantic-danger-border)]">
              Note: Please select your file again.
            </p>
          \`;
          formCard.parentElement.insertBefore(summary, formCard);

          const pagesInput = document.getElementById('pages');
          if (pagesInput) {
            pagesInput.classList.add('border-[var(--semantic-danger-border)]');
            pagesInput.value = '0';
          }
        })()
      `
    });

    // 7. State: Writer with no rate set (Empty-state block)
    await capture('deal_writer_no_rate.png', {
      width: 1440,
      height: 900,
      url: `http://localhost:3000/deal?writerId=${EMPTY_WRITER_ID}&mockUser=1`,
      dark: false
    });

    // 8. State: Invalid writer ID (404 Shell Error View)
    await capture('deal_invalid_writer.png', {
      width: 1440,
      height: 900,
      url: `http://localhost:3000/deal?writerId=invalid_writer_id_xyz&mockUser=1`,
      dark: false
    });

    // 9. State: Logged-out user redirect (Browser lands on /login)
    await capture('deal_logged_out_redirect.png', {
      width: 1440,
      height: 900,
      url: `http://localhost:3000/deal?writerId=${WRITER_ID}`, // No mockUser, redirected to /login
      dark: false
    });

    console.log('🎉 All deal screenshots captured successfully!');
    client.close();
  } catch (err) {
    console.error('❌ Capture error:', err);
  } finally {
    chrome.kill();
  }
}

run();
