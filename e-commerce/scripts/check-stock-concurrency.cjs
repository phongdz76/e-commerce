/* Real MongoDB transactions in a disposable database. Never uses the configured app database. */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const ts = require("typescript");
const { PrismaClient } = require("@prisma/client");
const { randomUUID } = require("node:crypto");
const appDirectory = path.resolve(__dirname, "..");
require("@next/env").loadEnvConfig(appDirectory);

async function main() {
  const database = "sgtech_stock_qa_" + Date.now() + "_" + randomUUID().slice(0, 8);
  const connection = new URL(process.env.DATABASE_URL);
  const originalDatabase = connection.pathname;
  connection.pathname = "/" + database;
  assert.notEqual(connection.pathname, originalDatabase);
  assert.match(database, /^sgtech_stock_qa_\d+_[a-f0-9-]+$/);
  const prisma = new PrismaClient({ datasources: { db: { url: connection.toString() } } });
  const mocks = { "@/libs/prismadb": { __esModule: true, default: prisma }, "next/server": { NextResponse: { json: Response.json } } };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const filename = path.join(appDirectory, file);
    const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const loaded = { exports: {} };
    vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename })(
      (name) => name in mocks ? mocks[name] : name.startsWith("@/") ? load(name.slice(2) + ".ts") : require(name), loaded, loaded.exports,
    ); cache.set(file, loaded.exports); return loaded.exports;
  }
  const checks = [];
  try {
    // Create collections ahead of transactions, including their real unique-reference index.
    for (const name of ["User", "Category", "Brand", "Product", "ProductVariant", "Order", "PaymentAttempt", "CheckoutRequest", "AuditLog", "PaymentException", "ShippingPolicy"]) await prisma.$runCommandRaw({ create: name });
    await prisma.shippingPolicy.create({ data: { id: "default", version: 1, label: "QA stock pricing", enabled: true, fee: 0, freeShippingThreshold: null, nationwide: true, provinceCodes: [] } });
    await prisma.$runCommandRaw({ createIndexes: "Order", indexes: [{ key: { paymentIntentId: 1 }, name: "Order_paymentIntentId_key", unique: true }] });
    const users = await Promise.all([0, 1].map((index) => prisma.user.create({ data: { name: "Stock QA " + index, email: "stock-qa-" + index + "@example.invalid" } })));
    const category = await prisma.category.create({ data: { name: "Phone", slug: "stock-qa" } });
    const brand = await prisma.brand.create({ data: { name: "QA", slug: "stock-qa" } });
    const product = await prisma.product.create({ data: { name: "Stock QA phone", slug: "stock-qa", description: "Temporary concurrency test product", status: "ACTIVE", categoryId: category.id, brandId: brand.id } });
    const variant = await prisma.productVariant.create({ data: { productId: product.id, sku: "QA-LAST-UNIT", name: "Black", price: 100000, inStock: true,
      image: { color: "Black", colorCode: "#000000", image: "https://res.cloudinary.com/demo/image/upload/sample.jpg" },
      inventory: { onHand: 1, reserved: 0, version: 1, updatedAt: new Date() } } });
    const items = load("libs/orderItems.ts");
    const checkout = load("libs/checkoutRequest.ts");
    const stock = load("libs/orderStock.ts");
    const input = [{ id: product.id, variantId: variant.id, quantity: 1, price: variant.price }];
    const delivery = { recipientName: "Stock QA", recipientPhone: "0900000000", address: { line1: "QA address", city: "QA city", country: "VN", postal_code: "", state: "" } };
    const cart = await items.getOrderItems(input);
    const prepare = checkout.prepareCheckoutRequest;
    checkout.prepareCheckoutRequest = async (key, userId, method, selectedCart, selectedDelivery, merchant, options) => {
      const address = { ...(selectedDelivery || delivery), address: { ...(selectedDelivery || delivery).address, provinceCode: "79" } };
      const quote = await load("libs/checkoutQuote.ts").createCheckoutQuote(userId, selectedCart, address);
      return prepare(key, userId, method, selectedCart, address, merchant, options, quote.token);
    };
    const clearHold = async (order) => stock.withStockTransaction(async (tx) => { const current = await tx.order.findUnique({ where: { id: order.id } }); await stock.releaseOrderStock(tx, current, current.userId, "Disposable fixture cleanup before the next isolated check."); });
    for (let index = 0; index < 10; index++) {
      const contenders = await Promise.allSettled(users.map((user) => checkout.prepareCheckoutRequest(randomUUID(), user.id, "COD", cart, delivery)));
      const winners = contenders.filter((result) => result.status === "fulfilled");
      const losers = contenders.filter((result) => result.status === "rejected");
      assert.equal(winners.length, 1); assert.equal(losers.length, 1); assert.equal(losers[0].reason.code, "STOCK_UNAVAILABLE");
      const balance = await prisma.productVariant.findUnique({ where: { id: variant.id } });
      assert.equal(balance.inventory.onHand, 1); assert.equal(balance.inventory.reserved, 1);
      await clearHold(winners[0].value.order);
    }
    checks.push("ten simultaneous last-unit races: exactly one winner each");
    const key = randomUUID();
    const duplicates = await Promise.all(Array.from({ length: 6 }, () => checkout.prepareCheckoutRequest(key, users[0].id, "COD", cart, delivery)));
    assert.equal(new Set(duplicates.map((result) => result.order.id)).size, 1);
    assert.equal((await prisma.productVariant.findUnique({ where: { id: variant.id } })).inventory.reserved, 1);
    const duplicateOrder = duplicates[0].order;
    await stock.cancelUnpaidCodStock(duplicateOrder.id, users[0].id, 1, "Customer cancelled the duplicate-request test order.");
    await stock.cancelUnpaidCodStock(duplicateOrder.id, users[0].id, 1, "Customer cancelled the duplicate-request test order.");
    assert.equal((await prisma.productVariant.findUnique({ where: { id: variant.id } })).inventory.reserved, 0);
    checks.push("six identical requests reserve once; repeated COD cancellation releases once");
    const empty = await prisma.productVariant.create({ data: { productId: product.id, sku: "QA-EMPTY", name: "White", price: 120000, inStock: true,
      image: { color: "White", colorCode: "#ffffff", image: variant.image.image }, inventory: { onHand: 0, reserved: 0, version: 1, updatedAt: new Date() } } });
    const mixed = await items.getOrderItems([...input, { id: product.id, variantId: empty.id, quantity: 1, price: empty.price }]);
    const countBefore = await prisma.order.count();
    await assert.rejects(checkout.prepareCheckoutRequest(randomUUID(), users[0].id, "COD", mixed, delivery), (error) => error.code === "STOCK_UNAVAILABLE");
    assert.equal(await prisma.order.count(), countBefore);
    assert.equal((await prisma.productVariant.findUnique({ where: { id: variant.id } })).inventory.reserved, 0);
    checks.push("multi-SKU failure rolls back every hold and creates no partial order");
    for (const method of ["COD", "VNPAY", "MOMO", "STRIPE", "ZALOPAY"]) {
      const created = await checkout.prepareCheckoutRequest(randomUUID(), users[0].id, method, cart, method === "STRIPE" ? null : delivery);
      assert.equal(created.order.stockReservation.state, "HELD");
      await assert.rejects(checkout.prepareCheckoutRequest(randomUUID(), users[1].id, method, cart, method === "STRIPE" ? null : delivery), (error) => error.code === "STOCK_UNAVAILABLE");
      await clearHold(created.order);
    }
    checks.push("all five payment methods require a hold before provider preparation");
    const dispatched = await checkout.prepareCheckoutRequest(randomUUID(), users[0].id, "COD", cart, delivery);
    await Promise.all([0, 1].map(() => stock.withStockTransaction(async (tx) => { const order = await tx.order.findUnique({ where: { id: dispatched.order.id } }); await stock.consumeOrderStock(tx, order, users[0].id); })));
    const afterDispatch = await prisma.productVariant.findUnique({ where: { id: variant.id } });
    assert.equal(afterDispatch.inventory.onHand, 0); assert.equal(afterDispatch.inventory.reserved, 0);
    assert.equal(await prisma.auditLog.count({ where: { action: "STOCK_DISPATCHED", entityId: variant.id } }), 1);
    checks.push("concurrent dispatch deducts physical stock exactly once");
    await prisma.productVariant.update({ where: { id: variant.id }, data: { inventory: { set: { onHand: 1, reserved: 0, version: afterDispatch.inventory.version + 1, updatedAt: new Date() } } } });
    const expiring = await checkout.prepareCheckoutRequest(randomUUID(), users[0].id, "COD", cart, delivery);
    await prisma.order.update({ where: { id: expiring.order.id }, data: { stockReservation: { set: { ...expiring.order.stockReservation, expiresAt: new Date(Date.now() - 1000) } } } });
    assert.equal(await stock.expireUnconfirmedCodStock(), 1);
    assert.equal(await stock.expireUnconfirmedCodStock(), 0);
    assert.equal((await prisma.productVariant.findUnique({ where: { id: variant.id } })).inventory.reserved, 0);
    checks.push("expired unprepared COD order releases once");
    const late = await checkout.prepareCheckoutRequest(randomUUID(), users[0].id, "VNPAY", cart, delivery);
    await prisma.order.update({ where: { id: late.order.id }, data: { status: "failed", paymentExpiresAt: new Date(Date.now() - 1000) } });
    await prisma.paymentAttempt.update({ where: { id: late.attempt.id }, data: { state: "FAILED", failureVerifiedAt: new Date() } });
    await stock.releaseVerifiedFailedStock(late.order.id, late.attempt.id);
    assert.equal((await prisma.productVariant.findUnique({ where: { id: variant.id } })).inventory.reserved, 0);
    await prisma.order.update({ where: { id: late.order.id }, data: { status: "paid" } });
    await stock.reviewPaidReleasedStock(late.order.id);
    assert.equal(await prisma.paymentException.count({ where: { orderId: late.order.id, reason: "STOCK_RELEASED_PAYMENT" } }), 1);
    await assert.rejects(stock.withStockTransaction(async (tx) => stock.consumeOrderStock(tx, await tx.order.findUnique({ where: { id: late.order.id } }), users[0].id)), (error) => error.code === "STOCK_REVIEW_REQUIRED");
    checks.push("late payment after release is reviewed and cannot consume someone else's stock");
    await fs.promises.mkdir(path.join(appDirectory, ".artifacts"), { recursive: true });
    await fs.promises.writeFile(path.join(appDirectory, ".artifacts/stock-concurrency-mongo-results.json"), JSON.stringify({ checks, disposableDatabase: true, applicationDatabaseWrites: 0, paymentProviderCalls: 0 }, null, 2));
    console.log("MongoDB stock concurrency passed: " + checks.length + " checks, including ten last-unit races.");
  } finally {
    // Refuse cleanup unless this client was configured for our exact generated QA database.
    assert.equal(connection.pathname, "/" + database);
    assert.match(database, /^sgtech_stock_qa_\d+_[a-f0-9-]+$/);
    await prisma.$runCommandRaw({ dropDatabase: 1 });
    await prisma.$disconnect();
  }
}
main().catch((error) => { console.error("Stock concurrency QA failed (code):", error.code || error.name); if (["AssertionError", "PrismaClientValidationError"].includes(error.name)) console.error(error.message.replace(/mongodb(?:\+srv)?:\/\/[^\s'"`]+/g, "[REDACTED]")); process.exitCode = 1; });
