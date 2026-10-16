const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { fixture } = require('./fixtures/returns.cjs');
const post = body => new Request('http://local/api/returns', { method: 'POST', body: JSON.stringify(body) });
const ctx = id => ({ params: Promise.resolve({ caseId: id }) });

test('return create and action parsers reject forged quantities, inherited states, invalid notes and missing confirmation/receipts', () => {
  const f = fixture(), { parseReturnCreate, parseReturnAction } = f.load('utils/returnCases.ts'), base = f.input();
  assert.ok(parseReturnCreate(base));
  for (const patch of [{ quantity: 0 }, { quantity: 1.5 }, { quantity: 1000 }, { lineIndex: -1 }, { orderId: 'bad' }, { reason: 'constructor' }, { preference: 'toString' }, { description: 'short' }, { description: 'bad\0control character' }, { attachmentId: 'bad' }]) assert.equal(parseReturnCreate({ ...base, ...patch }), null);
  const action = { action: 'RECEIVE', version: 1, requestId: randomUUID(), confirmed: true, text: 'Counted and received the returned item.', reference: 'QA-RECEIPT' };
  assert.ok(parseReturnAction(action));
  for (const patch of [{ confirmed: false }, { reference: null }, { reference: 'x' }, { version: 0 }, { action: 'constructor' }, { text: 'x' }]) assert.equal(parseReturnAction({ ...action, ...patch }), null);
});

test('six retries create one return, shared ticket/message, image binding and audience-specific notification without changing money or stock', async () => {
  const f = fixture(), image = '2'.repeat(24);
  f.attachments.set(image, { id: image, conversationId: f.owner.id, uploadedBy: f.owner.id, messageId: null });
  const input = f.input({ attachmentId: image }), results = await Promise.all(Array.from({ length: 6 }, () => f.service.createReturnCase(f.owner, input)));
  assert.equal(new Set(results.map(r => r.id)).size, 1); assert.equal(f.cases.size, 1); assert.equal(f.tickets.size, 1); assert.equal(f.messages.size, 1); assert.equal(f.events.size, 1);
  assert.ok(f.attachments.get(image).messageId); assert.equal(f.notifications.events.size, 1); assert.equal(f.notifications.notifications.size, 3);
  assert.ok([...f.notifications.notifications.values()].every(n => n.href.includes('/returns/')));
  assert.equal(f.order.status, 'paid'); assert.equal(f.stock.variants.get(f.variantId).inventory.onHand, 4);
  const view = await f.service.getReturnCase(results[0].id, f.owner);
  assert.equal(view.imageUrl, '/api/support/attachments/' + image);
  assert.doesNotMatch(JSON.stringify(view), /fingerprint|actorId|uploadedBy/);
  assert.equal([...f.tickets.values()][0].returnCaseId, results[0].id);
});

test('different request identities compete for purchased quantity; withdrawals release allocation but restocked goods remain counted', async () => {
  const f = fixture();
  const results = await Promise.allSettled([f.create({ quantity: 2 }), f.create({ quantity: 2 })]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.ok(results.some(r => r.status === 'rejected' && r.reason.code === 'RETURN_QUANTITY'));
  const id = results.find(r => r.status === 'fulfilled').value.id;
  await f.change(id, 'WITHDRAW', f.owner);
  const next = await f.create({ quantity: 2 }); await f.inspect(next.id); await f.change(next.id, 'RESTOCK');
  assert.equal((await f.service.returnOrderOptions(f.owner.id, f.order.id)).items[0].available, 0);
  await assert.rejects(f.create(), e => e.code === 'RETURN_QUANTITY');
});

test('only the owner may create/view a case and only recorded delivered/consumed items are eligible', async () => {
  const f = fixture(); await assert.rejects(f.create({}, f.other), e => e.status === 404);
  for (const [field, value] of [['deliveryStatus', 'shipped'], ['stockReservation', { state: 'HELD' }], ['management', { state: 'CANCELLED' }]]) {
    const check = fixture(); check.order[field] = value;
    await assert.rejects(check.create(), e => e.code === 'RETURN_NOT_ELIGIBLE');
  }
  const { id } = await f.create();
  await assert.rejects(f.service.getReturnCase(id, f.other), e => e.status === 404);
  await assert.rejects(f.service.returnOrderOptions(f.other.id, f.order.id), e => e.status === 404);
  assert.equal((await f.service.listReturnCases(f.other, 'ALL', 1)).total, 0);
});

test('return item and policy snapshots come from the order and survive later catalog/policy changes', async () => {
  const f = fixture(), content = f.load('utils/customerServiceStarter.ts').starterServiceContent();
  f.order.servicePolicies = { id: '3'.repeat(24), revision: 2, publishedAt: new Date().toISOString(), pages: content.pages };
  const input = f.input(); input.item = { name: 'Forged product' }; input.policy = { revision: 999 };
  const { id } = await f.service.createReturnCase(f.owner, input);
  f.order.products[0].name = 'Later product name'; f.order.servicePolicies.pages.returns.title = 'Later policy';
  const view = await f.service.getReturnCase(id, f.owner);
  assert.equal(view.case.item.name, 'Purchased phone'); assert.equal(view.case.policy.revision, 2);
  assert.notEqual(view.case.policy.pages.returns.title, 'Later policy');
});

test('foreign attachments and failed notification writes roll back the return, ticket, sequence and allocation together', async () => {
  const f = fixture(), image = '2'.repeat(24);
  f.attachments.set(image, { id: image, conversationId: f.other.id, uploadedBy: f.other.id, messageId: null });
  await assert.rejects(f.create({ attachmentId: image }), e => e.status === 409 || e.status === 404);
  const original = f.db.notification.create; f.db.notification.create = async () => { throw Error('Notification outage'); };
  await assert.rejects(f.create());
  assert.equal(f.cases.size, 0); assert.equal(f.tickets.size, 0); assert.equal(f.messages.size, 0); assert.equal(f.conversations.size, 0); assert.equal(f.orders.get(f.order.id).returnsVersion, undefined);
  f.db.notification.create = original; await f.create({ quantity: 2 }); assert.equal(f.cases.size, 1);
});

test('only the assigned admin can decide, receive and inspect; receiving or rejecting stock inspection never increases sellable stock', async () => {
  const f = fixture(), { id } = await f.create();
  await assert.rejects(f.change(id, 'ACCEPT'), e => e.code === 'RETURN_NOT_ASSIGNED');
  await f.claim(); await assert.rejects(f.change(id, 'ACCEPT', f.admin2), e => e.code === 'RETURN_NOT_ASSIGNED');
  await assert.rejects(f.change(id, 'RESTOCK'), e => e.code === 'RETURN_ACTION_LOCKED');
  await f.change(id, 'ACCEPT'); await f.change(id, 'DISPATCH', f.owner); await f.change(id, 'RECEIVE');
  assert.equal(f.stock.variants.get(f.variantId).inventory.onHand, 4);
  await f.change(id, 'INSPECT_OTHER'); await assert.rejects(f.change(id, 'RESTOCK'), e => e.code === 'RETURN_ACTION_LOCKED');
  assert.equal(f.stock.variants.get(f.variantId).inventory.onHand, 4);
  await f.change(id, 'RETURN_TO_CUSTOMER'); assert.equal(f.cases.get(id).state, 'RETURNED_TO_CUSTOMER');
});

test('restock replays exactly once, preserves reserved stock/payment and emits one stock audit', async () => {
  const f = fixture(), { id } = await f.create(); await f.inspect(id);
  const input = { action: 'RESTOCK', version: f.cases.get(id).version, requestId: randomUUID(), text: 'Count and condition verified as suitable for sellable stock.', reference: null };
  await Promise.all(Array.from({ length: 6 }, () => f.service.changeReturnCase(id, f.admin, input)));
  const balance = f.stock.variants.get(f.variantId).inventory;
  assert.equal(balance.onHand, 5); assert.equal(balance.reserved, 1); assert.equal(balance.version, 2);
  assert.equal([...f.stock.audits.values()].filter(a => a.action === 'RETURN_RESTOCKED').length, 1);
  assert.equal(f.cases.get(id).state, 'RESTOCKED'); assert.equal(f.order.status, 'paid'); assert.equal(f.order.refundInfo, undefined);
  await assert.rejects(f.service.changeReturnCase(id, f.admin, { ...input, text: 'Changed replay of the same recorded request.' }), e => e.status === 409);
});

test('failed restock audit rolls back inventory, case state, events and notifications for a safe retry', async () => {
  const f = fixture(), { id } = await f.create(); await f.inspect(id);
  const before = f.events.size, original = f.db.auditLog.create;
  f.db.auditLog.create = async args => { if (args.data.action === 'RETURN_RESTOCKED') throw Error('Audit unavailable'); return original(args); };
  await assert.rejects(f.change(id, 'RESTOCK'));
  assert.equal(f.stock.variants.get(f.variantId).inventory.onHand, 4); assert.equal(f.cases.get(id).state, 'INSPECTED_RESTOCKABLE'); assert.equal(f.events.size, before);
  f.db.auditLog.create = original; await f.change(id, 'RESTOCK'); assert.equal(f.stock.variants.get(f.variantId).inventory.onHand, 5);
});

test('stale versions and unavailable stock records cannot complete inspection/restock', async () => {
  const f = fixture(), { id } = await f.create(); await f.inspect(id);
  await assert.rejects(f.change(id, 'RESTOCK', f.admin, { version: 1 }), e => e.status === 409);
  f.stock.variants.get(f.variantId).sku = 'CHANGED-SKU';
  await assert.rejects(f.change(id, 'RESTOCK'), e => e.code === 'RETURN_STOCK_REVIEW');
});

test('return routes enforce audience, auth, filters, body shape, quotas and never expose internal errors', async () => {
  const f = fixture(), publicRoute = f.load('app/api/returns/route.ts'), adminRoute = f.load('app/api/admin/returns/route.ts'), detail = f.load('app/api/returns/[caseId]/route.ts');
  f.state.user = null; assert.equal((await publicRoute.GET(new Request('http://local'))).status, 401);
  f.state.user = f.owner; assert.equal((await adminRoute.GET(new Request('http://local'))).status, 403);
  for (const query of ['state=constructor', 'page=-1', 'page=1.5', 'orderId=bad']) assert.equal((await publicRoute.GET(new Request('http://local?' + query))).status, 400);
  assert.equal((await publicRoute.POST(post({}))).status, 400);
  const input = f.input(); const result = await publicRoute.POST(post(input)); assert.equal(result.status, 200); assert.equal(result.headers.get('cache-control'), 'private, no-store');
  const { id } = await result.json();
  assert.equal((await detail.POST(post({ action: 'ACCEPT', version: 1, requestId: randomUUID(), text: 'Try to impersonate an administrator.', confirmed: true }), ctx(id))).status, 403);
  f.state.user = f.other; assert.equal((await detail.GET(new Request('http://local'), ctx(id))).status, 404);
  f.state.user = f.owner; f.state.limited = true;
  assert.equal((await publicRoute.POST(post(input))).status, 200, 'confirmed replay survives quota exhaustion');
  const limited = await publicRoute.POST(post(f.input())); assert.equal(limited.status, 429); assert.equal(limited.headers.get('retry-after'), '30');
  f.state.limited = false; f.db.returnCase.findMany = async () => { throw Error('private database credentials'); };
  const unavailable = await publicRoute.GET(new Request('http://local')); assert.equal(unavailable.status, 503); assert.doesNotMatch(await unavailable.text(), /credentials/);
});

test('customer endpoints force owner audience even when an admin shops; options are account-owned and lists/history paginate', async () => {
  const f = fixture(), options = f.load('app/api/returns/options/route.ts');
  const response = await options.GET(new Request('http://local?orderId=' + f.order.id)); assert.equal(response.status, 200); assert.equal((await response.json()).items[0].available, 2);
  f.state.user = f.other; assert.equal((await options.GET(new Request('http://local?orderId=' + f.order.id))).status, 404);
  f.state.user = f.admin; assert.equal((await options.GET(new Request('http://local?orderId=' + f.order.id))).status, 404);
  const { id } = await f.create(); for (let i = 0; i < 22; i++) f.events.set('history-' + i, { id: 'history-' + i, caseId: id, action: 'CREATE', state: 'REQUESTED', text: 'Historical public note', createdAt: new Date(i) });
  assert.equal((await f.service.getReturnCase(id, f.owner)).events.length, 20); assert.equal((await f.service.getReturnCase(id, f.owner)).hasOlder, true); assert.equal((await f.service.getReturnCase(id, f.owner, 2)).events.length, 3);
});

test('return conflict backoff remains bounded and never retries an uncertain transaction outcome', async t => {
  const f = fixture(), waits = []; let calls = 0;
  t.mock.method(global, 'setTimeout', (callback, delay) => { waits.push(delay); callback(); return 0; });
  f.db.$transaction = async operation => { if (++calls < 4) throw Object.assign(Error('Confirmed write conflict'), { code: 'P2034' }); return operation(f.db); };
  await f.create(); assert.equal(calls, 4);
  waits.forEach((delay, i) => assert.ok(delay >= 500 * 2 ** i && delay < 500 * 2 ** i + 50));
  calls = 0; f.db.$transaction = async () => { calls++; throw Object.assign(Error('Unknown commit result'), { code: 'P2028' }); };
  await assert.rejects(f.create(), e => e.code === 'P2028'); assert.equal(calls, 1);
});
