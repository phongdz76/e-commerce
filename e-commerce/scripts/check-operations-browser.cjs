const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const { CDP } = require("../tests/fixtures/browser-cdp.cjs");
const pause = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function verifyOperationsBrowser({ origin, cookie, artifactDirectory }) {
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
    assert.deepEqual(exceptions, []);
    fs.writeFileSync(
      path.join(artifactDirectory, "p0-browser-results.json"),
      JSON.stringify(
        {
          checks,
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
