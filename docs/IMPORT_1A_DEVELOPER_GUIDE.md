# IMPORT-1A Developer Guide

The implementation is intentionally additive. Domain writes remain in
`lib/onboarding.ts`; OOXML generation/parsing in
`lib/onboarding-workbooks.ts`; opaque filesystem handling in
`lib/onboarding-storage.ts`; API error/no-store helpers in
`lib/onboarding-api.ts`; and presentation in
`components/onboarding-centre.tsx`.

When adding a field, first prove the current domain model and privacy policy
support it. Then update the header constant, template data dictionary,
normaliser, validation issue code, dry-run summary, execution mapping,
row-lineage test, backup/recovery treatment and documentation. Never infer a
new sensitive field from common school forms.

Template/schema versions are immutable contracts. Breaking headers, reference
semantics or normalisation requires a new version and compatibility test.
Do not loosen parser allowlists to accept a problematic workbook; regenerate a
controlled template instead.

All mutations require exact server permissions and unsafe-origin protection.
Approval/execution/rollback must keep re-authentication, bounded reasons,
workbook/plan hashes and optimistic versions. Preserve one transaction and
fixed import order. Never create active Users or credentials in this module.

Tests must cover generated OOXML, adversarial containers/cells, Unicode and
date/phone normalisation, duplicate decisions, reference/orphan checks, exact
permissions, backup privacy, copied-database atomicity/idempotency/rollback and
Browser role/mobile/accessibility evidence. Use only synthetic fixtures and an
ignored copied database/private-storage root. Serialize Browser, full suite and
build checks.

Backup version 41 excludes private workbook bytes. Any restore change must
remain idempotent and fail closed as `RECOVERY_REQUIRED` unless a separately
verified encrypted asset is available. OBS-1A events and jobs must remain
aggregate-only and use safe fingerprints.
