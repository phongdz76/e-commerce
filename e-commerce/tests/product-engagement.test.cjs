const test = require('node:test');
const assert = require('node:assert/strict');
const sourceLoader = require('./fixtures/load-source.cjs');

test('review parsing accepts 1–5 whole stars and bounded readable text, discarding forged ownership fields', () => {
  const { parseReview, engagementPage } = sourceLoader()('utils/productEngagement.ts');
  const valid = { rating: 5, comment: '  A useful and reliable product.  ', userId: 'forged', orderId: 'forged', authorName: 'forged' };
  assert.deepEqual(parseReview(valid), { rating: 5, comment: valid.comment.trim() });
  for (const value of [null, [], {}, { ...valid, rating: '5' }, { ...valid, rating: 0 }, { ...valid, rating: 6 },
    { ...valid, rating: 1.5 }, { ...valid, comment: '   short  ' }, { ...valid, comment: 'x'.repeat(1001) },
    { ...valid, comment: 'Invalid\u0000 control character' }]) assert.equal(parseReview(value), null);
  assert.ok(parseReview({ rating: 1, comment: 'x'.repeat(1000) }));
  assert.equal(engagementPage(null), 1);
  for (const value of ['0', '-1', '1.5', '1e2', '1001', 'abc', '']) assert.equal(engagementPage(value), null);
  assert.equal(engagementPage('1000'), 1000);
});

function routes() {
  const state = { user: null, calls: [], failure: null };
  const service = Object.fromEntries(['getProductReviews', 'createProductReview', 'getWishlist', 'wishlistStatus', 'saveWishlistItem', 'removeWishlistItem'].map(method => [method, async (...args) => {
    state.calls.push({ method, args });
    if (state.failure) throw state.failure;
    return { saved: method !== 'removeWishlistItem' };
  }]));
  const load = sourceLoader({ '@/actions/getCurrentUser': { getCurrentUser: async () => state.user }, '@/libs/productEngagement': service });
  const productId = 'a'.repeat(24), context = { params: Promise.resolve({ productId: productId.toUpperCase() }) };
  const request = (body, url = 'http://local') => new Request(url, body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) });
  return { state, load, productId, context, request };
}

test('wishlist endpoints require a session, validate IDs and pagination, and derive account ownership from session', async () => {
  const f = routes(), item = f.load('app/api/wishlist/[productId]/route.ts'), list = f.load('app/api/wishlist/route.ts');
  for (const action of [item.GET, item.PUT, item.DELETE]) assert.equal((await action(f.request(), f.context)).status, 401);
  assert.equal((await list.GET(f.request())).status, 401);
  assert.equal(f.state.calls.length, 0);
  f.state.user = { id: 'b'.repeat(24), name: 'Customer' };
  assert.equal((await item.PUT(f.request(), { params: Promise.resolve({ productId: 'invalid' }) })).status, 404);
  assert.equal((await list.GET(f.request(undefined, 'http://local?page=1001'))).status, 400);
  await item.PUT(f.request({ userId: 'victim' }), f.context);
  assert.deepEqual(f.state.calls.at(-1), { method: 'saveWishlistItem', args: [f.state.user.id, f.productId] });
  const response = await item.DELETE(f.request(), f.context);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(f.state.calls.at(-1), { method: 'removeWishlistItem', args: [f.state.user.id, f.productId] });
});

test('reviews allow public reading, require a session for writes, reject invalid input and mask unexpected failures', async () => {
  const f = routes(), route = f.load('app/api/products/[productId]/reviews/route.ts');
  assert.equal((await route.GET(f.request(), f.context)).status, 200);
  assert.deepEqual(f.state.calls.at(-1).args, [f.productId, null, 1]);
  assert.equal((await route.POST(f.request({ rating: 5, comment: 'A good product for daily use.' }), f.context)).status, 401);
  f.state.user = { id: 'b'.repeat(24), name: 'Customer' };
  assert.equal((await route.POST(f.request({ rating: 5, comment: 'short' }), f.context)).status, 400);
  const response = await route.POST(f.request({ rating: 5, comment: 'A good product for daily use.', userId: 'victim', orderId: 'forged' }), f.context);
  assert.equal(response.status, 200);
  assert.deepEqual(f.state.calls.at(-1).args, [f.state.user, f.productId, { rating: 5, comment: 'A good product for daily use.' }]);
  f.state.failure = Error('Database credentials must stay private');
  const failed = await route.GET(f.request(), f.context);
  assert.equal(failed.status, 503);
  assert.doesNotMatch(JSON.stringify(await failed.json()), /credentials/);
  const { AuthRateLimitError } = f.load('libs/authRateLimit.ts');
  f.state.failure = new AuthRateLimitError(30);
  const limited = await route.POST(f.request({ rating: 5, comment: 'A good product for daily use.' }), f.context);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('Retry-After'), '30');
});
