# Pending Feature Reconciliation

- **Prompt:** `V1.5-ROADMAP-1A`
- **Reconciled:** 2026-08-21
- **Result scope:** Post-RC planning only

## Executive result

The V1 RC remains cleared and frozen at `26a47632f7c1e9c9b5f2b48de8c9b56d60428aed`. MSI workstation transfer is complete; Dell remains a frozen fallback. No release evidence authorises deployment, live providers, real data, real users, pilot, or cutover. Remaining work divides into V1 operational launch gates, V1.5 product extensions, V2 AI, and mobile work.

The read-only Command Center, exact-owner Personal Work Programme, fixed
external Canvs Whiteboard Bridge and permission-scoped Universal Search are
independently cleared. Smart AI is unlocked for a separate planning prompt
only; implementation, providers and real-data AI processing remain
unauthorized. Private staging proceeds as a separate operational track.

## Evidence rule

Newest verified RC and MSI-transfer evidence supersedes older pending checkpoints. Repository code and documentation were reconciled with the governing Notion pages, portable Codex handoffs, Asana project state, and the canonical Canvs ERP board. Basic Memory was unavailable and is recorded as `BASIC_MEMORY_SYNC_SKIPPED_SUBSCRIPTION_EXPIRED`.

Primary repository references include the [Requirements Register](./REQUIREMENTS_REGISTER.md), [ERP feature status and gap map](./ERP_FEATURE_STATUS_AND_GAP_MAP.md), [UDISE+ planning notes](./UDISE_PLUS_PLANNING_NOTES.md), [PWA/mobile strategy](./PWA_AND_MOBILE_APP_STRATEGY.md), and [V1 limitations and deferrals](./V1_KNOWN_LIMITATIONS_AND_DEFERRALS.md).

## Classification

| # | Work area | Classification | Evidence-based boundary and next disposition |
|---:|---|---|---|
| 1 | UDISE+ Prompt 15D and 15E | 15D: `CLEARED`; 15E: `BLOCKED_BY_EVIDENCE`; full operational support: `NOT_IMPLEMENTED` | 15D is a read-only checklist/reference foundation. 15E cannot start until current Student, Teacher, progression, Telangana, DCF, inconsistency, certification, report, register, and role evidence is supplied. No scraping, government-portal submission, or compliance claim. |
| 2 | Super Admin Command Center | `CLEARED` | Independent QA cleared the exact-Super-Admin, private/no-store composition. Its My Work, Universal Search launcher and fixed Whiteboard Bridge are also cleared without changing the original Command Center evidence. |
| 3 | Digital Diary | `CLEARED` | Exact-owner Diary is independently cleared inside My Work and is an included owner-scoped Universal Search source. Sharing, AI and external synchronization remain outside the release. |
| 4 | Tasks, reminders and calendar | My Work Tasks/Reminders: `CLEARED`; calendar: `CLEARED`; broader Life OS: `DEFERRED` | Exact-owner Tasks & Reminders and the existing academic calendar are cleared. Universal Search consumes bounded safe fields without completing tasks or sending reminders; no external calendar sync is claimed. |
| 5 | Universal search | `CLEARED` | Independent QA cleared the exact-`SUPER_ADMIN`, deterministic, private/no-store server composition without a migration, index table, AI or external provider. Attendance and unified Audit search remain explicitly `UNAVAILABLE`. Smart AI planning is unblocked but requires its own authorization. |
| 6 | Publishers, book suppliers, vendors and contacts | Private reference directory: `CLEARED`; broader CRM/procurement: `DEFERRED` | Exact-owner Contacts & Suppliers is cleared and searchable through bounded safe fields. It remains a reference directory, not procurement/payment automation. |
| 7 | Monitoring and operational dashboard extensions | `PARTIAL` | OBS-1A and its technical/operational foundation are cleared. Hosting-dependent live monitoring, provider health, cost/usage extensions, and unified Command Center presentation remain pending. Extend the existing architecture. |
| 8 | Whiteboard | Bridge: `CLEARED`; ERP engine: `NOT_IMPLEMENTED` | `WHITEBOARD-BRIDGE-1A-QA` independently proved that only the exact Super Admin route can launch the canonical Canvs board. It has no iframe, token exchange, server fetch, sync, board persistence, Search/AI integration or open redirect. Canvs remains the editing engine. |
| 9 | Citation-based Smart AI | `NEXT_FOR_SEPARATE_PLANNING`; advanced scope `DEFERRED_TO_V2` | The read-only assistant foundation validates citations/timestamps using mock data, and Universal Search now supplies a cleared permission-filtered retrieval boundary. No AI implementation, semantic retrieval, attachment ingestion, external knowledge or live provider is authorized. |
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
3. Preserve the independently cleared fixed Canvs Whiteboard Bridge and permission-scoped Universal Search.
4. Use a separate prompt to plan citation-based Smart AI; never bypass Search authorization.

This order prevents AI from answering over missing supplier records or bypassing role permissions.

Diary, tasks, reminders, contacts, universal search, OBS-1A extensions, Canvs/whiteboard integration decisions, and citation-based AI are governed as one Super Admin Command Center programme. They remain separate ordered phases within that programme, not unrelated replacement applications.

## Controlled V1.5 and V2 deferrals

- KG report cards, optional Transport and Cafeteria modules, and operational rollout of the technically cleared full Payroll/ESS foundation remain `DEFERRED_TO_V1_5`.
- AI-generated lessons and educational videos remain `DEFERRED_TO_V2`, require Teacher approval, and must not publish automatically to Students.

## UNIVERSAL-SEARCH-1A clearance update (2026-08-22)

The implementation, precise source/deferred-source contract and independent
evidence are documented in [Universal Search Architecture](./UNIVERSAL_SEARCH_ARCHITECTURE.md)
and the [QA clearance](./evidence/UNIVERSAL_SEARCH_1A_QA_CLEARANCE.md). Search is
cleared for this private/local release. This does not authorize deployment,
real-data indexing/import, providers or Smart AI implementation.

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
