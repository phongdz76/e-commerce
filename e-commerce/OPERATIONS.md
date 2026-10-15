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

Visible conversation/inbox pages poll every ten seconds. This is not a real-time response guarantee. FAQ quick answers are automated and separate from human replies. A published weekly schedule describes support hours, not whether a staff member is online or a response-time guarantee. The Zalo contact link does not synchronize messages with this inbox.

Messages are limited to 2,000 characters and 20 sends per minute per account. Private PNG/JPEG/WebP images are limited to 1 MiB each and 20 uploads per rolling 24 hours per account; the server checks image signatures and access ownership. Images are stored as private MongoDB binary data and served through authenticated, non-cacheable endpoints. A failed send keeps the draft, image and request identity for retry. The existing payment job removes at most 50 unattached images older than 24 hours per run and reports `orphanSupportImagesRemoved`; it rechecks attachment binding before deleting.

The first authenticated send/upload initializes `SupportConversation`, `SupportMessage` and `SupportAttachment` before starting a transaction. Domain writes initialize `NotificationEvent`, `NotificationInbox`, `Notification` and `NotificationDelivery`; ticket/settings writes also initialize `SupportTicket`, `SupportTicketNote` and `SupportSettings`. CMS writes initialize `CustomerServiceSettings`, `CustomerServiceRevision` and the shared `AuditLog` if absent. Initialization creates the declared indexes outside transactions. The database user needs collection/index creation permission. Other failures are surfaced; existing records are not backfilled. Include these twelve feature collections, the shared audit collection and binary images in backups. The isolated backup drill covers 26 collections.

The floating widget's **Support team** tab uses the saved conversation. Closing/switching tabs retains the draft within the current page and stops message polling. **Quick answers** remains automated. The header bell and `/notifications` or `/admin/notifications` show saved support alerts, with all/unread filters and cursor-based history. A customer message alerts its active assigned administrator, or active administrators when unassigned/the assignee is unavailable. An administrator reply alerts the conversation owner. No alert is sent to the person who authored the message.

Notification read state is personal and separate from the shared team chat cursor. **Mark all as read** covers only the inbox sequence observed during loading; a later message remains unread. Message, event and recipient notifications commit together and use stable identities, so a failed notification write also rolls back the message for safe retry. Chat transactions back off on confirmed conflicts with bounded retries and never retry uncertain transaction outcomes.

Stock/payment transactions retain their four-attempt limit for confirmed P2034/P2002 conflicts and now wait briefly between attempts so an order's notification fanout can commit. They do not retry uncertain P2028 outcomes or generic connection failures. Provider calls remain outside these database transaction callbacks.

In-app alerts also cover new orders, confirmation/rejection, recipient correction, public notes, verified payment, shipment changes, cancellation and refund decisions/results. Card preparation drafts do not announce an order before a confirmed payment. Private order/shipping notes never publish. Approval is labelled refund pending; uncertain refund results alert administrators for review; manual COD receipts are labelled as manual records. Stable event identities and the separate `NotificationDelivery` row are written in the same domain transaction. SMTP is processed afterwards and cannot roll back the order.

Run `npm run test:support-mongo` for disposable-database first-use, concurrency, ownership, read-cursor, image-binding, cleanup and shared-quota checks. The production-server E2E suite also exercises separate customer/admin browser sessions, retry behavior, private image loading, saved history and close/reopen actions.

## Support requests and published hours

Customers create and track requests at `/support/requests`; contact/help/footer/widget/account-menu links lead there. The warranty product link opens the enquiry form with its selected product/SKU. Optional order choices are scoped to the current account; the server checks ownership and resolves product labels itself. Return/warranty categories are support enquiries, not a new approval, financial transaction or warranty case.

Creation atomically saves a ticket, the initial message (with the request reference), an optional private image binding, audit record and recipient notifications. Ten new requests per rolling hour and the existing chat send quota apply per account; saved identical requests replay without creating another record. A new request can reopen a closed shared conversation. The original request and image stay available on its detail page even when later chat messages have paginated it out.

Administrators use `/admin/support-requests` and the existing conversation inbox. Assignment belongs to the shared conversation, so multiple requests from one customer do not acquire competing handlers. Accept that conversation before updating request status or writing internal notes. The conversation links back to its customer's filtered request list. Status decisions and assignment/close operations lock the same versioned conversation, preventing an old handler from deciding concurrently with release/close. Resolving or closing a request leaves the shared conversation and other requests intact. A customer may close a resolved request or reopen a resolved/closed one; reopening a closed conversation clears its old assignment.

States are OPEN, IN_PROGRESS, WAITING_CUSTOMER (reply requested), RESOLVED and CLOSED. Status is managed per request; an unscoped message in the shared chat does not automatically change every request. Private ticket notes are administrator-only, limited to 1,000 characters, paginated twenty at a time and excluded from chat/customer projections and notifications. Request creation/status events use personal in-app notifications and stable keys; individual chat replies retain the chat notification route. No ticket/chat emails are sent by the order-email worker.

Administrators edit `/admin/support-hours`: Save hours draft, inspect the draft preview, then Publish saved hours. Publication copies the saved draft with a version check and audit; drafts never appear in `/api/support/hours`. The first version is unconfigured and promises no hours. The schedule has exactly seven days, one same-day interval per day and the fixed `Asia/Ho_Chi_Minh` zone. Start is inclusive, end exclusive; overnight/multiple intervals and holiday overrides are not implemented. Help/footer/widget panels fetch published hours and refresh at most once per minute while visible. Opening hours do not block intake or claim anyone is online.

## Published contacts, FAQs and order policies

Use `/admin/customer-service` to edit contact details, FAQ answers and the contact/shipping/returns/warranty help pages. Save content draft, inspect the preview, then Publish saved content. Drafts stay private; stale editors receive a conflict and must reload. Identical saved actions replay using their original request identity. Publication writes the immutable revision, settings pointer and audit in one transaction. Published history is paginated; Review revision leaves the editor intact, and Use reviewed revision as draft replaces only the saved draft. Publishing that draft creates a new revision, preserving the archived source.

Before the first publication, help/widget answers are labelled demo guidance, contact actions and maps are absent, and no opening hours or store terms are invented. The admin starter content requires review. Contact options are optional: clearing a field hides that option. Zalo URLs accept only HTTPS `zalo.me` profiles; map embeds accept only Google Maps `/maps/embed?pb=...` URLs. Policy and FAQ text is rendered as text. Help/footer/widget use `/api/customer-service` with published content only; client surfaces refresh on navigation, after publication in the same page and once a minute while visible. No Zalo OA messages or external contact messages are sent by publication.

Delivery quotes bind the published revision identity. Publishing any service revision invalidates older quotes for a new checkout, even if the monetary total is unchanged. The customer must review and request a new quote. Creating a new order saves shipping/return/warranty content and the publication identity atomically with the order and stock hold. Retrying a committed checkout with its original request and quote resumes that order and keeps its original snapshot. Current policy edits and restores do not modify existing orders; older orders without a snapshot display that fact and receive no retroactive policy. Customer/admin order details link to `/help/<topic>?revision=<id>`, which remains publicly readable for published versions. Contact details on archived pages remain the current store contacts.

Policy text does not set delivery prices: `/admin/shipping-settings` remains authoritative for charges (demo VND 15,000, waived from VND 300,000). This CMS does not approve a return or warranty claim. No application-database schema push, backfill, initial publication or contact configuration is performed by these verification scripts. New settings/revision collections and their indexes are created lazily when an administrator first saves content.

`npm run test:customer-service-mongo` checks disposable-database first use, concurrent retries/editors, immutable publication, quote invalidation, transactional rollback and history pagination. The HTTP/browser suite checks publication, contact/FAQ consistency, retained editor state after failures and saved order policy history. The BSON backup drill includes 26 collections, populated published/draft CMS content and an order policy snapshot.

`npm run test:support-tickets-mongo` checks first-use/concurrent retries, ownership, image binding, note privacy/pagination, assignment versus status races, atomic rollback and draft/publication using separate disposable MongoDB databases. The production HTTP/browser suite adds two-account form/retry/image/history/status/notification and hours publication checks.

## Transactional email queue

Event email is opt-in: `SGTECH_EVENT_EMAILS_ENABLED=false` by default. To enable it, configure the existing Gmail sender's `EMAIL_USER` and `EMAIL_PASSWORD`, plus a canonical HTTPS `NEXT_PUBLIC_APP_URL` (or `NEXTAUTH_URL`; HTTP is allowed only for localhost). Verify the sender with a controlled account and review the pending backlog before enabling: saved pending events are eligible in oldest-first batches. No external sender acceptance has been performed by the local QA suite. The flag affects event emails only; password-reset/verification email keeps its existing flow.

Administrators use `/admin/notifications/email` to filter delivery states, inspect the last email job, and queue a retry with a reason. Customers cannot access this queue. Only active accounts with verified email addresses are eligible; the worker checks the current address again immediately before submission. There are no support-chat email digests in this release.

Run `npm run worker:emails` for one authenticated batch of at most five messages. The existing operations workflow invokes it after payment reconciliation/health, even if those steps failed; an SMTP failure does not skip or overwrite payment health. `/api/jobs/notification-emails` uses the existing CRON/OIDC authorization and a separate `notification-email` job lease/metrics. The server flag must be enabled; a disabled job returns `disabled: 1` without claiming or sending. The deployment must contain the endpoint before publishing the workflow change.

`PENDING` is queued, `SENDING` is leased, `RETRY` waits for backoff, `FAILED` stops, `SKIPPED` lacks an eligible recipient, and `UNKNOWN` needs review. `SENT` means the SMTP server accepted the recipient/message; it does not confirm inbox placement or reading. Known SMTP 4xx/pre-submission failures retry up to five automatic attempts with exponential backoff. SMTP 5xx/auth failures stop. Lost replies, expired sending leases and failed result commits stay unknown and are never automatically resubmitted. Message-ID stays stable across manual retries, but SMTP cannot guarantee exactly-once delivery.

Manual retries accept only FAILED/UNKNOWN/SKIPPED rows with the observed version and stable request identity, require a 10–500 character reason and an eligible recipient, and are limited to ten per administrator per 24 hours. UNKNOWN additionally requires acknowledging possible duplicate delivery. This queues another attempt; it never sends synchronously. Reasons and the previous state are audited; public notifications and logs omit private content and raw SMTP responses.

`npm run test:email-mongo` creates a disposable QA database and a loopback-only SMTP receiver. It checks concurrent claims/replays, real SMTP acceptance/451/550/disconnect outcomes, result-commit interruption, conservative lease recovery, blocked/unverified recipients and audited manual retries. It sends no external email. Transport timeout and access options follow the [Nodemailer SMTP documentation](https://nodemailer.com/smtp).

## Backup/restore drill

```sh
npm run test:operations-mongo
```

Install the MongoDB Database Tools first, or set `MONGODUMP_BIN` and `MONGORESTORE_BIN` to their executable paths. The script creates private fake data in `sgtech_ops_qa_*`, dumps a compressed BSON archive and restores it only into a distinct `sgtech_restore_qa_*` database. It compares documents, BSON values and indexes and then removes both QA databases. Application database names and other targets are refused. Connection credentials are passed through temporary tool config files which are removed; the archive contains fixture data only and stays in ignored artifacts.

The drill uses quiescent fixtures. It is not a consistent backup of a live application. Real deployment backup would require Atlas backup or a full replica-set backup with appropriate write consistency/oplog handling and retention/access controls.

## Rollback

Before merging, retain the previous successful Git SHA and Vercel deployment URL. If the new revision fails acceptance, promote/redeploy that previous successful deployment in Vercel and verify its health revision and public pages. Do not delete the new optional operational fields/collections, reset paid orders or release uncertain holds as a rollback step. The operations workflow uses the stable domain and must be disabled while rolling back to a version that does not support its authentication.

The GitHub verification workflow runs mock-provider security tests, real MongoDB concurrency, typed backup/restore and a compiled-server/browser E2E suite. Its artifacts are acceptance evidence for this demo; they do not certify real merchant payments, real-email delivery, social-account consent or production disaster recovery.
