const test = require('node:test');
const assert = require('node:assert/strict');
const sourceLoader = require('./fixtures/load-source.cjs');
const load = sourceLoader();
const query = load('utils/catalogQuery.ts');

test('catalog queries reject duplicate, oversized, fractional, reversed and unsafe parameters', () => {
  for (const value of ['q=a&q=b', 'q=%00', 'q=' + 'a'.repeat(81), 'page=0', 'page=1.5', 'page=10001', 'sort=constructor', 'minPrice=-1', 'maxPrice=1.5', 'minPrice=200&maxPrice=100', 'maxPrice=2147483648', 'stock=true', 'spec=RAM:8GB&spec=RAM:16GB', 'spec=__proto__:yes', 'spec=RAM:']) {
    assert.throws(() => query.parseCatalogQuery(new URLSearchParams(value)), query.CatalogQueryError, value);
  }
  assert.equal(query.parseCatalogQuery(new URLSearchParams('maxPrice=2147483647')).filters.maxPrice, '2147483647');
});

test('URL filters round trip multiple brands and specifications without losing selection', () => {
  const parsed = query.parseCatalogQuery(new URLSearchParams('q=Điện+thoại&brand=apple,apple,new-brand&minPrice=0&stock=1&spec=RAM:8GB&spec=Storage:128GB&page=2'));
  assert.equal(parsed.filters.brand, 'apple,new-brand');
  assert.equal(parsed.filters.attributes.RAM, '8GB');
  assert.equal(Object.getPrototypeOf(parsed.filters.attributes), Object.prototype); // Serializable across the RSC boundary.
  assert.deepEqual(query.parseCatalogQuery(new URL(query.getCatalogUrl(parsed.filters, parsed.page), 'http://localhost').searchParams), parsed);
});

test('Vietnamese query matching supports accent/case/decomposition while regex metacharacters remain literal', () => {
  for (const text of ['Điện thoại', 'ĐIỆN THOẠI', 'Điện thoại'.normalize('NFD')]) {
    assert.ok(query.getCatalogSearchPatterns('dien thoai').every(pattern => new RegExp(pattern, 'iu').test(text)));
  }
  assert.equal(new RegExp(query.getCatalogSearchPatterns('.*')[0], 'iu').test('ordinary product'), false);
  assert.equal(new RegExp(query.getCatalogSearchPatterns('.*')[0], 'iu').test('literal .* model'), true);
});

test('group resolution preserves stable slugs, accepts unambiguous legacy names and refuses guessing', () => {
  const groups = [{ id: 'a', value: 'phones', label: 'Điện thoại' }];
  assert.equal(query.resolveCatalogGroup('dien thoai', groups), 'phones');
  assert.equal(query.resolveCatalogGroup('a', groups), 'phones');
  assert.equal(query.resolveCatalogGroup('missing', groups), 'missing');
  assert.equal(query.resolveCatalogGroup('same', [{ id: 'a', value: 'a', label: 'Same' }, { id: 'b', value: 'b', label: 'Same' }]), 'same');
});

function fixture() {
  const id = 'a'.repeat(24), variantId = 'b'.repeat(24);
  const row = { id, name: 'DB product', description: 'Description', category: 'New category', categorySlug: 'new-category', brand: 'Exact brand casing', brandSlug: 'new-brand', price: 123000, matchedVariantId: variantId, inStock: true, images: [{ color: 'Black', colorCode: '#000000', image: '/products/phone.webp' }], inventory: { onHand: 50, reserved: 1 }, privateToken: 'must-not-leak' };
  const summary = { products: [row], totals: [{ count: 1 }], catalogTotals: [{ count: 1 }], categoryCounts: [{ _id: 'new-category', count: 1 }], brandCounts: [{ _id: 'new-brand', count: 1 }], specifications: [] };
  const state = { offline: false, queries: [] };
  const loaded = sourceLoader({ '@/libs/prismadb': { __esModule: true, default: {
    productReview: { groupBy: async () => [] },
    category: { findMany: async () => [{ id: 'c'.repeat(24), name: 'New category', slug: 'new-category' }] },
    brand: { findMany: async () => [{ id: 'd'.repeat(24), name: 'Exact brand casing', slug: 'new-brand' }] },
    product: { aggregateRaw: async options => { state.queries.push(options); if (state.offline) throw new Error('private-db-secret'); return [summary]; } },
  } }, 'next/server': { NextResponse: { json: Response.json } } });
  return { state, row, summary, service: loaded('libs/storefrontCatalog.ts'), endpoint: loaded('app/api/catalog/suggestions/route.ts').GET };
}

test('public suggestion route needs no login, is bounded and excludes internal balances', async () => {
  const f = fixture();
  const response = await f.endpoint(new Request('http://localhost/api/catalog/suggestions?q=DB'));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(Object.keys(data.products[0]).sort(), ['id', 'image', 'inStock', 'name', 'price', 'variantId']);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const pipeline = f.state.queries[0].pipeline;
  assert.equal(pipeline.at(-1).$facet.products.find(stage => stage.$limit).$limit, 4);
  assert.doesNotMatch(JSON.stringify(data), /privateToken|inventory|reserved|must-not-leak/);
});

test('empty or invalid suggestion requests avoid DB reads; failures remain errors without static fallback', async () => {
  const f = fixture();
  assert.deepEqual(await (await f.endpoint(new Request('http://localhost/api/catalog/suggestions'))).json(), { products: [] });
  assert.equal((await f.endpoint(new Request('http://localhost/api/catalog/suggestions?q=a&q=b'))).status, 400);
  assert.equal(f.state.queries.length, 0);
  f.state.offline = true;
  const response = await f.endpoint(new Request('http://localhost/api/catalog/suggestions?q=a'));
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private-db-secret/);
});

test('malformed aggregation data never becomes fake zero prices or stock', async () => {
  const f = fixture();
  for (const invalid of ['123000', -1, 1.5, null]) {
    f.row.price = invalid;
    assert.equal((await f.endpoint(new Request('http://localhost/api/catalog/suggestions?q=a'))).status, 503);
  }
});

test('facet counts are product counts and bounded choices announce omitted options', async () => {
  const f = fixture();
  f.summary.specifications = Array.from({ length: 21 }, (_, index) => ({ _id: { name: 'RAM', value: `${index}GB` }, count: 1 }));
  const page = await f.service.getCatalogPage(query.EMPTY_CATALOG_FILTERS);
  assert.equal(page.attributes[0].values.length, 20);
  assert.equal(page.attributesLimited, true);
  assert.equal(page.products[0].privateToken, undefined);
  assert.equal(page.categories[0].label, 'New category');
});

test('product detail validates identity and reads one visible product; related query is capped', async () => {
  const calls = [];
  const loaded = sourceLoader({ '@/libs/prismadb': { __esModule: true, default: { product: { findFirst: async options => { calls.push(options); return null; }, findMany: async options => { calls.push(options); return []; } } } } });
  const service = loaded('libs/storefrontProductNames.ts');
  assert.equal(await service.getStorefrontProduct('invalid'), null);
  assert.equal(calls.length, 0);
  assert.equal(await service.getStorefrontProduct('a'.repeat(24)), null);
  assert.equal(calls[0].where.status, 'ACTIVE');
  assert.deepEqual(calls[0].where.category, { is: { isVisible: true } });
  await service.getRelatedStorefrontProducts('a'.repeat(24), 'new-category');
  assert.equal(calls[1].take, 6);
  assert.equal(calls[1].where.category.is.slug, 'new-category');
});
