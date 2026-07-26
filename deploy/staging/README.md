# Staging process templates

These provider-neutral examples are design inputs, not deployment manifests. They contain no host, account, DNS, certificate, provider credential, or production secret. Review them against the selected provider and current Caddy/systemd documentation before use.

Recommended order: create separate non-root deployment access and the unprivileged `nalanda` service account; create `/opt/nalanda/releases`, `/opt/nalanda/current`, `/var/lib/nalanda/{data,uploads,backups}`, `/var/cache/nalanda/next`, `/var/log/nalanda`, `/run/nalanda` and `/etc/nalanda/staging.env`; install an exact release; make the environment file root-owned mode `0600`; run `pnpm deployment:env-check`; configure the loopback-only Node service; configure/verify TLS proxy; then perform the synthetic database path in `docs/STAGING_DATABASE_DEPLOYMENT_AND_ROLLBACK.md`.

Nothing in this folder authorizes DNS changes, resource creation, operational database transfer, or live providers.

The Caddy template requires Caddy 2.10 or newer because `request_body max_size` is version-gated. Validate the rendered configuration with the exact installed binary before DNS. The systemd unit is a reviewed baseline, not a blind copy: run `systemd-analyze verify` and `systemd-analyze security` on the selected supported Ubuntu LTS image.

For the one-time synthetic seed, inject four different strong values as `STAGING_SYNTHETIC_DIRECTOR_PASSWORD`, `STAGING_SYNTHETIC_PRINCIPAL_PASSWORD`, `STAGING_SYNTHETIC_TEACHER_PASSWORD` and `STAGING_SYNTHETIC_PARENT_PASSWORD`. Never write them to Git, documentation, chat, command history or service logs. Remove them immediately after seeding and hand each temporary credential to its named tester through a private channel.

Before server deployment, `pnpm staging:synthetic-rehearse` creates a bounded ignored database, runs migration deploy/status, validates the environment, seeds twice to prove idempotence, verifies the exact synthetic fixture boundary, and removes the disposable database. It never targets `prisma/dev.db`.
