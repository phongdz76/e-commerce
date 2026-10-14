const test = require("node:test");
const assert = require("node:assert/strict");
const { generateKeyPair, SignJWT } = require("jose");
const sourceLoader = require("./fixtures/load-source.cjs");
const {
  workerConfiguration,
  runWorker,
} = require("../scripts/payment-worker.cjs");

function matches(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (key === "AND") return value.every((where) => matches(row, where));
    if (key === "OR") return value.some((where) => matches(row, where));
    if (value === null) return row[key] == null;
    if (value instanceof Date) return row[key]?.getTime() === value.getTime();
    if (value && typeof value === "object") {
      if ("is" in value) return !!row[key] && matches(row[key], value.is);
      if ("isSet" in value) return Object.hasOwn(row, key) === value.isSet;
      if ("in" in value) return value.in.includes(row[key]);
      if ("notIn" in value) return !value.notIn.includes(row[key]);
      if ("lte" in value) return row[key] <= value.lte;
      if ("gt" in value) return row[key] > value.gt;
      if ("not" in value)
        return value.not === null ? row[key] != null : row[key] !== value.not;
    }
    return row[key] === value;
  });
}

function delegate(records) {
  const select = (row, fields) =>
    !row
      ? null
      : structuredClone(
          fields
            ? Object.fromEntries(
                Object.keys(fields)
                  .filter((key) => fields[key] === true)
                  .map((key) => [key, row[key]]),
              )
            : row,
        );
  return {
    create: async ({ data }) => {
      if (records.has(data.id))
        throw Object.assign(new Error("Duplicate"), { code: "P2002" });
      const row = {
        runCount: 0,
        createdAt: new Date(),
        ...structuredClone(data),
      };
      records.set(row.id, row);
      return structuredClone(row);
    },
    findUnique: async ({ where, select: fields }) =>
      select(
        [...records.values()].find((row) => matches(row, where)),
        fields,
      ),
    findMany: async ({
      where = {},
      skip = 0,
      take = 100,
      select: fields,
    } = {}) =>
      [...records.values()]
        .filter((row) => matches(row, where))
        .slice(skip, skip + take)
        .map((row) => select(row, fields)),
    count: async ({ where = {} } = {}) =>
      [...records.values()].filter((row) => matches(row, where)).length,
    updateMany: async ({ where, data }) => {
      let count = 0;
      for (const row of records.values())
        if (matches(row, where)) {
          for (const [key, value] of Object.entries(data))
            row[key] =
              value && typeof value === "object" && "increment" in value
                ? row[key] + value.increment
                : value && typeof value === "object" && "set" in value
                  ? structuredClone(value.set)
                  : structuredClone(value);
          count++;
        }
      return { count };
    },
  };
}

function fixture() {
  const jobs = new Map(),
    incidents = new Map(),
    orders = new Map(),
    attempts = new Map();
  const state = {
    user: { id: "e".repeat(24), role: "ADMIN" },
    audits: [],
    stripeCalls: [],
    stripeError: false,
    releaseRace: false,
    jobError: false,
  };
  const db = {
    operationalJob: delegate(jobs),
    operationalIncident: delegate(incidents),
    order: delegate(orders),
    paymentAttempt: delegate(attempts),
    paymentException: delegate(new Map()),
    $transaction: async (operation) => operation(db),
  };
  const load = sourceLoader({
    "@/libs/prismadb": { __esModule: true, default: db },
    "@/actions/getCurrentUser": { getCurrentUser: async () => state.user },
    "@/libs/adminAudit": {
      startAdminAudit: async (...args) => {
        state.audits.push({ args, status: "STARTED" });
        return { id: String(state.audits.length - 1) };
      },
      finishAdminAudit: async (id, status) => {
        state.audits[Number(id)].status = status;
      },
    },
    "@/libs/authRateLimit": {
      checkAuthRateLimit: async () => {},
      cleanupExpiredAuthRateLimits: async () => 0,
      AuthRateLimitError: class extends Error {},
    },
    "@/libs/reconcilePayment": {
      reconcilePendingPayments: async () => {
        if (state.jobError) throw new Error("private-provider-key");
        return [];
      },
    },
    "@/libs/stripe": {
      getStripe: () => ({
        paymentIntents: {
          create: async (data, options) => {
            state.stripeCalls.push({ data, options });
            if (state.stripeError) throw new Error("private-stripe-key");
            if (state.releaseRace)
              orders.get(data.metadata.orderId).stockReservation.state =
                "RELEASED";
            return {
              id: "pi_original",
              livemode: false,
              amount: data.amount,
              currency: data.currency,
              metadata: data.metadata,
              client_secret: "private-client-secret",
            };
          },
        },
      }),
    },
    "next/server": { NextResponse: { json: Response.json } },
  });
  const stock = load("libs/orderStock.ts");
  // Scheduler expiry is tested separately against real MongoDB, avoiding provider effects here.
  stock.expireUnconfirmedCodStock = async () => 0;
  return {
    jobs,
    incidents,
    orders,
    attempts,
    state,
    load,
    db,
    helper: load("libs/operationalJobs.ts"),
  };
}

test("twenty concurrent job claims have exactly one owner and stale owners cannot finish", async () => {
  const f = fixture();
  const results = await Promise.all(
    Array.from({ length: 20 }, () => f.helper.claimOperationalJob()),
  );
  const owners = results.filter(Boolean);
  assert.equal(owners.length, 1);
  const row = f.jobs.get("payment-reconciliation");
  assert.equal(row.runCount, 1);
  row.leaseExpiresAt = new Date(0);
  const replacement = await f.helper.claimOperationalJob();
  assert.ok(replacement);
  assert.equal(
    await f.helper.finishOperationalJob(owners[0], { processed: 999 }),
    false,
  );
  assert.equal(
    await f.helper.finishOperationalJob(replacement, { processed: 2 }),
    true,
  );
  assert.equal(row.status, "SUCCEEDED");
  assert.equal(row.runCount, 2);
  assert.equal(row.metrics.processed, 2);
  assert.ok(row.lastSucceededAt);
});

test("incident storage excludes query secrets, raw messages and invalid digests", async () => {
  const f = fixture();
  const old = console.error;
  const logs = [];
  console.error = (...args) => logs.push(args);
  try {
    const id = await f.helper.recordOperationalIncident(
      "NEXT_REQUEST_FAILED",
      "/api/reset?token=private-token",
      "private token",
    );
    const incident = f.incidents.get(id);
    assert.equal(incident.route, undefined);
    assert.equal(incident.digest, undefined);
    assert.doesNotMatch(JSON.stringify(logs), /private-token|private token/);
  } finally {
    console.error = old;
  }
});

test("cron route rejects unauthorized requests and records success/overlap without a fake heartbeat", async () => {
  const f = fixture();
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "fixture-operations-secret";
  try {
    const route = f.load("app/api/jobs/reconcile-payments/route.ts").GET;
    assert.equal(
      (await route(new Request("http://localhost/job"))).status,
      401,
    );
    const request = () =>
      new Request("http://localhost/job", {
        headers: { Authorization: "Bearer fixture-operations-secret" },
      });
    const success = await route(request());
    assert.equal(success.status, 200);
    const row = f.jobs.get("payment-reconciliation");
    const last = row.lastSucceededAt;
    await f.helper.claimOperationalJob();
    const overlap = await route(request());
    assert.equal(overlap.status, 202);
    assert.equal((await overlap.json()).skipped, true);
    assert.deepEqual(row.lastSucceededAt, last);
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});

test("a failed scheduler run returns a correlation reference and preserves its last success", async () => {
  const f = fixture();
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "fixture-operations-secret";
  const old = console.error;
  console.error = () => {};
  try {
    const route = f.load("app/api/jobs/reconcile-payments/route.ts").GET;
    const request = () =>
      new Request("http://localhost/job", {
        headers: { Authorization: "Bearer fixture-operations-secret" },
      });
    await route(request());
    const last = f.jobs.get("payment-reconciliation").lastSucceededAt;
    f.state.jobError = true;
    const response = await route(request());
    assert.equal(response.status, 503);
    const data = await response.json();
    assert.ok(f.incidents.has(data.reference));
    assert.doesNotMatch(JSON.stringify(data), /private-provider-key/);
    const job = f.jobs.get("payment-reconciliation");
    assert.equal(job.status, "FAILED");
    assert.deepEqual(job.lastSucceededAt, last);
  } finally {
    console.error = old;
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});

test("operations and hold views require ADMIN before querying private balances", async () => {
  for (const [user, status] of [
    [null, 401],
    [{ role: "USER" }, 403],
  ]) {
    const f = fixture();
    f.state.user = user;
    assert.equal(
      (await f.load("app/api/admin/operations/route.ts").GET()).status,
      status,
    );
    assert.equal(
      (
        await f
          .load("app/api/admin/operations/holds/route.ts")
          .GET(new Request("http://localhost/holds"))
      ).status,
      status,
    );
  }
});

test("operations distinguishes a missing, successful, failed and stale worker heartbeat", async () => {
  const f = fixture();
  const operations = f.load("libs/operations.ts");
  assert.equal(
    (await operations.getOperationsReport()).checks.find(
      (row) => row.key === "scheduler",
    ).ok,
    false,
  );
  const token = await f.helper.claimOperationalJob();
  await f.helper.finishOperationalJob(token, {});
  assert.equal(
    (await operations.getOperationsReport()).checks.find(
      (row) => row.key === "scheduler",
    ).ok,
    true,
  );
  f.jobs.get("payment-reconciliation").status = "FAILED";
  assert.equal(
    (await operations.getOperationsReport()).checks.find(
      (row) => row.key === "scheduler",
    ).ok,
    false,
  );
  Object.assign(f.jobs.get("payment-reconciliation"), {
    status: "SUCCEEDED",
    lastSucceededAt: new Date(0),
  });
  assert.equal(
    (await operations.getOperationsReport()).checks.find(
      (row) => row.key === "scheduler",
    ).ok,
    false,
  );
});

test("hold queue excludes paid/young/released/COD orders and never exposes raw reservation or customer fields", async () => {
  const f = fixture();
  const old = new Date(Date.now() - 2 * 3600000);
  const order = {
    id: "a".repeat(24),
    paymentMethod: "STRIPE",
    status: "draft",
    createDate: old,
    paymentIntentId: "STRIPE_original",
    activePaymentAttemptId: "STRIPE_original",
    stockReservation: {
      state: "HELD",
      version: 1,
      lines: [{ quantity: 2, variantId: "private-variant" }],
    },
    userId: "private-user",
  };
  f.orders.set(order.id, order);
  for (const [id, changes] of [
    ["paid", { status: "paid" }],
    ["young", { createDate: new Date() }],
    ["released", { stockReservation: { state: "RELEASED" } }],
    ["cod", { paymentMethod: "COD" }],
  ])
    f.orders.set(id, { ...order, id, ...changes });
  const response = await f
    .load("app/api/admin/operations/holds/route.ts")
    .GET(new Request("http://localhost/holds"));
  const data = await response.json();
  assert.equal(data.total, 1);
  assert.equal(data.holds[0].reason, "CARD_PREPARATION_UNCONFIRMED");
  assert.equal(data.holds[0].canRecoverCard, true);
  assert.equal(data.holds[0].canCheck, false);
  assert.equal(data.holds[0].units, 2);
  assert.doesNotMatch(
    JSON.stringify(data),
    /private-user|private-variant|stockReservation|STRIPE_original/,
  );
});

function cardFixture() {
  const f = fixture();
  const order = {
    id: "a".repeat(24),
    userId: "b".repeat(24),
    paymentMethod: "STRIPE",
    currency: "vnd",
    amount: 10000,
    status: "draft",
    deliveryStatus: "pending",
    createDate: new Date(Date.now() - 2 * 3600000),
    paymentIntentId: "STRIPE_original",
    activePaymentAttemptId: "STRIPE_original",
    stockReservation: { state: "HELD", version: 1 },
  };
  f.orders.set(order.id, order);
  f.attempts.set("STRIPE_original", {
    id: "STRIPE_original",
    orderId: order.id,
    paymentMethod: "STRIPE",
    currency: "vnd",
    amount: 10000,
    state: "CREATED",
  });
  return {
    ...f,
    order,
    recover: f.load("libs/recoverCardHold.ts").recoverCardHold,
  };
}

test("card recovery replays the exact original key/parameters, attaches once and keeps the hold", async () => {
  const f = cardFixture();
  await f.recover(f.order.id, 1, "admin", "Recover interrupted test request");
  const call = f.state.stripeCalls[0];
  assert.equal(call.options.idempotencyKey, "stock-checkout-" + f.order.id);
  assert.deepEqual(call.data, {
    amount: 10000,
    currency: "vnd",
    automatic_payment_methods: { enabled: true },
    metadata: { orderId: f.order.id, userId: f.order.userId },
  });
  assert.equal(f.order.paymentIntentId, "pi_original");
  assert.equal(f.order.stockReservation.state, "HELD");
  assert.equal(f.state.audits[0].status, "SUCCEEDED");
  assert.equal(f.attempts.get("STRIPE_original").state, "READY");
  assert.equal(
    (await f.recover(f.order.id, 1, "admin", "Repeat the same recovery"))
      .alreadyAttached,
    true,
  );
  assert.equal(f.state.stripeCalls.length, 1);
});

test("old, changed or released card holds cannot create a replacement intent", async () => {
  for (const changes of [
    { createDate: new Date(Date.now() - 24 * 3600000) },
    { stockReservation: { state: "RELEASED", version: 1 } },
    { status: "paid" },
    { paymentMethod: "MOMO" },
  ]) {
    const f = cardFixture();
    Object.assign(f.order, changes);
    await assert.rejects(
      f.recover(f.order.id, 1, "admin", "Unsafe recovery must be blocked"),
    );
    assert.equal(f.state.stripeCalls.length, 0);
  }
});

test("provider failure or concurrent release never attaches or releases uncertain stock", async () => {
  for (const key of ["stripeError", "releaseRace"]) {
    const f = cardFixture();
    f.state[key] = true;
    await assert.rejects(
      f.recover(f.order.id, 1, "admin", "Recover interrupted request"),
    );
    assert.equal(f.order.paymentIntentId, "STRIPE_original");
    assert.equal(
      f.state.audits[0].status,
      key === "stripeError" ? "UNKNOWN" : "FAILED",
    );
  }
});

test("card recovery API requires ADMIN, explicit confirmation, a fresh version and reason", async () => {
  const f = cardFixture();
  const route = f.load(
    "app/api/admin/operations/holds/[orderId]/recover-card/route.ts",
  ).POST;
  const invoke = (value) =>
    route(
      new Request("http://localhost/recover", {
        method: "POST",
        body: JSON.stringify(value),
      }),
      { params: Promise.resolve({ orderId: f.order.id }) },
    );
  f.state.user = null;
  assert.equal((await invoke({})).status, 401);
  f.state.user = { role: "USER" };
  assert.equal((await invoke({})).status, 403);
  f.state.user = { id: "admin", role: "ADMIN" };
  for (const value of [
    {},
    { confirmed: "true", version: 1, reason: "Valid recovery reason" },
    { confirmed: true, version: 0, reason: "Valid recovery reason" },
    { confirmed: true, version: 1, reason: "short" },
  ])
    assert.equal((await invoke(value)).status, 400);
  const response = await invoke({
    confirmed: true,
    version: 1,
    reason: "Recover interrupted test intent",
  });
  assert.equal(response.status, 200);
  assert.doesNotMatch(await response.text(), /private-client-secret/);
});

test("worker drains multiple bounded batches, stops at empty/overlap and reports failures nonzero", async () => {
  const config = workerConfiguration({
    CRON_SECRET: "fixture",
    PAYMENT_WORKER_APP_URL: "https://demo.example",
    PAYMENT_WORKER_MAX_BATCHES: "3",
  });
  let calls = 0;
  const log = { info() {}, error() {} };
  assert.equal(
    await runWorker(config, {
      once: true,
      log,
      fetchImpl: async () =>
        Response.json({
          processed: 0,
          expiredCodHolds: ++calls === 1 ? 50 : 1,
        }),
    }),
    0,
  );
  assert.equal(calls, 2);
  calls = 0;
  assert.equal(
    await runWorker(config, {
      once: true,
      log,
      fetchImpl: async () => {
        calls++;
        return Response.json({ processed: 5, expiredCodHolds: 50 });
      },
    }),
    0,
  );
  assert.equal(calls, 3);
  assert.equal(
    await runWorker(config, {
      once: true,
      log,
      fetchImpl: async () => Response.json({ skipped: true }, { status: 202 }),
    }),
    0,
  );
  for (const response of [
    Response.json({}, { status: 503 }),
    Response.json({ processed: "5" }),
    Response.json({ processed: 0, expiredCodHolds: 99 }),
  ])
    assert.equal(
      await runWorker(config, {
        once: true,
        log,
        fetchImpl: async () => response,
      }),
      1,
    );
  for (const env of [
    {
      CRON_SECRET: "a",
      PAYMENT_WORKER_APP_URL: "https://user:password@example.com",
    },
    { CRON_SECRET: "a", PAYMENT_WORKER_APP_URL: "http://example.com" },
    { CRON_SECRET: "a", PAYMENT_WORKER_MAX_BATCHES: "11" },
    {},
  ])
    assert.throws(() => workerConfiguration(env));
});

test("sandbox endpoint validation refuses production, alternate hosts and URL credentials", () => {
  const { assertSandboxEndpoint } = sourceLoader()("utils/sandboxPayment.ts");
  assertSandboxEndpoint(
    "https://test-payment.momo.vn/v2/gateway/api/query",
    "test-payment.momo.vn",
  );
  for (const url of [
    "https://payment.momo.vn/v2/gateway/api/query",
    "https://test-payment.momo.vn.evil.example/query",
    "https://user:pass@test-payment.momo.vn/query",
    "http://test-payment.momo.vn/query",
  ])
    assert.throws(() => assertSandboxEndpoint(url, "test-payment.momo.vn"));
});

test("GitHub worker identity verifies signatures and scopes repo, owner, workflow, branch, event and expiry", async () => {
  const identity = sourceLoader()("libs/githubOperationsIdentity.ts");
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const claims = {
    repository: "phongdz76/e-commerce",
    repository_id: "1044465509",
    repository_owner_id: "145427852",
    ref: "refs/heads/main",
    workflow_ref:
      "phongdz76/e-commerce/.github/workflows/operations.yml@refs/heads/main",
    event_name: "workflow_dispatch",
    sub: "repo:phongdz76/e-commerce:ref:refs/heads/main",
  };
  const sign = async (changes = {}, key = privateKey) =>
    new SignJWT({ ...claims, ...changes })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer("https://token.actions.githubusercontent.com")
      .setAudience("sgtech-operations")
      .setIssuedAt()
      .setNotBefore("0s")
      .setExpirationTime("5m")
      .sign(key);
  assert.equal(
    await identity.verifyGitHubOperationsToken(
      await sign(),
      async () => publicKey,
    ),
    true,
  );
  assert.equal(
    await identity.verifyGitHubOperationsToken(
      await sign({
        sub: "repo:phongdz76@145427852/e-commerce@1044465509:ref:refs/heads/main",
      }),
      async () => publicKey,
    ),
    true,
  );
  for (const changes of [
    { repository: "attacker/e-commerce" },
    { repository_id: "wrong" },
    { repository_owner_id: "wrong" },
    { ref: "refs/heads/dev" },
    {
      workflow_ref:
        "phongdz76/e-commerce/.github/workflows/ci.yml@refs/heads/main",
    },
    { event_name: "pull_request" },
    { sub: "wrong" },
  ])
    assert.equal(
      await identity.verifyGitHubOperationsToken(
        await sign(changes),
        async () => publicKey,
      ),
      false,
    );
  const wrong = await generateKeyPair("RS256");
  assert.equal(
    await identity.verifyGitHubOperationsToken(
      await sign({}, wrong.privateKey),
      async () => publicKey,
    ),
    false,
  );
  const expired = await new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer("https://token.actions.githubusercontent.com")
    .setAudience("sgtech-operations")
    .setIssuedAt(Math.floor(Date.now() / 1000) - 1000)
    .setNotBefore(0)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 100)
    .sign(privateKey);
  assert.equal(
    await identity.verifyGitHubOperationsToken(expired, async () => publicKey),
    false,
  );
});
