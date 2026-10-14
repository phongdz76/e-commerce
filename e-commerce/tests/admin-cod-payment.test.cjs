const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const COLLECTION_KEY = "11111111-1111-4111-8111-111111111111";
const SETTLEMENT_KEY = "22222222-2222-4222-8222-222222222222";
const OTHER_KEY = "33333333-3333-4333-8333-333333333333";

function fixture() {
  const now = Date.now();
  const state = {
    user: { id: "b".repeat(24), role: "ADMIN" },
    offline: false,
    auditFailure: false,
    outcomeFailure: false,
    writeFailure: false,
    ambiguousWrite: false,
    beforeWrite: null,
    order: {
      id: "a".repeat(24), amount: 1000000, currency: "vnd", status: "pending",
      paymentMethod: "COD", deliveryStatus: "delivered", codPaymentInfo: null,
      createDate: new Date(now - 2 * 86400000),
      products: [{ id: "c".repeat(24), price: 1000000, quantity: 1, name: "Saved product" }],
      address: { line1: "Saved address" },
      paymentIntentId: "private-original-reference", recipientPhone: "private-phone",
    },
  };
  const queries = [];
  const audits = [];
  const writes = [];
  const prisma = {
    order: {
      findUnique: async (options) => {
        queries.push(options);
        if (state.offline) throw new Error("private-db-credentials");
        return state.order?.id === options.where.id ? structuredClone(state.order) : null;
      },
      updateMany: async ({ where, data }) => {
        state.beforeWrite?.();
        state.beforeWrite = null;
        if (state.writeFailure) throw new Error("private-write-error");
        const order = state.order;
        const fieldsMatch = ["id", "paymentMethod", "status", "amount", "currency", "deliveryStatus"].every((key) => where[key] === order[key]);
        const versionMatch = where.codPaymentInfo
          ? order.codPaymentInfo?.version === where.codPaymentInfo.is.version
          : !order.codPaymentInfo && Array.isArray(where.OR);
        if (!fieldsMatch || !versionMatch) return { count: 0 };
        writes.push(structuredClone({ where, data }));
        Object.assign(order, structuredClone({ ...data, codPaymentInfo: data.codPaymentInfo.set }));
        if (state.ambiguousWrite) throw new Error("private-write-timeout-after-commit");
        return { count: 1 };
      },
    },
    auditLog: {
      create: async ({ data }) => {
        if (state.auditFailure) throw new Error("private-audit-error");
        const log = { ...structuredClone(data), id: String(audits.length + 1), createdAt: new Date() };
        audits.push(log);
        return log;
      },
      update: async ({ where, data }) => {
        if (state.outcomeFailure) throw new Error("private-outcome-error");
        Object.assign(audits.find((log) => log.id === where.id), data);
      },
    },
  };
  const mocks = {
    "@/libs/prismadb": { __esModule: true, default: prisma },
    "@/actions/getCurrentUser": { getCurrentUser: async () => state.user },
    "next/server": { NextResponse: { json: Response.json } },
  };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const filename = path.resolve(__dirname, "..", file);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const loaded = { exports: {} };
    vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })(
      (name) => name in mocks ? mocks[name] : name.startsWith("@/") ? load(`${name.slice(2)}.ts`) : require(name),
      loaded, loaded.exports,
    );
    cache.set(file, loaded.exports);
    return loaded.exports;
  }
  const route = load("app/api/admin/orders/[orderId]/cod-payment/route.ts");
  const context = (id) => ({ params: Promise.resolve({ orderId: id || "a".repeat(24) }) });
  return {
    state, audits, writes, queries,
    input: {
      action: "COLLECTION", requestId: COLLECTION_KEY, version: 0, collector: "CARRIER",
      amount: 1000000, reference: "RECEIPT-001", occurredAt: new Date(now - 3600000).toISOString(), note: "Verified carrier receipt", confirmed: true,
    },
    get: (id) => route.GET(new Request("http://localhost/api/admin/orders/record/cod-payment"), context(id)),
    patch: (body, id) => route.PATCH(new Request("http://localhost/api/admin/orders/record/cod-payment", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body),
    }), context(id)),
    utils: load("utils/adminCodPayment.ts"),
    activity: load("libs/adminActivity.ts"),
  };
}

test("COD reads and writes reject anonymous and customer sessions before database access", async () => {
  const f = fixture();
  for (const user of [null, { id: "b".repeat(24), role: "USER" }]) {
    f.state.user = user;
    assert.equal((await f.get()).status, user ? 403 : 401);
    assert.equal((await f.patch(f.input)).status, user ? 403 : 401);
  }
  assert.equal(f.queries.length, 0);
  assert.equal(f.writes.length, 0);
});

test("invalid IDs, malformed JSON, forged confirmation and unsafe amounts never create receipts", async () => {
  const f = fixture();
  assert.equal((await f.get("invalid")).status, 400);
  assert.equal((await f.patch(f.input, "invalid")).status, 400);
  const cases = [
    "{", null, [], { ...f.input, confirmed: false }, { ...f.input, confirmed: "true" },
    { ...f.input, amount: "1000000" }, { ...f.input, amount: 1.5 }, { ...f.input, amount: 0 },
    { ...f.input, amount: -1 }, { ...f.input, amount: Number.MAX_SAFE_INTEGER + 1 },
    { ...f.input, requestId: "invalid" }, { ...f.input, version: -1 }, { ...f.input, version: 2147483647 },
    { ...f.input, collector: "constructor" }, { ...f.input, action: "__proto__" },
    { ...f.input, reference: "x" }, { ...f.input, reference: "a\nbcd" },
    { ...f.input, occurredAt: "invalid" }, { ...f.input, note: "x".repeat(1001) },
  ];
  for (const input of cases) assert.equal((await f.patch(input)).status, 400);
  assert.equal(f.queries.length, 0);
  assert.equal(f.audits.length, 0);
  assert.equal(f.writes.length, 0);
});

test("COD receipts are locked for online, undelivered, cancelled, failed and non-VND orders", async () => {
  for (const override of [
    { paymentMethod: "MOMO" }, { paymentMethod: "STRIPE" }, { deliveryStatus: "in_transit" },
    { deliveryStatus: "returned" }, { deliveryStatus: null }, { status: "cancelled" },
    { status: "failed" }, { status: "draft" }, { currency: "usd" }, { amount: 0 }, { amount: 1.5 },
  ]) {
    const f = fixture();
    Object.assign(f.state.order, override);
    const data = await (await f.get()).json();
    assert.equal(data.allowedAction, null);
    assert.equal((await f.patch(f.input)).status, 409);
    assert.equal(f.writes.length, 0);
  }
});

test("legacy paid COD orders do not infer collection or store receipt and cannot be charged again", async () => {
  for (const status of ["paid", "complete", "done"]) {
    const f = fixture();
    f.state.order.status = status;
    const data = await (await f.get()).json();
    assert.equal(data.collection, null);
    assert.equal(data.settlement, null);
    assert.equal(data.allowedAction, null);
    assert.match(data.lockReason, /legacy order/);
    assert.equal((await f.patch(f.input)).status, 409);
    assert.equal(f.writes.length, 0);
  }
});

test("carrier collection confirms customer payment while leaving store remittance unrecorded", async () => {
  const f = fixture();
  const snapshot = JSON.stringify({ products: f.state.order.products, address: f.state.order.address, amount: f.state.order.amount, currency: f.state.order.currency, paymentIntentId: f.state.order.paymentIntentId });
  const response = await f.patch(f.input);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(f.state.order.status, "paid");
  assert.equal(f.state.order.deliveryStatus, "delivered");
  assert.equal(f.state.order.codPaymentInfo.version, 1);
  assert.equal(f.state.order.codPaymentInfo.collection.collector, "CARRIER");
  assert.equal(f.state.order.codPaymentInfo.settlement, null);
  assert.equal(f.audits[0].action, "COD_COLLECTION_RECORDED");
  assert.equal(f.audits[0].status, "SUCCEEDED");
  assert.equal(snapshot, JSON.stringify({ products: f.state.order.products, address: f.state.order.address, amount: f.state.order.amount, currency: f.state.order.currency, paymentIntentId: f.state.order.paymentIntentId }));
  assert.equal((await (await f.get()).json()).allowedAction, "SETTLEMENT");
});

test("direct store collection records customer payment and store receipt from the same proof", async () => {
  const f = fixture();
  assert.equal((await f.patch({ ...f.input, collector: "STORE" })).status, 200);
  const info = f.state.order.codPaymentInfo;
  assert.equal(info.collection.reference, info.settlement.reference);
  assert.equal(info.collection.amount, info.settlement.amount);
  assert.equal(info.settlement.carrierFee, 0);
  assert.equal((await (await f.get()).json()).allowedAction, null);
  assert.equal(f.writes.length, 1);
});

test("carrier remittance requires collection first and exactly reconciles money received plus fee", async () => {
  const f = fixture();
  const settlement = {
    ...f.input, action: "SETTLEMENT", requestId: SETTLEMENT_KEY, amount: 980000, carrierFee: 20000,
    reference: "REMITTANCE-001", occurredAt: new Date(Date.now() - 300000).toISOString(), version: 1,
  };
  assert.equal((await f.patch({ ...settlement, version: 0 })).status, 409);
  assert.equal((await f.patch(f.input)).status, 200);
  const originalCollection = structuredClone(f.state.order.codPaymentInfo.collection);
  for (const override of [{ amount: 970000 }, { carrierFee: -1 }, { carrierFee: 0.5 }, { carrierFee: "20000" }]) {
    assert.equal((await f.patch({ ...settlement, ...override })).status, 400);
  }
  assert.equal((await f.patch(settlement)).status, 200);
  const info = f.state.order.codPaymentInfo;
  assert.equal(info.version, 2);
  assert.equal(info.settlement.amount, 980000);
  assert.equal(info.settlement.carrierFee, 20000);
  assert.equal(f.state.order.amount, 1000000);
  assert.equal(f.state.order.status, "paid");
  assert.deepEqual(info.collection, originalCollection);
  assert.equal(f.audits[1].action, "COD_SETTLEMENT_RECORDED");
  assert.equal((await (await f.get()).json()).allowedAction, null);
});

test("same request replays both stages without duplicate writes or audits, including stale versions", async () => {
  const f = fixture();
  await f.patch(f.input);
  assert.equal((await (await f.patch(f.input)).json()).unchanged, true);
  const settlement = { ...f.input, action: "SETTLEMENT", requestId: SETTLEMENT_KEY, version: 1, amount: 1000000, carrierFee: 0 };
  await f.patch(settlement);
  assert.equal((await (await f.patch(settlement)).json()).unchanged, true);
  assert.equal((await (await f.patch(f.input)).json()).unchanged, true);
  assert.equal(f.writes.length, 2);
  assert.equal(f.audits.length, 2);
});

test("receipt identities cannot be reused with changed details or to invent another collection", async () => {
  const f = fixture();
  await f.patch(f.input);
  for (const input of [
    { ...f.input, amount: 999999 }, { ...f.input, reference: "OTHER-RECEIPT" },
    { ...f.input, note: "Changed note" }, { ...f.input, collector: "STORE" },
    { ...f.input, requestId: OTHER_KEY, version: 1 },
    { ...f.input, action: "SETTLEMENT", version: 1, carrierFee: 0 },
  ]) {
    assert.equal((await f.patch(input)).status, 409);
  }
  assert.equal(f.writes.length, 1);
  assert.equal(f.audits.length, 1);
});

test("receipt dates reject pre-order, pre-collection and future dates", async () => {
  const f = fixture();
  for (const occurredAt of [new Date(f.state.order.createDate.getTime() - 3600000), new Date(Date.now() + 3600000)]) {
    const response = await f.patch({ ...f.input, occurredAt: occurredAt.toISOString() });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, "COD_RECEIPT_DATE");
  }
  await f.patch(f.input);
  const response = await f.patch({
    ...f.input, action: "SETTLEMENT", requestId: SETTLEMENT_KEY, version: 1, carrierFee: 0,
    occurredAt: new Date(new Date(f.input.occurredAt).getTime() - 60000).toISOString(),
  });
  assert.equal(response.status, 400);
  assert.equal(f.writes.length, 1);
});

test("two admins racing to collect or settle produce exactly one immutable receipt", async () => {
  const f = fixture();
  const collectionResponses = await Promise.all([f.patch(f.input), f.patch({ ...f.input, requestId: OTHER_KEY, reference: "OTHER-RECEIPT" })]);
  assert.deepEqual(collectionResponses.map((response) => response.status).sort(), [200, 409]);
  assert.equal(f.writes.length, 1);
  const settlement = { ...f.input, action: "SETTLEMENT", requestId: SETTLEMENT_KEY, version: 1, carrierFee: 0 };
  const settlementResponses = await Promise.all([f.patch(settlement), f.patch({ ...settlement, requestId: OTHER_KEY })]);
  assert.deepEqual(settlementResponses.map((response) => response.status).sort(), [200, 409]);
  assert.equal(f.writes.length, 2);
  assert.equal(f.state.order.codPaymentInfo.version, 2);
});

test("money, method, delivery, payment status and COD version are guarded at the final write", async () => {
  for (const change of [
    (order) => { order.amount = 2000000; },
    (order) => { order.currency = "usd"; },
    (order) => { order.paymentMethod = "VNPAY"; },
    (order) => { order.status = "cancelled"; },
    (order) => { order.deliveryStatus = "returned"; },
    (order) => { order.codPaymentInfo = { version: 1, collection: {}, settlement: null }; },
  ]) {
    const f = fixture();
    f.state.beforeWrite = () => change(f.state.order);
    assert.equal((await f.patch(f.input)).status, 409);
    assert.equal(f.writes.length, 0);
    assert.equal(f.audits[0].status, "FAILED");
  }
});

test("COD amounts support safe integer VND totals beyond the signed 32-bit range", async () => {
  const f = fixture();
  f.state.order.amount = 3000000000;
  assert.equal((await f.patch({ ...f.input, amount: 3000000000, collector: "STORE" })).status, 200);
  assert.equal(f.state.order.codPaymentInfo.collection.amount, 3000000000);
});

test("audit failure prevents writes, and ambiguous committed writes recover with the same request", async () => {
  const f = fixture();
  f.state.auditFailure = true;
  assert.equal((await f.patch(f.input)).status, 503);
  assert.equal(f.writes.length, 0);
  f.state.auditFailure = false;
  f.state.ambiguousWrite = true;
  const response = await f.patch(f.input);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "COD_UNCONFIRMED");
  assert.equal(f.audits[0].status, "UNKNOWN");
  assert.equal(f.state.order.status, "paid");
  f.state.ambiguousWrite = false;
  assert.equal((await (await f.patch(f.input)).json()).unchanged, true);
  assert.equal(f.writes.length, 1);
  assert.equal(f.audits.length, 1);
});

test("uncommitted write errors remain unconfirmed without leaking database details", async () => {
  const f = fixture();
  f.state.writeFailure = true;
  const response = await f.patch(f.input);
  assert.equal(response.status, 503);
  assert.doesNotMatch(JSON.stringify(await response.json()), /private|credentials|write-error/);
  assert.equal(f.state.order.status, "pending");
  assert.equal(f.state.order.codPaymentInfo, null);
  assert.equal(f.audits[0].status, "UNKNOWN");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("audit outcome failure preserves the receipt and its durable audit start without a duplicate collection", async () => {
  const f = fixture();
  f.state.outcomeFailure = true;
  assert.equal((await f.patch(f.input)).status, 200);
  assert.equal(f.state.order.status, "paid");
  assert.equal(f.audits[0].status, "STARTED");
  const activity = f.activity.formatAdminActivity(f.audits[0], "Store admin", { label: "Order", href: null });
  assert.equal(activity.result, "Outcome not recorded");
  assert.equal((await (await f.patch(f.input)).json()).unchanged, true);
  assert.equal(f.writes.length, 1);
});

test("COD GET returns only receipt business fields and no request identities, staff IDs or customer data", async () => {
  const f = fixture();
  await f.patch(f.input);
  const response = await f.get();
  const data = await response.json();
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(data.collection.reference, "RECEIPT-001");
  assert.equal(data.collection.note, "Verified carrier receipt");
  assert.equal(data.collection.requestId, undefined);
  assert.equal(data.collection.recordedBy, undefined);
  assert.doesNotMatch(JSON.stringify(data), /private|paymentIntentId|recipientPhone|requestId|recordedBy/);
  assert.equal(f.writes.length, 1);
});

test("corrupt COD receipt records and replays after financial changes fail closed", async () => {
  const f = fixture();
  await f.patch(f.input);
  f.state.order.amount = 2000000;
  assert.equal((await (await f.get()).json()).allowedAction, null);
  assert.equal((await f.patch(f.input)).status, 409);
  f.state.order.amount = 1000000;
  f.state.order.codPaymentInfo.collection.collector = "UNKNOWN";
  assert.equal((await (await f.get()).json()).allowedAction, null);
  const settlement = { ...f.input, action: "SETTLEMENT", requestId: SETTLEMENT_KEY, version: 1, carrierFee: 0 };
  assert.equal((await f.patch(settlement)).status, 409);
});

test("missing orders and outages have distinct generic responses without data mutation", async () => {
  const f = fixture();
  assert.equal((await f.get("d".repeat(24))).status, 404);
  assert.equal((await f.patch(f.input, "d".repeat(24))).status, 404);
  f.state.offline = true;
  const response = await f.get();
  assert.equal(response.status, 503);
  assert.doesNotMatch(JSON.stringify(await response.json()), /private|credentials/);
  assert.equal(f.writes.length, 0);
});

test("receipt time inputs use fixed Vietnam time regardless of the host timezone", () => {
  const f = fixture();
  assert.equal(f.utils.getCodVietnamDateInput(new Date("2026-10-13T18:30:00Z")), "2026-10-14T01:30");
  assert.equal(f.utils.codVietnamInputToISO("2026-10-14T01:30"), "2026-10-13T18:30:00.000Z");
  assert.equal(f.utils.codVietnamInputToISO("invalid"), null);
  assert.equal(f.utils.codVietnamInputToISO("2026-02-30T01:30"), null);
  assert.equal(f.utils.codVietnamInputToISO("2026-10-14T25:30"), null);
});

test("activity log describes COD receipts and amounts without rendering raw backend actions", async () => {
  const f = fixture();
  await f.patch(f.input);
  const activity = f.activity.formatAdminActivity(f.audits[0], "Store admin", { label: "COD order", href: null });
  assert.equal(activity.activity, "Recorded COD collection");
  assert.equal(activity.result, "Completed");
  assert.ok(activity.changes.some((change) => change.label === "Receipt amount"));
  assert.ok(activity.changes.some((change) => change.label === "Collected by" && change.after === "Carrier"));
  assert.doesNotMatch(JSON.stringify(activity), /COD_COLLECTION_RECORDED|private-original-reference/);
});
