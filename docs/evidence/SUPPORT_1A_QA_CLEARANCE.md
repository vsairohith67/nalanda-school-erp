# SUPPORT-1A independent QA clearance

Date: 2026-08-09  
Implementation commit: `6f8ff5a3e9a42eba811877fcc52dd643b9b6dcf7`  
Release branch: `support/parent-staff-complaints-feedback`  
Release tag: `support-complaints-v37-2026-08-09`

The independent `SUPPORT1AQA` copied-database matrix passed without operational mutation. It used only synthetic users, relationships, requests and attachment bytes. Two additive migration deploys, public anti-enumeration, Parent/child and Staff object scope, internal-note isolation, restricted visibility, concurrent assignment, overdue escalation idempotence, logical restore twice and encrypted-asset restore twice all passed.

Browser QA used short copied-database production-runtime batches at 1366x768 and exact 390x844, in light and dark themes. It covered public intake, Parent multi-child intake and attachment, Staff own requests, in-person complaint recording, triage, assignment, messages/notes, resolution, Director oversight, delegated Accountant/Computer Operator queues and Viewer suppression. No real person, complaint or attachment was used. Visible actions were at least 44 px, focus was visible, no page-level horizontal overflow occurred and all production-runtime stderr logs were empty.

Final sequential verification passed:

- 324 page routes and 515 API routes;
- lifecycle backfill dry run with zero changed rows;
- full partitioned typecheck;
- 196 test files passed and one skipped, with 1,744 tests passed and three governed skips;
- clean production build with the bounded 4 GB Node heap;
- logical backup version 37;
- Git safety.

Migration and recovery evidence:

- migration chain: 14 migrations, clean after deploy;
- pre-migration operational SHA-256: `78960F7700A9E89CF1D05FA9B1EAE09C7E101886F8F22A6C1D3D88BCD0506F18`;
- protected byte-identical rollback SHA-256: `78960F7700A9E89CF1D05FA9B1EAE09C7E101886F8F22A6C1D3D88BCD0506F18`;
- post-migration operational SHA-256: `5305C7EBCD5EE68B8976F3A7707FBCE73A8904457C3928ADC4545F3C66EDDE54`;
- business fingerprint unchanged;
- protected-account fingerprint unchanged;
- zero Students, active enrolments, payments, Guardians, Staff, support requests and support attachments;
- four protected users, four role assignments and zero sessions unchanged.

No live Email, SMS or WhatsApp provider was activated. No deployment or real-user onboarding is authorised. Privacy, retention and legal wording remains `DRAFT_PENDING_APPROVAL`. Next governed phase: `OBS-1A`.

Result: `SUPPORT_COMPLAINTS_CLEARED`.
