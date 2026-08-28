# ADR: Portable staging runtime

Status: accepted for `PORTABLE-STAGING-FOUNDATION-1A`.

## Decision

Use one reviewed OCI image with explicit `web`, `migrate`, `migration-status`, `seed-synthetic`, `backup`, `restore`, `scheduled-job`, `maintenance-check`, and `health-probe` commands. The reference deployment is Docker Compose with PostgreSQL 17, Valkey, a private S3-compatible object store, two web replicas, and a private reverse proxy. Providers supply equivalent managed or self-hosted services without changing application logic.

## Options considered

| Option | Result | Reason |
| --- | --- | --- |
| OCI image plus Compose | Selected | Smallest useful common contract for local, VPS, and cloud runtimes. |
| OCI image plus Kubernetes/Helm | Deferred overlay | Useful at larger scale, but not required for a small school and must not become the only path. |
| Provider-specific application runtimes | Rejected as the foundation | Couples application behavior to one vendor. |
| Direct systemd Node deployment | Supported later as an adapter, not the reference | Does not itself define portable storage, migration, or replica contracts. |

Consequences: migrations run once with a separate identity; web replicas never receive `DIRECT_URL`; durable state is outside the container; Valkey is mandatory in governed environments; and provider selection, public access, DNS, WAF, real data, and user activation remain later owner gates.
