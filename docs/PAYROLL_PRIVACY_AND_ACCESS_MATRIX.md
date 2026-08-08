# Payroll Privacy and Access Matrix

| Context | Default access | Boundary |
|---|---|---|
| Super Admin / Director | Governed oversight | Exact permissions; critical actions re-authenticate |
| Accountant | Prepare, calculate, submit, manage requests and reports | Cannot approve, lock, reverse or disburse |
| Principal | Denied | Leadership designation does not imply salary access |
| Admin / Computer Operator | Denied | Immutable finance/payroll denial applies |
| Staff / Teacher | Own linked records and advance request only | Server resolves exact `User -> StaffMember` link |
| Teacher + Parent | Staff/Teacher context only | Parent context has no payroll permission or navigation |
| Viewer | Denied unless separately granted aggregate permission | Groups under three are suppressed; no identity rows |
| Parent / Student / Public | Denied | No payroll routes, navigation or data |

Ordinary Staff lists, public pages, AI Assistant sources, communication templates, PWA/offline caches, broad exports and general analytics exclude salary information. Report exports contain bounded approved-run summaries, formula-safe cells and no raw database IDs, credentials, full identity identifiers or Staff ranking.

Payslip downloads require authentication, exact permission and `private, no-store` responses. Employee downloads additionally require exact ownership. URLs use issued references but are never public; tampering returns the same safe not-found response. Payslip snapshots omit Aadhaar, PAN, UAN, full bank details, passwords, internal database IDs and private audit data.
