# Examination Timetable Lifecycle

`ExaminationTimetableVersion` is the smallest additive layer over the existing governed `Examination`, `ExaminationClassScope`, `ExamSubjectPaper`, class/section and academic-year models. Rows snapshot Parent-facing subject/paper labels, date, start/end/reporting time, optional venue and bounded instructions. `ExaminationTimetableEvent` is append-only audit evidence.

Lifecycle:

```text
DRAFT -> READY_FOR_PUBLICATION -> PUBLISHED
  |              |                    |
  |              +-> DRAFT            +-> REPLACED -> ARCHIVED
  +-> ARCHIVED                         +-> WITHDRAWN -> ARCHIVED
```

- `DRAFT`: editable; rows may be added, replaced or removed.
- `READY_FOR_PUBLICATION`: validated snapshot awaiting an authorised publish action.
- `PUBLISHED`: immutable current Parent-visible version.
- `REPLACED`: immutable former publication linked to its successor.
- `WITHDRAWN`: immutable history, no longer Parent-visible.
- `ARCHIVED`: retained history outside the active workflow.

Database triggers prevent mutation/deletion of published history, row changes outside draft, and update/delete of audit events. A unique current-publication key prevents two current published versions for one examination cohort. Backup version 37 contains versions, rows and events inside the governed examination graph; restore creates rows while versions are transactionally staged as draft, then restores their immutable final states.
