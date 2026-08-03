# Prompt 23G-QA Independent Release Evidence

Date: 2026-08-03

Branch retained: `feature/consolidated-board-reporting`

Release tag: `consolidated-academic-reporting-v37-2026-08-03`

Independent QA used fresh copied `REPORT23GQA` data only. Two academic years,
Classes IX and X, four sections, two exact Teacher assignments, Principal,
Director, Parent, Student-linked, Viewer, Accountant and Computer Operator
roles covered raw, weighted, grouped, revision, preboard, issued, unissued,
incompatible and low-count cases. Operational data was never used as a fixture.

Hand calculations verified published-percentage deltas, explicit normalisation,
paper/group/combined values, grades, pass/fail, zero, absent, exempt, N/A,
not-entered, average, highest, ties and completion counts. Formula drift and
unissued sources failed closed. Different formula/calculation structures were
refused; different maxima produced deltas only under the explicit published-
percentage rule. No raw marks or examination formulas were recalculated.

Authorization QA denied cross-year, class, section, subject and linked-child
tampering. Teacher output stayed within active timetable/examination assignment;
Parent and Student output stayed linked/self; Viewer low-count rows and source
evidence were suppressed; Accountant and Computer Operator access was denied.
CSV cells were formula-safe, PDFs remained authenticated, filenames were
deterministic, and audit payloads contained no Student, admission, actor or
network identifiers.

Repeated and concurrent runs were deterministic and idempotent. Generated
summaries and audit rows resisted update/delete, supersession preserved the old
run, stale sources produced a historical warning, and a forced transaction
failure rolled back fully. Backup generation and restore each ran twice and
preserved definitions, runs, source-version links and append-only audit without
credentials or secrets.

QA found and corrected two defects: restore no longer conflates legitimate
same-name timetable subjects with different stable IDs/unique short names, and
report filter controls now meet the 44 px target. Regression coverage protects
both corrections.

Final in-app Browser proof covered Principal, Teacher, Parent and Viewer at
1366 x 768 and 390 x 844 in light and dark. It proved 44 px controls/hit areas,
keyboard focus with a visible 2 px outline, labelled pattern charts, printer-
safe monochrome export, no overflow/native dialogs and zero console, hydration
or runtime-stderr errors. Authenticated Viewer CSV and PDF exports appended the
expected private export history. Browser databases, logs, runtimes and artifacts
were removed and inspected twice.

Release gates passed sequentially: 307 page routes, 457 API routes, zero-change
lifecycle dry run, 3 GB typecheck, 184 test files with 1,677 tests, 4 GB build,
version-37 backup and Git safety. The additive migration applied once and status
is clean; the exact zero-business and protected-account baseline remains intact.
The pre-migration backup plus two copied restore rehearsals provide rollback
evidence.

Result: `ACADEMIC_REPORTING_CLEARED`. Next governed phase: Prompt 23H -
Admissions and Enquiry CRM. Deployment, public results, official board
submission and real-user/data onboarding remain unauthorised.
