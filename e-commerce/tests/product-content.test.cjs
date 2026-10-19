const test = require('node:test');
const assert = require('node:assert/strict');
const sourceLoader = require('./fixtures/load-source.cjs');
const content = sourceLoader()('utils/productContent.ts');
const definition = (changes = {}) => ({ key: 'RAM', label: 'Memory', format: 'NUMBER', unit: 'GB', choices: [], ...changes });
const definitions = [definition(), definition({ key: 'Panel', label: 'Display panel', format: 'SELECT', unit: '', choices: ['OLED', 'LCD'] })];
const image = { color: 'Black', colorCode: '#000000', image: '/products/iphone14-white.webp' };
const gallery = [{ url: '/products/apple-watch-se-black.webp', alt: 'Side view' }];

test('category templates reject ambiguous keys, invalid types, choices, units and excessive size', () => {
  assert.deepEqual(content.parseSpecificationDefinitions(definitions), definitions);
  for (const value of [null, {}, Array(21).fill(definition()), [definition(), definition({ key: 'ram' })], [definition({ key: 'constructor' })], [definition({ format: 'BOOLEAN' })], [definition({ format: 'TEXT' })], [definition({ key: 'RAM:' })], [definition({ label: '\u0000' })], [definition({ format: 'SELECT', unit: '', choices: [] })], [definition({ format: 'SELECT', unit: '', choices: ['Écran', 'ecran'] })]]) assert.throws(() => content.parseSpecificationDefinitions(value), content.ProductContentError);
});

test('specifications canonicalize keys, numeric units and choices idempotently', () => {
  const normalized = content.normalizeProductAttributes({ ram: '8GB', panel: 'oled', Weight: '1.2 kg', Empty: '  ' }, definitions);
  assert.deepEqual(normalized, { RAM: '8 GB', Panel: 'OLED', Weight: '1.2 kg' });
  assert.deepEqual(content.normalizeProductAttributes(normalized, definitions), normalized);
  assert.equal(content.normalizeProductAttributes({ RAM: '1.25 gb' }, definitions).RAM, '1.25 GB');
  assert.equal(content.normalizeProductAttributes({ RAM: '0' }, definitions).RAM, '0 GB');
  assert.equal(content.normalizeProductAttributes({ RAM: '999999999999.0001' }, definitions).RAM, '999999999999.0001 GB');
  assert.equal(content.normalizeProductAttributes({ RAM: '1.2500' }, definitions).RAM, '1.25 GB');
  assert.equal(content.specificationInputValue('10 in.', definition({ unit: 'in.' })), '10');
  for (const value of [{ RAM: '-1' }, { RAM: '8 MB' }, { RAM: '1e3' }, { RAM: 'NaN' }, { RAM: '1.00001' }, { RAM: '1000000000000' }, { RAM: '8', ram: '16' }, { Panel: 'IPS' }, { constructor: 'x' }, { ' __proto__ ': 'x' }, { Bad: {} }, { Bad: '\u0000' }]) assert.throws(() => content.normalizeProductAttributes(value, definitions), content.ProductContentError);
});

test('specification parser preserves value colons and rejects duplicate or unsafe keys', () => {
  assert.deepEqual(content.parseSpecificationLines('RAM: 8 GB\nNotes: ratio 16:9\n'), { RAM: '8 GB', Notes: 'ratio 16:9' });
  for (const text of ['RAM 8', ': no', 'RAM: 8\nRAM: 16', '__proto__: a', 'constructor: a']) assert.throws(() => content.parseSpecificationLines(text));
});

test('legacy reads safely retain recorded values without invented specifications or warranty', () => {
  assert.deepEqual(content.readSpecificationDefinitions(null), []);
  assert.deepEqual(content.readProductGallery(undefined), []);
  assert.equal(content.readProductContentText(null), '');
  assert.deepEqual(content.getProductSpecificationRows({ Panel: 'Old panel', RAM: '8GB', Other: 'Original', Corrupt: {} }, definitions), [{ key: 'RAM', label: 'Memory', value: '8 GB' }, { key: 'Panel', label: 'Display panel', value: 'Old panel' }, { key: 'Other', label: 'Other', value: 'Original' }]);
  assert.deepEqual(content.readProductAttributes({ ' __proto__ ': 'unsafe', constructor: 'unsafe', Empty: '', Valid: ' value ' }), { Valid: 'value' });
});

test('gallery and content validation bound data, refuse unsafe URLs, deduplicate and whitelist', () => {
  assert.deepEqual(content.parseProductGallery([{ ...gallery[0], privateToken: 'secret' }]), gallery);
  for (const value of [null, Array(9).fill(gallery[0]), [...gallery, ...gallery], [{ url: 'javascript:alert(1)', alt: '' }], [{ url: '/products/../secret.png', alt: '' }], [{ url: 'https://evil.example/image.png', alt: '' }], [{ ...gallery[0], alt: 'a'.repeat(161) }]]) assert.throws(() => content.parseProductGallery(value));
  assert.deepEqual(content.readProductGallery([{}, ...gallery, ...gallery, { ...gallery[0], url: 'https://evil.example/test.png' }]), gallery);
  assert.equal(content.parseProductContentText(' Coverage\nConditions '), 'Coverage\nConditions');
  for (const value of [null, {}, 'a'.repeat(3001), '\u0000']) assert.throws(() => content.parseProductContentText(value));
});

function fixture() {
  const date = new Date('2026-10-14T00:00:00Z');
  const category = { id: 'c'.repeat(24), name: 'Phones', slug: 'phones', isVisible: true, specifications: definitions, updatedAt: date, createdAt: date, _count: { products: 1 } };
  const brand = { ...category, id: 'd'.repeat(24), name: 'Brand', slug: 'brand', specifications: undefined };
  const variant = { id: 'b'.repeat(24), productId: 'a'.repeat(24), name: '8GB', sku: 'QA-8GB', price: 100000, currency: 'vnd', image, attributes: { RAM: '8 GB' }, gallery, warrantyText: 'Original coverage', packageContents: 'Original cable', isActive: true, inStock: true, inventory: { onHand: 50, reserved: 1, version: 1, updatedAt: date } };
  const product = { id: 'a'.repeat(24), name: 'QA product', slug: 'qa-product', description: 'A product description', status: 'ACTIVE', categoryId: category.id, brandId: brand.id, category, brand, variants: [variant], updatedAt: date };
  const state = { user: { id: 'e'.repeat(24), role: 'ADMIN' }, writes: [], audits: [] };
  const db = {
    productReview: { groupBy: async () => [] },
    category: { findUnique: async () => category, findMany: async () => [category], count: async () => 1, updateMany: async options => { state.writes.push(options); Object.assign(category, options.data); return { count: 1 }; } },
    brand: { findUnique: async () => brand },
    product: { findUnique: async () => product, findFirst: async () => product, update: async options => { state.writes.push(options); Object.assign(variant, options.data.variants.update[0].data); product.updatedAt = options.data.updatedAt; return product; }, create: async options => { state.writes.push(options); return product; } },
  };
  const load = sourceLoader({ '@/actions/getCurrentUser': { getCurrentUser: async () => state.user }, '@/libs/prismadb': { __esModule: true, default: db }, '@/libs/adminAudit': { startAdminAudit: async (...args) => { state.audits.push(args); return { id: 'audit' }; }, finishAdminAudit: async () => {} }, 'next/server': { NextResponse: { json: Response.json } } });
  const body = () => ({ name: product.name, slug: product.slug, description: product.description, status: product.status, categoryId: category.id, brandId: brand.id, categoryVersion: category.updatedAt.toISOString(), updatedAt: product.updatedAt.toISOString(), variants: [{ id: variant.id, sku: variant.sku, name: variant.name, price: variant.price, image, attributes: { ram: '16GB', panel: 'oled' }, isActive: true, inStock: true }] });
  const request = value => new Request('http://localhost/api/admin/products', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  return { category, variant, product, state, body, request, admin: load('libs/adminCatalog.ts'), groups: load('libs/catalogGroup.ts'), storefront: load('libs/storefrontProductNames.ts') };
}

test('SKU and category mutations require ADMIN before parsing or writing', async () => {
  for (const [user, expected] of [[null, 401], [{ role: 'USER' }, 403]]) {
    const f = fixture(); f.state.user = user;
    assert.equal((await f.admin.saveAdminProduct(f.request(f.body()), f.product.id)).status, expected);
    assert.equal((await f.groups.saveCatalogGroup(f.request({}), 'categories', f.category.id)).status, expected);
    assert.equal(f.state.writes.length, 0);
  }
});

test('stale or missing template versions reject writes, including removed templates', async () => {
  for (const version of [undefined, 'old']) { const f = fixture(); const body = f.body(); body.categoryVersion = version; const response = await f.admin.saveAdminProduct(f.request(body), f.product.id); assert.equal(response.status, 409); assert.equal((await response.json()).code, 'SPECIFICATION_TEMPLATE_CHANGED'); assert.equal(f.state.writes.length, 0); }
  const f = fixture(); const body = f.body(); f.category.specifications = []; f.category.updatedAt = new Date('2026-10-14T00:00:01Z');
  assert.equal((await f.admin.saveAdminProduct(f.request(body), f.product.id)).status, 409);
});

test('SKU updates canonicalize content and exclude forged inventory or identity fields', async () => {
  const f = fixture(); const body = f.body(); Object.assign(body.variants[0], { gallery, warrantyText: ' New warranty ', packageContents: ' New charger ', inventory: { onHand: 999999 } });
  assert.equal((await f.admin.saveAdminProduct(f.request(body), f.product.id)).status, 200);
  assert.deepEqual(f.variant.attributes, { RAM: '16 GB', Panel: 'OLED' }); assert.deepEqual(f.variant.gallery, gallery);
  assert.equal(f.variant.warrantyText, 'New warranty'); assert.equal(f.variant.packageContents, 'New charger');
  const update = f.state.writes[0].data.variants.update[0].data;
  for (const key of ['inventory', 'id', 'productId']) assert.equal(key in update, false);
  assert.equal(f.variant.inventory.onHand, 50); assert.equal(f.variant.inventory.reserved, 1);
});

test('omitted legacy content preserves data while explicit empty fields clear it', async () => {
  const f = fixture(); assert.equal((await f.admin.saveAdminProduct(f.request(f.body()), f.product.id)).status, 200);
  assert.deepEqual(f.variant.gallery, gallery); assert.equal(f.variant.warrantyText, 'Original coverage'); assert.equal(f.variant.packageContents, 'Original cable');
  const body = f.body(); Object.assign(body.variants[0], { gallery: [], warrantyText: '', packageContents: '' });
  assert.equal((await f.admin.saveAdminProduct(f.request(body), f.product.id)).status, 200);
  assert.deepEqual(f.variant.gallery, []); assert.equal(f.variant.warrantyText, ''); assert.equal(f.variant.packageContents, '');
});

test('invalid content and spec values reject requests before writes or audit', async () => {
  for (const changes of [{ gallery: [{ url: 'https://evil.example/img.jpg', alt: '' }] }, { warrantyText: null }, { packageContents: 'x'.repeat(3001) }, { attributes: { RAM: '8 MB' } }, { attributes: { ram: '8', RAM: '16' } }]) {
    const f = fixture(); const body = f.body(); Object.assign(body.variants[0], changes);
    assert.equal((await f.admin.saveAdminProduct(f.request(body), f.product.id)).status, 400);
    assert.equal(f.state.writes.length, 0); assert.equal(f.state.audits.length, 0);
  }
});

test('category templates check versions and cannot be assigned to brands', async () => {
  const f = fixture(); const body = { name: 'Phones', slug: 'phones', isVisible: true, specifications: definitions, updatedAt: f.category.updatedAt.toISOString() };
  assert.equal((await f.groups.saveCatalogGroup(f.request(body), 'brands')).status, 400);
  assert.equal((await f.groups.saveCatalogGroup(f.request({ ...body, updatedAt: '2026-01-01T00:00:00Z' }), 'categories', f.category.id)).status, 409);
  assert.equal((await f.groups.saveCatalogGroup(f.request(body), 'categories', f.category.id)).status, 200);
  assert.deepEqual(f.category.specifications, definitions);
});

test('admin and public DTOs sanitize per-SKU content and keep public balances private', async () => {
  const f = fixture(); f.variant.gallery = [{ ...gallery[0], privateToken: 'secret' }];
  const admin = await (await f.admin.readAdminCatalog(new Request('http://localhost/api/admin/products'), f.product.id)).json();
  assert.deepEqual(admin.variants[0].gallery, gallery); assert.deepEqual(admin.categorySpecifications, definitions); assert.equal(admin.categoryVersion, f.category.updatedAt.toISOString());
  const product = await f.storefront.getStorefrontProduct(f.product.id);
  assert.deepEqual(product.variants[0].specifications, [{ key: 'RAM', label: 'Memory', value: '8 GB' }]);
  assert.equal(product.variants[0].available, 49);
  for (const key of ['inventory', 'reserved', 'privateToken']) assert.equal(product.variants[0][key], undefined);
  assert.deepEqual(product.variants[0].gallery, gallery); assert.equal(product.variants[0].warrantyText, 'Original coverage');
});

test('content changes appear in audit presentation without raw URLs or unknown metadata', () => {
  const { formatAdminActivity } = sourceLoader()('libs/adminActivity.ts');
  const details = { before: { variants: [{ sku: 'QA-8GB', attributes: { RAM: '8 GB' }, gallery: [], warrantyText: 'Old', packageContents: 'Cable' }] }, after: { variants: [{ sku: 'QA-8GB', attributes: { RAM: '16 GB' }, gallery, warrantyText: 'New', packageContents: 'Charger', privateToken: 'secret' }] } };
  const output = formatAdminActivity({ id: 'audit', action: 'PRODUCT_UPDATED', entityType: 'PRODUCT', status: 'SUCCEEDED', details, createdAt: new Date() }, 'Admin', { label: 'Product', href: null });
  for (const label of ['Specifications', 'Photo library', 'Warranty', 'Box contents']) assert.ok(output.changes.some(change => change.label.includes(label)));
  assert.doesNotMatch(JSON.stringify(output), /privateToken|secret|\/products\//);
});
