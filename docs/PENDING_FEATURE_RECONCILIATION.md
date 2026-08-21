# Pending Feature Reconciliation

- **Prompt:** `V1.5-ROADMAP-1A`
- **Reconciled:** 2026-08-21
- **Result scope:** Post-RC planning only

## Executive result

The V1 RC remains cleared and frozen at `26a47632f7c1e9c9b5f2b48de8c9b56d60428aed`. MSI workstation transfer is complete; Dell remains a frozen fallback. No release evidence authorises deployment, live providers, real data, real users, pilot, or cutover. Remaining work divides into V1 operational launch gates, V1.5 product extensions, V2 AI, and mobile work.

The only recommended immediate product phase is `SUPER-ADMIN-COMMAND-1A — Super Admin Command Center Foundation`. Private staging proceeds as a separate operational track.

## Evidence rule

Newest verified RC and MSI-transfer evidence supersedes older pending checkpoints. Repository code and documentation were reconciled with the governing Notion pages, portable Codex handoffs, Asana project state, and the canonical Canvs ERP board. Basic Memory was unavailable and is recorded as `BASIC_MEMORY_SYNC_SKIPPED_SUBSCRIPTION_EXPIRED`.

Primary repository references include the [Requirements Register](./REQUIREMENTS_REGISTER.md), [ERP feature status and gap map](./ERP_FEATURE_STATUS_AND_GAP_MAP.md), [UDISE+ planning notes](./UDISE_PLUS_PLANNING_NOTES.md), [PWA/mobile strategy](./PWA_AND_MOBILE_APP_STRATEGY.md), and [V1 limitations and deferrals](./V1_KNOWN_LIMITATIONS_AND_DEFERRALS.md).

## Classification

| # | Work area | Classification | Evidence-based boundary and next disposition |
|---:|---|---|---|
| 1 | UDISE+ Prompt 15D and 15E | 15D: `CLEARED`; 15E: `BLOCKED_BY_EVIDENCE`; full operational support: `NOT_IMPLEMENTED` | 15D is a read-only checklist/reference foundation. 15E cannot start until current Student, Teacher, progression, Telangana, DCF, inconsistency, certification, report, register, and role evidence is supplied. No scraping, government-portal submission, or compliance claim. |
| 2 | Super Admin Command Center | `IMPLEMENTATION_READY_FOR_QA` | The exact-Super-Admin, private/no-store read-only composition is implemented without schema or provider changes. It reuses OBS-1A, IAM, immutable audit/event sources, and existing module records. Independent security, read-only, responsive, performance, and full-regression QA remains required before clearance. |
| 3 | Digital Diary | `NOT_IMPLEMENTED` | A working Notion template exists, but no proven ERP Digital Diary code was found. Treat it as part of the future Command Center product, not as a completed ERP feature. |
| 4 | Tasks, reminders and calendar | `PARTIAL` | The academic calendar/event lifecycle is cleared. General work tasks, reminders, and Life OS orchestration are not implemented as an ERP product. Combine them with Diary and Command Center scope. |
| 5 | Universal search | `NOT_IMPLEMENTED` | No proven permission-scoped universal ERP search exists. It must follow the directory/record model and precede Smart AI. |
| 6 | Publishers, book suppliers, vendors and contacts | `PARTIAL` | Vendor records and publisher-bill wrappers over vendor/expense workflows are cleared. A consolidated supplier/contact directory and broader CRM lifecycle are not proven. Supplier records must exist before AI answers supplier questions. |
| 7 | Monitoring and operational dashboard extensions | `PARTIAL` | OBS-1A and its technical/operational foundation are cleared. Hosting-dependent live monitoring, provider health, cost/usage extensions, and unified Command Center presentation remain pending. Extend the existing architecture. |
| 8 | Infinite whiteboard | `NOT_IMPLEMENTED` | No ERP whiteboard engine is proven. The canonical Canvs architecture board already provides a governed visual surface; integration/reuse should be assessed before building another engine. |
| 9 | Citation-based Smart AI | `PARTIAL`; advanced scope `DEFERRED_TO_V2` | The read-only assistant foundation validates citations/timestamps using mock data. Universal search, supplier sources, semantic retrieval, attachments, external knowledge, and live providers are not complete. |
| 10 | Android app | `NOT_IMPLEMENTED` | Responsive web/PWA foundations do not constitute a native Android app. A later shared-app Capacitor approach may be assessed only after staging and physical-device certification. |
| 11 | iOS/iPadOS app | `NOT_IMPLEMENTED` | No native Apple application is proven. Final building, signing, and device certification require a Mac/Xcode environment and Apple account decisions. |
| 12 | PWA and device certification | PWA foundation: `CLEARED`; end-to-end readiness: `PARTIAL`; physical certification: `OPERATIONAL_CONFIGURATION_PENDING` | Responsive web and the installable PWA foundation are present. Physical Android/iPhone/iPad testing waits for approved private HTTPS staging. See the [device checklist](./PWA_PHYSICAL_DEVICE_STAGING_CHECKLIST.md). |
| 13 | Event-photo gallery and image enhancement | `NOT_IMPLEMENTED`; candidate `DEFERRED_TO_V1_5` | No governed ERP gallery/enhancement implementation is proven. Any future phase requires consent, private storage, retention, moderation, human approval, and original-image preservation. |
| 14 | Direct UPI and payment gateway | `PARTIAL` | Manual/mixed payment instruments and UPI reference capture are supported, but no online checkout, callback, settlement, refund, or production gateway is proven. Provider selection and activation remain separate operational gates. |
| 15 | WhatsApp, Email and Push | `PARTIAL` | WhatsApp and SMS/email foundations remain mock/default-off; live delivery requires provider, consent, DNS/webhook, template, and sandbox evidence. Push is not implemented. See [WhatsApp](./WHATSAPP_BUSINESS_ONE_WAY_COMMUNICATION_WORKFLOW.md) and [SMS/email](./SMS_AND_EMAIL_ONE_WAY_COMMUNICATION_WORKFLOW.md). |
| 16 | Hosting, DNS and private staging | `OPERATIONAL_CONFIGURATION_PENDING` | A planning/decision package exists, but no provider purchase, cloud resource, DNS change, HTTPS staging deployment, or public exposure is authorised. |
| 17 | Real-data onboarding, training, pilot and cutover | `OPERATIONAL_CONFIGURATION_PENDING` | Plans and checklists exist; execution has not occurred. It requires accepted staging, named owners, controlled import, role onboarding, training, pilot reconciliation, rollback rehearsal, and an explicit cutover decision. |
| 18 | Transport, Cafeteria and KG report-card deferrals | `DEFERRED_TO_V1_5` | These remain outside the frozen V1 RC. KG foundation/default-off decisions are preserved; none should be activated implicitly. |

## Important dependency order

1. Compose the Super Admin Command Center from existing cleared foundations.
2. Establish the combined Diary/tasks/reminders/Life OS and directory model.
3. Build universal permission-scoped search over governed records.
4. Only then pilot citation-based Smart AI.

This order prevents AI from answering over missing supplier records or bypassing role permissions.

Diary, tasks, reminders, contacts, universal search, OBS-1A extensions, Canvs/whiteboard integration decisions, and citation-based AI are governed as one Super Admin Command Center programme. They remain separate ordered phases within that programme, not unrelated replacement applications.

## Controlled V1.5 and V2 deferrals

- KG report cards, optional Transport and Cafeteria modules, and operational rollout of the technically cleared full Payroll/ESS foundation remain `DEFERRED_TO_V1_5`.
- AI-generated lessons and educational videos remain `DEFERRED_TO_V2`, require Teacher approval, and must not publish automatically to Students.

## Superseded checkpoints

- Older notes treating Dell as the active authority are `SUPERSEDED` by the verified MSI-primary state supplied for this reconciliation.
- Older pre-RC pending or failure checkpoints are `SUPERSEDED` where the exact V1 RC commit and tag provide newer release evidence.
- These supersessions do not authorise deployment or operational activation.

## Operational controls preserved

- Operational database unchanged.
- No schema or migration change.
- No application feature implementation.
- No deployment, DNS change, provider activation, data import, user activation, pilot, or cutover.
- No UDISE scraping, automatic submission, or false compliance claim.

## Next documents

- [Super Admin Command Center architecture](./SUPER_ADMIN_COMMAND_CENTER_ARCHITECTURE.md)
- [Ordered post-RC roadmap](./V1_5_AND_POST_RC_ROADMAP.md)
- [UDISE 15E evidence checklist](./UDISE_15E_EVIDENCE_CHECKLIST.md)
- [Super Admin Command Center scope](./SUPER_ADMIN_COMMAND_CENTER_SCOPE.md)
- [Mobile app roadmap](./MOBILE_APP_ROADMAP.md)
