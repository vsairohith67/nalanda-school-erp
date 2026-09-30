# Nalanda Biometric Desktop Companion 1A

The TypeScript bridge now has a genuine .NET Windows Service supervisor. Production transport is OFF by default; only invented loopback fixtures are configured. K30/eSSL profiles explicitly remain SDK-unavailable. Source/console QA is distinct from SCM and school hardware acceptance.

Build/test from repository: pnpm --filter @nalanda/biometric-bridge test, typecheck, build. Component commands: pnpm config:validate <bridge.json>; pnpm report:monthly <approved-summary.json> <order-manifest.json> <YYYY-MM> <new-output.xlsx> synthetic|final-approved. Synthetic approval cannot authorize a final-approved report.

Service source is windows/host/. Compile with supported .NET 10 SDK; publish Windows x64 self-contained using its NuGet lock. windows/companion.ps1 implements Preflight, Plan, Install, Doctor, Validate, Restart, Resume, Upgrade, Rollback and non-destructive Uninstall. Machine-changing actions default to DRY_RUN and require explicit target/apply plus administrator authority. No install is authorized by this source checkpoint.

Installed secrets are machine-DPAPI protected, provisioned via stdin and injected into the owned child through an inherited anonymous pipe. Legacy standalone synthetic commands can use a stable NALANDA_BIOMETRIC_QUEUE_KEY; installed service does not depend on global plaintext environment secrets. Never replace a key when decryption fails.

The encrypted queue persists exact signed batch bodies across retries, requires complete validated ACK, preserves rejection/review records and old identity tombstones, and fails closed at corruption/capacity. A stopped administrator Resume preserves body and timestamps. Released ERP's 48-hour freshness gate needs serial integration for prolonged outages.

Simulator/CSV attendance import and non-executable metadata proposals are software capabilities. No live K30 connection or vendor MDB integration is demonstrated. Fingerprint bidirectional mirroring is NOT IMPLEMENTED; templates never enter this component.

Read [implementation](../../docs/biometric-desktop-companion-1a/IMPLEMENTATION.md), [evidence](../../docs/biometric-desktop-companion-1a/EVIDENCE.md), [ERP patch](../../docs/biometric-desktop-companion-1a/ERP_INTEGRATION_PATCH.md) and [separate school acceptance](../../docs/biometric-desktop-companion-1a/SCHOOL_PC_ACCEPTANCE.md). Keep all actual identities, secrets, device addresses and staff reports private.
