const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { CDP } = require('../tests/fixtures/browser-cdp.cjs');

async function verifyProductEngagementBrowser({ origin, cookie, productId, artifacts, checks }) {
  const port = Number(process.env.QA_ENGAGEMENT_BROWSER_PORT || 9354);
  const chrome = process.env.CHROME_BIN || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : 'google-chrome');
  const browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + port,
    '--user-data-dir=' + path.join(artifacts, 'chrome-engagement-' + Date.now()), 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let page, stage = 'starting browser';
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try { ready = (await fetch(`http://127.0.0.1:${port}/json/version`)).ok; } catch {}
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready);
    const target = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' }).then(r => r.json());
    page = new CDP(target.webSocketDebuggerUrl);
    for (const method of ['Page.enable', 'Runtime.enable', 'Network.enable']) await page.send(method);
    const exceptions = [];
    page.listeners.set('Runtime.exceptionThrown', event => exceptions.push(event.exceptionDetails.text));
    const split = cookie.indexOf('=');
    await page.send('Network.setCookies', { cookies: [{ name: cookie.slice(0, split), value: cookie.slice(split + 1), url: origin, httpOnly: true, sameSite: 'Lax' }] });
    const navigate = async (route, marker) => { await page.send('Page.navigate', { url: origin + route }); await page.wait(marker); };
    const click = async text => {
      await page.wait(`Array.from(document.querySelectorAll('button')).some(el=>el.innerText===${JSON.stringify(text)}&&!el.disabled)`);
      await page.evaluate(label => Array.from(document.querySelectorAll('button')).find(el => el.innerText === label).click(), text);
    };
    const screenshot = async name => {
      assert.equal(await page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), true);
      const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      fs.writeFileSync(path.join(artifacts, name + '.png'), Buffer.from(shot.data, 'base64'));
    };
    stage = 'saving wishlist';
    await navigate('/product/' + productId, 'document.body.innerText.includes("Write a review")&&document.body.innerText.includes("Save to wishlist")');
    await click('Save to wishlist');
    await page.wait('document.body.innerText.includes("Remove from wishlist")');
    await navigate('/wishlist', 'document.body.innerText.includes("Engagement QA phone")&&!!document.querySelector("button[aria-label^=Remove]")');
    for (const width of [320, 1440]) {
      await page.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      await screenshot('engagement-wishlist-' + width);
    }
    await click('Remove');
    await page.wait('document.body.innerText.includes("Your wishlist is empty.")');
    checks.push('browser wishlist save persists across navigation, fits 320/1440px and removal restores its empty state');

    stage = 'review draft and retry';
    await navigate('/product/' + productId, 'document.body.innerText.includes("Write a review")');
    await click('Write a review');
    const comment = 'Verified browser review <img src=x onerror=window.__reviewXss=1> shown as text.';
    await page.evaluate(value => {
      document.querySelector('input[type=radio][value="5"]').click();
      const field = document.querySelector('textarea');
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(field, value);
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }, comment);
    let fail = true;
    page.listeners.set('Fetch.requestPaused', ({ requestId, request }) => {
      if (request.method === 'POST' && fail) {
        fail = false;
        void page.send('Fetch.fulfillRequest', { requestId, responseCode: 503, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
          body: Buffer.from(JSON.stringify({ error: 'QA review temporarily unavailable; draft retained.' })).toString('base64') });
      } else void page.send('Fetch.continueRequest', { requestId });
    });
    await page.send('Fetch.enable', { patterns: [{ urlPattern: origin + '/api/products/*/reviews' }] });
    await click('Submit review');
    await page.wait('document.body.innerText.includes("QA review temporarily unavailable")');
    assert.equal(await page.evaluate('document.querySelector("textarea").value'), comment);
    await click('Submit review');
    await page.wait('document.body.innerText.includes("Your review is saved")');
    await page.send('Fetch.disable');
    await navigate('/product/' + productId, 'document.body.innerText.includes("Your review is saved")');
    assert.equal(await page.evaluate('!!document.querySelector("img[src=x]")||!!window.__reviewXss'), false);
    assert.equal(await page.evaluate('document.body.innerText.includes("Verified purchase")'), true);
    assert.equal(await page.evaluate('Array.from(document.querySelectorAll("button")).some(el=>el.innerText==="Write a review")'), false);
    for (const width of [320, 1440]) {
      await page.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      await screenshot('engagement-reviews-' + width);
    }
    assert.deepEqual(exceptions, []);
    checks.push('browser review preserves a failed draft, submits successfully, survives reload, escapes HTML, prevents another review and fits 320/1440px without runtime exceptions');
  } catch (error) {
    throw new Error('Engagement browser failed while ' + stage + ': ' + error.message, { cause: error });
  } finally {
    if (page) { await page.send('Page.close').catch(() => {}); page.close(); }
    if (browser.pid && browser.exitCode === null) {
      if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      else browser.kill('SIGTERM');
    }
  }
}
module.exports = { verifyProductEngagementBrowser };
