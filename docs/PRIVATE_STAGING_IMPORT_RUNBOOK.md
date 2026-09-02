# Private Staging Import Runbook

Status: future runbook; **do not execute until every entry gate is approved**.

## Stop before receipt

- Repository is private; private HTTPS staging and provider/account ownership are approved.
- Exact domains/waves, data owners, operators/reviewers, privacy/retention and maintenance window are approved.
- Secure transfer and encrypted original/working/report/backup storage exist.

## Receipt and dry run

1. Source Custodian records inventory and chain of custody without exposing values in trackers.
2. Technical Operator captures source size/SHA-256 and preserves immutable original bytes.
3. Scan files; create normalized working copies; validate manifest/checksums/formats.
4. Validate mapping version and generate a private dry run.
5. Domain/Privacy/Finance Reviewers decide mappings, sensitive fields, duplicates, references and reconciliation.
6. Regenerate after every source/mapping decision change; compare exact package/mapping/report hashes.

## Rehearsal and import

7. Capture encrypted logical/raw/private-asset backups and verify hashes.
8. Restore to a separate isolated environment and rehearse exact waves plus rollback.
9. Final Owner approves exact package, mapping, wave, expected counts/totals and rollback class.
10. Execute one wave through its separately approved service contract and batch ID; never through this preparation CLI.
11. Reconcile immediately. Stop on changed hashes, unapproved fields, unexplained finance difference, unresolved reference, user activity or unexpected write.

Real users stay inactive. Production cutover and user activation are separate decisions.
