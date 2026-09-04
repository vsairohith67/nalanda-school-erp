# Role Template Catalogue

The runtime catalogue in `lib/real-user-access/catalogue.ts` is derived from the current canonical server permission map. It has 14 entries: 11 implemented base roles and three specialised profiles. Names are descriptive only; actual authority comes from server-side permission evaluation in the selected active-role context.

| Template | Type | User class | MFA | Review | Key boundary |
| --- | --- | --- | --- | --- | --- |
| `SUPER_ADMIN` | base | leadership | mandatory | 90 days | explicit active context; two distinct leadership approvals and step-up |
| `DIRECTOR` | base | leadership | mandatory | 180 days | school-wide oversight subject to service separation |
| `PRINCIPAL` | base | leadership | mandatory | 180 days | academic oversight; no implicit delegated marks role |
| `ADMIN` | base | Staff | mandatory | 180 days | approved operational scope only |
| `ACCOUNTANT` | base | Staff | mandatory | 90 days | finance scope; Parent context remains separate |
| `COMPUTER_OPERATOR` | base | Staff | mandatory | 90 days | temporary by default; no automatic IAM authority |
| `GATE_STAFF` | base | Staff | recommended | 180 days | exact gate/campus scope |
| `TEACHER` | base | Staff | recommended | 180 days | active assignments only; permanent marks write denied |
| `PARENT` | base | Guardian | recommended | 365 days | active linked children only |
| `STUDENT` | base | Student | recommended | 365 days | own active Student context and policy gate |
| `VIEWER` | base | approved person | recommended | 180 days | temporary read-only subset by default |
| `MARKS_ENTRY_OPERATOR` | permission profile | Staff | mandatory | 30 days | exact exam/subject/class scope and expiry |
| `ATTENDANCE_OPERATOR` | permission profile | Staff | mandatory | 90 days | prepare/submit only; no lock/correction approval union |
| `UDISE_DATA_OPERATOR` | planned profile | Staff | mandatory | 30 days | masked checklist planning only; no official export authority |

Every machine-readable entry also publishes permitted/prohibited modules, exact permissions, high-risk permissions, mandatory training, approval rule, incompatibilities, expiry policy, active-role restriction and linked-object scope.

## Review-required combinations

The catalogue surfaces deterministic warnings without inventing unsupported blanket prohibitions. Current examples include Teacher plus Marks Entry Operator, leadership plus delegated marks operation, Super Admin plus Computer Operator, Parent plus broad administration/finance/operator roles, finance prepare plus approve, and attendance submit plus lock. Preparer and final approver must differ independently of role composition.

Warnings do not grant access. Approval must resolve the conflict, bound scope/expiry, and preserve immutable denials. Marks Entry and Attendance profiles remain time-bounded and exact-scope. The active lower-privilege role never inherits the union of other assignments.

## Parity contract

Navigation visibility is advisory; page, API, service, export, native and Offline Sync checks all use the same canonical server permissions and active assignment. A navigation/server mismatch is a defect. Planned templates carry no runtime power until a governed profile exists.

