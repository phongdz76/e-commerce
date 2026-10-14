import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  _request,
  context,
) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { recordOperationalIncident } = await import("@/libs/operationalJobs");
  const digest =
    error &&
    typeof error === "object" &&
    "digest" in error &&
    typeof error.digest === "string"
      ? error.digest
      : undefined;
  await recordOperationalIncident(
    "NEXT_REQUEST_FAILED",
    context.routePath,
    digest,
  );
};
