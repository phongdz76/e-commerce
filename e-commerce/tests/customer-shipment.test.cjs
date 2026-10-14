const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function fixture() {
  const orderId = "a".repeat(24);
  const ownerId = "b".repeat(24);
  const state = {
    user: { id: ownerId, role: "USER" },
    offline: false,
    historyOffline: false,
    order: {
      id: orderId,
      userId: ownerId,
      deliveryStatus: "in_transit",
      shippingInfo: {
        carrier: "Store carrier",
        trackingNumber: "SG-123/ABC",
        note: "private-shipping-note",
        version: 7,
        updatedAt: new Date("2026-10-14T01:00:00Z"),
      },
      status: "pending",
      amount: 123000,
      paymentMethod: "COD",
      recipientPhone: "private-phone",
      paymentIntentId: "private-payment-reference",
      user: { hashedPassword: "private-password" },
    },
    logs: [],
  };
  function log(overrides = {}) {
    return {
      id: "c".repeat(24),
      entityType: "ORDER",
      entityId: orderId,
      action: "SHIPMENT_UPDATED",
      status: "SUCCEEDED",
      actorId: "private-staff-id",
      createdAt: new Date("2026-10-14T00:00:00Z"),
      details: {
        before: { deliveryStatus: "shipped", carrier: "Store carrier", trackingNumber: "SG-123/ABC", note: "private-old-note" },
        after: { deliveryStatus: "in_transit", carrier: "Store carrier", trackingNumber: "SG-123/ABC", note: "private-new-note" },
        token: "private-token",
      },
      ...overrides,
    };
  }
  state.logs = [log()];
  const queries = [];
  const prisma = {
    order: {
      findFirst: async (options) => {
        queries.push({ type: "order", options });
        if (state.offline) throw new Error("private-database-credentials");
        const order = state.order;
        return order && order.id === options.where.id &&
          (!options.where.userId || order.userId === options.where.userId) ? order : null;
      },
    },
    auditLog: {
      findMany: async (options) => {
        queries.push({ type: "history", options });
        if (state.historyOffline) throw new Error("private-history-error");
        return state.logs
          .filter((log) => Object.entries(options.where).every(([key, value]) => log[key] === value))
          .sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id))
          .slice(0, options.take);
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
  const route = load("app/api/order/[orderId]/shipment/route.ts").GET;
  return {
    state, queries, log, orderId,
    get: (id = orderId) => route(new Request(`http://localhost/api/order/${id}/shipment`), {
      params: Promise.resolve({ orderId: id }),
    }),
    display: load("utils/orderShipment.ts"),
    serializer: load("libs/customerShipment.ts"),
  };
}

test("anonymous shipment lookup performs no database or provider work", async () => {
  const f = fixture();
  f.state.user = null;
  const response = await f.get();
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(f.queries.length, 0);
});

test("invalid IDs are rejected before order lookup and uppercase ObjectIds are normalized", async () => {
  const f = fixture();
  for (const id of ["invalid", "", "1".repeat(25), "../admin", "constructor"]) {
    assert.equal((await f.get(id)).status, 400);
  }
  assert.equal(f.queries.length, 0);
  assert.equal((await f.get(f.orderId.toUpperCase())).status, 200);
  assert.equal(f.queries[0].options.where.id, f.orderId);
});

test("other customers and missing orders have the same response without querying history", async () => {
  const f = fixture();
  f.state.user.id = "d".repeat(24);
  const other = await f.get();
  const missing = await f.get("e".repeat(24));
  assert.equal(other.status, 404);
  assert.equal(missing.status, 404);
  assert.deepEqual(await other.json(), await missing.json());
  assert.ok(f.queries.every((query) => query.type === "order"));
  assert.equal(f.queries[0].options.where.userId, f.state.user.id);
});

test("admins may inspect a customer's shipment but still receive the public projection", async () => {
  const f = fixture();
  f.state.user = { id: "d".repeat(24), role: "ADMIN" };
  const response = await f.get();
  assert.equal(response.status, 200);
  assert.equal(f.queries[0].options.where.userId, undefined);
  assert.doesNotMatch(JSON.stringify(await response.json()), /private|note|actor|version|payment|recipient|amount/);
});

test("shipment DTO exposes only tracking fields and confirmed customer events", async () => {
  const f = fixture();
  const response = await f.get();
  const data = await response.json();
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(Object.keys(data).sort(), ["deliveryStatus", "carrier", "trackingNumber", "updatedAt", "history", "historyTruncated"].sort());
  assert.equal(data.deliveryStatus, "in_transit");
  assert.equal(data.carrier, "Store carrier");
  assert.equal(data.trackingNumber, "SG-123/ABC");
  assert.equal(data.updatedAt, "2026-10-14T01:00:00.000Z");
  assert.equal(data.history[0].recordedAt, "2026-10-14T00:00:00.000Z");
  assert.doesNotMatch(JSON.stringify(data), /private|note|actor|version|payment|recipient|amount/);
  assert.deepEqual(f.queries[0].options.select.shippingInfo.select, { carrier: true, trackingNumber: true, updatedAt: true });
});

test("failed, unfinished and unrelated audit actions never appear as shipping events", async () => {
  const f = fixture();
  f.state.logs.push(...["FAILED", "STARTED", "UNKNOWN"].map((status) => f.log({ status })));
  f.state.logs.push(f.log({ entityId: "d".repeat(24) }), f.log({ entityType: "USER" }), f.log({ action: "PAYMENT_UPDATED" }));
  const data = await (await f.get()).json();
  assert.equal(data.history.length, 1);
  assert.deepEqual(f.queries[1].options.select, { details: true, createdAt: true });
  assert.equal(f.queries[1].options.where.status, "SUCCEEDED");
});

test("internal note changes and malformed payloads do not become customer events", async () => {
  const f = fixture();
  const details = {
    before: { deliveryStatus: "in_transit", carrier: "Store carrier", trackingNumber: "SG-123/ABC", note: "private-before" },
    after: { deliveryStatus: "in_transit", carrier: "Store carrier", trackingNumber: "SG-123/ABC", note: "private-after" },
  };
  f.state.logs = [f.log({ details }), ...[null, [], "secret", { after: {} }, { after: [] }].map((details) => f.log({ details }))];
  assert.deepEqual((await (await f.get()).json()).history, []);
  f.state.logs = [f.log({ details: { ...details, after: { ...details.after, trackingNumber: "SG-CORRECTED" } } })];
  assert.equal((await (await f.get()).json()).history[0].trackingNumber, "SG-CORRECTED");
});

test("legacy orders show absent tracking and history without inventing carrier, dates or milestones", async () => {
  const f = fixture();
  f.state.order.shippingInfo = null;
  f.state.order.deliveryStatus = null;
  f.state.logs = [];
  assert.deepEqual(await (await f.get()).json(), {
    deliveryStatus: "not_recorded", carrier: null, trackingNumber: null, updatedAt: null, history: [], historyTruncated: false,
  });
});

test("history is bounded, newest first, with a truthful truncation flag", async () => {
  const f = fixture();
  f.state.logs = Array.from({ length: 60 }, (_, index) => f.log({
    id: index.toString(16).padStart(24, "0"),
    createdAt: new Date(Date.UTC(2026, 9, 14, 0, index)),
  }));
  const data = await (await f.get()).json();
  assert.equal(data.history.length, 50);
  assert.equal(data.historyTruncated, true);
  assert.equal(f.queries[1].options.take, 51);
  assert.ok(data.history.every((event, index) => !index || event.recordedAt <= data.history[index - 1].recordedAt));
  f.state.logs = f.state.logs.slice(0, 50);
  assert.equal((await (await f.get()).json()).historyTruncated, false);
});

test("shipment reads leave COD money and online payment state untouched", async () => {
  const f = fixture();
  for (const method of ["COD", "STRIPE", "ZALOPAY", "MOMO", "VNPAY"]) {
    f.state.order.paymentMethod = method;
    f.state.order.deliveryStatus = "delivered";
    const before = JSON.stringify(f.state.order);
    assert.equal((await (await f.get()).json()).deliveryStatus, "delivered");
    assert.equal(JSON.stringify(f.state.order), before);
  }
  assert.ok(f.queries.every((query) => ["order", "history"].includes(query.type)));
});

test("database and history errors return a retryable error without leaking details or false empty history", async () => {
  const f = fixture();
  for (const errorFlag of ["offline", "historyOffline"]) {
    f.state[errorFlag] = true;
    const response = await f.get();
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.doesNotMatch(JSON.stringify(body), /private|credentials|history-error/);
    assert.equal(body.history, undefined);
    f.state[errorFlag] = false;
  }
});

test("delivery labels normalize legacy values and unknown statuses do not render raw database strings", () => {
  const { display } = fixture();
  assert.equal(display.normalizeCustomerDeliveryStatus(" DISPATCHED "), "shipped");
  assert.equal(display.normalizeCustomerDeliveryStatus("canceled"), "cancelled");
  assert.equal(display.getCustomerDeliveryInfo("READY_TO_SHIP").label, "Ready to ship");
  assert.equal(display.getCustomerDeliveryInfo("private-unknown").label, "Status unconfirmed");
  assert.equal(display.normalizeCustomerDeliveryStatus(null), "not_recorded");
  assert.equal(display.normalizeCustomerDeliveryStatus("constructor"), "unconfirmed");
  assert.equal(display.normalizeCustomerDeliveryStatus("__proto__"), "unconfirmed");
});

test("failed, returned, cancelled and unrecorded deliveries never show a completed progress path", () => {
  const { display } = fixture();
  for (const status of ["delivery_failed", "returned", "cancelled", "private-unknown", null]) {
    assert.equal(display.getCustomerDeliveryStep(status), -1);
  }
  assert.equal(display.getCustomerDeliveryStep("dispatched"), 3);
  assert.equal(display.getCustomerDeliveryStep("delivered"), 5);
});

test("shipping dates use Vietnam time across a UTC day boundary", () => {
  const { display } = fixture();
  assert.match(display.formatShipmentDate("2026-10-13T18:30:00Z"), /14 Oct 2026, 01:30/);
});
