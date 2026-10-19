# SGTech e-commerce

Personal portfolio project built with Next.js, TypeScript, NextAuth and Prisma/MongoDB. Online payments use sandbox/test mode; this demo does not process real money.

## Implemented

- Database catalog with products, SKUs, categories and brands; Vietnamese search, filters, sorting and server pagination.
- SKU-specific specifications, image gallery/zoom, warranty and box contents, with catalog forms for administrators.
- Browser cart, authenticated checkout, order history and manual shipment tracking.
- Versioned cart recovery and line-by-line price/stock checks; shoppers confirm changes and reselect ambiguous legacy options before checkout.
- Signed, time-limited delivery quotes and saved order totals shared by all payment methods, with per-line fee allocation and customer/admin breakdowns.
- Versioned delivery settings with audited administrator changes. The selected demo policy charges VND 15,000 and waives delivery from a VND 300,000 merchandise subtotal.
- Order confirmation independent of payment, COD acceptance/rejection, recipient corrections before packing and public/internal order notes with version checks and replay protection.
- Paid-order cancellation before carrier handover, an admin refund queue, full-refund adapters for Stripe/MoMo/VNPay/ZaloPay and recorded manual COD refund receipts. Uncertain submissions are reconciled using their original refund identity.
- Saved customer/admin support conversations with private images, product/SKU/order context, paginated history, read receipts and an administrator inbox with assignment and close/reopen actions.
- Support messages inside the floating widget, with drafts retained while closed, and saved in-app notifications for customers/administrators through a header bell and paginated notification pages.
- Saved order, verified-payment, shipment, cancellation and refund notifications, with a separate transactional email queue and audited manual retries. Event emails are disabled by default.
- Support requests with account-owned order/product/SKU context, private images, request references and status tracking. Administrators use the shared conversation assignment, private ticket notes and in-app request notifications.
- Return intake for delivered order lines with quantity allocation, private images, saved policy snapshots and shared support tickets/chat. Assigned administrators record instructions, receipt and inspection; eligible goods can be restocked once with an audited stock movement. Refund/exchange resolution remains pending separately.
- Equal-value replacements after return inspection: reserve an available SKU of the same product and original unit price, obtain customer approval of the saved SKU/destination, record carrier handover and confirm receipt/delivery. Decline/release before dispatch restores the reservation; confirmed delivery completes the case and resolves its linked ticket without changing the original payment.
- Replacement delivery incidents reported by customers or administrators, with assigned administrator follow-up, retained shipment evidence and a saved resolution history.
- Verified-purchase product reviews after confirmed delivery and stock dispatch, one review per customer/product, paginated history and ratings shared by product details, catalog cards and related products.
- Account-owned wishlists with add/remove actions, pagination and current catalog prices; unavailable products remain removable without revealing unpublished details.
- Draft/preview/publication of weekly support hours in Vietnam time, shared by help, footer and the support widget. Requests and messages remain available outside published hours.
- Administrator drafts, previews and immutable published versions of contacts, FAQs and shipping/return/warranty policies, shared by help pages, footer and widget. New orders save their applicable policy content; archived versions remain available after later edits.
- Atomic inventory reservations: concurrent buyers cannot reserve the same final unit. Stock adjustments and dispatch/release have audit records.
- COD collection/remittance records, follow-up queues, sales reports and CSV export.
- VNPay, MoMo, ZaloPay sandbox and Stripe test integrations with verified callbacks, idempotent checkout and payment reconciliation.
- Protected administration, session revocation, password reset/email verification and shared MongoDB rate limits.
- Operations dashboard, overdue online-hold review, recovery of interrupted card preparation, job leases, correlation references and scheduled monitoring.

## Run locally

The application is in `e-commerce/`.

```sh
cd e-commerce
npm ci
```

Copy `.env.example` to `.env`, configure a MongoDB replica set and the sandbox services you want to demonstrate. Then run:

```sh
npm run dev
```

Use an existing server at port 3000 if it is already running; Next.js allows one development server per application directory.

## Verification

```sh
npm test
npm run typecheck
npm run lint
npx next build --webpack
```

MongoDB integration tests create and remove databases with dedicated QA names. They do not modify the configured application database:

```sh
npm run test:stock-mongo
npm run test:catalog-mongo
npm run test:content-mongo
npm run test:engagement-mongo
npm run test:engagement-e2e
npm run test:support-mongo
npm run test:support-tickets-mongo
npm run test:returns-mongo
npm run test:returns-e2e
npm run test:customer-service-mongo
npm run test:email-mongo
npm run test:operations-mongo
npm run test:operations-e2e
```

The operations MongoDB check requires `mongodump` and `mongorestore`. The HTTP E2E check requires a production build; set `QA_BROWSER=true` to also test the admin UI in Chrome. GitHub Actions runs these checks with an isolated MongoDB replica set and uploads the JSON results.

## Demo operations

See [the operations runbook](e-commerce/OPERATIONS.md) for scheduler authentication, monitoring, hold recovery, backup/restore drills and rollback. The scheduler trusts a signed, short-lived GitHub Actions identity restricted to this repository, `main` and the operations workflow. Local workers can use `CRON_SECRET`.

## Remaining work

Canonical delivery-region validation, delivery-area changes with fee approval and delivery estimates from a reliable source; richer order lifecycle; actual provider refund UAT, duplicate/late-payment refund handling and partial refunds; exchanges with price differences, lost/returned replacement financial resolution and financial resolution of received returns; acceptance of the configured external email sender; warranty case management; review moderation/editing, promotions and further reporting. A support enquiry does not approve a return, warranty claim or refund. Return receipt/restocking, payment-issue decisions and cancellation approval alone do not confirm money returned. Production use with real money requires a separate merchant and operational acceptance process.
