const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function verifyCheckoutBrowser({ page, origin, artifactDirectory, checks }) {
  const attemptedOrders = [], settingWrites = [];
  await page.send('Fetch.disable');
  page.listeners.set('Fetch.requestPaused', ({ requestId, request }) => {
    const url = new URL(request.url);
    let data, responseCode = 200;
    if (url.hostname === 'provinces.open-api.vn') {
      if (url.pathname.endsWith('/p/')) data = [{ code: 79, name: 'Ho Chi Minh City' }];
      else if (url.pathname.includes('/p/79')) data = { districts: [{ code: 760, name: 'QA district' }] };
      else if (url.pathname.includes('/d/760')) data = { wards: [{ code: 26734, name: 'QA ward' }] };
      else data = [];
    } else if (url.pathname === '/api/order/create-cod') {
      attemptedOrders.push(JSON.parse(request.postData));
      data = { error: 'QA simulated temporary save failure. Retry the same checkout.' }; responseCode = 503;
    } else if (url.pathname === '/api/admin/shipping-policy' && request.method === 'PUT') {
      settingWrites.push(JSON.parse(request.postData));
      data = { error: 'Delivery settings changed. Reload before saving; your input has been kept.' }; responseCode = 409;
    } else { void page.send('Fetch.continueRequest', { requestId }); return; }
    void page.send('Fetch.fulfillRequest', { requestId, responseCode, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }], body: Buffer.from(JSON.stringify(data)).toString('base64') });
  });
  await page.send('Fetch.enable', { patterns: [
    { urlPattern: 'https://provinces.open-api.vn/api/*' },
    { urlPattern: origin + '/api/order/create-cod' },
    { urlPattern: origin + '/api/admin/shipping-policy' },
  ] });
  const field = (selector, value) => page.evaluate(`(()=>{const field=document.querySelector(${JSON.stringify(selector)});const prototype=field.tagName==='SELECT'?HTMLSelectElement.prototype:field.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(field,${JSON.stringify(value)});field.dispatchEvent(new Event(field.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);
  const click = label => page.evaluate(`Array.from(document.querySelectorAll('button')).find(button=>button.innerText===${JSON.stringify(label)}).click()`);
  const screenshot = async name => { const capture = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); fs.writeFileSync(path.join(artifactDirectory, name), Buffer.from(capture.data, 'base64')); };
  let stage = 'opening checkout';
  try { for (const width of [320, 1440]) {
    stage = 'loading address controls at ' + width;
    await page.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await page.send('Page.navigate', { url: origin + '/checkout' });
    await page.wait("!!document.querySelector('#houseNumber') && document.querySelector('#province')?.options.length > 1");
    assert.equal(await page.evaluate("/Total:\\s*\\d/.test(document.querySelector('[aria-label=\"Order totals\"]').innerText)"), true);
    assert.equal(await page.evaluate("Array.from(document.querySelectorAll('button')).find(button=>button.innerText==='Place Order').disabled"), true);
    await field('#province', '79');
    await page.wait("document.querySelector('#district')?.options.length > 1");
    await field('#district', '760');
    await page.wait("document.querySelector('#ward')?.options.length > 1");
    await field('#ward', '26734');
    await field('#houseNumber', '12 QA Street'); await field('#phoneNumber', '0901234567');
    await click('Get delivery quote');
    stage = 'receiving delivery quote at ' + width;
    await page.wait("document.body.innerText.includes('Quote valid until')");
    assert.equal(await page.evaluate("Array.from(document.querySelectorAll('button')).find(button=>button.innerText==='Place Order').disabled"), false);
    assert.equal(await page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), true);
    await screenshot(`p1-checkout-${width}.png`);
    await field('#houseNumber', '14 QA Street');
    await page.wait("Array.from(document.querySelectorAll('button')).find(button=>button.innerText==='Place Order')?.disabled");
    await click('Get delivery quote');
    await page.wait("document.body.innerText.includes('Quote valid until')");
    await click('Place Order');
    stage = 'recovering failed order submission at ' + width;
    await page.wait("document.body.innerText.includes('QA simulated temporary save failure')");
    assert.equal(await page.evaluate("document.querySelector('#houseNumber').value"), '14 QA Street');
    const before = attemptedOrders.at(-1);
    assert.equal(before.provinceCode, '79'); assert.equal(before.districtCode, '760'); assert.equal(before.wardCode, '26734');
    assert.ok(before.quoteToken);
    await click('Place Order');
    await page.wait(`Array.from(document.querySelectorAll('button')).find(button=>button.innerText==='Place Order')?.disabled===false`);
    assert.equal(attemptedOrders.at(-1).checkout_request_id, before.checkout_request_id);
    assert.equal(attemptedOrders.at(-1).quoteToken, before.quoteToken);
    checks.push({ width, checkoutFits: true, quoteRequired: true, addressChangeInvalidatesQuote: true, failedSubmissionKeepsCartAndDelivery: true, sameRequestAndQuoteOnRetry: true });
    await page.send('Page.navigate', { url: origin + '/admin/shipping-settings' });
    stage = 'loading delivery settings at ' + width;
    await page.wait("document.body.innerText.includes('Delivery settings') && !!document.querySelector('textarea')");
    assert.equal(await page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), true);
    await screenshot(`p1-delivery-settings-${width}.png`);
    await field('input[type=number]', '19000');
    await field('textarea', 'Update delivery price for the isolated QA test');
    await click('Save delivery settings');
    stage = 'handling a settings conflict at ' + width;
    await page.wait("document.querySelector('[role=alert]')?.innerText.includes('your input has been kept')");
    assert.equal(await page.evaluate("document.querySelector('input[type=number]').value"), '19000');
    assert.equal(settingWrites.at(-1).fee, 19000);
    checks.push({ width, deliverySettingsFits: true, conflictKeepsInput: true });
  } } catch (error) {
    console.error('Checkout browser QA failed at:', stage);
    await screenshot('p1-checkout-failure.png').catch(() => {});
    throw error;
  }
  await page.send('Fetch.disable');
}
module.exports = { verifyCheckoutBrowser };
