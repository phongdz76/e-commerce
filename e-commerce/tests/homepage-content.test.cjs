const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const sourceLoader = require('./fixtures/load-source.cjs');
const { fixture } = require('./fixtures/support-tickets.cjs');
const pure = sourceLoader();
const starter = () => pure('utils/homepageStarter.ts').starterHomeContent();
const utils = pure('utils/homepageContent.ts');

function setup() {
  const f = fixture();
  f.db.homepageSettings = f.db.customerServiceSettings;
  f.db.homepageRevision = f.db.customerServiceRevision;
  const categories = ['Phone', 'Laptop', 'Headphone', 'Watch', 'Desktop', 'Accessories'].map((name, i) => ({ id: String(i + 1).repeat(24), name, slug: name.toLowerCase() }));
  const brands = [{ id: '7'.repeat(24), name: 'Apple', slug: 'apple' }];
  const products = [{ id: '8'.repeat(24), name: 'QA featured product', variants: [{ id: '9'.repeat(24), price: 100, image: { image: '/products/iphone14-white.webp', color: 'White', colorCode: '#fff' }, available: 2 }] }];
  const state = { hidden: false, offline: false };
  f.db.category = { findMany: async () => categories };
  f.db.brand = { findMany: async () => brands };
  f.db.product = { findMany: async ({ where }) => state.hidden ? [] : products.filter(product => where.id.in.includes(product.id)) };
  f.db.productReview = { findMany: async () => [] };
  const map = rows => rows.map(row => ({ id: row.id, label: row.name, value: row.slug }));
  const groups = { categories: map(categories), brands: map(brands) };
  class RateError extends Error { constructor() { super('Too many requests'); this.retryAfter = 30; } }
  const load = sourceLoader({
    '@/libs/prismadb': { __esModule: true, default: f.db },
    '@/libs/homepageStorage': { ensureHomepageStorage: async () => {} },
    '@/libs/authRateLimit': { AuthRateLimitError: RateError, checkAuthRateLimit: async () => { if (f.state.limited) throw new RateError(); } },
    '@/actions/getCurrentUser': { getCurrentUser: async () => f.state.user },
    '@/libs/storefrontCatalog': {
      getCatalogGroups: async () => groups,
      getCatalogPage: async () => { if (state.offline) throw Error('private-database-secret'); return { products: [], categories: groups.categories.map(group => ({ ...group, count: 1 })), brands: groups.brands.map(group => ({ ...group, count: 1 })), total: 0 }; },
    },
    '@/libs/storefrontProductNames': { storefrontWhere: { status: 'ACTIVE' }, getStorefrontProductsByIds: async ids => state.hidden ? [] : products.filter(product => ids.includes(product.id)) },
    'next/server': { NextResponse: { json: Response.json } },
  });
  const cms = load('libs/homepageContent.ts');
  const act = (action, version, extra = {}) => cms.updateHomepage(f.admin.id, { action, version, requestId: randomUUID(), content: null, revisionId: null, ...extra });
  return { ...f, load, cms, act, groups, products, homeState: state };
}

test('homepage content validates image hosts, local paths, plain targets, bounds and schedule instants', () => {
  assert.ok(utils.parseHomeContent(starter()));
  for (const src of ['javascript:alert(1)', '//evil.invalid/image.png', '/home/../../secret.png', '/home/%2e%2e/secret.png', 'https://res.cloudinary.com.evil.invalid/a.png', 'https://user:password@res.cloudinary.com/a.png', '/home/file.svg', 'http://res.cloudinary.com/image.png']) {
    const content = starter(); content.slides[0].main.src = src; assert.equal(utils.parseHomeContent(content), null, src);
  }
  for (const mutate of [
    c => c.slides.push(c.slides[0]), c => c.slides[0].target = { kind: 'HELP', value: 'javascript:alert(1)' },
    c => c.slides[0].title[0] = 'x'.repeat(25), c => c.slides[0].surface = 'red;position:fixed',
    c => c.slides[0].startsAt = '2026-02-30T00:00:00Z', c => { c.slides[0].startsAt = '2026-10-21T00:00:00.000Z'; c.slides[0].endsAt = '2026-10-21T00:00:00Z'; },
    c => c.sections[1] = c.sections[0], c => c.featuredProductIds = ['8'.repeat(24), '8'.repeat(24)],
  ]) { const content = starter(); mutate(content); assert.equal(utils.parseHomeContent(content), null); }
  const content = starter(); content.slides[0].title[0] = '<script>'; assert.ok(utils.parseHomeContent(content)); // Rendered as React text, never HTML.
});

test('scheduled slides, removed destinations and disabled tiles fall back without exposing future banners', () => {
  const f = setup(), content = starter();
  content.slides.forEach(slide => { slide.startsAt = '2030-01-01T00:00:00Z'; });
  content.heroTiles[0].enabled = false;
  const resolved = utils.resolveHomeContent(content, f.groups, new Date('2026-10-21T00:00:00Z'));
  assert.equal(resolved.slides.length, 1); assert.equal(resolved.slides[0].id, 'intro'); assert.equal(resolved.slides[0].href, '/products');
  assert.equal(resolved.heroTiles.length, 1);
  content.slides[0].startsAt = null; content.slides[0].endsAt = '2026-10-21T00:00:00Z';
  assert.equal(utils.resolveHomeContent(content, f.groups, new Date('2026-10-21T00:00:00Z')).slides[0].endsAt, null);
  assert.equal(utils.resolveHomeContent(starter(), { categories: [], brands: [] }).slides.length, 1);
});

test('first homepage reads are read-only; drafts stay private and restored revisions require publication', async () => {
  const f = setup(); assert.equal((await f.cms.getHomePublication()).revision, 0); assert.equal(f.serviceSettings.size, 0);
  const content = starter(); content.slides[0].eyebrow = 'Private unpublished headline';
  await f.act('SAVE', 0, { content }); assert.notEqual((await f.cms.getHomePublication()).content.slides[0].eyebrow, content.slides[0].eyebrow);
  const publish = { action: 'PUBLISH', version: 1, requestId: randomUUID(), content: null, revisionId: null };
  await Promise.all([f.cms.updateHomepage(f.admin.id, publish), f.cms.updateHomepage(f.admin.id, publish)]);
  const first = await f.cms.getHomePublication(); assert.equal(first.revision, 2); assert.equal(f.serviceRevisions.size, 1);
  assert.doesNotMatch(JSON.stringify(first), /"(?:publishedBy|fingerprint|draft)"\s*:/);
  const newer = starter(); newer.slides[0].eyebrow = 'Second published headline';
  await f.act('SAVE', 2, { content: newer }); await f.act('PUBLISH', 3);
  await f.act('RESTORE', 4, { revisionId: first.id }); assert.equal((await f.cms.getHomePublication()).revision, 4);
  await f.act('PUBLISH', 5); assert.deepEqual((await f.cms.getHomePublication()).content, first.content);
  assert.equal((await f.cms.getAdminHomepage(1, first.id)).selected.id, first.id);
});

test('stale writes, changed request replays, hidden products and missing local images cannot publish', async () => {
  const f = setup(), content = starter(); content.featuredProductIds = [f.products[0].id];
  const save = { action: 'SAVE', version: 0, requestId: randomUUID(), content, revisionId: null };
  await f.cms.updateHomepage(f.admin.id, save);
  await assert.rejects(f.cms.updateHomepage(f.admin.id, { ...save, content: starter() }), error => error.status === 409);
  await assert.rejects(f.act('SAVE', 0, { content: starter() }), error => error.status === 409);
  f.homeState.hidden = true;
  await assert.rejects(f.act('PUBLISH', 1), error => error.code === 'HOME_REFERENCE');
  assert.equal(f.serviceRevisions.size, 0);
  f.homeState.hidden = false; content.slides[0].main.src = '/home/missing-image.png';
  await f.act('SAVE', 1, { content }); await assert.rejects(f.act('PUBLISH', 2), error => error.code === 'HOME_IMAGE');
  assert.equal(f.serviceRevisions.size, 0);
});

test('publication audit failures roll back revisions and pointers without losing the draft', async () => {
  const f = setup(); await f.act('SAVE', 0, { content: starter() });
  const create = f.db.auditLog.create; f.db.auditLog.create = async () => { throw Error('QA audit interruption'); };
  await assert.rejects(f.act('PUBLISH', 1)); assert.equal(f.serviceRevisions.size, 0); assert.equal(f.serviceSettings.get('default').version, 1);
  f.db.auditLog.create = create; await f.act('PUBLISH', 1); assert.equal(f.serviceRevisions.size, 1);
});

test('homepage routes enforce roles, input bounds, write quota and public draft privacy', async () => {
  const f = setup(), admin = f.load('app/api/admin/homepage/route.ts'), pub = f.load('app/api/homepage/route.ts');
  const req = (body, headers) => new Request('http://local/api/admin/homepage', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers });
  f.state.user = null; assert.equal((await admin.GET(new Request('http://local'))).status, 401); assert.equal((await admin.POST(req({}))).status, 401);
  f.state.user = f.owner; assert.equal((await admin.GET(new Request('http://local'))).status, 403);
  f.state.user = f.admin;
  for (const url of ['?page=0', '?page=1&page=2', '?draft=true', '?revision=bad']) assert.equal((await admin.GET(new Request('http://local/' + url))).status, 400);
  assert.equal((await admin.POST(req('x'.repeat(131073)))).status, 413);
  assert.equal((await admin.POST(req('{}', { Origin: 'http://other.invalid' }))).status, 403);
  assert.equal((await admin.POST(req('{bad json'))).status, 400);
  const save = { action: 'SAVE', version: 0, requestId: randomUUID(), content: starter() };
  f.state.limited = true; assert.equal((await admin.POST(req(save))).status, 429); f.state.limited = false;
  save.content.slides[0].eyebrow = 'PRIVATE_EDITOR_TEXT'; assert.equal((await admin.POST(req(save))).status, 200);
  const proxyResponse = await admin.POST(new Request('http://localhost/api/admin/homepage', { method: 'POST', headers: { Host: 'store.example.invalid', 'X-Forwarded-Proto': 'https', Origin: 'https://store.example.invalid' }, body: JSON.stringify({ ...save, version: 1, requestId: randomUUID() }) }));
  assert.equal(proxyResponse.status, 200, 'Same-origin writes work behind the deployment proxy');
  const response = await pub.GET(new Request('http://local/api/homepage')); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.doesNotMatch(JSON.stringify(await response.json()), /PRIVATE_EDITOR_TEXT|"(?:publishedBy|fingerprint|draft|savedIds|signedIn)"\s*:/);
  assert.equal((await pub.GET(new Request('http://local/api/homepage?draft=true'))).status, 400);
  f.homeState.offline = true; const failed = await pub.GET(new Request('http://local/api/homepage')); assert.equal(failed.status, 503); assert.doesNotMatch(await failed.text(), /private-database-secret/);
});
