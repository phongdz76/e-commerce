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
- Payment-issue decisions remain separate from refund execution. Marking a duplicate/late payment for refund does not send money.

## Paid-order cancellation and refunds

Customers request cancellation from their order; administrators review requests in `/admin/refunds` and open the order to decide. This flow permits full cancellation before carrier handover (`pending`, `preparing`, `ready_to_ship`), including any saved delivery fee. Dispatched/consumed stock requires a return workflow instead. The request freezes shipment while awaiting a decision. Approval atomically cancels the commercial order and releases held stock; the original paid status, amount and payment reference are retained.

After approval, submit the refund to the original sandbox provider from the order. `APPROVED` means no submission has been made; `SENDING`, `PROCESSING` and `REVIEW` do not mean money returned. `SUCCEEDED` requires a matching provider refund result, or a separately recorded manual COD refund receipt. COD receipt entry records evidence of a refund performed outside the app and does not transfer money. Never use it to declare an online refund complete.

Before a new submission, the service checks the original payment/merchant. Stripe verifies the settled intent; MoMo/VNPay need a verified successful payment attempt with its transaction number; ZaloPay queries the original paid transaction. Missing configuration/source evidence leaves approval pending. Provider credentials are the existing sandbox/test credentials; new refund endpoints are fixed to sandbox and refuse redirects.

A submission identity is persisted before the network call. A timeout/crash/lost response must be recovered using **Check refund status**, with the original identity; no second create is issued. Stripe recovery can find the original refund by metadata if its response was lost. A missing or contradictory result remains `REVIEW`, including cases where a process may have stopped before sending. Inspect the provider's sandbox records before further operational action. Do not manufacture a new refund key or mark the record successful to clear the queue. A declined/failed provider operation needs review; the current flow does not offer arbitrary resubmission with a fresh identity.

The existing authenticated payment job queries up to five submitted refunds per run, with five minutes between checks and per-refund leases. It records `refundsChecked`; it never automatically submits approved refunds. Open refund work is visible in the Refunds queue. The existing Operations payment-health probe does not replace reviewing this queue. Dashboards/product reports retain their gross payment basis before refunds; they are not a net receipts ledger.

Provider contracts: [Stripe refunds](https://docs.stripe.com/api/refunds/create), [MoMo refunds and query](https://developers.momo.vn/v3/docs/payment/api/payment-api/refund/), [ZaloPay refund/query](https://developer.zalopay.vn/v2/general/overview.html), [VNPay refund/query](https://sandbox.vnpayment.vn/apis/docs/truy-van-hoan-tien/querydr%26refund.html). Unit/HTTP/browser QA uses provider fixtures and isolated databases. Actual sandbox refund acceptance is still a separate check for each merchant/provider.

## Customer support

Customers use `/support`; administrators use `/admin/support`. Each signed-in account has one saved conversation. Links from products and orders retain verified context. Administrators must accept an open conversation before replying or uploading an image; assignment changes use version checks and an audit record. Closing retains history, and reopening releases the previous assignment. The administrator read cursor belongs to the shared support team, rather than each individual administrator.

Visible conversation/inbox pages poll every ten seconds. This is not a real-time response guarantee. FAQ quick answers are automated and separate from human replies. No staffing schedule or 24/7 availability is promised; ticket linking, configured support hours and notification-center events remain future work. The Zalo contact link does not synchronize messages with this inbox.

Messages are limited to 2,000 characters and 20 sends per minute per account. Private PNG/JPEG/WebP images are limited to 1 MiB each and 20 uploads per rolling 24 hours per account; the server checks image signatures and access ownership. Images are stored as private MongoDB binary data and served through authenticated, non-cacheable endpoints. A failed send keeps the draft, image and request identity for retry. The existing payment job removes at most 50 unattached images older than 24 hours per run and reports `orphanSupportImagesRemoved`; it rechecks attachment binding before deleting.

The first authenticated send/upload initializes only the new `SupportConversation`, `SupportMessage` and `SupportAttachment` collections and their declared indexes before starting a transaction. The application database user needs collection/index creation permission for this initialization. Other database failures are surfaced, not ignored; no existing records are backfilled. Include all three collections and binary image values in backups. The isolated backup drill now verifies 17 collections.

Run `npm run test:support-mongo` for disposable-database first-use, concurrency, ownership, read-cursor, image-binding, cleanup and shared-quota checks. The production-server E2E suite also exercises separate customer/admin browser sessions, retry behavior, private image loading, saved history and close/reopen actions.

## Backup/restore drill

```sh
npm run test:operations-mongo
```

Install the MongoDB Database Tools first, or set `MONGODUMP_BIN` and `MONGORESTORE_BIN` to their executable paths. The script creates private fake data in `sgtech_ops_qa_*`, dumps a compressed BSON archive and restores it only into a distinct `sgtech_restore_qa_*` database. It compares documents, BSON values and indexes and then removes both QA databases. Application database names and other targets are refused. Connection credentials are passed through temporary tool config files which are removed; the archive contains fixture data only and stays in ignored artifacts.

The drill uses quiescent fixtures. It is not a consistent backup of a live application. Real deployment backup would require Atlas backup or a full replica-set backup with appropriate write consistency/oplog handling and retention/access controls.

## Rollback

Before merging, retain the previous successful Git SHA and Vercel deployment URL. If the new revision fails acceptance, promote/redeploy that previous successful deployment in Vercel and verify its health revision and public pages. Do not delete the new optional operational fields/collections, reset paid orders or release uncertain holds as a rollback step. The operations workflow uses the stable domain and must be disabled while rolling back to a version that does not support its authentication.

The GitHub verification workflow runs mock-provider security tests, real MongoDB concurrency, typed backup/restore and a compiled-server/browser E2E suite. Its artifacts are acceptance evidence for this demo; they do not certify real merchant payments, real-email delivery, social-account consent or production disaster recovery.
