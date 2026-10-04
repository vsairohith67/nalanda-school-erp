# Operator handoff: inactive preparation and later authorized operations

This handoff uses the existing portable bundle and operator. It does not authorize
a runtime, private preview, data import, accounts, external notifications or hosting.
The synthetic stack keeps `https://portable-staging.localhost:8443` and its reviewed
authenticated edge. `https://preview-erp.nalandaps.com` is a future preference only.

## Prepare explicit settings

Build the existing bundle with `pnpm.cmd portable:bundle` in the selected reviewed
checkout. Use absolute settings/workspace/output paths, a new output directory
under an existing canonical parent, and no secrets in settings. The command is:

```text
node dist/portable/prepare-operations.mjs --settings ABS_SETTINGS_JSON --workspace ABS_REVIEWED_WORKSPACE --output ABS_FRESH_OUTPUT
```

Future planning settings can contain exactly:

```json
{
  "schemaVersion": 1,
  "purpose": "future-private-preview",
  "profile": "generic-vps",
  "applicationOrigin": "https://preview-erp.nalandaps.com"
}
```

This writes an **inactive requirements record only**, without a manifest or Compose
file. Its actual classification/consumer, independent target namespace, immutable
image/source/architecture, remote database TLS, proxy/origin/callback settings,
secret files and runtime authorization remain unresolved. Task A owns the consumer
and admission interface. The owner supplies approval and approved environment
inputs; the release owner supplies qualified retained artifacts; the operator
supplies explicit target/secret-file references within that contract. Missing
approval does not block this pure preparation record.

For synthetic integration, select `purpose: synthetic-integration`, either existing
profile, the unchanged synthetic origin, and a complete existing `manifest` object.
Its target must be the exact workspace's `tmp/portable-operator/PROJECT` and its
private namespace `tmp/portable-staging/PROJECT` must be unoccupied. Supply the
canonical Compose checksum, supported PostgreSQL17/v48/migration contract,
immutable image config digest, source commit, architecture and operation ID.
`nalanda-ci` identity is accepted only by the existing independently qualified CI
operator; this preparer never creates a CI execution identity, secret or grant.

The preparer resolves canonical YAML anchors/merge/interpolation with Compose's
client-side `config` parser, an explicit empty interpolation file and allowlisted
environment. It invokes no daemon operation, image inspection/pull, secret read,
SSH, health probe or apply. Effective private-network, port, mounted-secret,
credential isolation, trusted-edge, origin/callback, resource and OFF-state rules
are checked. Existing volume occupancy/ownership remains unresolved for later qualified
preflight; offline configuration does not inspect daemon state. Output creation is exclusive; occupied outputs are refused. A failed
preparation can retain a partial task-owned output, which must be inspected before
settled cleanup; do not reuse it. An output is **not admission or runtime readiness**.

## Qualification and first start

Synthetic preparation produces `manifest.json`, `commands.json` and a safe
`preparation.json` with unresolved inputs. Command records hold exact argv arrays
for the existing ten lifecycle commands. Run from their recorded reviewed workspace:

```text
node dist/portable/operator.mjs preflight --manifest ABS_MANIFEST_JSON --target ABS_TARGET
node dist/portable/operator.mjs doctor --manifest ABS_MANIFEST_JSON --target ABS_TARGET
```

Even ordinary dry-run qualifies the artifact before dispatch; preflight can inspect
the exact retained image and run bounded admitted probes. Doctor executes actual
diagnostic steps. They are **not offline preparation** and require their current
execution contract. Missing admission is a stop, never a request to substitute
`latest`, rebuild a worktree, spoof CI, use a denied wrapper or weaken classification.
Read `commands.json` requirements: restore needs an exact restore artifact/transfer;
upgrade and rollback need a distinct retained historical image and source.

Only after independently authorized exact artifact/profile/target/data/network/
duration/mutations/ownership may an operator invoke `initialise` or `install` with
the same manifest and target plus `--apply`. No first start is performed by this lane.
No seed account, staff invitation, school record or live flag is implied.

## Health, backup and recovery

Use existing authenticated liveness/readiness/metrics and Technical Operations /
Cloud Backup surfaces. Liveness is process evidence; readiness checks dependencies
and schema. Persistent backup run/artifact/event records retain failed and uncertain
states. Missing backup/rehearsal evidence remains unverified; overdue schedules
remain overdue. A verified encrypted archive does not prove a restore rehearsal.

`PORTABLE_BACKUP_VERIFIED` and `PORTABLE_BACKUP_FAILED` emit fixed safe terminal
categories and existing process counters. They contain no identities, amounts,
object keys, secret values, raw errors or connection strings. Counters belong to
each process/replica and reset on restart; use persistent run history for durable
totals. A missed scrape is unknown/stale, not zero errors. No p95/SLA/capacity or
live monitoring claim follows from these counters. No alerts or schedules activated.

After authorization, existing `backup --apply` performs backup through its current
adapter. Validate ciphertext/manifest, authenticated decrypt and supported payload
before restoring into an independently owned permitted destination. Existing
`restore --apply` requires the exact artifact and source/destination transfer contract.
Wrong key, tampering, truncation, manifest mismatch or unsupported version stops
validation. Do not restore into the source or drop a populated target. The existing
database restore service repeats idempotently and preserves reference history;
provider and running-stack evidence must be reported separately.

The cloud backup worker includes the database payload and **excludes private object/
document bytes, password hashes, provider credentials and encryption keys**.
Separate private-object recovery and key custody are required for full application
recovery. Keep key references separate from backup bytes and A3 build custody.
Retention planning is not approval to prune; B1's retention window remains unapproved.
Do not write to the owner's external D: drive or activate maintenance schedules.

## Upgrade, interruption and compatible rollback

Use existing `upgrade --apply` only with a distinct qualified previous artifact,
current exact identities, required verified backup and compatible schema. A backup
failure blocks dependent update steps; failed migration/readiness retains failure
evidence. Application rollback uses `rollback --apply` only when the historical
image supports the current migration/v48 contract. It performs no schema downgrade
or automatic data restoration. A source checkout is not a deployed historical image.

After interruption, preserve durable intent/completed-prefix receipts and targets.
Reconcile through the existing operator, then use the **same command, manifest,
target and operation ID** plus `--apply --resume`. Changed plan/target/profile or
invalid receipts are refused. UNKNOWN effects require reconciliation; never replay
a real mutation because its response was lost. Concurrent attempts remain locked.
Controlled filesystem/process tests are not host power-loss recovery acceptance.

## Stop and preserve

Existing `uninstall --apply` stops/removes application components while preserving
data, volumes, backups and keys under its authorized contract. Never use destructive
`down -v`, database drops, volume pruning or schema downgrades to manufacture success.
Cleanup only newly owned settled test outputs and children after boundary/ownership
verification. Preserve other lanes, retained evidence and operational data.

The next integration/runtime decision is recorded in HANDOFF.md with actual test,
review, source and CI status. Laptop-first qualification/measurement precedes hosting
comparison. No VPS, provider, subscription, DNS, public/LAN exposure, brand change,
Georgia Bold font redistribution or four-person account activation is authorized.
