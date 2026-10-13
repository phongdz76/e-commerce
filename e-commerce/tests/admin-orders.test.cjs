const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function fixture() {
  const orders = Array.from({ length: 15 }, (_, index) => ({
    id: index.toString(16).padStart(24, "0"),
    amount: 2000,
    currency: "vnd",
    status: index === 14 ? "paid" : index === 13 ? "processing" : "pending",
    paymentMethod: index < 11 ? "COD" : index === 14 ? "STRIPE" : "MOMO",
    deliveryStatus: "pending",
    createDate: new Date(`2026-10-${String(index + 1).padStart(2, "0")}T00:00:00Z`),
    recipientName: "Recipient",
    recipientPhone: "0900000000",
    address: { line1: "Saved address", line2: null, city: "", state: "", postal_code: "", country: "VN" },
    products: [{ id: "a".repeat(24), name: "Saved product name", quantity: 2, price: 1000, category: "Phone", brand: "Brand", selectedImg: { color: "Black", image: "https://res.cloudinary.com/shop/image/upload/saved-product.jpg" } }],
    user: { name: "Customer", email: "customer@example.com", hashedPassword: "private-password", resetPasswordToken: "private-reset-token" },
    paymentIntentId: "private-payment-reference",
    paymentUrl: "private-payment-url",
    activePaymentAttemptId: "private-attempt-id",
  })).reverse();
  const state = { user: { role: "ADMIN" }, offline: false };
  const queries = [];
  const match = (where, order) =>
    (!where.status || where.status.in.includes(order.status)) &&
    (!where.paymentMethod || where.paymentMethod === order.paymentMethod);
  const prisma = {
    order: {
      findMany: async (options) => {
        queries.push({ type: "list", options });
        if (state.offline) throw new Error("private-db-credentials");
        return orders.filter((order) => match(options.where, order)).slice(options.skip, options.skip + options.take);
      },
      count: async (options) => {
        queries.push({ type: "count", options });
        return orders.filter((order) => match(options.where, order)).length;
      },
      findUnique: async (options) => {
        queries.push({ type: "detail", options });
        if (state.offline) throw new Error("private-db-credentials");
        return orders.find((order) => order.id === options.where.id) || null;
      },
    },
  };
  const cache = new Map();
  const mocks = {
    "@/libs/prismadb": { __esModule: true, default: prisma },
    "@/actions/getCurrentUser": { getCurrentUser: async () => state.user },
    "next/server": { NextResponse: { json: Response.json } },
  };
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
  const list = load("app/api/admin/orders/route.ts").GET;
  const detail = load("app/api/admin/orders/[orderId]/route.ts").GET;
  return {
    state, queries, orders,
    list: (query = "") => list(new Request(`http://localhost/api/admin/orders${query}`)),
    detail: (id) => detail(new Request("http://localhost/api/admin/orders/detail"), { params: Promise.resolve({ orderId: id }) }),
    display: load("utils/adminOrders.ts"),
  };
}

test("both admin order endpoints reject anonymous and customer sessions before querying orders", async () => {
  const f = fixture();
  for (const user of [null, { role: "USER" }]) {
    f.state.user = user;
    assert.equal((await f.list()).status, user ? 403 : 401);
    assert.equal((await f.detail("a".repeat(24))).status, user ? 403 : 401);
  }
  assert.equal(f.queries.length, 0);
});

test("pending queue counts orders including COD and processing, with 10 rows per page", async () => {
  const f = fixture();
  const first = await f.list("?status=PENDING");
  const data = await first.json();
  assert.equal(data.total, 14);
  assert.equal(data.totalPages, 2);
  assert.equal(data.pageSize, 10);
  assert.equal(data.orders.length, 10);
  assert.equal(data.hasMore, true);
  assert.ok(data.orders.some((order) => order.paymentMethod === "COD"));
  assert.ok(data.orders.some((order) => order.status === "processing"));
  assert.ok(data.orders.every((order) => ["pending", "processing"].includes(order.status)));
  assert.equal(first.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(f.queries[0].options.where, f.queries[1].options.where);
  const second = await (await f.list("?status=PENDING&page=2")).json();
  assert.equal(second.orders.length, 4);
  assert.equal(second.hasMore, false);
  assert.ok(second.orders.every((order) => !data.orders.some((other) => other.id === order.id)));
  assert.equal(f.queries[2].options.skip, 10);
});

test("all orders and payment method filters use stored Order records without requiring payment attempts", async () => {
  const f = fixture();
  assert.equal((await (await f.list()).json()).total, 15);
  const data = await (await f.list("?status=PENDING&method=COD")).json();
  assert.equal(data.total, 11);
  assert.ok(data.orders.every((order) => order.paymentMethod === "COD"));
});

test("paid filter includes legacy confirmed statuses and excludes pending orders", async () => {
  const f = fixture();
  f.orders[1].status = "complete";
  f.orders[2].status = "done";
  const data = await (await f.list("?status=PAID")).json();
  assert.equal(data.total, 3);
  assert.ok(data.orders.every((order) => ["paid", "complete", "done"].includes(order.status)));
});

test("invalid filter and pagination values are rejected before database access", async () => {
  const f = fixture();
  for (const query of ["?page=0", "?page=-1", "?page=1.5", "?page=1001", "?page=NaN", "?status=REVIEW", "?method=constructor", `?search=${"x".repeat(81)}`]) {
    assert.equal((await f.list(query)).status, 400, query);
  }
  assert.equal(f.queries.length, 0);
});

test("search is applied on the server before pagination with safe exact ObjectId lookup", async () => {
  const f = fixture();
  await f.list(`?search=${"A".repeat(24)}&status=PENDING&page=2`);
  const where = f.queries[0].options.where;
  assert.deepEqual(where.status, { in: ["pending", "processing"] });
  assert.deepEqual(where.OR.at(-1), { id: "a".repeat(24) });
  assert.deepEqual(where.OR[2], { user: { is: { name: { contains: "A".repeat(24), mode: "insensitive" } } } });
  assert.deepEqual(where, f.queries[1].options.where);
  f.queries.length = 0;
  await f.list("?search=customer@example.com");
  assert.ok(!f.queries[0].options.where.OR.some((condition) => "id" in condition));
});

test("order responses allowlist business fields and omit authentication/payment internals", async () => {
  const f = fixture();
  const list = await f.list();
  const detail = await f.detail(f.orders[0].id);
  for (const response of [list, detail]) {
    const json = await response.text();
    assert.ok(!json.includes("private-"));
    assert.ok(!json.includes("hashedPassword"));
    assert.ok(!json.includes("paymentIntentId"));
    assert.ok(!json.includes("paymentUrl"));
  }
  assert.deepEqual(f.queries[0].options.select.user, { select: { name: true, email: true } });
});

test("details preserve saved product price and delivery snapshot without mutation or provider queries", async () => {
  const f = fixture();
  const order = f.orders[0];
  const data = await (await f.detail(order.id)).json();
  assert.equal(data.products[0].name, "Saved product name");
  assert.equal(data.products[0].price, 1000);
  assert.equal(data.products[0].quantity, 2);
  assert.equal(data.products[0].image, order.products[0].selectedImg.image);
  assert.equal(data.itemCount, 2);
  assert.equal(data.address.line1, "Saved address");
  assert.equal(data.recipientPhone, "0900000000");
  assert.equal(data.createDate, order.createDate.toISOString());
  assert.equal(f.queries.length, 1);
});

test("invalid order IDs and missing orders have distinct errors", async () => {
  const f = fixture();
  assert.equal((await f.detail("invalid")).status, 400);
  assert.equal(f.queries.length, 0);
  assert.equal((await f.detail("f".repeat(24))).status, 404);
});

test("empty queues return zero and database errors do not masquerade as empty queues", async () => {
  const f = fixture();
  const data = await (await f.list("?status=FAILED")).json();
  assert.equal(data.total, 0);
  assert.deepEqual(data.orders, []);
  f.state.offline = true;
  for (const response of [await f.list(), await f.detail(f.orders[0].id)]) {
    assert.equal(response.status, 503);
    assert.ok(!(await response.text()).includes("private-db-credentials"));
  }
});

test("display keeps unknown states neutral, uses order currency and Vietnam timezone", () => {
  const f = fixture();
  assert.equal(f.display.getAdminOrderStatus("complete").label, "Paid");
  assert.equal(f.display.getAdminOrderStatus("provider_private_state").label, "Status unconfirmed");
  assert.equal(f.display.getAdminDeliveryLabel(null), "Not recorded");
  assert.equal(f.display.getAdminDeliveryLabel("unexpected"), "Status unconfirmed");
  assert.match(f.display.formatAdminOrderAmount(20, "usd"), /20\.00/);
  assert.match(f.display.formatAdminOrderDate("2026-10-01T20:00:00Z"), /02 Oct 2026/);
});
