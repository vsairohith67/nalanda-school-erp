# Portable backup and restore

The portable backup command uses a backup-only object-store identity restricted to `private/backups/*`. The uploaded object version is retained with the run; pruning requires that exact version, deletes that version, verifies it is gone, and only then marks the artifact `PRUNED`. Transient provider-unavailable, throttling and 5xx failures enter the existing bounded retry schedule.

Nalanda backup v44 is serialized, validated, compressed, encrypted with AES-256-GCM, uploaded only as a recognized encrypted container, read back, checksum-verified, decrypted, and schema-validated. The portable destination maps safe backup identities into the private S3-compatible store. Keys are externally mounted and never stored in the artifact or database.

The synthetic rehearsal restores into disposable PostgreSQL schemas, applies exact migrations first, runs the validated logical restore twice per target, compares bounded counts, repeats in a second target, and drops both schemas. Restore never targets the source database.

Database backups do not embed private-object bytes. Object durability therefore also requires bucket versioning plus provider-approved off-host replication/snapshot policy; that is a mandatory provider-adapter gate. Local timings are evidence, not an RPO/RTO SLA.
