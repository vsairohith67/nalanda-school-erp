# Non-executed provider overlay checklists

No provider is selected. Every mapping needs owner-approved account/tenant, region, budget, private access, DNS/TLS, backups, monitoring, support and DPA/legal review.

- Google Cloud: Cloud Run/GKE, Cloud SQL, Memorystore protocol proof, S3 interoperability proof or separate adapter, Secret Manager, Cloud Armor/IAP. Stop on API mismatch or unapproved region/egress.
- AWS: ECS/Fargate/EKS, RDS, ElastiCache/MemoryDB protocol proof, private S3, Secrets Manager, ALB/WAF/PrivateLink. Stop on public artifacts/buckets or unclear cost ownership.
- Azure: Container Apps/AKS, Azure PostgreSQL, Managed Redis protocol proof, S3-compatible service or reviewed Blob adapter, Key Vault, Front Door/private endpoints. Blob is not automatically S3-compatible.
- DigitalOcean: App Platform/Kubernetes/Droplet, managed PostgreSQL, managed protocol-compatible cache, Spaces, secrets, load balancer/firewall. Stop if private network or backup requirements fail.
- Generic Linux VPS/India provider: Docker/Podman, PostgreSQL 17, Valkey, MinIO/S3, mounted secrets, Caddy, timers, off-host backup. Stop without off-host storage, patch/firewall ownership, monitoring, incident response and DPA.
