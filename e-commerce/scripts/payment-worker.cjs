const { loadEnvConfig } = require("@next/env");
const { setTimeout: delay } = require("node:timers/promises");

function workerConfiguration(env = process.env) {
  const secret = env.CRON_SECRET?.trim();
  const githubOIDC =
    env.GITHUB_ACTIONS === "true" &&
    Boolean(
      env.ACTIONS_ID_TOKEN_REQUEST_URL && env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
    );
  if (!secret && !githubOIDC)
    throw new Error(
      "CRON_SECRET or a trusted GitHub Actions identity is required",
    );
  const base = new URL(
    env.PAYMENT_WORKER_APP_URL ||
      env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000",
  );
  if (
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    !["", "/"].includes(base.pathname) ||
    (base.protocol !== "https:" &&
      !(
        base.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(base.hostname)
      ))
  )
    throw new Error("The worker requires a root HTTPS or localhost URL");
  const interval = Number(env.PAYMENT_WORKER_INTERVAL_MS || 60000);
  const maxBatches = Number(env.PAYMENT_WORKER_MAX_BATCHES || 3);
  if (
    !Number.isSafeInteger(interval) ||
    interval < 60000 ||
    interval > 3600000 ||
    !Number.isSafeInteger(maxBatches) ||
    maxBatches < 1 ||
    maxBatches > 10
  )
    throw new Error(
      "Use an interval of 60000–3600000 ms and 1–10 batches per cycle",
    );
  return { secret, base, interval, maxBatches, githubOIDC };
}

async function workerAuthorization(config) {
  if (config.secret) return `Bearer ${config.secret}`;
  const url = new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".actions.githubusercontent.com") ||
    url.username ||
    url.password
  )
    throw new Error("Invalid identity provider URL");
  url.searchParams.set("audience", "sgtech-operations");
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`,
    },
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Unable to obtain workflow identity");
  const token = (await response.json()).value;
  if (typeof token !== "string" || token.length > 12000)
    throw new Error("Invalid workflow identity");
  return `Bearer ${token}`;
}

async function runWorker(
  config,
  {
    once = false,
    signal = new AbortController().signal,
    fetchImpl = fetch,
    sleep = delay,
    log = console,
  } = {},
) {
  let failed = false;
  do {
    try {
      for (
        let batch = 0;
        batch < config.maxBatches && !signal.aborted;
        batch++
      ) {
        const response = await fetchImpl(
          new URL("/api/jobs/reconcile-payments", config.base),
          {
            headers: { authorization: await workerAuthorization(config) },
            redirect: "error",
            signal: AbortSignal.any([signal, AbortSignal.timeout(240000)]),
          },
        );
        if (!response.ok) throw new Error("Reconciliation request failed");
        if (response.status === 202) {
          log.info("[Payments] Another worker owns this cycle.");
          break;
        }
        const result = await response.json();
        if (
          !Number.isSafeInteger(result.processed) ||
          result.processed < 0 ||
          result.processed > 1000 ||
          !Number.isSafeInteger(result.expiredCodHolds) ||
          result.expiredCodHolds < 0 ||
          result.expiredCodHolds > 50
        )
          throw new Error("Invalid reconciliation result");
        log.info(
          `[Payments] ${new Date().toISOString()} checked=${result.processed} expiredCod=${result.expiredCodHolds} batch=${batch + 1}`,
        );
        if (result.processed < 5 && result.expiredCodHolds < 50) break;
      }
    } catch {
      if (!signal.aborted) {
        failed = true;
        log.error(
          "[Payments] Reconciliation failed. Check Operations and scheduler configuration.",
        );
      }
    }
    if (once || signal.aborted) break;
    try {
      await sleep(config.interval, undefined, { signal });
    } catch {
      break;
    }
  } while (!signal.aborted);
  return failed ? 1 : 0;
}

async function main() {
  loadEnvConfig(process.cwd());
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort());
  process.once("SIGTERM", () => controller.abort());
  process.exitCode = await runWorker(workerConfiguration(), {
    once: process.argv.includes("--once"),
    signal: controller.signal,
  });
}
module.exports = { workerConfiguration, workerAuthorization, runWorker };
if (require.main === module)
  main().catch(() => {
    console.error("[Payments] Invalid worker configuration.");
    process.exitCode = 1;
  });
