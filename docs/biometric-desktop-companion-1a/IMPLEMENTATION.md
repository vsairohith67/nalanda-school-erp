# BIOMETRIC-DESKTOP-COMPANION-1A implementation

Status: source implemented; vendor and deployment gates remain. This is integration-review material, not hardware or deployment clearance.

## Admission and ownership

Admitted released origin/main: 104aacc7bd314cae82e60bb02b5c8a965c7ffedd; tree 2c7f1a129e6b98abb9689abf7c989b0ed8468561. Dedicated physical checkout: school-software-worktrees/biometric-desktop-companion-1a, branch feature/biometric-desktop-companion-1a, created with released tools/dev-parallel/worktree-manager.mjs. No AGENTS.md was found in the applicable ancestry/repository. No active component edit collision was observed; the older biometric checkout was clean at PR16. PR19 and PR24–PR29 were inspected read-only, including PR28's unrelated recovery dependency change. The app chat-list tool was unavailable; no ownership claim rests on that unavailable result.

Write map: apps/nalanda-biometric-bridge/**; these four task docs; one unique .github/workflows/biometric-desktop-companion-1a.yml. ERP routes/services, root package/lockfiles, schema/migrations, shared workflows, native apps, master requirements and recovery ledger remain read-only. Released backup v45 is unchanged; no v48 candidate was imported.

## Gap to implementation

The released installer registered Node directly with sc.exe without an SCM-compatible host. A minimal .NET Worker host now uses Microsoft.Extensions.Hosting.WindowsServices 10.0.9 on net10.0-windows, supervising the existing TypeScript bridge. Machine-changing PowerShell commands default to plans. Config defaults to a persisted 60-second interval, transport OFF, synthetic loopback devices only. No production key or address was supplied.

Windows Job Objects own a suspended child before it runs, kill owned descendants on host closure, and carry inherited anonymous stdin/stdout pipes rather than a listener. Child secrets arrive over stdin, not command-line arguments or installed environment configuration. Startup/stop are bounded (1–30 seconds); worker restarts are bounded to 0–5 with backoff. SCM recovery is separately bounded to three actions per reset window. Console success does not establish boot or logoff behavior.

The worker runs sequential non-overlapping cycles and reloads validated persisted configuration. Queue/key/storage identity changes require a stopped restart. Node PID-lock acquisition has an exclusive directory guard; a crash inside this guard deliberately fails closed until management confirms there is no live owner. Host exclusivity is attached to the writable queue directory, including when two host configs reference the same queue.

## Security and package limits

Later installation targets a unique NT SERVICE virtual identity, protected Program Files binaries, and ProgramData configuration/DPAPI secret. Only queue/health subdirectories are writable by the service. Administrators and SYSTEM own protected trees; ordinary users get no service-control ACL. Ancestor/subtree reparse points and common-user parent delete-child rights are refused before registration. Installation requires valid host/Node Authenticode provenance, exact Node/agent SHA256 bindings, explicit local target and APPLY confirmation. A signed host alone does not authenticate its complete JavaScript dependency tree: an immutable signed full-package manifest is an outstanding deployment admission gate.

DPAPI LocalMachine encrypts a pre-provisioned secret containing queueKey, keyVersion and optionally the Ed25519 signing JWK. Existing secret files are never overwritten. File ACLs remain essential: machine DPAPI can be decrypted by a principal that can read it. Same-identity DPAPI was tested; the hosted SCM test separately exercises a virtual service identity. Actual standard accountant account isolation and administrator membership are deployment gates. Health is limited advisory output; it is private by default, with any accountant-readable subset requiring separate approval. Report files go only to an explicitly approved export directory at deployment.

Tool commands are in windows/companion.ps1: Preflight, Plan, Install, Doctor, Validate, Restart, Resume, Upgrade, Rollback, Uninstall. Changing actions require -Apply -TargetComputer <exact local name> -ConfirmApply APPLY:<name>; Install/Upgrade additionally require signed protected package paths. Uninstall retains keys, queue, configuration and the ownership checkpoint. A retained checkpoint requires an explicit management ownership review before reinstall. Upgrade/rollback preserve the queue and stable key; retain immutable old version packages/configs and revalidate hashes/signature before rollback. Partial installation failures must be treated as failed and inspected, never as successful installation.

## Queue and exact existing protocol

Only normalized attendance metadata enters the AES-256-GCM queue. Extra adapter fields are refused. Queue writes use exclusive temporary files, flush-to-disk and atomic replacement. Adapter receipts advance only after durable append. Corruption, wrong key, ENOSPC or capacity failure preserves the existing queue and fails closed. Plaintext state is capped at 32 MiB / 100,000 events; envelope at 48 MiB. Rejected/review events are never pruned.

A persisted prepared batch holds the exact schemaVersion=1 JSON body, batchReference, bridgeTime and immutable events. Retries sign that same body using the released Ed25519 headers and POST /api/biometric/ingest. Only a validated full ACK matching reference/count/schema/status removes pending delivery state. DUPLICATE_ACCEPTED must confirm the full batch; malformed/partial ACKs preserve events. Transport has bounded timeout, response size and backoff; 20 failed attempts or non-transient gates hold the batch.

Resume explicitly requires stopped owned service plus management revalidation; it resets retry counters while retaining the SAME body/identity/timestamps. It never discards punches. Released ERP's 48-hour freshness rules can block an old backlog even after reconnection: this remains a serial integration gate, not a reason to rewrite timestamps.

Sequence epoch + sequence, or verified device event reference, gives stable identity. Conflicting payloads and identifier-free same-second observations are retained for review. No alternating IN/OUT inference. ACK history retains seven days/1,000 full events, with encrypted normalized-metadata identity tombstones to prevent reposting older repeated downloads; tombstones cap at 100,000 and fail closed at capacity. No biometric template hashes exist.

Health separates processRunning, lastPollAt (successful device poll), lastPunchAt, queueDepth, lastSyncAt (confirmed ACK), adapterUnavailable, degraded status and reviewCount. Timestamps survive unavailable cycles; stale files must be assessed against updatedAt and SCM/process ownership, not alone.

## K30 boundary and synchronization layers

Official starting source: https://esslsecurity.com/software . Its desktop/DLL download listing does not establish K30 firmware compatibility, API signatures, licence/redistribution rights, or x86/x64 operation. No vendor archive was available in the authorized task directory; no laptop-wide search, proprietary binary execution, MDB access, registration or LAN/device connection occurred.

ESSL_ZK_LAN_SDK and ESSL_K30_PRO_PUSH explicitly return unavailable until exact official evidence is admitted. No real K30 operation is implemented or demonstrated. Simulator and governed CSV attendance import are implemented. CSV preserves exact user strings and timezone-bearing source timestamps, rejects timezone ambiguity and retains UNKNOWN direction. Any later x86 broker must use verified documented read-only calls and isolated bounded IPC; no guessed signatures or global COM registration.

Attendance is one-way device -> queue -> existing ingestion. Metadata reconciliation produces non-executable simulator proposals using stable references, conflicts, revision and expiry; outage/expired plans cannot deactivate or write employees. Automatic name matching/deletion/privilege changes are absent. Vendor-local bidirectional fingerprint mirroring is explicitly NOT IMPLEMENTED. Templates are never stored/transferred/cached/hashed/logged/backed up by this component or ERP.

## Monthly workbook

src/monthly-report.ts accepts the fixture-shaped approved summary + explicit period/version order manifest + month + mode. It refuses missing/extra/duplicate IDs, duplicate included positions, wrong month, unresolved numbers and unevidenced remarks. Synthetic authority cannot produce final-approved mode. No leave/late calculation occurs.

Run from component: pnpm report:monthly fixtures/monthly-summary.synthetic.json fixtures/report-order.synthetic.json 2026-08 <new-private-output.xlsx> synthetic. Only Month, Teaching Staff, Non-Teaching Staff and S.No/Name/Leaves/Lates/Remarks appear. Manifest order is exact within each group, numbering restarts per section, known zero and halves are numeric cells. Names/remarks are literal strings, never formulas. Styling uses existing root SheetJS/fflate dependencies read-only. Provenance/approval/source hashes are in a private adjacent manifest, not visible columns. Exported edits are copies and never ledger writeback. Approved live ERP summary export is missing; see ERP_INTEGRATION_PATCH.md.
