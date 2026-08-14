# Safe Staging, Release and Client Update Strategy

**Requirement:** `V1-DEVOPS-UPDATE-001`<br>
**Decision date:** 2026-08-08<br>
**Status:** RELEASE-OPS-1A cleared locally/private; no deployment or provider activation is authorised

## Release principle

Every production change moves through a traceable feature branch, review, automated evidence, copied-database rehearsal, preview, separate staging, controlled pilot and explicit production gate. A release is reversible, monitored and understandable by web/PWA clients without risking dirty forms or in-flight requests.

## Environments and data

| Environment | Purpose | Data rule |
| --- | --- | --- |
| Local feature branch | Implementation and focused tests | Fresh synthetic/copied fixtures only; never point migration experiments at the operational database. |
| Preview | Review a specific branch/commit | Production-like synthetic fixtures; no real school records or live providers. |
| Staging | Release-candidate rehearsal | Separate secrets, database, storage and domain; production-like synthetic fixtures; no operational-data clone unless separately authorised and irreversibly de-identified. |
| Pilot/canary | Approved limited real-world validation | Named approved users, explicit window, backup/rollback and reconciliation checklist. |
| Production | Authoritative operational service | Only an approved release tag and recorded change gate. |

Preview and staging must be access-controlled and use HTTPS. Private/no-store pages and document endpoints remain outside public/service-worker caches in every environment.

## Branch-to-release flow

1. Start from synchronized `main`; use a scoped feature branch.
2. Run secret/ignore safety checks before any push.
3. Implement behind a feature flag when activation and deployment need separation.
4. Run focused tests, typecheck/build as required by change risk, security/privacy checks and documentation validation.
5. Rehearse every migration on a protected copied database and on a fresh install. Compare expected schema/data invariants and retain a byte-identical pre-rehearsal artifact.
6. Use backward-compatible expand/migrate/contract migrations. New code must tolerate the previous schema during rolling or interrupted updates; destructive contraction waits for verified adoption and a later release.
7. Deploy the exact commit to preview, then separate staging with production-like synthetic fixtures.
8. Run smoke, role-isolation, mobile/device, backup and restore-rehearsal checks. Record failures and cleanup synthetic data.
9. Create a release-candidate decision with migration plan, rollback plan, backup evidence, monitoring owner, feature-flag state and minimum-client implications.
10. Take and verify a protected production backup immediately before the approved release. Rehearse restore before the release window, not for the first time during an incident.
11. Deploy to approved pilot/canary users or tenant scope, monitor and reconcile before broad enablement.
12. When accepted, create annotated release tag and release notes from the exact commit. Never tag an unverified working tree.
13. Run production smoke and reconciliation without creating synthetic operational records unless the runbook explicitly permits and cleans them.

## Automated and manual gates

- unit, integration, concurrency/idempotency, permissions and privacy tests;
- migration fresh-install and copied-database rehearsal;
- backup creation, integrity/hash check and restore rehearsal;
- preview/staging smoke and error-free runtime log review;
- role-specific browser checks and `390x844` mobile acceptance where UI changes;
- Android phone/tablet and iPhone/iPad checks on the minimum supported OS/browser matrix;
- Chromium, Firefox and Safari/WebKit compatibility for supported versions;
- keyboard, focus, contrast, zoom and screen-reader spot checks;
- response-time/resource-budget checks for changed critical routes;
- finance, attendance, exam/publication and document reconciliation as applicable.

Do not run device/browser matrices concurrently on memory-constrained hosts. Close runtimes after each batch.

## Feature flags

Flags are server-authoritative, auditable and safe by default. A flag may separate code deployment from user exposure, restrict a pilot cohort and permit rapid disablement, but it is not a substitute for schema compatibility or rollback. Permission checks and data isolation remain active even when a UI flag is off.

## Monitoring and operational health

Monitor availability, failed requests, latency, database/migration health, job/backlog failures, notification/provider outcomes, storage capacity, backup success and client-version distribution. Logs and traces must redact credentials, recovery data, document bytes, salary values, Student data and full payment references. Alerts name an owner, severity, response time and runbook.

## Rollback

Before release, define whether rollback means feature-flag disable, application rollback, forward fix or database restore. Application rollback must remain compatible with the expanded schema. Database restore is a last-resort governed action with downtime, reconciliation and data-loss window explicitly approved. Never run an untested down migration on operational data.

## Web/PWA update discovery

1. Publish a privacy-safe version manifest containing release ID, build/commit identifier, release time, minimum supported client version, critical-update flag and release-notes link.
2. Check for updates at safe lifecycle points and with bounded backoff, not on every navigation/request.
3. Show a non-blocking **New version ready** UI when a compatible update is available.
4. Do not force refresh while a form is dirty, an upload/payment is active, a mutation is in flight or the user is in a critical print/download workflow.
5. Offer save/finish/cancel guidance and refresh only after the client reports a safe point.
6. Version service-worker caches and delete only obsolete public-static caches after activation. Never cache authenticated HTML, private/no-store API responses, payslips, report cards, payment data or recovery/auth responses.
7. A new worker may wait until the user accepts the update; do not call unconditional `skipWaiting`/reload for routine releases.
8. Record only privacy-safe adoption/compatibility metrics.

## Minimum and forced client versions

Keep an explicit compatibility contract between server API version and web/PWA/native-shell clients. The server should accept at least the immediately previous supported client during a normal rollout when safe. A minimum supported version may block an incompatible client only after the release gate confirms user communication, migration/rollback compatibility and a safe path to update.

Forced updates are reserved for approved critical security, integrity or legal cases. They require Director/Super Admin plus technical owner approval, an incident/change reference, a grace/communication decision and a safe guard against interrupting dirty forms or in-flight requests. If continued use would cause corruption or exposure, block new mutations at a safe boundary and explain how to update; do not blindly reload.

## Future native shell/API compatibility

- Version APIs and error shapes; avoid coupling business rules to the current React/PWA shell.
- Use capability negotiation and minimum-version metadata for future Android/iOS/native wrappers.
- Keep authentication, ownership, idempotency and private-document authorisation server-side.
- Preserve deep-link/update flows that do not expose private object URLs.
- Test phone/tablet safe areas, keyboards, downloads, printing/sharing boundaries and interrupted network recovery.

## Release record

Every release record must contain branch/commit/tag, change summary, migrations, feature flags, evidence links, backup hash/reference, restore rehearsal, smoke/device results, monitoring dashboard/owner, pilot outcome, known limitations, rollback decision and approval actors. Release notes contain no credentials, database contents, document bytes or personal data.

## Current disposition

The report-card V1 release-candidate gate is limited to Classes I-X. KG/LKG/UKG is an implemented but default-off V1.5 foundation and is excluded from V1 completeness. **Dated supersession — 2026-08-14:** the historical R4.2-pending statement is closed by the approved R8 digital pack and completed Classes I-X physical colour, native-monochrome and one-generation photocopy acceptance under `REPORT_PRINT_ACCEPTANCE_CLEARED`. See `docs/REPORT_CARD_PRINT_ACCEPTANCE_RELEASE_CLOSURE.md` and `docs/RELEASE_CANDIDATE_CHECKLIST.md`.

RELEASE-OPS-1A now provides local/private manifest, package, environment, flag, lock/audit, phased runner, maintenance, client-version/PWA and restricted Release Operations machinery by reusing DEVOPS/OBS foundations. Its implementation gate passed focused/full tests, typecheck, production build, migration/restore/package/failure rehearsal, route inventory, operational-integrity preservation and Git safety; it is `READY_FOR_QA`, not released. Independent Browser/accessibility and release audit, branch push, external re-fetch and governed merge/tag remain. A cloud staging environment, provider/budget decision, DNS, production pilot/cutover, real users/data and native apps remain unauthorised.
