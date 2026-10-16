const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const sourceLoader = require('../tests/fixtures/load-source.cjs');
const { seedReturnOrder } = require('./return-qa-fixture.cjs');
require('@next/env').loadEnvConfig(path.resolve(__dirname, '..'));
let stage = 'initializing QA database';

async function main() {
  const database = 'sgtech_return_qa_' + Date.now() + '_' + randomUUID().slice(0, 6);
  const connection = new URL(process.env.DATABASE_URL), application = connection.pathname;
  connection.pathname = '/' + database;
  assert.notEqual(connection.pathname, application);
  assert.match(database, /^sgtech_return_qa_\d+_[a-f0-9]+$/);
  const db = new PrismaClient({ datasources: { db: { url: connection.toString() } } });
  const second = new PrismaClient({ datasources: { db: { url: connection.toString() } } });
  const loader = client => sourceLoader({ '@/libs/prismadb': { __esModule: true, default: client } });
  const load = loader(db), otherLoad = loader(second), service = load('libs/returnCases.ts'), otherService = otherLoad('libs/returnCases.ts'), chat = load('libs/support.ts');
  const checks = [];
  try {
    const [owner, other, admin, admin2] = await Promise.all(['USER', 'USER', 'ADMIN', 'ADMIN'].map((role, i) => db.user.create({ data: { role, status: 'ACTIVE', name: 'Return QA ' + i, email: `return-${i}@example.invalid` } })));
    const category = await db.category.create({ data: { name: 'QA phones', slug: 'return-qa' } }), brand = await db.brand.create({ data: { name: 'QA brand', slug: 'return-qa' } });
    const product = await db.product.create({ data: { name: 'Return QA phone', slug: 'return-qa', description: 'Disposable return fixture', status: 'ACTIVE', categoryId: category.id, brandId: brand.id } });
    const { order, variant } = await seedReturnOrder(db, owner.id, product.id);
    const input = extra => load('utils/returnCases.ts').parseReturnCreate({ orderId: order.id, lineIndex: 0, quantity: 1, reason: 'DAMAGED', preference: 'REFUND', description: 'Please review these isolated returned goods.', requestId: randomUUID(), ...extra });
    assert.equal((await service.listReturnCases(owner, 'ALL', 1)).total, 0);
    const image = await chat.uploadSupportImage(owner.id, owner, require('../tests/fixtures/support-image.cjs'), randomUUID());
    const first = input({ attachmentId: image.id });
    stage = 'six concurrent return creates across two clients';
    const outcomes = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => (i % 2 ? service : otherService).createReturnCase(owner, first)));
    const failure = outcomes.find(r => r.status === 'rejected');
    if (failure) throw failure.reason;
    const replays = outcomes.map(r => r.value);
    const id = replays[0].id;
    assert.equal(new Set(replays.map(r => r.id)).size, 1);
    assert.equal(await db.returnCase.count(), 1); assert.equal(await db.supportTicket.count(), 1); assert.equal(await db.supportMessage.count(), 1); assert.equal(await db.returnCaseEvent.count(), 1);
    assert.equal(await db.notificationEvent.count({ where: { entityId: id } }), 1);
    assert.ok((await db.supportAttachment.findUnique({ where: { id: image.id } })).messageId);
    checks.push('first-use collections across two clients: six replays create one return/ticket/message/image binding and notification event');

    stage = 'distinct quantity contenders';
    const races = await Promise.allSettled([service.createReturnCase(owner, input({ quantity: 1 })), otherService.createReturnCase(owner, input({ quantity: 1 }))]);
    assert.equal(races.filter(r => r.status === 'fulfilled').length, 1);
    assert.ok(races.some(r => r.status === 'rejected' && r.reason.code === 'RETURN_QUANTITY'));
    assert.equal(await db.returnCase.count(), 2);
    assert.equal((await service.returnOrderOptions(owner.id, order.id)).items[0].available, 0);
    await assert.rejects(service.getReturnCase(id, other), e => e.status === 404);
    await assert.rejects(service.returnOrderOptions(other.id, order.id), e => e.status === 404);
    await assert.rejects(service.createReturnCase(other, input()), e => e.status === 404);
    checks.push('distinct concurrent requests cannot exceed the purchased quantity; ownership is checked for intake, options and detail');

    stage = 'assignment and inspection';
    const conversation = await db.supportConversation.findUnique({ where: { id: owner.id } });
    await chat.changeSupportConversation(owner.id, admin, 'CLAIM', conversation.version, randomUUID());
    const action = async (kind, actor = admin, extra = {}) => service.changeReturnCase(id, actor, { action: kind, version: (await db.returnCase.findUnique({ where: { id } })).version, requestId: randomUUID(), text: 'Verified goods count and condition in the isolated QA fixture.', reference: 'QA-RECEIPT-001', ...extra });
    await assert.rejects(action('ACCEPT', admin2), e => e.code === 'RETURN_NOT_ASSIGNED');
    await action('ACCEPT'); await action('DISPATCH', owner); await action('RECEIVE');
    assert.equal((await db.productVariant.findUnique({ where: { id: variant.id } })).inventory.onHand, 4);
    await action('INSPECT_RESTOCKABLE');
    const restock = { action: 'RESTOCK', version: (await db.returnCase.findUnique({ where: { id } })).version, requestId: randomUUID(), text: 'Inspection confirms this unit is suitable for sellable stock.', reference: null };
    stage = 'six concurrent restock retries across two clients';
    const restocks = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => (i % 2 ? service : otherService).changeReturnCase(id, admin, restock)));
    const failedRestock = restocks.find(r => r.status === 'rejected');
    if (failedRestock) throw failedRestock.reason;
    const balance = (await db.productVariant.findUnique({ where: { id: variant.id } })).inventory;
    assert.equal(balance.onHand, 5); assert.equal(balance.reserved, 1);
    assert.equal(await db.auditLog.count({ where: { entityId: variant.id, action: 'RETURN_RESTOCKED' } }), 1);
    assert.equal((await db.order.findUnique({ where: { id: order.id } })).status, 'paid');
    assert.equal((await db.order.findUnique({ where: { id: order.id } })).refundInfo, null);
    await assert.rejects(otherService.changeReturnCase(id, admin, { ...restock, text: 'Changed replay must not add another unit to sellable stock.' }), e => e.status === 409);
    checks.push('assigned handler and inspection gates; receipt changes no stock, six restock retries add one unit once without changing reserved stock or payment');

    stage = 'rollback and retry';
    const rejectId = races.find(r => r.status === 'fulfilled').value.id;
    const failDb = db.$extends({ query: { notification: { create: async () => { throw Error('QA notification failure'); } } } });
    const failedService = loader(failDb)('libs/returnCases.ts');
    const decision = { action: 'REJECT', version: 1, requestId: randomUUID(), text: 'This isolated request is declined after review.', reference: null };
    await assert.rejects(failedService.changeReturnCase(rejectId, admin, decision));
    assert.equal((await db.returnCase.findUnique({ where: { id: rejectId } })).state, 'REQUESTED');
    await service.changeReturnCase(rejectId, admin, decision);
    assert.equal((await service.returnOrderOptions(owner.id, order.id)).items[0].available, 1);
    const before = await db.supportMessage.count(), retryInput = input();
    await assert.rejects(failedService.createReturnCase(owner, retryInput));
    assert.equal(await db.supportMessage.count(), before); assert.equal(await db.returnCase.count(), 2);
    await service.createReturnCase(owner, retryInput);
    checks.push('notification failure rolls back decisions/intake, ticket/message/allocation and permits a retry; declined quantities become available again');

    const result = await service.getReturnCase(id, owner);
    assert.doesNotMatch(JSON.stringify(result), /fingerprint|actorId|uploadedBy|@example/);
    assert.match(result.imageUrl, /\/api\/support\/attachments\//);
    checks.push('customer history and image reference retain snapshots while omitting internal identity/fingerprints');
    stage = 'exchange stock, consent, dispatch and delivery';
    await require('./check-return-exchange-mongo.cjs').verifyReturnExchangeMongo({
      db,
      second,
      load,
      otherLoad,
      product,
      checks,
    });
    fs.mkdirSync(path.resolve(__dirname, '../.artifacts'), { recursive: true });
    fs.writeFileSync(path.resolve(__dirname, '../.artifacts/returns-mongo-results.json'), JSON.stringify({ checks, applicationDatabaseWrites: 0, externalEmails: 0, providerNetworkCalls: 0 }, null, 2));
    console.log('Returns MongoDB passed: ' + checks.length + ' groups.');
  } finally {
    assert.equal(connection.pathname, '/' + database); assert.notEqual(connection.pathname, application); assert.match(database, /^sgtech_return_qa_\d+_[a-f0-9]+$/);
    await db.$runCommandRaw({ dropDatabase: 1 });
    await Promise.all([db.$disconnect(), second.$disconnect()]);
  }
}
main().catch(error => { console.error('Returns MongoDB verification failed at ' + stage + '.', error instanceof assert.AssertionError ? error.stack : { name: error.name, code: error.code, ...(error.name === 'PrismaClientValidationError' ? { validation: error.message.replace(/mongodb(?:\+srv)?:\/\/\S+/g, '[private connection]') } : {}) }); process.exitCode = 1; });
