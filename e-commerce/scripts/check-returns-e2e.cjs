const path = require('node:path');
const { spawnSync } = require('node:child_process');
const result = spawnSync(process.execPath, [path.join(__dirname, 'check-operations-e2e.cjs')], {
  env: { ...process.env, QA_BROWSER: 'true', QA_BROWSER_SCOPE: 'returns' }, windowsHide: true, stdio: 'inherit',
});
process.exitCode = result.status ?? 1;
