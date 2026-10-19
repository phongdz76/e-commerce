const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const sourceLoader = require('../tests/fixtures/load-source.cjs');
const { seedReturnOrder } = require('./return-qa-fixture.cjs');

async function verifyReturnExchangeMongo({ db, second, load, otherLoad, product, checks }) {
  const owner = await db.user.create({
    data: {
      name: 'Exchange QA customer',
      role: 'USER',
      status: 'ACTIVE',
      email: 'exchange-owner@example.invalid',
    },
  });

  const handler = await db.user.create({
    data: {
      name: 'Exchange QA handler',
      role: 'ADMIN',
      status: 'ACTIVE',
      email: 'exchange-handler@example.invalid',
    },
  });

  const { order, variant } = await seedReturnOrder(db, owner.id, product.id);

  const target = await db.productVariant.create({
    data: {
      productId: product.id,
      sku: 'QA-EXCHANGE-' + randomUUID(),
      name: 'Blue replacement',
      price: variant.price,
      currency: 'vnd',
      isActive: true,
      inStock: true,
      image: variant.image,
      inventory: {
        onHand: 1,
        reserved: 0,
        version: 1,
        updatedAt: new Date(),
      },
    },
  });

  const service = load('libs/returnCases.ts');
  const otherService = otherLoad('libs/returnCases.ts');

  const create = () =>
    service.createReturnCase(
      owner,
      load('utils/returnCases.ts').parseReturnCreate({
        orderId: order.id,
        lineIndex: 0,
        quantity: 1,
        reason: 'DAMAGED',
        preference: 'EXCHANGE',
        description: 'Please inspect the delivered item and review an equal-value replacement.',
        requestId: randomUUID(),
      }),
    );

  const first = await create();
  const next = await create();

  const conversation = await db.supportConversation.findUnique({
    where: { id: owner.id },
  });
  await load('libs/support.ts').changeSupportConversation(
    owner.id,
    handler,
    'CLAIM',
    conversation.version,
    randomUUID(),
  );

  const command = async (id, action, extra = {}) => {
    const currentCase = await db.returnCase.findUnique({ where: { id } });
    return {
      action,
      version: currentCase.version,
      requestId: randomUUID(),
      text: 'Verified QA exchange instructions, quantities and shipping evidence.',
      reference: 'QA-EXCHANGE-EVIDENCE',
      ...extra,
    };
  };

  for (const id of [first.id, next.id]) {
    for (const kind of ['ACCEPT', 'RECEIVE', 'INSPECT_OTHER']) {
      await service.changeReturnCase(id, handler, await command(id, kind));
    }
  }

  const contenders = await Promise.allSettled([
    service.changeReturnCase(
      first.id,
      handler,
      await command(first.id, 'EXCHANGE_RESERVE', { variantId: target.id }),
    ),
    otherService.changeReturnCase(
      next.id,
      handler,
      await command(next.id, 'EXCHANGE_RESERVE', { variantId: target.id }),
    ),
  ]);

  assert.equal(contenders.filter((r) => r.status === 'fulfilled').length, 1);
  assert.ok(
    contenders.some(
      (r) => r.status === 'rejected' && r.reason.code === 'EXCHANGE_UNAVAILABLE',
    ),
  );

  const id = contenders[0].status === 'fulfilled' ? first.id : next.id;
  const targetStockAfterContend = await db.productVariant.findUnique({
    where: { id: target.id },
  });
  assert.equal(targetStockAfterContend.inventory.reserved, 1);

  const originalStock = await db.productVariant.findUnique({
    where: { id: variant.id },
  });
  assert.equal(originalStock.inventory.onHand, 4);

  checks.push(
    'two return cases through separate clients compete for the same final replacement unit; only one holds it and unsuitable original goods never enter stock',
  );

  const decline = await command(id, 'EXCHANGE_DECLINE');
  const releases = await Promise.allSettled(
    Array.from({ length: 6 }, (_, i) =>
      (i % 2 ? service : otherService).changeReturnCase(id, owner, decline),
    ),
  );
  assert.ok(releases.every((r) => r.status === 'fulfilled'));

  const targetStockAfterDecline = await db.productVariant.findUnique({
    where: { id: target.id },
  });
  assert.equal(targetStockAfterDecline.inventory.reserved, 0);

  const reserve = await command(id, 'EXCHANGE_RESERVE', { variantId: target.id });
  const failed = db.$extends({
    query: {
      auditLog: {
        create: async ({ args, query }) => {
          if (args.data.action === 'EXCHANGE_STOCK_RESERVED') {
            throw Error('QA audit failure');
          }
          return query(args);
        },
      },
    },
  });

  const failedService = sourceLoader({
    '@/libs/prismadb': { __esModule: true, default: failed },
  })('libs/returnCases.ts');

  await assert.rejects(failedService.changeReturnCase(id, handler, reserve));

  const targetStockAfterFailedAudit = await db.productVariant.findUnique({
    where: { id: target.id },
  });
  assert.equal(targetStockAfterFailedAudit.inventory.reserved, 0);

  const returnCaseAfterFailedAudit = await db.returnCase.findUnique({
    where: { id },
  });
  assert.equal(returnCaseAfterFailedAudit.exchange.state, 'RELEASED');

  await service.changeReturnCase(id, handler, reserve);
  checks.push(
    'six customer-decline retries release one hold; an actual stock-audit failure rolls back the replacement reservation and permits the same request retry',
  );

  await service.changeReturnCase(id, owner, await command(id, 'EXCHANGE_ACCEPT'));
  await db.productVariant.update({
    where: { id: target.id },
    data: { price: 200000, name: 'Changed catalog option' },
  });

  const ship = await command(id, 'EXCHANGE_SHIP', {
    carrier: 'QA carrier',
    reference: 'QA-REPLACEMENT-TRACK',
  });
  const dispatches = await Promise.allSettled(
    Array.from({ length: 6 }, (_, i) =>
      (i % 2 ? service : otherService).changeReturnCase(id, handler, ship),
    ),
  );
  assert.ok(dispatches.every((r) => r.status === 'fulfilled'));

  const balance = (
    await db.productVariant.findUnique({ where: { id: target.id } })
  ).inventory;
  assert.equal(balance.onHand, 0);
  assert.equal(balance.reserved, 0);

  const dispatchedAuditCount = await db.auditLog.count({
    where: { entityId: target.id, action: 'EXCHANGE_STOCK_DISPATCHED' },
  });
  assert.equal(dispatchedAuditCount, 1);

  await assert.rejects(
    service.changeReturnCase(id, handler, await command(id, 'EXCHANGE_RELEASE')),
    (e) => e.code === 'RETURN_ACTION_LOCKED',
  );

  const before = await service.getReturnCase(id, owner);
  assert.equal(before.case.exchange.option, 'Blue replacement');
  assert.equal(before.case.exchange.unitPrice, 100000);
  assert.equal(before.case.exchange.state, 'SHIPPED');

  checks.push(
    'six dispatch retries consume the accepted reservation once, honor saved SKU/price despite catalog edits and never release shipped goods as a hold',
  );

  const issue = await command(id, 'EXCHANGE_REPORT_ISSUE', {
    text: 'The carrier could not complete replacement delivery; support follow-up is required.',
    reference: null,
  });
  const failedIssueDb = db.$extends({ query: { notification: { create: async () => { throw Error('QA incident notification failure'); } } } });
  const failedIssueService = sourceLoader({ '@/libs/prismadb': { __esModule: true, default: failedIssueDb } })('libs/returnCases.ts');
  await assert.rejects(failedIssueService.changeReturnCase(id, owner, issue));
  assert.equal((await db.returnCase.findUnique({ where: { id } })).exchange.state, 'SHIPPED');
  const reports = await Promise.allSettled(Array.from({ length: 6 }, (_, i) =>
    (i % 2 ? service : otherService).changeReturnCase(id, owner, issue)));
  assert.ok(reports.every(result => result.status === 'fulfilled'));
  const incident = await service.getReturnCase(id, owner);
  assert.equal(incident.case.exchange.state, 'DELIVERY_ISSUE');
  assert.equal(incident.case.exchange.deliveryIssue.description, issue.text);
  assert.equal(incident.case.exchange.trackingNumber, 'QA-REPLACEMENT-TRACK');
  assert.equal(await db.returnCaseEvent.count({ where: { caseId: id, action: 'EXCHANGE_REPORT_ISSUE' } }), 1);
  await assert.rejects(service.changeReturnCase(id, owner, await command(id, 'EXCHANGE_RESUME')), e => e.code === 'RETURN_ACTION_LOCKED');
  await service.changeReturnCase(id, handler, await command(id, 'EXCHANGE_RESUME'));
  const resolvedIncident = await service.getReturnCase(id, owner);
  assert.equal(resolvedIncident.case.exchange.state, 'SHIPPED');
  assert.equal(resolvedIncident.case.exchange.deliveryIssue, null);
  assert.ok(resolvedIncident.events.some(event => event.exchange?.deliveryIssue?.description === issue.text));
  assert.deepEqual((await db.productVariant.findUnique({ where: { id: target.id } })).inventory, balance);
  checks.push('replacement delivery incidents roll back with notification failure, six retries save one incident, and assigned resolution preserves shipment evidence, inventory and history');

  const receive = await command(id, 'EXCHANGE_RECEIVE');
  const receipts = await Promise.allSettled(
    Array.from({ length: 6 }, (_, i) =>
      (i % 2 ? service : otherService).changeReturnCase(id, owner, receive),
    ),
  );
  assert.ok(receipts.every((r) => r.status === 'fulfilled'));

  const saved = await db.returnCase.findUnique({ where: { id } });
  assert.equal(saved.state, 'EXCHANGED');
  assert.equal(saved.exchange.state, 'DELIVERED');

  const ticketAfterExchanged = await db.supportTicket.findUnique({
    where: { id: saved.ticketId },
  });
  assert.equal(ticketAfterExchanged.state, 'RESOLVED');

  const convAfterExchanged = await db.supportConversation.findUnique({
    where: { id: owner.id },
  });
  assert.equal(convAfterExchanged.status, 'OPEN');

  const orderAfterExchanged = await db.order.findUnique({
    where: { id: order.id },
  });
  assert.equal(orderAfterExchanged.status, 'paid');
  assert.equal(orderAfterExchanged.refundInfo, null);

  assert.doesNotMatch(
    JSON.stringify(await service.getReturnCase(id, owner)),
    /fingerprint|actorId/,
  );

  const eventCount = await second.returnCaseEvent.count({
    where: { caseId: id, action: 'EXCHANGE_RESERVE' },
  });
  assert.ok(eventCount >= 2);

  checks.push(
    'customer receipt completes the case and resolves only its linked ticket; exchange history snapshots persist and original payment/shared chat stay intact',
  );

  const pendingId = id === first.id ? next.id : first.id;
  const shared = await db.productVariant.create({
    data: {
      productId: product.id,
      sku: 'QA-SHARED-' + randomUUID(),
      name: 'Shared final unit',
      price: variant.price,
      currency: 'vnd',
      isActive: true,
      inStock: true,
      image: variant.image,
      inventory: {
        onHand: 1,
        reserved: 0,
        version: 1,
        updatedAt: new Date(),
      },
    },
  });

  const stockService = otherLoad('libs/orderStock.ts');
  const cart = [
    {
      ...order.products[0],
      variantId: shared.id,
      sku: shared.sku,
      quantity: 1,
    },
  ];
  const exchangeCommand = await command(pendingId, 'EXCHANGE_RESERVE', {
    variantId: shared.id,
  });

  const sharedRace = await Promise.allSettled([
    service.changeReturnCase(pendingId, handler, exchangeCommand),
    stockService.withStockTransaction(async (tx) => {
      const purchase = await tx.order.create({
        data: {
          userId: owner.id,
          products: cart,
          status: 'pending',
          deliveryStatus: 'pending',
          amount: shared.price,
          currency: 'vnd',
          paymentMethod: 'COD',
          paymentIntentId: 'COD_QA_SHARED_' + randomUUID(),
        },
      });
      const hold = await stockService.reserveOrderStock(
        tx,
        purchase.id,
        owner.id,
        cart,
        'COD',
      );
      await tx.order.update({
        where: { id: purchase.id },
        data: { stockReservation: { set: hold } },
      });
      return purchase.id;
    }, 500),
  ]);

  assert.equal(sharedRace.filter((r) => r.status === 'fulfilled').length, 1);
  assert.ok(
    sharedRace.some(
      (r) =>
        r.status === 'rejected' &&
        ['EXCHANGE_UNAVAILABLE', 'STOCK_UNAVAILABLE'].includes(r.reason.code),
    ),
  );

  const sharedBalance = (
    await db.productVariant.findUnique({ where: { id: shared.id } })
  ).inventory;
  assert.equal(sharedBalance.onHand, 1);
  assert.equal(sharedBalance.reserved, 1);

  checks.push(
    'a real checkout stock reservation and an exchange contend for one shared final unit; exactly one commits and available inventory never becomes negative',
  );
}

module.exports = { verifyReturnExchangeMongo };
