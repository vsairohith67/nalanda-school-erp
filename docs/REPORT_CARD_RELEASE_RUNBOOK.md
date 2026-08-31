# Report Card Release Runbook

## Before release

- [ ] Confirm exam scheme, assessments, marks sheets, moderation/calculation and report template are the approved versions.
- [ ] Confirm ordinary Teachers have no permanent marks-write authority and any `MARKS_ENTRY_OPERATOR` assignment is exact, active and conflict-checked.
- [ ] Confirm every target report is approved, frozen and ready to issue; unpublished/replaced versions remain private.
- [ ] Generate synthetic individual PDFs and governed bulk-print output. Inspect A4, colour and true-monochrome/printer-safe rendering.
- [ ] Confirm Parent access is issued-only and limited to an active linked child.

## Release

1. Principal, Director or Super Admin issues the approved batch using the existing confirmation and current server-owned permission policy.
2. Record batch/version, count, issuer and timestamp.
3. Run Parent checks: correct child, sibling, wrong child, inactive link, unpublished report, replaced/frozen report and concurrent sessions.
4. Confirm downloads are private/no-store and bulk print requires its governed permission.
5. Monitor errors and support queue. Do not publish through public storage or messaging providers.

## Stop conditions

Stop immediately for cross-child access, pre-issue visibility, wrong version, missing marks lock, changed totals, PDF page corruption, authorization ambiguity or a private-data flash. Revoke access/session as appropriate, preserve evidence and use the security/support runbooks.
