import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const required = [
  "lib/onboarding-preparation.ts", "scripts/onboarding-preparation.ts",
  "config/onboarding/source-inventory.schema.json", "config/onboarding/package-manifest.schema.json",
  "config/onboarding/mapping-catalogue.schema.json", "config/onboarding/mapping-catalogue.json",
  "config/onboarding/import-waves.json", "templates/onboarding/source-inventory.csv",
  "docs/REAL_DATA_ONBOARDING_PREPARATION.md", "docs/prompts/REAL_DATA_ONBOARDING_1A_R1.md"
];
const prohibitedExtensions = new Set([".db", ".sqlite", ".sqlite3", ".bak", ".dump", ".xls", ".xlsm", ".zip", ".7z", ".rar", ".pem", ".key", ".pfx", ".p12"]);
const textExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".md", ".csv", ".yml", ".yaml", ".toml", ".txt"]);
const allowedRoots = ["config/onboarding", "templates/onboarding", "docs", "lib", "scripts", "tests", ".github/workflows"];

async function filesUnder(directory: string): Promise<string[]> {
  const result: string[] = []; for (const item of await readdir(directory, { withFileTypes: true })) { const absolute = path.join(directory, item.name); if (item.isSymbolicLink()) throw new Error(`SYMLINK_REFUSED:${path.relative(root, absolute)}`); if (item.isDirectory()) result.push(...await filesUnder(absolute)); else result.push(absolute); } return result;
}

async function main() {
  for (const relative of required) if (!(await stat(path.join(root, relative))).isFile()) throw new Error(`REQUIRED_ARTIFACT_MISSING:${relative}`);
  const changed = [...new Set([
    ...execFileSync("git", ["diff", "--name-only", "origin/main"], { cwd: root, encoding: "utf8" }).split(/\r?\n/),
    ...execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" }).split(/\r?\n/)
  ].filter(Boolean))];
  for (const relative of changed) {
    if (prohibitedExtensions.has(path.extname(relative).toLowerCase())) throw new Error(`PRIVATE_OR_BINARY_ARTIFACT_REFUSED:${relative}`);
    if (!allowedRoots.some((prefix) => relative === prefix || relative.startsWith(`${prefix}/`)) && relative !== "package.json" && relative !== "README.md") throw new Error(`OUT_OF_SCOPE_CHANGED_PATH:${relative}`);
    if (textExtensions.has(path.extname(relative).toLowerCase())) {
      const file = path.join(root, relative); const metadata = await stat(file);
      if (!metadata.isFile() || metadata.size > 1024 * 1024) throw new Error(`UNSAFE_OR_OVERSIZED_PUBLIC_ARTIFACT:${relative}`);
      const text = await readFile(file, "utf8");
      if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:password|secret|token)\s*[:=]\s*["'][^"']{8,}["']/i.test(text)) throw new Error(`SECRET_LIKE_CONTENT_REFUSED:${relative}`);
      if (/\b(?:[6-9]\d{9})\b/.test(text) || /\b\d{12}\b/.test(text)) throw new Error(`REAL_LIKE_IDENTIFIER_REFUSED:${relative}`);
    }
  }
  for (const directory of ["config/onboarding", "templates/onboarding"]) {
    for (const file of await filesUnder(path.join(root, directory))) {
      const metadata = await stat(file); if (metadata.size > 1024 * 1024) throw new Error(`OVERSIZED_PUBLIC_ARTIFACT:${path.relative(root, file)}`);
      const text = await readFile(file, "utf8");
      if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:password|secret|token)\s*[:=]\s*["'][^"']{8,}["']/i.test(text)) throw new Error(`SECRET_LIKE_CONTENT_REFUSED:${path.relative(root, file)}`);
      if (/\b(?:[6-9]\d{9})\b/.test(text) || /\b\d{12}\b/.test(text)) throw new Error(`REAL_LIKE_IDENTIFIER_REFUSED:${path.relative(root, file)}`);
    }
  }
  const preparationSource = await readFile(path.join(root, "lib/onboarding-preparation.ts"), "utf8");
  if (/@prisma\/client|DATABASE_URL|\bfetch\s*\(|https?:\/\/[^"']+(?:api|upload)/i.test(preparationSource)) throw new Error("NO_WRITE_OR_NETWORK_BOUNDARY_FAILED");
  process.stdout.write(`${JSON.stringify({ result: "REAL_DATA_ONBOARDING_PREPARATION_PUBLIC_REPO_SCAN_PASSED", changedFiles: changed.length, requiredArtifacts: required.length, realDataProcessed: false })}\n`);
}

main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "PUBLIC_REPO_SCAN_FAILED"}\n`); process.exitCode = 1; });
