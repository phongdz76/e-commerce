const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { fixture } = require('./fixtures/returns.cjs');

function setup() {
  const f = fixture();
  Object.assign(f.order, {
    currency: 'vnd',
    recipientName: 'QA recipient',
    recipientPhone: '0900000000',
    address: {
      line1: 'Private QA street',
      city: 'QA city',
      country: 'VN',
    },
  });

  const target = {
    ...structuredClone(f.stock.variants.get(f.variantId)),
    id: '4'.repeat(24),
    sku: 'QA-REPLACEMENT',
    name: 'Blue option',
    price: 100000,
    currency: 'vnd',
    isActive: true,
    inStock: true,
    inventory: {
      onHand: 2,
      reserved: 1,
      version: 1,
      updatedAt: new Date(),
    },
    product: {
      id: f.order.products[0].id,
      name: 'Verified replacement phone',
      status: 'ACTIVE',
      category: { isVisible: true },
      brand: { isVisible: true },
    },
  };
  f.stock.variants.set(target.id, target);

  const ready = async () => {
    const { id } = await f.create({ preference: 'EXCHANGE' });
    await f.inspect(id, false);
    return id;
  };

  const reserve = (id) =>
    f.change(id, 'EXCHANGE_RESERVE', f.admin, { variantId: target.id });

  const snapshot = () => f.stock.variants.get(target.id);

  return { ...f, target, ready, reserve, snapshot };
}

test('exchange action parsing requires a SKU, carrier and tracking/delivery evidence, and validates snapshots without exposing unknown fields', async () => {
  const f = setup();
  const { parseReturnAction, parseReturnExchange } = f.load('utils/returnCases.ts');
  const base = {
    action: 'EXCHANGE_RESERVE',
    version: 1,
    requestId: randomUUID(),
    text: 'Offer the reviewed replacement to the customer.',
    confirmed: true,
  };

  assert.equal(parseReturnAction(base), null);
  assert.equal(parseReturnAction({ ...base, variantId: 'forged' }), null);
  assert.ok(parseReturnAction({ ...base, variantId: f.target.id }));

  const invalidShipPatches = [
    {},
    { carrier: 'QA carrier' },
    { carrier: 'x', reference: 'TRACK' },
    { carrier: 'QA\ncarrier', reference: 'TRACK' },
  ];
  for (const patch of invalidShipPatches) {
    assert.equal(
      parseReturnAction({ ...base, action: 'EXCHANGE_SHIP', ...patch }),
      null,
    );
  }

  assert.ok(
    parseReturnAction({
      ...base,
      action: 'EXCHANGE_SHIP',
      carrier: 'QA carrier',
      reference: 'QA-TRACK',
    }),
  );

  const id = await f.ready();
  await f.reserve(id);

  const offer = f.cases.get(id).exchange;
  assert.equal(parseReturnExchange({ ...offer, state: 'constructor' }), null);
  assert.equal(parseReturnExchange({ ...offer, quantity: -1 }), null);
  assert.equal(parseReturnExchange({ ...offer, state: 'SHIPPED' }), null);
  assert.equal(
    parseReturnExchange({ ...offer, privateProviderSecret: 'never expose' })
      .privateProviderSecret,
    undefined,
  );
});

test('exchange keeps original payment and damaged stock unchanged, holds one unit, requires customer approval, dispatches once and resolves after receipt', async () => {
  const f = setup();
  const id = await f.ready();

  await f.reserve(id);
  assert.equal(f.snapshot().inventory.onHand, 2);
  assert.equal(f.snapshot().inventory.reserved, 2);
  assert.equal(f.cases.get(id).exchange.state, 'OFFERED');

  await assert.rejects(
    f.change(id, 'EXCHANGE_SHIP', f.admin, { carrier: 'QA carrier' }),
    (e) => e.code === 'RETURN_ACTION_LOCKED',
  );

  await f.change(id, 'EXCHANGE_ACCEPT', f.owner);
  const dispatch = {
    action: 'EXCHANGE_SHIP',
    version: f.cases.get(id).version,
    requestId: randomUUID(),
    text: 'Replacement handed over against the saved destination.',
    reference: 'QA-TRACK',
    carrier: 'QA carrier',
  };
  await Promise.all(
    Array.from({ length: 6 }, () => f.service.changeReturnCase(id, f.admin, dispatch)),
  );

  assert.equal(f.snapshot().inventory.onHand, 1);
  assert.equal(f.snapshot().inventory.reserved, 1);
  assert.equal(f.cases.get(id).exchange.state, 'SHIPPED');
  assert.notEqual(f.cases.get(id).state, 'EXCHANGED');

  await assert.rejects(
    f.change(id, 'EXCHANGE_RELEASE'),
    (e) => e.code === 'RETURN_ACTION_LOCKED',
  );

  await f.change(id, 'EXCHANGE_RECEIVE', f.owner);
  assert.equal(f.cases.get(id).state, 'EXCHANGED');
  assert.equal(f.cases.get(id).exchange.state, 'DELIVERED');
  assert.equal([...f.tickets.values()][0].state, 'RESOLVED');
  assert.equal(f.conversations.get(f.owner.id).status, 'OPEN');
  assert.equal(f.orders.get(f.order.id).status, 'paid');
  assert.equal(f.orders.get(f.order.id).refundInfo, undefined);

  assert.equal(
    f.stock.variants.get(f.variantId).inventory.onHand,
    4,
    'unsuitable original goods never enter sellable stock',
  );

  const orderOptions = await f.service.returnOrderOptions(f.owner.id, f.order.id);
  assert.equal(
    orderOptions.items[0].available,
    1,
    'exchanged quantity remains allocated',
  );

  const dispatchAudits = [...f.stock.audits.values()].filter(
    (a) => a.action === 'EXCHANGE_STOCK_DISPATCHED',
  );
  assert.equal(dispatchAudits.length, 1);
});

test('reservation and customer decline replay once, release only the exchange hold and permit a new offer', async () => {
  const f = setup();
  const id = await f.ready();

  const input = {
    action: 'EXCHANGE_RESERVE',
    variantId: f.target.id,
    version: f.cases.get(id).version,
    requestId: randomUUID(),
    text: 'Offer this available SKU at the saved order unit price.',
    reference: null,
  };
  await Promise.all(
    Array.from({ length: 6 }, () => f.service.changeReturnCase(id, f.admin, input)),
  );
  assert.equal(f.snapshot().inventory.reserved, 2);

  const decline = {
    action: 'EXCHANGE_DECLINE',
    version: f.cases.get(id).version,
    requestId: randomUUID(),
    text: 'I decline the proposed replacement and ask support to review.',
    reference: null,
  };
  await Promise.all(
    Array.from({ length: 6 }, () => f.service.changeReturnCase(id, f.owner, decline)),
  );
  assert.equal(f.snapshot().inventory.reserved, 1);
  assert.equal(f.snapshot().inventory.onHand, 2);
  assert.equal(f.cases.get(id).exchange.state, 'RELEASED');

  const oldOffer = f.cases.get(id).exchange.offerId;
  await f.reserve(id);
  assert.notEqual(f.cases.get(id).exchange.offerId, oldOffer);

  const events = await f.service.getReturnCase(id, f.owner);
  const offeredEvents = events.events.filter(
    (event) => event.exchange?.state === 'OFFERED',
  );
  assert.equal(offeredEvents.length, 2);
  assert.ok(
    events.events.some(
      (event) =>
        event.exchange?.offerId === oldOffer &&
        event.exchange.state === 'RELEASED',
    ),
  );
});

test('admin release versus customer acceptance has one winner and never leaks a held unit', async () => {
  const f = setup();
  const id = await f.ready();
  await f.reserve(id);

  const version = f.cases.get(id).version;
  const contenders = await Promise.allSettled([
    f.change(id, 'EXCHANGE_RELEASE', f.admin, { version }),
    f.change(id, 'EXCHANGE_ACCEPT', f.owner, { version }),
  ]);
  assert.equal(contenders.filter((r) => r.status === 'fulfilled').length, 1);
  assert.ok(contenders.some((r) => r.status === 'rejected' && r.reason.status === 409));

  if (f.cases.get(id).exchange.state === 'ACCEPTED') {
    await f.change(id, 'EXCHANGE_RELEASE');
  }
  assert.equal(f.snapshot().inventory.reserved, 1);
});

test('last available replacement is shared with other reservations and two cases cannot both hold it', async () => {
  const f = setup();
  const first = await f.ready();
  const second = await f.create({ preference: 'EXCHANGE' });

  for (const kind of ['ACCEPT', 'RECEIVE', 'INSPECT_OTHER']) {
    await f.change(second.id, kind);
  }

  const results = await Promise.allSettled([
    f.reserve(first),
    f.reserve(second.id),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.ok(
    results.some(
      (r) => r.status === 'rejected' && r.reason.code === 'EXCHANGE_UNAVAILABLE',
    ),
  );
  assert.equal(f.snapshot().inventory.reserved, 2);
});

test('exchange refuses different product/price/currency, hidden catalog or disabled/insufficient inventory and options match eligibility', async () => {
  const patches = [
    { productId: '5'.repeat(24) },
    { price: 200000 },
    { currency: 'usd' },
    { isActive: false },
    { inStock: false },
    { inventory: { onHand: 1, reserved: 1, version: 1, updatedAt: new Date() } },
    {
      product: {
        status: 'DRAFT',
        category: { isVisible: true },
        brand: { isVisible: true },
      },
    },
  ];

  for (const patch of patches) {
    const f = setup();
    const id = await f.ready();
    Object.assign(f.snapshot(), patch);

    await assert.rejects(f.reserve(id), (e) => e.code === 'EXCHANGE_UNAVAILABLE');
    const options = await f
      .load('libs/returnExchange.ts')
      .returnExchangeOptions(id, f.admin);
    assert.equal(options.items.length, 0);
  }
});

test('only inspected cases may offer an exchange and missing destination or unsupported saved reservations need review', async () => {
  const f = setup();
  const { id } = await f.create();
  await f.claim();

  await assert.rejects(
    f.reserve(id),
    (e) => e.code === 'RETURN_ACTION_LOCKED',
  );

  for (const kind of ['ACCEPT', 'RECEIVE', 'INSPECT_RESTOCKABLE']) {
    await f.change(id, kind);
  }

  await assert.rejects(
    f.reserve(id),
    (e) => e.code === 'RETURN_ACTION_LOCKED',
  );

  await f.change(id, 'RESTOCK');
  f.orders.get(f.order.id).address = null;

  await assert.rejects(
    f.reserve(id),
    (e) => e.code === 'EXCHANGE_ADDRESS_REVIEW',
  );

  f.cases.get(id).exchange = { state: 'OFFERED', variantId: f.target.id };
  await assert.rejects(
    f.service.getReturnCase(id, f.owner),
    (e) => e.code === 'EXCHANGE_STOCK_REVIEW',
  );
});

test('the original offer snapshot survives catalog/address changes and dispatch honors its reserved SKU and accepted price', async () => {
  const f = setup();
  const id = await f.ready();
  await f.reserve(id);

  f.snapshot().price = 300000;
  f.snapshot().name = 'Later option name';
  f.orders.get(f.order.id).recipientName = 'Later recipient';

  await f.change(id, 'EXCHANGE_ACCEPT', f.owner);
  await f.change(id, 'EXCHANGE_SHIP', f.admin, { carrier: 'QA carrier' });

  const view = await f.service.getReturnCase(id, f.owner);
  assert.equal(view.case.exchange.option, 'Blue option');
  assert.equal(view.case.exchange.unitPrice, 100000);
  assert.equal(view.case.exchange.destination.name, 'QA recipient');

  assert.doesNotMatch(
    JSON.stringify(view),
    /fingerprint|actorId|privateProvider/,
  );
});

test('notification/audit failures roll back replacement inventory, case, ticket and event state for retry', async () => {
  const f = setup();
  const id = await f.ready();
  const originalNotificationCreate = f.db.notification.create;

  f.db.notification.create = async () => {
    throw Error('Notification unavailable');
  };
  await assert.rejects(f.reserve(id));
  assert.equal(f.snapshot().inventory.reserved, 1);
  assert.equal(f.cases.get(id).exchange, undefined);

  f.db.notification.create = originalNotificationCreate;
  await f.reserve(id);
  await f.change(id, 'EXCHANGE_ACCEPT', f.owner);

  const originalAuditCreate = f.db.auditLog.create;
  f.db.auditLog.create = async (args) => {
    if (args.data.action === 'EXCHANGE_STOCK_DISPATCHED') {
      throw Error('Audit unavailable');
    }
    return originalAuditCreate(args);
  };
  await assert.rejects(
    f.change(id, 'EXCHANGE_SHIP', f.admin, { carrier: 'QA carrier' }),
  );
  assert.equal(f.snapshot().inventory.onHand, 2);
  assert.equal(f.snapshot().inventory.reserved, 2);
  assert.equal(f.cases.get(id).exchange.state, 'ACCEPTED');

  f.db.auditLog.create = originalAuditCreate;
  await f.change(id, 'EXCHANGE_SHIP', f.admin, { carrier: 'QA carrier' });

  f.db.notification.create = async () => {
    throw Error('Notification unavailable');
  };
  await assert.rejects(f.change(id, 'EXCHANGE_RECEIVE', f.owner));
  assert.equal(f.cases.get(id).exchange.state, 'SHIPPED');
  assert.equal([...f.tickets.values()][0].state, 'OPEN');
});

test('dispatch versus release and two delivery acknowledgements have one winner without double stock movements', async () => {
  const f = setup();
  const id = await f.ready();
  await f.reserve(id);
  await f.change(id, 'EXCHANGE_ACCEPT', f.owner);

  const version = f.cases.get(id).version;
  const race = await Promise.allSettled([
    f.change(id, 'EXCHANGE_SHIP', f.admin, { version, carrier: 'QA carrier' }),
    f.change(id, 'EXCHANGE_RELEASE', f.admin, { version }),
  ]);
  assert.equal(race.filter((r) => r.status === 'fulfilled').length, 1);

  if (f.cases.get(id).exchange.state === 'RELEASED') {
    await f.reserve(id);
    await f.change(id, 'EXCHANGE_ACCEPT', f.owner);
    await f.change(id, 'EXCHANGE_SHIP', f.admin, { carrier: 'QA carrier' });
  }

  const current = f.cases.get(id).version;
  const received = await Promise.allSettled([
    f.change(id, 'EXCHANGE_RECEIVE', f.owner, { version: current }),
    f.change(id, 'EXCHANGE_DELIVER', f.admin, { version: current }),
  ]);
  assert.equal(received.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(f.snapshot().inventory.onHand, 1);
  assert.equal(f.snapshot().inventory.reserved, 1);
});

test('exchange API enforces assignee, audience, owner, stale version and immutable action replay', async () => {
  const f = setup();
  const id = await f.ready();
  const context = { params: Promise.resolve({ caseId: id }) };

  const admin = f.load('app/api/admin/returns/[caseId]/route.ts');
  const customer = f.load('app/api/returns/[caseId]/route.ts');
  const choices = f.load('app/api/admin/returns/[caseId]/exchange-options/route.ts');

  const request = (body) =>
    new Request('http://local', {
      method: 'POST',
      body: JSON.stringify(body),
    });

  const body = {
    action: 'EXCHANGE_RESERVE',
    version: f.cases.get(id).version,
    requestId: randomUUID(),
    variantId: f.target.id,
    text: 'Choose this replacement for customer approval.',
    confirmed: true,
  };

  f.state.user = f.owner;
  const forbiddenPost = await customer.POST(request(body), context);
  assert.equal(forbiddenPost.status, 403);

  const forbiddenChoices = await choices.GET(new Request('http://local'), context);
  assert.equal(forbiddenChoices.status, 403);

  f.state.user = f.admin2;
  const notAssigned = await admin.POST(request(body), context);
  assert.equal(notAssigned.status, 409);

  f.state.user = f.admin;
  const options = await choices.GET(new Request('http://local'), context);
  assert.equal(options.status, 200);
  const optionsData = await options.json();
  assert.equal(optionsData.items[0].variantId, f.target.id);

  const successPost = await admin.POST(request(body), context);
  assert.equal(successPost.status, 200);

  const invalidVariantPost = await admin.POST(
    request({ ...body, variantId: f.variantId }),
    context,
  );
  assert.equal(invalidVariantPost.status, 409);

  f.state.user = f.other;
  const otherAccept = await customer.POST(
    request({
      ...body,
      action: 'EXCHANGE_ACCEPT',
      version: f.cases.get(id).version,
    }),
    context,
  );
  assert.equal(otherAccept.status, 404);

  f.state.user = f.owner;
  const staleAccept = await customer.POST(
    request({
      ...body,
      action: 'EXCHANGE_ACCEPT',
      version: 1,
    }),
    context,
  );
  assert.equal(staleAccept.status, 409);
});
