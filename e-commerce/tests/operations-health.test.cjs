const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { classifyOperationsHealth, runOperationsHealth } = require('../scripts/check-operations-health.cjs');
const health = (failed = []) => ({ status: failed.length ? 'needs-attention' : 'ok', checks: ['database', 'scheduler', 'sandbox', 'holds', 'payments'].map(key => ({ key, ok: !failed.includes(key) })) });

test('operations health keeps manual financial follow-up visible without treating successful infrastructure as a failed job', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgtech-health-')), summaryPath = path.join(dir, 'summary.md'), logs = [];
  try {
    const result = await runOperationsHealth({ base: new URL('https://example.invalid') }, { authorization: async () => 'fixture', fetchImpl: async () => Response.json({ ...health(['holds', 'payments']), privateDetail: 'must-not-be-reported' }, { status: 503 }), log: { warn: text => logs.push(text) }, summaryPath });
    assert.deepEqual(result, { status: 'needs-attention', warnings: ['holds', 'payments'] });
    assert.match(logs[0], /::warning title=Operations follow-up::/);
    assert.match(fs.readFileSync(summaryPath, 'utf8'), /Online stock holds, Payment follow-up/);
    assert.doesNotMatch(fs.readFileSync(summaryPath, 'utf8') + logs.join(), /must-not-be-reported/);
  } finally { fs.unlinkSync(summaryPath); fs.rmdirSync(dir); }
});

test('operations health still fails on auth, unavailable infrastructure, stale scheduler and malformed or inconsistent responses', () => {
  for (const [status, body] of [[401, health()], [403, health()], [500, health()], [503, { status: 'unavailable' }], [503, health(['database'])], [503, health(['scheduler', 'payments'])], [503, health(['sandbox'])], [503, health()], [200, { ...health(), status: 'needs-attention' }], [200, { ...health(), checks: health().checks.slice(1) }], [200, { ...health(), checks: [...health().checks.slice(0, 4), health().checks[0]] }], [200, { ...health(), checks: health().checks.map(row => ({ ...row, ok: 'true' })) }]]) assert.throws(() => classifyOperationsHealth(status, body));
});

test('operations health reports all-clear only for verified checks and does not hide network failures', async () => {
  const logs = [];
  const config = { base: new URL('https://example.invalid') }, deps = { authorization: async () => 'fixture', summaryPath: null, log: { info: text => logs.push(text) } };
  assert.deepEqual(await runOperationsHealth(config, { ...deps, fetchImpl: async () => Response.json(health()) }), { status: 'ok', warnings: [] });
  assert.equal(logs[0], 'Operations health check passed.');
  await assert.rejects(runOperationsHealth(config, { ...deps, fetchImpl: async () => { throw Error('Network unavailable'); } }));
});
