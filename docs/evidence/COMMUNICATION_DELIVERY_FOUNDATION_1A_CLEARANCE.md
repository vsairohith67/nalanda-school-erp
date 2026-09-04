# Communication Delivery Foundation 1A — Clearance Evidence

Release status is valid only when the pull request, exact-head CI and annotated tag identified by the release record are green and point to the retained `feature/communication-delivery-foundation-1a` history. This document is the repository contract; GitHub remains the canonical source for the final immutable SHA/run identifiers.

## Scope proved

- Additive provider-neutral intent, recipient policy, consent/preference, immutable multilingual templates, durable outbox, attempts, receipts, webhook replay ledger, native-push boundary and privacy-safe audit models.
- Parent plus IN_APP/EMAIL/SMS/WHATSAPP/NATIVE_PUSH flags committed OFF at 0%.
- Reconciled Prompt 19B WhatsApp and source-proven 19C SMS/Email implementations without rewriting their history.
- Network-incapable deterministic local sink and disabled live adapters.
- Own-account notification/preference UI and aggregate role-governed operations UI.
- SQLite/PostgreSQL 17 schema/migration parity and logical backup version 45 with v44 compatibility.

## Mandatory evidence

The focused suite covers catalogues, policy, action-link and template injection, source-authority/template classification, current-contact consent, content minimisation, recipient deduplication, role denial, feature gates, synthetic destination enforcement, idempotent sink behavior, signed/tampered/replayed/profile-scoped webhooks, compare-and-set monotonic state, fail-closed public scanning, mapped restore and backup exclusions. Copied-DB QA covers fresh/copy/repeat migrations, 1,000 in-app notifications, 1,000 external items, 800-subject resolution, two workers, priority, timeout, 429/dead-letter, provider disabled, expiry, signed receipt, duplicate receipt, backup/restore twice, restored in-flight manual review, six append-only database trigger probes and byte-identical operational database. Independent review covers platform engineering, identity security, privacy, School administration and accessibility.

The exact-head workflow additionally runs typecheck, production build, full tests, focused and copied-DB QA, PostgreSQL 17 migration/repeat/parity, cross-platform tests, Real-User Access and corrected-scope invariant regression, dependency audit, secret/public-repository scans and cleanup. Any skipped environmental check is reported as a gate, never as a pass.

## Local pre-release checkpoint

- Focused communication/security/backup tests: 44 passed.
- Copied-database QA: fresh, copied-upgrade, repeat-deploy and restore-target migrations passed; 1,000 in-app notifications, 1,000 outbound deliveries and an 800-subject audience completed with two workers, zero duplicate sends, no priority starvation and zero network calls.
- Measured post-remediation copied-database performance: audience resolution 914 ms; 100-item worker-batch p50 6,346 ms and p95 6,441 ms; peak RSS 295 MiB.
- Failure recovery: retryable provider timeout, terminal 429 dead letter, disabled-provider permanent failure, expiry, signed delivery receipt, duplicate-webhook suppression, restored in-flight manual review, and six append-only evidence trigger denials all reached their expected states.
- Full ERP regression: 244 test files passed and one qpdf-only file intentionally skipped; 2,273 tests passed and three qpdf tests were skipped. The worktree-only Super Admin recovery prerequisite was reproduced with CI-equivalent synthetic preparation and all 13 recovery tests passed; no operational database was copied. The corrected-scope acceptance regression passed inside the full run.
- TypeScript partitioned typecheck, production build, routes (363 pages and 641 API routes), lifecycle dry run, backup v45, Git safety, dependency audit, Security Resilience, Synthetic Pilot, Real-Data Onboarding Preparation, Product Experience and cross-platform suites passed.
- Windows/native shell: Web build passed; Rust/Tauri had seven tests pass. Android/iOS shared-domain and authentication contracts passed; no physical device or store-distribution certification was attempted.
- Browser matrix: all ten synthetic roles were exercised at 1366x768 and 390x844 in light and dark themes. Operations were allowed only for Super Admin, Director and Principal; seven other/denied roles were redirected to `/unauthorized`. No overflow, sub-44 px important control or contact leak was found. A native `details` hydration mismatch found during QA was fixed and a fresh navigation returned zero console errors.
- Independent review: five perspectives, 14 checks, zero Critical, zero High and zero authorisation/privacy/communication-integrity Medium findings.
- Deep immutable security diff scan `f8d58573-9a2d-4c2c-86c7-5dbb2b0b38d8` reviewed all 56 authoritative items. Its seven pre-remediation findings were addressed through fail-closed content scanning; identity-mapped/create-or-skip restore; database evidence immutability; 64 KiB/rate-limited webhooks; in-flight restore normalisation; canonical backup versions; and communication-gated legacy network health. The five activation-gated candidates were also closed in the foundation with source authority, template classification, profile/channel correlation, compare-and-set receipt transitions, and current-contact-version consent binding.
- Public-repository scan: 154 changed files, zero binary artifacts, candidate secrets, real contacts or raw sink archives. A synthetic unreviewed-extension bypass fixture was rejected. Dependency audit reported no known vulnerabilities.
- Backup/restore: version 45, 298 arrays in the full logical contract, 13 communication arrays, repeat restore passed and restored provider profiles remained disabled. Version 44 remains accepted for backward compatibility.
- Operational SQLite database: SHA-256 `65F47EFA37DA321023439303770645F8D656F2BE58458C1A03B341408EF9A6FA`, size 8,409,088 bytes, mtime `2026-08-10T10:55:19.890Z`, no WAL/SHM/journal sidecars before or after QA; byte-identical.

This checkpoint is local evidence only. It does not become release clearance until the exact feature SHA passes the GitHub jobs, merges normally, and the annotated tag is verified. The corrected-scope evidence generator intentionally rejects any product-scope expansion relative to `origin/main`; this feature therefore runs its invariant regression test, while this release-specific exact-head workflow owns the new route/schema/config/backup scope.

## Release boundary

No provider was selected or called. No DNS, sender/template registration, billing, commercial pricing, credential, real contact, real message, real user, private staging, deployment, FCM/APNs permission/device certification or OCR integration is included. OCR PR #19 remains open and separate. Telugu/Hindi copy is draft pending language review. Formal consent/retention policy remains pending.

Expected annotated tag: `communication-delivery-foundation-v45-2026-09-04` (or a safe same-date suffix). A green software release does not activate any channel.
