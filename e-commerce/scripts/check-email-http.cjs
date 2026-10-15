const assert = require('node:assert/strict');
async function verifyEmailHttp({ call, prisma, cookies, cronSecret, checks }) {
  const path = '/api/admin/notifications/email';
  assert.equal((await call(path)).status, 401);
  assert.equal((await call(path, { cookie: cookies[1] })).status, 403);
  const response = await call(path, { cookie: cookies[0] }); assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /no-store/);
  const queue = await response.json(); assert.equal(queue.settings.enabled, false); assert.equal(queue.settings.configured, false); assert.ok(queue.total > 0); assert.ok(queue.items.every(row => row.state === 'PENDING' && row.attempts === 0));
  assert.equal((await call(path + '?state=INVALID', { cookie: cookies[0] })).status, 400);
  assert.equal((await call(path, { cookie: cookies[1], method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
  assert.equal((await call('/api/jobs/notification-emails')).status, 401);
  const before = await prisma.notificationDelivery.count({ where: { state: 'PENDING' } });
  const job = await call('/api/jobs/notification-emails', { headers: { authorization: 'Bearer ' + cronSecret } }); assert.equal(job.status, 200); assert.deepEqual(await job.json(), { processed: 0, disabled: 1 });
  assert.equal(await prisma.notificationDelivery.count({ where: { state: 'PENDING' } }), before);
  assert.equal(await prisma.operationalJob.findUnique({ where: { id: 'notification-email' } }), null);
  assert.equal((await prisma.operationalJob.findUnique({ where: { id: 'payment-reconciliation' } })).status, 'SUCCEEDED');
  checks.push('real admin-only email queue lists saved pending work; disabled authenticated email scheduler sends nothing and leaves payment heartbeat unchanged');
}
module.exports = { verifyEmailHttp };
