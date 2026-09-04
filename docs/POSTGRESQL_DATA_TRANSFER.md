# SQLite to PostgreSQL logical data transfer

The committed transfer command is a synthetic rehearsal tool only. It fails closed unless `POSTGRES_READINESS_SYNTHETIC_QA=1`, the SQLite source is below this worktree's `tmp/` directory, and the PostgreSQL restore target is a loopback database whose name contains `qa`, `ci`, `synthetic`, or `test`. It cannot be used for an operational database migration.

Transfer, manifest, and restore-evidence files are created exclusively with owner-only permissions. Existing files and linked paths are refused. A separately authorized operational migration must use an approved encrypted, access-controlled mechanism.

## Format

Nalanda uses governed logical backup version 45, including the communication durability records while retaining v44 restore compatibility. Password hashes, token material, database URLs, and provider credentials are excluded.

## Rehearsed sequence

1. Create and migrate an isolated SQLite database under ignored temporary storage.
2. Seed synthetic data only.
3. Export backup v45 and deterministic per-collection counts/checksums.
4. Deploy the PostgreSQL baseline to an empty disposable database.
5. Restore through existing provider-neutral restore orchestration.
6. compare business keys, relationships, money totals, status distributions, and immutable/security state;
7. restore the same package again and require no additional logical records or financial events.

The local rehearsal exported 275 durable collection keys, eight Students and eleven Payments. PostgreSQL replay preserved the eight Student business records, eleven Payment records, and exact Payment total of 92,100, then produced no change on the second restore. Internal IDs may be remapped by the existing restore design, so checksums use stable business keys and relations rather than provider-generated IDs.

No operational SQLite file is a source for this phase. A later pilot must take a separately authorized copy, record before/after hashes, rehearse, reconcile every domain, and obtain a human go/no-go before any application endpoint changes.
