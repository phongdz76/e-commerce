const { loadEnvConfig } = require("@next/env");
const { appendFileSync } = require("node:fs");
const {
  workerConfiguration,
  workerAuthorization,
} = require("./payment-worker.cjs");
const labels = { database: "Database", scheduler: "Payment scheduler", sandbox: "Payment configuration", holds: "Online stock holds", payments: "Payment follow-up" };

function classifyOperationsHealth(httpStatus, result) {
  if (![200, 503].includes(httpStatus) || !result || !["ok", "needs-attention"].includes(result.status) || !Array.isArray(result.checks) || result.checks.length !== Object.keys(labels).length)
    throw new Error("Invalid or unavailable operations health response");
  const checks = new Map();
  for (const check of result.checks) {
    if (!check || !Object.hasOwn(labels, check.key) || typeof check.ok !== "boolean" || checks.has(check.key)) throw new Error("Invalid operations health checks");
    checks.set(check.key, check.ok);
  }
  const failed = [...checks.keys()].filter(key => !checks.get(key));
  if ((result.status === "ok") !== (failed.length === 0) || result.status === "ok" && httpStatus !== 200) throw new Error("Inconsistent operations health response");
  const critical = failed.filter(key => ["database", "scheduler", "sandbox"].includes(key));
  if (critical.length) throw new Error("Operational infrastructure checks failed");
  return failed;
}

async function runOperationsHealth(config, { fetchImpl = fetch, authorization = workerAuthorization, log = console, summaryPath = process.env.GITHUB_STEP_SUMMARY } = {}) {
  const response = await fetchImpl(new URL("/api/jobs/health", config.base), {
    headers: { authorization: await authorization(config) },
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });
  const warnings = classifyOperationsHealth(response.status, await response.json());
  const detail = warnings.length
    ? `Manual review remains open: ${warnings.map(key => labels[key]).join(", ")}. Review Admin > Operations; financial records were not changed by this check.`
    : "All operations checks passed.";
  if (summaryPath) appendFileSync(summaryPath, `## SGTech operations health\n\nDatabase, scheduler and payment configuration checks passed.\n\n${detail}\n`);
  if (warnings.length) log.warn("::warning title=Operations follow-up::" + detail);
  else log.info("Operations health check passed.");
  return { status: warnings.length ? "needs-attention" : "ok", warnings };
}
module.exports = { classifyOperationsHealth, runOperationsHealth };
if (require.main === module) {
  loadEnvConfig(process.cwd());
  Promise.resolve().then(() => runOperationsHealth(workerConfiguration())).catch(() => {
    console.error("Operations health check failed. Review the Operations page and job logs.");
    process.exitCode = 1;
  });
}
