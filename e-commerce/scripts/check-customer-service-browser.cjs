const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { CDP } = require('../tests/fixtures/browser-cdp.cjs');
async function verifyCustomerServiceBrowser({ page, origin, artifactDirectory, checks, fixture }) {
  const host = new URL(page.socket.url).host, info = await fetch('http://' + host + '/json/version').then(r => r.json()), browser = new CDP(info.webSocketDebuggerUrl);
  let contextId, customer, stage = 'opening content editor'; const exceptions = [];
  const navigate = async (client, url, marker) => { await client.send('Page.bringToFront'); await client.send('Page.navigate', { url: origin + url }); await client.wait(marker); };
  const click = async (client, label) => { await client.wait(`Array.from(document.querySelectorAll('button')).some(button=>button.innerText===${JSON.stringify(label)}&&!button.disabled)`); await client.evaluate(`Array.from(document.querySelectorAll('button')).find(button=>button.innerText===${JSON.stringify(label)}).click()`); };
  const field = (client, label, value) => client.evaluate(`(()=>{const element=Array.from(document.querySelectorAll('[aria-label]')).find(element=>element.getAttribute('aria-label')===${JSON.stringify(label)});const prototype=element.tagName==='SELECT'?HTMLSelectElement.prototype:element.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(element,${JSON.stringify(value)});element.dispatchEvent(new Event(element.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);
  const snapshot = async (client, label) => { assert.equal(await client.evaluate('document.documentElement.scrollWidth<=innerWidth+1'), true); const image = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); fs.writeFileSync(path.join(artifactDirectory, label + '.png'), Buffer.from(image.data, 'base64')); };
  try {
    contextId = (await browser.send('Target.createBrowserContext', { disposeOnDetach: true })).browserContextId;
    const target = (await browser.send('Target.createTarget', { url: 'about:blank', browserContextId: contextId, newWindow: true })).targetId; customer = new CDP('ws://' + host + '/devtools/page/' + target);
    for (const method of ['Page.enable', 'Runtime.enable', 'Network.enable']) await customer.send(method);
    customer.listeners.set('Runtime.exceptionThrown', event => exceptions.push(event.exceptionDetails.text));
    const split = fixture.ownerCookie.indexOf('='); await customer.send('Network.setCookies', { cookies: [{ name: fixture.ownerCookie.slice(0, split), value: fixture.ownerCookie.slice(split + 1), url: origin, httpOnly: true, sameSite: 'Lax' }] });
    await page.send('Fetch.disable');
    await navigate(page, '/admin/customer-service', "!!document.querySelector('[aria-label=\"Contact phone\"]')&&!document.body.innerText.includes('Loading customer service content')");
    for (const width of [320, 1440]) { await page.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false }); await snapshot(page, 'p1-service-editor-' + width); }
    await field(page, 'Contact phone', '0909876543');
    await field(page, 'Customer service section', 'FAQ'); await field(page, 'FAQ 1 question', 'Where is the browser FAQ answer?'); await field(page, 'FAQ 1 answer', 'QA browser answer shared by FAQ and quick answers.'); await field(page, 'FAQ 1 keywords', 'browser answer');
    await page.evaluate("document.querySelector('[aria-label=\"Customer service draft preview\"]').open=true");
    assert.equal(await page.evaluate("document.querySelector('[aria-label=\"Customer service draft preview\"]').innerText.includes('QA browser answer shared')"), true);
    const attempts = []; let fail = true;
    page.listeners.set('Fetch.requestPaused', ({ requestId, request }) => { if (request.method === 'POST' && new URL(request.url).pathname === '/api/admin/customer-service') { attempts.push(JSON.parse(request.postData)); if (fail) { fail = false; void page.send('Fetch.fulfillRequest', { requestId, responseCode: 503, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify({ error: 'QA content outage' })).toString('base64') }); return; } } void page.send('Fetch.continueRequest', { requestId }); });
    await page.send('Fetch.enable', { patterns: [{ urlPattern: origin + '/api/admin/customer-service' }] }); await click(page, 'Save content draft'); await page.wait("document.querySelector('[role=alert]')?.innerText.includes('QA content outage')");
    assert.equal(await page.evaluate("document.querySelector('[aria-label=\"FAQ 1 answer\"]').value"), 'QA browser answer shared by FAQ and quick answers.');
    await click(page, 'Save content draft'); await page.wait("document.body.innerText.includes('Draft saved. Public information has not changed.')"); await page.send('Fetch.disable');
    assert.equal(attempts.length, 2); assert.equal(attempts[0].requestId, attempts[1].requestId);
    assert.equal(await page.evaluate("fetch('/api/customer-service',{cache:'no-store'}).then(r=>r.json()).then(r=>r.content.contact.phone)"), fixture.latest.content.contact.phone);
    await click(page, 'Publish saved content'); await page.wait("document.body.innerText.includes('Customer service information published.')");
    checks.push({ contentEditorFitsMobileAndDesktop: true, draftPreviewWorks: true, failedContentSaveKeepsInputAndRetryIdentity: true, savedDraftDoesNotLeakBeforePublish: true });

    stage = 'published contacts, FAQ and widget';
    await navigate(customer, '/help/faq', "document.body.innerText.includes('Where is the browser FAQ answer?')&&!!document.querySelector('footer a[href=\"tel:0909876543\"]')");
    await customer.evaluate("Array.from(document.querySelectorAll('details')).find(element=>element.innerText.includes('Where is the browser FAQ answer?')).open=true");
    assert.equal(await customer.evaluate("document.body.innerText.includes('QA browser answer shared by FAQ and quick answers.')"), true);
    assert.equal(await customer.evaluate("document.querySelector('footer a[href=\"https://zalo.me/qa-content\"]')?.rel.includes('noopener')"), true);
    assert.equal(await customer.evaluate("document.querySelectorAll('iframe[src*=\"google.com/maps\"]').length"), 0);
    for (const width of [320, 1440]) { await customer.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false }); await snapshot(customer, 'p1-service-faq-' + width); }
    await customer.evaluate("document.querySelector('button[aria-label=\"Open quick help\"]').click()");
    await customer.wait("!!document.querySelector('[aria-label=\"Common questions\"]')"); await click(customer, 'Where is the browser FAQ answer?');
    await customer.wait("document.querySelector('[aria-label=\"Automated support conversation\"]')?.innerText.includes('QA browser answer shared')");
    await customer.evaluate("document.querySelector('button[aria-label=\"Open Zalo support\"]').click()");
    await customer.wait("!!document.querySelector('section a[href=\"https://zalo.me/qa-content\"]')");
    checks.push({ publishedFaqAndWidgetUseSameAnswer: true, footerUsesPublishedContact: true, configuredZaloUsesSafeExternalLink: true, emptyMapDoesNotLoadExternalEmbed: true });

    stage = 'immutable saved order policies and archived publication';
    await navigate(customer, '/orders/' + fixture.orderId, "!!document.querySelector('[aria-label=\"Saved order policies\"]')");
    await customer.evaluate("document.querySelector('[aria-label=\"Saved order policies\"]').open=true");
    assert.equal(await customer.evaluate("document.querySelector('[aria-label=\"Saved order policies\"]').innerText.includes('QA second returns instructions saved with the order.')"), true);
    assert.equal(await customer.evaluate("document.querySelector('[aria-label=\"Saved order policies\"]').innerText.includes('QA latest returns instructions')"), false);
    for (const width of [320, 1440]) { await customer.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false }); await snapshot(customer, 'p1-order-policies-' + width); }
    await navigate(page, '/admin/orders/' + fixture.orderId, "!!document.querySelector('[aria-label=\"Saved order policies\"]')");
    assert.equal(await page.evaluate("document.querySelector('[aria-label=\"Saved order policies\"]').textContent.includes('QA second returns instructions saved with the order.')"), true);
    await navigate(customer, '/help/returns?revision=' + fixture.second.id, "document.body.innerText.includes('QA second returns instructions saved with the order.')");
    assert.equal(await customer.evaluate("document.body.innerText.includes('View latest information')"), true);
    checks.push({ customerAndAdminSeeOriginalOrderPolicies: true, savedOrderPoliciesFitMobileAndDesktop: true, archivedPolicyLinkPreservesVersion: true });

    stage = 'review history and restore to draft';
    await navigate(page, '/admin/customer-service', "!!document.querySelector('[aria-label=\"Contact phone\"]')&&!document.body.innerText.includes('Loading customer service content')");
    await click(page, 'Review revision ' + fixture.first.revision); await page.wait("document.body.innerText.includes('Published revision '+" + fixture.first.revision + ")");
    assert.equal(await page.evaluate("document.querySelector('[aria-label=\"Contact phone\"]').value"), '0909876543');
    await click(page, 'Use reviewed revision as draft'); await page.wait("document.body.innerText.includes('Published revision copied to the draft.')");
    assert.equal(await page.evaluate("document.querySelector('[aria-label=\"Contact phone\"]').value"), fixture.first.content.contact.phone);
    assert.equal(await page.evaluate("fetch('/api/customer-service',{cache:'no-store'}).then(r=>r.json()).then(r=>r.content.contact.phone)"), '0909876543');
    await click(page, 'Publish saved content'); await page.wait("document.body.innerText.includes('Customer service information published.')");
    assert.equal(await page.evaluate("fetch('/api/customer-service',{cache:'no-store'}).then(r=>r.json()).then(r=>r.id!==" + JSON.stringify(fixture.first.id) + "&&r.content.contact.phone==='0901234567')"), true);
    checks.push({ historyReviewKeepsCurrentEditor: true, restoreChangesDraftOnly: true, republishingOldContentCreatesNewRevision: true });
    assert.deepEqual(exceptions, []);
  } catch (error) { console.error('Customer service browser stage:', stage, error.message); await snapshot(page, 'p1-service-failure').catch(() => {}); throw new Error('Customer service browser stage: ' + stage + ' (' + error.message + ')'); }
  finally { customer?.close(); if (contextId) await browser.send('Target.disposeBrowserContext', { browserContextId: contextId }).catch(() => {}); browser.close(); }
}
module.exports = { verifyCustomerServiceBrowser };
