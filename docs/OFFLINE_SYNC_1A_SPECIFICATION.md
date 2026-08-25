# Encrypted Offline Accountant Drafts — OFFLINE-SYNC-1A

## Outcome and boundary

This is a software foundation for Nalanda's Accountant role. It is `DEFAULT-OFF`, has zero rollout, and does not activate any real device or workflow. When separately activated, an approved Accountant device can prepare three draft types while disconnected:

1. fee-payment drafts;
2. expense drafts; and
3. miscellaneous-income drafts.

The browser never creates an official receipt number, final payment, paid expense, approval, Cash Book entry, cancellation, correction, marks change, attendance change, payroll item, file, photo, export, AI request, or external-provider action. Official finance records are created only by the existing server-side business services after a signed synchronization request passes current authorization and current-domain validation.

## Authorization

| Permission | Default role | Meaning |
| --- | --- | --- |
| `USE_OFFLINE_SYNC` | Accountant and Super Admin | Register a personal device, obtain privacy-minimal references, prepare encrypted drafts and synchronize. Runtime use is still restricted to exact Accountant or Super Admin role contexts. |
| `MANAGE_OFFLINE_SYNC_DEVICES` | Super Admin only, non-delegable | Approve, revoke/lost-mark and retire devices. |
| `REVIEW_OFFLINE_SYNC_CONFLICTS` | Super Admin, Director, Principal | Review safe conflict metadata and record an append-only resolution. This never force-applies a draft. |

Every API is also protected by the `offline-sync-1a` release flag. Its production configuration is false with `rolloutPercentage: 0`. Synthetic QA can use only the repository's isolated copied-database release-flag override.

## Device protocol

- Each browser creates a non-extractable ECDSA P-256 private signing key. Only its public JWK is registered on the server.
- Registration uses a five-minute, single-use server challenge and proof-of-possession signature. A device begins as `PENDING_APPROVAL`.
- The default maximum is two pending/active devices per user; configuration is clamped to three.
- A Super Admin must approve the device. `ACTIVE` is required for references and sync.
- Every protected request signs method, path, timestamp, random nonce, exact body SHA-256, public device ID, key version and schema version.
- The server permits a five-minute clock window, stores a hashed nonce under a uniqueness constraint, verifies current user ownership, device status, key version, session, active role assignment and permissions, then records safe audit events.
- Revocation or retirement is terminal and blocks the next request. Rotation requires both a signed request from the old active key and a fresh challenge signed by the new key; key version must increase by exactly one.

## Browser cryptography and storage

- Drafts, outbox envelopes, reference packs, accepted results and conflict material are AES-256-GCM encrypted in the app-owned IndexedDB database `nps-offline-finance-v1`.
- A random content-encryption key encrypts records. A 6–12 digit offline PIN derives a wrapping key using PBKDF2-HMAC-SHA-256, a per-browser 128-bit salt and 310,000 iterations. The content key is stored only in wrapped form.
- Every record uses a new 96-bit IV. Authenticated additional data binds version, user, public device, record type and record ID.
- Sensitive values are inside ciphertext. IndexedDB keys and metadata contain only opaque IDs, state, operation type, timestamps and expiry.
- The content key exists in memory only while unlocked. Logout and explicit Lock discard it. The offline PIN is independent of the ERP password and cannot be recovered by the school.
- Failed PIN attempts receive increasing local delay after five failures. Reset deletes only the app-owned IndexedDB database after an explicit warning; unsynchronized drafts are unrecoverable.
- Drafts expire after 14 days while editing and 30 days when queued/conflicted. Accepted-result references expire after 90 days. Expiry is enforced when the workspace starts.

## Reference pack v1

`GET /api/offline-sync/reference-pack` returns an authenticated, device-signed, private/no-store response. It contains at most 800 active Students with admission number, name, class, section, academic year, state, entity version and last-known due summary; active fee structures; vendor code/name only; expense category/department code/name; active miscellaneous-income items and exact rates; and small payment dictionaries.

It excludes contact numbers, addresses, Aadhaar/identity numbers, birth dates, guardian details, bank/tax fields, notes, documents, photos, marks, attendance, health, payroll and unrestricted exports.

The pack carries an HMAC-signed actor/device-bound snapshot version, a 24-hour soft-stale time, a 72-hour hard expiry and an HMAC-signed incremental cursor. Cursor claims contain timestamps and opaque identities only. A hard-expired or wrongly scoped snapshot is rejected during sync. Current server masters and fee dues always win.

## Synchronization contract v1

`POST /api/offline-sync/sync` accepts JSON only, at most 512 KiB and at most 25 mutations. Each mutation contains an opaque client mutation ID, opaque local draft ID, one allowed operation type, encrypted-client-decoded payload, canonical payload hash, client creation time, signed reference version and optional base-entity version.

Each item runs in its own serializable database transaction:

1. Look up `(deviceId, clientMutationId)`.
2. Return the original safe result for the same payload hash.
3. Reject the same ID with another hash as `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD`.
4. Persist a hash-only mutation ledger row.
5. Recheck device status/key, session, role assignment, `USE_OFFLINE_SYNC` and the current domain permission.
6. Verify reference scope/expiry and current entity/master state.
7. Call the authoritative Payment, Expense or Miscellaneous Income service.
8. Persist `ACCEPTED`, `CONFLICT` or `REJECTED` plus a safe result and append-only event in the same transaction.

Outcomes are `ACCEPTED`, `DUPLICATE_ACCEPTED`, `CONFLICT`, `REJECTED` or `RETRY_LATER`. Only explicit transient failures are retryable. Acceptance causes the client to encrypt the official reference and purge the draft/outbox payload. Conflicts and rejections retain encrypted local content for review. Reconnect never auto-submits.

## Backup and recovery

Backup v44 includes registered public-device metadata, hash-only mutation ledgers, safe append-only events and conflict reviews. It excludes browser data, offline PIN material, content-encryption keys, private signing keys, challenges and replay nonces. Restore validates links and state, restores terminal ledger states safely, is idempotent, and repeats the exclusion warning.

## API inventory

- `/api/offline-sync/context`
- `/api/offline-sync/devices/challenge`
- `/api/offline-sync/devices/register`
- `/api/offline-sync/devices`
- `/api/offline-sync/devices/[id]`
- `/api/offline-sync/devices/rotate`
- `/api/offline-sync/reference-pack`
- `/api/offline-sync/sync`
- `/api/offline-sync/conflicts`
- `/api/offline-sync/conflicts/[id]/review`

All API responses are private/no-store. Middleware applies same-origin mutation checks, a device-aware high-cost rate policy and the route-specific body cap.

## Versioning and incompatibility

The request header, batch body, reference claims and local AAD all use schema version 1. A mismatched version fails closed. Future versions must be additive or ship an explicit local migration, server compatibility window and rollback plan. Unsupported clients must retain encrypted drafts and show update guidance; they must never guess or silently transform finance data.
