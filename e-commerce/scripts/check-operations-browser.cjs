const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const { CDP } = require("../tests/fixtures/browser-cdp.cjs");
const pause = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function verifyOperationsBrowser({ origin, cookie, artifactDirectory, cartFixture, orderFixture, supportFixture, ticketFixture, contentFixture, returnFixture, browserScope = "all" }) {
  const chrome =
    process.env.CHROME_BIN ||
    (process.platform === "win32"
      ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
      : "google-chrome");
  const debuggingPort = Number(process.env.QA_BROWSER_PORT || 9352);
  const profile = path.join(artifactDirectory, "chrome-ops-" + Date.now());
  const browser = spawn(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--remote-debugging-port=" + debuggingPort,
      "--user-data-dir=" + profile,
      "about:blank",
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  let page;
  const checks = [];
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (browser.exitCode !== null) throw new Error("Browser exited");
      try {
        ready = (await fetch(`http://127.0.0.1:${debuggingPort}/json/version`))
          .ok;
      } catch {}
      if (ready) break;
      await pause(100);
    }
    assert.ok(ready);
    const target = await fetch(
      `http://127.0.0.1:${debuggingPort}/json/new?about:blank`,
      { method: "PUT" },
    ).then((response) => response.json());
    page = new CDP(target.webSocketDebuggerUrl);
    for (const method of ["Page.enable", "Network.enable", "Runtime.enable"])
      await page.send(method);
    const exceptions = [];
    page.listeners.set("Runtime.exceptionThrown", (event) =>
      exceptions.push(event.exceptionDetails.text),
    );
    const separator = cookie.indexOf("=");
    await page.send("Network.setCookies", {
      cookies: [
        {
          name: cookie.slice(0, separator),
          value: cookie.slice(separator + 1),
          url: origin,
          httpOnly: true,
          sameSite: "Lax",
        },
      ],
    });
    const navigate = async (route) => {
      await page.send("Page.navigate", { url: origin + route });
      await page.wait(
        "document.querySelector('h1')?.innerText.includes('Operations') || document.querySelector('h1')?.innerText.includes('Online stock holds')",
      );
      await pause(500);
    };
    for (const width of [320, 390, 768, 1440]) {
      await page.send("Emulation.setDeviceMetricsOverride", {
        width,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await navigate("/admin/operations");
      await page.wait(
        "document.body.innerText.includes('Last payment job') && document.body.innerText.includes('SUCCEEDED')",
      );
      assert.equal(
        await page.evaluate(
          "document.documentElement.scrollWidth <= innerWidth + 1",
        ),
        true,
      );
      if (width === 320 || width === 1440) {
        const capture = await page.send("Page.captureScreenshot", {
          format: "png",
          captureBeyondViewport: true,
        });
        fs.writeFileSync(
          path.join(artifactDirectory, `p0-operations-${width}.png`),
          Buffer.from(capture.data, "base64"),
        );
      }
      await navigate("/admin/operations/holds");
      await page.wait(
        "document.body.innerText.includes('No overdue online holds')",
      );
      assert.equal(
        await page.evaluate(
          "document.documentElement.scrollWidth <= innerWidth + 1",
        ),
        true,
      );
      checks.push({
        width,
        dashboardFits: true,
        realHeartbeatVisible: true,
        emptyHoldsFits: true,
      });
    }
    const holds = [
      {
        id: "a".repeat(24),
        paymentMethod: "STRIPE",
        status: "draft",
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        ageMinutes: 120,
        units: 1,
        reason: "CARD_PREPARATION_UNCONFIRMED",
        recovery: "Recover the original card request; held stock is kept.",
        canCheck: false,
        version: 2,
        canRecoverCard: true,
      },
    ];
    const writes = [];
    let failLoad = true;
    page.listeners.set("Fetch.requestPaused", ({ requestId, request }) => {
      const url = new URL(request.url);
      const fulfill = (body, responseCode = 200) =>
        page
          .send("Fetch.fulfillRequest", {
            requestId,
            responseCode,
            responseHeaders: [
              { name: "Content-Type", value: "application/json" },
            ],
            body: Buffer.from(JSON.stringify(body)).toString("base64"),
          })
          .catch(() => {});
      if (request.method !== "GET") {
        writes.push(JSON.parse(request.postData));
        void fulfill({ code: "HOLD_CHANGED" }, 409);
      } else if (url.pathname === "/api/admin/operations/holds")
        void fulfill(
          failLoad
            ? { error: "Fixture outage" }
            : { holds, total: 1, totalPages: 1, hasMore: false },
          failLoad ? 503 : 200,
        );
      else
        void page.send("Fetch.continueRequest", { requestId }).catch(() => {});
    });
    page.listeners.set("Page.javascriptDialogOpening", () => {
      void page.send("Page.handleJavaScriptDialog", { accept: true });
    });
    await page.send("Fetch.enable", {
      patterns: [{ urlPattern: origin + "/api/admin/operations/holds*" }],
    });
    await navigate("/admin/operations/holds");
    await page.wait(
      "document.querySelector('[role=alert]')?.innerText.includes('Unable to load')",
    );
    failLoad = false;
    await page.evaluate(
      "Array.from(document.querySelectorAll('button')).find(button=>button.innerText==='Try again').click()",
    );
    await page.wait(
      "!!document.querySelector('textarea[aria-label^=\"Card recovery reason\"]')",
    );
    await page.evaluate(
      "(()=>{const el=document.querySelector('textarea');el.focus();Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,'Recover interrupted QA request');el.dispatchEvent(new Event('input',{bubbles:true}));})()",
    );
    await page.evaluate(
      "Array.from(document.querySelectorAll('button')).find(button=>button.innerText==='Recover original card reference').click()",
    );
    await page.wait("document.body.innerText.includes('input has been kept')");
    assert.equal(writes.length, 1);
    assert.equal(writes[0].version, 2);
    assert.equal(writes[0].confirmed, true);
    assert.equal(
      await page.evaluate('document.querySelector("textarea").value'),
      "Recover interrupted QA request",
    );
    checks.push({
      errorRetry: true,
      recoveryConfirmation: true,
      conflictKeepsReason: true,
      interceptedProviderWrites: true,
    });
    if (cartFixture) {
      await page.send("Fetch.disable");
      let failQuote = true;
      page.listeners.set("Fetch.requestPaused", ({ requestId }) => {
        if (failQuote) {
          failQuote = false;
          void page.send("Fetch.fulfillRequest", { requestId, responseCode: 503,
            responseHeaders: [{ name: "Content-Type", value: "application/json" }],
            body: Buffer.from(JSON.stringify({ error: "Unable to refresh your cart. Its previous contents have been kept." })).toString("base64") });
        } else void page.send("Fetch.continueRequest", { requestId });
      });
      await page.send("Fetch.enable", { patterns: [{ urlPattern: origin + "/api/cart/quote" }] });
      for (const width of [320, 1440]) {
        await page.send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: false });
        await page.evaluate(`localStorage.setItem('CartItems', ${JSON.stringify(JSON.stringify([cartFixture, { ...cartFixture, id: "f".repeat(24), variantId: "e".repeat(24), name: "Unavailable QA item" }]))})`);
        await page.send("Page.navigate", { url: origin + "/cart" });
        await page.wait("document.body.innerText.includes('Shopping Cart') && document.body.innerText.includes('Unavailable QA item')");
        const refresh = "Array.from(document.querySelectorAll('button')).find(button=>button.innerText==='Check prices and stock').click()";
        await page.evaluate(refresh);
        if (width === 320) {
          await page.wait("document.body.innerText.includes('previous contents have been kept')");
          assert.equal(await page.evaluate("JSON.parse(localStorage.getItem('CartItems')).length"), 2);
          await page.evaluate(refresh);
        }
        await page.wait("document.body.innerText.includes('current unit price') && document.body.innerText.includes('no longer available')");
        assert.equal(await page.evaluate("JSON.parse(localStorage.getItem('CartItems'))[0].price"), 1);
        assert.equal(await page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), true);
        const capture = await page.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
        fs.writeFileSync(path.join(artifactDirectory, `p1-cart-${width}.png`), Buffer.from(capture.data, "base64"));
        await page.evaluate("Array.from(document.querySelectorAll('button')).find(button=>button.innerText.startsWith('Accept ')).click()");
        await page.wait("document.body.innerText.includes('Change applied')");
        const saved = await page.evaluate("JSON.parse(localStorage.getItem('CartItems'))");
        assert.equal(saved.version, 1); assert.equal(saved.items.length, 2);
        assert.equal(saved.items[0].price, 10000); assert.equal(saved.items[0].quantity, 1);
        await page.evaluate("document.querySelector('button[aria-label=\"Remove Unavailable QA item from cart\"]').click()");
        assert.equal(await page.evaluate("JSON.parse(localStorage.getItem('CartItems')).items.length"), 1);
        checks.push({ width, cartFits: true, legacyRecovered: true, failedRefreshKeepsCart: true, explicitPriceAndQuantityAcceptance: true, unavailableRowKeptUntilRemoved: true });
      }
      await page.send("Fetch.disable");
      await require("./check-checkout-browser.cjs").verifyCheckoutBrowser({ page, origin, artifactDirectory, checks });
    }
    if (orderFixture) await require("./check-order-lifecycle-browser.cjs").verifyOrderLifecycleBrowser({ page, origin, artifactDirectory, checks, fixture: orderFixture });
    if (supportFixture) await require("./check-support-browser.cjs").verifySupportBrowser({ page, origin, artifactDirectory, checks, fixture: supportFixture });
    if (ticketFixture) await require('./check-support-tickets-browser.cjs').verifySupportTicketsBrowser({page,origin,artifactDirectory,checks,fixture:ticketFixture});
    if (contentFixture) await require('./check-customer-service-browser.cjs').verifyCustomerServiceBrowser({page,origin,artifactDirectory,checks,fixture:contentFixture});
    if (returnFixture) await require('./check-returns-browser.cjs').verifyReturnsBrowser({page,origin,artifactDirectory,checks,fixture:returnFixture});
    assert.deepEqual(exceptions, []);
    fs.writeFileSync(
      path.join(artifactDirectory, browserScope === "returns" ? "p1-returns-browser-results.json" : "p0-browser-results.json"),
      JSON.stringify(
        {
          checks,
          browserScope,
          applicationDatabaseWrites: 0,
          liveMoneyTransactions: 0,
          runtimeExceptions: exceptions,
        },
        null,
        2,
      ),
    );
    return checks.length;
  } finally {
    if (page) {
      await page.send("Page.close").catch(() => {});
      page.close();
    }
    if (browser.pid && browser.exitCode === null) {
      if (process.platform === "win32")
        spawnSync("taskkill", ["/PID", String(browser.pid), "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore",
        });
      else browser.kill("SIGTERM");
    }
  }
}
module.exports = { verifyOperationsBrowser };
