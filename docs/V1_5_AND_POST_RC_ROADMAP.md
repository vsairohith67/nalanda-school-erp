# V1.5 and Post-RC Roadmap

## Active provider-independent operational gate — 28 August 2026

`SYNTHETIC-PILOT-READINESS-1A` rehearses existing software with unmistakably synthetic data, derived roles, operator runbooks, failure/security/backup drills and separate-dimensional launch gates. It may proceed without a provider or physical biometric hardware and must not touch the independent biometric implementation. It authorizes no private staging, real-data import, real-user activation, optional-feature production rollout, native signing/distribution, OCR or cutover. After a terminal synthetic verdict, the next prompts remain separately gated: `OCR-BENCHMARK-1A`, `REAL-DATA-ONBOARDING-1A`, `SUPERVISED-PILOT-1A` and the existing private-staging provider adapter.

Portable staging is the software prerequisite for an owner-approved provider adapter. Generated next phases are `PRIVATE-STAGING-1B-PROVIDER-ADAPTER` and synthetic-only `SYNTHETIC-PILOT-READINESS-1A`; neither is executed here.

- **Prompt:** `V1.5-ROADMAP-1A`
- **Reconciled:** 2026-08-21
- **Scope:** Planning and documentation only

## Authoritative baseline

- MSI is `PRIMARY_DEVELOPMENT_WORKSTATION`; Dell is `FROZEN_FALLBACK_WORKSTATION`.
- V1 RC remains frozen at commit `26a47632f7c1e9c9b5f2b48de8c9b56d60428aed` and tag `nalanda-erp-v1-rc1-v41-2026-08-14`.
- No deployment, DNS change, live-provider activation, real-data import, real-user activation, pilot, or production cutover has occurred.
- Newer verified RC and MSI-transfer evidence supersedes older pending checkpoints.

This roadmap preserves the operational boundaries in the [Requirements Register](./REQUIREMENTS_REGISTER.md), [staging inventory](./STAGING_CURRENT_RUNTIME_INVENTORY.md), [real-data onboarding checklist](./V1_REAL_DATA_ONBOARDING_CHECKLIST.md), [training and pilot plan](./V1_TRAINING_AND_PILOT_PLAN.md), and [production cutover gate](./V1_PRODUCTION_CUTOVER_GATE.md).

## v1.1 academic-integrity intervention

`ACADEMIC-INTEGRITY-1A` is a management-directed prospective security correction on a separate release line: **Nalanda ERP v1.1 — Academic Integrity Release**. The ordinary Teacher marks-write policy is `SUPERSEDED_BY_ACADEMIC_INTEGRITY_V1_1`; the frozen V1 RC1 commit/tag and historical evidence remain unchanged. Principal/Super Admin direct entry and exact non-teaching `MARKS_ENTRY_OPERATOR` delegation reuse current IAM. Independent `ACADEMIC-INTEGRITY-1A-QA` cleared the release on 2026-08-21. At QA start Super Admin Work was still parallel; after its own clearance advanced `main`, Academic Integrity was minimally reconciled on top and all affected/full gates were rerun. This clearance does not authorise deployment. With both programmes cleared, `UNIVERSAL-SEARCH-1A` may precede Smart AI.

## Current governed product gate

**Latest cleared product gate:**

`FINAL-SCOPE-QA-1A — Final Corrected-Scope Acceptance`

The Command Center, owner-isolated Diary, Tasks & Reminders, Contacts &
Suppliers, permission-scoped Universal Search, and Smart AI foundation are independently cleared.
Search remains exact-`SUPER_ADMIN`, privacy-safe, server-authorized,
deterministic and bounded. SMART-AI-1A is the independently cleared implementation
of an exact-role, cited synthesis foundation over Search, and its separately
cleared local runtime accepts only loopback endpoints. The committed provider
remains `DISABLED`; the release does not authorize real-data activation, external
transmission or AI actions. Optional Transport and Cafeteria foundations are
independently cleared and remain default-off. They do not activate school services,
real data, finance, GPS/maps or providers.
Hosting and private staging remain a parallel operational track.

`SEARCH-EXTENSION-1B` is the governed Search/Smart AI metadata integration for
Parent Meetings, Transport, Cafeteria, KG Report Cards and Event Media. It uses
only the existing Universal Search contract; all five source dependencies remain
default-off, and no direct Smart AI query, write action or image AI is added.

`WHITEBOARD-BRIDGE-1A` is a parallel, database-neutral integration checkpoint.
Its implementation launches only the canonical Nalanda ERP Canvs board from an
exact-Super-Admin route and was independently QA-cleared on 2026-08-22. It does
not change the ten-phase order below, add a whiteboard engine, participate in
Search, or unlock Smart AI.

## Governed phase order

| Order | Lane | Exact prompt name | Scope | Dependencies | Estimated effort | Before hosting possible? | Focused QA requirement | Final result expected |
|---:|---|---|---|---|---|---|---|---|
| 1 | V1 operational | `STAGE-1B — Private Synthetic Staging Decision and Deployment` | Close the provider, budget, region, private-access, backup, and DNS-subdomain decisions; then create synthetic-only HTTPS staging under separate deployment authority. | Frozen RC; MSI ready; explicit provider, budget, payment, and DNS decisions | 2–4 working days after decisions | No | Configuration review, HTTPS/security headers, private access, synthetic-only proof, smoke test, and backup/restore evidence | Approved private synthetic staging evidence, or an explicit no-go record |
| 2 | V1 operational | `STAGE-QA-1A — Independent Private Staging QA` | Independently verify the deployed RC before device or provider work. | Phase 1 deployed; exact staging revision recorded | 2–3 working days | No | Exact-SHA proof, role-focused smoke checks, log/privacy review, rollback evidence, and no-go report | Independent staging acceptance or a concrete remediation list |
| 3 | V1.5 product | `SUPER-ADMIN-COMMAND-1A — Super Admin Command Center Foundation` | Exact `SUPER_ADMIN`-only, read-only composition over existing dashboards and operational signals. | Cleared dashboard, OBS-1A, IAM, academic calendar, and existing APIs | Cleared 2026-08-21 | **Complete** | Exact role/API denial, source isolation, responsive/accessibility, p95, privacy, no-write, security scan, and full regression passed | `SUPER_ADMIN_COMMAND_CENTER_CLEARED` |
| 4 | V1.5 product | `SUPER-ADMIN-WORK-1A — Diary, Tasks, Reminders and Directory` | Exact-owner private Diary, Tasks/Reminders and publisher/vendor/contact directory in one My Work shell, with bounded Command Center summaries. | Phase 3 cleared; exact-owner/no-sharing policy accepted | Cleared 2026-08-21 | **Complete** | Exact-role/API/ownership denial, CRUD/lifecycle/date boundaries, privacy-safe audit, migration/backup proof, no-provider side effects, exact desktop/mobile/light/dark UX passed | `SUPER_ADMIN_WORK_CLEARED` |
| 5 | V1.5 product | `UNIVERSAL-SEARCH-1A — Permission-Scoped Universal Search` | Exact-`SUPER_ADMIN` deterministic search over normalized, privacy-safe authorised records; establishes the retrieval boundary required before Smart AI. | Phase 4 cleared; Academic Integrity v1.1 preserved | Cleared 2026-08-22 | **Complete** | Exact-role/API/active-context/owner/privacy/ranking/failure/scale/Browser/security/full-suite acceptance passed | `UNIVERSAL_SEARCH_CLEARED`; private/local only; no deployment or AI authorization |
| 5A | V1.5 product | `SEARCH-EXTENSION-1B — Governed Search Source Expansion` | Add five `SAFE_METADATA_ONLY`, flag-gated module adapters and let Smart AI inherit them through Search only. | Universal Search, Smart AI and all five source modules software-cleared | Released 2026-08-24; corrective exact-head revalidation recorded in its clearance evidence | **Complete** | Registry, field projection, default-off, privacy sentinel, no-write, scale, Browser, security and exact-head release gates | `SEARCH_EXTENSION_1B_CLEARED`; no operational activation |
| 6 | V1.5 evidence/product | `UDISE-15E — Evidence Collection and Governed Extension` | Collect current official evidence, map Student/Teacher/state-specific workflows, then extend the read-only checklist only after the evidence gate passes. | [15E evidence checklist](./UDISE_15E_EVIDENCE_CHECKLIST.md) complete and approved | User-dependent evidence collection; 5–10 working days after unblocking | Yes | Field-to-source traceability, state-specific validation, privacy review, read-only enforcement, human acceptance; no portal automation | Accepted evidence map and governed read-only extension, or continued evidence block |
| 7 | V1.5 product | `SMART-AI-1A — Grounded Super Admin Smart AI Foundation` | Exact-Super-Admin read-only synthesis over Universal Search with validated citations, disabled-by-default runtime and loopback-only provider foundation. | Phases 4–5 cleared; Academic Integrity and Whiteboard boundaries preserved | Cleared 2026-08-22 | **Complete** | Exact role/owner/secret/no-write boundaries, prompt injection, citations, loopback validation, Browser/security/full-suite acceptance passed | `SMART_AI_CLEARED`; no runtime activation |
| 8 | V1.5 product | `PARENT-MEETING-V1_5-1A — Parent Meetings, Appointments and Follow-up` | Linked-child requests, governed leadership scheduling, explicit-Teacher participation, separate private/released notes and local follow-up. | Smart AI Local Runtime main reconciled; Academic Integrity preserved | Cleared 2026-08-24 | **Complete** | Exact role/IDOR/privacy/workflow/concurrency, controlled Browser matrix, additive migration/restore, security diff, full regression and operational-hash gates passed | `PARENT_MEETING_V1_5_CLEARED`; operational flag remains default-off; safe Search/AI metadata integration is separately governed by `SEARCH-EXTENSION-1B` |
| 9 | Mobile | `ANDROID-CAPACITOR-1A — Android Foundation and Device QA` | After PWA certification, evaluate and, if approved, wrap the shared responsive application with Capacitor rather than fork the ERP. | Private HTTPS staging; PWA physical-device certification; stable shared web flows | 5–8 working days | No | Real Android device matrix, install/update/deep-link/session tests, upload/download tests, offline/error behaviour, privacy review | Android shared-code go/no-go and, if approved, certified internal foundation |
| 10 | Mobile | `IOS-IPADOS-PREP-1A — iOS/iPadOS Preparation and Signing Readiness` | Prepare Apple-specific requirements and shared-app compatibility; build/sign only when a Mac/Xcode environment and Apple decisions exist. | Phase 9 findings; Mac/Xcode; Apple account/signing decisions; staging | 5–10 working days after environment is available | No | iPhone/iPad layout, Safari/PWA behaviour, signing/entitlement review, update path, device session and file-flow tests | Apple build/signing readiness decision and device evidence |
| 11 | V1 operational | `V1-OPS-PILOT-1A — Real Data, Training, Pilot and Cutover` | Configure master data, perform controlled import, onboard named users, train, pilot, rehearse rollback, reconcile, and seek explicit production cutover approval. | Staging accepted; owners named; provider decisions complete; backups and rollback proven | 10–20 working days plus school scheduling | No | Import reconciliation, role acceptance, training records, pilot sign-off, rollback rehearsal, backup/restore evidence, cutover go/no-go | Explicit production cutover approval or documented no-go/rollback |

## Lane boundaries

### May proceed before hosting

- `SUPER-ADMIN-COMMAND-1A` with synthetic data and existing read-only APIs.
- Later V1.5 product design and local synthetic work for diary/tasks/directory and universal search, in phase order.
- UDISE 15E evidence collection only; implementation remains blocked until the checklist is complete.
- Hosting/provider/budget/DNS decision closure, without purchasing or deploying anything absent separate authority.

### Must wait for private HTTPS staging

- Independent staging QA and physical-device certification.
- Live-like provider sandbox validation, Android/Capacitor device QA, and iOS/iPadOS signing work.
- Real-data onboarding, named-user activation, training, pilot, rollback rehearsal, and cutover.

### V1.5 product work

- Super Admin Command Center foundation.
- One integrated diary/tasks/reminders/Life OS and publisher/vendor/contact directory product.
- Universal permission-scoped search.
- Parent Meetings, Appointments and Follow-up is implemented as default-off local/private software under `PARENT-MEETING-V1_5-1A`; its Search/Smart AI safe-metadata integration is separately governed by `SEARCH-EXTENSION-1B`, while operational activation remains a separate gate.
- UDISE 15E only after evidence.
- Full Payroll/ESS remains a controlled V1.5 operational deferral; its cleared technical foundation does not activate payroll or make it a V1 launch dependency.
- Event Media software is cleared with public publishing default-off; opaque safe-metadata retrieval is governed by `SEARCH-EXTENSION-1B`, while image/OCR/face AI remains deferred.
- Transport, Cafeteria and KG report-card software foundations are cleared and default-off. Real-school activation, live-data onboarding, deployment and physical/operational acceptance remain governed deferrals under the [known limitations and deferrals](./V1_KNOWN_LIMITATIONS_AND_DEFERRALS.md).

### V2 work

- `SMART-AI-LOCAL-RUNTIME-1A` is software-cleared with the committed provider default `DISABLED`; any operational activation still requires separate approval. Cloud/external providers remain prohibited absent a separate privacy decision.
- Future role expansion and any AI Actions require separate authorization, object-scope, confirmation, audit and rollback governance.
- AI-generated lessons and educational videos remain V2, with Teacher approval and no automatic Student publication.
- Semantic retrieval, external knowledge, attachments, live AI providers, and other advanced AI remain `DEFERRED_TO_V2`.
- An infinite-whiteboard feature is not a prerequisite. Where a visual architecture surface is useful, integrate or reuse the canonical Canvs board before considering a separate engine.

## Operational separation

Hosting/provider choice, private staging, DNS/subdomain, master-data configuration, controlled import, onboarding, training, pilot, rollback, and cutover are operational launch gates. They do not become implicitly authorised by product development, documentation approval, or a green RC. Payment and communication providers remain mock/default-off until separately selected and activated under their own acceptance gates.

## Corrected-scope acceptance gate (2026-08-24)

`FINAL-SCOPE-QA-1A` is cleared on current `main` at annotated tag
`corrected-scope-qa-v43-2026-08-24`. Server-side runtime enforcement and the
bulk-export surface map were corrected and the exact-head acceptance passed.
This remains software acceptance only: no deployment, provider, real-data or
operational feature activation is authorised.

## OFFLINE-SYNC-1A default-off software foundation

Encrypted Accountant-only finance drafts and device-bound synchronization are implemented on a dedicated release branch. The capability is not an operational roadmap commitment: its flag is false at zero rollout. Production activation remains a separate high-risk gate requiring managed-device policy, training, monitoring, distributed abuse controls, support ownership and a narrow approved cohort.

## CROSS-PLATFORM-APPS-1A default-off software foundation

The Tauri 2 Windows, Android, and iOS foundation reuses the online ERP, server authorization, device registry, and Offline Sync 1A protocol. It adds a privileged bundled shell, an unprivileged exact-origin online surface, device-bound native authorization, Stronghold-backed key/token storage, ciphertext-only SQLite, app lock, conflict/status UX, and unsigned private CI packages. Both release flags remain OFF at 0%; no staging, real device, signing, store publication, real-data onboarding, or deployment is implied.

The exact governed sequence is `POSTGRES-READINESS-1A`, then `PRIVATE-STAGING-1B`, then `CROSS-PLATFORM-APPS-1B`. Signing/store phases remain separate by platform.

## POSTGRES-READINESS-1A provider-dual foundation

The software now has an explicit SQLite-default and PostgreSQL 17 build contract, separate provider migration histories, deterministic model/trigger parity, provider-safe runtime health/backup paths, synthetic backup-v44 transfer, database roles, race/recovery QA, and a four-job exact-head CI design. This phase is software readiness only. `PRIVATE-STAGING-1B-R1` remains the separate provisioning/deployment gate, and real-data migration remains unauthorized.

## Related reconciliation documents

- [Super Admin Command Center architecture](./SUPER_ADMIN_COMMAND_CENTER_ARCHITECTURE.md)
- [Super Admin Personal Work Programme architecture](./SUPER_ADMIN_WORK_PROGRAMME_ARCHITECTURE.md)
- [Super Admin Whiteboard Bridge](./SUPER_ADMIN_WHITEBOARD_BRIDGE.md)
- [Pending feature reconciliation](./PENDING_FEATURE_RECONCILIATION.md)
- [UDISE 15E evidence checklist](./UDISE_15E_EVIDENCE_CHECKLIST.md)
- [Super Admin Command Center scope](./SUPER_ADMIN_COMMAND_CENTER_SCOPE.md)
- [Mobile app roadmap](./MOBILE_APP_ROADMAP.md)
