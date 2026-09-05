import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const required = [
  "docs/REAL_USER_ACCESS_READINESS.md",
  "docs/evidence/REAL_USER_ACCESS_READINESS_1A_CLEARANCE.md",
  "docs/prompts/REAL_USER_ACCESS_ACTIVATION_1B.md",
  "lib/real-user-access/catalogue.ts",
  "lib/real-user-access/invitations.ts",
  "lib/real-user-access/webauthn.ts",
  "scripts/qa-real-user-access-readiness-1a-copied-db.ts",
  "tests/real-user-access-readiness-1a.test.ts"
];
const prohibitedExtensions = new Set([".db", ".sqlite", ".sqlite3", ".bak", ".dump", ".zip", ".7z", ".rar", ".pem", ".key", ".pfx", ".p12", ".exe", ".msi", ".msix", ".apk", ".ipa", ".png", ".jpg", ".jpeg", ".gif", ".svg"]);
const textExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".md", ".sql", ".yml", ".yaml", ".toml", ".txt"]);
const allowedRoots = ["app", "components", "config", "deploy/portable", "docs", "lib", "prisma", "scripts", "tests", "tools/release-evidence", ".github/workflows"];
const allowedRootFiles = new Set(["middleware.ts", "package.json", "pnpm-lock.yaml", "Dockerfile", "deploy/portable/Caddyfile"]);
const secretPatterns: Array<[string, RegExp]> = [
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["github-token", /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ["aws-access-key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ["google-api-key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["database-credential-url", /\b(?:postgres(?:ql)?|mysql):\/\/[^\s:'"/]+:[^\s@'"/]{8,}@/i],
  ["logged-auth-secret", /(?:console\.(?:log|error|warn)|details\s*:)[^\n]{0,120}(?:activationToken|challengeToken|oneTimeToken|recoveryCode|provisioningUri|secretEnvelope)\b/i]
];

async function main() {
  for (const relative of required) if (!(await stat(path.join(root, relative))).isFile()) throw new Error(`REQUIRED_ARTIFACT_MISSING:${relative}`);
  const changed = [...new Set([
    ...execFileSync("git", ["diff", "--name-only", "origin/main"], { cwd: root, encoding: "utf8" }).split(/\r?\n/),
    ...execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" }).split(/\r?\n/)
  ].filter(Boolean))];
  const failures: string[] = [];
  for (const relative of changed) {
    const normalized = relative.replaceAll("\\", "/");
    if (!allowedRoots.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)) && !allowedRootFiles.has(normalized)) failures.push(`${normalized}:out-of-scope`);
    if (prohibitedExtensions.has(path.extname(normalized).toLowerCase())) failures.push(`${normalized}:private-or-binary-artifact`);
    if (!textExtensions.has(path.extname(normalized).toLowerCase()) && !allowedRootFiles.has(normalized)) continue;
    const absolute = path.join(root, relative);
    const metadata = await stat(absolute);
    if (!metadata.isFile() || metadata.size > 5 * 1024 * 1024) { failures.push(`${normalized}:unsafe-or-oversized`); continue; }
    const source = await readFile(absolute, "utf8");
    for (const [label, pattern] of secretPatterns) if (pattern.test(source)) failures.push(`${normalized}:${label}`);
    for (const match of source.matchAll(/\b[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi)) {
      const domain = match[1].toLowerCase();
      if (!(domain === "example.com" || domain.endsWith(".example") || domain.endsWith(".test") || domain.endsWith(".invalid"))) failures.push(`${normalized}:non-synthetic-email-domain:${domain}`);
    }
  }
  if (failures.length) throw new Error(`REAL_USER_ACCESS_PUBLIC_REPO_SCAN_FAILED\n${failures.join("\n")}`);
  process.stdout.write(`${JSON.stringify({ result: "REAL_USER_ACCESS_PUBLIC_REPO_SCAN_PASSED", changedFiles: changed.length, requiredArtifacts: required.length, binaryArtifacts: 0, candidateSecrets: 0, realContacts: 0, realUsersActivated: false })}\n`);
}

main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "REAL_USER_ACCESS_PUBLIC_REPO_SCAN_FAILED"}\n`); process.exitCode = 1; });
