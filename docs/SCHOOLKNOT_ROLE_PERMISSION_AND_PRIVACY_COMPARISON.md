# Schoolknot Role Permission and Privacy Comparison

Status: **Prompt 23B role design reconciled with completed FIN-2B; RECON-1A changes documentation only**

FIN-2A privacy/export/`ReceiptNote`-`Payment` integrity issues are resolved. FIN-2B supersedes only Prompt 23B's earlier Accountant cancellation wording by adding exact cancellation and correction permissions, immutable reissue history and leadership notification; all FIN-2A privacy and export safeguards remain.

For an Accountant, `CANCEL_FINAL_RECEIPT` authorises only governed whole-receipt cancellation and `CORRECT_FINAL_RECEIPT` authorises only governed correction. Every successful action is audited and notifies all active Directors and Super Admins. Non-mutable Cash Book days block ordinary Accountant action without rewriting the locked snapshot. No broad finance or legacy payment permission substitutes. No approved `FIN-2C` scope exists.

## Final role comparison

| Role | Schoolknot observed excess / missing access | Current Nalanda default and object scope | Intended least privilege | Sensitive/export/approval/settings authority | Recommendation |
|---|---|---|---|---|---|
| Management | Broad operational suite; exact backend and branch isolation unproven | Director/Super Admin/Admin permission sets with page/API guards; broad authorised management scope | Director governs policy and high-risk approvals; Admin operates allowlisted records; Super Admin reserved | Purpose-specific exports, approval tokens, role/settings controls separated; provider activation absent | Conditional management pilot only after migration/deployment gates; never infer backend safety from menus |
| Principal | Source exposes Student/Staff detail, payment operations, employee password reset, role permissions, fee configuration, bulk updates and global School Settings | Current Principal default is still broad: Student create/edit/export, Staff manage, communication publish, timetable manage, academic approval, website publishing, backup verification and broad reports; no direct payment mutation, password reset, role management, fee configuration or global settings default | **Academic-first**: masked Student academic/attendance views; marks/report-card moderation; timetable/substitute oversight; governed notices/events; necessary certificate/student-support review | No implicit payment mutation, receipt cancellation, Staff password reset, role management, fee configuration, integration activation, backup key/retention control or global settings. Exports must be academic allowlists | Create and independently test a reduced Principal bundle before Principal pilot; current broad defaults need governance review even though this prompt does not edit them |
| Accountant | Source designation was `Admin Executive`; excessive Student/attendance/academic/settings access; payroll/self-service absent or unverified | Finance, vendor, expense, budget, misc income, Cash Book, books sales, selected charge collection, OCR and own preferences; FIN-2A removes broad Student lookup/export leakage; FIN-2B adds exact final-receipt action permissions | Finance-only allowlisted projections, bounded audited exports, whole-receipt cancellation through `CANCEL_FINAL_RECEIPT`, governed correction through `CORRECT_FINAL_RECEIPT`, no academic/role/settings mutation | Original receipts remain immutable; every successful Accountant action is audited and notifies active Directors/Super Admins; locked days are protected. Refund, gateway, payroll and employee self-service remain absent/unverified | `CONDITIONAL_GO` for implemented finance duties; do not claim payroll/Employee parity |
| Teacher | Source has compact academic menus but no visible attendance/timetable/leave/substitute/Library routes; Classwork/marks/communication controls unproven; legacy password route exists | Prompt 23C binds Student attendance list/mutation/report/CSV/dashboard access to exact active `StaffMember -> TimetableTeacher -> TimetableAssignment` or confirmed dated substitute scope; permission alone grants no cohort; Prompt 23C-QA independently cleared the boundary | Exact active assignment class/section scope; own timetable; assigned attendance/Homework/marks/report-card data; own leave/substitute duties/Library/ID/preferences; scoped Parent communication drafts only | No broad Student master, peer analytics/ranking, global reminder settings, public publishing, approval/issue, exports or settings | Critical attendance blocker cleared; overall Teacher replacement remains `CONDITIONAL` until remaining workflows and role QA |
| Parent | Source provides one-child evidence, attendance, Classwork/Homework, exams, events/holidays/calendar and profile; several blank/zero-row or untested file/write states | Linked-child dashboard, fees/dues/receipts, issued report cards, Homework, Library, certificates/Class X/ID, notifications and communication preferences | Strict linked-child selector and per-object denial; read-only attendance/exam timetable; private Classwork/submission/files; Parent leave request; governed profile correction; optional approved transport view | No school-wide export, other-child IDs, draft results, internal notes, staff data, direct profile overwrite, settings or payment mutation | `CONDITIONAL_GO` only for existing read-only modules; 23D/23E/23F needed for broader Parent replacement |

## Non-negotiable object scopes

- Parent: every list, detail, print, attachment and API identifier must re-check the Guardian-to-Student link server-side.
- Teacher: every attendance, Homework/Classwork, marks/report-card and communication target must derive from current active timetable assignment; UI selectors are not authorization.
- Principal: academic views may aggregate by authorised school scope, but finance must be masked read-only and separately granted. No role/settings/password authority is inherited from title.
- Accountant: Student identity lookup is a purpose-specific finance projection, not `VIEW_STUDENTS`; exports remain bounded, date-limited, formula-safe and audited.
- Management: branch/tenant scope remains a vendor/migration question; Nalanda does not claim multi-branch isolation.

## Prompt 23C Teacher attendance permission rule

`VIEW`, `MANAGE`, `SUBMIT` and report permission answer only whether the
operation is available. Every Teacher operation additionally requires an exact
active timetable or confirmed same-date substitute target. No Staff link,
inactive records, previous-year assignment, unrelated class/section, expired
substitute or resolver failure produces zero cohort access. Director and
Principal permissions remain a separate leadership decision and never become a
Teacher fallback.

## Authority matrix

| Authority | Management | Principal intended | Accountant | Teacher intended | Parent intended |
|---|---|---|---|---|---|
| Financial mutation | Explicit permission and workflow | None by default | Implemented finance actions only | None | None |
| Final receipt cancellation | Exact `CANCEL_FINAL_RECEIPT` | None by default | Exact `CANCEL_FINAL_RECEIPT`; whole-receipt, audited, leadership-notified | None | None |
| Final receipt correction | Exact `CORRECT_FINAL_RECEIPT` | None by default | Exact `CORRECT_FINAL_RECEIPT`; immutable version or linked cancel/reissue | None | None |
| Academic entry | Oversight/configuration only as needed | Approve/lock/correct under policy | None | Assigned scope entry/submit | None |
| Communication | Approve/publish by policy | Governed academic audiences | Own inbox/preferences | Assigned-scope draft; no self-approval | Own inbox/ack/preferences |
| Export | Purpose-specific audited allowlists | Academic allowlists only | FIN-2A finance allowlists | None by default | None |
| Staff password reset | Super Admin/Admin only when granted | Never implicit | No | No | No |
| Role/settings control | Super Admin/Director only | No | No | No | No |
| Sensitive personal fields | Need-to-know projection | Masked/minimised | Finance projection only | Assignment roster minimum | Own linked-child minimum |
