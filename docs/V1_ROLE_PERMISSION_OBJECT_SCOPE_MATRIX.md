# V1 Role, Permission and Object-Scope Matrix

| Role/context | Intended V1 access | Required server-side object scope | Hard boundary |
| --- | --- | --- | --- |
| Super Admin | Security, IAM, recovery, technical and release detail | Active Super Admin assignment and current session/version | Last active Super Admin cannot be removed; critical actions re-authenticate |
| Director | Leadership operations and approved summaries/actions | Active Director assignment; action-specific permission | No implicit Super Admin, restore or unrestricted release execution |
| Principal | Academic leadership and approved staff/student workflows | Active Principal assignment plus exact workflow scope | No finance/IAM escalation without explicit delegable grant |
| Admin | Operational administration | Named active assignment and exact module permission | No immutable Super Admin/release/restore powers |
| Accountant | Fee and approved finance workflows | Exact receipt/day/ledger permissions and mutable state | No family/child or IAM authority inferred from finance access |
| Computer Operator | Narrow operational entry | Exact named permission; object resolver where required | Immutable finance/IAM escalation denials |
| Teacher | Assigned academic, attendance and classwork workflows | Active Staff link plus timetable/substitute/class/subject scope | No global cohort selector or unrelated learner access |
| Parent | Own linked-child portals | Active Parent assignment, Guardian link, enrolled child handle and context version | No raw Student ID substitution or cross-family access |
| Student | Own learner surfaces | Verified admission alias and exact Student binding | No other learner/Guardian data |
| Viewer | Read-only approved aggregates | Suppressed aggregate or specifically granted non-private view | No exports, ledger detail, mutation or private-record access |

Permission grants never bypass immutable role restrictions or an object-scope resolver. Multi-role users use one active server-side role context; permissions are not unioned across roles.
