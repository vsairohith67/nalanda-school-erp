# V1 Known Limitations and Deferrals

- Communications are in-app/MOCK only until provider, consent, legal, budget and deployment approval.
- SQLite is single-instance; horizontal scaling is not supported.
- qpdf and backup encryption keys require approved external operational configuration.
- Payroll automation/ESS operational rollout and KG/LKG/UKG report-card activation are V1.5 operational gates; KG software itself is cleared and default-off.
- Transport and cafeteria are optional V1.5 decisions. Their Optional Operations branch is implemented and independently tested but release-blocked by the external GitHub Actions billing gate; it is not merged or a current-main school service.
- Public deployment, real-data import, real-user activation, domain/DNS and production cutover are not authorized.
- Historical Schoolknot evidence gaps remain vendor evidence gaps; absence was never inferred as feature absence.
- Physical report acceptance applies to the approved Classes I-X R8 family and recorded Canon/A4 conditions; future layout edits require a new governed version.
- Parent Meetings is implemented with focused QA on a separate branch but remains `BLOCKED_BY_EVIDENCE / RELEASE_BLOCKED`; it is not a current-main capability.
- `FINAL-SCOPE-QA-1A` found that `real-data-imports`, `public-admissions-form` and `payroll-ess-pilot` are committed default-off but are not enforced by their active server-side write surfaces; `bulk-exports` lacks a governed surface map. Release acceptance remains blocked until corrected and independently rerun.
- Dependency audits currently retain one Critical and two High findings in the full graph, including one production High. No corrected-scope release may clear until the mandatory Critical/High gate is resolved or conclusively shown non-applicable.
