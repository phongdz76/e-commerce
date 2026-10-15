/* Exercises the real catalog query against a disposable MongoDB database. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const sourceLoader = require('../tests/fixtures/load-source.cjs');
const appDirectory = path.resolve(__dirname, '..');
require('@next/env').loadEnvConfig(appDirectory);

async function main() {
  const database = 'sgtech_cat_qa_' + Date.now() + '_' + randomUUID().slice(0, 8);
  const connection = new URL(process.env.DATABASE_URL);
  const originalDatabase = connection.pathname;
  connection.pathname = '/' + database;
  assert.notEqual(connection.pathname, originalDatabase);
  assert.match(database, /^sgtech_cat_qa_\d+_[a-f0-9-]+$/);
  const prisma = new PrismaClient({ datasources: { db: { url: connection.toString() } } });
  const load = sourceLoader({ '@/libs/prismadb': { __esModule: true, default: prisma } });
  const catalog = load('libs/storefrontCatalog.ts');
  const { parseCatalogQuery } = load('utils/catalogQuery.ts');
  const checks = [];
  const query = (value = '') => { const parsed = parseCatalogQuery(new URLSearchParams(value)); return catalog.getCatalogPage(parsed.filters, parsed.page); };
  try {
    for (const collection of ['Category', 'Brand', 'Product', 'ProductVariant']) await prisma.$runCommandRaw({ create: collection });
    const category = await prisma.category.create({ data: { name: 'Điện thoại', slug: 'qa-phones' } });
    const custom = await prisma.category.create({ data: { name: 'Nhóm mới', slug: 'qa-new-category' } });
    const hiddenCategory = await prisma.category.create({ data: { name: 'Hidden', slug: 'qa-hidden', isVisible: false } });
    const brand = await prisma.brand.create({ data: { name: 'Hãng mới', slug: 'qa-brand' } });
    const secondBrand = await prisma.brand.create({ data: { name: 'Second', slug: 'qa-second' } });
    const hiddenBrand = await prisma.brand.create({ data: { name: 'Hidden', slug: 'qa-hidden-brand', isVisible: false } });
    const image = { color: 'Black', colorCode: '#000000', image: '/products/phone.webp' };
    const balance = { onHand: 50, reserved: 0, version: 1, updatedAt: new Date() };
    const expected = [];
    const make = async (name, options = {}) => {
      const product = await prisma.product.create({ data: { name, slug: randomUUID(), description: 'Private QA catalog', status: options.status || 'ACTIVE', categoryId: options.categoryId || category.id, brandId: options.brandId || brand.id, createdAt: new Date('2026-10-14T00:00:00Z') } });
      const variant = await prisma.productVariant.create({ data: { productId: product.id, name: '8GB', sku: randomUUID(), price: 100000, inStock: true, isActive: options.isActive !== false, image, inventory: balance, attributes: { RAM: '8GB', Storage: '128GB' }, ...options.variant } });
      return { product, variant };
    };
    for (let index = 0; index < 14; index++) {
      const row = await make('Điện thoại ' + String(index).padStart(2, '0'), { brandId: index % 2 ? secondBrand.id : brand.id, variant: { price: 100000 + index * 1000 } });
      expected.push(row.product.id);
    }
    const mixed = await make('Mixed SKU phone', { variant: { sku: 'QA-MIX-CHEAP', price: 90000, inventory: { ...balance, onHand: 1, reserved: 1 } } });
    await prisma.productVariant.create({ data: { productId: mixed.product.id, name: '16GB', sku: 'QA-MIX-EXPENSIVE', price: 200000, inStock: true, image, inventory: balance, attributes: { RAM: '16GB', Storage: '256GB' } } });
    expected.push(mixed.product.id);
    const unknown = await make('Not counted', { variant: { inventory: null } }); expected.push(unknown.product.id);
    const malformed = await make('Corrupt inventory'); expected.push(malformed.product.id);
    await prisma.$runCommandRaw({ update: 'ProductVariant', updates: [{ q: { _id: { $oid: malformed.variant.id } }, u: { $set: { 'inventory.onHand': '50' } } }] });
    const newCategoryProduct = await make('Custom category item', { categoryId: custom.id }); expected.push(newCategoryProduct.product.id);
    await make('Hidden category product', { categoryId: hiddenCategory.id });
    await make('Hidden brand product', { brandId: hiddenBrand.id });
    await make('Draft product', { status: 'DRAFT' });
    await make('Inactive SKU', { isActive: false });
    await make('Zero price', { variant: { price: 0 } });
    const first = await query(); const second = await query('page=2');
    assert.equal(first.total, expected.length); assert.equal(first.products.length, 12); assert.equal(second.products.length, expected.length - 12);
    assert.equal(new Set([...first.products, ...second.products].map(product => product.id)).size, expected.length);
    assert.equal(first.catalogTotal, expected.length);
    assert.equal((await query()).products[0].id, first.products[0].id);
    checks.push('server pagination/counts/stable sorting; hidden/draft/inactive/invalid-price records excluded');
    assert.equal((await query('q=dien+thoai')).total, expected.length - 1);
    assert.equal((await query('q=%2E%2A')).total, 0);
    assert.equal((await query('q=QA-MIX-EXPENSIVE')).products[0].id, mixed.product.id);
    assert.equal((await query('q=QA-MIX-EXPENSIVE')).products[0].price, 200000);
    assert.equal((await query('q=QA-MIX-EXPENSIVE&maxPrice=95000')).total, 0);
    assert.equal((await query('q=QA-MIX-CHEAP&stock=1')).total, 0);
    checks.push('Vietnamese accent-insensitive literal search and SKU search');
    const inStock = await query('stock=1&maxPrice=95000'); assert.equal(inStock.total, 0);
    const premium = await query('stock=1&minPrice=190000'); assert.equal(premium.total, 1); assert.equal(premium.products[0].price, 200000);
    assert.equal((await query('q=Not+counted&stock=1')).total, 0);
    assert.equal((await query('q=Corrupt+inventory&stock=1')).total, 0);
    checks.push('price and availability must match the same SKU; unknown/corrupt stock is unavailable');
    assert.equal((await query('category=qa-phones&spec=RAM:8GB&spec=Storage:256GB')).total, 0);
    const selected = await query('category=qa-phones&spec=RAM:16GB&stock=1'); assert.equal(selected.total, 1); assert.equal(selected.products[0].price, 200000);
    const facets = await query('category=qa-phones'); assert.ok(facets.attributes.some(facet => facet.name === 'RAM' && facet.values.some(value => value.value === '16GB')));
    assert.equal(facets.categories.find(group => group.value === 'qa-new-category').count, 1);
    assert.ok((await query('category=qa-phones&brand=qa-second')).brands.find(group => group.value === 'qa-brand').count > 0);
    checks.push('specification facets, same-variant conjunction and disjunctive brand counts');
    const alias = await query('category=' + encodeURIComponent('Điện thoại')); assert.equal(alias.filters.category, 'qa-phones');
    await prisma.category.update({ where: { id: category.id }, data: { name: 'Renamed category' } });
    await prisma.brand.update({ where: { id: brand.id }, data: { name: 'Renamed brand' } });
    const renamed = await query('category=qa-phones&brand=qa-brand'); assert.equal(renamed.categories.find(group => group.value === 'qa-phones').label, 'Renamed category'); assert.equal(renamed.products[0].brand, 'Renamed brand');
    assert.equal((await query('category=qa-new-category')).products[0].id, newCategoryProduct.product.id);
    assert.equal((await query('category=unknown')).total, 0);
    checks.push('dynamic groups, legacy aliases, stable slugs after rename and unknown group does not remove filtering');
    const highest = await make('Largest valid VND price', { categoryId: custom.id, variant: { price: 2147483647 } });
    const priceBoundary = await query('minPrice=2147483647&maxPrice=2147483647');
    assert.equal(priceBoundary.total, 1); assert.equal(priceBoundary.products[0].id, highest.product.id); assert.equal(priceBoundary.products[0].price, 2147483647);
    checks.push('price limit agrees with the catalog editor and Prisma Int boundary');
    const suggestions = await catalog.getCatalogSuggestions('dien'); assert.ok(suggestions.length <= 4); assert.equal(suggestions[0].inventory, undefined);
    assert.equal(first.products[0].inventory, undefined); assert.equal(first.products[0].reserved, undefined); assert.equal(first.products[0].variants, undefined);
    checks.push('bounded public suggestions and page DTOs do not expose internal balances or full catalog');
    const { reviewCart } = load('libs/reviewCart.ts');
    const { getOrderItems } = load('libs/orderItems.ts');
    const legacy = { id: mixed.product.id, quantity: 2, price: 90000, selectedImg: image };
    const refreshed = await reviewCart([legacy, { ...legacy, variantId: mixed.variant.id },
      { id: newCategoryProduct.product.id, variantId: newCategoryProduct.variant.id, quantity: 2, price: 1 },
      { id: unknown.product.id, variantId: unknown.variant.id, quantity: 1, price: 100000 }]);
    assert.deepEqual(refreshed.lines.map(line => line.issues), [['OPTION_REQUIRED'], ['OUT_OF_STOCK'], ['PRICE_CHANGED'], ['STOCK_NOT_COUNTED']]);
    assert.equal(refreshed.lines[2].current.price, 100000);
    assert.equal(refreshed.lines[2].current.quantity, 2);
    assert.equal((await reviewCart([refreshed.lines[2].current])).canCheckout, true);
    await assert.rejects(getOrderItems([legacy]), error => error.code === 'SKU_UNAVAILABLE');
    await prisma.productVariant.updateMany({ where: { productId: mixed.product.id, id: { not: mixed.variant.id } }, data: { isActive: false } });
    assert.deepEqual((await reviewCart([legacy])).lines[0].issues, ['OPTION_REQUIRED']);
    await assert.rejects(getOrderItems([legacy]), error => error.code === 'SKU_UNAVAILABLE');
    assert.equal((await prisma.productVariant.findUnique({ where: { id: mixed.variant.id } })).inventory.reserved, 1);
    checks.push('cart reviews isolate invalid rows, preserve ambiguous legacy choices, propose current prices and never reserve stock');
    fs.writeFileSync(path.join(appDirectory, '.artifacts/catalog-mongo-results.json'), JSON.stringify({ checks, disposableDatabase: true, applicationDatabaseWrites: 0 }, null, 2));
    console.log('Catalog MongoDB passed: ' + checks.length + ' check groups.');
  } finally {
    assert.equal(connection.pathname, '/' + database);
    assert.match(database, /^sgtech_cat_qa_\d+_[a-f0-9-]+$/);
    await prisma.$runCommandRaw({ dropDatabase: 1 });
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error('Catalog QA failed:', error.code || error.name); const detail = error.code === 'P2010' ? error.meta?.message : ['AssertionError', 'PrismaClientValidationError'].includes(error.name) ? error.message : null; if (detail) console.error(String(detail).replace(/mongodb(?:\+srv)?:\/\/[^\s'"`]+/g, '[REDACTED]')); process.exitCode = 1; });
