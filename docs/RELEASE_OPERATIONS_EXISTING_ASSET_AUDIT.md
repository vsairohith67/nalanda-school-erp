# RELEASE-OPS-1A Existing Release-Asset Audit

**Checkpoint:** independently cleared on `release/safe-staging-client-updates`
**Boundary:** local/private machinery only; no deployment, DNS, provider, real-user or real-data action

## Classification

| Existing asset | Classification | Reconciliation decision |
| --- | --- | --- |
| DEVOPS-1A private Git baseline, `.gitignore`, `git:safety-check` | `RELEASE_READY_AND_REUSED` | Remains the source/private-artifact gate before packaging and push. |
| DEVOPS-1B active migration chain, fresh install, schema equivalence, copied-database and restore checks | `RELEASE_READY_AND_REUSED` | Reused as the migration and restore release gates. Active migrations remain forward-only. |
| DEVOPS-1C staging architecture, environment validator, Caddy/systemd templates and health endpoint | `REQUIRES_UPDATE` → `RELEASE_READY_AND_REUSED` | Extended with release identity, explicit standalone/framework build mode, separate storage, staging banner and provider-disabled contract. Linux staging uses standalone; Windows can rehearse the allowlisted framework package without symlink privileges. |
| DEVOPS-1C `local-staging-rehearsal.ps1` | `LEGACY_REFERENCE_ONLY` | Preserved for historical HTTPS/restart evidence. RELEASE-OPS uses the new manifest/runner and current migration inventory; the old root/name is not a second release system. |
| DEVOPS-1D synthetic staging preparation | `DEPLOYMENT_ONLY` | Provider/resource creation remains approval-gated and is not invoked by RELEASE-OPS-1A. Its synthetic-data rules are reused. |
| DEVOPS-1E operational migration onboarding and integrity probe | `RELEASE_READY_AND_REUSED` | Read-only operational fingerprint/account/business controls are captured before and after release QA. No migration metadata is changed here. |
| `deploy/staging/environment.example` | `REQUIRES_UPDATE` → `RELEASE_READY_AND_REUSED` | Now declares release/channel/client/maintenance/private-storage separation without real values. |
| `deploy/staging/Caddyfile.example` | `RELEASE_READY_AND_REUSED` | Provider-neutral loopback proxy template; design-only until DNS/provider approval. |
| `deploy/staging/nalanda-staging.service.example` | `REQUIRES_UPDATE` → `RELEASE_READY_AND_REUSED` | Starts the standalone server and preserves strict single-instance/write-root boundaries. |
| `validateDeploymentEnvironment` | `RELEASE_READY_AND_REUSED` | Existing staging validation preserved; generic five-environment release contract added alongside it. |
| `/api/deployment-health`, `/api/health` | `RELEASE_READY_AND_REUSED` | Liveness remains public/minimal; detailed health remains authenticated through OBS-1A. |
| `seed-staging-synthetic.ts`, `verify-staging-synthetic.ts` | `REQUIRES_UPDATE` → `RELEASE_READY_AND_REUSED` | Current active migration inventory is now derived dynamically instead of assuming the clean-install baseline is latest. |
| Logical backup/restore and private-asset backup families | `RELEASE_READY_AND_REUSED` | Release gates reference them; package allowlists exclude every backup and private asset byte. |
| Cloud-backup providers/workers | `PROVIDER_SPECIFIC` | Not activated or included as a deployment action. Local/mock recovery primitives remain test-only. |
| PWA cache policy, service-worker route and diagnostics | `REQUIRES_UPDATE` → `RELEASE_READY_AND_REUSED` | Existing no-private-cache policy reused; safe public version discovery and dirty-work deferral added. |
| OBS-1A release manifests, client policy, maintenance windows and health domains | `RELEASE_READY_AND_REUSED` | Release Operations links to these controls; no duplicate observability system was created. |
| OBS-1A Technical Operations UI | `RELEASE_READY_AND_REUSED` | Retained for health/incidents. New Release Operations UI is a narrow release-gate view, not a replacement dashboard. |
| Historical migration/release evidence and tags | `LEGACY_REFERENCE_ONLY` | Preserved unchanged and referenced as previous-known-good evidence. |
| Existing GitHub workflows | `DUPLICATE` (none present) | No duplicate existed. One manual-only, read-only validation workflow was added with no artifact upload or deployment. |
| Provider accounts, DNS templates with applied values, public hosts | `DEPLOYMENT_ONLY` (absent) | Remain absent. No residue or authorization was inferred. |

No historical evidence was deleted. `backupVersion` is retained as a recovery-format identifier and is never treated as the sole application version.
