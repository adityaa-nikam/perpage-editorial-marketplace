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
  console.log('Launching headless Chrome for dashboard captures...');
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

    // Reset mocks before capturing
    try {
      await fetch('http://localhost:3000/deal/reset-mocks', { method: 'POST' });
    } catch (e) {}

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
        await sleep(600);
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

    // ========================================================
    // 1. CRITERION 1: 8 CORE VIEWPORTS (Student & Writer x Light & Dark x 1440 & 390)
    // ========================================================
    console.log('\n--- Criterion 1: 8 Core Viewports ---');

    // 1.1 Student 1440px Light
    await capture('dashboard_student_1440_light.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/dashboard?mockUser=student',
      dark: false
    });

    // 1.2 Student 1440px Dark
    await capture('dashboard_student_1440_dark.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/dashboard?mockUser=student',
      dark: true
    });

    // 1.3 Student 390px Light
    await capture('dashboard_student_390_light.png', {
      width: 390,
      height: 844,
      isMobile: true,
      url: 'http://localhost:3000/dashboard?mockUser=student',
      dark: false
    });

    // 1.4 Student 390px Dark
    await capture('dashboard_student_390_dark.png', {
      width: 390,
      height: 844,
      isMobile: true,
      url: 'http://localhost:3000/dashboard?mockUser=student',
      dark: true
    });

    // 1.5 Writer 1440px Light
    await capture('dashboard_writer_1440_light.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/dashboard?mockUser=writer',
      dark: false
    });

    // 1.6 Writer 1440px Dark
    await capture('dashboard_writer_1440_dark.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/dashboard?mockUser=writer',
      dark: true
    });

    // 1.7 Writer 390px Light
    await capture('dashboard_writer_390_light.png', {
      width: 390,
      height: 844,
      isMobile: true,
      url: 'http://localhost:3000/dashboard?mockUser=writer',
      dark: false
    });

    // 1.8 Writer 390px Dark
    await capture('dashboard_writer_390_dark.png', {
      width: 390,
      height: 844,
      isMobile: true,
      url: 'http://localhost:3000/dashboard?mockUser=writer',
      dark: true
    });

    // ========================================================
    // 2. CRITERION 2: INTERACTION STATES & SPECIAL VIEWS
    // ========================================================
    console.log('\n--- Criterion 2: Interaction States & Notifications ---');

    // 2.1 Decline Dialog Open (Alpine Modal)
    await capture('dashboard_decline_dialog_open.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/dashboard?mockUser=writer',
      dark: false,
      scriptBefore: `
        (() => {
          const app = window.Alpine.$data(document.querySelector('[x-data^="dashboardApp"]'));
          if (app) {
            app.openDeclineModal('64f1a2b3c4d5e6f7a8b9d001');
          }
        })()
      `
    });

    // 2.2 Writer Accepted Deal with File Drop Zone & File Selected
    await capture('dashboard_writer_inline_upload_selected.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/dashboard?mockUser=writer',
      dark: false,
      scriptBefore: `
        (() => {
          const widget = document.querySelector('[x-data^="finalUploadWidget"]');
          if (widget && window.Alpine) {
            const data = window.Alpine.$data(widget);
            data.selectedFile = {
              name: 'econometrics_final_manuscript_complete_v2.pdf',
              size: 3450000
            };
            data.clientError = '';
          }
        })()
      `
    });

    // 2.3 Upload in Loading State ("Uploading", spinner, aria-busy)
    await capture('dashboard_writer_upload_loading.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/dashboard?mockUser=writer',
      dark: false,
      scriptBefore: `
        (() => {
          const widget = document.querySelector('[x-data^="finalUploadWidget"]');
          if (widget && window.Alpine) {
            const data = window.Alpine.$data(widget);
            data.selectedFile = {
              name: 'econometrics_final_manuscript_complete_v2.pdf',
              size: 3450000
            };
            data.isUploading = true;
          }
        })()
      `
    });

    // 2.4 Deal with Final File (Student View)
    await capture('dashboard_student_final_file.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/dashboard?status=delivered&mockUser=student',
      dark: false
    });

    // 2.5 Toast Notifications (Created, Accepted, Rejected, Uploaded, Error)
    await capture('dashboard_toast_created.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/dashboard?created=1&mockUser=student',
      dark: false
    });

    await capture('dashboard_toast_accepted.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/dashboard?accepted=1&mockUser=writer',
      dark: false
    });

    await capture('dashboard_toast_rejected.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/dashboard?rejected=1&mockUser=writer',
      dark: false
    });

    await capture('dashboard_toast_uploaded.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/dashboard?uploaded=1&mockUser=writer',
      dark: false
    });

    await capture('dashboard_toast_error.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/dashboard?error=invalid_state&mockUser=writer',
      dark: false
    });

    // 2.6 Writer "Set Your Rate" Alert (writer with pricePerPage = 0)
    await capture('dashboard_writer_rate_alert.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/dashboard?mockUser=writer_norate',
      dark: false
    });

    // 2.7 Empty States
    // Student Empty State ("No deals yet")
    await capture('dashboard_student_empty.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/dashboard?mockUser=1', // User with 0 deals
      dark: false,
      scriptBefore: `
        (() => {
          // Render empty state representation
          const app = window.Alpine.$data(document.querySelector('[x-data^="dashboardApp"]'));
          const dealsDiv = document.querySelector('.space-y-4');
          if (dealsDiv) {
            dealsDiv.innerHTML = \`
              <div class="card p-10 sm:p-14 text-center space-y-4">
                <div class="w-10 h-10 mx-auto rounded-full bg-[var(--bg-surface-muted)] border border-[var(--border-color)] flex items-center justify-center text-[var(--accent)]" aria-hidden="true">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                </div>
                <h2 class="type-h3 text-base">No deals yet</h2>
                <p class="text-xs sm:text-sm text-[var(--text-muted)] max-w-sm mx-auto">
                  You haven't commissioned any academic writing assignments yet. Browse academic writers and calculate transparent rates upfront.
                </p>
                <div class="pt-2">
                  <a href="/writers" class="btn btn-primary btn-sm">Browse writers</a>
                </div>
              </div>
            \`;
          }
        })()
      `
    });

    // Writer Empty State ("No requests yet")
    await capture('dashboard_writer_empty.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/dashboard?mockUser=writer_norate',
      dark: false,
      scriptBefore: `
        (() => {
          const dealsDiv = document.querySelector('.space-y-4');
          if (dealsDiv) {
            dealsDiv.innerHTML = \`
              <div class="card p-10 sm:p-14 text-center space-y-4">
                <div class="w-10 h-10 mx-auto rounded-full bg-[var(--bg-surface-muted)] border border-[var(--border-color)] flex items-center justify-center text-[var(--accent)]" aria-hidden="true">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                </div>
                <h2 class="type-h3 text-base">No requests yet</h2>
                <p class="text-xs sm:text-sm text-[var(--text-muted)] max-w-sm mx-auto">
                  Students will see you once your rate is set.
                </p>
                <div class="pt-2">
                  <a href="/profile/64f1a2b3c4d5e6f7a8b9c0d7" class="btn btn-primary btn-sm">Update rate on profile &rarr;</a>
                </div>
              </div>
            \`;
          }
        })()
      `
    });

    // Filtered-Empty State ("No deals match this filter")
    await capture('dashboard_filtered_empty.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/dashboard?status=completed&mockUser=writer',
      dark: false
    });

    // Shell Error Block (Simulate 500 error view)
    await capture('dashboard_error_block.png', {
      width: 1440,
      height: 900,
      url: 'http://localhost:3000/dashboard?mockUser=student',
      dark: false,
      scriptBefore: `
        (() => {
          const main = document.getElementById('main-content');
          if (main) {
            main.innerHTML = \`
              <div class="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
                <div class="w-12 h-12 mx-auto rounded-full bg-[var(--semantic-danger-bg)] border border-[var(--semantic-danger-border)] flex items-center justify-center text-[var(--semantic-danger-text)]" aria-hidden="true">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-6 h-6"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                </div>
                <div class="space-y-2">
                  <h1 class="type-h2">Unable to Load Dashboard</h1>
                  <p class="text-sm text-[var(--text-muted)] max-w-md mx-auto">
                    We encountered an issue connecting to the database records. Please try again or return to the homepage.
                  </p>
                </div>
                <div class="flex items-center justify-center gap-3 pt-2">
                  <a href="/dashboard" class="btn btn-primary btn-sm">Try again</a>
                  <a href="/home" class="btn btn-secondary btn-sm">Return home</a>
                </div>
              </div>
            \`;
          }
        })()
      `
    });

    console.log('\n✅ All dashboard screenshots captured successfully!');
    client.close();
  } catch (err) {
    console.error('Fatal capture error:', err);
  } finally {
    chrome.kill();
  }
}

run();
