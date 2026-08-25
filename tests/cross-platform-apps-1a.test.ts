import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(".");
const source = (file: string) => readFileSync(path.join(root, file), "utf8");

describe("CROSS-PLATFORM-APPS-1A software boundary", () => {
  it("selects Tauri 2 through a dated, scored ADR", () => {
    const adr = source("docs/adr/ADR_CROSS_PLATFORM_APP_FRAMEWORK.md");
    expect(adr).toContain("Status: Accepted");
    expect(adr).toContain("Tauri 2");
    expect(adr).toContain("474");
    for (const candidate of ["Capacitor", "React Native", "Flutter"]) expect(adr).toContain(candidate);
  });

  it("grants native capabilities only to the bundled local main window", () => {
    const capability = source("apps/nalanda-cross-platform/src-tauri/capabilities/local-main.json");
    expect(capability).toContain('"local": true');
    expect(capability).toContain('"windows": ["main"]');
    expect(capability).not.toMatch(/remote|online-erp/i);
    for (const permission of ["stronghold:allow-destroy", "stronghold:allow-remove-store-record", "stronghold:allow-remove-secret"]) expect(capability).toContain(permission);
    const permission = source("apps/nalanda-cross-platform/src-tauri/permissions/local-shell.toml");
    const allowedCommands = permission.match(/commands\.allow = \[([\s\S]*?)\]/)?.[1] ?? "";
    expect(allowedCommands).not.toMatch(/shell|filesystem|sql|process/i);
  });

  it("uses fixed native network operations, exact origins, no redirects and bounded responses", () => {
    const rust = source("apps/nalanda-cross-platform/src-tauri/src/lib.rs");
    expect(rust).toContain("enum NativeApiOperation");
    expect(rust).toContain("Policy::none()");
    expect(rust).toContain("MAX_RESPONSE_BYTES");
    expect(rust).toMatch(/response\s*\.chunk\(\)/);
    expect(rust.indexOf("append_bounded_response_chunk(&mut bytes, &chunk)")).toBeLessThan(rust.indexOf("String::from_utf8(bytes)"));
    expect(rust).toContain("allowed_online_navigation");
    expect(rust).not.toMatch(/Command::new|std::process|execute_batch\(&.*input/s);
  });

  it("stores local domain data only as AES-GCM ciphertext envelopes", () => {
    const crypto = source("apps/nalanda-cross-platform/src/crypto.ts");
    const rust = source("apps/nalanda-cross-platform/src-tauri/src/lib.rs");
    expect(crypto).toContain('name: "AES-GCM"');
    expect(crypto).toContain("additionalData");
    expect(rust).toContain("encrypted_cache");
    const cacheSchema = rust.match(/CREATE TABLE IF NOT EXISTS encrypted_cache \(([\s\S]*?)\);/)?.[1] ?? "";
    expect(cacheSchema).not.toMatch(/student_name|admission_no|payer_name|amount_paise/);
  });

  it("keeps private device keys and refresh tokens inside Stronghold", () => {
    const native = source("apps/nalanda-cross-platform/src/native.ts");
    expect(native).toContain("deriveSLIP10");
    expect(native).toContain("signEd25519");
    expect(native).toContain("native-refresh-token");
    expect(native).toContain('invoke<VaultSnapshotState>("vault_snapshot_state")');
    expect(native).toContain('/^\\d{8,12}$/');
    expect(native).not.toMatch(/remove\([^\n]+\.catch/);
    expect(native).not.toMatch(/localStorage|sessionStorage/);
    const rust = source("apps/nalanda-cross-platform/src-tauri/src/lib.rs");
    expect(rust).toContain("prepare_stronghold_salt");
    expect(rust).toContain("STRONGHOLD_SALT_MISSING_FOR_EXISTING_VAULT");
    expect(rust).not.toContain('b"nps-erp-native-v1"');
  });

  it("keeps server credentials opaque, hashed and replay-governed", () => {
    const schema = source("prisma/schema.prisma");
    const migration = source("prisma/migrations/20260826003000_cross_platform_apps_1a/migration.sql");
    for (const field of ["accessTokenHash", "refreshTokenHash", "codeHash", "challengeHash", "stateHash", "nonceHash"]) expect(schema).toContain(field);
    expect(schema).not.toMatch(/native.*password|native.*pin/i);
    expect(migration).toContain("NativeAuthorizationCode_single_use");
    expect(migration).toContain("NativeSession_revocation_irreversible");
    expect(migration).toContain("NativeRefreshTokenHistory_append_only_delete");
  });

  it("backs up only durable native bindings, revocation history and the fixed app policy", () => {
    const backup = source("lib/native-app/backup.ts");
    expect(backup).toContain('NATIVE_APP_BACKUP_KEYS = ["nativeSessions", "nativeRefreshTokenHistory"]');
    expect(backup).toContain("nativeAppPolicy");
    expect(backup).toContain("featureDefaultEnabled: false");
    expect(backup).toContain("deployment configuration remains authoritative and cannot be lowered by restore");
    expect(backup).toContain("RESTORED_CREDENTIAL_REQUIRES_REAUTHORIZATION");
    expect(backup).toContain("restore can never reactivate an access or refresh credential");
    expect(backup).not.toMatch(/NativeAuthRequest|NativeAuthorizationCode/);
    expect(source("lib/backup.ts")).toContain("...nativeAppBackup");
    expect(source("lib/restore-database.ts")).toContain("restoreNativeAppBackup");
  });

  it("reuses only the three cleared offline finance draft operations", () => {
    const domain = source("apps/nalanda-cross-platform/src/domain.ts");
    expect(domain).toContain('"FEE_PAYMENT", "EXPENSE_DRAFT", "MISC_INCOME"');
    expect(domain).not.toMatch(/MARKS|ATTENDANCE|STUDENT_DELETE/);
    const sync = source("app/api/native/v1/sync/route.ts");
    expect(sync).toContain("validateOfflineSyncBatch");
    expect(sync).toContain("processOfflineMutation");
    expect(source("apps/nalanda-cross-platform/src/App.tsx")).toContain('nativeSessionRequest(vault, activeTokens, "REFERENCE_PACK")');
    expect(source("apps/nalanda-cross-platform/src/App.tsx")).toContain('nativeSessionRequest(vault, activeTokens, "SYNC"');
    const adapter = source("apps/nalanda-cross-platform/src/offline-adapter.ts");
    for (const contract of ["DraftStore", "OutboxStore", "ReferenceSnapshotStore", "SyncCursorStore", "DeviceKeyStore", "AcceptedResultStore"]) expect(adapter).toContain(`interface ${contract}`);
  });

  it("bypasses browser cookies only for the exact route-authorized native protocol", () => {
    const middleware = source("middleware.ts");
    expect(middleware).toContain('"/api/native-auth/request"');
    expect(middleware).toContain('"/api/native/v1/sync"');
    expect(middleware).toContain("!isNativeRouteAuthorized && !session");
    expect(middleware).toContain("!isNativeRouteAuthorized && !unsafeRequestOriginAllowed(request)");
    expect(source("app/api/native/v1/sync/route.ts")).toContain('resolveNativeSession(request, "offline:sync")');
  });

  it("uses the official school logo and explicit offline/conflict wording", () => {
    const app = source("apps/nalanda-cross-platform/src/App.tsx");
    expect(app).toContain("nalanda-logo-transparent.png");
    expect(app).toContain("This is a draft, not a receipt");
    expect(source("apps/nalanda-cross-platform/src/domain.ts")).toContain("Nothing was overwritten");
  });

  it("has a default-off zero-rollout release record and no signing or deployment automation", () => {
    const flags = JSON.parse(source("config/release-feature-flags.json"));
    expect(flags.find((flag: { key: string }) => flag.key === "cross-platform-apps-1a")).toMatchObject({ defaultState: false, rolloutPercentage: 0, version: 1 });
    const workflows = source(".github/workflows/cross-platform-apps.yml");
    expect(workflows).not.toMatch(/microsoft store|google play|app store|testflight|notari|code[- ]?signing|production deploy|publish/i);
    expect(workflows.match(/SHA256SUMS\.txt/g)?.length).toBeGreaterThanOrEqual(9);
    expect(workflows).toContain("Verify Windows package checksum");
    expect(workflows).toContain("Verify Android package checksums");
    expect(workflows).toContain("Verify iOS simulator checksums");
    expect(workflows).toContain('working-directory: apps/nalanda-cross-platform/src-tauri/gen/android/app/build/outputs/apk');
    expect(workflows).toContain('working-directory: apps/nalanda-cross-platform/src-tauri/gen/apple/build');
    expect(workflows).toContain('- "lib/trusted-client.ts"');
    expect(workflows).toContain('- "scripts/harden-cross-platform-generated-project.mjs"');
    expect(workflows).toContain("find . -type f");
    expect(workflows).toContain('DATABASE_URL: "file:../tmp/release-ci/synthetic.db"');
    expect(workflows).toContain("name: Install pinned full-regression tools");
    expect(workflows).toContain("choco install ripgrep --version=15.2.0");
    expect(workflows).toContain("REPORT_CARD_PDFTOPPM_PATH");
    expect(workflows).toMatch(/contracts:\s+[\s\S]*?runs-on: windows-2025/);
    expect(workflows.match(/ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/g)?.length).toBe(4);
    for (const command of ["pnpm test", "pnpm typecheck", "pnpm build", "pnpm migration:fresh-check", "pnpm migration:restore-check", "pnpm security:resilience:acceptance", "pnpm app:rust:test"]) {
      expect(workflows).toContain(command);
    }
    expect(source("apps/nalanda-cross-platform/src-tauri/tauri.conf.json")).toContain('"scheme": ["nalandaps-erp"]');
  });

  it("hardens generated mobile projects before compilation", () => {
    const hardener = source("scripts/harden-cross-platform-generated-project.mjs");
    expect(hardener).toContain('android:allowBackup="false"');
    expect(hardener).toContain('android:usesCleartextTraffic="false"');
    expect(hardener).toContain("WindowManager.LayoutParams.FLAG_SECURE");
    expect(hardener).toContain("UIFileSharingEnabled");
    expect(hardener).toContain("LSSupportsOpeningDocumentsInPlace");
    expect(hardener).toContain('CI=true pnpm tauri ios xcode-script');
    const scripts = JSON.parse(source("package.json")).scripts;
    expect(scripts["app:android:init"]).toContain("harden-cross-platform-generated-project.mjs android");
    expect(scripts["app:ios:init"]).toContain("harden-cross-platform-generated-project.mjs ios");
  });

  it("preserves Tauri's generated Android lifecycle while adding screen protection", () => {
    const fixture = mkdtempSync(path.join(tmpdir(), "nalanda-android-hardening-"));
    const manifest = path.join(fixture, "android", "app", "src", "main", "AndroidManifest.xml");
    const activity = path.join(fixture, "android", "app", "src", "main", "java", "com", "nalandaps", "erp", "MainActivity.kt");
    try {
      mkdirSync(path.dirname(activity), { recursive: true });
      writeFileSync(manifest, '<manifest><application android:allowBackup="true"></application></manifest>');
      writeFileSync(activity, `package com.nalandaps.erp

import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import app.tauri.TauriActivity

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }
}
`);
      for (let pass = 0; pass < 2; pass += 1) {
        const result = spawnSync(process.execPath, [path.join(root, "scripts", "harden-cross-platform-generated-project.mjs"), "android", fixture], { encoding: "utf8" });
        expect(result.status, result.stderr).toBe(0);
      }
      const hardened = readFileSync(activity, "utf8");
      expect(hardened).toContain("import android.view.WindowManager");
      expect(hardened).toContain("enableEdgeToEdge()");
      expect(hardened).toContain("WindowManager.LayoutParams.FLAG_SECURE");
      expect(hardened.match(/override fun onCreate/g)?.length).toBe(1);
      expect(hardened.match(/class MainActivity/g)?.length).toBe(1);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("keeps privacy-safe diagnostics bounded and payload-free", () => {
    const rust = source("apps/nalanda-cross-platform/src-tauri/src/lib.rs");
    expect(rust).toContain("LIMIT 500");
    expect(rust).toContain("7 * 24 * 60 * 60");
    expect(rust).toContain("safe_error_code");
    const logSchema = rust.match(/CREATE TABLE IF NOT EXISTS diagnostic_log \(([\s\S]*?)\);/)?.[1] ?? "";
    expect(logSchema).not.toMatch(/payload|amount|student|token|password|pin/i);
    const app = source("apps/nalanda-cross-platform/src/App.tsx");
    expect(app).toContain("Prepare redacted diagnostics");
    expect(app).toContain("contains no draft payload");
  });

  it("exposes and enforces the bounded native compatibility contract", () => {
    const context = source("app/api/native/v1/context/route.ts");
    for (const field of ["serverVersion", "minimumSupportedAppVersion", "currentSyncSchemaVersion", "minimumSupportedSyncSchema", "maintenanceState", "featureAvailability"]) expect(context).toContain(field);
    const app = source("apps/nalanda-cross-platform/src/App.tsx");
    expect(app).toContain('setCompatibility("UPDATE_REQUIRED")');
    expect(app).toContain('setCompatibility("SERVER_INCOMPATIBLE")');
    expect(app).toContain("local drafts are preserved");
  });

  it("locks on background and inactivity and requires explicit local-wipe confirmation", () => {
    const app = source("apps/nalanda-cross-platform/src/App.tsx");
    expect(app).toContain("5 * 60 * 1000");
    expect(app).toContain('document.visibilityState === "hidden"');
    expect(app).toContain("ERASE LOCAL DRAFTS");
    const rust = source("apps/nalanda-cross-platform/src-tauri/src/lib.rs");
    expect(rust).toContain('confirmation != "ERASE LOCAL DRAFTS"');
    expect(rust).toContain('execute("DELETE FROM encrypted_cache"');
    expect(rust).toContain("unlock_guard_record_failure");
    expect(rust).toContain("failed_attempts = 0");
    expect(app).toContain("Too many failed attempts");
    expect(app).toContain('minLength={8}');
    expect(app.indexOf("await current?.lock()")).toBeLessThan(app.indexOf("setVault(null); setTokens(null); setReferencePack(null); setLocked(true)"));
    expect(app).toContain("APP_LOCK_FAILED");
    expect(app).toContain("LOCAL_RESET_FAILED");
    const auth = source("apps/nalanda-cross-platform/src/auth.ts");
    expect(auth).toContain("getCurrent");
    expect(auth).toContain("await handleUrls(await getCurrent())");
    expect(auth).toContain("removeSecureJson(PENDING_KEY)");
  });
});
