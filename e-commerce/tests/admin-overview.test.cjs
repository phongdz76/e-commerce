const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function fixture() {
  const state = { user: { id: "owner", role: "ADMIN" }, offline: false };
  const queries = [];
  const orders = [
    { status: "paid", paymentMethod: "VNPAY", currency: "vnd", amount: 100000 },
    {
      status: "complete",
      paymentMethod: "STRIPE",
      currency: "vnd",
      amount: 80000,
    },
    {
      status: "pending",
      paymentMethod: "MOMO",
      currency: "vnd",
      amount: 50000,
    },
    {
      status: "failed",
      paymentMethod: "ZALOPAY",
      currency: "vnd",
      amount: 60000,
    },
    { status: "paid", paymentMethod: "COD", currency: "vnd", amount: 70000 },
    { status: "paid", paymentMethod: "STRIPE", currency: "usd", amount: 10 },
  ];
  const count = (name) => async (options) => {
    if (state.offline) throw new Error("private-database-credentials");
    queries.push({ name, options });
    return 2;
  };
  const prisma = {
    user: { count: count("user") },
    product: { count: count("product") },
    category: { count: count("category") },
    brand: { count: count("brand") },
    paymentAttempt: { count: count("attempt") },
    paymentException: { count: count("exception") },
    order: {
      count: count("order"),
      aggregate: async ({ where }) => {
        queries.push({ name: "revenue", where });
        const paid = orders.filter(
          (order) =>
            where.status.in.includes(order.status) &&
            where.paymentMethod.in.includes(order.paymentMethod) &&
            order.currency === where.currency,
        );
        return {
          _sum: { amount: paid.reduce((total, row) => total + row.amount, 0) },
          _count: { _all: paid.length },
        };
      },
    },
  };
  const mocks = {
    "@/libs/prismadb": { __esModule: true, default: prisma },
    "@/actions/getCurrentUser": { getCurrentUser: async () => state.user },
    "@/libs/paymentStatus": {
      PAID_ORDER_STATUSES: ["paid", "complete", "done"],
    },
    "@/libs/reconcilePayment": {
      ONLINE_PAYMENT_METHODS: ["VNPAY", "MOMO", "STRIPE", "ZALOPAY"],
    },
    "next/server": { NextResponse: { json: Response.json } },
  };
  const filename = path.join(
    __dirname,
    "..",
    "app/api/admin/overview/route.ts",
  );
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const loadedModule = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`, {
    filename,
  })(
    (name) => (name in mocks ? mocks[name] : require(name)),
    loadedModule,
    loadedModule.exports,
  );
  return { state, queries, get: loadedModule.exports.GET };
}

test("admin overview does not read data for anonymous or normal users", async () => {
  const f = fixture();
  f.state.user = null;
  assert.equal((await f.get()).status, 401);
  f.state.user = { id: "owner", role: "USER" };
  assert.equal((await f.get()).status, 403);
  assert.equal(f.queries.length, 0);
});

test("overview totals only confirmed online VND orders and returns counts without personal data", async () => {
  const f = fixture();
  const response = await f.get();
  assert.equal(response.status, 200);
  const overview = await response.json();
  assert.equal(overview.confirmedOnlineAmount, 180000);
  assert.equal(overview.confirmedOnlineOrders, 2);
  assert.equal(overview.users, 2);
  assert.equal(typeof overview.generatedAt, "string");
  assert.equal(
    f.queries.find((row) => row.name === "exception").options.where.status,
    "OPEN",
  );
  assert.deepEqual(
    f.queries.find((row) => row.name === "attempt").options.where.state.in,
    ["UNKNOWN", "REVIEW"],
  );
  assert.doesNotMatch(
    JSON.stringify(overview),
    /email|password|token|merchant/i,
  );
});

test("overview database outages return a generic error without partial or stale financial totals", async () => {
  const f = fixture();
  f.state.offline = true;
  const response = await f.get();
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.confirmedOnlineAmount, undefined);
  assert.doesNotMatch(JSON.stringify(body), /private|credentials/);
});
