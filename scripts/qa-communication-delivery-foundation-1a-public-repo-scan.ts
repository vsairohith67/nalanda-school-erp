import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

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
const allowedRootFiles = new Set([".env.example", "middleware.ts", "package.json", "pnpm-lock.yaml"]);
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
    const absolute = path.join(root, relative), metadata = await stat(absolute);
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
