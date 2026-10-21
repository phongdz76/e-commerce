const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { CDP } = require('../tests/fixtures/browser-cdp.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function verifyHomepageCmsBrowser({ origin, cookie, artifacts, checks, readPublic }) {
  const browser = spawn(process.env.CHROME_PATH || process.env.CHROME_BIN || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : 'google-chrome'), [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=9372',
    '--user-data-dir=' + path.join(artifacts, 'chrome-cms-' + Date.now()), 'about:blank',
  ], { windowsHide: true, stdio: 'ignore' });
  let page;
  const errors = [];
  try {
    for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:9372/json/version')).ok) break; } catch {} await delay(100); }
    const target = await fetch('http://127.0.0.1:9372/json/new?about:blank', { method: 'PUT' }).then(r => r.json());
    page = new CDP(target.webSocketDebuggerUrl);
    await page.send('Page.enable'); await page.send('Runtime.enable'); await page.send('Network.enable');
    page.listeners.set('Runtime.exceptionThrown', event => errors.push(event.exceptionDetails.text));
    const [name, value] = cookie.split('=');
    await page.send('Network.setCookie', { name, value, url: origin, path: '/', httpOnly: true, sameSite: 'Lax' });
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await page.send('Page.navigate', { url: origin + '/admin/homepage' });
    await page.wait(`document.body.innerText.includes('Published revision') && document.querySelector('input[aria-label="Banner eyebrow"]') && ![...document.querySelectorAll('button')].find(b=>b.textContent==='Save draft').disabled`);
    const marker = 'QA saved banner ' + Date.now();
    await page.evaluate(text => { const input = document.querySelector('input[aria-label="Banner eyebrow"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, text); input.dispatchEvent(new Event('input', { bubbles: true })); }, marker);
    await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent === 'Save draft').click());
    await page.wait(`document.body.innerText.includes('Draft saved. Preview it before publishing.')`);
    assert.notEqual((await readPublic()).publication.content.slides[0].eyebrow, marker);
    await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent === 'Preview').click());
    // innerText applies the banner's CSS uppercase, while the saved CMS text keeps its original casing.
    const savedEyebrow = `document.querySelector('iframe[title="Saved homepage draft preview"]')?.contentDocument?.querySelector('.home-eyebrow')?.textContent.trim()`;
    await page.wait(`${savedEyebrow} === ${JSON.stringify(marker)}`);
    assert.equal(await page.evaluate(savedEyebrow), marker, 'Protected iframe renders the exact saved draft');
    for (const width of [1440, 390, 320]) {
      await page.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      await delay(100);
      assert.equal(await page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), true, 'Admin preview stays within the page at ' + width);
    }
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent === 'Publish homepage').click());
    await page.wait(`document.body.innerText.includes('Homepage published. Visitors will see this version')`);
    assert.equal((await readPublic()).publication.content.slides[0].eyebrow, marker);
    await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent === 'History').click());
    await page.wait(`document.body.innerText.includes('Published revisions')`);
    const oldPublic = (await readPublic()).publication.id;
    await page.evaluate(() => [...document.querySelectorAll('button')].filter(button => button.textContent === 'Copy to draft').at(-1).click());
    await page.wait(`document.body.innerText.includes('Revision copied to the draft')`);
    assert.equal((await readPublic()).publication.id, oldPublic, 'Restore only changes the draft');
    await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent === 'Banners').click());
    await page.wait(`!!document.querySelector('input[aria-label="Banner eyebrow"]')`);
    assert.notEqual(await page.evaluate(() => document.querySelector('input[aria-label="Banner eyebrow"]').value), marker);
    const screenshot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    fs.writeFileSync(path.join(artifacts, 'homepage-cms-admin-1440.png'), Buffer.from(screenshot.data, 'base64'));
    assert.deepEqual(errors, []);
    checks.push('Chrome admin saves a private draft, previews it in a protected iframe, publishes to the actual public API and restores a historical draft; 320/390/1440px and zero runtime exceptions');
  } catch (error) {
    if (page) {
      const diagnostic = await page.evaluate(() => {
        const iframe = document.querySelector('iframe[title="Saved homepage draft preview"]');
        const frame = iframe?.contentDocument;
        const eyebrow = frame?.querySelector('.home-eyebrow');
        return {
          page: location.pathname,
          preview: iframe?.getAttribute('src'),
          frameReadyState: frame?.readyState,
          savedText: eyebrow?.textContent.trim(),
          displayedText: eyebrow?.innerText,
          alerts: [...document.querySelectorAll('[role="alert"]')].map(element => element.textContent),
        };
      }).catch(() => null);
      fs.writeFileSync(path.join(artifacts, 'homepage-cms-failure-results.json'), JSON.stringify({ error: error.message, diagnostic, runtimeExceptions: errors }, null, 2));
      const screenshot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }).catch(() => null);
      if (screenshot) fs.writeFileSync(path.join(artifacts, 'homepage-cms-failure.png'), Buffer.from(screenshot.data, 'base64'));
      console.error('Homepage CMS browser diagnostic:', JSON.stringify(diagnostic));
    }
    throw error;
  } finally {
    if (page) { await page.send('Page.close').catch(() => {}); page.close(); }
    if (browser.pid && browser.exitCode === null) {
      if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      else browser.kill('SIGTERM');
    }
  }
}
module.exports = { verifyHomepageCmsBrowser };
