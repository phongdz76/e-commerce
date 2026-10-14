const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const ID = "a".repeat(24);
const KEY = "11111111-1111-4111-8111-111111111111";
const OTHER_KEY = "22222222-2222-4222-8222-222222222222";

function fixture() {
  const state = {
    user: { id: "b".repeat(24), role: "ADMIN" },
    variant: { id: ID, productId: "c".repeat(24), sku: "PHONE-BLACK", name: "Black / 256GB", isActive: true,
      inventory: null, updatedAt: new Date("2026-10-13T00:00:00Z"), product: { name: "Phone", status: "ACTIVE" },
      privateProviderToken: "private-token" },
    logs: [], auditFailure: false, ledgerFailure: false, ambiguousCommit: false, race: false, offline: false,
  };
  const calls = [];
  function matches(log, where) {
    return Object.entries(where).every(([key, value]) => {
      if (value && typeof value === "object") {
        if ("not" in value) return log[key] !== value.not;
        if ("in" in value) return value.in.includes(log[key]);
      }
      return log[key] === value;
    });
  }
  const prisma = {
    productVariant: {
      findUnique: async ({ where }) => { calls.push("read"); if (state.offline) throw new Error("private-db-secret"); return state.variant && state.variant.id === where.id ? structuredClone(state.variant) : null; },
      findMany: async (options) => { calls.push(options); return state.variant ? [structuredClone(state.variant)] : []; },
      count: async () => state.variant ? 1 : 0,
      updateMany: async ({ where, data }) => {
        calls.push({ where, data });
        if (state.race) return { count: 0 };
        const balance = state.variant.inventory;
        const expected = where.inventory?.is;
        const correct = expected ? balance && ["version", "onHand", "reserved"].every((field) => expected[field] === balance[field]) : balance == null && where.OR?.length === 2;
        if (!correct || where.updatedAt.getTime() !== state.variant.updatedAt.getTime()) return { count: 0 };
        state.variant.inventory = structuredClone(data.inventory.set);
        state.variant.updatedAt = new Date();
        return { count: 1 };
      },
    },
    auditLog: {
      findUnique: async ({ where }) => {
        const log = state.logs.find((row) => row.id === where.id);
        if (state.hideCommittedOnce && log?.status === "SUCCEEDED") {
          state.hideCommittedOnce = false;
          throw new Error("private-outcome-read-timeout");
        }
        return structuredClone(log || null);
      },
      create: async ({ data }) => {
        if (state.auditFailure) throw new Error("private-audit-secret");
        if (state.logs.some((log) => log.id === data.id)) throw Object.assign(new Error("duplicate"), { code: "P2002" });
        const log = { ...structuredClone(data), createdAt: new Date() };
        state.logs.push(log); return structuredClone(log);
      },
      update: async ({ where, data }) => {
        if (state.ledgerFailure) throw new Error("private-ledger-error");
        const log = state.logs.find((row) => row.id === where.id);
        Object.assign(log, structuredClone(data)); return structuredClone(log);
      },
      updateMany: async ({ where, data }) => {
        const log = state.logs.find((row) => matches(row, where));
        if (log) Object.assign(log, data); return { count: log ? 1 : 0 };
      },
      findMany: async ({ where, skip, take }) => state.logs.filter((log) => matches(log, where)).sort((a, b) => b.createdAt - a.createdAt).slice(skip, skip + take).map((log) => structuredClone(log)),
      count: async ({ where }) => state.logs.filter((log) => matches(log, where)).length,
    },
    user: { findMany: async () => [{ id: "b".repeat(24), name: "Stock administrator", email: "admin@example.com", hashedPassword: "private-password" }] },
    $transaction: async (operation) => {
      if (Array.isArray(operation)) return Promise.all(operation);
      const snapshot = structuredClone({ variant: state.variant, logs: state.logs });
      let result;
      try { result = await operation(prisma); }
      catch (error) { Object.assign(state, snapshot); throw error; }
      if (state.ambiguousCommit) {
        state.ambiguousCommit = false;
        if (state.failCommitRead) state.hideCommittedOnce = true;
        throw new Error("private-timeout-after-commit");
      }
      return result;
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
    const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText;
    const loaded = { exports: {} };
    vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename })(
      (name) => name in mocks ? mocks[name] : name.startsWith("@/") ? load(name.slice(2) + ".ts") : require(name), loaded, loaded.exports,
    );
    cache.set(file, loaded.exports); return loaded.exports;
  }
  const detail = load("app/api/admin/inventory/[variantId]/route.ts");
  const list = load("app/api/admin/inventory/route.ts");
  const input = { action: "INITIALIZE", quantity: 12, version: 0, reason: "Opening physical count", requestId: KEY, confirmed: true };
  return { state, calls, input, prisma, activity: load("libs/adminActivity.ts"),
    counted(onHand = 12, reserved = 0, version = 1) { state.variant.inventory = { onHand, reserved, version, updatedAt: new Date() }; },
    get: (query = "", id = ID) => detail.GET(new Request("http://localhost/api/admin/inventory/" + id + query), { params: Promise.resolve({ variantId: id }) }),
    list: (query = "") => list.GET(new Request("http://localhost/api/admin/inventory" + query)),
    patch: (body = input, id = ID) => detail.PATCH(new Request("http://localhost/api/admin/inventory/" + id, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body),
    }), { params: Promise.resolve({ variantId: id }) }),
  };
}

test("inventory endpoints require ADMIN before any database access", async () => {
  const f = fixture();
  for (const user of [null, { id: "b".repeat(24), role: "USER" }]) {
    f.state.user = user;
    for (const call of [f.get, f.list, f.patch]) {
      const response = await call();
      assert.equal(response.status, user ? 403 : 401);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
    }
  }
  assert.equal(f.calls.length, 0);
  assert.equal(f.state.logs.length, 0);
});

test("inventory rejects malformed requests, fractions, negative quantities and forged confirmation", async () => {
  const f = fixture();
  for (const body of ["{", null, [], { ...f.input, quantity: -1 }, { ...f.input, quantity: 1.5 },
    { ...f.input, quantity: "12" }, { ...f.input, quantity: 2000000001 }, { ...f.input, quantity: null },
    { ...f.input, version: -1 }, { ...f.input, version: 2000000000 }, { ...f.input, requestId: "invalid" },
    { ...f.input, action: "constructor" }, { ...f.input, confirmed: "true" }, { ...f.input, confirmed: false },
    { ...f.input, reason: "short" }, { ...f.input, reason: "x".repeat(501) }, { ...f.input, reason: "reason\u0000invalid" }]) {
    assert.equal((await f.patch(body)).status, 400);
  }
  assert.equal((await f.patch(f.input, "invalid")).status, 400);
  assert.equal((await f.get("?page=1.5")).status, 400);
  assert.equal((await f.list("?state=BAD")).status, 400);
  assert.equal((await f.list("?page=1001")).status, 400);
  assert.equal((await f.list("?q=" + "x".repeat(81))).status, 400);
  assert.equal(f.calls.length, 0);
  assert.equal(f.state.logs.length, 0);
});

test("legacy availability never invents a quantity, and read DTOs omit internal data", async () => {
  const f = fixture();
  const response = await f.get();
  const body = await response.json();
  assert.equal(body.variant.inventory, null);
  assert.equal(body.variant.needsReview, false);
  assert.equal(body.variant.privateProviderToken, undefined);
  assert.equal(body.historyTotal, 0);
  assert.equal(body.operationStatus, null);
  assert.equal((await f.get("", "d".repeat(24))).status, 404);
});

test("opening stock count records balance and a durable successful movement together, including zero", async () => {
  for (const quantity of [0, 12]) {
    const f = fixture();
    assert.equal((await f.patch({ ...f.input, quantity })).status, 200);
    assert.equal(f.state.variant.inventory.onHand, quantity);
    assert.equal(f.state.variant.inventory.reserved, 0);
    assert.equal(f.state.variant.inventory.version, 1);
    assert.equal(f.state.logs[0].status, "SUCCEEDED");
    const body = await (await f.get()).json();
    assert.equal(body.variant.inventory.available, quantity);
    assert.equal(body.history[0].before, null);
    assert.equal(body.history[0].after, quantity);
    assert.equal(body.history[0].actor, "Stock administrator");
    assert.equal(body.history[0].fingerprint, undefined);
    assert.equal(body.history[0].actorId, undefined);
    assert.equal(body.history[0].requestId, undefined);
  }
});

test("receive, remove and physical recount change on-hand stock without changing reserved units", async () => {
  for (const [action, quantity, expected] of [["RECEIVE", 3, 15], ["REMOVE", 4, 8], ["COUNT", 18, 18]]) {
    const f = fixture(); f.counted(12, 2);
    assert.equal((await f.patch({ ...f.input, action, quantity, version: 1 })).status, 200);
    assert.equal(f.state.variant.inventory.onHand, expected);
    assert.equal(f.state.variant.inventory.reserved, 2);
    assert.equal(f.state.variant.inventory.version, 2);
    assert.equal(f.state.logs[0].details.before.onHand, 12);
    assert.equal(f.state.logs[0].details.after.onHand, expected);
  }
});

test("removal/recount cannot consume reserved stock, go negative, overflow, or save unchanged counts", async () => {
  for (const [action, quantity, onHand, reserved] of [
    ["REMOVE", 11, 12, 2], ["REMOVE", 13, 12, 0], ["COUNT", 1, 12, 2], ["COUNT", 12, 12, 2],
    ["RECEIVE", 2, 1999999999, 0],
  ]) {
    const f = fixture(); f.counted(onHand, reserved);
    assert.equal((await f.patch({ ...f.input, action, quantity, version: 1 })).status, 409);
    assert.equal(f.state.variant.inventory.onHand, onHand);
    assert.equal(f.state.logs.length, 0);
  }
  const f = fixture(); f.counted();
  for (const action of ["RECEIVE", "REMOVE"]) assert.equal((await f.patch({ ...f.input, action, quantity: 0, version: 1 })).status, 400);
});

test("unknown and counted stock cannot use the wrong initialization workflow", async () => {
  const f = fixture();
  for (const action of ["RECEIVE", "REMOVE", "COUNT"]) assert.equal((await f.patch({ ...f.input, action })).status, 409);
  f.counted();
  assert.equal((await f.patch({ ...f.input, version: 1 })).status, 409);
  assert.equal(f.state.logs.length, 0);
});

test("invalid stored balances are locked instead of being reset or fabricated", async () => {
  const f = fixture();
  for (const inventory of [{ onHand: -1, reserved: 0, version: 1, updatedAt: new Date() },
    { onHand: 2, reserved: 3, version: 1, updatedAt: new Date() },
    { onHand: 2, reserved: 0, version: 0, updatedAt: new Date() }]) {
    f.state.variant.inventory = inventory;
    const body = await (await f.get()).json();
    assert.equal(body.variant.needsReview, true);
    assert.equal(body.variant.inventory, null);
    assert.equal((await f.patch(f.input)).status, 409);
  }
  assert.equal(f.state.logs.length, 0);
});

test("stale versions and concurrent changes cannot overwrite stock", async () => {
  const f = fixture(); f.counted();
  assert.equal((await f.patch({ ...f.input, action: "RECEIVE", version: 0, quantity: 3 })).status, 409);
  f.state.race = true;
  assert.equal((await f.patch({ ...f.input, action: "RECEIVE", version: 1, quantity: 3 })).status, 409);
  assert.equal(f.state.variant.inventory.onHand, 12);
  assert.equal(f.state.logs[0].status, "FAILED");
  assert.equal((await (await f.get()).json()).historyTotal, 0);
});

test("same request replays exactly once, even after later adjustments", async () => {
  const f = fixture();
  assert.equal((await f.patch()).status, 200);
  assert.equal((await f.patch({ ...f.input, action: "RECEIVE", quantity: 3, version: 1, requestId: OTHER_KEY })).status, 200);
  const replay = await (await f.patch()).json();
  assert.equal(replay.replayed, true);
  assert.equal(f.state.variant.inventory.onHand, 15);
  assert.equal(f.state.logs.length, 2);
});

test("request keys cannot be reused for different quantities, reasons or variants", async () => {
  const f = fixture();
  await f.patch();
  assert.equal((await f.patch({ ...f.input, quantity: 13 })).status, 409);
  assert.equal((await f.patch({ ...f.input, reason: "Different recount document" })).status, 409);
  assert.equal((await f.patch(f.input, "d".repeat(24))).status, 409);
  assert.equal(f.state.variant.inventory.onHand, 12);
  assert.equal(f.state.logs.length, 1);
});

test("audit-start failure prevents stock changes", async () => {
  const f = fixture(); f.state.auditFailure = true;
  const response = await f.patch();
  assert.equal(response.status, 503);
  assert.equal(f.state.variant.inventory, null);
  assert.equal(f.state.logs.length, 0);
  assert.equal(JSON.stringify(await response.json()).includes("private-audit-secret"), false);
});

test("movement-write failure rolls back the stock balance", async () => {
  const f = fixture(); f.state.ledgerFailure = true;
  assert.equal((await f.patch()).status, 503);
  assert.equal(f.state.variant.inventory, null);
  assert.equal(f.state.logs[0].status, "UNKNOWN");
  assert.equal((await (await f.get()).json()).historyTotal, 0);
  f.state.ledgerFailure = false;
  assert.equal((await f.patch()).status, 200);
  assert.equal(f.state.variant.inventory.onHand, 12);
  assert.equal(f.state.logs.length, 1);
});

test("lost commit responses resolve from the same operation without applying stock twice", async () => {
  const f = fixture(); f.state.ambiguousCommit = true;
  const body = await (await f.patch()).json();
  assert.equal(body.success, true);
  assert.equal(body.replayed, true);
  assert.equal(f.state.variant.inventory.onHand, 12);
  assert.equal(f.state.logs[0].status, "SUCCEEDED");
  const reloaded = await (await f.get("?requestId=" + KEY)).json();
  assert.equal(reloaded.operationStatus, "SUCCEEDED");
  const anotherAdmin = { id: "d".repeat(24), role: "ADMIN" };
  f.state.user = anotherAdmin;
  assert.equal((await (await f.get("?requestId=" + KEY)).json()).operationStatus, null);
});

test("an unavailable outcome read cannot downgrade a committed movement or make stock apply twice", async () => {
  const f = fixture();
  f.state.ambiguousCommit = true;
  f.state.failCommitRead = true;
  assert.equal((await f.patch()).status, 503);
  assert.equal(f.state.variant.inventory.onHand, 12);
  assert.equal(f.state.logs[0].status, "SUCCEEDED");
  const detail = await (await f.get("?requestId=" + KEY)).json();
  assert.equal(detail.operationStatus, "SUCCEEDED");
  assert.equal((await (await f.patch()).json()).replayed, true);
  assert.equal(f.state.variant.inventory.onHand, 12);
  assert.equal(f.state.logs.length, 1);
});

test("history accepts uppercase variant IDs, paginates only successful adjustments, and never exposes private fields", async () => {
  const f = fixture();
  await f.patch();
  for (let index = 0; index < 11; index++) {
    f.state.logs.push({ ...structuredClone(f.state.logs[0]), id: String(index).padStart(24, "0"), createdAt: new Date(Date.now() + index) });
  }
  f.state.logs.push({ ...structuredClone(f.state.logs[0]), id: "f".repeat(24), status: "UNKNOWN" });
  const body = await (await f.get("?page=2", ID.toUpperCase())).json();
  assert.equal(body.historyTotal, 12);
  assert.equal(body.history.length, 2);
  assert.equal(body.historyTotalPages, 2);
  assert.equal(body.historyPage, 2);
  assert.equal(body.historyPageCountLimited, false);
  const text = JSON.stringify(body);
  assert.equal(text.includes("private-"), false);
  assert.equal(text.includes("fingerprint"), false);
});

test("inventory list selects server pagination and filters without returning an entire catalog", async () => {
  const f = fixture();
  const body = await (await f.list("?q=PHONE&state=UNCOUNTED&page=2")).json();
  assert.equal(body.total, 1);
  assert.equal(body.page, 2);
  assert.equal(body.rows[0].inventory, null);
  const query = f.calls.find((call) => call && typeof call === "object" && "skip" in call);
  assert.equal(query.skip, 10);
  assert.equal(query.take, 10);
  assert.equal(query.where.OR[0].sku.contains, "PHONE");
  assert.equal(query.where.AND[0].OR.length, 2);
  await f.list("?q=%5B&state=COUNTED");
  const literal = f.calls.filter((call) => call && typeof call === "object" && "skip" in call).at(-1);
  assert.equal(literal.where.OR[0].sku.contains, "\\[");
  assert.deepEqual(literal.where.AND, [{ inventory: { isSet: true } }, { inventory: { isNot: null } }]);
});

test("database failures are errors rather than empty inventory and Activity log describes stock adjustments", async () => {
  const f = fixture(); f.state.offline = true;
  const response = await f.get();
  assert.equal(response.status, 503);
  assert.equal(JSON.stringify(await response.json()).includes("private-db-secret"), false);
  f.state.offline = false;
  await f.patch();
  const activity = f.activity.formatAdminActivity(f.state.logs[0], "Admin", { label: "Phone · PHONE-BLACK", href: "/admin/inventory/" + ID });
  assert.equal(activity.activity, "Adjusted SKU stock");
  assert.equal(activity.result, "Completed");
  assert.equal(activity.changes.find((row) => row.label === "On hand").after, "12");
  assert.equal(activity.changes.find((row) => row.label === "On hand").before, "Not counted");
  assert.equal(JSON.stringify(activity).includes("fingerprint"), false);
});
