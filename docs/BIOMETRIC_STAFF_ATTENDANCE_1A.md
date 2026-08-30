# BIOMETRIC-STAFF-ATTENDANCE-1A

Status: software foundation only; production feature default OFF with 0% rollout.

## Boundary

Nalanda stores attendance evidence, never biometric material. Permitted data is limited to the governed bridge/device registry, an explicit opaque device-user-to-Staff mapping, normalized punch and receipt timestamps, verification method, punch/status code, event/sequence references, reconciliation state, corrections, and audit history.

The ERP and bridge must never store or export fingerprint images or templates, facial images or templates, a vendor biometric database, card secrets, device administrator passwords, or a bridge private signing key. A public verification key is not a credential and is retained so the ERP can verify signed batches.

## Data flow

```text
private-LAN device
  -> allow-listed Windows bridge adapter
  -> AES-256-GCM durable local queue
  -> Ed25519-signed HTTPS batch
  -> authenticated bounded ingestion API
  -> immutable normalized raw punch
  -> deterministic reconciliation queue
  -> dual-controlled Staff attendance approval
```

The device is not internet-exposed. The bridge opens no public listening port and does no discovery, broadcast, or arbitrary LAN scanning. It connects only to configured private addresses. Device logs and the encrypted bridge queue provide independent backlog layers; retries are idempotent.

## Provider-neutral profiles

- `SIMULATOR`: active for deterministic software QA.
- `GENERIC_CSV_IMPORT`: active only for the exact bounded normalized CSV contract.
- `GENERIC_ADMS_PUSH`, `GENERIC_LAN_POLL`: provider-neutral contract slots that remain `ADAPTER_CONTRACT_PENDING` until a separately reviewed public adapter contract is approved and configured.
- `ESSL_K30_PRO_PUSH`, `ESSL_ZK_LAN_SDK`, `ZK_ADMS_PUSH`: adapter placeholders that fail closed until lawful official documentation or an SDK has been reviewed and its evidence reference approved.

Protected proprietary protocols must not be reverse-engineered. `eSSL K30 Pro` remains a candidate, not a certified or activated device.

## Temporary public-repository exception

The repository is temporarily public by explicit owner decision. That exception permits reviewable source and synthetic software evidence only; it is not private-artifact clearance. This repository must not contain real biometric punches or Staff attendance, biometric images/templates/databases, card or device-administrator secrets, vendor licence keys, proprietary SDK binaries or confidential protocol documents, production bridge private/signing keys, real LAN/infrastructure secrets, bridge executables/installers, or operational databases/backups. Exact-head CI scans committed source for secrets and prohibited artifact classes, retains only redacted source/test/checksum evidence, and uploads no bridge binary or attendance/database artifact.

## Governance and security

- Super Admin governs bridges, credentials, devices, protocol evidence, revocation, and policy.
- Principal/Director may perform governed oversight and approvals within existing role policy.
- An explicitly granted attendance operator may prepare mappings and reconciliation, but cannot self-approve.
- Staff may see only their linked attendance and submit a reasoned correction request.
- Accountant, Computer Operator, Parent, Student, Viewer, Gate Staff, and Marks Entry Operator have no biometric administration authority by default.
- Bridge and device status is fail-closed. Vendor devices cannot become active without official protocol proof.
- Every batch binds method, canonical path, timestamp, nonce, body hash, bridge ID, key version, schema version, and signature.
- Timestamps use a five-minute proof window; nonces are durable and replay-protected; batch and event identities are idempotent.
- The API requires TLS in production, a 256 KiB body limit, at most 100 events, and a durable per-bridge rate bound.
- Raw punches preserve device, bridge-received, and server-received timestamps, an event payload hash, and the reported verification method. All original evidence is immutable except for the explicit reconciliation-state marker, and punches cannot be deleted. Reusing an identity with changed payload is rejected and audited. Mapping and correction history cannot be silently deleted; correction evidence cannot be overwritten.
- Logs and UI expose privacy-safe metadata and masked serial references only.

## Reconciliation

The engine uses the first valid IN and last valid OUT for the approved day-shift policy while retaining every punch. Policy records govern the published-calendar workday basis, scheduled IN/OUT, grace and threshold minutes, full/half-day durations, missing-punch behavior, multiple-punch strategy, leave/holiday interaction, and future complex-shift capability. No real Nalanda timing is committed by 1A. It detects multiple punches, missing IN/OUT, late arrival, early departure, half day, approved leave, non-working days, device gaps, mapping conflicts, inactive Staff, clock drift, late delivery, out-of-order sequences, and firmware-reset epochs. Overnight and split shifts are deliberately blocked until a later governed policy is configured.

Approval writes through the existing Staff attendance session/record foundation with source `BIOMETRIC`. Existing locked sessions and non-biometric manual records fail closed. Corrections preserve original raw-punch evidence, reason, preparer/requester, verifier, before/after, timestamps, and audit events.

No reconciliation or correction automatically deducts salary. Payroll impact is always `false` in 1A and requires a separate approved consequence.

## Backup, restore, and reports

Backups include the durable device registry, public bridge verification keys, mapping history, batches, immutable punches, gaps, policies, reconciliations, corrections, and audit events. Replay nonces, private bridge signing keys, device credentials, and biometric material are intentionally excluded. Restore is link-aware and idempotent.

Reports are bounded to 366 days and 10,000 rows. Exports require a separate permission, use `private, no-store`, and prefix spreadsheet formula characters before CSV encoding.

## Operational activation boundary

Software clearance proves only the simulator, provider-neutral bridge, normalized ingestion, reconciliation, authorization, security controls, migrations, and backup/restore behavior. It does not prove an actual device, firmware, vendor protocol, Windows service installation, Authenticode signature, network topology, enrollment/deletion process, or onsite acceptance.

Recommended purchase decision: defer purchase, or borrow one exact K30 Pro for the 1B certification lab, until the vendor supplies lawful official protocol/SDK documentation and the exact device/firmware is available for the full failure-mode test. Do not purchase a fleet from the 1A result.

See [BIOMETRIC_HARDWARE_CERTIFICATION_1B.md](./BIOMETRIC_HARDWARE_CERTIFICATION_1B.md).
