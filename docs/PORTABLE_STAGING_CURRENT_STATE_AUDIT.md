# Portable staging current-state audit

Audit base: `origin/main` at `46cf0c75c71b08ba3f1951090789041a4fd418ee` on 2026-08-26. The audit read code and documentation only; it did not inspect operational records or assets.

| Capability on audited main | Classification before this branch | Branch disposition |
| --- | --- | --- |
| SQLite local development and migration history | IMPLEMENTED_AND_CLEARED | Preserved as local default. |
| PostgreSQL 17 schema, baseline, parity and readiness QA | IMPLEMENTED_AND_CLEARED | Reused; no migration history rewrite. |
| Local HTTPS staging examples and Caddy | IMPLEMENTED_BUT_LOCAL_ONLY | Replaced by the segmented synthetic reference stack. |
| Production OCI application image | MISSING | Added as a pinned multi-stage non-root image. |
| Separate migrator/runtime identities and commands | INTERFACE_ONLY | Added and rehearsed in the portable stack. |
| `RateLimitStore` and memory adapter | IMPLEMENTED_AND_CLEARED | Reused; distributed Valkey adapter added. |
| Distributed rate-limit registration | INTERFACE_ONLY | Completed with atomic multi-key Lua and fail-closed registration. |
| Private file-backed modules | IMPLEMENTED_BUT_LOCAL_ONLY | Routed through the common S3-compatible adapter in governed deployments; filesystem behavior preserved. |
| Report/PDF generation | IMPLEMENTED_AND_CLEARED | Remains ephemeral generation; governed durable prefixes are defined. |
| Encrypted backup v45 and provider interface | IMPLEMENTED_AND_CLEARED | Private S3-compatible destination added; v44 restore remains supported and provider-specific activation remains gated. |
| Google Drive/object provider placeholders | EXAMPLE_ONLY / EXTERNAL_GATE | Not activated and not selected. |
| Health and deployment checks | IMPLEMENTED_BUT_LOCAL_ONLY | Split into liveness/readiness and token-protected detail/metrics. |
| Scheduled scripts | IMPLEMENTED_BUT_LOCAL_ONLY | Inventory and locked container command added. |
| Kubernetes/Helm | MISSING | Deliberately deferred; not required by the selected contract. |
| Provider account, region, budget, edge, DNS and legal approval | EXTERNAL_GATE | Still open; no resource was created. |

Generated/QA scripts that write files remain local tooling, not runtime durable storage. Asset-backup helpers remain compatible with copied-filesystem QA; portable durable application reads and writes use `PrivateObjectStore`.
