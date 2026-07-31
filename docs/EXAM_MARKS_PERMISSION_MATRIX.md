# Examination Marks Permission Matrix

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
