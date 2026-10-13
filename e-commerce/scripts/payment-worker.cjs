const { loadEnvConfig } = require("@next/env");
const { setTimeout: delay } = require("node:timers/promises");

async function main() {
  loadEnvConfig(process.cwd());
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    throw new Error("CRON_SECRET is required");
  }
  const base = new URL(
    process.env.PAYMENT_WORKER_APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000",
  );
  if (
    base.username ||
    base.password ||
    (base.protocol !== "https:" &&
      !(
        base.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(base.hostname)
      ))
  ) {
    throw new Error("The worker requires HTTPS or a localhost URL");
  }
  const interval = Number(process.env.PAYMENT_WORKER_INTERVAL_MS || "60000");
  if (!Number.isSafeInteger(interval) || interval < 60000) {
    throw new Error("The worker interval must be at least 60000 ms");
  }
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort());
  process.once("SIGTERM", () => controller.abort());
  do {
    try {
      const response = await fetch(
        new URL("/api/jobs/reconcile-payments", base),
        {
          headers: { authorization: `Bearer ${secret}` },
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(240000),
          ]),
        },
      );
      if (!response.ok) {
        throw new Error("Reconciliation request failed");
      }
      const result = await response.json();
      console.info(
        `[Payments] ${new Date().toISOString()} checked=${result.processed}`,
      );
    } catch {
      if (!controller.signal.aborted) {
        console.error(
          "[Payments] Reconciliation failed. Check the application and scheduler configuration.",
        );
      }
    }
    if (process.argv.includes("--once") || controller.signal.aborted) {
      break;
    }
    try {
      await delay(interval, undefined, { signal: controller.signal });
    } catch {
      break;
    }
  } while (!controller.signal.aborted);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
