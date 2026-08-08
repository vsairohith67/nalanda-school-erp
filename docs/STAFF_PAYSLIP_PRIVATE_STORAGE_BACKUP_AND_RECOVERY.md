# Staff Payslip Private Storage, Replacement and Recovery

## Storage and replacement

The source is stored as an encrypted management asset and the delivery file as a protected derivative under private, opaque paths. Both hashes, byte sizes, page count and source-to-version linkage are recorded. Symlinks, traversal and public/static paths are refused.

Issued bytes are immutable. Replacement requires an authorised actor, reason, new source upload, new derivative, new opening password, new hashes and an explicit supersedes link. One transaction selects the single active replacement. The former version remains management-auditable as `REPLACED` and is unavailable to ordinary Staff.

## Backup contract

Backup version 37 includes request roots, months, append-only events, document/version/month links, encrypted password envelope and key-version metadata, SHA-256 values, replacement links and policy-approved access events. The encrypted private-asset bundle carries source and derivative bytes.

Backups exclude plaintext opening/owner passwords, encryption keys, authentication-session secrets, temporary processing files and any password-hash material excluded by the base backup policy.

Restore must be idempotent when run once and twice. It verifies exact file hashes and relational links, refuses duplicate versions, refuses corrupt assets and fails closed when the external key is missing or wrong. With the correct separately managed key, the restored envelope recovers the Staff opening password and the protected PDF remains openable.

## Retention boundary

The schema records retention-review date, archive status and legal/policy hold. No statutory duration is invented and no automatic destructive purge is implemented. A future purge feature must first provide a governed preview and receive school-policy and professional review. Disabling a User or ending employment removes portal access but does not silently delete retained management evidence.
