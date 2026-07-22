# Disaster Recovery Runbook

Review date: 2026-07-19  
Scope: Nalanda encrypted ERP database backups (`.npsbackup`)  
Never restore over, rename, replace, or delete the operational SQLite database.

## Before an incident

1. Keep every required `CLOUD_BACKUP_ENCRYPTION_KEY_Vn` in at least two controlled offline locations. Record custodians without key values.
2. Configure an external scheduler; a Prisma schedule does not run itself.
3. Monitor `cloud-backup:health` and `/cloud-backup`.
4. Require read-after-write `VERIFIED`, not merely uploaded.
5. Run isolated rehearsals periodically and after schema/restore changes.
6. Keep at least two newest verified copies; preview retention first.
7. Track separately that private OCR/uploaded bytes are not covered.

## Incident triage

1. Stop unrelated writes if corruption/host compromise is suspected.
2. Do not delete failed, unverified, or key-unavailable artifacts.
3. Select the latest `VERIFIED` artifact, not the latest attempt/file.
4. Review its key version, hashes, provider, verification chain, and passed rehearsal.
5. Retrieve the historical key only through approved offline custody. Never paste it into a Browser form, chat, ticket, log, or report.
6. Record the recovery point: changes after `sourceGeneratedAt` may need reconciliation.
7. Record RTO target and approvers.

## Safe verification

With the matching environment key and LOCAL_FOLDER available:

```powershell
pnpm.cmd cloud-backup:health
pnpm.cmd cloud-backup:inspect
pnpm.cmd cloud-backup:verify
```

Usability requires ciphertext hash, AES-GCM authentication, decompression, plaintext hash, and schema validation. ETag/existence/size/download alone is insufficient.

For `KEY_UNAVAILABLE`, recover the exact historical version through custody; do not prune it. For hash/auth/schema failure, preserve metadata, quarantine that artifact from restore, and select an older verified/rehearsed copy. Never bypass validation or “repair” ciphertext.

## Mandatory isolated rehearsal

Run:

```powershell
pnpm.cmd cloud-backup:rehearse
```

Or use **Run Isolated Restore Rehearsal**. Required evidence:

- run/artifact were `VERIFIED`;
- historical key version matched;
- both restore passes had zero entity errors;
- first/second aggregate digests matched;
- ownership/link validation passed;
- operational database hash did not change during isolation;
- rehearsal DB and SQLite sidecars were removed;
- final status is `PASSED`.

If any item fails, recovery is not proven.

## Operational recovery boundary

Prompt 20C does not automate production cutover. There is no Browser destination chooser, destructive restore API, or command overwriting the operational DB.

A real cutover needs a separately approved maintenance procedure: preserve the current database as incident evidence; create a new isolated recovery path; restore/validate there; reconcile totals, workflows, receipts, ownership, and RPO gap; obtain leadership approval; change deployment configuration during a controlled window; and retain rollback evidence.

Do not perform this from Browser QA.

## Key loss

Artifacts cannot be recovered without their exact historical key. The application stores only `Vn`. No override can decrypt a lost-key artifact. Rotation affects new runs only. Do not prune old artifacts merely because a key is temporarily unavailable.

## Provider outage or object loss

Preserve Prisma metadata; never mark an unavailable object verified; do not auto-fallback to another live provider; use an independently verified copy. For LOCAL_FOLDER, verify the approved medium is mounted at the environment path and no symlink was substituted. Create and verify a new artifact before later retention.

## Retention incident safety

Run `pnpm.cmd cloud-backup:retention-preview` and inspect exact identities, reasons, protected newest/rehearsal copies, and post-prune count. `cloud-backup:prune` additionally requires auto-prune, a verified latest run, provider health, and minimum copies. Never use provider prefix/delete-all.

## Private assets

The database artifact excludes OCR source images and other private uploaded bytes. Report:

> Database backup verified. Private uploaded assets are not included in this backup.

Recover those assets only through a separately approved system.

## Post-recovery checks

Verify application/schema, authentication/roles, Student/enrollment totals, Payment/collection totals, receipts, collection/dues/ledger/Cash Book invariants, settings/year, scheduler/backup health, communication counts without resend, OCR posting disabled, PWA cache exclusions, and a newly verified/rehearsed encrypted backup.

Record recovery point/time, reconciled/lost changes, artifact/key version, approvals, and results without keys, credentials, decrypted data, personal records, absolute paths, or provider payloads.

## Current limitations

- No live call in Prompt 20C.
- OBJECT_STORAGE/GOOGLE_DRIVE disabled.
- MOCK is process-local.
- LOCAL_FOLDER is off-device only when configured to separate media.
- External scheduler setup remains operational.
- Private OCR/uploaded bytes excluded.
- Provider object lock/ransomware resistance not claimed.
- Operational DB cutover deliberately absent.
- Prompt 20D is out of scope.
