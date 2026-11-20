"""Onboarding page served from the plugin service port."""

CHROME_PLUGIN_PAGE = r'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Twenty Automation Bridge</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#17352c;background:#f3f7f5}*{box-sizing:border-box}body{margin:0;padding:42px 18px 70px}main{width:min(980px,100%);margin:auto}.eyebrow{color:#6a8c7d;font-size:11px;font-weight:800;letter-spacing:.16em}h1{margin:12px 0;font-size:clamp(38px,7vw,70px);letter-spacing:-.065em;line-height:.98;max-width:700px}h2{letter-spacing:-.03em}h3{margin:0 0 7px;font-size:16px}.lede{color:#698078;font-size:17px;line-height:1.55;max-width:700px}.hero{display:grid;grid-template-columns:1.2fr .8fr;gap:20px}.card{background:#fff;border:1px solid #dce9e1;border-radius:16px;box-shadow:0 16px 42px #1643330d;padding:24px}.dark{background:#1f5144;color:#fff;border-color:#1f5144}.dark p,.dark li{color:#c9ded4}.section{margin-top:20px}.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.step{background:#f7faf8;border-radius:12px;padding:17px}.number{color:#347755;font-weight:850;font-size:12px}p,li{color:#60766c;font-size:13px;line-height:1.6}ul{padding-left:20px}.release{align-items:center;display:flex;gap:14px;justify-content:space-between;margin-bottom:22px}.release h2{font-size:19px;margin:0 0 4px}.muted{color:#83968e;font-size:13px}.badge{background:#e7f4eb;border-radius:999px;color:#347755;font-size:11px;font-weight:800;padding:7px 10px}.release-actions{display:flex;flex-wrap:wrap;gap:10px}.download,.check{border-radius:9px;display:inline-block;font:inherit;font-weight:750;padding:12px 16px;text-decoration:none}.download{background:#1f5144;color:#fff}.download:hover{background:#163c33}.check{background:#f3f7f5;border:1px solid #c9dcd2;color:#1f5144;cursor:pointer}.check:hover{background:#e7f0eb}.check:disabled{cursor:wait;opacity:.6}dl{border-top:1px solid #edf2ef;display:grid;gap:13px;margin:20px 0 0;padding-top:18px}.row{display:grid;gap:12px;grid-template-columns:110px 1fr}dt{color:#869890;font-size:12px}dd{margin:0;color:#40574d;font-size:12px;overflow-wrap:anywhere}code{background:#f3f7f4;border-radius:5px;font-family:ui-monospace,monospace;padding:3px 5px}.empty{color:#8b4e38;background:#fff6ef;border:1px solid #f1d6c5;border-radius:9px;padding:13px}@media(max-width:720px){.hero,.steps{grid-template-columns:1fr}.release{align-items:flex-start;flex-direction:column}.row{grid-template-columns:88px 1fr}}
</style></head><body><main>
<div class="eyebrow">TWENTY · BROWSER AUTOMATION</div><h1>Let your portal work with the web.</h1>
<p class="lede">The Twenty Chrome plugin connects your logged-in browser to the lightweight Jev automation service on port <code>8110</code>. Inspect pages, fill forms, click through workflows, and return results to your portal.</p>
<div class="hero"><section class="card" aria-live="polite"><div id="release"><p class="muted">Loading release metadata...</p></div></section><section class="card dark"><h2>What it does</h2><p>Keep your existing Chrome session and let the portal ask for help with work already open in your browser.</p><ul><li>Fill forms without unexpected submission</li><li>Scrape page data back to the portal</li><li>Use your current tabs and login state</li></ul></section></div>
<section class="card section"><h2>Install in three steps</h2><div class="steps"><div class="step"><div class="number">01 · DOWNLOAD</div><h3>Get the ZIP</h3><p>Download the release above and unzip it somewhere permanent.</p></div><div class="step"><div class="number">02 · LOAD CHROME</div><h3>Load unpacked</h3><p>Open <code>chrome://extensions</code>, enable <strong>Developer mode</strong>, choose <strong>Load unpacked</strong>, and select the extracted folder.</p></div><div class="step"><div class="number">03 · CONNECT</div><h3>Pair with port 8110</h3><p>Open the plugin popup, enter <code>http://127.0.0.1:8110</code> and your pairing token, then choose <strong>Connect backend</strong>.</p></div></div></section>
<section class="card section"><h2>Use it from a portal</h2><p>After the extension says <strong>Connected</strong>, return to your portal in the same Chrome profile. Open the automation/help panel, choose an action such as scan, fill, navigate, click, or scrape, then review the result before committing any external change.</p></section>
<section class="card section"><h2>Connection checklist</h2><p><strong>Server:</strong> this page is served by the Chrome plugin Jev service on port <code>8110</code>. <strong>Browser:</strong> the extension must be installed and connected. <strong>Identity:</strong> the local bridge uses the pairing token and the portal's logged-in browser identity.</p><p>If disconnected, confirm the service is running, reopen the extension popup, and reconnect.</p></section>
</main><script>
const release = document.getElementById('release');
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function renderRelease(data, statusText = '') {
  if (!data.filename) { release.innerHTML = '<div class="empty">No packaged release is available yet. Check again after the plugin service starts.</div>'; return; }
  const size = `${(data.size_bytes / 1024 / 1024).toFixed(2)} MB`;
  const status = statusText || (data.refreshed ? 'Package refreshed from the current extension source.' : 'Package matches the current extension source.');
  release.innerHTML = `<div class="release"><div><h2>Agent WebBridge ${esc(data.version)}</h2><div class="muted">${esc(data.filename)} · ${size}</div></div><span class="badge">READY</span></div><div class="release-actions"><a class="download" href="${esc(data.download_url)}">Download plugin ZIP</a><button class="check" id="check-latest" type="button">Check for latest</button></div><p class="muted" id="check-status">${esc(status)}</p><dl><div class="row"><dt>SHA-256</dt><dd><code>${esc(data.sha256)}</code></dd></div><div class="row"><dt>Verify</dt><dd>PowerShell: <code>Get-FileHash .\\${esc(data.filename)} -Algorithm SHA256</code></dd></div></dl>`;
  document.getElementById('check-latest').addEventListener('click', checkLatest);
}
async function checkLatest() {
  const button = document.getElementById('check-latest');
  const status = document.getElementById('check-status');
  button.disabled = true;
  button.textContent = 'Checking...';
  status.textContent = 'Comparing extension files and refreshing the ZIP if needed...';
  try {
    const response = await fetch('/chrome-plugin/releases/check', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    renderRelease(await response.json());
  } catch (error) {
    button.disabled = false;
    button.textContent = 'Check for latest';
    status.textContent = `Could not check for updates: ${error}`;
  }
}
fetch('/chrome-plugin/releases/latest', { cache: 'no-store' }).then(response => response.json()).then(data => renderRelease(data)).catch(() => { release.innerHTML = '<div class="empty">Release metadata could not be loaded. Check that the Chrome plugin service is running.</div>'; });
</script></body></html>'''
