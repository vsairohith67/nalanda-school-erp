# Academic Calendar Model and Lifecycle

Prompt 23E adds an internal, authenticated calendar without reusing or publishing public-website content. `AcademicCalendarVersion` owns the operational classification for one academic year and version. `OperationalCalendarDay` records one governed date as working, non-working, half-day, vacation, special working or emergency closure. `SchoolCalendarEvent` is the stable event identity and `SchoolCalendarEventVersion` is its immutable published content. `AcademicCalendarAuditEvent` is append-only evidence.

Operational days and informational events are deliberately separate. Creating an event never changes attendance or working-day status. Published versions are not edited or hard-deleted; changes use a reasoned replacement or withdrawal. Lifecycle transitions are `DRAFT -> READY_FOR_REVIEW -> PUBLISHED`, with `REPLACED`, `WITHDRAWN` and `ARCHIVED` terminal/history states. Expected-version compare-and-set, serializable publication and idempotency keys protect all transitions.

Published event versions contain a frozen audience and scope. A current examination timetable may be referenced read-only; its rows are never copied. Published calendar and event content remains internal, private/no-store and available only through server-resolved role/object scope.

## Publication evidence

Created, submitted, approved and published evidence includes timestamps and governed actors in the append-only audit. Replacements link both directions and preserve the former content. Publication refuses stale versions, invalid ranges, empty audiences, inactive class/section scope and unreasoned changes that intersect posted attendance.

