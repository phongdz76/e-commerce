const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { randomUUID } = require("node:crypto");
const { installStockDatabase, matches } = require("./fixtures/stock-db.cjs");

function fixture() {
  const orders = new Map(), requests = new Map(), attempts = new Map(), exceptions = new Map(), intents = new Map();
  const state = { user: { id: "b".repeat(24), role: "USER" }, cancelCalls: 0, cancelResponseLost: false };
  const product = { id: "a".repeat(24), name: "Database phone", description: "Current database description", category: "Phone", brand: "QA", price: 100000, inStock: true,
    images: [{ color: "Black", colorCode: "#000000", image: "https://res.cloudinary.com/demo/image/upload/sample.jpg" }, { color: "White", colorCode: "#ffffff", image: "https://res.cloudinary.com/demo/image/upload/sample.jpg" }] };
  function model(rows) {
    return {
      findUnique: async ({ where }) => structuredClone([...rows.values()].find((row) => matches(row, where)) || null),
      findFirst: async ({ where }) => structuredClone([...rows.values()].find((row) => matches(row, where)) || null),
      findMany: async ({ where = {}, take = 100 } = {}) => structuredClone([...rows.values()].filter((row) => matches(row, where)).slice(0, take)),
      create: async ({ data }) => { if (rows.has(data.id)) throw Object.assign(new Error("Duplicate"), { code: "P2002" }); const row = { createDate: new Date(), merchantId: null, state: "CREATED", ...structuredClone(data) }; rows.set(row.id, row); return structuredClone(row); },
      updateMany: async ({ where, data }) => { let count = 0; for (const row of rows.values()) if (matches(row, where)) { for (const [field, value] of Object.entries(data)) row[field] = structuredClone(value && typeof value === "object" && "set" in value ? value.set : value); count++; } return { count }; },
      upsert: async ({ where, create }) => { if (!rows.has(where.id)) rows.set(where.id, structuredClone(create)); return structuredClone(rows.get(where.id)); },
    };
  }
  const prisma = { order: model(orders), checkoutRequest: model(requests), paymentAttempt: model(attempts), paymentException: model(exceptions) };
  const stockDb = installStockDatabase(prisma, [product], [orders, requests, attempts, exceptions]);
  const variant = [...stockDb.variants.values()][0];
  variant.inventory.onHand = 1;
  const stripe = { paymentIntents: {
    retrieve: async (id) => { if (state.providerOffline) throw new Error("private-provider-error"); return structuredClone(intents.get(id)); },
    cancel: async (id) => { state.cancelCalls++; const intent = intents.get(id); intent.status = "canceled"; if (state.cancelResponseLost) { state.cancelResponseLost = false; throw new Error("private-timeout-after-cancel"); } return structuredClone(intent); },
  } };
  const mocks = { "@/libs/prismadb": { __esModule: true, default: prisma }, "@/actions/getCurrentUser": { getCurrentUser: async () => state.user },
    "@/libs/stripe": { getStripe: () => stripe }, "./stripe": { getStripe: () => stripe }, "next/server": { NextResponse: { json: Response.json } } };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const filename = path.join(__dirname, "..", file);
    const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const loaded = { exports: {} }; cache.set(file, loaded.exports);
    vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename })(
      (name) => name in mocks ? mocks[name] : name.startsWith("@/") ? load(name.slice(2) + ".ts") : require(name), loaded, loaded.exports,
    ); return loaded.exports;
  }
  const delivery = { recipientName: "Buyer", recipientPhone: "0901234567", address: { line1: "Saved address", city: "HCM", country: "VN", postal_code: "", state: "" } };
  const input = [{ id: product.id, variantId: variant.id, price: variant.price, quantity: 1 }];
  const items = load("libs/orderItems.ts"), checkout = load("libs/checkoutRequest.ts"), stock = load("libs/orderStock.ts");
  const stockRoute = load("app/api/order/[orderId]/stock/route.ts"), cancelRoute = load("app/api/order/[orderId]/cancel/route.ts"), quoteRoute = load("app/api/cart/quote/route.ts");
  const req = (body) => new Request("http://localhost/api/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { state, product, get variant() { return stockDb.variants.get(variant.id); }, orders, attempts, exceptions, intents, stockDb, items, stock, checkout, input, delivery, prisma,
    create: async (method = "COD", key = randomUUID(), userId = state.user.id) => checkout.prepareCheckoutRequest(key, userId, method, await items.getOrderItems(input), method === "STRIPE" ? null : delivery),
    get: (id) => stockRoute.GET(new Request("http://localhost/api/order/stock"), { params: Promise.resolve({ orderId: id }) }),
    cancel: (id, body = { version: 1, confirmed: true, reason: "Customer requested cancellation" }) => cancelRoute.POST(req(body), { params: Promise.resolve({ orderId: id }) }),
    quote: (body = { items: input }) => quoteRoute.POST(req(body)),
    stripeOrder: async () => { const result = await checkout.prepareCheckoutRequest(randomUUID(), state.user.id, "STRIPE", await items.getOrderItems(input), null);
      orders.get(result.order.id).paymentIntentId = "pi_stock_fixture"; intents.set("pi_stock_fixture", { id: "pi_stock_fixture", amount: variant.price, currency: "vnd", status: "requires_payment_method", amount_received: 0 }); return orders.get(result.order.id); },
  };
}

test("last-unit contention accepts one buyer and leaves the losing checkout entirely uncreated", async () => {
  const f = fixture();
  const outcomes = await Promise.allSettled([f.create("COD", "buyer-one"), f.create("COD", "buyer-two", "c".repeat(24))]);
  assert.equal(outcomes.filter((row) => row.status === "fulfilled").length, 1);
  assert.equal(outcomes.find((row) => row.status === "rejected").reason.code, "STOCK_UNAVAILABLE");
  assert.equal(f.orders.size, 1); assert.equal(f.variant.inventory.reserved, 1); assert.equal(f.variant.inventory.onHand, 1);
});

test("duplicate checkout and COD cancellation apply their stock movement only once", async () => {
  const f = fixture();
  const results = await Promise.all([f.create("COD", "same-key"), f.create("COD", "same-key")]);
  assert.equal(results[0].order.id, results[1].order.id); assert.equal(f.variant.inventory.reserved, 1);
  assert.equal((await f.cancel(results[0].order.id)).status, 200);
  assert.equal((await f.cancel(results[0].order.id)).status, 200);
  assert.equal(f.variant.inventory.reserved, 0); assert.equal(f.variant.inventory.onHand, 1);
  assert.equal([...f.stockDb.audits.values()].filter((log) => log.action === "STOCK_RELEASED").length, 1);
});

test("multi-SKU carts either reserve every line or roll back completely", async () => {
  const f = fixture();
  const empty = [...f.stockDb.variants.values()][1]; empty.inventory.onHand = 0;
  const cart = await f.items.getOrderItems([...f.input, { id: f.product.id, variantId: empty.id, quantity: 1, price: empty.price }]);
  await assert.rejects(f.checkout.prepareCheckoutRequest("multi-sku", f.state.user.id, "COD", cart, f.delivery), (error) => error.code === "STOCK_UNAVAILABLE");
  assert.equal(f.variant.inventory.reserved, 0); assert.equal(f.orders.size, 0); assert.equal(f.stockDb.audits.size, 0);
});

test("SKU identity allows two colors independently, but rejects duplicate and foreign SKU lines", async () => {
  const f = fixture(); const white = [...f.stockDb.variants.values()][1];
  const cart = await f.items.getOrderItems([...f.input, { id: f.product.id, variantId: white.id, quantity: 1, price: white.price }]);
  assert.equal(cart.items.length, 2); assert.notEqual(cart.items[0].variantId, cart.items[1].variantId);
  assert.equal(await f.items.getOrderItems([...f.input, ...f.input]), null);
  await assert.rejects(f.items.getOrderItems([{ ...f.input[0], variantId: "f".repeat(24) }]), (error) => error.code === "SKU_UNAVAILABLE");
});

test("unverified, hidden and ambiguous legacy options cannot be booked", async () => {
  const f = fixture(); f.variant.inventory = null;
  await assert.rejects(f.create(), (error) => error.code === "STOCK_NOT_COUNTED");
  f.variant.inventory = { onHand: 1, reserved: 0, version: 1, updatedAt: new Date() }; f.variant.isActive = false;
  await assert.rejects(f.create(), (error) => error.code === "SKU_UNAVAILABLE");
  f.variant.isActive = true;
  const white = [...f.stockDb.variants.values()][1]; white.image.color = "Black";
  await assert.rejects(f.items.getOrderItems([{ id: f.product.id, quantity: 1, selectedImg: { color: "Black" } }]), (error) => error.code === "SKU_UNAVAILABLE");
});

test("changed client prices require confirmation and quote refresh uses server metadata without reserving", async () => {
  const f = fixture(); const stale = [{ ...f.input[0], price: 1, name: "Forged" }];
  await assert.rejects(f.items.getOrderItems(stale), (error) => error.code === "CHECKOUT_PRICE_CHANGED");
  const response = await f.quote({ items: stale }); assert.equal(response.status, 200);
  const body = await response.json(); assert.equal(body.amount, f.variant.price); assert.equal(body.items[0].name, f.product.name);
  assert.equal(body.items[0].sku, f.variant.sku); assert.equal(f.variant.inventory.reserved, 0); assert.equal(f.orders.size, 0);
});

test("stock APIs enforce ownership and never expose reservation lines, fingerprints or internal keys", async () => {
  const f = fixture(); const { order } = await f.create();
  const response = await f.get(order.id); const body = await response.json();
  assert.equal(body.state, "HELD"); assert.equal(body.canCancel, true); assert.equal(body.lines, undefined);
  f.state.user = { id: "d".repeat(24), role: "USER" };
  assert.equal((await f.get(order.id)).status, 404); assert.equal((await f.cancel(order.id)).status, 404);
  f.state.user = null; assert.equal((await f.get(order.id)).status, 401); assert.equal((await f.quote()).status, 401);
  assert.equal(f.variant.inventory.reserved, 1);
});

test("COD cancellation is locked after packing, payment, stale version and forged confirmation", async () => {
  for (const mutation of [{ deliveryStatus: "preparing" }, { status: "paid" }]) {
    const f = fixture(); const { order } = await f.create(); Object.assign(f.orders.get(order.id), mutation);
    assert.equal((await f.cancel(order.id)).status, 409); assert.equal(f.variant.inventory.reserved, 1);
  }
  const f = fixture(); const { order } = await f.create();
  assert.equal((await f.cancel(order.id, { version: 0, confirmed: true, reason: "Customer cancellation" })).status, 400);
  assert.equal((await f.cancel(order.id, { version: 2, confirmed: true, reason: "Customer cancellation" })).status, 409);
  assert.equal((await f.cancel(order.id, { version: 1, confirmed: "true", reason: "Customer cancellation" })).status, 400);
});

test("dispatch deducts on-hand and reserved units once and rolls back if shipment saving fails", async () => {
  const f = fixture(); const { order } = await f.create();
  await assert.rejects(f.stock.withStockTransaction(async (tx) => { await f.stock.consumeOrderStock(tx, await tx.order.findUnique({ where: { id: order.id } }), f.state.user.id); throw new Error("shipment write failed"); }));
  assert.equal(f.variant.inventory.onHand, 1); assert.equal(f.variant.inventory.reserved, 1);
  await f.stock.withStockTransaction(async (tx) => f.stock.consumeOrderStock(tx, await tx.order.findUnique({ where: { id: order.id } }), f.state.user.id));
  await f.stock.withStockTransaction(async (tx) => f.stock.consumeOrderStock(tx, await tx.order.findUnique({ where: { id: order.id } }), f.state.user.id));
  const current = f.stockDb.variants.get(f.variant.id); assert.equal(current.inventory.onHand, 0); assert.equal(current.inventory.reserved, 0);
});

test("unconfirmed online payments keep stock; expiry alone is insufficient evidence to release", async () => {
  const f = fixture(); const { order, attempt } = await f.create("VNPAY");
  Object.assign(f.orders.get(order.id), { status: "failed", paymentExpiresAt: new Date(Date.now() - 1000) });
  f.attempts.get(attempt.id).state = "UNKNOWN";
  await f.stock.releaseVerifiedFailedStock(order.id, attempt.id); assert.equal(f.variant.inventory.reserved, 1);
  Object.assign(f.attempts.get(attempt.id), { state: "FAILED", failureVerifiedAt: new Date() });
  await f.stock.releaseVerifiedFailedStock(order.id, attempt.id); assert.equal(f.variant.inventory.reserved, 0);
  assert.equal(f.variant.inventory.onHand, 1);
});

test("MoMo terminal failure queries release without an invented local expiry; unknown outcomes keep stock", async () => {
  for (const resultCode of ['1005', '1003', '7000', 'unknown']) {
    const f = fixture(); const { order, attempt } = await f.create('MOMO');
    Object.assign(f.orders.get(order.id), { status: 'failed', paymentExpiresAt: null });
    Object.assign(f.attempts.get(attempt.id), { state: 'FAILED', resultCode, failureVerifiedAt: new Date() });
    await f.stock.releaseVerifiedFailedStock(order.id, attempt.id);
    assert.equal(f.variant.inventory.reserved, ['1005', '1003'].includes(resultCode) ? 0 : 1);
  }
});

test("late money after release is recorded for review and cannot dispatch someone else's reserved stock", async () => {
  const f = fixture(); const { order } = await f.create(); await f.cancel(order.id);
  f.orders.get(order.id).status = "paid";
  await f.stock.reviewPaidReleasedStock(order.id); await f.stock.reviewPaidReleasedStock(order.id);
  assert.equal(f.exceptions.size, 1);
  await assert.rejects(f.stock.withStockTransaction(async (tx) => f.stock.consumeOrderStock(tx, await tx.order.findUnique({ where: { id: order.id } }), f.state.user.id)), (error) => error.code === "STOCK_REVIEW_REQUIRED");
  assert.equal(f.variant.inventory.onHand, 1);
});

test("Stripe cancellation verifies closure before releasing; lost cancellation responses recover safely", async () => {
  const f = fixture(); const order = await f.stripeOrder(); f.state.cancelResponseLost = true;
  assert.equal((await f.cancel(order.id)).status, 503); assert.equal(f.variant.inventory.reserved, 1);
  assert.equal((await f.cancel(order.id)).status, 200); assert.equal(f.variant.inventory.reserved, 0);
  assert.equal(f.state.cancelCalls, 1); assert.equal(f.orders.get(order.id).status, "cancelled");
});

test("processing, captured and paid Stripe intents cannot release stock via customer cancellation", async () => {
  for (const status of ["processing", "requires_capture", "succeeded", "requires_action"]) {
    const f = fixture(); const order = await f.stripeOrder(); f.intents.get("pi_stock_fixture").status = status;
    assert.equal((await f.cancel(order.id)).status, 409); assert.equal(f.variant.inventory.reserved, 1); assert.equal(f.state.cancelCalls, 0);
  }
});

test("COD expiry ignores preparation and paid orders while expiring an unprepared order once", async () => {
  for (const mutation of [{ deliveryStatus: "preparing" }, { status: "paid" }, {}]) {
    const f = fixture(); const { order } = await f.create(); const stored = f.orders.get(order.id);
    stored.stockReservation.expiresAt = new Date(Date.now() - 1000); Object.assign(stored, mutation);
    const shouldExpire = !Object.keys(mutation).length;
    assert.equal(await f.stock.expireUnconfirmedCodStock(), shouldExpire ? 1 : 0);
    assert.equal(await f.stock.expireUnconfirmedCodStock(), 0);
    assert.equal(f.variant.inventory.reserved, shouldExpire ? 0 : 1);
  }
});
