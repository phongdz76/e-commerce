const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, "..", file);
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const loadedModule = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })(
    (name) => name in mocks ? mocks[name] : name.startsWith("@/") ? load(name.slice(2) + ".ts", mocks) : require(name),
    loadedModule, loadedModule.exports,
  );
  return loadedModule.exports;
}

test("activity presentation describes business changes without exposing unknown log payloads or raw actions", () => {
  const helper = load("libs/adminActivity.ts");
  const log = { id: "record", action: "PRODUCT_UPDATED", entityType: "PRODUCT", status: "SUCCEEDED", createdAt: new Date(), details: {
    before: { name: "Old name", variants: [{ sku: "PHONE-BLACK", price: 1000 }] },
    after: { name: "New name", variants: [{ sku: "PHONE-BLACK", price: 2000 }] },
    actorId: "private-actor", stack: "private-stack", token: "private-token",
  } };
  const output = helper.formatAdminActivity(log, "Administrator", { label: "New name", href: null });
  assert.equal(output.activity, "Updated product");
  assert.equal(output.result, "Completed");
  assert.equal(output.changes[0].before, "Old name");
  assert.equal(output.changes[0].after, "New name");
  assert.ok(output.changes.some((change) => change.label.includes("PHONE-BLACK")));
  assert.doesNotMatch(JSON.stringify(output), /private|PRODUCT_UPDATED|actorId|stack|token/);
});

test("completed payment check remains unconfirmed and unfinished activity is not labelled running", () => {
  const helper = load("libs/adminActivity.ts");
  const log = { id: "record", action: "PAYMENT_RECONCILED", entityType: "ORDER", status: "SUCCEEDED", createdAt: new Date(), details: { state: "UNKNOWN" } };
  const output = helper.formatAdminActivity(log, "Administrator", { label: "Order", href: null });
  assert.equal(output.result, "Completed");
  assert.equal(output.summary, "Payment status: Status unconfirmed");
  assert.equal(helper.formatAdminActivity({ ...log, status: "STARTED" }, "Administrator", { label: "Order", href: null }).result, "Outcome not recorded");
});

test("monthly, quarterly and yearly ranges use Vietnam midnight, including future years", () => {
  const { getAdminSalesFilters } = load("utils/adminReports.ts");
  const quarter = getAdminSalesFilters(new URLSearchParams("period=QUARTER&year=2027&quarter=4"));
  assert.equal(quarter.start.toISOString(), "2027-09-30T17:00:00.000Z");
  assert.equal(quarter.end.toISOString(), "2027-12-31T17:00:00.000Z");
  const year = getAdminSalesFilters(new URLSearchParams("period=YEAR&year=2028"));
  assert.equal(year.start.toISOString(), "2027-12-31T17:00:00.000Z");
  assert.equal(year.end.toISOString(), "2028-12-31T17:00:00.000Z");
  for (const query of ["month=13", "quarter=0", "year=1999", "year=2101", "page=1001", "sort=constructor"]) {
    assert.equal(getAdminSalesFilters(new URLSearchParams(query)), null);
  }
});

function salesFixture() {
  const state = { user: { role: "ADMIN" }, offline: false };
  const queries = [];
  const row = { id: "a".repeat(24), name: "Saved name", category: "Phone", brand: "Brand", image: "/products/phone.webp", unitsSold: 7, revenue: 7000, orderCount: 3, privateToken: "must-not-leak" };
  const mocks = {
    "@/actions/getCurrentUser": { getCurrentUser: async () => state.user },
    "@/libs/paymentStatus": { PAID_ORDER_STATUSES: ["paid", "complete", "done"] },
    "@/libs/prismadb": { __esModule: true, default: {
      order: { aggregateRaw: async (options) => {
        queries.push(options);
        if (state.offline) throw new Error("private-db-password");
        return [{ products: state.empty ? [] : [row], totals: state.empty ? [] : [{ count: 1 }] }];
      } },
      product: { findMany: async () => [{ id: row.id, name: "Current catalog name" }] },
    } },
    "next/server": { NextResponse: { json: Response.json } },
  };
  const handler = load("app/api/admin/sales/route.ts", mocks).GET;
  return { state, row, queries, get: (query = "") => handler(new Request("http://localhost/api/admin/sales" + query)) };
}

test("sales API rejects unauthorized sessions and invalid filters before aggregation", async () => {
  const f = salesFixture();
  f.state.user = null;
  assert.equal((await f.get()).status, 401);
  f.state.user = { role: "USER" };
  assert.equal((await f.get()).status, 403);
  f.state.user.role = "ADMIN";
  assert.equal((await f.get("?year=bad")).status, 400);
  assert.equal(f.queries.length, 0);
});

test("sales query uses paid-order snapshots, distinct order counts, full aggregation and ranked pagination", async () => {
  const f = salesFixture();
  const response = await f.get("?period=YEAR&year=2027&sort=REVENUE&page=2");
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.products[0].name, "Current catalog name");
  assert.equal(data.products[0].revenue, 7000);
  assert.equal(data.products[0].image, "/products/phone.webp");
  assert.equal(data.products[0].privateToken, undefined);
  const pipeline = f.queries[0].pipeline;
  assert.deepEqual(pipeline[0].$match.status, { $in: ["paid", "complete", "done"] });
  assert.equal(pipeline[0].$match.createDate.$gte.$date, "2026-12-31T17:00:00.000Z");
  assert.deepEqual(pipeline.find((stage) => stage.$group).$group.orderIds, { $addToSet: "$_id" });
  assert.deepEqual(pipeline.find((stage) => stage.$group).$group.revenue, { $sum: { $multiply: ["$products.quantity", "$products.price"] } });
  assert.deepEqual(pipeline.at(-1).$facet.products, [{ $skip: 10 }, { $limit: 10 }]);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("empty sales stay empty, outages and malformed summaries do not become fake zero data", async () => {
  const f = salesFixture();
  f.state.empty = true;
  const data = await (await f.get("?period=ALL")).json();
  assert.equal(data.total, 0);
  assert.deepEqual(data.products, []);
  f.state.empty = false;
  f.row.unitsSold = "invalid";
  assert.equal((await f.get()).status, 503);
  f.state.offline = true;
  const response = await f.get();
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private|password/);
});

test("storefront names, prices, options and availability come from the current database catalog", async () => {
  const original = [{ id: "a".repeat(24), name: "Original", price: 1000, reviews: [], images: [], inStock: true }];
  let name = "Updated name";
  const queries = [];
  const getStorefrontProducts = load("libs/storefrontProductNames.ts", {
    "@/utils/products": { products: original },
    "@/libs/prismadb": { __esModule: true, default: { product: { findMany: async (options) => {
      queries.push(options);
      return [{ id: original[0].id, name, description: "Database description", category: { name: "Phone" }, brand: { name: "Brand" },
        variants: [{ id: "b".repeat(24), sku: "DB-SKU", name: "Black", price: 2000, inStock: true,
          image: { color: "Black", colorCode: "#000000", image: "/products/phone.webp" }, inventory: { onHand: 3, reserved: 2, version: 1, updatedAt: new Date() } }] }];
    } } } },
  }).getStorefrontProducts;
  assert.equal((await getStorefrontProducts())[0].name, "Updated name");
  name = "Another name";
  const products = await getStorefrontProducts();
  assert.equal(products[0].name, name);
  assert.equal(products[0].price, 2000);
  assert.equal(products[0].variants[0].available, 1);
  assert.equal(products[0].variants[0].sku, "DB-SKU");
  assert.equal(queries[0].where.status, "ACTIVE");
  assert.equal(original[0].name, "Original");
});
