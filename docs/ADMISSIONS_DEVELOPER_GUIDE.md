# Admissions Developer Guide

The schema is introduced by `20260803193000_admissions_enquiry_crm`. Core logic is in `lib/admissions.ts`, private bytes in `lib/admissions-files.ts`, encrypted double-restore recovery in `lib/admissions-asset-backup.ts`, and logical backup validation/restore in `lib/admissions-backup.ts`.

All APIs are private/no-store, body-bounded and mutation-only for state changes. Public application access uses `x-admission-invitation`; only SHA-256 token hashes are persisted. Staff routes re-check effective permissions and service-level role/object scope. Application/enquiry updates use row versions. Never add raw IDs, public asset URLs, state-changing GET, destination disclosure, external AI/provider calls or PII logging.

Run sequentially: `pnpm qa:23h`, focused admissions tests, `pnpm typecheck`, `pnpm test`, `pnpm routes:list`, `pnpm lifecycle:backfill`, 4 GB-capped `pnpm build`, version-37 backup/restore and `pnpm git:safety-check`. Independent QA uses `pnpm qa:23hqa` with fresh `ADMIT23HQA` fixtures.

Production remains blocked until the privacy notice, retention policy, complaint route, cycle configuration, approved document types and operator training are approved.
