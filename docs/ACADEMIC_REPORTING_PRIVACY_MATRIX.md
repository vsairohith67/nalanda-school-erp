# Academic Reporting Privacy Matrix

| Role | Allowed scope | Direct Student detail | Export rule |
| --- | --- | --- | --- |
| Director / Principal | Governed school, year, class and section | Yes, where required by the chosen report | Authenticated private CSV/PDF |
| Teacher | Exact active year/class/section/subject assignment | Only assigned report scope | Authenticated private export of exact scope |
| Parent | Active linked child and exact active-year enrolment | Linked child only, current issued versions | Private linked-child export |
| Student | Self admission alias and exact active-year enrolment | Self only, current issued versions | Private self export |
| Viewer | Governed aggregates | Never | Names/admission numbers removed; cohorts below five suppressed |
| Accountant and other roles | Denied unless a future governed permission explicitly adds scope | No | Denied |

Server-side scope is resolved on every request. Raw internal actor IDs are not
returned or included in exported audit details. There is no Teacher ranking,
Staff surveillance, Parent read-surveillance, public predictable path or PII
logging. Viewer suppression is applied before sections and exports are built so
the private rows cannot be reconstructed client-side.
