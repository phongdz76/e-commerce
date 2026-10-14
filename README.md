# SGTech e-commerce

Personal portfolio project built with Next.js, TypeScript, NextAuth and Prisma/MongoDB. Online payments use sandbox/test mode; this demo does not process real money.

## Implemented

- Database catalog with products, SKUs, categories and brands; Vietnamese search, filters, sorting and server pagination.
- SKU-specific specifications, image gallery/zoom, warranty and box contents, with catalog forms for administrators.
- Browser cart, authenticated checkout, order history and manual shipment tracking.
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
npm run test:operations-mongo
npm run test:operations-e2e
```

The operations MongoDB check requires `mongodump` and `mongorestore`. The HTTP E2E check requires a production build; set `QA_BROWSER=true` to also test the admin UI in Chrome. GitHub Actions runs these checks with an isolated MongoDB replica set and uploads the JSON results.

## Demo operations

See [the operations runbook](e-commerce/OPERATIONS.md) for scheduler authentication, monitoring, hold recovery, backup/restore drills and rollback. The scheduler trusts a signed, short-lived GitHub Actions identity restricted to this repository, `main` and the operations workflow. Local workers can use `CRON_SECRET`.

## Remaining work

Cart reconciliation and legacy carts; structured order totals/shipping quotes; complete COD confirmation and paid-order cancellation; refunds/returns; transactional notification outbox; reviews, wishlists, promotions and further reporting. A refunds follow-up screen does not execute a refund. Production use with real money requires a separate merchant and operational acceptance process.
