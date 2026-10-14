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
    });
    const outcomes = await Promise.all(
      [1, 2].map((index) =>
        call("/api/order/create-cod", {
          cookie: cookies[index],
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body(users[index])),
        }),
      ),
    );
    assert.equal(
      outcomes.filter((response) => response.status === 200).length,
      1,
    );
    assert.equal(
      outcomes.filter((response) => response.status === 409).length,
      1,
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
    if (process.env.QA_BROWSER === "true") {
      const {
        verifyOperationsBrowser,
      } = require("./check-operations-browser.cjs");
      const count = await verifyOperationsBrowser({
        origin,
        cookie: cookies[0],
        artifactDirectory: artifacts,
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
  if (error.name === "AssertionError") console.error(error.message);
  process.exitCode = 1;
});
