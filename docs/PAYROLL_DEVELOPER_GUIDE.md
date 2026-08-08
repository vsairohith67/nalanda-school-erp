# Payroll Developer Guide

The schema and migration define 13 additive payroll entities. `lib/payroll-calculation.ts` is the pure paise-based engine; `lib/payroll.ts` owns validation, transactions, compare-and-set lifecycle, self-scope and reporting; `lib/payroll-api.ts` enforces effective IAM and safe responses; `lib/payroll-pdf.ts` renders immutable snapshots; `lib/payroll-backup.ts` supplies bounded backup/restore order and validation.

Mutation APIs are POST-only and protected by the central origin/CSRF middleware. Critical structure, assignment, revision, approval, lock, reversal and advance actions call the existing re-authentication control. Do not log request bodies or Staff references. Keep batches bounded (40 components, 100 adjustments, 48 recovery rows) and responses private/no-store.

Run sequentially: `pnpm qa:23i`, focused payroll tests, `pnpm typecheck`, `pnpm test`, `pnpm routes:list`, `pnpm lifecycle:backfill`, 4 GB-capped `pnpm build`, `pnpm backup`, migration backup/restore and `pnpm git:safety-check`. Independent QA uses `pnpm qa:23iqa` and fresh `PAY23IQA` fixtures.

Never reuse the operational database for migration, fixture or browser QA. A future finance-posting feature must remain separate until every invariant in `PAYROLL_FINANCE_POSTING_BOUNDARY.md` is proven. A future statutory rule requires qualified payroll/legal approval and a new versioned executable-rule design.
