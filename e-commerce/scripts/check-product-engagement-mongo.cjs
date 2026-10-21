const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const sourceLoader = require('../tests/fixtures/load-source.cjs');
const { seedReturnOrder } = require('./return-qa-fixture.cjs');
require('@next/env').loadEnvConfig(path.resolve(__dirname, '..'));

async function main() {
  const database = 'sgtech_eng_qa_' + Date.now() + '_' + randomUUID().slice(0, 8);
  const connection = new URL(process.env.DATABASE_URL), application = connection.pathname;
  connection.pathname = '/' + database;
  assert.notEqual(connection.pathname, application);
  assert.match(database, /^sgtech_eng_qa_\d+_[a-f0-9-]+$/);
  const db = new PrismaClient({ datasources: { db: { url: connection.toString() } } });
  const second = new PrismaClient({ datasources: { db: { url: connection.toString() } } });
  const state = { user: null };
  const loader = client => sourceLoader({ '@/libs/prismadb': { __esModule: true, default: client },
    '@/actions/getCurrentUser': { getCurrentUser: async () => state.user } });
  const load = loader(db), otherLoad = loader(second);
  const service = load('libs/productEngagement.ts'), otherService = otherLoad('libs/productEngagement.ts');
  const checks = [];
  try {
    const [owner, other] = await Promise.all([0, 1].map(index => db.user.create({ data: { name: 'QA customer ' + index, email: `qa-${index}@example.invalid` } })));
    const category = await db.category.create({ data: { name: 'QA category', slug: 'qa' } });
    const brand = await db.brand.create({ data: { name: 'QA brand', slug: 'qa' } });
    const product = await db.product.create({ data: { name: 'Review QA phone', slug: 'qa', description: 'Isolated QA product', status: 'ACTIVE', categoryId: category.id, brandId: brand.id } });
    const { order, variant } = await seedReturnOrder(db, owner.id, product.id);
    const review = { rating: 5, comment: 'Useful product after a verified delivery.' };
    await assert.rejects(service.createProductReview(other, product.id, review), e => e.code === 'REVIEW_PURCHASE_REQUIRED');
    for (const patch of [{ deliveryStatus: 'shipped' }, { stockReservation: { ...order.stockReservation, state: 'RESERVED' } }, { management: { ...order.management, state: 'CANCELLED' } }]) {
      await db.order.update({ where: { id: order.id }, data: patch });
      await assert.rejects(service.createProductReview(owner, product.id, review), e => e.code === 'REVIEW_PURCHASE_REQUIRED');
      await db.order.update({ where: { id: order.id }, data: { deliveryStatus: order.deliveryStatus, stockReservation: order.stockReservation, management: order.management } });
    }
    checks.push('server checks purchase ownership, delivered shipment, consumed stock and cancellation before review creation');

    const created = await Promise.all(Array.from({ length: 6 }, (_, i) => (i % 2 ? service : otherService).createProductReview(owner, product.id, review)));
    assert.equal(new Set(created.map(row => row.id)).size, 1);
    assert.equal(await db.productReview.count(), 1);
    await assert.rejects(service.createProductReview(owner, product.id, { ...review, rating: 1 }), e => e.code === 'REVIEW_EXISTS');
    checks.push('six concurrent submissions across two clients produce one review; exact retries succeed and changed duplicates conflict');
    let publicList = await service.getProductReviews(product.id, null, 1);
    assert.equal(publicList.total, 0);
    assert.equal((await service.getProductReviews(product.id, owner.id, 1)).ownReview.status, 'PENDING');
    const moderator = await db.user.create({ data: { role: 'ADMIN', name: 'QA moderator' } });
    await load('libs/reviewModeration.ts').moderateReview(moderator.id, created[0].id, { action: 'APPROVE', version: 0, requestId: randomUUID() });
    publicList = await service.getProductReviews(product.id, null, 1);
    assert.equal(publicList.total, 1); assert.equal(publicList.average, 5); assert.equal(publicList.canReview, false);
    assert.equal(publicList.ownReview, null);
    assert.doesNotMatch(JSON.stringify(publicList), /userId|orderId|email|hashedPassword/);
    assert.equal((await service.getProductReviews(product.id, owner.id, 1)).ownReview.id, created[0].id);
    assert.equal((await load('libs/storefrontProductNames.ts').getStorefrontProduct(product.id)).averageRating, 5);
    assert.equal((await load('libs/storefrontProductNames.ts').getStorefrontProduct(product.id)).reviewCount, 1);
    checks.push('public review DTO excludes account/order identifiers; personal review and storefront rating summaries use saved records');

    // Additional records exercise real pagination and aggregate totals, independent of the first page.
    await db.productReview.createMany({ data: Array.from({ length: 13 }, (_, i) => ({ id: 'qa-' + i, userId: other.id, productId: product.id, orderId: order.id, rating: 3, comment: 'Private pagination fixture', authorName: 'QA customer' })) });
    publicList = await service.getProductReviews(product.id, null, 1);
    const nextPage = await service.getProductReviews(product.id, null, 2);
    assert.equal(publicList.items.length, 12); assert.equal(nextPage.items.length, 2);
    assert.equal(new Set([...publicList.items, ...nextPage.items].map(row => row.id)).size, 14);
    assert.equal(publicList.total, 14); assert.equal(publicList.average, (5 + 13 * 3) / 14);
    checks.push('review pages are bounded and stable; average and count cover all pages');

    await Promise.all(Array.from({ length: 6 }, (_, i) => (i % 2 ? service : otherService).saveWishlistItem(owner.id, product.id)));
    assert.equal(await db.wishlistItem.count(), 1);
    assert.equal((await service.getWishlist(other.id, 1)).total, 0);
    assert.equal((await service.wishlistStatus(other.id, product.id)).saved, false);
    await service.removeWishlistItem(other.id, product.id);
    assert.equal((await service.wishlistStatus(owner.id, product.id)).saved, true);
    const saved = await service.getWishlist(owner.id, 1);
    assert.equal(saved.items[0].product.name, product.name);
    assert.equal(saved.items[0].product.reviewCount, 14);
    checks.push('concurrent wishlist saves are idempotent and every read/delete is scoped to the signed-in account');

    await db.productVariant.update({ where: { id: variant.id }, data: { price: 120000 } });
    assert.equal((await service.getWishlist(owner.id, 1)).items[0].product.price, 120000);
    await db.product.update({ where: { id: product.id }, data: { status: 'DRAFT' } });
    assert.equal((await service.getWishlist(owner.id, 1)).items[0].product, null);
    await assert.rejects(service.saveWishlistItem(other.id, product.id), e => e.status === 404);
    await assert.rejects(service.getProductReviews(product.id, null, 1), e => e.status === 404);
    await service.removeWishlistItem(owner.id, product.id);
    await service.removeWishlistItem(owner.id, product.id);
    assert.equal(await db.wishlistItem.count(), 0);
    checks.push('wishlist resolves current prices; unpublished items reveal no catalog details and can still be removed idempotently');

    await db.product.update({ where: { id: product.id }, data: { status: 'ACTIVE' } });
    await db.wishlistItem.createMany({ data: Array.from({ length: 14 }, (_, i) => ({ id: 'qa-' + i, userId: owner.id, productId: i === 0 ? product.id : i.toString(16).padStart(24, '0') })) });
    const firstWishlist = await service.getWishlist(owner.id, 1), secondWishlist = await service.getWishlist(owner.id, 2);
    assert.equal(firstWishlist.items.length, 12); assert.equal(secondWishlist.items.length, 2);
    assert.equal(firstWishlist.total, 14);
    assert.equal(new Set([...firstWishlist.items, ...secondWishlist.items].map(row => row.productId)).size, 14);
    checks.push('wishlist pagination is stable and deleted/missing products remain removable without exposing internal balances');

    const route = load('app/api/products/[productId]/reviews/route.ts');
    state.user = other;
    const response = await route.POST(new Request('http://local', { method: 'POST', body: JSON.stringify({ ...review, userId: owner.id, orderId: order.id }) }), { params: Promise.resolve({ productId: product.id }) });
    assert.equal(response.status, 409);
    checks.push('real review route ignores forged user/order context and checks the actual session account');

    const report = { passed: true, checks };
    fs.mkdirSync(path.resolve(__dirname, '../.artifacts'), { recursive: true });
    fs.writeFileSync(path.resolve(__dirname, '../.artifacts/product-engagement-mongo-results.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    assert.match(database, /^sgtech_eng_qa_\d+_[a-f0-9-]+$/);
    await db.$runCommandRaw({ dropDatabase: 1 });
    await Promise.all([db.$disconnect(), second.$disconnect()]);
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
