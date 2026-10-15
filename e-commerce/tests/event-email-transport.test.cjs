const test = require('node:test'), assert = require('node:assert/strict');
const sourceLoader = require('./fixtures/load-source.cjs');
const nodemailer = require('nodemailer');
const { startSmtpFixture } = require('./fixtures/smtp-server.cjs');
const { runEmailWorker } = require('../scripts/email-worker.cjs');

test('production email template uses bounded SMTP settings and stable identity, with loopback-only delivery', async () => {
  const keys = ['SGTECH_EVENT_EMAILS_ENABLED', 'EMAIL_USER', 'EMAIL_PASSWORD', 'NEXT_PUBLIC_APP_URL', 'NEXTAUTH_URL'];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const smtp = await startSmtpFixture();
  const transport = nodemailer.createTransport(smtp.options); let options;
  const load = sourceLoader({ nodemailer: { createTransport: input => { options = input; return transport; } } });
  const service = load('libs/eventEmailTransport.ts');
  try {
    Object.assign(process.env, { SGTECH_EVENT_EMAILS_ENABLED: 'false', EMAIL_USER: 'qa-sender@example.invalid', EMAIL_PASSWORD: 'local-fixture-only', NEXT_PUBLIC_APP_URL: 'https://shop.example.invalid' });
    const delivery = { id: 'f'.repeat(64), orderId: '1'.repeat(24), href: '/orders/' + '1'.repeat(24), toEmail: 'buyer@example.invalid', subject: 'Payment confirmed · QA', amount: 115000, currency: 'vnd' };
    await assert.rejects(service.sendNotificationEmail(delivery)); assert.equal(smtp.state.connections, 0);
    process.env.SGTECH_EVENT_EMAILS_ENABLED = 'true';
    for (const url of ['http://unsafe.example.invalid', 'https://shop.example.invalid/private', 'https://user:password@shop.example.invalid', 'https://shop.example.invalid?private=1']) {
      process.env.NEXT_PUBLIC_APP_URL = url; assert.equal(service.eventEmailSettings().configured, false);
    }
    process.env.NEXT_PUBLIC_APP_URL = 'https://shop.example.invalid';
    await assert.rejects(service.sendNotificationEmail({ ...delivery, href: '//other.example.invalid' }));
    const result = await service.sendNotificationEmail(delivery);
    assert.deepEqual(result.accepted, ['buyer@example.invalid']); assert.equal(smtp.state.messages.length, 1);
    assert.equal(options.service, 'gmail'); assert.equal(options.logger, false); assert.equal(options.debug, false); assert.equal(options.disableUrlAccess, true); assert.equal(options.disableFileAccess, true);
    assert.equal(options.connectionTimeout, 10000); assert.equal(options.greetingTimeout, 10000); assert.equal(options.socketTimeout, 20000);
    const content = smtp.state.messages[0].content.replace(/=\r\n/g, '').replace(/\r\n[ \t]+/g, ' ');
    assert.match(content, /Message-ID:\s*<f{64}@shop\.example\.invalid>/); assert.match(content, /https:\/\/shop\.example\.invalid\/orders\/1{24}/);
    assert.doesNotMatch(content, /local-fixture-only|recipientName|decisionReason|providerRequestId/);
  } finally { for (const key of keys) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; } transport.close(); await smtp.close(); }
});

test('email scheduler authenticates before work, separates its lease and preserves generic failure responses', async () => {
  const previous = process.env.CRON_SECRET; process.env.CRON_SECRET = 'qa-only';
  const state = { authorized: false, enabled: true, token: 'qa-lease', failure: false, claims: [], finished: [], incidents: [], calls: 0 };
  const load = sourceLoader({
    'next/server': { NextResponse: { json: Response.json } },
    '@/libs/eventEmailTransport': { eventEmailSettings: () => ({ enabled: state.enabled, configured: true }) },
    '@/libs/emailDeliveries': { processEmailDeliveries: async () => { state.calls++; if (state.failure) throw Error('private SMTP credentials and response'); return { processed: 1, sent: 1, disabled: 0 }; } },
    '@/libs/operationalJobs': { authorizeOperationalRequest: async () => state.authorized, claimOperationalJob: async id => { state.claims.push(id); return state.token; }, finishOperationalJob: async (...args) => { state.finished.push(args); return true; }, recordOperationalIncident: async kind => { state.incidents.push(kind); return 'qa-reference'; } },
  });
  const route = load('app/api/jobs/notification-emails/route.ts'), request = new Request('http://localhost/api/jobs/notification-emails', { headers: { authorization: 'Bearer qa-only' } });
  try {
    assert.equal((await route.GET(request)).status, 401); assert.equal(state.claims.length, 0);
    state.authorized = true; state.enabled = false; assert.equal((await (await route.GET(request)).json()).disabled, 1); assert.equal(state.claims.length, 0);
    state.enabled = true; state.token = null; assert.equal((await route.GET(request)).status, 202); assert.equal(state.calls, 0);
    state.token = 'qa-lease'; assert.equal((await route.GET(request)).status, 200); assert.equal(state.finished[0][3], 'notification-email'); assert.equal(state.claims.at(-1), 'notification-email');
    state.failure = true; const response = await route.GET(request); assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /private|credentials|SMTP/); assert.deepEqual(state.incidents, ['EMAIL_JOB_FAILED']); assert.equal(state.finished.at(-1)[3], 'notification-email');
  } finally { if (previous === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = previous; }
});

test('email worker makes one authenticated bounded request and never prints private failure payloads', async () => {
  const calls = [], lines = [], log = { info: line => lines.push(line) }, config = { base: new URL('https://shop.example.invalid') };
  const options = { authorization: async () => 'Bearer qa-only', log, fetchImpl: async (url, input) => { calls.push({ url, input }); return Response.json({ processed: 3, disabled: 0 }); } };
  await runEmailWorker(config, options); assert.equal(calls.length, 1); assert.equal(calls[0].url.pathname, '/api/jobs/notification-emails'); assert.equal(calls[0].input.redirect, 'error'); assert.equal(calls[0].input.headers.authorization, 'Bearer qa-only');
  await assert.rejects(runEmailWorker(config, { ...options, fetchImpl: async () => new Response('private SMTP password', { status: 401 }) }));
  await assert.rejects(runEmailWorker(config, { ...options, fetchImpl: async () => Response.json({ processed: 6 }) }));
  await runEmailWorker(config, { ...options, fetchImpl: async () => Response.json({ skipped: true }, { status: 202 }) });
  assert.doesNotMatch(lines.join('\n'), /qa-only|password/);
});
