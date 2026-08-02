# Academic Calendar Developer Guide

Core policy is in `lib/academic-calendar.ts`; client-safe labels are in `lib/academic-calendar-shared.ts`; DTO redaction/private responses are in `lib/academic-calendar-api.ts`. Do not authorize from navigation, scalar `User.role`, request-body IDs or permission alone. Use IAM role/child context, then the exact Parent or Teacher object resolver.

Keep `OperationalCalendarDay` separate from `SchoolCalendarEventVersion`. Preserve published rows and append audits; changes use replacement/withdrawal. Examination integration stores a reference to a current published version and never duplicates timetable rows. Attendance/report-card basis fields are evidence snapshots, not a recalculation command.

Run schema validation, the focused calendar tests, `pnpm.cmd qa:23e` on an ignored copied database, production Browser batches on `qa:23e:browser:*`, then the full low-memory sequence. Use the 4 GB heap only for the final build. Backup format remains 37 and restores calendar/event/audience/replacement/audit evidence without restoring credentials, sessions or temporary artifacts.

Deferred: public website publishing, files/media, registration/ticketing/payment, appointment/transport workflows, live messaging, ICS/feed export and distributed writer support.

