import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const windowPath = fileURLToPath(new URL('../../config/overnight-repair-product-1a-window.json', import.meta.url));
export function admittedWindowsQaPolicy(event, environment, actualHead, window) {
  const denied = { policy: '', reason: 'WINDOW_CONTEXT_NOT_ADMITTED' };
  if (window?.assignment !== 'NPS-OVERNIGHT-REPAIR-AND-PRODUCT-DELIVERY-1A' ||
      window.instructionSha256 !== '32bed8bcd9d8125e61f88527161f6835be0762f7863df8fb435eb71b7f401965' ||
      window.repository !== 'vsairohith67/nalanda-school-erp' || window.pullRequest !== 28 ||
      window.branch !== 'release/recovery-integration-1a' || window.attempt !== '1' ||
      window.policy !== 'RemoteSigned' || window.policyScope !== 'Process' || window.maximumStepMinutes !== 120 ||
      window.shorterExistingJobCapsRetained !== true || window.previousAllowancesRemainConsumed !== true ||
      window.eventStartInclusiveUtc !== '2026-10-08T19:02:43.000Z' ||
      window.eventEndExclusiveUtc !== '2026-10-09T05:02:43.000Z') return denied;
  if (environment.GITHUB_ACTIONS !== 'true' || environment.RUNNER_OS !== 'Windows' ||
      environment.GITHUB_EVENT_NAME !== 'pull_request' || environment.GITHUB_REPOSITORY !== window.repository ||
      environment.GITHUB_RUN_ATTEMPT !== '1' || event?.number !== 28 || event.pull_request?.number !== 28 ||
      event.pull_request?.head?.ref !== window.branch || event.pull_request?.head?.repo?.full_name !== window.repository ||
      event.pull_request?.base?.repo?.full_name !== window.repository || !/^[a-f0-9]{40}$/.test(actualHead) ||
      event.pull_request?.head?.sha !== actualHead) return denied;
  const timestamp = event.pull_request.updated_at;
  if (typeof timestamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(timestamp)) return denied;
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time) || time < Date.parse(window.eventStartInclusiveUtc) || time >= Date.parse(window.eventEndExclusiveUtc)) return denied;
  // This admits a recorded publication event, not a later arbitrary dispatch or
  // retry. Its ordinary hosted jobs retain their original step and job caps.
  return { policy: 'RemoteSigned', reason: 'EXACT_REVIEWED_PUBLICATION_EVENT' };
}

function main() {
  const window = JSON.parse(fs.readFileSync(windowPath, 'utf8'));
  const eventPath = process.env.GITHUB_EVENT_PATH, outputPath = process.env.GITHUB_OUTPUT;
  if (!eventPath || !outputPath) throw Error('HOSTED_CONTEXT_FILES_REQUIRED');
  const stat = fs.lstatSync(eventPath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2_000_000) throw Error('HOSTED_EVENT_BOUNDARY_INVALID');
  const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true, timeout: 10000 }).trim();
  const result = admittedWindowsQaPolicy(event, process.env, head, window);
  fs.appendFileSync(outputPath, `policy=${result.policy}\n`);
  console.log(JSON.stringify({ contract: 'NPS_OVERNIGHT_HOSTED_WINDOW_V1', ...result }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
