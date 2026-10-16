const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { seedReturnOrder } = require('./return-qa-fixture.cjs');

async function verifyReturnsHttp({ call, prisma, cookies, users, product, checks }) {
  const owner = cookies[2], admin = cookies[0];
  const { order, variant } = await seedReturnOrder(prisma, users[2].id, product.id);
  const post = (cookie, body) => ({ cookie, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const root = '/api/returns';
  assert.equal((await call(root)).status, 401);
  assert.equal((await call('/api/admin/returns', { cookie: owner })).status, 403);
  assert.equal((await call(root + '/options?orderId=' + order.id, { cookie: cookies[1] })).status, 404);
  const options = await (await call(root + '/options?orderId=' + order.id, { cookie: owner })).json();
  assert.equal(options.items[0].available, 2);
  const input = { orderId: order.id, lineIndex: 0, quantity: 1, reason: 'DAMAGED', preference: 'REFUND', description: 'HTTP QA return: please review these delivered goods.', requestId: randomUUID(), item: { name: 'Forged return snapshot' } };
  const results = await Promise.all(Array.from({ length: 3 }, () => call(root, post(owner, input))));
  assert.ok(results.every(r => r.status === 200));
  const { id } = await results[0].json();
  assert.equal(await prisma.returnCase.count({ where: { orderId: order.id } }), 1);
  assert.equal((await call(root + '/' + id, { cookie: cookies[1] })).status, 404);
  const detail = await (await call(root + '/' + id, { cookie: owner })).json();
  assert.equal(detail.case.item.name, 'Purchased return QA phone');
  assert.doesNotMatch(JSON.stringify(detail), /Forged|fingerprint|actorId|uploadedBy/);
  assert.equal((await call(root + '/' + id, post(owner, { action: 'RECEIVE', version: 1, requestId: randomUUID(), text: 'Customer must not impersonate receipt by the support team.', reference: 'FORGED-RECEIPT', confirmed: true }))).status, 403);
  const filtered = await (await call('/api/admin/returns?orderId=' + order.id, { cookie: admin })).json();
  assert.equal(filtered.total, 1);
  checks.push('real return routes enforce customer/admin ownership, derive snapshots from order and replay one intake despite concurrent POSTs');

  const endpoint = '/api/admin/returns/' + id;
  async function action(kind, cookie = admin, extra = {}) {
    const current = await (await call(cookie === admin ? endpoint : root + '/' + id, { cookie })).json();
    return call(cookie === admin ? endpoint : root + '/' + id, post(cookie, { action: kind, version: current.case.version, requestId: randomUUID(), text: 'Recorded public instructions or verified QA goods inspection.', reference: 'HTTP-QA-RECEIPT-001', confirmed: true, ...extra }));
  }
  let conversation = await prisma.supportConversation.findUnique({ where: { id: users[2].id } });
  if (conversation.status === 'CLOSED') {
    assert.equal((await call('/api/support', post(owner, { action: 'REOPEN', version: conversation.version, requestId: randomUUID() }))).status, 200);
    conversation = await prisma.supportConversation.findUnique({ where: { id: users[2].id } });
  }
  if (conversation.assignedTo !== users[0].id) assert.equal((await call('/api/admin/support/' + users[2].id, post(admin, { action: 'CLAIM', version: conversation.version, requestId: randomUUID() }))).status, 200);
  for (const kind of ['ACCEPT', 'RECEIVE', 'INSPECT_RESTOCKABLE']) assert.equal((await action(kind)).status, 200);
  assert.equal((await prisma.productVariant.findUnique({ where: { id: variant.id } })).inventory.onHand, 4);
  const current = await (await call(endpoint, { cookie: admin })).json();
  const restock = { action: 'RESTOCK', version: current.case.version, requestId: randomUUID(), text: 'Verified count and condition before adding the inspected unit.', reference: null, confirmed: true };
  for (let i = 0; i < 2; i++) assert.equal((await call(endpoint, post(admin, restock))).status, 200);
  assert.equal((await prisma.productVariant.findUnique({ where: { id: variant.id } })).inventory.onHand, 5);
  assert.equal(await prisma.auditLog.count({ where: { entityId: variant.id, action: 'RETURN_RESTOCKED' } }), 1);
  assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).status, 'paid');
  assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).refundInfo, null);
  assert.equal((await call(root, post(owner, { ...input, requestId: randomUUID(), quantity: 2 }))).status, 409);
  for (const route of ['/returns', '/returns/new?orderId=' + order.id, '/returns/' + id, '/admin/returns', '/admin/returns/' + id]) assert.equal((await call(route, { cookie: route.startsWith('/admin') ? admin : owner })).status, 200);
  checks.push('real receive/inspection never restock early; recorded restock replays once, preserves payment, rejects over-allocation and all return pages render');
  return { caseId: id, orderId: order.id, variantId: variant.id, ownerId: users[2].id, ownerCookie: owner, adminCookie: admin };
}
module.exports = { verifyReturnsHttp };
