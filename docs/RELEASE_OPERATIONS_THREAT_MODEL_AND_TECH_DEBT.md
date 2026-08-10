# Release Operations Threat Model and Technical Debt

## Threats and controls

| Threat | Control |
| --- | --- |
| concurrent/stale operator | exclusive durable lock, bounded expiry, governed recovery and hash-chained audit |
| wrong branch/current/target | explicit identity and clean committed-tree checks |
| artifact tamper/private inclusion | allowlist packaging, symlink/traversal/secret refusal, inventory/payload/ZIP hashes |
| shell/path injection | fixed executable and closed phase/argument sets; normalized roots and bounded identifiers |
| migration/data loss | forward-only classification, fresh/copy/twice rehearsal, maintenance/drain, verified backup/restore |
| unauthorised admin/remote command | exact non-delegable permissions, read-only UI/API, no remote command endpoint |
| stale/private client cache | build caches, API/private exclusion, safe activation and logout cleanup |
| provider/DNS/cost drift | manual-only CI, read-only permissions, no secret/upload/deploy step, explicit external approval |
| audit disclosure | bounded privacy-safe summaries; UI omits private roots and hashes |

CSRF/origin and request-body bounds remain enforced by global middleware. Release and rollback mutations, if later added to the authenticated app, must be POST-only, re-authenticated, rate-limited and two-person approved where configured.

## Technical debt

- The legacy DEVOPS-1C HTTPS rehearsal remains named/rooted to its historical phase; retain it until independent QA consolidates equivalent runtime coverage into a release-specific harness.
- Release candidate/audit state is local filesystem state by design for this no-deployment phase. A future approved multi-host design must choose a single authoritative store without weakening the SQLite single-writer boundary.
- CI action tags are review-gated in a manual-only workflow; pin exact action commits during independent QA if organisation policy requires it.
- Native clients are contract-only; physical device/app-store validation is a later phase.
- Actual cloud staging, off-host backup, provider health and cost monitoring remain unavailable until provider/budget approval.
