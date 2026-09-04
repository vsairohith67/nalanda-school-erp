# REAL-USER-ACCESS-READINESS-1A Clearance Evidence

**Status:** `REAL_USER_ACCESS_READINESS_1A_CLEARED`

Terminal vocabulary: `REAL_USER_ACCESS_READINESS_1A_CLEARED`, `REAL_USER_ACCESS_READINESS_1A_REQUIRES_FIXES`, `REAL_USER_ACCESS_READINESS_1A_PARTIAL_PLATFORM_GATE`, `REAL_USER_ACCESS_READINESS_1A_BLOCKED_SECURITY`, or `REAL_USER_ACCESS_READINESS_1A_BLOCKED`.

This record is sealed only when exact feature head, independent security/browser review, complete regression, exact-head CI, normal merge, tag and tracker readback agree. Software clearance never means deployment or activation.

## Candidate and immutable boundaries

- Task-start base: `origin/main` `6754f92ab5d8dcb63b80edc42bfb955ad6be832c`.
- Branch: `feature/real-user-access-readiness-1a` in its dedicated physical worktree.
- Feature: `real-user-access-readiness-1a` default `OFF`, rollout `0%`.
- Operational SQLite: `C:\Users\rohit\Documents\school software\prisma\dev.db`, 8,409,088 bytes, baseline SHA-256 `65F47EFA37DA321023439303770645F8D656F2BE58458C1A03B341408EF9A6FA`; write-capable QA uses only copies/fresh databases.
- Data: reserved synthetic identities and contacts only. No delivery provider, real invitation, real account, real MFA or private staging.
- OCR boundary: `feature/ocr-scanning-foundation-1b` / PR #19 remains separate and is not modified, merged, closed, copied or depended upon.

## Evidence ledger

| Gate | Current result | Evidence |
| --- | --- | --- |
| Current-state audit | Passed | classified authentication/IAM capabilities and reuse boundaries |
| Lifecycle/linking/catalogue | Passed focused tests | explicit transitions; exact person-link rules; 14 templates |
| Synthetic preparation | Passed focused tests | 41-row wave including required base cohort, specialised profiles and multi-role case; duplicate/formula failures |
| Invitation/activation | Passed copied-DB QA | local fragment token, one-use consumption, atomic gated activation |
| TOTP/recovery codes | Passed focused and copied-DB QA | encrypted secret, RFC-compatible bounded verification, replay refusal, hash-only codes |
| WebAuthn/passkeys | Passed server policy tests | exact localhost synthetic RP/origin; live HTTPS and physical-device proof remain external |
| Approval/step-up/recovery | Passed copied-DB QA | distinct requester/reviewer/approver; action/session-bound step-up; three-person recovery |
| Certification/expiry/offboarding | Passed copied-DB QA | retain review, automatic expiry, complete session/device/factor revocation |
| SQLite migration matrix | Passed copied-DB QA | fresh, copied upgrade, repeat-no-pending and restore-fresh |
| Backup/restore | Passed copied-DB QA | 53 durable readiness rows, restored twice, unused invite revoked, transient/plaintext secrets excluded |
| Operational database after focused QA | Passed | byte-identical hash/size/mtime; no sidecar |
| PostgreSQL 17 migration/parity | Passed exact-head CI | schema/trigger/baseline parity and PostgreSQL 17 migration/restore checks passed in exact-head CI |
| Browser matrix | Passed synthetic browser rehearsal | approver step-up, local invitation, password/TOTP activation, server training/policy, candidate MFA login, session revocation; 1366x768 and 390x844 light/dark; no overflow or console errors |
| Full regression/platform/security | Passed exact-head CI | focused 48/48 tests, full typecheck, production compile/generate build, copied-DB QA, public scan, safety scan; final security scan `11f3dd21-dcc0-414d-890f-cffe1e3586d8` sealed with 65/65 reviews and zero findings |
| Exact-head CI | Passed | feature SHA `96add64bf3b881e752f417a46e1a226cc2d253bd`; all required PR checks green |
| Merge/tag | Passed | normal PR #21 merge `78a889ec5ddf952d507fff4fb47ac38ef207eced`; annotated `real-user-access-readiness-v44-2026-09-04` |
| Notion/Asana/Canvs | Pending tracker readback | search existing, update once after verdict, read back; disclose unavailable connector |

## Current focused copied-database result

`pnpm.cmd qa:real-user-access-readiness` passed fresh/copied/repeat/restore SQLite migrations; separated request approval; one-time local invitation; credential, MFA, training, policy and role activation; MFA login/replay; recovery-code replay; recertification; temporary expiry; MFA recovery; native/Offline device revocation; offboarding; and durable restore twice. Before/after operational evidence remained 8,409,088 bytes and SHA-256 `65F47EFA37DA321023439303770645F8D656F2BE58458C1A03B341408EF9A6FA`.

No real-user, real-invitation, delivery-provider, private-staging, deployment, OCR, physical-device, production or operational-activation claim may be inferred from this document.

## Additional terminal evidence

- Public repository scan: `REAL_USER_ACCESS_PUBLIC_REPO_SCAN_PASSED`, 108 changed files, 8 required artifacts, 0 binary artifacts, 0 candidate secrets, 0 real contacts, and `realUsersActivated:false`.
- Git safety scan: candidate, staged and tracked files passed with no detected secret or private runtime artifact.
- Browser rehearsal used a fresh synthetic database and loopback-only runtime. The synthetic fixture and runtime files were removed after the run.
- Initial security scan `ecdb3118-e387-415a-a5cf-554816140432` found two low findings; both were remediated. Final correction scan `11f3dd21-dcc0-414d-890f-cffe1e3586d8` found zero findings after permission hardening and scan-scope correction.
