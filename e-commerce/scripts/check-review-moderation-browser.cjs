const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { CDP } = require('../tests/fixtures/browser-cdp.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function verifyReviewBrowser({ origin, cookies, productId, reviewId, artifacts, checks, call }) {
  const port = 9374, browser = spawn(process.env.CHROME_PATH || process.env.CHROME_BIN || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : 'google-chrome'), [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + port,
    '--user-data-dir=' + path.join(artifacts, 'chrome-reviews-' + Date.now()), 'about:blank',
  ], { windowsHide: true, stdio: 'ignore' });
  let page, stage = 'starting'; const errors = [];
  try {
    for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await delay(100); }
    const target = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' }).then(response => response.json());
    page = new CDP(target.webSocketDebuggerUrl);
    for (const method of ['Page.enable', 'Runtime.enable', 'Network.enable']) await page.send(method);
    page.listeners.set('Runtime.exceptionThrown', event => errors.push(event.exceptionDetails.text));
    const [name, value] = cookies[0].split('='); await page.send('Network.setCookie', { name, value, url: origin, path: '/', httpOnly: true, sameSite: 'Lax' });
    const navigate = async (route, marker) => { await page.send('Page.navigate', { url: origin + route }); await page.wait(marker); };
    const click = async text => {
      await page.wait(`Array.from(document.querySelectorAll('button')).some(button => button.textContent === ${JSON.stringify(text)} && !button.disabled && !button.closest('fieldset:disabled'))`);
      await page.evaluate(label => [...document.querySelectorAll('button')].find(button => button.textContent === label).click(), text);
    };
    const fill = async (label, text) => page.evaluate((label, text) => {
      const field = document.querySelector(`[aria-label="${label}"]`), proto = field.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : field.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(field, text); field.dispatchEvent(new Event(field.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    }, label, text);
    const readPublic = async () => (await call('/api/products/' + productId + '/reviews')).json();
    const readHome = async () => (await call('/api/homepage')).json();
    stage = 'pending moderation';
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await navigate('/admin/reviews', `!!document.querySelector('[aria-label="Review list"] button')`);
    await click('Manage review'); await page.wait(`!!document.querySelector('textarea[aria-label="Store reply"]')`);
    assert.equal(await page.evaluate('!!document.querySelector("img[src=x]") || !!window.__reviewXss'), false);
    await click('Approve review'); await page.wait(`document.body.innerText.includes('Review updated.')`);
    assert.equal((await readPublic()).items[0].id, reviewId);
    stage = 'reply error and retry';
    const reply = 'SGTech reply <img src=x onerror=window.__replyXss=1> is rendered as safe text.';
    await fill('Store reply', reply);
    let fail = true;
    page.listeners.set('Fetch.requestPaused', event => {
      if (event.request.method === 'POST' && fail) { fail = false; void page.send('Fetch.fulfillRequest', { requestId: event.requestId, responseCode: 503, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify({ error: 'QA reply interrupted. Try again.' })).toString('base64') }); }
      else void page.send('Fetch.continueRequest', { requestId: event.requestId });
    });
    await page.send('Fetch.enable', { patterns: [{ urlPattern: origin + '/api/admin/reviews/*' }] });
    await click('Save store reply'); await page.wait(`document.body.innerText.includes('QA reply interrupted')`);
    assert.equal(await page.evaluate(() => document.querySelector('textarea[aria-label="Store reply"]').value), reply);
    await click('Save store reply'); await page.wait(`document.body.innerText.includes('Saved reply:')`); await page.send('Fetch.disable');
    assert.equal((await readPublic()).items[0].reply.comment, reply);
    await click('Set homepage highlight'); await page.wait(`document.body.innerText.includes('Homepage priority 0')`);
    assert.equal((await readHome()).reviews[0].id, reviewId);
    stage = 'responsive admin';
    for (const width of [1440, 390, 320]) {
      await page.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false }); await delay(100);
      assert.equal(await page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), true, 'Review admin fits ' + width);
      if (width === 1440) { const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); fs.writeFileSync(path.join(artifacts, 'reviews-admin-1440.png'), Buffer.from(shot.data, 'base64')); }
    }
    stage = 'public reply';
    await navigate('/product/' + productId + '#reviews', `!!document.querySelector('[aria-label="Store reply"]')`);
    assert.equal(await page.evaluate(() => document.querySelector('[aria-label="Store reply"]').textContent.includes('SGTech · Store reply')), true);
    assert.equal(await page.evaluate('!!document.querySelector("img[src=x]") || !!window.__replyXss || !!window.__reviewXss'), false);
    for (const width of [320, 1440]) {
      await page.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false }); await delay(100);
      assert.equal(await page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), true, 'Public review fits ' + width);
    }
    stage = 'hidden review';
    await navigate('/admin/reviews', `!!document.querySelector('select[aria-label="Review status"]')`);
    await fill('Review status', 'APPROVED'); await click('Apply filters');
    await page.wait(`!!document.querySelector('[aria-label="Review list"] button')`); await click('Manage review');
    await page.wait(`!!document.querySelector('textarea[aria-label="Moderation reason"]')`);
    await fill('Moderation reason', 'Contains private customer delivery details'); await click('Hide review');
    await page.wait(`document.body.innerText.includes('Internal moderation reason: Contains private')`);
    assert.equal((await readPublic()).total, 0); assert.equal((await readHome()).reviews.length, 0);
    await navigate('/product/' + productId + '#reviews', `document.body.innerText.includes('No reviews yet for this product.')`);
    assert.equal(await page.evaluate(() => !!document.querySelector('[aria-label="Store reply"]') || document.body.innerText.includes('Original verified purchase text')), false);
    assert.deepEqual(errors, []);
    checks.push('Chrome admin approves, retries a failed reply without losing input, highlights and hides; public store reply escapes HTML, hidden review disappears, 320/390/1440px fit with zero runtime exceptions');
  } catch (error) {
    console.error('Review browser diagnostics', { stage, errors, text: page ? await page.evaluate('document.body.innerText.slice(-1800)').catch(() => '') : '' }); throw error;
  } finally {
    if (page) { await page.send('Page.close').catch(() => {}); page.close(); }
    if (browser.pid && browser.exitCode === null) {
      if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      else browser.kill('SIGTERM');
    }
  }
}
module.exports = { verifyReviewBrowser };
