import {readFileSync,lstatSync,realpathSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {hashBytes} from '../portable/artifact-handoff';
// Actual common source retained by both donor and recovery integration histories.
export const LAB_BASE='baa49c738e009f99c5e741a04bc3fe8f8862a848';
export const CONNECTION_FILES=[
  'scripts/laptop-lab/consumer-authorization.ts','scripts/laptop-lab/consumer-custody.ps1','scripts/laptop-lab/consumer-host.ts','scripts/portable/local-runtime-authorization.ts','scripts/portable/local-runtime-trust-registration.json','scripts/portable/product-trust-policy.ts',
  'scripts/laptop-lab/consumer-types.ts','scripts/laptop-lab/consumer-identity.ts','scripts/laptop-lab/consumer-profile.ts','scripts/laptop-lab/consumer-plan.ts','scripts/laptop-lab/consumer-connection.ts','scripts/laptop-lab/consumer-lifecycle.ts','scripts/laptop-lab/consumer-runner.mjs',
  'scripts/laptop-lab/consumer-certificate-adapter.ts','scripts/laptop-lab/consumer-operation-ports.ts',
  'scripts/laptop-lab/consumer-session.ts','scripts/laptop-lab/consumer-inputs.ts','scripts/laptop-lab/consumer-bootstrap.ts','scripts/laptop-lab/consumer-fixture-foundation.ts','lib/session-token.ts',
  'scripts/laptop-lab/cli.mjs','scripts/laptop-lab/config.mjs','scripts/laptop-lab/runner.mjs','scripts/laptop-lab/report.mjs','scripts/laptop-lab/output.mjs','scripts/laptop-lab/metrics.mjs','scripts/laptop-lab/fixture.mjs',
  'scripts/portable/artifact-handoff.ts','scripts/portable/http-target.ts','scripts/portable/operator-adapter.ts','scripts/portable/producer-process.ts','scripts/portable/acceptance-fixture.ts','scripts/portable/synthetic-foundation.ts','scripts/portable/acceptance-readback.ts','scripts/portable/acceptance-target-database.ts','scripts/portable/integrated-acceptance.ts','deploy/portable/compose.yml'
];
export function codeIdentity(workspace:string){
  const git=(args:string[])=>execFileSync('git',['--no-optional-locks','-c','core.fsmonitor=false',...args],{cwd:workspace,encoding:'utf8',timeout:5000,maxBuffer:2**20,stdio:['ignore','pipe','pipe']}).trim();
  assert.equal(git(['show','-s','--format=%T',LAB_BASE]),'ee2b3a2f9eb3a5b45d456eb54547a983ab5991dd','LOCAL_BASE_TREE_MISMATCH');
  git(['merge-base','--is-ancestor',LAB_BASE,'HEAD']);
  const [head,tree]=git(['show','-s','--format=%H %T','HEAD']).split(' ');
  // The immutable observed tree binds all unchanged transitive dependencies.
  // Only these shipping deltas and explicit non-runtime handoff/test metadata
  // may differ; an unregistered changed verifier/helper fails closed.
  const nonRuntime=new Set(['config/recovery-integration-source-delta.json','scripts/laptop-lab/README.md','scripts/laptop-lab/HANDOFF.md','scripts/laptop-lab/evidence/D4_CONSUMER_CONNECTION.json','scripts/laptop-lab/consumer-connection.test.ts','scripts/laptop-lab/consumer-test-support.ts','scripts/laptop-lab/consumer-runner.d.mts','scripts/laptop-lab/output.d.mts','scripts/laptop-lab/fixture.d.mts','scripts/laptop-lab/tsconfig.consumer.json']);
  for(const file of ['scripts/laptop-lab/lab.test.mjs','scripts/laptop-lab/evidence/D3_CONTAINER_PERSISTENCE.json','scripts/laptop-lab/container-persistence-helper.test.mjs','scripts/laptop-lab/consumer-certificate-adapter.test.ts','scripts/laptop-lab/consumer-certificate-test-support.ts','scripts/laptop-lab/evidence/D4R1_ADAPTER_CLOSURE.json','tests/laptop-consumer-certificate-service.test.ts','tests/laptop-consumer-bound-ports.test.ts','tests/laptop-consumer-publication.test.ts','tests/laptop-consumer-fixture-foundation.test.ts','tests/laptop-consumer-process-input.test.ts'])nonRuntime.add(file);
  for(const relative of git(['diff','--no-ext-diff','--no-textconv','--name-only','HEAD']).split(/\r?\n/).filter(Boolean))assert(CONNECTION_FILES.includes(relative)||nonRuntime.has(relative),'LOCAL_UNBOUND_SOURCE_DELTA');
  const hashes=Object.fromEntries(CONNECTION_FILES.map(relative=>{const file=path.join(workspace,relative),s=lstatSync(file);assert(s.isFile()&&!s.isSymbolicLink()&&s.size<=128*2**10&&realpathSync(file).toLowerCase()===file.toLowerCase(),'LOCAL_CODE_FILE_UNSAFE');return [relative,hashBytes(readFileSync(file))];}));
  return {baseSource:LAB_BASE,head,tree,classification:'LOCAL_SOURCE_CANDIDATE',files:hashes,fingerprint:hashBytes(JSON.stringify({head,tree,hashes}))};
}
