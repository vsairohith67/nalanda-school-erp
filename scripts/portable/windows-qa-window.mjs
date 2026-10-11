import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const windowPath = fileURLToPath(new URL('../../config/current-candidate-qualification-5a-window.json', import.meta.url));
export function admittedWindowsQaPolicy(event, environment, actualHead, window) {
  const denied = { policy: '', reason: 'WINDOW_CONTEXT_NOT_ADMITTED' };
  if (window?.assignment !== 'NPS-5A-CURRENT-CANDIDATE-QUALIFICATION-AND-PARALLEL-DELIVERY' ||
      window.instructionSha256 !== '01b6174e2900c94fbb0c532ab742704ae0257121a2d9a3134950010a7a4a7e15' ||
      window.repository !== 'vsairohith67/nalanda-school-erp' || window.pullRequest !== 28 ||
      window.branch !== 'release/recovery-integration-1a' || window.attempt !== '1' ||
      window.policy !== 'RemoteSigned' || window.policyScope !== 'Process' || window.maximumStepMinutes !== 120 ||
      window.shorterExistingJobCapsRetained !== true || window.previousAllowancesRemainConsumed !== true ||
      window.eventStartInclusiveUtc !== '2026-10-11T03:10:00.961Z' ||
      window.eventEndExclusiveUtc !== null ||
      window.publicationCeiling !== null || window.additionalPublicationBudgetCreated !== true ||
      window.amendmentSha256 !== '4208d45251071b09425e9a4ef171754dfe9bda53d0cbe3692569756a276a8ee2' || window.taskDurationAndPublicationQuotasSuperseded !== true ||
      JSON.stringify(window.transferredPublicationSlots) !== '[]') return denied;
  if (environment.GITHUB_ACTIONS !== 'true' || environment.RUNNER_OS !== 'Windows' ||
      environment.GITHUB_EVENT_NAME !== 'pull_request' || environment.GITHUB_REPOSITORY !== window.repository ||
      environment.GITHUB_RUN_ATTEMPT !== '1' || event?.action !== 'synchronize' || event?.number !== 28 || event.pull_request?.number !== 28 ||
      event.pull_request?.head?.ref !== window.branch || event.pull_request?.head?.repo?.full_name !== window.repository ||
      event.pull_request?.base?.repo?.full_name !== window.repository || !/^[a-f0-9]{40}$/.test(actualHead) ||
      event.pull_request?.head?.sha !== actualHead) return denied;
  const timestamp = event.pull_request.updated_at;
  if (typeof timestamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(timestamp)) return denied;
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time) || time < Date.parse(window.eventStartInclusiveUtc) || false) return denied;
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
  console.log(JSON.stringify({ contract: 'NPS_RELEASE_BLOCKER_HOSTED_WINDOW_V1', ...result }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
