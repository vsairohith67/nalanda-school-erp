# Synthetic Pilot Failure and Security Drills

**Scope:** synthetic/local evidence only
**Result:** passed for the exercised software controls
**Operational data:** not used or modified

This ledger separates executed runtime rehearsals from source and contract tests. It does not claim a production outage exercise, provider-edge validation, public/private staging, a recovery-time SLA, real-user activation or physical-device certification.

## Runtime rehearsals

| Drill | Observed result | Classification |
| --- | --- | --- |
| Portable-stack distributed rate limiting | 100 concurrent attempts across two replicas produced 30 allowed and 70 limited requests; the Valkey-backed limit remained shared and the run was warning-free | Executed local container rehearsal |
| Valkey outage | Requests failed closed while the store was unavailable and recovered after the dependency returned | Executed local container rehearsal |
| PostgreSQL outage | Database-dependent readiness failed closed and recovered after PostgreSQL returned | Executed local container rehearsal |
| Private object-store outage | Private-object operations failed closed and recovered after object storage returned | Executed local container rehearsal |
| PostgreSQL job lock | Two contenders produced one acquired and one contended result | Executed local container rehearsal |
| Immutable upgrade and rollback | Two application replicas remained available while immutable-image upgrade/rollback probes ran | Executed local container rehearsal |
| Encrypted backup and restore | Backup format v44 was read back from private storage and restored four times into two isolated targets with exact governed reconciliation | Executed local container rehearsal; measured timing is not an SLA |
| Wrong backup key | Decryption was refused and no successful restore was reported | Executed local rehearsal |
| Private media restore | One encrypted private object restored twice with checksum agreement | Executed local rehearsal |
| Local security-resilience load | 149 bounded requests: 98 accepted, 51 controlled `429`, two controlled `503`; circuit recovered | Executed local pure-adapter rehearsal |

The final portable-stack run ended with `PORTABLE_STACK_QA_PASSED`. It used image digest `sha256:117a0a26accf65a62db26f3050b09bfc3ebbc92030db1cb54fa0823353c5d1d1`, HTTPS between the local probe and stack, backup version 44, and a retention plan that deleted zero objects.

## Contract and source checks

| Control | Evidence | Result |
| --- | --- | --- |
| Circuit breaker and cooldown recovery | `tests/security-resilience.test.ts` | Passed |
| Untrusted direct-origin rejection before body consumption | `tests/security-resilience.test.ts` | Passed |
| Deployment-environment fail-closed contracts | `tests/deployment-environment.test.ts` | Passed |
| Runtime security and session controls | `tests/sec1-runtime-security.test.ts` | Passed |
| Seed-account safeguards | `tests/auth-seed-account-safeguards.test.ts` | Passed |
| Bounded database retry | `tests/database-retry.test.ts` | Passed |
| Offline mutation conflict/retry/revocation contracts | `tests/offline-sync-1a.test.ts` and `tests/offline-sync-coordinator.test.ts` | Passed |
| Native authentication/session contracts | `tests/native-auth-1a.test.ts` | Passed |

The security-resilience acceptance command passed 48 tests, its bounded local load, and an independent source-only acceptance. The focused session/database/offline/native set passed 38 tests.

## Changed-diff security review

The changed tree first received independent threat-model, executable-source and documentation/evidence discovery under scan ID `1f67c0a2-f2dd-413f-a4cb-8a4b593a99ce`. After the final harness and inert-fixture-literal edits, scan `0418d430-c82f-4cc8-a665-0b6cd0064be6` sealed exact digest `cc2261a0e634b71543dc9dd1c67603a8bda5866fc8a43a1b271ff42f53bd80c6` with 11/11 executable inventory items reviewed and zero findings. Two local-path hypotheses were rejected because exploitation required a lower-trust actor to pre-position filesystem links inside fresh operator-controlled ignored roots; no such trust boundary exists in this local-only workflow.

## Boundaries still open

- Provider DNS/TLS, WAF/edge policy and private staging remain external gates.
- Real-user session expiration and support escalation must be rehearsed only after an authorized supervised pilot exists.
- Physical Windows, Android and iOS device/signing checks remain platform-owner gates.
- Biometric software and hardware certification remain outside this branch.
- Legal privacy/retention language and named operating contacts require owner approval before real-data or real-user use.
