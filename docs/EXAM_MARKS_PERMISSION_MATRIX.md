# Examination Marks Permission Matrix

Status: `SUPERSEDED_BY_ACADEMIC_INTEGRITY_V1_1` for all Teacher write rows. This table records the earlier V1 design; it is not current authority.

## v1.1 authoritative matrix

| Capability | Teacher | Delegated non-teaching operator | Principal | Director | Super Admin |
|---|---:|---:|---:|---:|---:|
| View existing authorised academic reports | Existing read policy only | Exact workspace only | Yes | Existing read policy only | Yes |
| Save or import marks | **No** | Exact active grant only | Yes | No | Yes |
| Submit marks | **No** | Exact active grant only | Yes | No | Yes |
| Correct/request reopen | **No** | Request only where exact profile permission applies | Yes | No | Yes |
| Moderate/reopen/calculate/lock | **No** | No | Yes | No | Yes |
| Manage delegation | **No** | No | Yes | No | Yes |

Assignment-derived authority is prohibited. The `MARKS_ENTRY_OPERATOR` profile is explicit, auditable, revocable, session-invalidating and bounded to academic year/exam/class/section/subject or component as supported. See [Academic Integrity v1.1](ACADEMIC_INTEGRITY_V1_1_PRINCIPAL_MARKS_ENTRY.md).

## Historical V1 matrix

| Capability | Teacher | Principal | Director | Super Admin |
|---|---:|---:|---:|---:|
| View own exact marks assignments | Yes | No | No | By explicit grant |
| Save assigned marks | Yes, exact scope | No | No | By explicit grant |
| Final submit | Primary only | No | No | By explicit grant |
| Request correction | Primary/assigned Teacher | No | No | By explicit grant |
| View moderation dashboard | No | Yes | Yes | Yes |
| Moderate submitted sheet | No | Yes | Yes | Yes |
| Reject/reopen correction | No | Yes | Yes | Yes |
| Run calculation preview | No | Yes | Yes | Yes |
| Lock calculation | No | Yes | Yes | Yes |
| Super Admin intervention | No | No | No | Separate permission and reason |

The dedicated tokens are:

`VIEW_OWN_EXAM_MARKS`, `ENTER_ASSIGNED_EXAM_MARKS`,
`SUBMIT_ASSIGNED_EXAM_MARKS`, `REQUEST_EXAM_MARK_CORRECTION`,
`VIEW_EXAM_MODERATION`, `MODERATE_EXAM_MARKS`,
`REOPEN_EXAM_MARK_SHEETS`, `RUN_EXAM_CALCULATIONS`,
`LOCK_EXAM_CALCULATIONS`, and `INTERVENE_EXAM_MARKS`.

The UI follows effective permissions, but every API repeats permission and
object-level checks server-side.
