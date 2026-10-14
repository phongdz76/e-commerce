const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function fixture() {
  const rows = Array.from({ length: 28 }, (_, index) => {
    const stage = ["AWAITING_COLLECTION", "AWAITING_REMITTANCE", "RECEIVED", "LEGACY_PAID"][index % 4];
    const collected = ["AWAITING_REMITTANCE", "RECEIVED"].includes(stage);
    const received = stage === "RECEIVED";
    return {
      id: (index + 1).toString(16).padStart(24, "0"), stage,
      recipientName: "QA recipient", carrier: "QA carrier", trackingNumber: "TRACK-001",
      amount: 1000000, currency: "vnd", deliveryStatus: "delivered",
      createDate: new Date(Date.UTC(2026, 9, 14, 0, index)).toISOString(),
      collectedAmount: collected ? 1000000 : null,
      receivedAmount: received ? 980000 : null,
      carrierFee: received ? 20000 : null,
      collectedAt: collected ? "2026-10-14T01:00:00.000Z" : null,
      receivedAt: received ? "2026-10-14T02:00:00.000Z" : null,
      collectionReference: collected ? "COLLECT-001" : null,
      settlementReference: received ? "BANK-001" : null,
      note: "private-note", recordedBy: "private-staff", requestId: "private-request",
    };
  });
  const state = { user: { role: "ADMIN" }, offline: false, raw: null };
  const calls = [];
  const prisma = { order: { aggregateRaw: async ({ pipeline }) => {
    calls.push(pipeline);
    if (state.offline) throw new Error("private-database-credentials");
    if (state.raw) return state.raw;
    const selectedStage = pipeline.find((stage) => stage.$match?.codStage)?.$match.codStage;
    const selected = rows.filter((row) => !selectedStage || row.stage === selectedStage)
      .sort((a,b) => b.createDate.localeCompare(a.createDate));
    const summary = selected.reduce((sum, row) => {
      sum.total++;
      sum.collectedAmount += row.collectedAmount || 0;
      sum.receivedAmount += row.receivedAmount || 0;
      sum.carrierFee += row.carrierFee || 0;
      sum.awaitingRemittanceAmount += row.stage === "AWAITING_REMITTANCE" ? row.collectedAmount : 0;
      sum.awaitingCollectionCount += row.stage === "AWAITING_COLLECTION" ? 1 : 0;
      sum.awaitingRemittanceCount += row.stage === "AWAITING_REMITTANCE" ? 1 : 0;
      sum.unconfirmedCount += ["LEGACY_PAID", "NEEDS_REVIEW"].includes(row.stage) ? 1 : 0;
      return sum;
    }, { total: 0, collectedAmount: 0, receivedAmount: 0, carrierFee: 0, awaitingRemittanceAmount: 0, awaitingCollectionCount: 0, awaitingRemittanceCount: 0, unconfirmedCount: 0 });
    const facet = pipeline.find((stage) => stage.$facet).$facet;
    const skip = facet.orders.find((stage) => stage.$skip !== undefined).$skip;
    const limit = facet.orders.find((stage) => stage.$limit !== undefined).$limit;
    return [{ orders: selected.slice(skip, skip + limit), totals: selected.length ? [summary] : [] }];
  } } };
  const mocks = {
    "@/libs/prismadb": { __esModule: true, default: prisma },
    "@/actions/getCurrentUser": { getCurrentUser: async () => state.user },
    "next/server": { NextResponse: { json: Response.json } },
  };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const filename = path.resolve(__dirname, "..", file);
    const compiled = ts.transpileModule(fs.readFileSync(filename,"utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const loaded = { exports: {} };
    vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename })(
      name => name in mocks ? mocks[name] : name.startsWith("@/") ? load(name.slice(2)+".ts") : require(name), loaded, loaded.exports,
    );
    cache.set(file, loaded.exports);
    return loaded.exports;
  }
  const route = load("app/api/admin/cod/route.ts").GET;
  return { state, rows, calls,
    get: (query = "") => route(new Request("http://localhost/api/admin/cod" + query)),
    utils: load("utils/adminCodQueue.ts"), helper: load("libs/adminCodQueue.ts"),
  };
}

test("COD queue and CSV require ADMIN and do not query records for other sessions", async () => {
  const f = fixture();
  for (const user of [null, { role: "USER" }]) {
    f.state.user = user;
    for (const query of ["", "?export=CSV"]) {
      const response = await f.get(query);
      assert.equal(response.status, user ? 403 : 401);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
    }
  }
  assert.equal(f.calls.length, 0);
});

test("invalid stage, dates, export format and pagination fail before aggregation", async () => {
  const f = fixture();
  for (const query of ["?stage=constructor", "?stage=__proto__", "?export=JSON", "?page=0", "?page=1001", "?page=1.5", "?page=1e2", "?search="+"x".repeat(81), "?startDate=2026-10-14", "?endDate=2026-10-14", "?startDate=2026-02-29&endDate=2026-03-01", "?startDate=2026-10-15&endDate=2026-10-14", "?startDate=2024-01-01&endDate=2026-01-01"]) {
    assert.equal((await f.get(query)).status, 400, query);
  }
  assert.equal(f.calls.length, 0);
});

test("COD dates use Vietnam midnight with an inclusive end day and validate leap dates", () => {
  const f = fixture();
  const filters = f.utils.getCodQueueFilters(new URLSearchParams("startDate=2026-10-14&endDate=2026-10-14"));
  assert.equal(filters.start.toISOString(), "2026-10-13T17:00:00.000Z");
  assert.equal(filters.end.toISOString(), "2026-10-14T17:00:00.000Z");
  assert.ok(f.utils.getCodQueueFilters(new URLSearchParams("startDate=2024-02-29&endDate=2024-02-29")));
});

test("pagination never changes the full filtered money totals", async () => {
  const f = fixture();
  const first = await (await f.get()).json();
  const second = await (await f.get("?page=2")).json();
  assert.equal(first.summary.total, 28);
  assert.equal(first.orders.length, 10);
  assert.equal(second.orders.length, 10);
  assert.equal(first.summary.collectedAmount, 14000000);
  assert.equal(first.summary.receivedAmount, 6860000);
  assert.equal(first.summary.carrierFee, 140000);
  assert.equal(first.summary.awaitingRemittanceAmount, 7000000);
  assert.equal(first.summary.unconfirmedCount, 7);
  assert.deepEqual(first.summary, second.summary);
  assert.equal(first.totalPages, 3);
  assert.equal(first.pageCountLimited, false);
  assert.ok(second.orders.every(row=>!first.orders.some(other=>other.id===row.id)));
  const facet = f.calls[0].find(stage=>stage.$facet).$facet;
  assert.equal(facet.totals.length, 1);
  assert.ok(facet.totals[0].$group);
  assert.equal(facet.totals.some(stage=>stage.$limit || stage.$skip), false);
});

test("stage filters apply before pagination and before money totals", async () => {
  const f = fixture();
  const data = await (await f.get("?stage=AWAITING_REMITTANCE")).json();
  assert.equal(data.summary.total, 7);
  assert.equal(data.summary.receivedAmount, 0);
  assert.equal(data.summary.awaitingRemittanceAmount, 7000000);
  assert.ok(data.orders.every(row=>row.stage==="AWAITING_REMITTANCE"));
  const pipeline = f.calls[0];
  assert.equal(pipeline[0].$match.paymentMethod, "COD");
  assert.ok(pipeline.findIndex(stage=>stage.$match?.codStage) < pipeline.findIndex(stage=>stage.$facet));
});

test("search escapes regex syntax and supports exact ObjectId matching before aggregation", async () => {
  const f = fixture();
  await f.get("?search="+encodeURIComponent("Recipient [QA].*"));
  const match = f.calls[0][0].$match;
  assert.equal(match.$or[0].recipientName.$regex, "Recipient \\[QA\\]\\.\\*");
  assert.equal(match.$or[0].recipientName.$options, "i");
  await f.get("?search="+"A".repeat(24));
  assert.ok(f.calls[1][0].$match.$or.some(row=>row._id?.$oid === "a".repeat(24)));
});

test("queue responses allowlist business fields and never expose notes, request keys or staff IDs", async () => {
  const f = fixture();
  const response = await f.get();
  const data = await response.json();
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.doesNotMatch(JSON.stringify(data), /private|recordedBy|requestId|note/);
  const projection = f.calls[0].find(stage=>stage.$facet).$facet.orders.find(stage=>stage.$project).$project;
  assert.equal(projection._id, 0);
  assert.equal(projection.note, undefined);
  assert.equal(projection.recordedBy, undefined);
});

test("CSV includes every filtered order regardless of the current page and safely escapes user text", async () => {
  const f = fixture();
  f.rows[0].recipientName = '=HYPERLINK("bad")';
  f.rows[1].carrier = 'Team "QA", Carrier';
  const response = await f.get("?page=2&export=CSV");
  const csv = await response.text();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/csv; charset=utf-8");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(csv.split("\r\n").length, 29);
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(csv.includes('"Team ""QA"", Carrier"'));
  assert.doesNotMatch(csv, /private|requestId|recordedBy|note/);
  const facet = f.calls[0].find(stage=>stage.$facet).$facet;
  assert.equal(facet.orders.find(stage=>stage.$skip !== undefined).$skip, 0);
  assert.equal(facet.orders.find(stage=>stage.$limit !== undefined).$limit, 5001);
});

test("CSV rejects oversized or incomplete exports instead of truncating the file", async () => {
  const f = fixture();
  const row = structuredClone(f.rows[0]);
  f.rows.splice(0, f.rows.length, ...Array.from({length: 5001}, (_,index)=>({...row, id:index.toString(16).padStart(24,"0")})));
  const response = await f.get("?export=CSV");
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "COD_EXPORT_LIMIT");
  assert.equal(response.headers.get("content-type").startsWith("application/json"), true);
  f.state.raw = [{ orders: [row], totals: [{ total: 2, collectedAmount: 0, receivedAmount: 0, carrierFee: 0, awaitingRemittanceAmount: 0, awaitingCollectionCount: 2, awaitingRemittanceCount: 0, unconfirmedCount: 0 }] }];
  assert.equal((await f.get("?export=CSV")).status, 503);
});

test("empty queues return real zeros while database and malformed aggregation results return errors", async () => {
  const f = fixture();
  f.rows.splice(0);
  const data = await (await f.get()).json();
  assert.equal(data.summary.total, 0);
  assert.equal(data.summary.collectedAmount, 0);
  assert.deepEqual(data.orders, []);
  f.state.offline = true;
  const response = await f.get();
  assert.equal(response.status, 503);
  assert.doesNotMatch(JSON.stringify(await response.json()), /private|credentials/);
  f.state.offline = false;
  for (const raw of [[], [{}], [{ orders: [], totals: [{ total: 0 }] }]]) {
    f.state.raw = raw;
    assert.equal((await f.get()).status, 503);
  }
});

test("inconsistent, negative or overflowing money totals cannot be presented as a valid report", () => {
  const f = fixture();
  const summary = { total: 0, collectedAmount: 0, receivedAmount: 0, carrierFee: 0, awaitingRemittanceAmount: 0, awaitingCollectionCount: 0, awaitingRemittanceCount: 0, unconfirmedCount: 0 };
  for (const changed of [ { collectedAmount: 1 }, { receivedAmount: -1 }, { carrierFee: 0.5 }, { collectedAmount: Number.MAX_SAFE_INTEGER + 1 }, { unconfirmedCount: 1 } ]) {
    assert.throws(()=>f.helper.parseCodQueueResult([{ orders: [], totals: [{ ...summary, ...changed }] }]));
  }
});

test("row stages must agree with confirmed money and receipt metadata", () => {
  const f = fixture();
  const row = structuredClone(f.rows.find(row=>row.stage==="RECEIVED"));
  const totals = { total: 1, collectedAmount: 1000000, receivedAmount: 980000, carrierFee: 20000, awaitingRemittanceAmount: 0, awaitingCollectionCount: 0, awaitingRemittanceCount: 0, unconfirmedCount: 0 };
  for (const change of [{collectedAmount: null}, {receivedAmount: null}, {carrierFee: 0}, {collectionReference: null}, {receivedAt: "invalid-date"}, {stage: "LEGACY_PAID"}]) {
    assert.throws(()=>f.helper.parseCodQueueResult([{ orders: [{...row,...change}], totals: [totals] }]));
  }
});

test("large queues expose the pagination limit while keeping full accounting totals", async () => {
  const f = fixture();
  const row = structuredClone(f.rows[0]);
  f.rows.splice(0, f.rows.length, ...Array.from({length: 10001}, (_,index)=>({...row, id:index.toString(16).padStart(24,"0")})));
  const data = await (await f.get()).json();
  assert.equal(data.summary.total, 10001);
  assert.equal(data.summary.awaitingCollectionCount, 10001);
  assert.equal(data.totalPages, 1000);
  assert.equal(data.pageCountLimited, true);
});

test("CSV formula protection covers whitespace, control characters and all supported formula prefixes", () => {
  const f = fixture();
  for (const value of ["=SUM(A1)", " +1", "-123", "@user", "\tvalue", "\rvalue", "\nvalue"]) {
    assert.equal(f.utils.codCsvCell(value).startsWith('"\''), true);
  }
  assert.equal(f.utils.codCsvCell('Team "QA", Carrier'), '"Team ""QA"", Carrier"');
  assert.equal(f.utils.codCsvCell(null), '""');
  assert.equal(f.utils.codCsvCell(123), '"123"');
});
