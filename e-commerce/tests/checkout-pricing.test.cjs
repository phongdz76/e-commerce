const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac, randomUUID } = require('node:crypto');
const sourceLoader = require('./fixtures/load-source.cjs');
const { installStockDatabase, matches } = require('./fixtures/stock-db.cjs');
process.env.NEXTAUTH_SECRET = 'isolated-checkout-pricing-test-secret';
const pure = sourceLoader()('utils/checkoutTotals.ts');
const id = 'a'.repeat(24), userId = 'b'.repeat(24);
function fixture() {
  const orders = new Map(), requests = new Map(), attempts = new Map(), policies = new Map();
  const state = { user: { id: userId, role: 'ADMIN' }, policyReads: 0 };
  function model(rows) {
    return { findUnique: async ({ where }) => structuredClone([...rows.values()].find(row => matches(row, where)) || null),
      create: async ({ data }) => { if (rows.has(data.id)) throw Object.assign(new Error('Duplicate'), { code: 'P2002' }); const row = { createDate: new Date(), ...structuredClone(data) }; rows.set(row.id, row); return structuredClone(row); },
      updateMany: async ({ where, data }) => { let count = 0; for (const row of rows.values()) if (matches(row, where)) { Object.assign(row, structuredClone(data)); count++; } return { count }; } };
  }
  const db = { order: model(orders), checkoutRequest: model(requests), paymentAttempt: model(attempts), shippingPolicy: model(policies) };
  const serviceSettings=new Map(),serviceRevisions=new Map();db.customerServiceSettings=model(serviceSettings);db.customerServiceRevision=model(serviceRevisions);
  const findPolicy = db.shippingPolicy.findUnique;
  db.shippingPolicy.findUnique = async value => { state.policyReads++; return findPolicy(value); };
  const product = { id, name: 'QA phone', description: 'QA', category: 'Phones', brand: 'QA', price: 100000, inStock: true,
    images: [{ color: 'Black', colorCode: '#000000', image: '/products/phone.webp' }] };
  const stock = installStockDatabase(db, [product], [orders, requests, attempts, policies,serviceSettings,serviceRevisions]);
  const variant = [...stock.variants.values()][0];
  const load = sourceLoader({ '@/libs/prismadb': { __esModule: true, default: db }, '@/actions/getCurrentUser': { getCurrentUser: async () => state.user }, 'next/server': { NextResponse: { json: Response.json } } });
  const items = load('libs/orderItems.ts'), service = load('libs/checkoutQuote.ts'), deliveryService = load('libs/orderDelivery.ts');
  const deliveryBody = { fullName: 'QA buyer', phone: '0901234567', address: 'QA street', city: 'Ho Chi Minh City', provinceCode: '79' };
  const delivery = deliveryService.getOrderDelivery(deliveryBody);
  const cart = () => items.getOrderItems([{ id, variantId: variant.id, quantity: 1, price: stock.variants.get(variant.id).price }]);
  const req = body => new Request('http://localhost/api/checkout/quote', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
  const admin = load('app/api/admin/shipping-policy/route.ts');
  return { db, state, get variant() { return stock.variants.get(variant.id); }, stock, orders, attempts, policies, service, load, delivery, deliveryBody, cart, req, admin,
    checkout: load('libs/checkoutRequest.ts').prepareCheckoutRequest,
    quoteRoute: body => load('app/api/checkout/quote/route.ts').POST(req(body)) };
}
function expired(token) {
  const value = JSON.parse(Buffer.from(token.split('.')[0], 'base64url'));
  value.expiresAt = new Date(Date.now() - 1000).toISOString();
  const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
  return payload + '.' + createHmac('sha256', process.env.NEXTAUTH_SECRET).update('sgtech-checkout-v1:' + payload).digest('base64url');
}

test('a policy published after a quote rejects new checkout before stock writes and cannot retrofit a saved replay',async()=>{
 const f=fixture(),content=f.load('utils/customerServiceStarter.ts').starterServiceContent(),cart=await f.cart(),key=randomUUID();
 const oldQuote=await f.service.createCheckoutQuote(userId,cart,f.delivery);
 const first=await f.checkout(key,userId,'COD',cart,f.delivery,null,{},oldQuote.token);assert.equal(first.order.servicePolicies,undefined);
 const revision={id:'9'.repeat(24),revision:2,publishedAt:new Date(),content,publishedBy:userId};await f.db.customerServiceRevision.create({data:revision});await f.db.customerServiceSettings.create({data:{id:'default',version:2,publishedRevisionId:revision.id}});
 await assert.rejects(f.checkout(randomUUID(),userId,'COD',cart,f.delivery,null,{},oldQuote.token),e=>e.code==='QUOTE_SERVICE_CHANGED');assert.equal(f.orders.size,1);assert.equal(f.variant.inventory.reserved,1);
 const replay=await f.checkout(key,userId,'COD',cart,f.delivery,null,{},oldQuote.token);assert.equal(replay.order.id,first.order.id);assert.equal(replay.order.servicePolicies,undefined);
 const fresh=await f.service.createCheckoutQuote(userId,cart,f.delivery);assert.equal(fresh.servicePolicy.id,revision.id);await assert.rejects(f.checkout(key,userId,'COD',cart,f.delivery,null,{},fresh.token),e=>e.status===409);
 const created=await f.checkout(randomUUID(),userId,'COD',cart,f.delivery,null,{},fresh.token);assert.equal(created.order.servicePolicies.id,revision.id);assert.deepEqual(created.order.servicePolicies.pages.returns,content.pages.returns);
 revision.content.pages.returns.sections[0].text='Later edit in the test caller';assert.notEqual(f.orders.get(created.order.id).servicePolicies.pages.returns.sections[0].text,revision.content.pages.returns.sections[0].text);
});

test('chosen demo shipping policy charges 15000 below 300000 and is free at the threshold', () => {
  const { calculateCheckoutTotals, DEMO_SHIPPING_POLICY } = pure;
  assert.equal(calculateCheckoutTotals([{ variantId: id, price: 299999, quantity: 1 }], DEMO_SHIPPING_POLICY).grandTotal, 314999);
  assert.equal(calculateCheckoutTotals([{ variantId: id, price: 300000, quantity: 1 }], DEMO_SHIPPING_POLICY).shippingFee, 0);
  assert.equal(calculateCheckoutTotals([{ variantId: id, price: 150000, quantity: 2 }], DEMO_SHIPPING_POLICY).shippingFee, 0);
  for (const price of [0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER]) assert.throws(() => calculateCheckoutTotals([{ variantId: id, price, quantity: 20 }], DEMO_SHIPPING_POLICY));
});

test('per-line allocations preserve every VND and are stable across ordering and large totals', () => {
  const lines = [1, 2, 3].map((value, i) => ({ variantId: String(i + 1).repeat(24), price: value, quantity: 1 }));
  const policy = { ...pure.DEMO_SHIPPING_POLICY, fee: 11, freeShippingThreshold: null };
  const now = new Date('2026-10-15T00:00:00Z');
  const totals = pure.calculateCheckoutTotals(lines, policy, now);
  assert.equal(totals.lines.reduce((sum, line) => sum + line.shippingFee, 0), 11);
  assert.equal(totals.lines.reduce((sum, line) => sum + line.grandTotal, 0), totals.grandTotal);
  assert.deepEqual(pure.calculateCheckoutTotals([...lines].reverse(), policy, now), totals);
  const large = pure.calculateCheckoutTotals(lines.map(line => ({ ...line, price: 2147483647, quantity: 20 })), policy);
  assert.ok(Number.isSafeInteger(large.grandTotal));
  assert.equal(large.lines.reduce((sum, line) => sum + line.shippingFee, 0), 11);
});

test('shipping config rejects fractional, negative, oversized and ambiguous service-area settings', () => {
  for (const patch of [{ fee: -1 }, { fee: 1.1 }, { freeShippingThreshold: 0 }, { freeShippingThreshold: '300000' }, { provinceCodes: ['79', '79'] }, { provinceCodes: ['../79'] }, { nationwide: false, provinceCodes: [] }, { enabled: 'true' }, { label: 'x\u0000' }, { version: -1 }]) assert.equal(pure.parseShippingPolicy({ ...pure.DEMO_SHIPPING_POLICY, ...patch }), null);
});

test('quotes bind the owner, exact delivery, SKUs, prices and quantities; client fee fields are ignored', async () => {
  const f = fixture(), cart = await f.cart();
  const response = await f.quoteRoute({ ...f.deliveryBody, items: cart.items, amount: 1, shippingFee: 0, discountTotal: 999999 });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const quote = await response.json();
  assert.equal(quote.totals.grandTotal, 115000);
  assert.equal(f.service.verifyCheckoutQuote(quote.token, userId, cart, f.delivery).totals.grandTotal, 115000);
  for (const operation of [() => f.service.verifyCheckoutQuote(quote.token + 'x', userId, cart, f.delivery),
    () => f.service.verifyCheckoutQuote(quote.token, 'c'.repeat(24), cart, f.delivery),
    () => f.service.verifyCheckoutQuote(quote.token, userId, cart, { ...f.delivery, recipientPhone: '0907654321' }),
    () => f.service.verifyCheckoutQuote(quote.token, userId, { ...cart, items: cart.items.map(row => ({ ...row, quantity: 2 })) }, f.delivery),
    () => f.service.verifyCheckoutQuote(undefined, userId, cart, f.delivery)]) assert.throws(operation);
  assert.equal(f.variant.inventory.reserved, 0);
});

test('all payment methods commit the quoted total and immutable per-line snapshot in the same stock transaction', async () => {
  const f = fixture(), cart = await f.cart();
  const quote = await f.service.createCheckoutQuote(userId, cart, f.delivery);
  for (const method of ['COD', 'MOMO', 'VNPAY', 'ZALOPAY', 'STRIPE']) {
    const { order, attempt } = await f.checkout(randomUUID(), userId, method, cart, f.delivery, null, {}, quote.token);
    assert.equal(order.amount, 115000); assert.equal(attempt.amount, order.amount);
    assert.equal(order.totals.shippingFee, 15000); assert.equal(order.totals.lines[0].grandTotal, order.amount);
    assert.equal(order.address.provinceCode, '79');
  }
  assert.equal(f.variant.inventory.reserved, 5);
});

test('missing, expired or stale-policy quotes cannot create orders or reserve stock', async () => {
  const f = fixture(), cart = await f.cart(), quote = await f.service.createCheckoutQuote(userId, cart, f.delivery);
  for (const token of [undefined, expired(quote.token)]) await assert.rejects(f.checkout(randomUUID(), userId, 'COD', cart, f.delivery, null, {}, token), error => ['QUOTE_REQUIRED', 'QUOTE_EXPIRED'].includes(error.code));
  f.policies.set('default', { id: 'default', ...pure.DEMO_SHIPPING_POLICY, version: 1, fee: 18000 });
  await assert.rejects(f.checkout(randomUUID(), userId, 'COD', cart, f.delivery, null, {}, quote.token), error => error.code === 'QUOTE_CHANGED');
  assert.equal(f.orders.size, 0); assert.equal(f.variant.inventory.reserved, 0);
});

test('retry after commit resumes the same order even after expiry or policy changes, without another hold', async () => {
  const f = fixture(), cart = await f.cart(), quote = await f.service.createCheckoutQuote(userId, cart, f.delivery), key = randomUUID();
  const first = await f.checkout(key, userId, 'COD', cart, f.delivery, null, {}, quote.token);
  f.policies.set('default', { id: 'default', ...pure.DEMO_SHIPPING_POLICY, version: 1, fee: 18000 });
  const retry = await f.checkout(key, userId, 'COD', cart, f.delivery, null, {}, expired(quote.token));
  assert.equal(retry.order.id, first.order.id); assert.equal(retry.order.amount, 115000);
  assert.equal(f.orders.size, 1); assert.equal(f.variant.inventory.reserved, 1);
});

test('MoMo validates its limits against the total including delivery, before holding stock', async () => {
  const f = fixture();
  f.policies.set('default', { id: 'default', ...pure.DEMO_SHIPPING_POLICY, version: 1, freeShippingThreshold: null });
  f.variant.price = 49990000;
  let cart = await f.cart(), quote = await f.service.createCheckoutQuote(userId, cart, f.delivery);
  await assert.rejects(f.checkout(randomUUID(), userId, 'MOMO', cart, f.delivery, null, {}, quote.token), error => error.code === 'PAYMENT_AMOUNT_INVALID');
  assert.equal(f.variant.inventory.reserved, 0);
  f.variant.price = 500;
  cart = await f.cart(); quote = await f.service.createCheckoutQuote(userId, cart, f.delivery);
  assert.equal((await f.checkout(randomUUID(), userId, 'MOMO', cart, f.delivery, null, {}, quote.token)).order.amount, 15500);
});

test('disabled and excluded regions cannot be quoted; legacy addresses need a province code', async () => {
  const f = fixture(), cart = await f.cart();
  for (const policy of [{ ...pure.DEMO_SHIPPING_POLICY, enabled: false }, { ...pure.DEMO_SHIPPING_POLICY, nationwide: false, provinceCodes: ['1'] }]) {
    f.policies.set('default', { id: 'default', ...policy });
    await assert.rejects(f.service.createCheckoutQuote(userId, cart, f.delivery), error => error.code === 'SHIPPING_UNAVAILABLE');
  }
  f.policies.clear();
  await assert.rejects(f.service.createCheckoutQuote(userId, cart, { ...f.delivery, address: { ...f.delivery.address, provinceCode: undefined } }), error => error.code === 'DELIVERY_REGION_REQUIRED');
});

test('quote and configuration routes authenticate before accessing settings', async () => {
  const f = fixture(); f.state.user = null;
  assert.equal((await f.quoteRoute({})).status, 401);
  assert.equal((await f.admin.GET()).status, 401); assert.equal((await f.admin.PUT(f.req({}))).status, 401);
  f.state.user = { id: userId, role: 'USER' };
  assert.equal((await f.admin.GET()).status, 403); assert.equal((await f.admin.PUT(f.req({}))).status, 403);
  assert.equal(f.state.policyReads, 0);
});

test('concurrent policy edits use versions, audit atomically and retry without duplicating the change', async () => {
  const f = fixture();
  const body = { ...pure.DEMO_SHIPPING_POLICY, fee: 17000, reason: 'Adjust the demo shipping policy', requestId: randomUUID() };
  const outcomes = await Promise.all([f.admin.PUT(f.req(body)), f.admin.PUT(f.req({ ...body, fee: 19000, requestId: randomUUID() }))]);
  assert.equal(outcomes.filter(row => row.status === 200).length, 1);
  assert.equal(outcomes.filter(row => row.status === 409).length, 1);
  const saved = await f.admin.PUT(f.req(body));
  assert.equal(saved.status, 200); assert.equal((await saved.json()).policy.version, 1);
  assert.equal(f.stock.audits.size, 1);
  const old = structuredClone(f.policies.get('default'));
  f.db.auditLog.create = async () => { throw new Error('Private audit failure'); };
  assert.equal((await f.admin.PUT(f.req({ ...body, version: 1, fee: 22000, requestId: randomUUID() }))).status, 503);
  assert.deepEqual(f.policies.get('default'), old);
});
