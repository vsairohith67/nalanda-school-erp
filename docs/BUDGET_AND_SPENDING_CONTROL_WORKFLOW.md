# Budget and Department Spending Control Workflow

Prompt 16B adds annual budget plans, category/department allocations, approval and lock controls, preserved revisions, budget-versus-expense reporting, threshold warnings, and CSV export. It does not add a cash book, income, payroll, purchase orders, inventory, bank reconciliation, GST filing, payment gateways, or AI recommendations. Student fee `Payment` records are never used in budget calculations.

## Models and authoritative total

- `BudgetPlan` is the annual plan. Statuses are DRAFT, PENDING_APPROVAL, APPROVED, LOCKED, REJECTED, and CANCELLED.
- `BudgetAllocation` links a positive Decimal amount to a category, a department, or both. A normalized `allocationKey` prevents duplicate combinations even when one link is absent.
- `BudgetRevision` stores an immutable JSON before/after allocation snapshot, reason, prior/revised totals, actor links, and approval status.
- `BudgetPlan.totalAllocatedAmount` is calculated from allocations. The UI shows the calculated total and the server recalculates it; operators do not enter an independent trusted total.
- Only one APPROVED or LOCKED official plan is permitted per academic year. The migration adds a partial SQLite unique index and approval checks the rule transactionally.

## Workflow

1. DRAFT is editable. Add category-only, department-only, or combined allocations, preview, then save or submit.
2. PENDING_APPROVAL is immutable. An approver may approve or reject it. Rejection requires a reason.
3. APPROVED is the official reporting plan. It cannot be silently edited and may be locked separately.
4. LOCKED has no normal unlock. It remains authoritative and can change only through an approved revision.
5. REJECTED and CANCELLED are preserved. Cancellation requires a reason; locked plans cannot be cancelled through the normal workflow.
6. A revision starts as a preserved draft snapshot, is submitted separately, and needs approval. Approval transactionally replaces current allocations while retaining the complete prior and revised figures in `BudgetRevision`.

All transitions use server-side permissions, guarded current-status updates, and transactions. Repeated or concurrent actions fail with a refresh message. Approved or locked plans are never deleted.

## Spending formulas

Only `ExpenseRecord` rows with `approvalStatus = APPROVED` and the same academic year count. Draft, pending, rejected, and cancelled expense records are excluded. Paid actual comes only from the plan-year expense's `ExpensePayment` rows.

- Paid actual = sum of valid expense-payment rows, capped at the expense net amount.
- Committed = approved expense net amount minus paid actual.
- Utilized = paid actual + committed (therefore the approved net amount).
- Available = allocated minus utilized.
- Utilization percentage = utilized / allocated x 100; zero allocation returns no percentage.
- Over-budget amount = max(utilized minus allocated, zero).

Allocation matching is deterministic to prevent double counting: category+department first, then category-only, then department-only. Each approved expense is assigned to at most one allocation. Approved expenses that match no allocation remain included in plan totals and appear as unmatched/unallocated utilized amount.

## Thresholds

Plan defaults are warning 80% and critical 100%. An allocation may override both. Values must be whole numbers from 1 through 1000 and warning cannot exceed critical.

- NORMAL: below warning.
- WARNING: at or above warning.
- CRITICAL: at or above critical.
- Available below zero is shown separately as an over-budget condition.

Thresholds only warn. They never block an expense and do not alter the expense approval/payment workflow.

## Permissions and conservative defaults

| Role | Default budget access |
|---|---|
| Super Admin, Director | View, manage drafts, approve/reject, lock, revise, reports, export |
| Admin | View, manage drafts, reports, export; no approve, lock, or revise |
| Principal | View plans and reports only |
| Accountant | View, manage drafts, reports, export; no approve, lock, or revise |
| Viewer/Auditor | View plans and reports only; no write or export |
| Teacher, Parent | No access |

Every page and API checks its permission server-side. User-facing payloads show actor names, not raw actor IDs, and never include revision snapshot internals, password hashes, secrets, or filesystem paths.

## Pages and reports

- `/budgets`: plan filters, official-budget summary, warning counts, and permission-aware create action.
- `/budgets/new`: allocation builder, calculated total, preview, draft save, and submission.
- `/budgets/[id]`: plan/audit details, allocation versus committed/paid/available, workflow confirmations, and revision history.
- `/budgets/reports`: academic-year/official-plan summary, category, department, combined allocation, under-budget, warning, and over-budget views.
- CSV uses allowlisted columns and neutralizes spreadsheet formulas. Export needs `EXPORT_BUDGET_REPORTS`.
- The dashboard shows current-year allocated, utilized, threshold, and pending-approval summaries only for roles with `VIEW_BUDGETS`.

## Backup and restore

Backup version 16 includes `BudgetPlan`, `BudgetAllocation`, and `BudgetRevision`. Restore accepts older backups with empty budget arrays, validates exact Decimal money, totals, thresholds, statuses, reasons, official-year uniqueness, category/department/plan links, duplicate numbers/combinations/revisions, and revision snapshot links. It maps actor links only when safe, preserves a newer local plan/allocation, never deletes local budget data, and refuses to attach allocations or revisions to a same-number plan with a different identity. Password hashes remain excluded.

## Limitations and next phases

- No forecast, encumbrance beyond approved expense commitments, monthly phasing, funding-source split, attachment, procurement, purchase order, inventory, automatic budget blocker, or unlock workflow.
- There is no dedicated category/department maintenance UI; Prompt 16A masters remain authoritative.
- Budget reports are management controls, not accounting statements or statutory returns.
- Future Prompt 16C may build a separately scoped daily cash book and day close.
- Future Prompt 16D may build separately audited miscellaneous income. Neither may merge student payments, expenses, or budget records.

## Prompt 16B-QA hardening

- Cancellation now requires `APPROVE_BUDGETS` in both the direct API and UI. Draft managers such as Admin and Accountant cannot cancel a plan by calling the API directly.
- A partial allocation threshold override is validated against the inherited plan threshold, so the effective warning value can never exceed the effective critical value.
- Category/department master validation now runs inside create, draft-update, revision-create, and revision-approval transactions.
- Budget pages use paise-preserving display formatting. Report grouping accumulates with `Prisma.Decimal`, and allocation matching explicitly ranks combined, category-only, then department-only rows.
- Restore additionally validates plan academic years, strict calendar dates/date order, and every revision snapshot's links, allocation keys, duplicate combinations, exact money, effective thresholds, and total reconciliation.

Disposable live API QA verified exact totals of 2,200.65 allocated, 1,000.25 paid, 1,125.35 committed, 2,125.60 utilized, and 75.05 available, including partial, paid, unpaid, draft, rejected, and cancelled expenses. Seven-role route/API checks passed, and an isolated copied-database restore passed first import, repeated idempotent import, and same-number/different-ID collision isolation. Cleanup returned every temporary budget, expense, vendor, and QA-user count to zero. Lifecycle backfill, typecheck, 502 tests across 69 files, the 119-page build, and version-16 backup `nalanda-fee-control-backup-2026-07-15-10-25.json` passed.

The Prompt 16B-QA in-app Browser rerun is not signed off: the bundled Browser client failed during initialization with `Cannot redefine property: process`. Therefore current 1366x768/390x844, theme, overflow, table-scroll, confirmation-dialog, and console-zero evidence remains pending even though the Prompt 16B implementation browser baseline passed before these QA changes.

## Prompt 16C relationship

Prompt 16C is implemented separately. Miscellaneous income and daily physical cash never change allocations, budget totals, thresholds, or revision snapshots. Cash-paid expenses are read from authoritative `ExpensePayment` rows only; budget actual/commitment rules remain unchanged. Backup version 17 retains all budget arrays and adds the six Prompt 16C arrays. See `MISCELLANEOUS_INCOME_AND_CASH_BOOK_WORKFLOW.md`. Prompt 16D remains Books/Library Income and Publisher Payment Flow.

## Prompt 16B implementation sign-off

Final verification passed lifecycle backfill with no changes, typecheck, 493 tests across 69 files, and the 119-page production build. Browser QA covered plan workflow and confirmations, preserved revision approval, exact paid/committed/available calculations, warning and over-budget states, CSV download, conservative role defaults, 1366×768 and 390×844 layouts, light/dark themes, contained table scrolling, and zero console errors or warnings. All temporary plans, allocations, revisions, expenses, payments, audits, vendors, and QA users were removed before clean backup `nalanda-fee-control-backup-2026-07-15-02-25.json` was created at backup version 16.
