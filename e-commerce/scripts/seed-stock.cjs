const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { randomUUID } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const appDirectory = path.resolve(__dirname, "..");
require("@next/env").loadEnvConfig(appDirectory);

async function main() {
  const quantityFlag = process.argv.find((argument) => argument.startsWith("--quantity="));
  const quantity = Number(quantityFlag?.slice("--quantity=".length) ?? "50");
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 2000000000) throw new Error("Invalid sample quantity");
  const apply = process.argv.includes("--apply");
  const prisma = new PrismaClient();
  try {
    const administrator = await prisma.user.findFirst({ where: { role: "ADMIN", OR: [{ status: "ACTIVE" }, { status: null }, { status: { isSet: false } }] }, select: { id: true, role: true } });
    if (!administrator) throw new Error("An existing active administrator is required; no roles are changed by this script.");
    const mocks = { "@/libs/prismadb": { __esModule: true, default: prisma }, "@/actions/getCurrentUser": { getCurrentUser: async () => administrator }, "next/server": { NextResponse: { json: Response.json } } };
    const cache = new Map();
    function load(file) {
      if (cache.has(file)) return cache.get(file);
      const filename = path.join(appDirectory, file);
      const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
      const loaded = { exports: {} };
      vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename })((name) => name in mocks ? mocks[name] : name.startsWith("@/") ? load(name.slice(2) + ".ts") : require(name), loaded, loaded.exports);
      cache.set(file, loaded.exports); return loaded.exports;
    }
    const { readInventoryBalance } = load("utils/adminInventory.ts");
    const { adjustAdminInventory } = load("libs/adminInventory.ts");
    const variants = await prisma.productVariant.findMany({ select: { id: true, sku: true, inventory: true }, orderBy: { sku: "asc" } });
    const results = [];
    for (const variant of variants) {
      let latest = variant;
      const before = readInventoryBalance(variant.inventory);
      let status = "PREVIEW";
      for (let attempt = 0; attempt < 4; attempt++) {
        const balance = readInventoryBalance(latest.inventory);
        if (latest.inventory != null && !balance) { status = "NEEDS_REVIEW"; break; }
        if (balance && balance.reserved > quantity) { status = "RESERVED_EXCEEDS_TARGET"; break; }
        if (balance?.onHand === quantity) { status = "UNCHANGED"; break; }
        if (!apply) break;
        const input = { action: balance ? "COUNT" : "INITIALIZE", quantity, version: balance?.version ?? 0,
          requestId: randomUUID(), reason: `Sample data: set ${quantity} units per SKU at the owner's request. This is a development sample, not a physical count.`, confirmed: true };
        const request = () => new Request("http://localhost/api/admin/inventory/" + variant.id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
        let response = await adjustAdminInventory(request(), variant.id);
        if (response.status === 503) response = await adjustAdminInventory(request(), variant.id); // Recover the exact same operation.
        if (response.ok) { status = "APPLIED"; break; }
        latest = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id }, select: { id: true, sku: true, inventory: true } });
        status = "NOT_CONFIRMED";
        if (response.status !== 409) break;
      }
      results.push({ sku: variant.sku, before: before?.onHand ?? null, target: quantity, reserved: before?.reserved ?? 0, status });
    }
    const verified = await prisma.productVariant.findMany({ select: { sku: true, inventory: true } });
    const counts = results.reduce((summary, row) => { summary[row.status] = (summary[row.status] || 0) + 1; return summary; }, {});
    const atTarget = verified.filter((row) => readInventoryBalance(row.inventory)?.onHand === quantity).length;
    const report = { apply, quantity, total: variants.length, atTarget, counts, results, createdAt: new Date().toISOString() };
    fs.mkdirSync(path.join(appDirectory, ".artifacts"), { recursive: true });
    fs.writeFileSync(path.join(appDirectory, ".artifacts", apply ? "stock-seed-applied.json" : "stock-seed-preview.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ apply, quantity, total: variants.length, atTarget, counts }));
    if (apply && atTarget !== variants.length) process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
}
main().catch((error) => { console.error("Unable to prepare/apply sample stock:", error.code || error.name); process.exitCode = 1; });
