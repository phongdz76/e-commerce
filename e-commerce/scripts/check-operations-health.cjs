const { loadEnvConfig } = require("@next/env");
const {
  workerConfiguration,
  workerAuthorization,
} = require("./payment-worker.cjs");
async function main() {
  loadEnvConfig(process.cwd());
  const config = workerConfiguration();
  const response = await fetch(new URL("/api/jobs/health", config.base), {
    headers: { authorization: await workerAuthorization(config) },
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new Error(
      "Operations need attention. Review the Operations page and job logs.",
    );
  const result = await response.json();
  if (result.status !== "ok") throw new Error("Invalid health result");
  console.log("Operations health check passed.");
}
main().catch(() => {
  console.error(
    "Operations health check failed. Review the Operations page and job logs.",
  );
  process.exitCode = 1;
});
