const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9233',
    '--disable-gpu',
    '--no-sandbox',
    'about:blank'
  ]);

  try {
    for (let i = 0; i < 20; i++) {
      try {
        const res = await fetch('http://127.0.0.1:9233/json/version');
        if (res.ok) break;
      } catch (e) {}
      await sleep(300);
    }

    const newPage = await fetch('http://127.0.0.1:9233/json/new?about:blank', { method: 'PUT' });
    const target = await newPage.json();
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let id = 1;
    const send = (method, params = {}) => new Promise((resolve) => {
      const curId = id++;
      const handler = (evt) => {
        const d = JSON.parse(evt.data);
        if (d.id === curId) {
          ws.removeEventListener('message', handler);
          resolve(d.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: curId, method, params }));
    });

    await new Promise(r => ws.onopen = r);
    await send('Page.enable');

    const inputPath = 'C:/Users/adiit/.gemini/antigravity-ide/brain/f12073a1-d79a-4be4-8a02-d5fedffb70d1/.user_uploaded/media_1791780949703.jpg';
    const imgBase64 = fs.readFileSync(inputPath).toString('base64');

    const html = `<!DOCTYPE html>
<html>
<body>
<canvas id="cOriginal" width="1024" height="1024"></canvas>
<canvas id="cDark" width="1024" height="1024"></canvas>
<canvas id="cLight" width="1024" height="1024"></canvas>
<canvas id="cTile" width="128" height="128"></canvas>
<script>
  window.ready = false;
  const img = new Image();
  img.onload = () => {
    const cOrig = document.getElementById('cOriginal');
    const ctxOrig = cOrig.getContext('2d');
    ctxOrig.drawImage(img, 0, 0);

    const idata = ctxOrig.getImageData(0, 0, 1024, 1024);
    const d = idata.data;

    // Create transparent Dark Logo (white logo on transparent background for dark mode)
    const cDark = document.getElementById('cDark');
    const ctxDark = cDark.getContext('2d');
    const idataDark = ctxDark.createImageData(1024, 1024);
    const dDark = idataDark.data;

    // Create transparent Light Logo (black logo on transparent background for light mode)
    const cLight = document.getElementById('cLight');
    const ctxLight = cLight.getContext('2d');
    const idataLight = ctxLight.createImageData(1024, 1024);
    const dLight = idataLight.data;

    const pStem = ctxOrig.getImageData(350, 500, 1, 1).data;
    const pCorner = ctxOrig.getImageData(50, 50, 1, 1).data;
    window.samples = { stem: [pStem[0], pStem[1], pStem[2]], corner: [pCorner[0], pCorner[1], pCorner[2]] };

    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i+1], b = d[i+2];
      const brightness = (r * 0.299 + g * 0.587 + b * 0.114);

      // Smooth alpha mapping
      let alpha = 0;
      if (brightness < 100) {
        alpha = 255;
      } else if (brightness >= 220) {
        alpha = 0;
      } else {
        alpha = Math.round(255 * (1 - (brightness - 100) / 120));
      }

      // Dark mode version (pure white #ffffff with alpha)
      dDark[i] = 255;
      dDark[i+1] = 255;
      dDark[i+2] = 255;
      dDark[i+3] = alpha;

      // Light mode version (deep charcoal/black #111827 with alpha)
      dLight[i] = 17;
      dLight[i+1] = 24;
      dLight[i+2] = 39;
      dLight[i+3] = alpha;
    }

    ctxDark.putImageData(idataDark, 0, 0);
    ctxLight.putImageData(idataLight, 0, 0);

    // Also create 128x128 Tile/Favicon with rounded rect and contrast
    const cTile = document.getElementById('cTile');
    const ctxTile = cTile.getContext('2d');
    // Draw rounded background tile
    ctxTile.fillStyle = '#111827';
    ctxTile.beginPath();
    ctxTile.roundRect(0, 0, 128, 128, 28);
    ctxTile.fill();
    // Draw white logo scaled
    ctxTile.drawImage(cDark, 16, 16, 96, 96);

    window.ready = true;
    window.darkDataUrl = cDark.toDataURL('image/png');
    window.lightDataUrl = cLight.toDataURL('image/png');
    window.tileDataUrl = cTile.toDataURL('image/png');
  };
  img.src = 'data:image/jpeg;base64,${imgBase64}';
</script>
</body>
</html>`;

    await send('Page.navigate', { url: 'data:text/html,' + encodeURIComponent(html) });

    for (let i = 0; i < 30; i++) {
      const res = await send('Runtime.evaluate', { expression: 'window.ready === true' });
      if (res.result && res.result.value) break;
      await sleep(200);
    }

    const samplesRes = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.samples)' });
    console.log('Sampled pixels:', samplesRes.result.value);

    const darkRes = await send('Runtime.evaluate', { expression: 'window.darkDataUrl' });
    const lightRes = await send('Runtime.evaluate', { expression: 'window.lightDataUrl' });
    const tileRes = await send('Runtime.evaluate', { expression: 'window.tileDataUrl' });

    const darkBase64 = darkRes.result.value.replace(/^data:image\/png;base64,/, '');
    const lightBase64 = lightRes.result.value.replace(/^data:image\/png;base64,/, '');
    const tileBase64 = tileRes.result.value.replace(/^data:image\/png;base64,/, '');

    const pubDir = path.join(__dirname, '..', 'public');
    fs.writeFileSync(path.join(pubDir, 'logo-white.png'), Buffer.from(darkBase64, 'base64'));
    fs.writeFileSync(path.join(pubDir, 'logo.png'), Buffer.from(lightBase64, 'base64'));
    fs.writeFileSync(path.join(pubDir, 'apple-touch-icon.png'), Buffer.from(tileBase64, 'base64'));
    fs.writeFileSync(path.join(pubDir, 'favicon.png'), Buffer.from(tileBase64, 'base64'));

    const adaptiveFaviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <style>
    .bg { fill: #0f172a; }
    .mark-dark { display: block; }
    .mark-light { display: none; }
    @media (prefers-color-scheme: light) {
      .bg { fill: #ffffff; }
      .mark-dark { display: none; }
      .mark-light { display: block; }
    }
  </style>
  <rect class="bg" width="128" height="128" rx="28" />
  <image class="mark-dark" href="data:image/png;base64,${darkBase64}" x="16" y="16" width="96" height="96" />
  <image class="mark-light" href="data:image/png;base64,${lightBase64}" x="16" y="16" width="96" height="96" />
</svg>`;
    fs.writeFileSync(path.join(pubDir, 'favicon.svg'), adaptiveFaviconSvg);

    console.log('✅ Generated logo-white.png, logo.png, apple-touch-icon.png, favicon.png, favicon.svg');

    ws.close();
  } finally {
    chrome.kill();
  }
}

run().catch(console.error);
