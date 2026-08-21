# UDISE+ Prompt 15E Evidence Checklist

- **Status:** `BLOCKED_BY_EVIDENCE`
- **Predecessor:** Prompt 15D is `CLEARED` as a read-only checklist/reference foundation.

## Boundary

Prompt 15E may begin only after the current official and school evidence below is available, provenance is recorded, privacy is reviewed, and the authorised school reviewer accepts the scope. Until then, full UDISE+ operational support is `NOT_IMPLEMENTED` and `BLOCKED_BY_EVIDENCE` where field truth is missing.

Prompt 15E must not:

- scrape the UDISE+ portal;
- store portal credentials in the repository or a task record;
- automatically enter, submit, certify, or approve government-portal data;
- claim official compliance or certification;
- treat guessed labels, validations, or state rules as authoritative;
- collect Aadhaar or other unnecessary identity data in planning evidence.

The [UDISE+ planning notes](./UDISE_PLUS_PLANNING_NOTES.md) remain the controlling repository reference for the completed 15D boundary.

## Required official module evidence

- [ ] **Current Student Module manual and screenshots** for the active annual cycle, including visible version/date, field labels, required/optional markers, data types, code lists, validation messages, and role-specific steps.
- [ ] **Current Teacher Module manual and screenshots** with the same version, field, validation, and role evidence.
- [ ] **Promotion/progression workflow evidence**, including promoted, retained/repeat, progression, class/section movement, and annual-cycle transitions.
- [ ] **Transfer/dropout/left/rejoin workflow evidence**, including current reason codes, effective dates, validation rules, and approval/certification steps.
- [ ] **Telangana-specific fields and screens**, including state-only questions, code lists, validations, and any state circular or authoritative instruction that controls them.
- [ ] **Current DCF/Excel downloads or official data-capture templates** for Profile/Facility, Student, and Teacher data, with source URL or portal provenance and download date.
- [ ] **Redacted inconsistency-report examples**, including how issues are raised, corrected, cleared, and retained for review.
- [ ] **Current certification screen evidence**, including the role permitted to certify, declarations shown, period covered, and what happens after certification.
- [ ] **Current school-report download**, such as the current school report card or equivalent official output, with report name, cycle, and generation path.

## Required Nalanda school evidence

- [ ] **Authoritative student registers** used by Nalanda for the same reporting cycle, with the record owner and update process identified.
- [ ] **Authoritative teacher/staff registers** used for reporting, with the record owner and update process identified.
- [ ] **Previous UDISE exports or submitted reports**, where lawfully available, redacted for planning and tied to the relevant annual cycle.
- [ ] **Existing school reconciliation sheets or exception logs**, including known differences between local records and prior UDISE output.
- [ ] **Authorised role map**, naming who prepares, verifies, corrects, certifies, and retains annual evidence.
- [ ] **Annual verification process**, including dates, handoffs, required approvals, exception handling, and final human sign-off.

## Evidence-quality requirements

Each supplied item must include:

- source and owner;
- annual cycle, version, or retrieval date;
- whether it is official, school-authored, or an example;
- privacy classification and redaction confirmation;
- a stable filename or reference ID;
- the named reviewer who accepts it for mapping.

Screenshots and exports must be privacy-safe. Credentials, Aadhaar values, full personal identifiers, and unnecessary student/teacher records must not be posted to GitHub, Notion, Asana, Canvs, or a Codex prompt.

## Required decisions before implementation

- [ ] Confirm which fields are **ERP-maintained**, **read-only checklist/reference**, or **portal-only**.
- [ ] Confirm that every mapped field has an authoritative source, type, allowed values, validation rule, and responsible role.
- [ ] Confirm how annual version changes are detected and reviewed.
- [ ] Confirm retention and access rules for reports and reconciliation evidence.
- [ ] Obtain human acceptance of the field map and the continued no-submission boundary.

## Gate result

Prompt 15E can begin only when every required evidence category is complete or an authorised reviewer has explicitly documented why an item does not apply. Passing this gate authorises governed analysis and implementation planning only; it does not certify UDISE compliance or authorise portal automation.
