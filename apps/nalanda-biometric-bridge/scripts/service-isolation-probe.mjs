// Disposable CI fixture: run the real worker behind the real host's secret pipe.
// No vendor library, transport, listener, template or operational data is involved.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { runWorker } from './dist/agent.js';
import { setRuntimeSecrets } from './dist/runtime-secrets.js';

const config = process.argv[process.argv.indexOf('--config') + 1];
const fixture = JSON.parse(readFileSync(new URL('./service-probe.json', import.meta.url), 'utf8'));
const lines = createInterface({ input: process.stdin });
const abort = new AbortController();
const secret = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('BRIDGE_SECRET_STARTUP_TIMEOUT')), 10000);
  lines.once('line', line => { clearTimeout(timer); try { resolve(JSON.parse(line)); } catch { reject(new Error('BRIDGE_SECRETS_INVALID')); } });
});
setRuntimeSecrets(secret);
lines.on('close', () => abort.abort());
lines.on('line', line => { if (line === 'STOP') abort.abort(); });
function denied(action) {
  try { action(); return false; } catch (e) { return ['EACCES', 'EPERM'].includes(e.code); }
}
if (!process.argv.includes('--resume-held-batch')) {
const identity = execFileSync(fixture.whoami, ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8', windowsHide: true });
const results = {
  virtualIdentity: identity.includes(fixture.sid),
  requiredConfigReadable: readFileSync(config).length > 0,
  requiredSecretReadable: readFileSync(fixture.secret).length > 0,
  configurationWriteDenied: denied(() => writeFileSync(config, 'unauthorised')),
  binaryWriteDenied: denied(() => writeFileSync(fixture.worker, 'unauthorised')),
  unrelatedAdminFileReadDenied: denied(() => readFileSync(fixture.adminOnly)),
};
writeFileSync(fixture.results, JSON.stringify(results));
if (Object.values(results).some(value => value !== true)) throw new Error('BRIDGE_SERVICE_ISOLATION_FAILED');
}
try { await runWorker(config, abort.signal, process.argv.includes('--resume-held-batch')); }
finally { lines.close(); }
