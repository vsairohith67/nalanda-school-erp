import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { reviewedBiometricCompanionPublicSources } from "../scripts/reviewed-biometric-companion-publication";
import { reviewedV1IntegrationPublicSources } from "../scripts/reviewed-v1-integration-publication";

const root = process.cwd(), parent = path.join(root, "tmp");
const scripts = ["communication-delivery-foundation-1a", "real-user-access-readiness-1a", "real-data-onboarding-preparation-1a"] as const;
type Kind = "reviewed" | "neighbour" | "nested-lookalike" | "binary" | "private-key" | "token" | "credential" | "oversized" | "real-contact" | "identity";

function scan(name: typeof scripts[number], kind: Kind, integration = false, dockerfile = false, overnight = false) {
  mkdirSync(parent, { recursive: true });
  const directory = mkdtempSync(path.join(parent, "v1-companion-publication-")), identity = lstatSync(directory);
  const script = path.join(root, `scripts/qa-${name}-public-repo-scan.ts`);
  const write = (file: string, value: string | Buffer) => {
    const target = path.join(directory, file); mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, value);
  };
  const git = (...args: string[]) => execFileSync("git", args, { cwd: directory, stdio: "pipe" }).toString().trim();
  try {
    const required = readFileSync(script, "utf8").match(/const required = \[([\s\S]*?)\];/)![1];
    for (const match of required.matchAll(/"([^"]+)"/g)) write(match[1], "// invented required artifact\n");
    if (name === "real-data-onboarding-preparation-1a") {
      mkdirSync(path.join(directory, "config/onboarding"), { recursive: true });
      mkdirSync(path.join(directory, "templates/onboarding"), { recursive: true });
    }
    git("init", "--initial-branch=main"); git("add", ".");
    git("-c", "user.name=Synthetic QA", "-c", "user.email=qa@example.com", "commit", "-m", "Invented publication baseline");
    git("update-ref", "refs/remotes/origin/main", "HEAD");
    // Force the real onboarding changed-scope branch rather than merely testing
    // its less restrictive no-onboarding-change branch.
    if (name === "real-data-onboarding-preparation-1a") write("lib/onboarding-preparation.ts", "// invented changed preparation source\n");
    for (const file of reviewedBiometricCompanionPublicSources) write(file, "// invented reviewed source\n");
    if (integration) for (const file of reviewedV1IntegrationPublicSources) write(file, "// invented reviewed combined source\n");
    const operand = overnight ? "app/api/expenses/[id]/payment-record/route.ts" : dockerfile ? "Dockerfile" : integration ? "apps/nalanda-cross-platform/src-tauri/src/qa_profile.rs" : "apps/nalanda-biometric-bridge/windows/host/OwnedProcess.cs";
    if (kind === "neighbour") write(overnight ? "app/api/expenses/[id]/unreviewed/route.ts" : integration ? "apps/nalanda-cross-platform/src-tauri/src/unreviewed.rs" : "apps/nalanda-biometric-bridge/windows/host/Unreviewed.cs", "// invented unregistered neighbour\n");
    if (kind === "nested-lookalike") write(overnight ? "app/api/expenses/nested/[id]/payment-record/route.ts" : integration ? "apps/nalanda-cross-platform/nested/src-tauri/src/qa_profile.rs" : "apps/nalanda-biometric-bridge/nested/windows/host/OwnedProcess.cs", "// invented lookalike\n");
    if (kind === "binary") write(integration ? "apps/nalanda-cross-platform/private.db" : "apps/nalanda-biometric-bridge/windows/host/package.exe", "invented forbidden package\n");
    if (kind === "private-key") write(operand, ["-----BEGIN ", "PRIVATE KEY-----"].join(""));
    if (kind === "token") write(operand, integration ? 'token = "' + "SYNTHETIC-ONLY-" + "A".repeat(36) + '"' : ["gh", "p_"].join("") + "A".repeat(36));
    if (kind === "credential") write(operand, "postgresql" + "://" + "invented:" + "P".repeat(12) + "@example.invalid/synthetic");
    if (kind === "oversized") write(operand, Buffer.alloc(5 * 1024 * 1024 + 1, 32));
    if (kind === "real-contact") write(operand, ["invented", "@", "example.org"].join(""));
    if (kind === "identity") write(operand, "6" + "1".repeat(9));
    const result = spawnSync(process.execPath, ["--import", pathToFileURL(path.join(root, "node_modules/tsx/dist/loader.mjs")).href, script], {
      cwd: directory, encoding: "utf8", timeout: 10_000,
      env: { ...process.env, COMMUNICATION_DIFF_BASE_SHA: git("rev-parse", "HEAD"), TSX_DISABLE_CACHE: "1" }
    });
    expect(result.error).toBeUndefined();
    if (kind === "reviewed") {
      expect(result.status, result.stderr).toBe(0); expect(result.stdout).toContain("PUBLIC_REPO_SCAN_PASSED");
      if (name === "real-data-onboarding-preparation-1a") expect(result.stdout).toContain('"scopeChecked":true');
    } else {
      expect(result.status, result.stdout).not.toBe(0);
      const code = name === "real-data-onboarding-preparation-1a"
        ? kind === "private-key" || integration && kind === "token" ? "SECRET_LIKE_CONTENT_REFUSED" : kind === "identity" ? "REAL_LIKE_IDENTIFIER_REFUSED"
        : integration && kind === "binary" ? "PRIVATE_OR_BINARY_ARTIFACT_REFUSED" : integration && kind === "oversized" ? "UNSAFE_OR_OVERSIZED_PUBLIC_ARTIFACT" : "OUT_OF_SCOPE_CHANGED_PATH"
        : kind === "private-key" ? ":private-key" : kind === "token" ? ":github-token" : kind === "credential" ? ":database-credential-url"
        : kind === "oversized" ? ":unsafe-or-oversized" : kind === "real-contact" ? ":non-synthetic-email-domain" : kind === "binary" ? ":private-or-binary-artifact" : ":out-of-scope";
      expect(result.stderr).toContain(code);
    }
  } finally {
    const current = lstatSync(directory), resolved = realpathSync(directory);
    expect(current.isSymbolicLink()).toBe(false); expect(current.dev).toBe(identity.dev); expect(current.ino).toBe(identity.ino);
    expect(path.dirname(resolved)).toBe(realpathSync(parent)); expect(path.basename(resolved)).toMatch(/^v1-companion-publication-/);
    rmSync(resolved, { recursive: true }); expect(existsSync(resolved)).toBe(false);
  }
}

describe.each(scripts.slice(0, 2))("V1 companion actual %s publication CLI", name => {
  it.each<Kind>(["reviewed", "neighbour", "nested-lookalike", "binary", "private-key", "token", "credential", "oversized", "real-contact"])("preserves the existing policy: %s", kind => scan(name, kind));
});
describe("V1 companion actual onboarding changed-scope publication CLI", () => {
  it.each<Kind>(["reviewed", "neighbour", "nested-lookalike", "private-key", "identity"])("applies complete text checks even to unusual reviewed formats: %s", kind => scan("real-data-onboarding-preparation-1a", kind));
});

describe("V1 combined actual onboarding changed-scope publication CLI", () => {
  it.each<Kind>(["reviewed", "neighbour", "nested-lookalike", "binary", "private-key", "token", "oversized", "identity"])("preserves complete checks for exact reviewed combined paths: %s", kind => scan("real-data-onboarding-preparation-1a", kind, true));
});

describe("Inherited exact Dockerfile actual onboarding publication controls", () => {
  it.each<Kind>(["private-key", "token", "oversized", "identity"])("retains full content refusal: %s", kind => scan("real-data-onboarding-preparation-1a", kind, true, true));
});

describe("Overnight exact product source actual onboarding publication controls", () => {
  it.each<Kind>(["reviewed", "neighbour", "nested-lookalike", "binary", "private-key", "token", "oversized", "identity"])("retains scope and content refusal: %s", kind => scan("real-data-onboarding-preparation-1a", kind, true, false, true));
});
