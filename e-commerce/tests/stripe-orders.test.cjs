const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Readable } = require('node:stream');
const ts = require('typescript');
const Stripe = require('stripe');

// Execute the real route/service code with in-memory provider and database adapters.
// No credentials, network requests, orders or payments are created by these tests.
function loadSource(file, mocks = {}) {
  const filename = path.join(__dirname, '..', file);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  const module = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename })(
    name => name in mocks ? mocks[name] : require(name), module, module.exports,
  );
  return module.exports;
}

const { products } = loadSource('utils/products.tsx');
const product = products.find(p => p.inStock);
const cart = [{ ...product, selectedImg: product.images[0], quantity: 1 }];
const copy = value => structuredClone(value);

function fixture() {
  const rows = new Map();
  const intents = new Map();
  const requestKeys = new Map();
  let created = 0;
  const state = { user: { id: 'owner', role: 'USER' }, offline: false, race: null, uniqueConflict: false };
  function matches(row, where) {
    return Object.entries(where).every(([key, value]) => {
      if (value && typeof value === 'object') {
        if (value.in) return value.in.includes(row[key]);
        if (value.notIn) return !value.notIn.includes(row[key]);
      }
      return row[key] === value;
    });
  }
  const prisma = { order: {
    findFirst: async ({ where }) => copy([...rows.values()].find(row => matches(row, where)) || null),
    findUnique: async ({ where, include }) => {
      const row = [...rows.values()].find(row => matches(row, where));
      return row ? { ...copy(row), ...(include?.user ? { user: { id: row.userId, name: 'Customer', email: 'customer@example.test', image: null } } : {}) } : null;
    },
    findMany: async ({ where = {}, take }) => copy([...rows.values()].filter(row => matches(row, where)).reverse().slice(0, take)),
    updateMany: async ({ where, data }) => {
      if (state.race) { state.race(); state.race = null; }
      let count = 0;
      for (const row of rows.values()) if (matches(row, where)) { Object.assign(row, copy(data)); count++; }
      return { count };
    },
    upsert: async ({ where, create, update }) => {
      let row = [...rows.values()].find(row => matches(row, where));
      if (row) Object.assign(row, copy(update));
      else { row = { id: `order-${rows.size + 1}`, createDate: new Date(), ...copy(create) }; rows.set(row.id, row); }
      if (state.uniqueConflict) { state.uniqueConflict = false; throw Object.assign(new Error('Concurrent insert'), { code: 'P2002' }); }
      return copy(row);
    },
  } };
  const stripe = {
    webhooks: new Stripe('sk_test_fixture').webhooks,
    paymentIntents: {
      retrieve: async id => {
        if (state.offline) throw new Error('Provider temporarily unavailable');
        if (!intents.has(id)) throw new Error('Intent missing');
        return copy(intents.get(id));
      },
      create: async (data, { idempotencyKey }) => {
        if (!requestKeys.has(idempotencyKey)) {
          const intent = { id: `pi_${++created}`, client_secret: 'test-secret', status: 'requires_payment_method', amount_received: 0, ...copy(data) };
          requestKeys.set(idempotencyKey, intent.id);
          intents.set(intent.id, intent);
        }
        return copy(intents.get(requestKeys.get(idempotencyKey)));
      },
      update: async (id, data) => { Object.assign(intents.get(id), copy(data)); return copy(intents.get(id)); },
    },
  };
  const mocks = {
    '@/actions/getCurrentUser': { getCurrentUser: async () => state.user },
    '@/libs/prismadb': { __esModule: true, default: prisma },
    '@/libs/stripe': { getStripe: () => stripe },
    './stripe': { getStripe: () => stripe },
    '@/utils/products': { products },
    'next/server': { NextResponse: { json: (data, options) => Response.json(data, options) } },
  };
  const sync = loadSource('libs/syncStripeOrder.ts', mocks);
  mocks['@/libs/syncStripeOrder'] = sync;
  const prepare = loadSource('app/api/create-payment-intent/route.ts', mocks).POST;
  const verify = loadSource('app/api/order/stripe-status/route.ts', mocks).POST;
  const list = loadSource('app/api/order/route.ts', mocks).GET;
  const detail = loadSource('app/api/order/[orderId]/route.ts', mocks).GET;
  const webhook = loadSource('pages/api/stripe-webhook.ts', mocks).default;
  const request = body => new Request('http://localhost/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const create = (body = {}) => prepare(request({ items: cart, checkout_request_id: 'stable-request', ...body }));
  const pay = id => Object.assign(intents.get(id), { status: 'succeeded', amount_received: intents.get(id).amount });
  return { state, rows, intents, stripe, sync, verify, list, detail, webhook, request, create, pay, created: () => created };
}

test('parallel initialization, reload and retry reuse one intent and one draft order', async () => {
  const f = fixture();
  const responses = await Promise.all(Array.from({ length: 6 }, () => f.create()));
  for (const response of responses) assert.equal(response.status, 200);
  assert.equal(f.created(), 1);
  assert.equal(f.rows.size, 1);
  assert.equal([...f.rows.values()][0].status, 'draft');
  assert.deepEqual(await (await f.list()).json(), []);
  await f.create({ checkout_request_id: 'another-tab' });
  assert.equal(f.created(), 1);
  f.state.uniqueConflict = true;
  assert.equal((await f.create({ payment_intent_id: 'pi_1' })).status, 200);
  assert.equal(f.rows.size, 1);
});

test('server catalog determines the amount, name and image instead of client data', async () => {
  const f = fixture();
  const result = await (await f.create({ items: [{ ...cart[0], price: 1, name: 'Tampered', selectedImg: { ...cart[0].selectedImg, image: 'https://invalid.test/fake' } }] })).json();
  assert.equal(result.order.amount, product.price);
  assert.equal(result.order.products[0].name, product.name);
  assert.equal(result.order.products[0].selectedImg.image, product.images[0].image);
});

test('empty, duplicated, unavailable products and invalid quantities create nothing', async () => {
  const f = fixture();
  for (const items of [[], [cart[0], cart[0]], [{ ...cart[0], quantity: 0 }], [{ ...cart[0], quantity: 21 }], [{ ...cart[0], quantity: 1.5 }], [{ ...cart[0], id: 'missing' }], [{ ...cart[0], selectedImg: { color: 'missing' } }]]) {
    assert.equal((await f.create({ items })).status, 400);
  }
  assert.equal(f.created(), 0);
});

test('successful payment reconciles the existing row, persists shipping and appears once', async () => {
  const f = fixture();
  const { order } = await (await f.create()).json();
  f.pay('pi_1');
  f.intents.get('pi_1').shipping = { address: { line1: 'Example address', country: 'VN' } };
  const response = await f.verify(f.request({ payment_intent_id: 'pi_1' }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).order.status, 'complete');
  assert.equal(f.rows.get(order.id).address.line1, 'Example address');
  assert.equal((await (await f.list()).json()).length, 1);
  const repeated = await (await f.create({ payment_intent_id: 'pi_1' })).json();
  assert.equal(repeated.alreadyPaid, true);
  assert.equal(f.created(), 1);
  assert.equal(f.rows.size, 1);
});

test('two actual successful payments stay as distinct paid orders', async () => {
  const f = fixture();
  await f.create(); f.pay('pi_1'); await f.list();
  await f.create({ checkout_request_id: 'new-purchase' }); f.pay('pi_2');
  const orders = await (await f.list()).json();
  assert.equal(orders.length, 2);
  assert.ok(orders.every(order => order.status === 'complete'));
});

test('processing and authentication-required payments block a new charge', async () => {
  for (const status of ['processing', 'requires_capture', 'requires_action']) {
    const f = fixture();
    await f.create(); f.intents.get('pi_1').status = status;
    assert.equal((await f.create({ payment_intent_id: 'pi_1' })).status, 409);
    assert.equal((await f.create({ checkout_request_id: 'another-tab' })).status, 409);
    assert.equal(f.created(), 1);
  }
});

test('cancelled cached payment prompts a fresh attempt instead of reusing a dead secret', async () => {
  const f = fixture(); await f.create(); f.intents.get('pi_1').status = 'canceled';
  const response = await f.create({ payment_intent_id: 'pi_1' });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'INVALID_PAYMENT_REFERENCE');
  assert.equal([...f.rows.values()][0].status, 'failed');
  assert.equal((await f.create({ checkout_request_id: 'fresh-attempt' })).status, 200);
  assert.equal(f.created(), 2);
});

test('legacy unpaid duplicate rows are drafts; the succeeded row becomes complete on read', async () => {
  const f = fixture(); await f.create(); await f.create({ items: [{ ...cart[0], quantity: 2 }], checkout_request_id: 'second' });
  for (const row of f.rows.values()) row.status = 'pending';
  f.pay('pi_1');
  const orders = await (await f.list()).json();
  assert.equal(orders.length, 1);
  assert.equal(orders[0].status, 'complete');
  assert.equal(f.rows.size, 2);
});

test('anonymous and other users cannot retrieve, update or claim an intent', async () => {
  const f = fixture(); const { order } = await (await f.create()).json();
  f.state.user = null;
  assert.equal((await f.create()).status, 401);
  assert.equal((await f.verify(f.request({ payment_intent_id: 'pi_1' }))).status, 401);
  f.state.user = { id: 'other', role: 'USER' };
  assert.equal((await f.create({ payment_intent_id: 'pi_1' })).status, 400);
  assert.equal((await f.verify(f.request({ payment_intent_id: 'pi_1', status: 'complete' }))).status, 404);
  assert.equal((await f.detail(new Request('http://localhost/test'), { params: Promise.resolve({ orderId: order.id }) })).status, 403);
  assert.equal(f.intents.get('pi_1').amount, product.price);
  assert.equal(f.created(), 1);
});

test('client success flags, provider outage, wrong amount/currency and partial receipts never mark paid', async () => {
  const f = fixture(); await f.create();
  const verify = () => f.verify(f.request({ payment_intent_id: 'pi_1', status: 'complete', redirect_status: 'succeeded' }));
  assert.equal((await (await verify()).json()).order.status, 'draft');
  f.state.offline = true; assert.equal((await verify()).status, 502); f.state.offline = false;
  f.pay('pi_1');
  for (const change of [{ currency: 'usd' }, { amount: 1 }, { amount_received: 1 }]) {
    const original = copy(f.intents.get('pi_1'));
    Object.assign(f.intents.get('pi_1'), change);
    assert.equal((await verify()).status, 502);
    assert.equal([...f.rows.values()][0].status, 'draft');
    f.intents.set('pi_1', original);
  }
});

test('a stale processing update cannot overwrite a concurrent successful webhook', async () => {
  const f = fixture(); const { order } = await (await f.create()).json();
  f.intents.get('pi_1').status = 'processing';
  f.state.race = () => { f.rows.get(order.id).status = 'complete'; };
  const result = await f.sync.syncStripeOrder(order);
  assert.equal(result.status, 'complete');
  assert.equal(f.rows.get(order.id).status, 'complete');
  f.intents.get('pi_1').status = 'requires_payment_method';
  assert.equal((await f.sync.syncStripeOrder(result)).status, 'complete');
});

test('signed webhook retries and out-of-order events update an existing order once', async () => {
  const f = fixture(); await f.create(); f.pay('pi_1');
  const previous = process.env.STRIPE_WEBHOOK_SECRET;
  const secret = 'whsec_unit_test_only'; process.env.STRIPE_WEBHOOK_SECRET = secret;
  async function event(type, id = 'pi_1', invalid = false) {
    const payload = JSON.stringify({ id: 'evt_fixture', object: 'event', type, data: { object: { id, payment_intent: 'pi_1', status: 'processing' } } });
    const req = Readable.from([Buffer.from(payload)]);
    req.method = 'POST'; req.headers = { 'stripe-signature': invalid ? 'invalid' : f.stripe.webhooks.generateTestHeaderString({ payload, secret }) };
    const res = { code: 200, status(code) { this.code = code; return this; }, send() { return this; }, end() { return this; }, json() { return this; } };
    await f.webhook(req, res); return res.code;
  }
  try {
    assert.equal(await event('payment_intent.succeeded', 'pi_1', true), 400);
    assert.equal([...f.rows.values()][0].status, 'draft');
    for (const type of ['payment_intent.succeeded', 'payment_intent.succeeded', 'payment_intent.processing', 'charge.succeeded']) assert.equal(await event(type), 200);
    assert.equal([...f.rows.values()][0].status, 'complete');
    assert.equal(f.rows.size, 1);
    assert.equal(await event('payment_intent.succeeded', 'pi_not_ready'), 503);
  } finally { if (previous === undefined) delete process.env.STRIPE_WEBHOOK_SECRET; else process.env.STRIPE_WEBHOOK_SECRET = previous; }
});
