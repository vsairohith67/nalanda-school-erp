# Portable configuration and secrets

For the synthetic MinIO overlay, `minio_root_access_key` and `minio_root_secret_key` are bootstrap-only secrets. `s3_access_key_id` and `s3_secret_access_key` identify the module-prefix application principal. `s3_backup_access_key_id` and `s3_backup_secret_access_key` identify the backup-prefix principal and are mounted only into the backup command. Provider overlays must preserve these identity and prefix separations with native IAM or an equivalent policy mechanism.

`lib/portable-runtime/config.ts` is the fail-closed contract for environment, origin, PostgreSQL, command-specific `DIRECT_URL`, TLS, Valkey, object storage, backup destination, trusted proxy, secrets, metrics, logging, native origins/version, maintenance, and default-off operational features.

Secrets can arrive as a provider-injected environment value or `<NAME>_FILE`. Governed deployments should mount files under `/run/secrets`; the reader rejects unsafe names, symlinks, non-files, oversized values, broad paths, and simultaneous value/file configuration. Public errors never include values.

The local generator requires `NALANDA_SYNTHETIC_STAGING=true`, writes random files with restrictive modes under ignored `tmp/portable-staging`, refuses overwrite without `--replace-local`, and never prints values. These files must never be reused remotely.
