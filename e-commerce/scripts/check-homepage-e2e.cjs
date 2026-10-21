// Read-only against the store: cart changes stay in an isolated browser profile.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { CDP } = require('../tests/fixtures/browser-cdp.cjs');
const origin = process.env.QA_ORIGIN || 'http://localhost:3000';
const output = path.resolve('.artifacts/homepage');
const port = 9366;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = spawn(process.env.CHROME_PATH || process.env.CHROME_BIN || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : 'google-chrome'), [
    '--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${port}`,
    '--user-data-dir=' + path.join(output, 'chrome-' + Date.now()), 'about:blank',
  ], { windowsHide: true, stdio: 'ignore' });
  let page;
  const errors = [];
  const wishlistReads = [];
  const notificationReads = [];
  try {
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {}
      await delay(100);
    }
    const target = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' }).then(response => response.json());
    page = new CDP(target.webSocketDebuggerUrl);
    await page.send('Page.enable'); await page.send('Runtime.enable'); await page.send('Network.enable');
    page.listeners.set('Runtime.exceptionThrown', event => errors.push(event.exceptionDetails.text));
    page.listeners.set('Network.requestWillBeSent', event => {
      if (event.request.method !== 'GET') return;
      if (/\/api\/wishlist/.test(event.request.url)) wishlistReads.push(event.request.url);
      if (/\/api\/notifications/.test(event.request.url)) notificationReads.push(event.request.url);
    });
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await page.send('Page.navigate', { url: origin });
    await page.wait('document.querySelectorAll("[data-home-product]").length > 0');
    await page.evaluate('document.fonts.ready');
    await page.evaluate('document.querySelectorAll("img").forEach(image => image.loading = "eager")');
    await delay(2000);
    for (const width of [1440, 768, 390, 320]) {
      await page.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      await delay(350);
      assert.equal(await page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), true, `Overflow at ${width}px`);
      assert.equal(await page.evaluate(() => !!document.querySelector('footer img[alt="QR Code - Follow Us"]')), true, 'Original footer QR is present');
      assert.equal(await page.evaluate('document.querySelector("#home-title").textContent'), 'Your nextupgrade starts here.');
      assert.equal(await page.evaluate(() => document.querySelector('[aria-label="Show banner 1"]').getAttribute('aria-current')), 'true');
      await page.evaluate(() => document.querySelector('button[aria-label="Notifications"]').click());
      await page.wait(`!!document.querySelector('[aria-label="Notification panel"]')`);
      assert.equal(await page.evaluate(() => {
        const panel = document.querySelector('[aria-label="Notification panel"]');
        const box = panel.getBoundingClientRect();
        return panel.textContent.includes('Sign in to see your order updates') && box.left >= 0 && box.right <= innerWidth;
      }), true, 'Guest sees a login invitation in a panel that fits the viewport');
      assert.equal(await page.evaluate(() => document.querySelector('[aria-label="Notification panel"] a').getAttribute('href')), '/login?callbackUrl=%2Fnotifications');
      assert.equal(await page.evaluate(() => !!document.querySelector('[aria-label="Notification panel"] a[href="/register"]')), true);
      assert.equal(notificationReads.length, 0, 'Guest never requests private notifications');
      await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await page.wait(`!document.querySelector('[aria-label="Notification panel"]')`);
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Notifications');
      await page.evaluate('window.scrollTo(0, 0)');
      const screenshot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      fs.writeFileSync(path.join(output, `homepage-${width}.png`), Buffer.from(screenshot.data, 'base64'));
      if (width === 390) {
        const viewport = await page.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(output, 'hero-mobile-390.png'), Buffer.from(viewport.data, 'base64'));
      }
    }
    // All six banners share the same layout and retain the carousel controls.
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await page.evaluate('window.scrollTo(0, 0)');
    const height = await page.evaluate('document.querySelector("[aria-roledescription=carousel]").getBoundingClientRect().height');
    await page.evaluate(() => document.querySelector('[aria-label="Next banner"]').click());
    await page.wait(`document.querySelector('[aria-label="Show banner 2"]').getAttribute('aria-current') === 'true'`);
    assert.equal(await page.evaluate('document.querySelector("[aria-roledescription=carousel] img").getAttribute("src").includes("macbook")'), true); // Hidden first slide is retained.
    assert.equal(await page.evaluate(() => document.querySelectorAll('[data-home-collection]').length), 5);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('[aria-roledescription=carousel] img')].some(image => /Banner\d/.test(image.src))), false);
    assert.equal(await page.evaluate('document.querySelector("[aria-roledescription=carousel]").getBoundingClientRect().height'), height, 'Carousel does not jump between slides');
    assert.equal(await page.evaluate(() => {
      const banner = document.querySelector('[aria-roledescription="carousel"]').getBoundingClientRect();
      return ['Previous banner', 'Next banner'].every(label => {
        const button = document.querySelector(`[aria-label="${label}"]`).getBoundingClientRect();
        return Math.abs(button.top + button.height / 2 - banner.top - banner.height / 2) < 1;
      });
    }), true, 'Both arrows are vertically centered');
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 200, y: 250 });
    await delay(250);
    const bannerScreenshot = await page.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(output, 'banner-phones-1440.png'), Buffer.from(bannerScreenshot.data, 'base64'));
    for (const width of [1440, 768, 390, 320]) {
      await page.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      for (let slide = 2; slide <= 6; slide++) {
        await page.evaluate(index => document.querySelector(`[aria-label="Show banner ${index}"]`).click(), slide);
        await delay(100);
        const content = await page.evaluate(() => {
          const active = document.querySelector('[aria-roledescription=slide][aria-hidden=false]');
          const heading = active.querySelector('h2'), button = active.querySelector('a'), art = active.querySelector('[data-art]');
          const box = active.getBoundingClientRect(), headingBox = heading.getBoundingClientRect(), buttonBox = button.getBoundingClientRect();
          return {
            id: active.querySelector('[data-home-collection]').dataset.homeCollection,
            href: button.getAttribute('href'), noOverflow: document.documentElement.scrollWidth <= innerWidth + 1,
            textFits: headingBox.right <= box.right && headingBox.left >= box.left && buttonBox.right <= box.right && buttonBox.bottom <= box.bottom - 35,
            artBelowButton: innerWidth > 540 || art.getBoundingClientRect().top >= buttonBox.bottom,
          };
        });
        assert.equal(content.noOverflow && content.textFits && content.artBelowButton, true, `Banner ${slide} layout at ${width}px: ${JSON.stringify(content)}`);
        assert.match(content.href, /^\/products\?category=.+/);
        if (width === 1440 || width === 390) {
          const screenshot = await page.send('Page.captureScreenshot', { format: 'png' });
          fs.writeFileSync(path.join(output, `banner-${content.id}-${width}.png`), Buffer.from(screenshot.data, 'base64'));
        }
      }
    }
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await page.evaluate('window.scrollTo(0, 0)');
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 });
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await page.wait(`document.querySelector('[aria-current=true] i').getAnimations().some(animation => animation.playState === 'running')`);
    const clockState = () => page.evaluate(() => {
      const button = document.querySelector('[aria-label^="Show banner"][aria-current=true]');
      const animation = button.querySelector('i').getAnimations()[0];
      return { slide: button.getAttribute('aria-label'), time: Number(animation?.currentTime ?? 0), state: animation?.playState, duration: animation?.effect.getTiming().duration };
    });
    const clickPointer = async selector => {
      const point = await page.evaluate(value => { const rect = document.querySelector(value).getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; }, selector);
      await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
      await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
      await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
    };
    await clickPointer('[aria-label="Show banner 2"]');
    await delay(300);
    const clicked = await clockState();
    assert.equal(clicked.state, 'running', 'Mouse focus and hover never freeze the clock');
    assert.equal(clicked.duration, 5000);
    assert.ok(clicked.time > 100);
    await clickPointer('[aria-label="Show banner 2"]');
    await delay(60);
    assert.ok((await clockState()).time < clicked.time, 'Clicking the current dot restarts the full cycle');
    const cycleStarted = Date.now();
    await clickPointer('[aria-roledescription=slide][aria-hidden=false] img');
    await delay(250);
    assert.equal((await clockState()).state, 'running', 'Image clicks keep autoplay moving');
    await page.wait(`document.querySelector('[aria-label="Show banner 3"]').getAttribute('aria-current') === 'true'`);
    const elapsed = Date.now() - cycleStarted;
    assert.ok(elapsed >= 4400 && elapsed < 7500, `Next slide follows the five-second progress clock (${elapsed}ms)`);
    // Keyboard users can read and navigate without losing the focused slide.
    await page.evaluate(() => document.querySelector('[aria-label="Previous banner"]').focus());
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await delay(80);
    const keyboard = await clockState();
    await delay(250);
    assert.equal(keyboard.state, 'paused');
    assert.ok(Math.abs((await clockState()).time - keyboard.time) < 20);
    await clickPointer('[aria-label="Next banner"]');
    await delay(120);
    assert.equal((await clockState()).state, 'running', 'Pointer use immediately resumes after keyboard focus');
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
    await delay(100);
    const offscreen = await clockState();
    await delay(200);
    assert.equal(offscreen.state, 'paused');
    assert.ok(Math.abs((await clockState()).time - offscreen.time) < 20);
    await page.evaluate('window.scrollTo(0, 0)');
    await delay(120);
    assert.equal((await clockState()).state, 'running');
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    await delay(100);
    const hidden = await clockState();
    await delay(200);
    assert.equal(hidden.state, 'paused');
    assert.ok(Math.abs((await clockState()).time - hidden.time) < 20);
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    await delay(100);
    assert.equal((await clockState()).state, 'running');
    // Holding a touch pauses only while the finger is down; a swipe starts a fresh cycle.
    await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 500, y: 300 }] });
    await delay(80);
    assert.equal((await clockState()).state, 'paused');
    await page.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 380, y: 300 }] });
    await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await delay(150);
    assert.equal((await clockState()).state, 'running');
    assert.ok((await clockState()).time < 700);
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await delay(50);
    assert.equal(await page.evaluate(() => document.querySelector('[aria-current=true] i').getAnimations().length), 0);
    await page.evaluate(() => document.querySelector('[aria-label="Show banner 1"]').click());
    await page.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 1000, deviceScaleFactor: 1, mobile: false });
    const initialIds = await page.evaluate('[...document.querySelectorAll("#home-product-panel [data-home-product]")].map(card => card.dataset.homeProduct)');
    await page.evaluate('document.getElementById("home-tab-1").click()');
    assert.equal(await page.evaluate('document.getElementById("home-tab-1").getAttribute("aria-selected")'), 'true');
    const prices = await page.evaluate('[...document.querySelectorAll("#home-product-panel article")].map(card => Number(card.querySelector("p").textContent.replace(/[^0-9]/g, "")))');
    assert.deepEqual(prices, [...prices].sort((a, b) => a - b), 'Price tab uses the actual catalog ordering');
    assert.notDeepEqual(await page.evaluate('[...document.querySelectorAll("#home-product-panel [data-home-product]")].map(card => card.dataset.homeProduct)'), initialIds);
    // Guest hearts have a real login callback, and no per-card status requests.
    assert.match(await page.evaluate(() => document.querySelector('[aria-label="Sign in to save to wishlist"]').getAttribute('href')), /callbackUrl=%2F/);
    assert.equal(wishlistReads.length, 0);
    assert.equal(notificationReads.length, 0);
    await page.evaluate(`(() => {
      const buttons = [...document.querySelectorAll('#home-product-panel article button')];
      (buttons.find(button => button.textContent.includes('Choose options')) || buttons.find(button => button.textContent.includes('Quick add'))).click();
    })()`);
    await page.wait('!!document.querySelector("dialog[open]")');
    await page.evaluate(`(() => { const select = document.getElementById('home-variant'); if (select.options.length > 1) { select.value = select.options[select.options.length - 1].value; select.dispatchEvent(new Event('change', {bubbles:true})); } })()`);
    await delay(100);
    const chosenVariant = await page.evaluate('document.getElementById("home-variant").value');
    const chosenPrice = await page.evaluate('Number(document.querySelector("dialog p").textContent.replace(/[^0-9]/g,""))');
    for (let i = 0; i < 8; i++) {
      await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      assert.equal(await page.evaluate('document.activeElement === document.body || document.querySelector("dialog").contains(document.activeElement)'), true, 'Native modal keeps focus inside');
    }
    await page.evaluate('[...document.querySelectorAll("dialog button")].find(button => button.textContent.includes("Add to cart")).click()');
    await page.wait('!document.querySelector("dialog[open]")');
    const cart = await page.evaluate('JSON.parse(localStorage.getItem("CartItems"))');
    assert.equal(cart.items[0].variantId, chosenVariant);
    assert.equal(cart.items[0].price, chosenPrice);
    assert.equal(cart.items[0].quantity, 1);
    await page.evaluate('[...document.querySelectorAll("#home-product-panel article button")].find(button => /Quick add|Choose options/.test(button.textContent)).click()');
    await page.wait('!!document.querySelector("dialog[open]")');
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await page.wait('!document.querySelector("dialog[open]")');
    // Brand motion continues while hovered; reduced-motion disables it.
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await page.evaluate('document.getElementById("brands-heading").scrollIntoView({block:"center"})');
    const brandExpression = 'document.querySelector("#brands-heading").parentElement.querySelector("[aria-hidden=true]")';
    assert.equal(await page.evaluate(`getComputedStyle(${brandExpression}).animationName`), 'none');
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await delay(250);
    const position1 = await page.evaluate(`getComputedStyle(${brandExpression}).transform`);
    await delay(450);
    assert.notEqual(await page.evaluate(`getComputedStyle(${brandExpression}).transform`), position1);
    const rect = await page.evaluate(`(() => { const r=(${brandExpression}).getBoundingClientRect(); return {x: innerWidth/2, y:r.top+r.height/2}; })()`);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...rect });
    const position2 = await page.evaluate(`getComputedStyle(${brandExpression}).transform`);
    await delay(450);
    assert.notEqual(await page.evaluate(`getComputedStyle(${brandExpression}).transform`), position2, 'Hover does not pause brands');
    assert.equal(await page.evaluate('document.querySelector("#brands-heading").parentElement.querySelectorAll("button").length'), 0);
    assert.deepEqual(errors, [], 'No browser runtime errors');
    console.log(JSON.stringify({ passed: true, widths: [1440, 768, 390, 320], carousel: 'six matching banners + category links + responsive layout', autoplay: { cycleMs: 5000, observedNextSlideMs: elapsed, pointerFocus: 'running', imageClick: 'running', sameDot: 'restarts', keyboard: 'pauses', offscreen: 'pauses', hidden: 'pauses', swipe: 'resumes', reducedMotion: 'no clock' }, tabs: true, quickAdd: 'selected SKU + price', modal: 'keyboard + Escape', brands: 'continuous + hover + reduced-motion', footerQR: true, wishlistGuestReads: wishlistReads.length, guestBell: 'visible + login callback + Escape', notificationGuestReads: notificationReads.length, screenshots: output }, null, 2));
  } catch (error) {
    console.error('Browser diagnostics:', JSON.stringify({ exceptions: errors, state: page ? await page.evaluate(() => ({ dialog: document.querySelector('dialog')?.outerHTML, buttons: [...document.querySelectorAll('#home-product-panel article button')].map(button => ({ text: button.textContent, disabled: button.disabled })), bodyText: document.body.innerText.slice(-1000) })).catch(() => null) : null }));
    throw error;
  } finally {
    if (page) { await page.send('Page.close').catch(() => {}); page.close(); }
    if (browser.pid && browser.exitCode === null) {
      if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      else browser.kill('SIGTERM');
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
