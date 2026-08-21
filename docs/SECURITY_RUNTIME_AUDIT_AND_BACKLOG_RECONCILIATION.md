# SEC-1 Security Runtime Audit and Backlog Reconciliation

Status: SEC-1A implementation, SEC-1B runtime, and SEC-1-QA independent closure
are complete for the authorized local boundary.

Testing authorization is limited to this local repository and QASEC1 fixtures in a byte-for-byte copied database. This document does not authorize testing `nalandaps.com`, any external service, or any real person’s account or data. Prompt 21B, 21C, and 21D remain blocked; no Student address, coordinate, map, geocoding, or location implementation was opened.

## Baseline and method

The audit used OWASP Top 10:2025, OWASP ASVS 5.0.0, OWASP Cheat Sheet guidance, current official Next.js authentication/header guidance, current Prisma raw-query guidance, and current Node.js crypto/security guidance. Static discovery covered 1,089 ranked repository entries, 214 selected security-relevant files, and 43 complete review groups. Runtime mutation belongs only to a copied database.

Verified starting point:

- 274 page routes and 376 API routes after the explicit ID-card batch print-audit
  POST endpoint added by SEC-1-QA.
- Prisma schema SHA-256 `B1135F63C2E5579F320A5FFD01BDB3A167520B42D479D3906F7BB611FC82FC00`.
- 41 migrations; backup version 37.
- Operational database SHA-256 `1556B98FCAF0F2475C0C0F1BAEEFCE4E638680B9D4C7DC9BFFB8B6F0D09B4392`.
- 8 Students, 8 active enrollments, 19 Payments, ₹99,100 collected.
- Node 24.17.0, Next.js 15.5.19, React 19.2.7, Prisma 6.19.3, pnpm 11.7.0.

## Reconciled unfinished work

| Classification | Reconciled items | Decision |
| --- | --- | --- |
| `FIX_IN_SEC_1` | First-run bootstrap claim; copied-QA restore boundary; last-privileged-user transaction race; known seed/provider secrets; receipt ownership; import row/race bounds; streamed body limits; login denial risk; password/session rotation controls; trusted proxy origins; raw client errors; OCR state/storage boundaries; Class X year/state/duplicate rules; fee/cash validation; CSV formula injection; webhook storage/replay bounds; ambiguous send recovery; approved-content snapshot drift; keyed privacy hashes; report/export bounds; native dialogs; permission-gated portal navigation | Fixed and regression tested in SEC-1A. |
| `BLOCKED_EXTERNAL_APPROVAL` | Prompt 21B address design, Prompt 21C coordinates/maps/geocoding, Prompt 21D any dependent location work | Remains blocked by leadership and qualified Indian privacy/legal approval. Not reopened. |
| `DEFERRED_FUTURE_FEATURE` | MFA/2FA, SSO, formal account recovery, payment gateway, admissions expansion, biometric/RFID, transport, payroll/GST, multi-tenant architecture, native mobile distribution | Recommendation only. No feature expansion in SEC-1. |
| `INTENTIONAL_SECURITY_BOUNDARY` | OCR Payment posting disabled; AI read-only/no shell/no SQL/no external source/no write tools; PWA static-only cache; public/private website separation; Browser restore copied-QA-only; MOCK-first external providers; no Student location implementation | Preserve. These are controls, not gaps. |
| `OBSOLETE` | Older “not built” statements for Parent/Teacher portals, attendance, expenses, books/library, homework, exams, certificates, notifications, PWA, AI, OCR, cloud backup, and public website | Superseded by later completion records and current route inventory. |
| `DUPLICATE` | Repeated P3005 notes; repeated provider/device/Browser limitations; repeated deployment readiness and copied-database warnings | Consolidated here and in the security report. |
| `REQUIRES_DEPLOYMENT_ENVIRONMENT` | TLS termination, production HSTS enablement, trusted-proxy sanitization, distributed rate limits/worker leases, WAF/body limits, centralized immutable logs, scheduler, off-device retention/object lock, live-provider contractual review, physical PWA/device checks | Must be verified at deployment; local code defaults fail closed. |

## Source-document reconciliation

- `PROMPT_HISTORY.md`: Prompt 21A-QA remains the last previously cleared phase; SEC-1 entries are appended separately.
- `BUG_LIMITATION_AND_TECH_DEBT_REGISTER.md`: SEC-1 fixed items are closed;
  multi-instance coordination, deployment TLS/proxy/logging, and external
  approvals remain explicit. SEC-1-QA completed the XLSX dependency replacement.
- `ERP_FEATURE_STATUS_AND_GAP_MAP.md` and `SCHOOLKNOT_REPLACEMENT_GAP_MAP.md`: feature gaps are not security authorization. Existing security boundaries remain unchanged.
- `DEVELOPER_CONTINUATION_GUIDE.md` and `NOOB_OPERATING_GUIDE.md`: production secrets, bootstrap proof, proxy trust, copied-DB restore, and local-only security testing are now operational requirements.
- Completion/release documents: older counts are historical snapshots and must not override the route/test/build/backup evidence recorded by SEC-1.

## Residual limitations

- SEC-1-QA confirmed the reachable `xlsx@0.18.5` advisories as High and replaced
  it with the exact-pinned official SheetJS 0.20.3 distribution. Lock integrity
  is regression tested; 5 MB, magic-byte, one-sheet, 256-column, and 2,000-row
  limits remain defense in depth.
- Process-local worker locks do not replace a distributed lease in multi-instance deployment.
- Fee security-event durability depends on deployment log retention because SEC-1 intentionally made no schema change.
- Class X duplicate prevention relies on the current SQLite transaction; another database backend should add a durable uniqueness/idempotency claim.
- Report/export caps protect resources but historical reporting beyond a cap needs pagination rather than silent scope expansion.

SEC-1B production Browser audit is complete. Its repeated role, route, security,
responsive, accessibility, storage, console, and cleanup evidence is recorded
in `SEC_1_RUNTIME_BROWSER_AND_UI_UX_AUDIT.md`. SEC-1-QA subsequently completed
the independent fresh-copy verification recorded in
`SEC_1_INDEPENDENT_QA_CLOSURE_REPORT.md`.
authorized local boundary; deployment-only controls and Prompt 21B/21C/21D
remain blocked exactly as recorded above.

## Academic Integrity v1.1 authorization closure

`ACADEMIC-INTEGRITY-1A-QA` independently cleared the prospective marks-write
policy on 2026-08-21. Ordinary Teacher and multi-role Teacher contexts are
immutable denials; Principal and Super Admin remain permanent governed writers;
eligible non-teaching users require an exact active reserved-profile grant.
Generic IAM APIs cannot assign the reserved profile or allow marks-write
overrides. Guardian-linked-child denial, session-revoked grant removal,
scope/IDOR/import/concurrency defenses and privacy-safe audit evidence passed on
copied data. The security diff scan produced zero Critical/High findings and its
single Medium finding was remediated and regression-tested. See
`evidence/ACADEMIC_INTEGRITY_1A_QA_CLEARANCE.md`.
