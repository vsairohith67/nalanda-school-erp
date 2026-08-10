# Release Environment and Secret Contract

The authoritative validator is `validateReleaseEnvironmentContract`. Values are injected by each runtime and are never committed. `.env.example` contains names/placeholders only.

| Class | Examples | Owner | Rotation/revocation |
| --- | --- | --- | --- |
| `REQUIRED_SECRET` | authentication signing and private-backup encryption keys | Super Admin plus designated technical owner | Rotate after suspected exposure, role change or scheduled review; invalidate dependent sessions/artifacts deliberately. |
| `REQUIRED_NON_SECRET` | environment, release ID/channel, application origin, reviewed commit `SOURCE_DATE_EPOCH` | Release owner | Change only through a reviewed release manifest. Packaging refuses a missing or invalid source epoch. |
| `OPTIONAL_DISABLED_PROVIDER` | provider enable switch | Business owner plus Super Admin | Defaults false; revoke credential first, then confirm disabled configuration. |
| `BUILD_TIME_PUBLIC` | PWA build ID | Release owner | Changes with each client build; contains no secret. |
| `RUNTIME_PRIVATE` | database URL, private storage and backup roots | Infrastructure owner | Separate by environment; revoke access and repair ownership before restart. |
| `STAGING_ONLY` | staging banner/noindex controls | Release owner | Must remain present in staging. |
| `PRODUCTION_ONLY` | separately governed approval reference | Named approver | Single release/window; cannot be reused as standing authority. |

Fail-closed validation rejects placeholders, development passwords, operational `dev.db` in every release environment, HTTP production-shaped origins, insecure cookies, mixed release IDs, shared staging/production database or storage, source-tree/path escape, partial provider configuration, debug flags, malformed/short keys, disabled-provider credentials and committed release environment files. Production mutation phases additionally require `NALANDA_PRODUCTION_RELEASE_AUTHORIZED=true` and a safe `--approval-id` that exactly matches the separately injected `NALANDA_PRODUCTION_APPROVAL_ID`; neither value is standing authority.

## Rotation

1. Enter a governed maintenance window when a credential affects active sessions or encryption.
2. Identify the owner, affected environment, release ID and dependent clients/artifacts without printing the secret.
3. Generate/store the new value in the approved private secret store.
4. Deploy the compatible configuration, verify health, then revoke the old value.
5. For encryption keys, preserve required historical key access until all retained artifacts are re-encrypted or expired.
6. Record a privacy-safe audit event and confirm no secret entered Git, logs, notes or chat.

## Emergency revocation

Disable the capability or provider first, revoke the credential at its source, invalidate affected sessions/signatures, keep maintenance active where integrity is uncertain, run Git/secret scanning and open a restricted incident. Do not paste compromised material into incident, Asana, Notion, GitHub, Basic Memory or Canvs records.
