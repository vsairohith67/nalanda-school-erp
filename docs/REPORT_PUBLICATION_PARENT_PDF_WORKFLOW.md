# Governed Report Publication, Parent Delivery and PDF Workflow

## Boundary

EXAM-RC-IMPL-3 consumes locked `StudentResultSnapshot` records without changing
approved marks, formulas, calculation runs or frozen result content. Publication
is a separate, append-only release step. Cloud deployment and public report
links remain unauthorised.

## Principal workflow

1. Open **Report Cards > Publication and Parent Delivery**.
2. Select only readiness rows marked **Ready for exact preview**. Incomplete,
   unlocked and superseded calculation runs are disabled server-side.
3. Choose individual, section or class scope and preview the exact frozen
   report. The preview fingerprint is rechecked inside the publish transaction.
4. Use the in-app confirmation dialog. Publishing records the actor, time,
   template/binding version, source calculation run and source snapshot
   version. Repeating the same request key is idempotent.
5. Never edit an issued version. A correction must start from a new locked
   calculation snapshot and use **Replace from preview**. The prior version is
   retained with `REPLACED` status. **Withdraw** preserves the report and its
   audit history while removing content access from Parent delivery.

All lifecycle writes require the exact governed permission, same-origin/CSRF
checks, an expected version and timestamp, and a non-empty reason where policy
requires one. No workflow mutation is exposed through GET.

## Parent delivery

Parents open **Parent Portal > Report Cards** and select from children linked by
the existing Guardian relationship. The selector uses an opaque, keyed child
reference; raw Student IDs are not accepted. Only the current `ISSUED` version
can be viewed or downloaded. Replaced and withdrawn versions remain visible as
status history but their content actions are unavailable.

View and PDF actions are POST-authorised, recheck Parent ownership, write only
privacy-safe audit metadata and issue a five-minute HMAC-signed capability.
Direct-ID, cross-child, cross-family, expired-token and tampered-token access
fails closed. This phase adds no IAM or account-switching architecture.

## Template and content rules

The frozen template binding selects one of four families:

- KG developmental booklet;
- primary marks and skills report;
- secondary grouped-subject and personality report;
- combined result only when the frozen scheme explicitly enables it.

Rendering copies the locked school, Student, exam, academic-year, component,
entry-state, total, percentage, grade, grade-point, pass/rank, attendance,
skills, remarks, legend and signature-space data. Disabled result features are
shown as not enabled. No universal 10+40, 20+80, 25+25 or historical combined
weight is introduced; combined rows use only the frozen configured weights.
Public references are deterministic and do not expose database IDs.

## PDF and batch workflow

PDFs are generated from the same safe published snapshot used by the UI.
Normal families use A4 portrait. Governed wide combined reports use A4
landscape. Fonts and the approved logo are embedded in the PDF; no font file is
published separately. Black-and-white output uses hatch patterns, borders and
direct percentage labels rather than colour alone.

Principal batch jobs support one PDF, merged PDF or a ZIP of individual PDFs.
Names are deterministic and sanitised. Requests are bounded to 60 reports,
processing is limited to two concurrent workers, request keys are idempotent,
and expected report versions are rechecked. Job manifests and artifacts live
under ignored private temporary storage, downloads require short-lived
authorisation, and failed rendering or packaging publishes no artifact.

## Operator safety

- Use only copied or fresh databases for EXAM3 fixtures and print QA.
- Keep application light/dark theme testing separate from PDF colour mode.
- Confirm printer margins in Chrome print preview or an equivalent A4 preview.
- Do not copy report artifacts to a public web directory.
- Clean copied databases, credentials, job manifests, PDFs, ZIPs, runtimes and
  logs after QA, then inspect cleanup twice.
- Backup format remains version 37.

Implementation is ready for independent QA. This statement is not deployment
approval and is not the independent release clearance.
