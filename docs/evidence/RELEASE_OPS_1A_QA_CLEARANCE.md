# RELEASE-OPS-1A Independent QA and Release Clearance

**Decision date:** 2026-08-10
**Result:** `RELEASE_OPERATIONS_CLEARED`
**Boundary:** local/private release machinery only; no deployment, DNS, hosting, provider, real-user or real-data action

## Independent decision matrix

| Area | Decision | Evidence |
| --- | --- | --- |
| Existing-asset audit | PASS | DEVOPS-1A-E, OBS-1A, backup/private-asset and PWA controls were reconciled; no parallel release system was introduced. |
| Five environments and isolation | PASS | Development, test, preview, staging and production identities are explicit. Operational `dev.db`, shared DB/storage, insecure production shape, path escape, placeholders and partial providers fail closed. |
| Release manifest and package | PASS | Reviewed source epoch is mandatory; two builds produced the same archive digest. Manifest, payload inventory and archive integrity were independently verified. Private paths/content, symlinks and traversal are refused. |
| Feature flags | PASS | Server-authoritative, versioned, default-off flags enforce role/environment/time/approval constraints and preserve audit history. |
| Lock, restart and audit | PASS | Ignored `.codex/release-ops/` restart state, one exclusive expiring owner/session lock, governed stale recovery, atomic candidate state and append-only hash-chain audit passed. |
| Phase/gate engine | PASS AFTER QA FIX | Independent QA made prerequisite gates, future rollback ownership, active maintenance and ordered backup/migrate/switch/health/smoke mandatory. Migration records the data-write boundary; completion requires the switch. |
| Migration and rollback | PASS | All 18 active migrations deployed on fresh and copied databases; copied deployment repeated as a no-op. Restore ran twice. Destructive/incompatible migration is blocked; post-write DB restore requires reconciliation approval. |
| Synthetic staging | PASS | Production-shaped local isolation used synthetic fixtures only; operational account/business baselines remained unchanged and provider calls were zero. No staging resource was created. |
| Maintenance behavior | PASS | Ordinary authenticated workflows enter a private-data-free maintenance page; permitted health/version access remains bounded; database-unavailable rendering is safe. |
| Web/PWA update safety | PASS AFTER QA FIX | Current/available/recommended/required/incompatible/unknown states passed. Generic form input is marked dirty; confirmed update defers reload and preserves work. Auth/private responses remain outside caches. |
| Permissions and role isolation | PASS | Super Admin receives full release gates/history, Director receives summary only, Viewer is refused server-side and navigation is hidden. |
| Browser, responsive and theme QA | PASS | Chromium at 1366x768 and exact 390x844 passed with no horizontal overflow, 44px controls, dark/light themes, clear staging banner, safe maintenance screen and zero console errors/warnings. |
| Recovery/package privacy | PASS | Fresh/copy rehearsal, restore twice, low-space injection, package privacy scan and exact operational-baseline comparison passed. The verified package contained 10,949 allowlisted files and no private data. |
| Full regression | PASS | 15 focused tests, full TypeScript validation, 203 passing test files / 1,792 tests, production build, 333 page routes / 547 API routes, backup v41 and Git safety passed. |
| Native compatibility | DESIGN-ONLY PASS | Future native clients have an explicit compatibility contract; no binary, signing, store submission or distribution occurred. |

## QA corrections

1. Added generic dirty-form detection so update acceptance cannot reload unsaved work.
2. Required a reviewed source timestamp and proved archive reproducibility.
3. Made the ignored restart-state root the default.
4. Rejected operational `dev.db` in every release environment.
5. Enforced gates, rollback owner/deadline, active maintenance and ordered release transitions.
6. Marked migration as the data-write boundary so database restore cannot occur without explicit reconciliation approval.
7. Required production mutation authorization and an exact separately injected approval-reference match.

## Release closure

The cleared tree is retained on `release/safe-staging-client-updates`, fast-forwarded to unchanged `main`, and identified by annotated tag `release-operations-v41-2026-08-10`. Main, retained branch and tag must resolve to the same commit. The release package and restart state remain ignored/private and are not uploaded as workflow artifacts.

No public/cloud deployment is authorised. No hosting resource, provider account, payment, DNS record, operational-data upload, public exposure, real-user onboarding or native application release occurred. Actual staging deployment requires a separate provider, budget and access approval.

**Next governed phase:** `REPORT-PRINT-ACCEPT-1A` — Report-Card Template Calibration and Physical Colour/B&W Print Acceptance.
