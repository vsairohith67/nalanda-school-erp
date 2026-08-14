# V1 Release-Candidate Manifest

**Candidate branch:** `release/v1-final-integration-acceptance`
**Protected base:** `16154c395459dcfe27052204c4dbcecfa7ddd169`
**Schema:** 18 migrations; backup v41
**Routes:** 333 pages / 547 APIs
**Data boundary:** zero-business operational baseline; synthetic copied-database QA only

Included: all cleared V1 modules, security remediations, exact scale harness and acceptance documents.

Final local/private gates: full split-project typecheck; 216 passing test files and 1,916 passing tests with zero skips under the independently verified qpdf runtime; a production build; 333 page routes / 547 APIs; fresh/copied migration and restore; Release Operations package/failure rehearsal; a zero-vulnerability production dependency audit; exact operational fingerprint preservation; and representative in-app Browser role/responsive/accessibility acceptance.

Browser-discovered correction: Teacher classwork now renders a fail-closed no-scope state for the two expected missing/empty timetable-scope codes instead of a generic production error. This does not relax API or mutation authorization.

Excluded: deployment, DNS, live providers, real school data, real user activation, production cutover, KG/LKG/UKG activation and V1.5 payroll activation.

Independent `V1-FINAL-1A-QA` cleared this manifest for fast-forward merge and annotated release-candidate tag only. It does not permit staging deployment, DNS, provider activation, real data, real users, training, pilot or production cutover.
