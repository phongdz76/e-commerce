# SGTech portfolio demo — operations runbook

This project's acceptance scope is a personal CV demo. Use virtual/test funds only. VNPay and MoMo reject non-sandbox endpoints; ZaloPay uses its sandbox endpoint; Stripe live secret keys are refused and checkout exposes cards only with test keys and webhook configuration.

## Deployment and checks

Use the Vercel project with application root `e-commerce`. Set environment values in Vercel; never commit `.env` or credentials. `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` must reference the stable HTTPS demo domain. Register provider callbacks against that domain if demonstrating the actual sandbox UIs.

```sh
node scripts/check-deployment.cjs --url=https://your-demo.vercel.app/ --revision=EXPECTED_GIT_SHA
```

This probe checks the deployed revision, demo marker, public pages and anonymous access controls. It performs no payment or order writes. CI separately exercises handlers with provider fixtures and runs real HTTP checkouts, login, job execution and admin pages against a disposable MongoDB database.

## Scheduler

`.github/workflows/operations.yml` supports a manual run and a schedule every five minutes. On this repository set:

- Actions variable `SGTECH_APP_URL` to the stable Vercel HTTPS origin.
- Actions variable `SGTECH_OPERATIONS_ENABLED` to `true` after deployment checks pass.

The workflow requests an OIDC token with audience `sgtech-operations` and `id-token: write`. The server verifies GitHub's signature and restricts repository/owner IDs, repository name, `main`, the exact workflow path, schedule/manual events, issuer, audience and token lifetime. Pull requests, other branches/workflows and unrelated repositories cannot authorize the job. Repository clones must configure their own `SGTECH_GITHUB_REPOSITORY`, `SGTECH_GITHUB_REPOSITORY_ID` and `SGTECH_GITHUB_OWNER_ID` on Vercel. No long-lived GitHub token or Vercel token is sent to the application.

For a local worker use the same random `CRON_SECRET` on the app and worker:

```sh
node scripts/payment-worker.cjs --once
npm run worker:payments
```

Each cycle drains a bounded number of batches; an empty queue or another job owner stops draining. A failed one-shot worker returns a nonzero exit code. The database job lease prevents overlapping scheduler runs, supports restart recovery and prevents a stale owner from overwriting a replacement run. Never-submitted drafts and already-leased attempts cannot starve submitted payments in the queue.

GitHub schedules can be delayed and inactive public repositories may have schedules disabled after inactivity. This demo is not a real-time service guarantee. Check the Actions schedule and Operations heartbeat before demonstrating expiry.

## Monitor and alerts

- `/api/health`: public liveness, sandbox-demo marker and deployed revision only.
- `/api/jobs/health`: authenticated readiness probe; returns a failure if the last successful run is older than 15 minutes, the last run failed, or uncertain payments/overdue holds need attention.
- `/admin/operations`: ADMIN-only heartbeat, review counts and sanitized incident references.
- `/admin/operations/holds`: ADMIN-only overdue unpaid online holds, age, recovery instructions and safe actions. The one-hour threshold triggers review; it does not release stock.

The workflow fails when reconciliation or health fails, making the run visible in GitHub Actions. Configure/watch the repository's Actions notifications to receive those failures; no separate Slack/email integration is assumed. Use the incident reference in Vercel logs and the Operations page. Raw messages, headers, tokens, query strings and stack traces are not stored in the incident model.

## Hold recovery

- An interrupted Stripe preparation can be recovered by an administrator with a reason, explicit confirmation and the current reservation version. It replays the original parameters/idempotency key and attaches the original test intent atomically. It does not expose `client_secret`, confirm a charge or release stock.
- Recovery is refused beyond 23 hours because Stripe can remove idempotency records after 24 hours. Inspect older requests in the Stripe test dashboard before deciding how to handle them.
- MoMo stock can be released after a verified terminal-failure query for all relevant submitted attempts; no guessed local expiry is used. Pending, missing, unauthenticated or unknown outcomes keep stock.
- VNPay still requires its expiry and verified closure. Late payments after release are recorded as payment issues; they cannot consume another order's reserved units.
- Refund follow-up remains a separate P1 feature. Marking an issue for refund does not send money.

## Backup/restore drill

```sh
npm run test:operations-mongo
```

Install the MongoDB Database Tools first, or set `MONGODUMP_BIN` and `MONGORESTORE_BIN` to their executable paths. The script creates private fake data in `sgtech_ops_qa_*`, dumps a compressed BSON archive and restores it only into a distinct `sgtech_restore_qa_*` database. It compares documents, BSON values and indexes and then removes both QA databases. Application database names and other targets are refused. Connection credentials are passed through temporary tool config files which are removed; the archive contains fixture data only and stays in ignored artifacts.

The drill uses quiescent fixtures. It is not a consistent backup of a live application. Real deployment backup would require Atlas backup or a full replica-set backup with appropriate write consistency/oplog handling and retention/access controls.

## Rollback

Before merging, retain the previous successful Git SHA and Vercel deployment URL. If the new revision fails acceptance, promote/redeploy that previous successful deployment in Vercel and verify its health revision and public pages. Do not delete the new optional operational fields/collections, reset paid orders or release uncertain holds as a rollback step. The operations workflow uses the stable domain and must be disabled while rolling back to a version that does not support its authentication.

The GitHub verification workflow runs mock-provider security tests, real MongoDB concurrency, typed backup/restore and a compiled-server/browser E2E suite. Its artifacts are acceptance evidence for this demo; they do not certify real merchant payments, real-email delivery, social-account consent or production disaster recovery.
