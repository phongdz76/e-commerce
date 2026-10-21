const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const sourceLoader = require('./fixtures/load-source.cjs');
const { fixture } = require('./fixtures/support-tickets.cjs');
const pure = sourceLoader(), utils = pure('utils/reviewModeration.ts');

function setup() {
  const reviews = new Map(), f = fixture([reviews]);
  const product = { id: 'e'.repeat(24), name: 'Verified review product' }, state = { visible: true, purchase: true };
  f.db.productReview = f.notifications.delegate(reviews);
  f.db.productReview.aggregate = async ({ where }) => {
    const rows = [...reviews.values()].filter(row => f.matches(row, where));
    return { _count: { _all: rows.length }, _avg: { rating: rows.length ? rows.reduce((sum, row) => sum + row.rating, 0) / rows.length : null } };
  };
  f.db.product = { findFirst: async () => state.visible ? product : null, findMany: async ({ where }) => where.status && !state.visible ? [] : [product] };
  f.db.order.findFirst = async ({ where }) => state.purchase && where.userId === f.owner.id ? { id: 'f'.repeat(24) } : null;
  class RateError extends Error { constructor() { super('Too many requests'); this.retryAfter = 30; } }
  const mocks = {
    '@/libs/prismadb': { __esModule: true, default: f.db },
    '@/libs/reviewModerationStorage': { ensureReviewModerationStorage: async () => {} },
    '@/libs/productEngagementStorage': { ensureProductEngagementStorage: async () => {} },
    '@/libs/authRateLimit': { AuthRateLimitError: RateError, checkAuthRateLimit: async () => { if (f.state.limited) throw new RateError(); } },
    '@/actions/getCurrentUser': { getCurrentUser: async () => f.state.user },
    '@/libs/storefrontProductNames': { storefrontWhere: { status: 'ACTIVE' } },
    'next/server': { NextResponse: { json: Response.json } },
  };
  const load = sourceLoader(mocks), service = load('libs/reviewModeration.ts'), engagement = load('libs/productEngagement.ts');
  function seed(extra = {}) {
    const row = { id: randomUUID().replaceAll('-', '').padEnd(64, '0'), userId: f.owner.id, productId: product.id, orderId: 'f'.repeat(24), rating: 2, comment: 'Original customer words are preserved.', authorName: 'A customer', createdAt: new Date(), ...extra };
    reviews.set(row.id, row); return row;
  }
  const act = (row, action, extra = {}) => service.moderateReview(f.admin.id, row.id, { action, version: reviews.get(row.id)?.version ?? 0, requestId: randomUUID(), ...extra });
  return { ...f, reviews, product, reviewState: state, load, service, engagement, seed, act, mocks };
}

test('review moderation validates bounded plain commands and filters without accepting forged customer data', () => {
  const base = { version: 0, requestId: randomUUID() };
  assert.deepEqual(utils.parseReviewCommand({ ...base, action: 'APPROVE', rating: 5, comment: 'forged', userId: 'victim' }), { ...base, action: 'APPROVE' });
  assert.equal(utils.reviewStatus(undefined), 'APPROVED'); assert.equal(utils.reviewStatus(null), 'APPROVED'); assert.equal(utils.reviewStatus('invalid'), 'HIDDEN');
  for (const b of [{ ...base, action: 'HIDE', reason: 'x' }, { ...base, action: 'REPLY', reply: 'x'.repeat(2001) }, { ...base, action: 'HIGHLIGHT', order: -1 }, { ...base, action: 'HIGHLIGHT', order: 0.5 }, { ...base, action: 'EDIT' }, { ...base, action: 'APPROVE', version: '0' }, { ...base, action: 'HIDE', reason: 'Bad\u0000text' }]) assert.equal(utils.parseReviewCommand(b), null);
  for (const query of ['page=0', 'page=1000', 'status=FAKE', 'rating=6', 'status=ALL&status=PENDING', 'ownerId=victim', 'highlighted=false', 'productId=not-an-id']) assert.equal(utils.parseReviewFilters(new URLSearchParams(query)), null);
  assert.deepEqual(utils.parseReviewFilters(new URLSearchParams('status=APPROVED&rating=2&highlighted=true')), { page: 1, status: 'APPROVED', rating: 2, productId: null, highlighted: true });
});

test('new reviews await moderation and remain visible only to their actual author; legacy public reviews still count', async () => {
  const f = setup(), legacy = f.seed(), nullLegacy = f.seed({ status: null, rating: 4 });
  f.seed({ status: 'HIDDEN', rating: 5 });
  f.seed({ status: 'PENDING', rating: 5 });
  const created = await f.engagement.createProductReview(f.owner, f.product.id, { rating: 1, comment: 'My newly delivered item review.' });
  assert.equal(created.status, 'PENDING'); assert.equal(created.reply, null);
  assert.equal((await f.engagement.getProductReviews(f.product.id, f.owner.id, 1)).ownReview.status, 'PENDING');
  const publicPage = await f.engagement.getProductReviews(f.product.id, null, 1);
  assert.equal(publicPage.total, 2); assert.equal(publicPage.average, 3);
  assert.deepEqual(new Set(publicPage.items.map(row => row.id)), new Set([legacy.id, nullLegacy.id]));
  assert.equal((await f.engagement.getProductReviews(f.product.id, f.other.id, 1)).ownReview, null);
  assert.doesNotMatch(JSON.stringify(publicPage), /userId|orderId|moderationReason|fingerprint|status/);
  assert.equal((await f.engagement.createProductReview(f.owner, f.product.id, { rating: 1, comment: created.comment })).id, created.id);
  await assert.rejects(f.engagement.createProductReview(f.owner, f.product.id, { rating: 5, comment: created.comment }), error => error.code === 'REVIEW_EXISTS');
  await assert.rejects(f.engagement.createProductReview(f.other, f.product.id, { rating: 1, comment: created.comment }), error => error.code === 'REVIEW_PURCHASE_REQUIRED');
});

test('moderation replays once, rejects stale/changed commands and keeps approval/reply/audit/notification atomic', async () => {
  const f = setup(), row = f.seed({ status: 'PENDING', version: 0 });
  const input = { action: 'APPROVE', version: 0, requestId: randomUUID() };
  await Promise.all(Array.from({ length: 6 }, () => f.service.moderateReview(f.admin.id, row.id, input)));
  assert.equal(f.reviews.get(row.id).version, 1); assert.equal(f.notifications.notifications.size, 1);
  await assert.rejects(f.service.moderateReview(f.admin.id, row.id, { ...input, action: 'HIDE', reason: 'Changed replay payload' }), error => error.status === 409);
  await assert.rejects(f.service.moderateReview(f.admin2.id, row.id, input), error => error.status === 409);
  await f.act(row, 'REPLY', { reply: 'Thanks for your detailed feedback.' });
  assert.equal(f.notifications.notifications.size, 2);
  const page = await f.engagement.getProductReviews(f.product.id, null, 1);
  assert.equal(page.items[0].reply.comment, 'Thanks for your detailed feedback.');
  assert.equal(f.reviews.get(row.id).comment, row.comment); assert.equal(f.reviews.get(row.id).rating, row.rating);
  assert.doesNotMatch(JSON.stringify([...f.notifications.notifications.values()]), /Original customer words|Thanks for your detailed feedback/);
  const history = await f.service.getAdminReview(row.id);
  assert.equal(history.history.length, 2);
  assert.doesNotMatch(JSON.stringify(history), /userId|orderId|fingerprint|actorId/);
});

test('hiding removes highlights and rating contribution; reply/highlight require public reviews and cannot expose hidden text', async () => {
  const f = setup(), row = f.seed();
  await f.act(row, 'HIGHLIGHT', { order: 5 });
  await f.act(row, 'HIDE', { reason: 'Contains private delivery details' });
  assert.equal(f.reviews.get(row.id).highlightOrder, null);
  assert.equal((await f.engagement.getProductReviews(f.product.id, null, 1)).total, 0);
  await assert.rejects(f.act(row, 'REPLY', { reply: 'This reply must not be public.' }), error => error.code === 'REVIEW_NOT_PUBLIC');
  await assert.rejects(f.act(row, 'HIGHLIGHT', { order: 0 }), error => error.code === 'REVIEW_NOT_PUBLIC');
  await f.act(row, 'APPROVE'); f.reviewState.visible = false;
  await assert.rejects(f.act(row, 'HIGHLIGHT', { order: 0 }), error => error.code === 'REVIEW_NOT_PUBLIC');
  await assert.rejects(f.act(row, 'REPLY', { reply: 'This reply must not be public.' }), error => error.code === 'REVIEW_NOT_PUBLIC');
});

test('audit or notification failure rolls back review text/state/version and retry can complete', async () => {
  const f = setup(), row = f.seed({ status: 'PENDING', version: 0 });
  const originalAudit = f.db.auditLog.create;
  f.db.auditLog.create = async () => { throw Error('QA audit unavailable'); };
  await assert.rejects(f.act(row, 'APPROVE'));
  assert.equal(f.reviews.get(row.id).status, 'PENDING'); assert.equal(f.reviews.get(row.id).version, 0);
  f.db.auditLog.create = originalAudit;
  const originalNotify = f.db.notification.create;
  f.db.notification.create = async () => { throw Error('QA inbox unavailable'); };
  await assert.rejects(f.act(row, 'APPROVE'));
  assert.equal(f.reviews.get(row.id).status, 'PENDING'); assert.equal(f.notifications.events.size, 0);
  assert.equal((await f.service.getAdminReview(row.id)).history.length, 0);
  f.db.notification.create = originalNotify;
  await f.act(row, 'APPROVE'); assert.equal(f.reviews.get(row.id).version, 1);
});

test('review admin routes enforce roles, origin, body/query bounds, private DTOs and rate limits', async () => {
  const f = setup(), row = f.seed({ status: 'PENDING', version: 0 });
  const list = f.load('app/api/admin/reviews/route.ts'), item = f.load('app/api/admin/reviews/[reviewId]/route.ts');
  const context = { params: Promise.resolve({ reviewId: row.id }) };
  const request = (body, headers = {}, query = '') => new Request('http://local' + query, body === undefined ? { headers } : { method: 'POST', headers, body: JSON.stringify(body) });
  f.state.user = null; assert.equal((await list.GET(request())).status, 401); assert.equal((await item.GET(request(), context)).status, 401);
  f.state.user = f.owner; assert.equal((await list.GET(request())).status, 403); assert.equal((await item.POST(request({}), context)).status, 403);
  f.state.user = f.admin;
  assert.equal((await list.GET(request(undefined, {}, '?status=INVALID'))).status, 400);
  assert.equal((await item.GET(request(undefined, {}, '?page=0'), context)).status, 400);
  assert.equal((await item.GET(request(), { params: Promise.resolve({ reviewId: 'invalid' }) })).status, 404);
  const input = { action: 'APPROVE', version: 0, requestId: randomUUID(), userId: f.other.id };
  assert.equal((await item.POST(request(input, { Origin: 'http://evil.invalid' }), context)).status, 403);
  assert.equal((await item.POST(request({ ...input, padding: 'x'.repeat(17000) }), context)).status, 413);
  f.state.limited = true;
  const limited = await item.POST(request(input), context); assert.equal(limited.status, 429); assert.equal(limited.headers.get('Retry-After'), '30');
  f.state.limited = false;
  const response = await item.POST(request(input, { Origin: 'https://shop.test', host: 'shop.test', 'x-forwarded-proto': 'https' }), context);
  assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  const approved = await list.GET(request(undefined, {}, '?status=APPROVED&rating=2'));
  assert.equal((await approved.json()).total, 1);
  f.db.productReview.findMany = async () => { throw Error('private credentials'); };
  const failed = await list.GET(request()); assert.equal(failed.status, 503); assert.doesNotMatch(JSON.stringify(await failed.json()), /credentials/);
});
