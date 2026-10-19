const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { seedReturnOrder } = require('./return-qa-fixture.cjs');

async function verifyReturnExchangeHttp({ call, prisma, cookies, users, product, checks }) {
  const owner = cookies[2];
  const admin = cookies[0];
  const { order, variant } = await seedReturnOrder(prisma, users[2].id, product.id);

  const json = (cookie, body) => ({
    cookie,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const response = await call(
    '/api/returns',
    json(owner, {
      orderId: order.id,
      lineIndex: 0,
      quantity: 1,
      reason: 'DAMAGED',
      preference: 'EXCHANGE',
      description: 'HTTP exchange QA item needs an equal-value replacement after inspection.',
      requestId: randomUUID(),
    }),
  );
  assert.equal(response.status, 200);

  const { id } = await response.json();
  const endpoint = '/api/admin/returns/' + id;
  const customerEndpoint = '/api/returns/' + id;

  const input = async (action, extra = {}) => {
    const currentCase = await prisma.returnCase.findUnique({ where: { id } });
    return {
      action,
      version: currentCase.version,
      requestId: randomUUID(),
      confirmed: true,
      text: 'Verified equal-value replacement and recorded QA shipping evidence.',
      reference: 'QA-EXCHANGE-RECEIPT',
      ...extra,
    };
  };

  const act = async (action, cookie = admin, extra = {}) => {
    const payload = await input(action, extra);
    const targetUrl = cookie === admin ? endpoint : customerEndpoint;
    return call(targetUrl, json(cookie, payload));
  };

  for (const action of ['ACCEPT', 'RECEIVE', 'INSPECT_OTHER']) {
    const res = await act(action);
    assert.equal(res.status, 200);
  }

  const choices = endpoint + '/exchange-options';
  assert.equal((await call(choices)).status, 401);
  assert.equal((await call(choices, { cookie: owner })).status, 403);

  const adminOptionsRes = await call(choices, { cookie: admin });
  const adminOptions = await adminOptionsRes.json();
  assert.ok(adminOptions.items.some((item) => item.variantId === variant.id));

  const forbiddenReserve = await act('EXCHANGE_RESERVE', owner, { variantId: variant.id });
  assert.equal(forbiddenReserve.status, 403);

  const reserve = await input('EXCHANGE_RESERVE', { variantId: variant.id });
  for (let i = 0; i < 2; i++) {
    const res = await call(endpoint, json(admin, reserve));
    assert.equal(res.status, 200);
  }

  let stock = await prisma.productVariant.findUnique({ where: { id: variant.id } });
  assert.equal(stock.inventory.onHand, 4);
  assert.equal(stock.inventory.reserved, 2);

  const invalidShip = await act('EXCHANGE_SHIP', admin, { carrier: 'QA carrier' });
  assert.equal(invalidShip.status, 409);

  const forgedPayload = await input('EXCHANGE_ACCEPT');
  const forged = await call(customerEndpoint, json(cookies[1], forgedPayload));
  assert.equal(forged.status, 404);

  const acceptRes = await act('EXCHANGE_ACCEPT', owner);
  assert.equal(acceptRes.status, 200);

  const ship = await input('EXCHANGE_SHIP', {
    carrier: 'HTTP QA carrier',
    reference: 'HTTP-EXCHANGE-TRACK',
  });
  for (let i = 0; i < 2; i++) {
    const res = await call(endpoint, json(admin, ship));
    assert.equal(res.status, 200);
  }

  stock = await prisma.productVariant.findUnique({ where: { id: variant.id } });
  assert.equal(stock.inventory.onHand, 3);
  assert.equal(stock.inventory.reserved, 1);

  const releaseRes = await act('EXCHANGE_RELEASE');
  assert.equal(releaseRes.status, 409);

  const updatedCase = await prisma.returnCase.findUnique({ where: { id } });
  assert.equal(updatedCase.exchange.state, 'SHIPPED');

  const issue = await input('EXCHANGE_REPORT_ISSUE', { text: 'Carrier could not deliver the replacement; please arrange another attempt.' });
  for (let i = 0; i < 2; i++) assert.equal((await call(customerEndpoint, json(owner, issue))).status, 200);
  const issueDetail = await (await call(customerEndpoint, { cookie: owner })).json();
  assert.equal(issueDetail.case.exchange.state, 'DELIVERY_ISSUE');
  assert.equal(issueDetail.case.exchange.deliveryIssue.description, issue.text);
  assert.equal((await act('EXCHANGE_RESUME', owner)).status, 403);
  assert.equal((await act('EXCHANGE_RESUME')).status, 200);
  const resumed = await prisma.returnCase.findUnique({ where: { id } });
  assert.equal(resumed.exchange.state, 'SHIPPED');
  assert.equal(resumed.exchange.deliveryIssue, null);
  checks.push('replacement delivery issue is saved once, preserves tracking and stock, and requires an administrator to resume delivery');

  const receipt = await input('EXCHANGE_RECEIVE');
  for (let i = 0; i < 2; i++) {
    const res = await call(customerEndpoint, json(owner, receipt));
    assert.equal(res.status, 200);
  }

  const savedDetailRes = await call(customerEndpoint, { cookie: owner });
  const saved = await savedDetailRes.json();
  assert.equal(saved.case.state, 'EXCHANGED');
  assert.equal(saved.case.exchange.trackingNumber, 'HTTP-EXCHANGE-TRACK');

  const linkedTicket = await prisma.supportTicket.findUnique({
    where: { id: saved.case.ticketId },
  });
  assert.equal(linkedTicket.state, 'RESOLVED');

  const finalOrder = await prisma.order.findUnique({ where: { id: order.id } });
  assert.equal(finalOrder.status, 'paid');
  assert.equal(finalOrder.refundInfo, null);

  assert.doesNotMatch(JSON.stringify(saved), /fingerprint|actorId/);
  assert.ok(saved.events.some((event) => event.exchange?.state === 'OFFERED'));

  const auditCount = await prisma.auditLog.count({
    where: {
      entityId: variant.id,
      action: 'EXCHANGE_STOCK_DISPATCHED',
    },
  });
  assert.equal(auditCount, 1);

  checks.push(
    'real exchange API reserves and dispatches one audited quantity, requires owner acceptance, records delivery once and resolves its ticket without changing the original payment',
  );
}

module.exports = { verifyReturnExchangeHttp };
