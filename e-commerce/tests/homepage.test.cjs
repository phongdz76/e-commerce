const test = require('node:test');
const assert = require('node:assert/strict');
const sourceLoader = require('./fixtures/load-source.cjs');

function fixture() {
  const products = [{ id: 'a'.repeat(24), name: 'Public product', price: 100, categorySlug: 'new-category', images: [{ image: '/products/example.webp' }] }, { id: 'b'.repeat(24), name: 'Removed after first read' }];
  const calls = { catalog: [], wishlist: [], reviews: [], details: [] };
  const state = { catalogOffline: false, wishlistOffline: false, reviewsOffline: false };
  const load = sourceLoader({
    '@/libs/homepageContent': { getHomePublication: async () => ({ id: null, revision: 0, publishedAt: null, content: sourceLoader()('utils/homepageStarter.ts').starterHomeContent() }) },
    '@/libs/storefrontCatalog': { getCatalogGroups: async () => ({ categories: [], brands: [] }), getCatalogPage: async (...args) => {
      calls.catalog.push(args);
      if (state.catalogOffline) throw new Error('Catalog unavailable');
      return { products: args[0].sort === 'price-asc' ? [...products].reverse() : products, total: 2, brands: [], categories: [] };
    } },
    '@/libs/storefrontProductNames': { getStorefrontProductsByIds: async ids => { calls.details.push(ids); return [{ ...products[0], variants: [{ id: 'c'.repeat(24), price: 100, available: 1 }] }]; } },
    '@/libs/prismadb': { __esModule: true, default: {
      wishlistItem: { findMany: async args => { calls.wishlist.push(args); if (state.wishlistOffline) throw new Error('offline'); return [{ productId: products[0].id }]; } },
      productReview: { findMany: async args => {
        calls.reviews.push(args); if (state.reviewsOffline) throw new Error('offline');
        return products.map((product, index) => ({ id: `review-${index}`, productId: product.id, rating: 4, comment: 'Purchased review', authorName: 'Customer', createdAt: new Date('2026-10-21T00:00:00Z'), userId: 'private-user', orderId: 'private-order' }));
      } },
    } },
  });
  return { ...load('libs/homepage.ts'), state, calls, products, utils: load('utils/homepage.ts') };
}

test('homepage batches only the signed-in user wishlist for the bounded union of both product tabs', async () => {
  const f = fixture();
  const data = await f.getHomepage('current-user');
  assert.deepEqual(f.calls.catalog.map(args => [args[0].sort, args[1], args[2]]), [['', 1, 10], ['price-asc', 1, 10]]);
  assert.equal(f.calls.details.length, 1);
  assert.equal(f.calls.wishlist.length, 1);
  assert.deepEqual(f.calls.wishlist[0], { where: { userId: 'current-user', productId: { in: f.products.map(product => product.id) } }, select: { productId: true } });
  assert.deepEqual(data.savedIds, [f.products[0].id]);
  assert.equal(data.signedIn, true);
  assert.equal(data.catalog.products.length, 1);
  assert.equal(data.affordable.length, 1);
  assert.equal(data.catalog.products[0].variants[0].available, 1);
});

test('guest homepage never queries a wishlist or exposes private review identifiers', async () => {
  const f = fixture();
  const data = await f.getHomepage(null);
  assert.equal(f.calls.wishlist.length, 0);
  assert.equal(data.signedIn, false);
  assert.deepEqual(data.savedIds, []);
  assert.equal(data.reviews.length, 1); // Removed product cannot appear in highlights.
  assert.equal(data.reviews[0].createdAt, '2026-10-21T00:00:00.000Z');
  assert.doesNotMatch(JSON.stringify(data.reviews), /private-user|private-order|userId|orderId/);
  assert.equal(f.calls.reviews[0].take, 3);
  assert.deepEqual(Object.keys(f.calls.reviews[0].select).sort(), ['authorName', 'comment', 'createdAt', 'id', 'productId', 'rating']);
});

test('catalog errors remain errors; an unavailable wishlist is distinct from an empty one', async () => {
  const f = fixture();
  f.state.wishlistOffline = true;
  f.state.reviewsOffline = true;
  const data = await f.getHomepage('user');
  assert.equal(data.savedIds, null);
  assert.deepEqual(data.reviews, []);
  assert.equal(data.catalog.products.length, 1);
  f.state.catalogOffline = true;
  await assert.rejects(f.getHomepage(null), /Catalog unavailable/);
});

test('collection links resolve actual slugs, including legacy accessories spelling, and new categories use their product image', () => {
  const { utils, products } = fixture();
  const groups = [{ id: '1', label: 'Accesories', value: 'desk-accessories' }, { id: '2', label: 'Laptops', value: 'portable-computers' }];
  assert.equal(utils.categoryHref(groups, 'Accessories'), '/products?category=desk-accessories');
  assert.equal(utils.categoryHref(groups, 'Laptop'), '/products?category=portable-computers');
  assert.equal(utils.categoryHref([], 'Laptop'), '/products');
  assert.equal(utils.categoryImage({ label: 'A new category', value: 'new-category' }, products), '/products/example.webp');
  assert.equal(utils.categoryImage({ label: 'Unknown', value: 'unknown' }, []), undefined);
});

test('quick add observes remaining stock and the existing 20-per-option cart limit', () => {
  const { quickAddLimit } = fixture().utils;
  assert.equal(quickAddLimit(2, 1), 1);
  assert.equal(quickAddLimit(1, 1), 0);
  assert.equal(quickAddLimit(0, 2), 0);
  assert.equal(quickAddLimit(100, 19), 1);
  assert.equal(quickAddLimit(100, 20), 0);
});

test('featured picks prefer different categories and fill remaining positions without duplicate products', () => {
  const { featuredProducts } = fixture().utils;
  const products = [
    { id: '1', categorySlug: 'audio' }, { id: '2', categorySlug: 'audio' },
    { id: '3', categorySlug: 'computers' }, { id: '4', categorySlug: 'phones' },
    { id: '5', categorySlug: 'watches' },
  ];
  assert.deepEqual(featuredProducts(products).map(product => product.id), ['1', '3', '4', '5']);
  assert.deepEqual(featuredProducts(products.slice(0, 3)).map(product => product.id), ['1', '3', '2']);
  assert.deepEqual(featuredProducts([]), []);
});
