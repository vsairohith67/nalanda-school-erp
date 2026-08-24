# V1 Known Limitations and Deferrals

- Communications are in-app/MOCK only until provider, consent, legal, budget and deployment approval.
- SQLite is single-instance; horizontal scaling is not supported.
- qpdf and backup encryption keys require approved external operational configuration.
- Payroll automation/ESS operational rollout and KG/LKG/UKG report-card activation are V1.5 operational gates; KG software itself is cleared and default-off.
- Transport and cafeteria software foundations are cleared on current main and remain operationally default-off. Nalanda still has no activated transport or cafeteria service; real data, deployment and operational use require separate authorization.
- Public deployment, real-data import, real-user activation, domain/DNS and production cutover are not authorized.
- Historical Schoolknot evidence gaps remain vendor evidence gaps; absence was never inferred as feature absence.
- Physical report acceptance applies to the approved Classes I-X R8 family and recorded Canon/A4 conditions; future layout edits require a new governed version.
- Parent Meetings software is cleared on current main and remains operationally default-off; real use and Search/Smart AI integration require separate authorization.
- `FINAL-SCOPE-QA-1A` found that `real-data-imports`, `public-admissions-form` and `payroll-ess-pilot` are committed default-off but are not enforced by their active server-side write surfaces; `bulk-exports` lacks a governed surface map. Release acceptance remains blocked until corrected and independently rerun.
- Current production and full dependency audits report zero findings at every severity. This does not override the remaining runtime feature-flag blocker.
