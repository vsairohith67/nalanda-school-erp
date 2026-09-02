# Real-Data Onboarding Current-State Audit

Audit base: `origin/main` at task start, `2f13ce8f94db746a10463f6bac58230b3a3f42f8`. This audit is source/synthetic evidence only and does not inspect operational data.

| Capability | Classification | Evidence and boundary |
|---|---|---|
| Governed Student/Guardian/Staff onboarding | `IMPLEMENTED_AND_CLEARED` | `lib/onboarding*`, `/onboarding`, private storage, service permissions, plan hash, approval, execute, reconciliation, lineage and rollback. Current mode is `CREATE_AND_LINK`; no silent update. |
| XLSX template generation and hardened parser | `IMPLEMENTED_AND_CLEARED` | 10 MiB upload, 160 ZIP entries, 64 MiB expansion, 14 sheets, 5,000 rows/sheet, 64 columns, 4,000 chars/cell; refuses macros, external content, hidden sheets and formulas. |
| Existing IMPORT-1A copied-DB QA | `IMPLEMENTED_AND_CLEARED` | `qa:import1a`, focused onboarding tests, browser fixture support and backup/restore metadata. Synthetic/copied database only. |
| Student CSV import | `IMPLEMENTED_BUT_NARROW` | Existing route/service handles its approved Student format, not a provenance-governed multi-source package. |
| Guardian and Staff XLSX import | `IMPLEMENTED_BUT_NARROW` | Governed IMPORT-1A coverage; source authority and external package custody decisions precede it. |
| Payment CSV import | `IMPLEMENTED_BUT_NARROW` | Existing payment import does not constitute opening-position or legacy-ledger migration; unexplained balances remain prohibited. |
| Marks and Library import surfaces | `IMPLEMENTED_BUT_NARROW` | Domain-specific protected workflows; neither is a generic legacy history importer. |
| Duplicate handling | `IMPLEMENTED_AND_CLEARED` | Existing onboarding requires explicit link/skip/reject decisions. New preparation reports add cross-package candidate evidence without automatic merges. |
| Import batches and rollback | `IMPLEMENTED_AND_CLEARED` | Existing runtime batch, lineage, idempotency and dependency-aware rollback. Preparation phase defines future cross-domain batch/rollback contracts without creating runtime rows. |
| `real-data-imports` feature flag | `IMPLEMENTED_AND_CLEARED` | Server-side fail-closed, production default OFF and 0% rollout. This phase does not change or activate it. |
| Schoolknot export requirements | `DOCUMENTATION_ONLY` | Existing vendor-neutral export/data-dictionary requirements; no export requested or received. |
| Real-data precheck and V1 checklist | `DOCUMENTATION_ONLY` | Entry gates exist but do not provide source inventory, package manifests or tooling. |
| Synthetic Pilot and PostgreSQL readiness | `IMPLEMENTED_FOR_SYNTHETIC_ONLY` | Software/provider compatibility evidence; no real source, private staging or operational activation. |
| Generic source inventory and authority catalogue | `MISSING` at base, implemented here | Schema and empty template now record custody, scope, authority, privacy, retention and wave eligibility. |
| Original-byte/working-copy package manifest | `MISSING` at base, implemented here | Deterministic manifest, per-file hashes, package digest and immutable-source rule. |
| Generic bounded CSV/XLSX offline inspector | `PARTIAL` at base, implemented here | Reuses XLSX container protections and adds declared encoding, delimiter/header, generic table and report bounds. |
| Cross-domain service-level mapping catalogue | `MISSING` at base, implemented here | 89 entries across nine domain groups; no arbitrary database-column mapping. |
| Opening-position and legacy finance reconciliation | `DOCUMENTATION_ONLY` at base, designed here | Integer-paise control totals and explicit difference states; no payment fabrication. |
| Academic history migration | `MISSING` at base, planned here | Structured-source classifications and no PDF/screenshot reconstruction. |
| Document/photo migration | `MISSING` at base, inventory-only here | No file ingestion or OCR; storage/consent/retention remain gates. |
| Real-data schema/runtime import model | `MISSING` and intentionally not added | No Prisma change is required for preparation. A future durable model requires a separate schema-authorised task. |

## Reuse decision

No duplicate operational importer was built. The new CLI stops at preparation reports and is deliberately unable to execute authoritative writes. Future Student/Guardian/Staff execution should adapt an approved package into the cleared IMPORT-1A service contract. Finance, academic history and documents require their own approved domain workflows before execution.

## Superseded understanding

Any statement that an existing CSV/XLSX endpoint alone makes the school ready for real migration is `SUPERSEDED`. Software clearance, source readiness, private staging, privacy/legal approval, real import, real-user activation and production cutover are distinct gates.
