# HR-PAYSLIP-REQ-1 Implementation Checkpoint

**Date:** 2026-08-09

**Branch:** `hr/staff-payslip-request-secure-delivery`

**Independent QA:** required before merge or tag

The additive implementation preserves the released family-payment commit and keeps the operational migration unapplied. It adds the governed request/month/event/document/access model, strict PDF intake, fixed-path qpdf AES-256 protection, AES-256-GCM recoverable password envelopes, private Staff delivery, management source preview, issue/replacement controls, exactly-once private notifications and backup/restore coverage. No payroll calculation or salary-value transformation is present.

The original recovery blocker was `TEST_TYPECHECK_OR_BUILD`: clean TypeScript partitions exhausted the default approximately 2 GB Node heap before diagnostics. The affected partitions pass with a bounded 2.5 GB heap. The sequential final gates pass with 320 pages / 495 APIs, zero lifecycle backfill changes, 194 test files / 1,736 tests, the authorised 4 GB production build, backup version 37 and Git safety.

Copied-database evidence covers one/multi-month requests, overlap refusal, partial issue, concurrent issue serialization, replacement, access audit, protected PDF, metadata and encrypted-asset restore twice, wrong/corrupt key/asset refusal and unchanged operational database. Browser evidence covers exact Staff/Parent isolation, management assignment, Accountant prepare/upload without issue, Director preview/approval/issue, Staff re-authenticated transient password reveal, protected download, denied Principal/Admin/Viewer roles, exact `390x844` and `1366x768`, light/dark, visible focus, 44 px targets, containment and clean console/stderr batches.

No deployment, live provider, real Staff onboarding, operational salary document, operational migration, merge or release tag is authorised.
