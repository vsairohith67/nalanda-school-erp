# V1 Release-Candidate Manifest

**Candidate branch:** `release/v1-final-integration-acceptance`
**Protected base:** `16154c395459dcfe27052204c4dbcecfa7ddd169`
**Schema:** 18 migrations; backup v41
**Routes:** 333 pages / 547 APIs
**Data boundary:** zero-business operational baseline; synthetic copied-database QA only

Included: all cleared V1 modules, security remediations, exact scale harness and acceptance documents.

Final local/private gates: full split-project typecheck; 215 passing test files and 1,913 passing tests; three qpdf runtime tests skipped until the required binary/hash configuration is supplied; production build with 283 generated pages; 333 page routes / 547 APIs; fresh/copied migration and restore; Release Operations package/failure rehearsal; exact operational fingerprint preservation; and representative in-app Browser role/responsive/accessibility acceptance.

Browser-discovered correction: Teacher classwork now renders a fail-closed no-scope state for the two expected missing/empty timetable-scope codes instead of a generic production error. This does not relax API or mutation authorization.

Excluded: deployment, DNS, live providers, real school data, real user activation, production cutover, KG/LKG/UKG activation and V1.5 payroll activation.

This manifest permits feature-branch release-candidate QA only. Main merge and final V1 tag require independent `V1-FINAL-1A-QA` clearance.
