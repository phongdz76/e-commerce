const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const { encode } = require('next-auth/jwt');
const { seedReturnOrder } = require('./return-qa-fixture.cjs');
require('@next/env').loadEnvConfig(path.resolve(__dirname, '..'));

async function main() {
  const app = path.resolve(__dirname, '..'), artifacts = path.join(app, '.artifacts');
  fs.mkdirSync(artifacts, { recursive: true });
  const database = 'sgtech_eng_http_' + Date.now() + '_' + randomUUID().slice(0, 4);
  const connection = new URL(process.env.DATABASE_URL), original = connection.pathname;
  connection.pathname = '/' + database;
  assert.notEqual(connection.pathname, original);
  assert.match(database, /^sgtech_eng_http_\d+_[a-f0-9]+$/);
  const db = new PrismaClient({ datasources: { db: { url: connection.toString() } } });
  const port = Number(process.env.QA_ENGAGEMENT_HTTP_PORT || 3304);
  const origin = 'http://127.0.0.1:' + port, secret = randomUUID() + randomUUID();
  const log = fs.openSync(path.join(artifacts, 'engagement-e2e-server.log'), 'w');
  let server;
  const checks = [];
  try {
    const users = await Promise.all([0, 1, 2].map(index => db.user.create({ data: { name: 'QA customer ' + index, email: `qa-${index}@example.invalid`, status: 'ACTIVE', sessionVersion: 0 } })));
    const category = await db.category.create({ data: { name: 'QA category', slug: 'qa' } });
    const brand = await db.brand.create({ data: { name: 'QA brand', slug: 'qa' } });
    const product = await db.product.create({ data: { name: 'Engagement QA phone', slug: 'qa', description: 'Isolated QA phone', status: 'ACTIVE', categoryId: category.id, brandId: brand.id } });
    await seedReturnOrder(db, users[0].id, product.id);
    await seedReturnOrder(db, users[2].id, product.id);
    server = spawn(process.execPath, [path.join(app, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
      cwd: app, windowsHide: true, stdio: ['ignore', log, log], env: { ...process.env, DATABASE_URL: connection.toString(), NEXTAUTH_SECRET: secret,
        NEXTAUTH_URL: origin, NEXT_PUBLIC_APP_URL: origin, NODE_ENV: 'production', SGTECH_EVENT_EMAILS_ENABLED: 'false' },
    });
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) throw Error('QA server exited');
      try { ready = (await fetch(origin + '/api/health', { signal: AbortSignal.timeout(1000) })).ok; } catch {}
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    assert.ok(ready);
    const cookies = await Promise.all(users.map(async user => 'next-auth.session-token=' + await encode({ secret, maxAge: 600,
      token: { sub: user.id, userId: user.id, sessionVersion: 0, authenticatedAt: Date.now() } })));
    const call = (route, cookie, method = 'GET', body) => fetch(origin + route, { method, redirect: 'manual',
      headers: { ...(cookie ? { Cookie: cookie } : {}), 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(60000) });
    const wishlist = '/api/wishlist/' + product.id, reviews = '/api/products/' + product.id + '/reviews';
    assert.equal((await call('/api/wishlist')).status, 401);
    assert.equal((await call('/wishlist')).status, 307);
    assert.equal((await call(reviews)).status, 200);
    assert.equal((await call(reviews, null, 'POST', { rating: 5, comment: 'Purchased phone review.' })).status, 401);
    assert.equal((await call(reviews, cookies[1], 'POST', { rating: 5, comment: 'Purchased phone review.', userId: users[0].id })).status, 409);
    assert.equal((await call(wishlist, cookies[0], 'PUT')).status, 200);
    assert.equal((await (await call(wishlist, cookies[1])).json()).saved, false);
    assert.equal((await call(wishlist, cookies[1], 'DELETE')).status, 200);
    assert.equal((await (await call(wishlist, cookies[0])).json()).saved, true);
    assert.equal((await call(wishlist, cookies[0], 'DELETE')).status, 200);
    checks.push('production HTTP routes enforce guest/authenticated access, actual purchase ownership and private wishlists');

    if (process.env.QA_BROWSER === 'true') {
      await require('./check-product-engagement-browser.cjs').verifyProductEngagementBrowser({ origin, cookie: cookies[0], productId: product.id, artifacts, checks });
    }
    const review = { rating: 4, comment: 'A practical phone after a recorded purchase and delivery.' };
    for (let i = 0; i < 2; i++) assert.equal((await call(reviews, cookies[2], 'POST', review)).status, 200);
    assert.equal((await call(reviews, cookies[2], 'POST', { ...review, rating: 1 })).status, 409);
    assert.equal((await (await call(reviews)).json()).items.filter(item => item.comment === review.comment).length, 0);
    const own = await (await call(reviews, cookies[2])).json();
    assert.equal(own.ownReview.status, 'PENDING');
    const moderator = await db.user.create({ data: { name: 'QA moderator', role: 'ADMIN', status: 'ACTIVE', sessionVersion: 0 } });
    const moderatorCookie = 'next-auth.session-token=' + await encode({ secret, maxAge: 600, token: { sub: moderator.id, userId: moderator.id, sessionVersion: 0, authenticatedAt: Date.now() } });
    assert.equal((await call('/api/admin/reviews/' + own.ownReview.id, moderatorCookie, 'POST', { action: 'APPROVE', version: 0, requestId: randomUUID() })).status, 200);
    const saved = await (await call(reviews)).json();
    assert.equal(saved.items.filter(item => item.comment === review.comment).length, 1);
    assert.doesNotMatch(JSON.stringify(saved), /userId|orderId|email|hashedPassword/);
    const page = await call('/products');
    assert.equal(page.status, 200);
    checks.push('production review submission is idempotent, changed duplicates conflict, public details stay private and catalog renders saved ratings');
    const report = { passed: true, checks, applicationDatabaseWrites: 0, providerNetworkCalls: 0 };
    fs.writeFileSync(path.join(artifacts, 'product-engagement-e2e-results.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    if (server?.pid && server.exitCode === null) {
      if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      else server.kill('SIGTERM');
    }
    fs.closeSync(log);
    assert.equal(connection.pathname, '/' + database);
    assert.match(database, /^sgtech_eng_http_\d+_[a-f0-9]+$/);
    await db.$runCommandRaw({ dropDatabase: 1 });
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
