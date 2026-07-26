# Staging Environment and Secret Matrix

`pnpm deployment:env-check` validates the staging contract without printing values. Real values belong in a provider secret store or root-owned `0600` environment file outside the release, never Git, screenshots, shell history, logs, tickets, Notion, or chat. Outside the explicitly isolated local rehearsal, the validator rejects release-local Next `.env*` files (except `.env.example`) so development defaults cannot shadow host-injected staging secrets.

Legend: R = required for staging runtime; C = conditional; O = optional/tool-only. Owner abbreviations: DevOps, School Director, Security, Messaging, Backup.

## Core deployment, storage, and security

| Name | Purpose | Req | Local type / staging type | Secret | Format and validation | Rotation/fallback | LIVE state / owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `NODE_ENV` | Next production mode | R | `development` / `production` | No | staging exactly `production` | restart after change; no fallback | n/a / DevOps |
| `NALANDA_ENVIRONMENT` | isolation label | R | unset / `staging` | No | exactly `staging` | immutable per environment | n/a / DevOps |
| `NALANDA_DEPLOYMENT_ID` | release/log correlation | R | local label / `staging-<commit>` | No | staging prefix; production terms rejected | changes each release | n/a / DevOps |
| `NALANDA_LOCAL_REHEARSAL` | permits ignored local data root | C | `true` / `false` | No | staging host must use `false`; local also requires isolated QA flag | remove after rehearsal | n/a / DevOps |
| `QA20C_ISOLATED_DATABASE` | destructive-QA isolation proof | C | `true` in local rehearsal / unset | No | paired with ignored `tmp/devops1c` root | no fallback | n/a / DevOps |
| `QA20C_ISOLATED_ROOT` | older cloud-backup QA root | O | ignored path / unset | No | absolute disposable root | delete after QA | n/a / Backup |
| `DATABASE_URL` | Prisma SQLite file | R | disposable `file:` / absolute staged `file:` | Sensitive path | query-free; inside `STAGING_DATA_DIR`; rejects any `dev.db` | backup/maintenance before change; no fallback | n/a / DevOps |
| `STAGING_DATA_DIR` | persistent root | R | ignored absolute root / `/srv/.../data` | Sensitive path | absolute; outside releases (local rehearsal exception only) | move only in maintenance | n/a / DevOps |
| `FEE_REGISTER_OCR_STORAGE_DIR` | private OCR images | R | disposable child / persistent private child | Sensitive path | absolute child of data root, never `public` | migrate in maintenance | OCR live disabled / DevOps |
| `BACKUP_DIRECTORY` | version-37 JSON backups | R | ignored child / persistent private child | Sensitive path | absolute child of data root | retain/move under backup policy | local only / Backup |
| `CLOUD_BACKUP_LOCAL_FOLDER` | encrypted local objects | R | ignored child / persistent private child | Sensitive path | absolute child; provider validates symlinks/object keys | migrate after verification | local encrypted only / Backup |
| `CLOUD_BACKUP_TEMP_DIR` | encrypted-backup temp | R | ignored child / persistent private child | Sensitive path | absolute child; cleanup allowlist | purge stale >24h | local only / Backup |
| `CLOUD_BACKUP_REHEARSAL_DIR` | isolated restore DBs | R | ignored child / persistent private child | Sensitive path | absolute child; DB/sidecars removed | cleanup after every run | local only / Backup |
| `APP_ORIGIN` | CSRF/origin trust | R | localhost / `https://staging...` | No | valid HTTPS staging origin; production root rejected | planned hostname change + restart | n/a / Security |
| `PUBLIC_WEBSITE_URL` | canonical public URL | R | local origin / same staging origin | No | must equal `APP_ORIGIN` | same as origin | n/a / DevOps |
| `PUBLIC_WEBSITE_INDEXING_ENABLED` | robots/indexing gate | R | `false` / `false` | No | exactly false | no fallback | disabled / School Director |
| `SESSION_COOKIE_SECURE` | secure cookie | R | false locally / true | No | exactly true in staging | restart; no insecure fallback | n/a / Security |
| `TRUST_PROXY_HEADERS` | forwarded header opt-in | R | false / true | No | true only with sanitized one-hop mode and loopback listener | disable if proxy bypass exists | n/a / Security |
| `NALANDA_TRUSTED_PROXY_MODE` | prevents flag-only trust | R | disabled / `single-hop-sanitized` | No | exact enum | restart; fail closed | n/a / Security |
| `ENABLE_HSTS` | HSTS response | R | false / true | No | exactly true after HTTPS is verified | disable only during approved TLS incident | n/a / Security |
| `ENABLE_HTTPS_UPGRADE` | CSP upgrade requests | R | false / true | No | exactly true | restart | n/a / Security |
| `NEXT_PUBLIC_PWA_BUILD_VERSION` | service-worker cache version | R | dev label / non-secret release | No | release identifier, no secrets | changes per release | n/a / DevOps |
| `AUTH_SECRET` | session HMAC | R | unique local / unique staging | Yes | >=32 random chars; placeholder/dev strings rejected | dual maintenance plan: rotate, force re-login | n/a / Security |
| `SESSION_SECRET` | legacy fallback HMAC | O | optional / preferably unset | Yes | same strength if used; `AUTH_SECRET` takes precedence | retire after auth rotation | n/a / Security |
| `FIRST_RUN_BOOTSTRAP_TOKEN` | initial synthetic Director gate | R until setup | local random / staging random | Yes | >=32 random chars | remove/rotate after synthetic setup | no operational setup / Security |
| `CLOUD_BACKUP_ENCRYPTION_KEY_V1` | AES-256-GCM backup key | R | disposable / staging-only | Yes | canonical base64 of exactly 32 bytes | add V2, verify/read V1, switch profiles, retain V1 for old backups | local encrypted only / Backup+Security |

## Seed, provider, and privacy secrets

| Name | Purpose | Req | Local / staging | Secret | Validation and rotation | LIVE state / owner |
| --- | --- | --- | --- | --- | --- | --- |
| `SEED_DIRECTOR_PASSWORD`, `SEED_ADMIN_PASSWORD`, `SEED_ACCOUNTANT_PASSWORD`, `SEED_VIEWER_PASSWORD` | transient fresh synthetic seed credentials | C | isolated values / transient secret injection only | Yes | >=16, unique, no documented/default/dev value; rotate accounts immediately and remove variables | synthetic only / School Director+Security |
| `NALANDA_DEMO_SEED_OPT_IN` | documented demo defaults | O | explicit local only / false or unset | No | validator rejects true | disabled / Security |
| `WHATSAPP_MOCK_WEBHOOK_SECRET` | mock webhook HMAC | R | unique local / unique staging | Yes | >=32 random; rotate with mock fixtures | MOCK only / Messaging |
| `WHATSAPP_MOCK_VERIFY_TOKEN` | mock verification | R | unique local / unique staging | Yes | >=32 random | MOCK only / Messaging |
| `WHATSAPP_PHONE_HASH_PEPPER` | contact minimization | R | unique local / unique staging | Yes | >=32 random; rotation invalidates hashes/consent and needs governed re-derivation | MOCK only / Security+Messaging |
| `WHATSAPP_GRAPH_API_VERSION` | adapter version metadata | O | `v25.0` default / optional | No | `vN.N` | does not activate live / Messaging |
| `WHATSAPP_MOCK_OUTCOME` | deterministic QA scenario | O | enum / unset except tests | No | approved mock enum | MOCK only / QA |
| `WHATSAPP_LIVE_SENDING_ENABLED` | live gate | R | false / false | No | exactly false | no rotation | disabled / Messaging |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Meta live adapter | Forbidden | absent / absent | Yes/mixed | any partial or complete set is rejected by DEVOPS-1C validator | disabled / Messaging |
| `SMS_EMAIL_MOCK_WEBHOOK_SECRET` | mock delivery HMAC | R | unique local / unique staging | Yes | >=32 random; rotate with fixtures | MOCK only / Messaging |
| `SMS_EMAIL_CONTACT_HASH_PEPPER` | contact hashes | R | unique local / unique staging | Yes | >=32; governed rotation | MOCK only / Security+Messaging |
| `SMS_EMAIL_SMS_PROVIDER_ADAPTER` | SMS adapter selector | O | mock label / unset or mock | No | live adapter not selected | disabled / Messaging |
| `SMS_EMAIL_SMS_LIVE_ENABLED`, `SMS_EMAIL_EMAIL_LIVE_ENABLED`, `SMS_EMAIL_SUPERVISED_LIVE_ACTIVATION_ENABLED` | live gates | R | false / false | No | exactly false | no rotation | disabled / Messaging |
| `GMAIL_OAUTH_CLIENT_ID`, `GMAIL_OAUTH_CLIENT_SECRET`, `GMAIL_OAUTH_REFRESH_TOKEN`, `GMAIL_SENDER_EMAIL` | Gmail live adapter | Forbidden | absent / absent | Yes/mixed | any partial/complete set rejected | disabled / Messaging |
| `AI_ASSISTANT_AUDIT_HASH_PEPPER` | privacy-safe audit hashing | R | unique local / unique staging | Yes | >=32 random; rotate under audit continuity plan | MOCK only / Security |
| `AI_ASSISTANT_LOCAL_ENDPOINT` | local HTTP AI adapter | Forbidden | isolated AI QA only / absent | Sensitive | any staging value rejected | disabled / AI owner |
| `CLOUD_BACKUP_MOCK_OUTCOME` | deterministic backup QA | O | enum / unset normally | No | approved enum | MOCK/local only / Backup |

## Tool-only and operating-system variables

`APPDATA`, `LOCALAPPDATA`, `PATH`, `USER`, `USERNAME`, and `GIT_EXECUTABLE` are consumed only by local CLI/tool discovery or non-secret backup attribution; they are not deployment configuration and must not be used as a secret store. `MAKE_SUPER_ADMIN_USER`/`SUPER_ADMIN_USER` are privileged CLI selectors and should be unset in the service. `SEC1_BASE_URL`, `SEC1_QA_MARKER`, `SEC1_QA_MATRIX_PATH`, `SEC1_QA_PASSWORD`, and `SEC1_RUNTIME_ROOT` are isolated QA variables and must be absent from the external staging service. `BROWSER_RESTORE_COPIED_QA_ROOT` is allowed only for an explicitly isolated copied-database rehearsal and is absent by default.

`STAGING_SYNTHETIC_SEED_OPT_IN` and the four `STAGING_SYNTHETIC_{DIRECTOR,PRINCIPAL,TEACHER,PARENT}_PASSWORD` values are transient synthetic-seed controls. Opt-in must be exactly `true` only during initial fixture creation. Every password must contain at least 16 staging-only characters, all four must differ, no value may be printed, and all variables are removed immediately afterward. `LOCAL_STAGING_BACKEND_PORT`, `LOCAL_STAGING_HTTPS_PORT`, `LOCAL_STAGING_PFX_PATH`, and `LOCAL_STAGING_PFX_PASSPHRASE` are disposable loopback-rehearsal settings only and must be absent on the external service. The PFX passphrase is a secret and the PFX is deleted when rehearsal ends.

`DEBUG`, `NEXT_PUBLIC_DEBUG`, `NALANDA_DEBUG`, Node inspector flags in `NODE_OPTIONS`, and Prisma query logging are rejected because they can expose secrets or private records.

## Secret rotation procedure

1. Name an owner and incident/change ticket; never paste the old/new value into the ticket.
2. Generate using an approved cryptographic secret generator in the provider secret store or offline operator shell.
3. For dual-key systems, add the new version first and prove old artifacts remain readable. For session HMAC, schedule forced sign-out.
4. Update staging only, restart one instance, run `deployment:env-check`, health and auth smoke tests.
5. Revoke/remove the old value only after verification; record key version and timestamp, not material.
6. If exposure is suspected, rotate immediately, revoke sessions/provider tokens, inspect redacted security logs, and assess data access.
