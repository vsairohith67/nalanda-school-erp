# BIOMETRIC-HARDWARE-CERTIFICATION-1B

Status: required later gate; not satisfied by BIOMETRIC-STAFF-ATTENDANCE-1A.

No vendor-specific adapter may be enabled and no K30 Pro may be called certified until one purchased or borrowed exact device completes this gate.

## Admission evidence

- Exact manufacturer, model, serial reference (masked in ERP evidence), hardware revision, and firmware version.
- Lawfully obtained official vendor protocol documentation or SDK, version, licence terms, file hashes, and vendor support contact/reference.
- Written API/licensing rights and confirmation of any required custom endpoint capability.
- Written confirmation of the supported profile: direct push, LAN SDK, ADMS push, or a separately approved export path.
- Network design proving a private school LAN, allow-listed bridge address, no direct internet exposure, and no arbitrary discovery.
- Designated Windows bridge computer, restricted service account, verified Authenticode signature, firewall policy, protected machine-scoped queue/signing credentials, service restart behavior, and recovery runbook.

## Required live tests

- Live LAN IN and OUT from the exact device to the exact bridge and ERP build.
- Enrollment, use, and deletion of a synthetic fingerprint under an approved privacy policy; confirm that no template/image/vendor database reaches Nalanda.
- Duplicate delivery, out-of-order delivery, 80-person morning burst, and idempotent retry.
- Device and bridge offline backlog, internet loss and restoration, LAN loss and restoration.
- Measured clock drift, correction, and drift alert behavior.
- Device restart, bridge restart, Windows restart, firmware reset/sequence epoch, and power failure during transfer.
- Revoked bridge, revoked device, stale rotated credential, replay, malformed batch, oversize batch, and rate-limit refusal.
- Exact Staff mapping conflict, inactive Staff, missing IN/OUT, multiple punches, late arrival, early departure, leave/holiday, manual correction, and dual approval.
- Backup and restore-twice rehearsal using copied/synthetic data, with operational database hashes unchanged.
- Onsite privacy notice/signage, enrollment authority, deletion/retention procedure, administrator access custody, exception/manual process, staff training, and acceptance signatures.
- Owner/Principal-approved final attendance timings and the final correction-approver/separation-of-duties policy.

## Terminal decision

The 1B owner records one of: certified for the exact device/firmware/profile/site; requires fixes; vendor protocol blocked; or rejected. Certification never generalizes to another firmware, device variant, protocol, campus, or bridge build without an explicit evidence review.
