const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const assert = require("node:assert/strict");
const appDirectory = path.resolve(__dirname, "..");
require("@next/env").loadEnvConfig(appDirectory);
const { PrismaClient } = require("@prisma/client");
const { getCodQueueFixtures } = require("../tests/fixtures/cod-queue.cjs");
function load(file) {
  const filename = path.resolve(appDirectory, file);
  const compiled = ts.transpileModule(fs.readFileSync(filename,"utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const moduleRecord = { exports: {} };
  vm.runInThisContext("(function(require,module,exports){"+compiled+"\n})",{filename})(name=>name.startsWith("@/") ? load(name.slice(2)+".ts") : require(name), moduleRecord, moduleRecord.exports);
  return moduleRecord.exports;
}
const helpers = load("libs/adminCodQueue.ts");
const filters = load("utils/adminCodQueue.ts");
let stage = "initialization";
async function main() {
  const prisma = new PrismaClient();
  try {
    const cases = getCodQueueFixtures();
    const documents = cases.map(row=>row.document);
    async function aggregate(query = "", docs = documents) {
      const pipeline = helpers.getCodQueuePipeline(filters.getCodQueueFilters(new URLSearchParams(query)));
      const response = await prisma.$runCommandRaw({ aggregate: 1, pipeline: [{ $documents: { $literal: docs } }, ...pipeline], cursor: {} });
      assert.equal(response.ok, 1);
      return helpers.parseCodQueueResult(response.cursor.firstBatch);
    }
    stage = "all classification branches";
    const report = await aggregate("export=CSV");
    const byId = new Map(report.orders.map(row=>[row.id,row]));
    for (const testCase of cases) {
      assert.equal(byId.get(testCase.document._id.$oid).stage, testCase.expectedStage, "Classification for fixture "+testCase.document._id.$oid);
    }
    assert.equal(report.summary.total, cases.length);
    assert.equal(report.summary.collectedAmount, 3003000000);
    assert.equal(report.summary.receivedAmount, 3001980000);
    assert.equal(report.summary.carrierFee, 20000);
    assert.equal(report.summary.awaitingRemittanceAmount, 1000000);
    assert.doesNotMatch(JSON.stringify(report), /private|recordedBy|requestId|note/);
    stage = "filtered accounting and pagination";
    const queued = await aggregate("stage=AWAITING_REMITTANCE");
    assert.equal(queued.summary.total, 1);
    assert.equal(queued.summary.receivedAmount, 0);
    assert.equal(queued.summary.awaitingRemittanceAmount, 1000000);
    const first = await aggregate("page=1");
    const second = await aggregate("page=2");
    assert.equal(first.orders.length, 10);
    assert.equal(second.orders.length, 10);
    assert.deepEqual(first.summary, report.summary);
    assert.deepEqual(second.summary, report.summary);
    assert.ok(second.orders.every(row=>!first.orders.some(other=>other.id===row.id)));
    stage = "literal search and empty report";
    const special = structuredClone(documents.slice(0,2));
    special[0].recipientName = "Recipient [QA].*";
    const literal = await aggregate("search="+encodeURIComponent("[QA].*"), special);
    assert.equal(literal.summary.total, 1);
    const empty = await aggregate("search=NoMatchingRecipient");
    assert.equal(empty.summary.total, 0);
    assert.equal(empty.summary.collectedAmount, 0);
    stage = "exact ObjectId search";
    const idResult = await aggregate("search="+documents[0]._id.$oid.toUpperCase());
    assert.equal(idResult.summary.total, 1);
    stage = "order-date boundary in Vietnam";
    const dateDocuments = structuredClone(documents.slice(0,2));
    dateDocuments[0].createDate = { $date: "2026-10-13T16:59:59.999Z" };
    dateDocuments[1].createDate = { $date: "2026-10-13T17:00:00.000Z" };
    const dated = await aggregate("startDate=2026-10-14&endDate=2026-10-14", dateDocuments);
    assert.equal(dated.summary.total, 1);
    console.log("MongoDB aggregation verified: "+cases.length+" classification cases, money totals, filtered totals, pagination, literal search, ObjectIds and Vietnam date boundaries. No collections or records were written.");
    const artifactDirectory = path.join(appDirectory, ".artifacts");
    fs.mkdirSync(artifactDirectory, { recursive: true });
    fs.writeFileSync(path.join(artifactDirectory, "cod-queue-mongo-results.json"), JSON.stringify({ classificationCases: cases.length, totals: true, pagination: true, search: true, dateBoundary: true, databaseWrites: 0 },null,2));
  } finally { await prisma.$disconnect(); }
}
main().catch(error=>{ console.error("Read-only MongoDB QA failed during "+stage); if(error.code === "ERR_ASSERTION") console.error(error.message); else console.error(error.code || error.name); process.exitCode=1; });
