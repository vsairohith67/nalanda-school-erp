# Student Data Gap Checklist for UDISE+ and Academics

Planning phase: Prompt 15A  
Purpose: school review checklist, not a compliance claim or a request to collect every listed field.

Use this checklist to compare the ERP, school registers, and the latest UDISE+ portal. **Verify against current UDISE+ portal requirements before production use.** Do not guess missing values or collect sensitive data merely because it appears below.

## Status legend

- **Already present:** a current ERP field/relation exists; accuracy and completeness still need verification.
- **Partly present:** related/free-text data exists but is not structured enough for a reliable lifecycle/compliance workflow.
- **Likely missing:** no current structured Student field/model was found.
- **School records:** verify source, value, owner, and correction process with authorized school staff.
- **Latest UDISE+:** verify whether required, exact terminology, allowed values, and reporting date with the current portal.

## Checklist

| Data area | ERP status | What exists or is missing | School record review | Latest UDISE+ review |
|---|---|---|---|---|
| Admission number | Already present | `Student.admissionNo`, unique; used by import, payments, and attendance snapshots | Check duplicates, legacy formatting, cancelled admissions, and source register | Verify identifier rules and whether another portal ID is required |
| Student name | Already present | `studentName` | Verify spelling/order against authoritative record | Verify current name fields/format |
| Date of birth | Already present, optional | `dateOfBirth`; importer accepts DOB | Check missing/invalid dates and documentary source | Verify requirement and age/cut-off rules |
| Gender | Likely missing | No Student gender field | Verify authorized source; never infer from name | Verify allowed current values and summary rules |
| Class and section | Already present but current-only | `className`, `section`; no year-enrollment history | Reconcile current roster and section spellings | Verify class/grade/section codes and cut-off |
| Academic year | Already present with year enrollment history | `Student.academicYear`, SchoolSettings, and AcademicYearEnrollment | Confirm authoritative year and transition date | Verify reporting/session representation |
| Parent/guardian | Already present/partly present | Father/mother on Student plus Guardian and StudentGuardian relations | Reconcile primary guardian, relationship, duplicates, and consent/contact rules | Verify which guardian fields, if any, are current requirements |
| Mobile and address | Already present, partly structured | Multiple phones/WhatsApp; one free-text address | Check current contact and authoritative address | Verify required address/geography breakdown |
| Aadhaar availability/status | Partly present, sensitive | Optional full `aadhaarNo`; no availability/verification/masking policy | Confirm whether collection is authorized, necessary, accurate, and access-controlled | Verify current requirement; do not add automated verification or expose full number |
| Caste/social category | Likely missing | `studentType` is a fee category and must not be repurposed | Verify only from authorized records if school needs it | Verify current categories and whether required |
| Minority status | Likely missing | No field found | Verify sensitive-data policy and source | Verify current requirement/values |
| CWSN/disability | Likely missing | No structured field found | Handle sensitively; define narrow access and support-focused use | Verify current category/fields and privacy expectations |
| Medium/language | Likely missing | No Student medium or language fields | Confirm school medium and per-student language records | Verify exact current fields if needed |
| Previous school | Likely missing | No structured field found | Verify admission record/source document | Verify if currently required |
| Admission date | Likely missing | `createdAt` is not an admission date | Verify admission register; do not substitute record-creation time | Verify definition and required format |
| Leaving date | Likely missing | No structured leaving date | Verify withdrawal/TC register | Verify status date rules |
| Leaving/transfer reason | Likely missing/partly present | Broad `status`, `tcStatus`, and remarks are insufficient | Agree controlled school reasons and evidence | Verify current allowed classification |
| Destination school | Likely missing | No structured field found | Verify when known; define correction process | Verify if/when required |
| Transfer certificate details | Partly present | Free-text `tcStatus`; no number, request/issue/cancel/reissue dates or linkage | Verify TC register and authorization | Verify current status/details required |
| Current lifecycle status | Partly present | Free-text broad `status` supports Active/Cancelled/TC/Left in imports | Reconcile every non-active value | Verify mappings; do not assume ERP words equal portal words |
| Academic-year enrollment history | Present from Prompt 15B | One AcademicYearEnrollment per student/year plus append-only lifecycle events | Reconcile against registers; backfilled history is not proof of older years | Verify history/opening/closing reporting needs |
| Promotion status | Present internally from Prompt 15C | Reviewed progression decisions plus finalized lifecycle/enrollment effects | Verify year-end result register and approval | Verify current progression terminology; do not assume direct mapping |
| Repeat decision | Present internally from Prompt 15C | Reason, evidence, parent acknowledgement, approval, and explicit finalization | Verify academic decision and parent record | Verify compatibility and reporting status |
| Double-promotion decision | Likely missing | No request, evidence, approval, rejection, or acknowledgement workflow | Require strong evidence and leadership approval | Verify whether/how it can be reported before use |
| Marks evidence | Likely missing | Exams/marks/report cards are not built | Identify authoritative marks source; do not enter invented totals | Verify whether any evidence/summary is required |
| Attendance evidence | Already present from Prompt 13B | Dated sessions/records by year/class/section; no progression evidence link | Reconcile locked/submitted coverage and missing sessions | Verify reporting period and status definitions |
| Teacher remarks/evidence | Likely missing | No academic teacher-remark record | Identify approved source and owner | Verify whether relevant to school checklist, not assumed portal field |
| Parent request/acknowledgement | Likely missing | Guardian links exist; progression request evidence does not | Verify signed/request record and acknowledgement method | School-policy item; verify any portal relevance |
| Approval/audit fields | Present for progression decisions | Prepare/submit/approve/reject/finalize/cancel state and actor/time fields; lifecycle is append-only | Confirm school operators and evidence policy | Verify required evidence retention; do not claim compliance |
| Class/section strength reports | Partial from Prompt 15D | Checklist compares active Student master strength with active current-year enrollment strength | Reconcile opening, joins, exits, and closing strength | Verify required disaggregation/cut-off; internal consistency is not portal compliance |
| Gender/category/age summaries | Likely missing | Source demographic fields and reports are absent | Resolve missing values before totals are trusted | Verify required groupings and age date |

## Current import caution

The full student importer can accept more fields than the sample CSV, including DOB, Aadhaar, broad status, and TC status. Import availability does not mean a field is verified, privacy-safe, correctly classified, or UDISE+-ready. Any later data-gap import must remain preview-first, show unknown/missing values, and require school review.

## School review worksheet

For each field the school decides to use, record:

1. authoritative source/register;
2. data owner and permitted viewers/editors;
3. whether it is required by school operations, latest UDISE+, both, or neither;
4. exact allowed values and `Unknown/Not available` handling;
5. evidence and correction process;
6. privacy, masking, retention, and export rules;
7. completeness count and unresolved records;
8. last portal-requirement verification date and reviewer.

## Prompt 15A non-goals

This checklist adds no fields, schema, imports, exports, dashboard, Aadhaar verification, portal automation, progression, exams, admissions, or certificates.

## Prompt 15D dashboard implementation note

The planning checklist is now available to authorized reviewers at `/udise`. `/udise/students` filters by class, section, current status, and safe gap type. `/udise/staff` filters by staff type, status, and gap type. `/udise/summary` is a compact review page. These pages are read-only and never show raw internal IDs, full Aadhaar, DOB values, addresses, guardian contact values, staff contact values, hashes, or secrets.

The report categories are Student data, Enrollment/lifecycle, Guardian/contact, Staff data, School settings, and Aadhaar/privacy caution. Each category counts `Complete`, `Missing`, `Not tracked in ERP`, `Needs school verification`, and `Sensitive/privacy caution`. Counts identify review work only; they do not declare legal requirements or compliance.

The optional CSV is named as a planning checklist/gap report, carries the planning and latest-portal warnings, neutralizes spreadsheet formulas, and is not an official UDISE+ format. Viewer can review but cannot export by default. No schema or backup-format change was needed.

## Prompt 15D-QA checklist accuracy note

QA reconciled the live overview with the current database: 8 active students, 8 academic-year enrollments, 8 lifecycle events, 0 staff records, and no guardian links. The resulting 8 missing-basics and 8 guardian/contact-gap student counts therefore reflect current source data rather than fabricated requirements. The empty staff report remains a helpful review state, not a claim that staff reporting is complete.

Student `gapCount` now uses the same unique, visible non-privacy gap types shown as badges. This prevents two absent basic values from being represented as one badge but counted twice. Category totals are regression-tested against the underlying item statuses, and class, section, status, and gap filters retain explicit empty states.

The checklist still does not say that a field is legally mandatory. Reviewers must confirm school records, current privacy obligations, and the latest UDISE+ portal before deciding whether any gap should be fixed.
