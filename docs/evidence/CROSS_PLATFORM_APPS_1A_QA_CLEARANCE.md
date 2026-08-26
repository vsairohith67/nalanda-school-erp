# CROSS-PLATFORM-APPS-1A QA clearance

Date: 2026-08-26

## Verdict before release CI

Local software gates pass. The foundation remains default OFF with zero rollout and no remote server configured. Windows packaging is proven locally. Android and iOS compilation require their native GitHub-hosted runners; signing, stores, emulators/physical devices, private staging, real users, and real school data remain separate external gates.

## Exact local evidence

- Full repository regression: 232 test files passed, one qpdf-only file skipped; 2,165 tests passed and three qpdf-only tests skipped, with no failure.
- TypeScript: all 19 root project partitions passed; native app typecheck passed.
- Builds: full Next.js compile/generate passed; Vite compiled 1,589 modules; Tauri produced the optimized Windows executable and one unsigned NSIS installer.
- Windows installer: `Nalanda Public School ERP_0.1.0_x64-setup.exe`, 6,963,854 bytes, SHA-256 `1DAF413F2C00746F8BF83A62C652A52686478F1FD994316ACAC31261DDD01D36`.
- Windows application executable: 16,614,400 bytes, SHA-256 `1CB7710BB96A89D8E9438BEF969673E06299990E0D4EE971A9EA12BEA849EB6D`.
- Rust: seven unit tests passed; `cargo fmt --check` and strict Clippy with warnings denied passed. Linker output contained only the known missing third-party libsodium PDB warning.
- Cross-platform contracts: 27/27 passed. Merged UDISE regression: 39/39 passed.
- Security resilience: 47/47 tests passed; bounded local load accepted 98, rejected 51 with controlled 429, produced two controlled 503 outcomes, recovered, and touched no operational database.
- Copied-database adversarial QA: PKCE/device signing, code replay rejection, access/refresh rotation, refresh-family revocation, credential-version invalidation, exact session-device binding, ciphertext-only cache contract, and pre-revocation-backup reactivation denial all passed. Two logical restores preserved revocation.
- Performance: 1,000 encrypted drafts in 216.73 ms, decrypted in 178.55 ms, 800-reference pack encrypted in 7.71 ms, 75 mutations coordinated in three batches in 0.19 ms, and measured heap delta was 2.79 MiB.
- Migration/recovery: 24 migrations, 330 Prisma models/tables, canonical fingerprint `1FA8B2853E0650A07336354D106D4501C7E76E90260648BBEA4399CB694FFE7D`; version-44 restore remained count-idempotent.
- Backup: a version-44 backup was generated from the ignored worktree copy; it retained default-off native policy and no raw native credential material.
- Supply chain: `pnpm audit --prod --audit-level high` reported no known vulnerability. RustSec found no failing vulnerability and 19 documented allowed maintenance/target-specific warnings.
- Git safety and secret scan passed. The operational database stayed at SHA-256 `65F47EFA37DA321023439303770645F8D656F2BE58458C1A03B341408EF9A6FA` during copied-database QA.
- Final corrected-scope focused acceptance passed 32 files and 455 tests with zero skips and matching copied-database integrity. Its pre-merge inventory correctly refused product-scope expansion until this feature is merged into current main; the inventory must be regenerated on the exact merge commit.

## Security review closure

Frozen scan `505d5c21-bc44-438e-b110-80146a0cc9a1` used snapshot digest `codex-security-snapshot/v1:sha256:30eb4544ec0606a4dc6dc56d9d41880bb7352070c93786fb73346058353898cf`. Every confirmed path was remediated and then checked against the original boundary:

- production native APIs now require authenticated trusted ingress; explicit loopback development requires an isolated validated local client actor;
- bearer native sessions are bound to the exact signed device before nonce or last-seen mutation;
- Stronghold grants only the required destructive permissions and lock/reset success is not shown before persistence, removal, and unload succeed;
- vault derivation uses a random 32-byte per-install salt, Argon2id and an 8–12 digit PIN; existing-vault failure never creates replacement keys;
- native HTTP responses are bounded before buffer extension;
- mobile deep-link configuration uses the pinned plugin schema and replays a current callback after cold start/background unlock without double exchange;
- restored native sessions are always revoked and require fresh browser authorization;
- Windows, Android, and iOS checksum manifests are verified, co-uploaded, self-excluding, and portable from each artifact root;
- workflow path filters include both trusted native ingress and generated mobile hardening.

The remaining claims are intentionally limited: no hardware-backed key-storage certification, biometric unlock, remote wipe, signed package, public distribution, store approval, installed Android/iOS runtime, or physical-device behavior is claimed.
