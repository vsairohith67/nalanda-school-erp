# OCI supply-chain security

The release gate links exact source SHA, base digests, frozen lock, OCI labels, image digest/checksum, package inventory, SBOM, dependency/OS scans, secret/config scans and provenance. Critical/unresolved High blocks clearance; authorization/privacy/financial-integrity Medium also blocks.

Default output is private CI artifact. Docker Hub is forbidden. GHCR requires verified private visibility and exact-head policy. Keyless OIDC signing may be used safely; otherwise checksum/provenance are produced and signing is an external tooling gate. Never create a long-lived signing key.
