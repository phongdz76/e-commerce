const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');
const sourceLoader = require('../tests/fixtures/load-source.cjs');
const { startSmtpFixture } = require('../tests/fixtures/smtp-server.cjs');
require('@next/env').loadEnvConfig(path.resolve(__dirname, '..'));

async function main() {
  const database = 'sgtech_email_qa_' + Date.now() + '_' + randomUUID().slice(0, 6);
  const connection = new URL(process.env.DATABASE_URL), application = connection.pathname;
  connection.pathname = '/' + database;
  assert.notEqual(connection.pathname, application); assert.match(database, /^sgtech_email_qa_\d+_[a-f0-9]+$/);
  const db = new PrismaClient({ datasources: { db: { url: connection.toString() } } });
  const second = new PrismaClient({ datasources: { db: { url: connection.toString() } } });
  const smtp = await startSmtpFixture(), checks = [];
  const localTransport = nodemailer.createTransport(smtp.options);
  const transport = {
    eventEmailSettings: () => ({ enabled: true, configured: true }),
    sendNotificationEmail: delivery => localTransport.sendMail({ from: 'qa-sender@example.invalid', to: delivery.toEmail, subject: delivery.subject, messageId: '<' + delivery.id + '@example.invalid>', text: delivery.subject + '\n' + delivery.href }),
  };
  const loader = client => sourceLoader({ '@/libs/prismadb': { __esModule: true, default: client }, '@/libs/eventEmailTransport': transport });
  const load = loader(db), otherLoad = loader(second), events = load('libs/orderNotifications.ts');
  const service = load('libs/emailDeliveries.ts'), otherService = otherLoad('libs/emailDeliveries.ts');
  const transaction = load('libs/supportTransaction.ts').withSupportTransaction;
  try {
    const [owner, admin] = await Promise.all(['USER', 'ADMIN'].map((role, i) => db.user.create({ data: { name: 'Email QA ' + i, email: 'email-qa-' + i + '@example.invalid', emailVerified: new Date(), role, status: 'ACTIVE' } })));
    // AuditLog must already exist before a transaction on MongoDB.
    await db.$runCommandRaw({ create: 'AuditLog' });
    const order = await db.order.create({ data: { userId: owner.id, amount: 115000, currency: 'vnd', status: 'pending', paymentMethod: 'MOMO', paymentIntentId: 'MOMO_QA_' + randomUUID(), products: [] } });
    await Promise.all([load('libs/notificationStorage.ts').ensureNotificationStorage(), otherLoad('libs/notificationStorage.ts').ensureNotificationStorage()]);
    await Promise.all(Array.from({ length: 6 }, () => transaction(tx => events.notifyOrderCreated(tx, order))));
    assert.equal(await db.notificationEvent.count(), 1); assert.equal(await db.notificationDelivery.count(), 1); assert.equal(await db.notification.count(), 2);
    checks.push('first-use storage creation and six real concurrent event replays save one email and one notification per audience');
    await Promise.all([service.processEmailDeliveries(), otherService.processEmailDeliveries()]);
    let item = await db.notificationDelivery.findFirst();
    assert.equal(item.state, 'SENT'); assert.equal(item.attempts, 1); assert.equal(smtp.state.messages.length, 1);
    assert.equal(smtp.state.messages[0].recipient, owner.email);
    checks.push('independent Prisma workers compete for one delivery; exactly one loopback SMTP submission is accepted and saved');

    const publish = async kind => {
      await transaction(tx => events.notifyOrderEvent(tx, order, kind, randomUUID()));
      return db.notificationDelivery.findFirst({ where: { state: 'PENDING' } });
    };
    smtp.state.mode = 'temporary'; item = await publish('ORDER_CONFIRMED');
    await service.processEmailDeliveries(); let saved = await db.notificationDelivery.findUnique({ where: { id: item.id } });
    assert.equal(saved.state, 'RETRY'); assert.ok(saved.nextAttemptAt > new Date());
    const submissions = smtp.state.messages.length; await service.processEmailDeliveries(); assert.equal(smtp.state.messages.length, submissions);
    await db.notificationDelivery.update({ where: { id: item.id }, data: { autoAttempts: 4, nextAttemptAt: new Date(0) } });
    await service.processEmailDeliveries(); saved = await db.notificationDelivery.findUnique({ where: { id: item.id } }); assert.equal(saved.state, 'FAILED'); assert.equal(saved.resultCode, 'RETRY_LIMIT_REACHED');
    checks.push('real SMTP 451 rejection backs off, is not immediately resent and stops at the automatic attempt limit');

    smtp.state.mode = 'permanent'; item = await publish('ORDER_DELIVERY_UPDATED');
    await service.processEmailDeliveries(); assert.equal((await db.notificationDelivery.findUnique({ where: { id: item.id } })).state, 'FAILED');
    checks.push('real SMTP 550 recipient rejection stops without a successful-delivery claim');

    smtp.state.mode = 'lost'; item = await publish('PAYMENT_CONFIRMED');
    await service.processEmailDeliveries(); saved = await db.notificationDelivery.findUnique({ where: { id: item.id } });
    assert.equal(saved.state, 'UNKNOWN'); const afterLost = smtp.state.messages.length;
    await service.processEmailDeliveries(); assert.equal(smtp.state.messages.length, afterLost);
    const input = { version: saved.version, requestId: randomUUID(), reason: 'Reviewed the isolated SMTP capture before retrying.', acknowledgeDuplicate: false };
    await assert.rejects(service.retryEmailDelivery(item.id, admin.id, input), e => e.code === 'EMAIL_DUPLICATE_ACK_REQUIRED');
    input.acknowledgeDuplicate = true;
    await Promise.all([service.retryEmailDelivery(item.id, admin.id, input), otherService.retryEmailDelivery(item.id, admin.id, input)]);
    assert.equal(await db.auditLog.count({ where: { entityId: item.id, action: 'EMAIL_RETRY_QUEUED' } }), 1);
    smtp.state.mode = 'accept'; await service.processEmailDeliveries(); saved = await db.notificationDelivery.findUnique({ where: { id: item.id } });
    assert.equal(saved.state, 'SENT'); assert.equal(saved.attempts, 2);
    const sentCopies = smtp.state.messages.filter(message => message.content.includes('<' + item.id + '@example.invalid>'));
    assert.equal(sentCopies.length, 2);
    checks.push('disconnect after DATA is UNKNOWN with no automatic resend; acknowledged manual retry is audited once across concurrent calls and keeps Message-ID');

    item = await publish('REFUND_APPROVED');
    const originalUpdate = db.notificationDelivery.updateMany;
    db.notificationDelivery.updateMany = async args => { if (args.data.state === 'SENT') throw Error('QA result commit interruption'); return originalUpdate.call(db.notificationDelivery, args); };
    await assert.rejects(service.processEmailDeliveries()); db.notificationDelivery.updateMany = originalUpdate;
    assert.equal((await db.notificationDelivery.findUnique({ where: { id: item.id } })).state, 'SENDING');
    await db.notificationDelivery.update({ where: { id: item.id }, data: { leaseExpiresAt: new Date(0) } });
    const beforeRecovery = smtp.state.messages.length; await otherService.processEmailDeliveries();
    assert.equal((await db.notificationDelivery.findUnique({ where: { id: item.id } })).state, 'UNKNOWN'); assert.equal(smtp.state.messages.length, beforeRecovery);
    checks.push('SMTP acceptance followed by a failed result commit recovers the expired lease to UNKNOWN without resubmitting');

    for (const change of [{ emailVerified: null }, { emailVerified: new Date(), status: 'BLOCKED' }]) {
      await db.user.update({ where: { id: owner.id }, data: change });
      item = await publish('ORDER_NOTE_PUBLIC'); const beforeSkip = smtp.state.messages.length;
      await service.processEmailDeliveries(); assert.equal((await db.notificationDelivery.findUnique({ where: { id: item.id } })).state, 'SKIPPED'); assert.equal(smtp.state.messages.length, beforeSkip);
    }
    checks.push('real unverified and blocked accounts are skipped before opening SMTP');
    fs.mkdirSync(path.resolve(__dirname, '../.artifacts'), { recursive: true });
    fs.writeFileSync(path.resolve(__dirname, '../.artifacts/email-mongo-results.json'), JSON.stringify({ checks, applicationDatabaseWrites: 0, externalEmails: 0, loopbackSmtpMessages: smtp.state.messages.length }, null, 2));
    console.log('Email MongoDB and loopback SMTP passed: ' + checks.length + ' groups. External emails: 0.');
  } finally {
    localTransport.close(); await smtp.close();
    assert.equal(connection.pathname, '/' + database); assert.match(database, /^sgtech_email_qa_\d+_[a-f0-9]+$/); assert.notEqual(connection.pathname, application);
    await db.$runCommandRaw({ dropDatabase: 1 }); await Promise.all([db.$disconnect(), second.$disconnect()]);
  }
}
main().catch(error => { console.error('Email MongoDB/SMTP verification failed.', error instanceof assert.AssertionError ? error.stack : { name: error.name, code: error.code }); process.exitCode = 1; });
