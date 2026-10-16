const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { CDP } = require('../tests/fixtures/browser-cdp.cjs');

async function verifyReturnsBrowser({ page, origin, artifactDirectory, checks, fixture }) {
  const host = new URL(page.socket.url).host;
  const info = await fetch('http://' + host + '/json/version').then(r => r.json());
  const browser = new CDP(info.webSocketDebuggerUrl);
  let contextId, customer, stage = 'starting return sessions';
  const exceptions = [];
  const select = (client, label, value) => client.evaluate(`(()=>{const el=document.querySelector('[aria-label="${label}"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const fill = (client, label, value) => client.evaluate(`(()=>{const el=document.querySelector('[aria-label="${label}"]');const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const click = async (client, label) => {
    await client.wait(`Array.from(document.querySelectorAll('button')).some(el=>el.innerText===${JSON.stringify(label)}&&!el.disabled)`);
    await client.evaluate(`Array.from(document.querySelectorAll('button')).find(el=>el.innerText===${JSON.stringify(label)}).click()`);
  };
  const navigate = async (client, route, marker) => {
    await client.send('Page.bringToFront'); await client.send('Page.navigate', { url: origin + route }); await client.wait(marker);
  };
  const screenshot = async (client, name) => {
    assert.equal(await client.evaluate('document.documentElement.scrollWidth<=innerWidth+1'), true);
    const shot = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    fs.writeFileSync(path.join(artifactDirectory, name + '.png'), Buffer.from(shot.data, 'base64'));
  };
  const cookie = async (client, value) => { const split = value.indexOf('='); await client.send('Network.setCookies', { cookies: [{ name: value.slice(0, split), value: value.slice(split + 1), url: origin, httpOnly: true, sameSite: 'Lax' }] }); };
  try {
    contextId = (await browser.send('Target.createBrowserContext', { disposeOnDetach: true })).browserContextId;
    const target = (await browser.send('Target.createTarget', { url: 'about:blank', browserContextId: contextId, newWindow: true })).targetId;
    customer = new CDP('ws://' + host + '/devtools/page/' + target);
    for (const method of ['Page.enable', 'Runtime.enable', 'Network.enable', 'DOM.enable']) await customer.send(method);
    customer.listeners.set('Runtime.exceptionThrown', event => exceptions.push(event.exceptionDetails.text));
    await cookie(customer, fixture.ownerCookie); await cookie(page, fixture.adminCookie); await page.send('Fetch.disable');
    stage = 'return form responsive layout';
    await navigate(customer, '/returns/new?orderId=' + fixture.orderId, `!!document.querySelector('[aria-label="Return item"]')&&!document.body.innerText.includes('Loading available items')`);
    for (const width of [320, 1440]) {
      await customer.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      await screenshot(customer, 'p1-return-create-' + width);
    }
    await select(customer, 'Return item', '0');
    const description = 'Browser return inspection <img src=x onerror=window.__returnXss=1> kept as plain text.';
    await fill(customer, 'Return details', description);
    const png = path.join(artifactDirectory, 'return-private-qa.png');
    fs.writeFileSync(png, require('../tests/fixtures/support-image.cjs'));
    const document = await customer.send('DOM.getDocument');
    const node = await customer.send('DOM.querySelector', { nodeId: document.root.nodeId, selector: '[aria-label="Return image"]' });
    await customer.send('DOM.setFileInputFiles', { nodeId: node.nodeId, files: [png] });
    await customer.wait('document.body.innerText.includes("return-private-qa.png")');
    stage = 'failed return submission preserves draft and retry identity';
    let fail = true;
    const attempts = [];
    customer.listeners.set('Fetch.requestPaused', ({ requestId, request }) => {
      if (request.method !== 'POST') { void customer.send('Fetch.continueRequest', { requestId }); return; }
      attempts.push(JSON.parse(request.postData));
      if (fail) { fail = false; void customer.send('Fetch.fulfillRequest', { requestId, responseCode: 503, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify({ error: 'QA return submission unavailable; draft retained.' })).toString('base64') }); }
      else void customer.send('Fetch.continueRequest', { requestId });
    });
    await customer.send('Fetch.enable', { patterns: [{ urlPattern: origin + '/api/returns' }] });
    await click(customer, 'Submit return request');
    await customer.wait('document.body.innerText.includes("QA return submission unavailable")');
    assert.equal(await customer.evaluate(`document.querySelector('[aria-label="Return details"]').value`), description);
    await click(customer, 'Submit return request');
    await customer.wait(`new RegExp('^/returns/[a-f0-9]{24}$').test(location.pathname)&&!!document.querySelector('[aria-label="Return summary"]')`);
    await customer.send('Fetch.disable');
    assert.equal(attempts.length, 2); assert.equal(attempts[0].requestId, attempts[1].requestId); assert.equal(attempts[0].attachmentId, attempts[1].attachmentId);
    const id = await customer.evaluate('location.pathname.split("/").at(-1)');
    assert.equal(await customer.evaluate(`!!document.querySelector('img[src="x"]')||!!window.__returnXss`), false);
    await customer.wait(`Array.from(document.querySelectorAll('img[alt="Return request attachment"]')).some(el=>el.complete&&el.naturalWidth>0)`);
    checks.push({ returnFormFits320And1440: true, customerSubmitPersists: true, failedReturnRetainsDraftAndImage: true, retryUsesSameRequestAndImage: true, returnTextEscaped: true, privateImageLoads: true });

    stage = 'admin review, receipt and inspection';
    await navigate(page, '/admin/returns/' + id, `!!document.querySelector('[aria-label="Return action"]')&&!document.body.innerText.includes('Loading return request')`);
    const record = async (kind, text, reference = '') => {
      await select(page, 'Return action', kind); await fill(page, 'Return action note', text);
      await fill(page, 'Return receipt reference', reference);
      await page.evaluate(`document.querySelector('[aria-label="Confirm return action"]').click()`);
      await click(page, 'Save return step');
      await page.wait(`document.body.innerText.includes(${JSON.stringify(text)})&&document.querySelector('[aria-label="Return action note"]').value===''&&!document.body.innerText.includes('Loading return request')`);
    };
    await record('ACCEPT', 'Send the selected QA item back using these recorded return instructions.');
    await record('RECEIVE', 'Counted one returned QA unit against the receipt before inspection.', 'BROWSER-QA-RECEIPT');
    await record('INSPECT_OTHER', 'Inspection found this QA item unsuitable for sellable inventory; resolution pending.');
    await page.wait(`document.querySelector('[aria-label="Return summary"]').innerText.includes('Inspected, needs resolution')`);
    assert.equal(await page.evaluate(`Array.from(document.querySelector('[aria-label="Return action"]').options).some(el=>el.value==='RESTOCK')`), false);
    for (const width of [320, 1440]) {
      await page.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      await screenshot(page, 'p1-return-admin-' + width);
      await customer.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      await navigate(customer, '/returns/' + id, `document.querySelector('[aria-label="Return summary"]')?.innerText.includes('Inspected, needs resolution')`);
      await screenshot(customer, 'p1-return-customer-' + width);
    }
    await navigate(customer, '/returns', `!!document.querySelector('a[href="/returns/${id}"]')`);
    await customer.wait('!document.body.innerText.includes("Loading return requests")');
    await select(customer, 'Return request filter', 'INSPECTED_OTHER');
    await customer.wait(`!document.body.innerText.includes("Loading return requests")&&!!document.querySelector('a[href="/returns/${id}"]')`);
    const reference = 'RT-' + BigInt('0x' + id).toString(36).toUpperCase().padStart(19, '0');
    await navigate(customer, '/notifications', `Array.from(document.querySelectorAll('[aria-label="Saved notifications"] li button')).some(el=>el.innerText.includes(${JSON.stringify(reference)}))`);
    await customer.evaluate(`Array.from(document.querySelectorAll('[aria-label="Saved notifications"] li button')).find(el=>el.innerText.includes(${JSON.stringify(reference)})).click()`);
    await customer.wait(`location.pathname==='/returns/${id}'&&!!document.querySelector('[aria-label="Return summary"]')`);
    checks.push({ adminRecordsApprovalReceiptInspection: true, unsuitableGoodsHaveNoRestockAction: true, adminAndCustomerDetailsFit320And1440: true, customerReloadAndFilterPersist: true, returnNotificationsLinkToCase: true });
    stage = 'replacement offer, customer consent and shipment';
    await navigate(page, '/admin/returns/' + id, `!!document.querySelector('[aria-label="Return action"]')&&!document.body.innerText.includes('Loading return request')`);
    await select(page, 'Return action', 'EXCHANGE_RESERVE');
    await page.wait(`Array.from(document.querySelector('[aria-label="Replacement SKU"]')?.options||[]).some(option=>option.value===${JSON.stringify(fixture.variantId)})`);
    await select(page, 'Replacement SKU', fixture.variantId);
    await fill(page, 'Return action note', 'Please review the reserved replacement SKU and saved delivery destination.');
    await page.evaluate(`document.querySelector('[aria-label="Confirm return action"]').click()`);
    await click(page, 'Save return step');
    await page.wait(`document.querySelector('[aria-label="Replacement exchange"]')?.innerText.includes('awaiting your approval')`);
    for (const width of [320, 1440]) {
      await page.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      await screenshot(page, 'p1-exchange-offer-admin-' + width);
    }
    await navigate(customer, '/returns/' + id, `document.querySelector('[aria-label="Replacement exchange"]')?.innerText.includes('awaiting your approval')`);
    await select(customer, 'Return action', 'EXCHANGE_ACCEPT');
    await fill(customer, 'Return action note', 'I accept this replacement SKU, quantity and saved delivery destination.');
    await customer.evaluate(`document.querySelector('[aria-label="Confirm return action"]').click()`);
    stage = 'changed offer requires fresh customer confirmation';
    const changedOfferSuccess = await page.evaluate(async (url, variantId) => {
      for (const action of ['EXCHANGE_RELEASE', 'EXCHANGE_RESERVE']) {
        const currentRes = await fetch(url);
        const current = await currentRes.json();
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            version: current.case.version,
            requestId: crypto.randomUUID(),
            confirmed: true,
            text: 'QA changed offer requires the customer to review and confirm again.',
            variantId,
          }),
        });
        if (response.status !== 200) {
          return false;
        }
      }
      return true;
    }, '/api/admin/returns/' + id, fixture.variantId);
    assert.equal(changedOfferSuccess, true);
    await click(customer, 'Refresh return');
    await customer.wait(`document.body.innerText.includes('changed while you were editing')&&!document.body.innerText.includes('Loading return request')`);
    assert.equal(await customer.evaluate(`Array.from(document.querySelectorAll('button')).find(el=>el.innerText==='Save return step').disabled`), true);
    await select(customer, 'Return action', '');
    await select(customer, 'Return action', 'EXCHANGE_ACCEPT');
    assert.equal(await customer.evaluate(`document.querySelector('[aria-label="Confirm return action"]').checked`), false);
    await customer.evaluate(`document.querySelector('[aria-label="Confirm return action"]').click()`);
    await click(customer, 'Save return step');
    await customer.wait(`document.querySelector('[aria-label="Replacement exchange"]')?.innerText.includes('awaiting dispatch')`);
    await navigate(page, '/admin/returns/' + id, `document.querySelector('[aria-label="Replacement exchange"]')?.innerText.includes('awaiting dispatch')`);
    await select(page, 'Return action', 'EXCHANGE_SHIP');
    await fill(page, 'Replacement carrier', 'Browser QA carrier');
    await fill(page, 'Return receipt reference', 'BROWSER-REPLACEMENT-TRACK');
    await fill(page, 'Return action note', 'Handed over the approved replacement to the recorded carrier.');
    await page.evaluate(`document.querySelector('[aria-label="Confirm return action"]').click()`);
    await click(page, 'Save return step');
    await page.wait(`document.querySelector('[aria-label="Replacement exchange"]')?.innerText.includes('Replacement dispatched')`);
    await navigate(customer, '/returns/' + id, `document.querySelector('[aria-label="Replacement exchange"]')?.innerText.includes('Replacement dispatched')`);
    for (const width of [320, 1440]) {
      await customer.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      await screenshot(customer, 'p1-exchange-shipped-customer-' + width);
    }
    await select(customer, 'Return action', 'EXCHANGE_RECEIVE');
    await fill(customer, 'Return action note', 'I received and checked the agreed replacement goods.');
    await customer.evaluate(`document.querySelector('[aria-label="Confirm return action"]').click()`);
    await click(customer, 'Save return step');
    await customer.wait(`document.querySelector('[aria-label="Return summary"]')?.innerText.includes('Exchange completed')`);
    await customer.send('Page.reload');
    await customer.wait(`document.querySelector('[aria-label="Return summary"]')?.innerText.includes('Exchange completed')`);
    assert.equal(await customer.evaluate(`!!document.querySelector('form[aria-label="Update return"]')`), false);
    checks.push({ replacementChoicesUseRealStock: true, adminOfferAndCustomerAcceptancePersist: true, changedOfferRequiresFreshConfirmation: true, manualCarrierTrackingAndDispatchPersist: true, exchangeFits320And1440: true, customerReceiptCompletesCaseAfterReload: true });
    assert.deepEqual(exceptions, []);
  } catch (error) {
    console.error('Return browser QA failed at:', stage, error.message);
    for (const [client, surface] of [[customer, 'customer'], [page, 'admin']]) if (client) {
      const capture = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }).catch(() => null);
      if (capture) fs.writeFileSync(path.join(artifactDirectory, 'p1-return-failure-' + surface + '.png'), Buffer.from(capture.data, 'base64'));
      const diagnostic = await client.evaluate(`({path:location.pathname,alerts:Array.from(document.querySelectorAll('[role=alert]')).map(el=>el.textContent),details:document.querySelector('[aria-label="Return details"]')?.value,summary:document.querySelector('[aria-label="Return summary"]')?.textContent})`).catch(() => null);
      console.error('Return browser diagnostic:', JSON.stringify({ surface, ...diagnostic }));
    }
    throw new Error('Return browser stage: ' + stage + ' (' + error.message + ')');
  }
  finally { customer?.close(); if (contextId) await browser.send('Target.disposeBrowserContext', { browserContextId: contextId }).catch(() => {}); browser.close(); }
}
module.exports = { verifyReturnsBrowser };
