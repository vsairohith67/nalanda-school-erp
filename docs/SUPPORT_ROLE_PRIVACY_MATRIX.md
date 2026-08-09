# Support role and privacy matrix

| Context | Permitted scope | Explicit exclusions |
| --- | --- | --- |
| Public/pre-login | Create one unverified limited login/account/technical/admission request | No lookup, reset, activation, Student/Staff disclosure or request browsing |
| Parent | Own requests in active Parent role; only opaque linked-child handles revalidated server-side | No other family, removed link, Teacher context, internal note or direct record mutation |
| Staff | Own technical/HR/service requests | No colleague request, salary, payslip, private complaint or confidential HR note |
| Principal | Granted academic/general/safety scope | No salary/payslip or leadership-only complaint by default |
| Accountant | Assigned Finance queue only | No academic, HR or complaint browsing |
| Computer Operator | Assigned Technical queue only | No unrelated Parent/Staff cases |
| Director/Super Admin | Governed oversight including escalated/urgent and exact restricted permissions | Routine notifications avoid unnecessary flooding; content remains permission-gated |
| Viewer | Explicit aggregate report only with low-count suppression | No complaint text, internal notes, attachment paths or reidentifiable small groups |

Navigation never substitutes for API authorization. `RESTRICTED`, `SAFEGUARDING` and `LEADERSHIP_ONLY` require exact effective permissions.
