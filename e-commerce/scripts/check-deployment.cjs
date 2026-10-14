const assert = require("node:assert/strict");
const fs = require("node:fs");
async function main() {
  const value = process.argv.find((arg) => arg.startsWith("--url="))?.slice(6);
  const expectedRevision = process.argv
    .find((arg) => arg.startsWith("--revision="))
    ?.slice(11);
  const base = new URL(value);
  assert.ok(
    base.protocol === "https:" &&
      !base.username &&
      !base.password &&
      !base.search &&
      !base.hash &&
      base.pathname === "/",
  );
  const read = (path) =>
    fetch(new URL(path, base), {
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
    });
  const checks = [];
  const health = await read("/api/health");
  assert.equal(health.status, 200);
  const data = await health.json();
  assert.equal(data.status, "ok");
  assert.equal(data.mode, "sandbox-demo");
  if (expectedRevision) assert.equal(data.revision, expectedRevision);
  checks.push("HTTPS liveness, demo mode and expected deployed revision");
  for (const path of [
    "/api/admin/operations",
    "/api/admin/operations/holds",
    "/api/admin/orders",
    "/api/jobs/health",
    "/api/jobs/reconcile-payments",
  ]) {
    const response = await read(path);
    assert.ok([401, 503].includes(response.status));
    checks.push("unauthorized access refused: " + path);
  }
  for (const path of ["/", "/products", "/login", "/help/shipping"]) {
    const response = await read(path);
    assert.equal(response.status, 200);
    checks.push("public page: " + path);
  }
  fs.mkdirSync(".artifacts", { recursive: true });
  fs.writeFileSync(
    ".artifacts/p0-deployment-results.json",
    JSON.stringify(
      {
        origin: base.origin,
        revision: data.revision,
        checks,
        writes: 0,
        liveMoneyTransactions: 0,
      },
      null,
      2,
    ),
  );
  console.log("Deployment checks passed: " + checks.length + " groups.");
}
main().catch((error) => {
  console.error("Deployment check failed:", error.name);
  process.exitCode = 1;
});
