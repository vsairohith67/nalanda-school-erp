# V1.5 and Post-RC Roadmap

- **Prompt:** `V1.5-ROADMAP-1A`
- **Reconciled:** 2026-08-21
- **Scope:** Planning and documentation only

## Authoritative baseline

- MSI is `PRIMARY_DEVELOPMENT_WORKSTATION`; Dell is `FROZEN_FALLBACK_WORKSTATION`.
- V1 RC remains frozen at commit `26a47632f7c1e9c9b5f2b48de8c9b56d60428aed` and tag `nalanda-erp-v1-rc1-v41-2026-08-14`.
- No deployment, DNS change, live-provider activation, real-data import, real-user activation, pilot, or production cutover has occurred.
- Newer verified RC and MSI-transfer evidence supersedes older pending checkpoints.

This roadmap preserves the operational boundaries in the [Requirements Register](./REQUIREMENTS_REGISTER.md), [staging inventory](./STAGING_CURRENT_RUNTIME_INVENTORY.md), [real-data onboarding checklist](./V1_REAL_DATA_ONBOARDING_CHECKLIST.md), [training and pilot plan](./V1_TRAINING_AND_PILOT_PLAN.md), and [production cutover gate](./V1_PRODUCTION_CUTOVER_GATE.md).

## One immediate product recommendation

**Recommend exactly one next product gate:**

`UNIVERSAL-SEARCH-1A — Permission-Scoped Universal Search`

The Command Center and owner-isolated Diary, Tasks & Reminders, and Contacts &
Suppliers are independently cleared. Universal Search is now the next governed
product dependency; it must remain permission-scoped, privacy-safe,
server-authorized and bounded. Smart AI remains downstream. Hosting and private
staging remain a parallel operational track.

## Governed phase order

| Order | Lane | Exact prompt name | Scope | Dependencies | Estimated effort | Before hosting possible? | Focused QA requirement | Final result expected |
|---:|---|---|---|---|---|---|---|---|
| 1 | V1 operational | `STAGE-1B — Private Synthetic Staging Decision and Deployment` | Close the provider, budget, region, private-access, backup, and DNS-subdomain decisions; then create synthetic-only HTTPS staging under separate deployment authority. | Frozen RC; MSI ready; explicit provider, budget, payment, and DNS decisions | 2–4 working days after decisions | No | Configuration review, HTTPS/security headers, private access, synthetic-only proof, smoke test, and backup/restore evidence | Approved private synthetic staging evidence, or an explicit no-go record |
| 2 | V1 operational | `STAGE-QA-1A — Independent Private Staging QA` | Independently verify the deployed RC before device or provider work. | Phase 1 deployed; exact staging revision recorded | 2–3 working days | No | Exact-SHA proof, role-focused smoke checks, log/privacy review, rollback evidence, and no-go report | Independent staging acceptance or a concrete remediation list |
| 3 | V1.5 product | `SUPER-ADMIN-COMMAND-1A — Super Admin Command Center Foundation` | Exact `SUPER_ADMIN`-only, read-only composition over existing dashboards and operational signals. | Cleared dashboard, OBS-1A, IAM, academic calendar, and existing APIs | Cleared 2026-08-21 | **Complete** | Exact role/API denial, source isolation, responsive/accessibility, p95, privacy, no-write, security scan, and full regression passed | `SUPER_ADMIN_COMMAND_CENTER_CLEARED` |
| 4 | V1.5 product | `SUPER-ADMIN-WORK-1A — Diary, Tasks, Reminders and Directory` | Exact-owner private Diary, Tasks/Reminders and publisher/vendor/contact directory in one My Work shell, with bounded Command Center summaries. | Phase 3 cleared; exact-owner/no-sharing policy accepted | Cleared 2026-08-21 | **Complete** | Exact-role/API/ownership denial, CRUD/lifecycle/date boundaries, privacy-safe audit, migration/backup proof, no-provider side effects, exact desktop/mobile/light/dark UX passed | `SUPER_ADMIN_WORK_CLEARED` |
| 5 | V1.5 product | `UNIVERSAL-SEARCH-1A — Permission-Scoped Universal Search` | Search only records the signed-in role may already open; establish the retrieval layer required before Smart AI. | Phase 4 directory/record model; existing role policy | 7–10 working days | Yes | Cross-role leakage tests, stale-index handling, result provenance, keyboard/mobile accessibility, performance budget | Permission-scoped universal search accepted for downstream retrieval |
| 6 | V1.5 evidence/product | `UDISE-15E — Evidence Collection and Governed Extension` | Collect current official evidence, map Student/Teacher/state-specific workflows, then extend the read-only checklist only after the evidence gate passes. | [15E evidence checklist](./UDISE_15E_EVIDENCE_CHECKLIST.md) complete and approved | User-dependent evidence collection; 5–10 working days after unblocking | Yes | Field-to-source traceability, state-specific validation, privacy review, read-only enforcement, human acceptance; no portal automation | Accepted evidence map and governed read-only extension, or continued evidence block |
| 7 | V2 AI | `SMART-AI-2A — Citation-Grounded Smart AI Pilot` | Extend the cleared cited, read-only mock foundation onto permission-scoped search and governed supplier/ERP sources. | Phases 4–5; approved provider/privacy/cost policy; staging | 10–15 working days | No | Citation completeness, permission inheritance, unsupported-answer refusal, prompt-injection tests, cost/rate limits, human review | Governed citation-based pilot accepted or stopped with measured evidence |
| 8 | Mobile | `ANDROID-CAPACITOR-1A — Android Foundation and Device QA` | After PWA certification, evaluate and, if approved, wrap the shared responsive application with Capacitor rather than fork the ERP. | Private HTTPS staging; PWA physical-device certification; stable shared web flows | 5–8 working days | No | Real Android device matrix, install/update/deep-link/session tests, upload/download tests, offline/error behaviour, privacy review | Android shared-code go/no-go and, if approved, certified internal foundation |
| 9 | Mobile | `IOS-IPADOS-PREP-1A — iOS/iPadOS Preparation and Signing Readiness` | Prepare Apple-specific requirements and shared-app compatibility; build/sign only when a Mac/Xcode environment and Apple decisions exist. | Phase 8 findings; Mac/Xcode; Apple account/signing decisions; staging | 5–10 working days after environment is available | No | iPhone/iPad layout, Safari/PWA behaviour, signing/entitlement review, update path, device session and file-flow tests | Apple build/signing readiness decision and device evidence |
| 10 | V1 operational | `V1-OPS-PILOT-1A — Real Data, Training, Pilot and Cutover` | Configure master data, perform controlled import, onboard named users, train, pilot, rehearse rollback, reconcile, and seek explicit production cutover approval. | Staging accepted; owners named; provider decisions complete; backups and rollback proven | 10–20 working days plus school scheduling | No | Import reconciliation, role acceptance, training records, pilot sign-off, rollback rehearsal, backup/restore evidence, cutover go/no-go | Explicit production cutover approval or documented no-go/rollback |

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
- UDISE 15E only after evidence.
- Full Payroll/ESS remains a controlled V1.5 operational deferral; its cleared technical foundation does not activate payroll or make it a V1 launch dependency.
- Event-photo gallery and governed image enhancement remain candidates, not scheduled ahead of the command/search foundations.
- Transport, Cafeteria, and KG report-card work remain deferred under the [known limitations and deferrals](./V1_KNOWN_LIMITATIONS_AND_DEFERRALS.md).

### V2 work

- Citation-grounded Smart AI over universal search and governed directories.
- AI-generated lessons and educational videos remain V2, with Teacher approval and no automatic Student publication.
- Semantic retrieval, external knowledge, attachments, live AI providers, and other advanced AI remain `DEFERRED_TO_V2`.
- An infinite-whiteboard feature is not a prerequisite. Where a visual architecture surface is useful, integrate or reuse the canonical Canvs board before considering a separate engine.

## Operational separation

Hosting/provider choice, private staging, DNS/subdomain, master-data configuration, controlled import, onboarding, training, pilot, rollback, and cutover are operational launch gates. They do not become implicitly authorised by product development, documentation approval, or a green RC. Payment and communication providers remain mock/default-off until separately selected and activated under their own acceptance gates.

## Related reconciliation documents

- [Super Admin Command Center architecture](./SUPER_ADMIN_COMMAND_CENTER_ARCHITECTURE.md)
- [Super Admin Personal Work Programme architecture](./SUPER_ADMIN_WORK_PROGRAMME_ARCHITECTURE.md)
- [Pending feature reconciliation](./PENDING_FEATURE_RECONCILIATION.md)
- [UDISE 15E evidence checklist](./UDISE_15E_EVIDENCE_CHECKLIST.md)
- [Super Admin Command Center scope](./SUPER_ADMIN_COMMAND_CENTER_SCOPE.md)
- [Mobile app roadmap](./MOBILE_APP_ROADMAP.md)
