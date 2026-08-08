# Payroll Threat Model

Protected assets are compensation versions, payroll inputs/formulas/totals, salary history, advances, issued payslips and audit evidence. Primary threats are horizontal Staff access, Parent-context leakage, excessive role grants, predictable/public files, stale or concurrent approvals, duplicate recovery/payslip issue, post-lock mutation, formula invention, spreadsheet injection, finance side effects, PWA caching, log leakage and backup credential exposure.

Controls include server-side effective IAM, exact User-to-Staff ownership, default-denied roles, central origin/CSRF checks, critical re-authentication, bounded JSON, UUID/public references, private no-store downloads, immutable snapshots and triggers, expected-version compare-and-set, unique active runs/results/components/payslips, append-only audit, paise arithmetic, explicit version references, formula-safe exports, minimum-three aggregate suppression and a disabled finance boundary.

The copied-database suites test unlocked-input refusal, proration, leave, adjustments, advances, concurrency, stale versions, exactly-once issue, forced rollback, cross-user tampering, immutable history, double restore and operational-data isolation. Browser QA covers desktop/mobile, light/dark, keyboard/focus, 44 px actions, dialogs and console/hydration errors.

Residual risks are policy/operator error, endpoint access outside managed devices, user sharing of downloaded payslips, legal/statutory interpretation and future finance integration. Deployment, live providers, real Staff payroll and statutory filing are not authorised.
