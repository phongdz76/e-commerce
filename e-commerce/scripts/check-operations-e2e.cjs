const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const { encode } = require("next-auth/jwt");
const bcrypt = require("bcrypt");
const app = path.resolve(__dirname, "..");
require("@next/env").loadEnvConfig(app);
const pause = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function main() {
  const database =
    "sgtech_http_qa_" + Date.now() + "_" + randomUUID().slice(0, 4);
  const connection = new URL(process.env.DATABASE_URL);
  const original = connection.pathname;
  connection.pathname = "/" + database;
  assert.notEqual(connection.pathname, original);
  assert.match(database, /^sgtech_http_qa_\d+_[a-f0-9]+$/);
  const prisma = new PrismaClient({
    datasources: { db: { url: connection.toString() } },
  });
  const port = Number(process.env.QA_HTTP_PORT || 3302);
  assert.ok(Number.isSafeInteger(port) && port >= 3000 && port <= 65535);
  const origin = "http://127.0.0.1:" + port;
  const secret = randomUUID() + randomUUID();
  const cronSecret = randomUUID() + randomUUID();
  let server;
  let rollbackServer;
  const checks = [];
  const artifacts = path.join(app, ".artifacts");
  fs.mkdirSync(artifacts, { recursive: true });
  const log = fs.openSync(path.join(artifacts, "p0-e2e-server.log"), "w");
  try {
    for (const collection of [
      "User",
      "Account",
      "Category",
      "Brand",
      "Product",
      "ProductVariant",
      "Order",
      "PaymentAttempt",
      "PaymentException",
      "OperationalJob",
      "OperationalIncident",
      "AuditLog",
      "ShippingPolicy",
      "CheckoutRequest",
      "AuthRateLimit",
    ])
      await prisma.$runCommandRaw({ create: collection });
    const password = "Private-QA-Only-123!";
    const hashedPassword = await bcrypt.hash(password, 4);
    const users = [];
    for (const index of [0, 1, 2])
      users.push(
        await prisma.user.create({
          data: {
            name: "QA user " + index,
            email: `qa-${index}@example.invalid`,
            hashedPassword,
            role: index === 0 ? "ADMIN" : "USER",
            status: "ACTIVE",
            sessionVersion: 0,
          },
        }),
      );
    const category = await prisma.category.create({
      data: { name: "QA phones", slug: "qa-phones" },
    });
    const brand = await prisma.brand.create({
      data: { name: "QA brand", slug: "qa-brand" },
    });
    const product = await prisma.product.create({
      data: {
        name: "Private HTTP QA phone",
        slug: "private-http-qa",
        description: "Private HTTP test fixture",
        status: "ACTIVE",
        categoryId: category.id,
        brandId: brand.id,
      },
    });
    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: "QA-HTTP-LAST",
        name: "Black",
        price: 10000,
        inStock: true,
        isActive: true,
        image: {
          color: "Black",
          colorCode: "#000000",
          image: "/products/iphone14-white.webp",
        },
        inventory: {
          onHand: 1,
          reserved: 0,
          version: 1,
          updatedAt: new Date(),
        },
      },
    });
    const env = {
      ...process.env,
      DATABASE_URL: connection.toString(),
      NEXTAUTH_SECRET: secret,
      NEXTAUTH_URL: origin,
      NEXT_PUBLIC_APP_URL: origin,
      CRON_SECRET: cronSecret,
      NODE_ENV: "production",
      AUTH_TRUST_PROXY: "false",
      STRIPE_SECRET_KEY: "",
      STRIPE_WEBHOOK_SECRET: "",
      VNP_TMNCODE: "",
      VNP_HASHSECRET: "",
      MOMO_PARTNER_CODE: "",
      MOMO_ACCESS_KEY: "",
      MOMO_SECRET_KEY: "",
      ZALOPAY_APP_ID: "",
      ZALOPAY_KEY1: "",
      ZALOPAY_KEY2: "",
      EMAIL_USER: "",
      EMAIL_PASSWORD: "",
      SGTECH_EVENT_EMAILS_ENABLED: "false",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      FACEBOOK_CLIENT_ID: "",
      FACEBOOK_CLIENT_SECRET: "",
    };
    server = spawn(
      process.execPath,
      [
        path.join(app, "node_modules/next/dist/bin/next"),
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(port),
      ],
      { cwd: app, env, windowsHide: true, stdio: ["ignore", log, log] },
    );
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (server.exitCode !== null) throw new Error("QA server exited");
      try {
        ready = (
          await fetch(origin + "/api/health", {
            signal: AbortSignal.timeout(1000),
          })
        ).ok;
      } catch {}
      if (ready) break;
      await pause(300);
    }
    assert.ok(ready, "QA server did not start");
    const cookies = await Promise.all(
      users.map(
        async (user) =>
          "next-auth.session-token=" +
          (await encode({
            secret,
            maxAge: 600,
            token: {
              sub: user.id,
              userId: user.id,
              sessionVersion: 0,
              authenticatedAt: Date.now(),
            },
          })),
      ),
    );
    const call = (url, { cookie, ...options } = {}) =>
      fetch(origin + url, {
        ...options,
        redirect: "manual",
        headers: { ...(cookie ? { Cookie: cookie } : {}), ...options.headers },
        signal: AbortSignal.timeout(60000),
      });
    assert.equal((await call("/api/admin/operations")).status, 401);
    assert.equal(
      (await call("/api/admin/operations", { cookie: cookies[1] })).status,
      403,
    );
    assert.equal(
      (await call("/api/admin/operations", { cookie: cookies[0] })).status,
      200,
    );
    assert.equal((await call("/api/jobs/health")).status, 401);
    checks.push(
      "compiled production server enforces anonymous/USER/ADMIN authorization",
    );
    const csrf = await call("/api/auth/csrf");
    const csrfData = await csrf.json();
    const csrfCookies = csrf.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    const login = await call("/api/auth/callback/credentials", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: csrfCookies,
      },
      body: new URLSearchParams({
        csrfToken: csrfData.csrfToken,
        emailOrUsername: users[0].email,
        password,
        json: "true",
        callbackUrl: origin + "/admin",
      }),
    });
    assert.equal(login.status, 200);
    assert.ok(
      login.headers
        .getSetCookie()
        .some((value) => value.startsWith("next-auth.session-token=")),
    );
    checks.push(
      "real credentials login with CSRF issues a session for a disposable test user",
    );
    const body = (user) => ({
      checkout_request_id: randomUUID(),
      items: [
        { id: product.id, variantId: variant.id, quantity: 1, price: 10000 },
      ],
      fullName: user.name,
      phone: "0900000000",
      address: "Private QA Street",
      city: "QA city",
      provinceCode: "79",
    });
    const cartItems = body(users[1]).items;
    assert.equal((await call("/api/admin/shipping-policy")).status, 401);
    assert.equal((await call("/api/admin/shipping-policy", { cookie: cookies[1] })).status, 403);
    const policy = (await (await call("/api/admin/shipping-policy", { cookie: cookies[0] })).json()).policy;
    assert.equal(policy.fee, 15000); assert.equal(policy.freeShippingThreshold, 300000);
    const unquoted = await call("/api/order/create-cod", { cookie: cookies[1], method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body(users[1])) });
    assert.equal(unquoted.status, 400); assert.equal((await unquoted.json()).code, "QUOTE_REQUIRED");
    const staleBody = body(users[1]);
    const staleQuote = await (await call("/api/checkout/quote", { cookie: cookies[1], method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(staleBody) })).json();
    for (const [version, fee] of [[0, 16000], [1, 15000]]) {
      const update = await call("/api/admin/shipping-policy", { cookie: cookies[0], method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...policy, version, fee, requestId: randomUUID(), reason: "Isolated QA delivery policy change" }) });
      assert.equal(update.status, 200);
      if (fee === 16000) {
        const stale = await call("/api/order/create-cod", { cookie: cookies[1], method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...staleBody, quoteToken: staleQuote.token }) });
        assert.equal(stale.status, 409); assert.equal((await stale.json()).code, "QUOTE_CHANGED");
        assert.equal((await prisma.productVariant.findUnique({ where: { id: variant.id } })).inventory.reserved, 0);
      }
    }
    checks.push("real shipping policy authorization/version/audit and mandatory signed quote; policy changes reject stale pricing without stock writes");
    assert.equal((await call("/api/cart/quote", { method: "POST", body: JSON.stringify({ items: cartItems }) })).status, 401);
    const cartReview = await call("/api/cart/quote", { cookie: cookies[1], method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ ...cartItems[0], price: 1, quantity: 2 }, { ...cartItems[0], id: "f".repeat(24) }] }) });
    assert.equal(cartReview.status, 200);
    const reviewed = await cartReview.json();
    assert.deepEqual(reviewed.lines.map(line => line.issues), [["QUANTITY_REDUCED", "PRICE_CHANGED"], ["UNAVAILABLE"]]);
    assert.equal(reviewed.canCheckout, false);
    assert.equal((await prisma.productVariant.findUnique({ where: { id: variant.id } })).inventory.reserved, 0);
    checks.push("actual authenticated cart review isolates unavailable rows and proposes price/quantity changes without reserving units");
    const checkoutBodies = await Promise.all([1, 2].map(async index => {
      const payload = body(users[index]);
      const quoteResponse = await call("/api/checkout/quote", { cookie: cookies[index], method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      assert.equal(quoteResponse.status, 200);
      const quote = await quoteResponse.json();
      assert.equal(quote.totals.subtotal, 10000); assert.equal(quote.totals.shippingFee, 15000); assert.equal(quote.totals.grandTotal, 25000);
      return { ...payload, quoteToken: quote.token };
    }));
    const outcomes = await Promise.all(
      [1, 2].map((index, position) =>
        call("/api/order/create-cod", {
          cookie: cookies[index],
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(checkoutBodies[position]),
        }),
      ),
    );
    assert.equal(
      outcomes.filter((response) => response.status === 200).length,
      1,
      JSON.stringify(await Promise.all(outcomes.map(async response=>({status:response.status,body:await response.clone().json()})))),
    );
    assert.equal(
      outcomes.filter((response) => response.status === 409).length,
      1,
      JSON.stringify(await Promise.all(outcomes.map(async response=>({status:response.status,body:await response.clone().json()})))),
    );
    const saved = await outcomes
      .find((response) => response.status === 200)
      .json();
    assert.equal(
      (await prisma.productVariant.findUnique({ where: { id: variant.id } }))
        .inventory.reserved,
      1,
    );
    checks.push(
      "two actual HTTP checkouts compete for one unit: one order, one conflict, one hold",
    );
    const order = await prisma.order.findUnique({
      where: { id: saved.order.id },
    });
    assert.equal(order.amount, 25000); assert.equal(order.totals.subtotal, 10000); assert.equal(order.totals.shippingFee, 15000);
    assert.equal(order.totals.shippingBaseFee, 15000); assert.equal(order.totals.freeShippingThreshold, 300000);
    await prisma.order.update({
      where: { id: order.id },
      data: {
        stockReservation: {
          set: { ...order.stockReservation, expiresAt: new Date(0) },
        },
      },
    });
    const jobHeaders = { Authorization: "Bearer " + cronSecret };
    assert.equal(
      (await call("/api/jobs/reconcile-payments", { headers: jobHeaders }))
        .status,
      200,
    );
    assert.equal(
      (await prisma.order.findUnique({ where: { id: order.id } })).status,
      "cancelled",
    );
    assert.equal(
      (await prisma.productVariant.findUnique({ where: { id: variant.id } }))
        .inventory.reserved,
      0,
    );
    assert.equal(
      (await call("/api/jobs/health", { headers: jobHeaders })).status,
      200,
    );
    checks.push(
      "authenticated actual job releases expired COD once, persists heartbeat and passes health monitor",
    );
    const operations = await (
      await call("/api/admin/operations", { cookie: cookies[0] })
    ).json();
    assert.equal(operations.job.status, "SUCCEEDED");
    assert.equal(operations.demoMode, true);
    assert.equal(
      (
        await (
          await call("/api/admin/operations/holds", { cookie: cookies[0] })
        ).json()
      ).total,
      0,
    );
    assert.equal(
      (await call("/admin/operations", { cookie: cookies[0] })).status,
      200,
    );
    assert.equal(
      (await call("/admin/operations/holds", { cookie: cookies[0] })).status,
      200,
    );
    checks.push(
      "Operations and holds pages render with real session, API and MongoDB",
    );
    const orderFixture = await require("./check-order-lifecycle-http.cjs").verifyOrderLifecycleHttp({ call, prisma, cookies, users, variant, body, checks });
    const supportFixture = await require("./check-support-http.cjs").verifySupportHttp({ call, prisma, cookies, users, product, variant, orderFixture, secret, checks });
    await require("./check-email-http.cjs").verifyEmailHttp({call,prisma,cookies,cronSecret,checks});
    const ticketFixture=await require('./check-support-tickets-http.cjs').verifySupportTicketsHttp({call,prisma,cookies,users,product,variant,orderFixture,checks});
    const contentFixture=await require('./check-customer-service-http.cjs').verifyCustomerServiceHttp({call,prisma,cookies,users,variant,body,checks});
    if (process.env.QA_BROWSER === "true") {
      const {
        verifyOperationsBrowser,
      } = require("./check-operations-browser.cjs");
      const count = await verifyOperationsBrowser({
        origin,
        cookie: cookies[0],
        artifactDirectory: artifacts,
        orderFixture,
        supportFixture,
        ticketFixture,
        contentFixture,
        cartFixture: { id: product.id, variantId: variant.id, name: "Private HTTP QA phone", description: "QA", category: "QA phones", brand: "QA brand", selectedImg: variant.image, quantity: 2, price: 1 },
      });
      checks.push(`Browser passed ${count} responsive/error/recovery groups.`);
    }
    if (process.env.QA_ROLLBACK_APP) {
      const previousApp = path.resolve(process.env.QA_ROLLBACK_APP);
      assert.notEqual(previousApp, app);
      const previousBuild = fs
        .readFileSync(path.join(previousApp, ".next/BUILD_ID"), "utf8")
        .trim();
      const currentBuild = fs
        .readFileSync(path.join(app, ".next/BUILD_ID"), "utf8")
        .trim();
      assert.notEqual(previousBuild, currentBuild);
      const rollbackPort = port + 1;
      const rollbackOrigin = "http://127.0.0.1:" + rollbackPort;
      rollbackServer = spawn(
        process.execPath,
        [
          path.join(previousApp, "node_modules/next/dist/bin/next"),
          "start",
          "--hostname",
          "127.0.0.1",
          "--port",
          String(rollbackPort),
        ],
        {
          cwd: previousApp,
          env: {
            ...env,
            NEXTAUTH_URL: rollbackOrigin,
            NEXT_PUBLIC_APP_URL: rollbackOrigin,
          },
          windowsHide: true,
          stdio: ["ignore", log, log],
        },
      );
      let rollbackReady = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        try {
          rollbackReady = (
            await fetch(rollbackOrigin + "/products", {
              signal: AbortSignal.timeout(1000),
            })
          ).ok;
        } catch {}
        if (rollbackReady) break;
        await pause(300);
      }
      assert.ok(rollbackReady, "Previous build did not start");
      const oldCatalog = await fetch(rollbackOrigin + "/products", {
        signal: AbortSignal.timeout(30000),
      });
      assert.equal(oldCatalog.status, 200);
      assert.ok((await oldCatalog.text()).includes(product.name));
      const oldOrder = await fetch(rollbackOrigin + "/api/order/" + order.id, {
        headers: { Cookie: cookies[0] },
        signal: AbortSignal.timeout(30000),
      });
      assert.equal(oldOrder.status, 200);
      assert.equal(
        (await prisma.order.findUnique({ where: { id: order.id } })).status,
        "cancelled",
      );
      assert.equal(
        (await prisma.productVariant.findUnique({ where: { id: variant.id } }))
          .inventory.reserved,
        0,
      );
      checks.push(
        "previous build serves catalog and existing orders against the upgraded QA database without changing stock",
      );
      fs.writeFileSync(
        path.join(artifacts, "p0-rollback-results.json"),
        JSON.stringify(
          {
            previousBuild,
            currentBuild,
            distinctBuilds: true,
            databaseIsolated: true,
            existingOrderPreserved: true,
            inventoryPreserved: true,
            publicDeploymentChanges: 0,
          },
          null,
          2,
        ),
      );
    }
    fs.writeFileSync(
      path.join(artifacts, "p0-e2e-results.json"),
      JSON.stringify(
        {
          checks,
          databaseIsolated: true,
          applicationDatabaseWrites: 0,
          providerNetworkCalls: 0,
          liveMoneyTransactions: 0,
        },
        null,
        2,
      ),
    );
    console.log("Production-server E2E passed: " + checks.length + " groups.");
  } finally {
    if (rollbackServer?.pid && rollbackServer.exitCode === null) {
      if (process.platform === "win32")
        spawnSync(
          "taskkill",
          ["/PID", String(rollbackServer.pid), "/T", "/F"],
          { windowsHide: true, stdio: "ignore" },
        );
      else rollbackServer.kill("SIGTERM");
    }
    if (server?.pid && server.exitCode === null) {
      if (process.platform === "win32")
        spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore",
        });
      else server.kill("SIGTERM");
    }
    fs.closeSync(log);
    assert.equal(connection.pathname, "/" + database);
    assert.match(database, /^sgtech_http_qa_\d+_[a-f0-9]+$/);
    await prisma.$runCommandRaw({ dropDatabase: 1 });
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error("Production-server E2E failed:", error.code || error.name);
  if (error.name === "AssertionError") console.error(error.stack);
  else console.error(error.stack?.split("\n").filter(line => line.trim().startsWith("at ")).slice(0, 6).join("\n"));
  process.exitCode = 1;
});
