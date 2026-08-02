# Events Audience and Privacy Matrix

| Audience | Parent | Teacher | Principal/leadership | Required exact scope |
|---|---|---|---|---|
| School-wide | Published only | Published only | Draft/history with permission | Current academic year |
| Parents all | Published only | No unless separately authorised | Managed with permission | Parent role context |
| Staff only | Never | Published with Staff scope | Managed with permission | Active Staff link |
| Role specific | Matching active role only | Matching active role only | Managed with permission | Active server-held role context |
| Class | Linked child only | Assigned class only | Managed with permission | Active class/enrollment or timetable assignment |
| Class section | Linked child only | Assigned section only | Managed with permission | Exact active section |
| Linked-child cohort | Linked child only | Assigned cohort only | Managed with permission | Active Guardian/enrollment or timetable assignment |
| Leadership only | Never | Never for ordinary Staff | Matching leadership role | Active leadership assignment |

Draft, internal notes, actor identities and attendance diagnostics never enter Parent/Teacher DTOs. Permission alone cannot grant an unrelated Student, family, class or Staff object. Client-supplied role, Student, Staff, class and section identifiers are not authorization evidence. Removed Guardian links, inactive roles and stale context handles fail closed on every request.

