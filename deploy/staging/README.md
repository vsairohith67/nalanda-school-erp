# Staging process templates

These provider-neutral examples are design inputs, not deployment manifests. They contain no host, account, DNS, certificate, provider credential, or production secret. Review them against the selected provider and current Caddy/systemd documentation before use.

Recommended order: create an unprivileged service account and `/srv/nalanda-staging` layout; install an exact release; create the root-owned environment file from `environment.example`; run `pnpm deployment:env-check`; configure the loopback-only Node service; configure/verify TLS proxy; then perform the synthetic database path in `docs/STAGING_DATABASE_DEPLOYMENT_AND_ROLLBACK.md`.

Nothing in this folder authorizes DNS changes, resource creation, operational database transfer, or live providers.
