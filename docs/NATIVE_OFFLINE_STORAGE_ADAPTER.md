# Native Offline Sync storage adapter

The native adapter is a storage and transport layer for the already-cleared Offline Sync 1A protocol. It does not calculate balances, allocate receipts, post payments, or become a finance authority.

`NativeOfflineStorageAdapter` implements the six explicit contracts `DraftStore`, `OutboxStore`, `ReferenceSnapshotStore`, `SyncCursorStore`, `DeviceKeyStore`, and `AcceptedResultStore`. Drafts, queued mutation envelopes, bounded reference snapshots, cursors and safe accepted-result summaries all use the same version-1 AES-GCM record envelope. The device-key contract delegates signing and public-key access to Stronghold; it never exports the private key.

Stronghold contains the local content key, refresh token, stable app/device identifier and Ed25519 device key. A separate per-install random salt in the private app-data container feeds the Argon2id vault derivation and is not a PIN verifier. SQLite stores only fixed-schema metadata plus AES-256-GCM ciphertext envelopes. Each envelope uses a fresh nonce and authenticated additional data binding the cache protocol version, record type and record identifier.

Allowed offline drafts remain exactly:

- Current Year Fee intake draft;
- expense draft;
- miscellaneous-income draft.

Old Due, refunds, cancellations, receipt creation, final posting, academic writes, Search ingestion, and Smart AI context are not available offline. On user action the client hashes the canonical payload, enqueues the mutation, refreshes compatibility/reference context and sends the fixed `SYNC` operation. Server responses remain `ACCEPTED`, `CONFLICT`, `REJECTED`, and `RETRY_LATER`; idempotency and conflict truth remain server-owned. A local accepted-result record is explicitly not an official receipt and contains only the server's bounded safe result.

App backgrounding clears rendered plaintext state and unloads the vault. Server logout or revocation denies future native access but does not remotely erase the device; local secure material remains until the owner performs the explicit destructive reset or an authorized operating-system app-data reset. The in-app reset attempts server logout, verifies Stronghold content/session/device-key removal and vault unload, then deletes ciphertext. Cache inspection, wrong-key/corruption handling, explicit first-run detection, missing-salt refusal, copied-database migration tests, and operational-database hashing are covered by the scoped QA evidence.
