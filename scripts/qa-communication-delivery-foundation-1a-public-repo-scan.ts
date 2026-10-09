import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { reviewedBiometricCompanionPublicSources } from "./reviewed-biometric-companion-publication";

const root = process.cwd();
const required = [
  "docs/COMMUNICATION_DELIVERY_ARCHITECTURE.md",
  "docs/evidence/COMMUNICATION_DELIVERY_FOUNDATION_1A_CLEARANCE.md",
  "lib/communication-service.ts",
  "lib/communication-adapters.ts",
  "scripts/qa-communication-delivery-foundation-1a-copied-db.ts",
  "tests/communication-delivery-foundation-1a.test.ts"
];
const prohibitedExtensions = new Set([".db", ".sqlite", ".sqlite3", ".bak", ".dump", ".zip", ".7z", ".rar", ".pem", ".key", ".pfx", ".p12", ".exe", ".msi", ".msix", ".apk", ".ipa"]);
const textExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".md", ".sql", ".yml", ".yaml", ".toml", ".txt", ".css", ".prisma", ".ps1", ".py", ".rs", ".html", ".xml", ".sh", ".svg"]);
const allowedRoots = ["app", "components", "config", "docs", "lib", "prisma", "scripts", "tests", "tools/release-evidence", ".github/workflows"];
const allowedRootFiles = new Set(["apps/nalanda-biometric-bridge/package.json","apps/nalanda-cross-platform/package.json",".env.example","middleware.ts","package.json","pnpm-lock.yaml","deploy/portable/compose.yml","Dockerfile","deploy/portable/Caddyfile","deploy/portable/profiles/local-single-node.json","deploy/portable/profiles/generic-vps.json","deploy/portable/profiles/managed-cloud-contract.json","next.config.ts","tsconfig.tools-qa-support.json","pnpm-workspace.yaml","vitest.config.ts"]);
// R2 reviewed exact lab text blobs: output exclusion, real MJS declarations and
// the bounded synthetic CSV. No directory/extension admission; all checks remain.
for (const file of [".gitignore", "consumer-runner.d.mts", "fixture.d.mts", "output.d.mts", "examples/operations.csv"]) allowedRootFiles.add(`scripts/laptop-lab/${file}`);
// Reviewed Windows auth-lifecycle source only; the native subtree and binaries
// remain denied. Explicit files, including Cargo.lock, still receive all scans.
for (const file of ["src-tauri/Cargo.lock", "src-tauri/Cargo.toml", "src/App.tsx", "src/auth.ts", "src/auth-lifecycle.test.ts"]) allowedRootFiles.add(`apps/nalanda-cross-platform/${file}`);
// Reviewed reference-observation source/tests only; no native binary, cache,
// vault, reference payload, or broader subtree publication is admitted.
for (const file of ["src/offline-adapter.ts", "src/reference-refresh.ts", "src/reference-refresh.test.ts"]) allowedRootFiles.add(`apps/nalanda-cross-platform/${file}`);
// W1B's reviewed native trust consumer; still scanned as text for every secret/contact rule.
for (const file of ["src-tauri/build.rs", "src-tauri/src/lib.rs", "src-tauri/src/qa_profile.rs"]) allowedRootFiles.add(`apps/nalanda-cross-platform/${file}`);
// FA1-FA4 exact reviewed source/test registration; every content check still applies.
for (const file of ["src-tauri/src/qa_observation.rs", "src-tauri/src/qa_privacy.js", "src/App-lifecycle.test.tsx", "src/vault-unlock.test.ts", "src/vault-unlock.ts"]) allowedRootFiles.add(`apps/nalanda-cross-platform/${file}`);
// NATIVE-DEVICE-COMPLETION-1B: exact reviewed native test sources only.
// Existing binary, content, contact and size checks still apply to every file.
for (const file of ["tests/native/android.ts", "tests/native/android.test.ts", "tests/native/execute.ts", "tests/native/diagnostics.ts", "tests/native/component.mjs", "tests/native/NativeJourney.swift", "tests/native/NativeJourney.xcodeproj/project.pbxproj", "tests/native/NativeJourney.xcodeproj/xcshareddata/xcschemes/NativeJourney.xcscheme"]) allowedRootFiles.add(`apps/nalanda-cross-platform/${file}`);
// Exact frozen companion source files, including its six uncommon text formats.
// The normal scan loop below still applies every content/artifact rule.
for (const file of reviewedBiometricCompanionPublicSources) allowedRootFiles.add(file);
// Exact reviewed declaration; no global .mts exemption, all text guards apply.
allowedRootFiles.add("scripts/portable/native-minimum-compile.d.mts");
allowedRootFiles.add("scripts/portable/windows-compiler-ci.d.mts");
const secretPatterns: Array<[string, RegExp]> = [
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["github-token", /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ["aws-access-key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ["google-api-key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["meta-token", /\bEA[A-Za-z0-9]{60,}\b/],
  ["database-credential-url", /\b(?:postgres(?:ql)?|mysql):\/\/[^\s:'"/]+:[^\s@'"/]{8,}@/i]
];

async function main() {
  for (const relative of required) if (!(await stat(path.join(root, relative))).isFile()) throw new Error(`REQUIRED_ARTIFACT_MISSING:${relative}`);
  const configuredBase = process.env.COMMUNICATION_DIFF_BASE_SHA?.trim();
  if (configuredBase && !/^[a-f0-9]{40}$/i.test(configuredBase)) throw new Error("COMMUNICATION_DIFF_BASE_SHA_INVALID");
  const diffBase = configuredBase || "origin/main";
  const changed = [...new Set([
    ...execFileSync("git", ["diff", "--name-only", diffBase], { cwd: root, encoding: "utf8" }).split(/\r?\n/),
    ...execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" }).split(/\r?\n/)
  ].filter(Boolean))];
  const failures: string[] = [];
  for (const relative of changed) {
    const normalized = relative.replaceAll("\\", "/");
    if (!allowedRoots.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)) && !allowedRootFiles.has(normalized)) failures.push(`${normalized}:out-of-scope`);
    if (prohibitedExtensions.has(path.extname(normalized).toLowerCase())) failures.push(`${normalized}:private-or-binary-artifact`);
    if (!textExtensions.has(path.extname(normalized).toLowerCase()) && !allowedRootFiles.has(normalized)) {
      failures.push(`${normalized}:unreviewed-extension`);
      continue;
    }
    const absolute = path.join(root, relative);
    const metadata = await stat(absolute).catch(() => null);
    if (!metadata) { failures.push(`${normalized}:source-unavailable`); continue; }
    if (!metadata.isFile() || metadata.size > 5 * 1024 * 1024) { failures.push(`${normalized}:unsafe-or-oversized`); continue; }
    const source = await readFile(absolute, "utf8");
    for (const [label, pattern] of secretPatterns) if (pattern.test(source)) failures.push(`${normalized}:${label}`);
    const contactScope = normalized.includes("communication") || (!normalized.startsWith("tests/") && !normalized.startsWith("scripts/"));
    for (const match of contactScope ? source.matchAll(/\b[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi) : []) {
      const domain = match[1].toLowerCase();
      if (!(domain === "example.com" || domain.endsWith(".example") || domain.endsWith(".test") || domain.endsWith(".invalid") || domain.endsWith(".local"))) failures.push(`${normalized}:non-synthetic-email-domain:${domain}`);
    }
    if (contactScope && /\+91[6-9]\d{9}/.test(source)) failures.push(`${normalized}:dialable-indian-phone-pattern`);
  }
  if (failures.length) throw new Error(`COMMUNICATION_PUBLIC_REPO_SCAN_FAILED\n${failures.join("\n")}`);
  process.stdout.write(`${JSON.stringify({ result: "COMMUNICATION_PUBLIC_REPO_SCAN_PASSED", changedFiles: changed.length, requiredArtifacts: required.length, binaryArtifacts: 0, candidateSecrets: 0, realContacts: 0, rawSinkArchives: 0, repositoryException: "PUBLIC_SOURCE_AND_SYNTHETIC_EVIDENCE_ONLY" })}\n`);
}

main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "COMMUNICATION_PUBLIC_REPO_SCAN_FAILED"}\n`); process.exitCode = 1; });
