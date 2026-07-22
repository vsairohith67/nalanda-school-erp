# Student Certificates, Transfer Certificate and Bonafide Workflow

Prompt 18A supports exactly four controlled types: `BONAFIDE`, `STUDY`, `CONDUCT`, and `TRANSFER`. It does not implement board certificate packages, Migration Certificates, certificate fees, payments, public verification, QR verification, signature images, or digital signatures.

## Legal and school-policy boundary

The school must verify required Transfer Certificate wording and fields with its applicable board, state education authority, or an authorised consultant. Templates are school-configurable validated JSON data, never executable HTML or JavaScript. The software preserves reviewed school data and issue history; issuing a certificate does not itself change statutory Student status, enrollment, progression, Attendance, fees, or dues. Typed signatory names and roles are print labels only. The printed document is not digitally signed.

## Models and numbering

`CertificateNumberSeries` owns one active default counter per certificate type/applicable year. Preview never updates the counter. Issue allocates through a database transaction and compare-and-set increment; a failed issue rolls back both the increment and all issue writes. Issued numbers are never reused.

`CertificateTemplate` stores a validated type-specific definition and monochrome A4 print settings. Templates reject scripts, event handlers, executable URLs, unsupported fields, and sensitive data. Activation is explicit. Issued versions embed the template definition and remain independent from later template changes.

`StudentCertificateRequest` records internal or Parent requests. `StudentCertificate` is the editable pre-issue record. `StudentCertificateVersion` is an immutable issued/corrected/reissued snapshot. `StudentCertificateEvent` is append-only. Correction and reissue preserve the original certificate number and create the next version; print visibly labels `CORRECTED VERSION` or `REISSUED`. Cancellation preserves the number and history and prints `CANCELLED`.

## Request and certificate workflow

Requests move `SUBMITTED → UNDER_REVIEW → APPROVED → COMPLETED`; rejection and cancellation require reasons. Certificate workflow is separately `DRAFT → READY_FOR_REVIEW → APPROVED → ISSUED`. Approval does not allocate a number. Issue creates immutable version 1 and completes a linked approved request in the same transaction. Actions use compare-and-set guards and accessible in-app confirmation dialogs.

Parents can request all four supported types for a server-verified linked child, see safe request statuses/public reasons, and view or print only issued/cancelled versions belonging to that child. They cannot edit certificate facts or see drafts, internal notes, actor IDs, dues, or financial data.

## Certificate-specific data

- Bonafide wording is derived from authoritative enrollment history and distinguishes current from historical enrollment.
- Study history is derived from `AcademicYearEnrollment`; missing or short history is warned and never fabricated.
- Conduct uses `GOOD`, `SATISFACTORY`, or leadership-reviewed custom wording. Internal disciplinary records are never printed.
- Transfer Certificate review shows lifecycle status, an active-enrollment warning, Attendance coverage when present, and only a finalised progression decision. Without one it says `Promotion decision not recorded.` Issuing while active needs a leadership reason. Issue never mutates enrollment, progression, Student lifecycle, Attendance, fees, or payments.

Missing sources are displayed as unavailable, never as zero. Issued snapshots preserve the reviewed source data.

## Pages, reports, print, and recovery

Staff routes live under `/certificates`, including requests, creation, detail/history, A4 print, templates/series, and reports. Parent access is `/parent/certificates`. Reports show workflow counts, sources, gaps, TC active-enrollment warnings, and series usage. CSV uses an explicit privacy allowlist and formula protection; Viewer/Auditor has aggregate reports only and no export.

Print is browser-safe A4, black-and-white, uses physical-signature space, and does not depend on background colours. Parent print omits provenance, internal events, actor IDs, contacts, financial data, and internal notes.

Backup version 27 includes all six certificate arrays, strips actor IDs/password hashes, validates exact Student/Guardian/template/request/certificate/version/event links, isolates same-code/different-ID and same-number/different-ID collisions, preserves immutable snapshots/hashes, and accepts older backups with no certificate arrays.

Prompt 18B is the separate certificate-fee/payment phase. Do not add fee collection, payment gateway actions, receipts, no-dues automation, or financial blocking in Prompt 18A.
# Prompt 18B integration

Class X packages reuse the exact Student, controlled certificate type, and selected immutable issued version from this Prompt 18A workflow. Prompt 18B never duplicates or automatically issues TC, Study, Conduct, or Bonafide content. Wrong-Student, wrong-type, cancelled, and unissued certificate links are blocked. Board and Migration documents are external custody/status records only; the ERP does not issue them. See `CLASS_X_DOCUMENT_PACKAGE_MIGRATION_AND_PAYMENT_WORKFLOW.md`.
# Prompt 18C boundary

Virtual Student/Staff ID cards are implemented separately under `VIRTUAL_STUDENT_AND_TEACHER_ID_CARDS_WORKFLOW.md`. Certificate numbering, requests, issue, verification, and public-certificate behavior are unchanged; an ID card is not a certificate or government identity document.
