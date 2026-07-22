# Class X Document Package, Migration Tracking and Payment Workflow

## Scope and authority boundary

Prompt 18B adds a controlled Class X completion-package workflow. The ERP does not issue Board certificates. Board marks memos, pass certificates, provisional certificates, and Migration Certificates are external physical documents; the ERP records request, receipt, verification, custody, readiness, and handover status only.

Nalanda Public School must verify the current Class X and Migration Certificate procedure, checklist, charges, wording, and handover requirements with its applicable Board and education authority before operational use. A configured checklist is a school workflow snapshot, not a statement of Board eligibility or authority.

The module does not:

- generate a Board document body, imitate Board branding, or store scans/security features;
- infer Board eligibility, result, pass status, or hall-ticket status from marks;
- mutate enrollment, lifecycle, progression, marks, exams, or report cards;
- create a school-fee `Payment`, change dues, use a payment gateway, or store gateway credentials;
- store Aadhaar/government-ID numbers or expose Board serial/reference data to Parents.

## Roles and permissions

- Director and Super Admin: full configuration, workflow, finance approval/waiver, handover, reporting, and export.
- Principal: package review/final approval, document custody, handover, reports, and export; no collection, waiver, or configuration by default.
- Admin: package preparation, document custody, reports, and export; no final approval, collection, or waiver.
- Accountant: view, approved-charge collection, reports, and export; no document custody, final package approval, or waiver.
- Viewer/Auditor: masked reports only; no export.
- Teacher: no Class X package access.
- Parent: request and safe status for linked children only.

All APIs repeat the server-side permission and identity checks; navigation visibility is not the security boundary.

## Configuration and immutable snapshots

`/class-x-documents/templates` maintains versioned checklist templates and independent charge rules. Controlled document types and issuer types are strictly validated. Executable/HTML content, duplicate item keys/orders, uncontrolled generic “other” labels, negative money, and ambiguous active charge rules are rejected.

Creating a package copies the selected template definition, eligibility source, charge rule, price, waiver policy, and document checklist into immutable operational snapshots. Later template/rule changes do not silently rewrite existing packages. One specific active rule must resolve for the academic year; ambiguity blocks preview and creation.

The existing configured Miscellaneous Income item `CLASS-X-CERT` is referenced. Prompt 18B does not silently create a new income item or hard-code a universal Board price.

## Eligibility and source behavior

The package source requires a current or historical Class X enrollment. The preview displays the exact Student and Class X academic-year source and records relevant lifecycle/progression/report-card context as warnings only. It never treats marks or a report card as proof of Board eligibility and never mutates those modules.

Parent requests resolve the Guardian from the authenticated Parent account and the Student from the existing `StudentGuardian` link. A raw Student ID supplied by a Parent is never trusted. Parents may view any safe package status for their linked child, including a package created internally, but cannot view another child.

## School-issued certificate linking

Transfer, Study, Conduct, and Bonafide certificates reuse Prompt 18A. A package item links to the exact Student, controlled certificate type, and a specific immutable issued version. Wrong-Student, wrong-type, cancelled, missing-version, and unissued links are blocked.

“Create Missing School Certificate” opens the Prompt 18A workflow; it does not issue automatically. Corrected/reissued version selection remains explicit and historical package links remain auditable.

## Board and Migration document tracking

Board/external items move through request, awaiting Board, received, under verification, verified, ready for handover, and handed-over custody states. Dates, authority name, safe reference, and internal notes are bounded and audited. No document body or scan is accepted.

Parent wording is deliberately reduced, for example “Awaiting Board”, “Received by School”, and “Ready for Collection”. External references and internal notes are not sent to the Parent portal.

## Service charge, collection, and waiver

A charge preview is read-only and explicitly reports that no financial write was created. Package creation snapshots the applicable rule but still creates no receipt.

Collection is allowed only after a separate charge approval and only for the exact full positive payable amount. One transaction creates exactly one active `MiscIncomeReceipt`, one receipt line for the configured item, and one unique charge-to-receipt link. The existing Daily Cash Book derives that receipt as a source exactly once. A repeated collection is blocked and cannot create a second receipt.

This is a **Document Package Service Charge Receipt**. It is not a Board receipt and not a school-fee receipt. No `Payment` row, fee allocation, fee ledger entry, or dues change is created.

A full waiver requires the snapshotted rule to permit waiver, an authorized role, and a mandatory reason. A paid charge cannot be waived. Waiver changes the payable amount to zero while preserving the original snapshot and creates no receipt. Paid-package cancellation preserves the receipt and audit trail.

## Approval and handover

Final approval rechecks required document readiness and charge resolution. Fee dues are outside this decision and do not block approval or handover.

Handover supports a safe recipient type/name, a non-government identity-check category, selected ready items, acknowledgment text, and partial handover. Each confirmation snapshots the handed-over item names and appends an event. Completion requires all required handover items to be handed over or explicitly not applicable.

The A4 acknowledgment includes school identity, package/Student/class/year, safe item names, recipient relationship, typed staff identity, payment status and policy-safe receipt reference, version/status label, and blank physical-signature lines. It excludes Board bodies/serials, sensitive demographics, Parent phone, bank/UPI details, internal notes, raw IDs, actor IDs, and any digital-signature claim.

## Reports and CSV

`/class-x-documents/reports` covers package, document-readiness, Migration-awaiting, handover, charge, source, turnaround, lifecycle-warning, and recent-event metrics. Reconciliation compares snapshotted package-charge totals with linked active Miscellaneous Income totals; mismatch should be zero.

CSV uses an explicit field allowlist, formula escaping, India-local filename, and no Board serials, Parent contacts, sensitive demographics, bank details, fee-ledger data, raw internal IDs, or actor IDs. Viewer/Auditor has no export permission.

## Backup and restore

Backup version 28 includes:

- `ClassXPackageTemplate`
- `ClassXDocumentPackage`
- `ClassXPackageDocumentItem`
- `ClassXPackageChargeRule`
- `ClassXPackageCharge`
- `ClassXPackageHandover`
- `ClassXPackageEvent`

Restore supports older backups with empty Prompt 18B arrays, validates Student/Guardian ownership and all package/template/item/certificate/version/rule/receipt/handover/event links, preserves custody and terminal states, prevents duplicate public identities and receipt reuse, isolates same-number/different-ID collisions, and remains idempotent. Password hashes and raw actor links are excluded from portable backup data.

## Operator sequence

1. Director/Super Admin verifies current school/Board policy and configures one active checklist and one unambiguous charge rule.
2. Staff previews the exact Class X source and charge, then creates or receives a Parent request.
3. Staff links issued Prompt 18A school certificates and records external Board/Migration custody status.
4. Reviewer starts review; finance approver approves the service charge where required.
5. Accountant collects exactly once, or an authorized leader records an approved waiver.
6. Principal/Director approves the ready package.
7. Authorized staff records one or more physical handovers and prints the acknowledgment.
8. Staff completes the package only after every required item is resolved.
9. Reviewer checks the report reconciliation and performs routine backup.

## Prompt 18C boundary

Prompt 18C is not implemented here. Future work must remain separately approved and must not turn custody tracking into Board-document generation, payment-gateway processing, scanned-document storage, fee-dues blocking, or automatic lifecycle/progression changes.
# Prompt 18C boundary

Virtual ID cards do not change Class X package eligibility, payment, document preparation, or handover. Card numbers cannot be used as public package tokens or payment references.
