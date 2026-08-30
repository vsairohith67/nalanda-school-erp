# Pilot Role and Access Acceptance Matrix

The authoritative machine-readable matrix is `config/synthetic-pilot-role-access-matrix.ts`. It derives every base role from `lib/permissions.ts` and the hard-denial-aware `lib/role-permissions.ts`, joins the UI screen register, and adds `MARKS_ENTRY_OPERATOR` only from the exact Academic Integrity profile. Run `pnpm.cmd exec tsx scripts/print-synthetic-pilot-role-access-matrix.ts` for JSON or add `--check` for the acceptance gate.

| Persona | Landing | Primary allowed scope | Required denial probes |
| --- | --- | --- | --- |
| Super Admin | `/dashboard` | Full governed base-role authority | No AI/provider/real-data bypass; owner isolation remains |
| Principal | `/dashboard` | Academic, attendance, Staff and report governance | IAM/release-execution boundaries |
| Director | `/dashboard` | Bounded oversight, finance/release summaries and existing report-card approval/issue authority | Full release/IAM and Principal marks-entry/moderation boundaries |
| Admin | `/dashboard` | Existing administrative master/workflow scope | Finance/marks/release escalation paths |
| Accountant | `/dashboard` | Finance and separately activated offline drafts | General Student master, Admissions, exports and Old Due offline |
| Computer Operator | `/students` | Bounded preparation/import/timetable/documents | Approval/issue/finance escalation |
| Teacher | `/teacher` | Exact timetable/cohort teaching work | Permanent marks, unrelated cohort/family, report issue |
| Parent | `/parent` | Active linked-child private portal | Wrong child, inactive link, unpublished report, private notes |
| Student | `/student` | Own cleared Student surfaces | Another Student or management data |
| Gate Staff | `/student-departures/gate` | Minimum gate-pass/roster operations | Student master, pass issue, attendance mutation |
| Viewer | `/dashboard` | Approved read-only summaries | Mutation, broad export, ledger and marks entry |
| Marks Entry Operator | `/marks/governed` | Exact assigned marks entry/submit/correction request | Moderation, reopen, calculation, lock, report issue and IAM |

For every critical surface, test UI visibility, direct route, direct API and service invocation. A mismatch is `SOFTWARE DEFECT`; documentation cannot grant permission.
