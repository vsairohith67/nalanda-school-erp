import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export type SafetyFinding = {
  relativePath: string;
  reasonCode: string;
};

type ScanSource = "candidate" | "staged" | "tracked";

const REQUIRED_IGNORE_RULES = [
  ".env",
  ".env.*",
  "!.env.example",
  "node_modules/",
  ".next/",
  "coverage/",
  "*.db",
  "*.sqlite",
  "*.sqlite3",
  "*.db-journal",
  "*.db-wal",
  "*.db-shm",
  "backups/*",
  "data/",
  "storage/",
  "uploads/",
  "private-uploads/",
  "pilot-data/",
  "tmp/",
  "*.log",
  "exports/",
  "screenshots/"
] as const;

const HIGH_CONFIDENCE_PATTERNS: Array<{ reasonCode: string; pattern: RegExp }> = [
  { reasonCode: "PRIVATE_KEY_MATERIAL", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { reasonCode: "GITHUB_TOKEN", pattern: /(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/ },
  { reasonCode: "OPENAI_API_KEY", pattern: /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/ },
  { reasonCode: "GOOGLE_OAUTH_SECRET", pattern: /GOCSPX-[A-Za-z0-9_-]{16,}/ },
  { reasonCode: "META_ACCESS_TOKEN", pattern: /EAA[A-Za-z0-9]{30,}/ },
  { reasonCode: "AWS_ACCESS_KEY", pattern: /AKIA[0-9A-Z]{16}/ },
  {
    reasonCode: "CREDENTIAL_BEARING_DATABASE_URL",
    pattern: /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s/:@]+:[^\s@]+@/i
  }
];

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".woff", ".woff2", ".ttf",
  ".pdf", ".zip", ".gz", ".xlsx", ".xls", ".docx", ".db", ".sqlite", ".sqlite3"
]);

function normalizeRelative(filePath: string) {
  return filePath.replaceAll("\\", "/").replace(/^\.\//, "");
}

function uniqueFindings(findings: SafetyFinding[]) {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = `${finding.reasonCode}:${finding.relativePath}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function classifyRiskyPath(filePath: string): SafetyFinding[] {
  const relativePath = normalizeRelative(filePath);
  const lower = relativePath.toLowerCase();
  const findings: SafetyFinding[] = [];
  const add = (reasonCode: string) => findings.push({ relativePath, reasonCode });

  if (/(^|\/)\.env(?:\..+)?$/i.test(relativePath) && !/(^|\/)\.env\.example$/i.test(relativePath)) add("ENV_FILE");
  if (/\.(?:db|sqlite|sqlite3)(?:-(?:journal|wal|shm))?$/i.test(relativePath) || /\.(?:db|sqlite|sqlite3)-(?:journal|wal|shm)$/i.test(relativePath)) add("DATABASE_FILE");
  if ((/(^|\/)backups?\//i.test(relativePath) || /backup/i.test(path.posix.basename(relativePath))) && /\.json$/i.test(relativePath)) add("BACKUP_JSON");
  if (/(^|\/)(?:data\/(?:fee-register-ocr|uploads?|private|cloud-backup[^/]*|provider[^/]*)|storage|uploads?|private-uploads?|ocr-storage)(?:\/|$)/i.test(relativePath)) add("PRIVATE_RUNTIME_STORAGE");
  if (/(^|\/)(?:tmp|temp|\.qa[^/]*|qa-artifacts|test-results)(?:\/|$)/i.test(relativePath)) add("QA_TEMPORARY_PATH");
  if (/\.log(?:\..+)?$/i.test(relativePath)) add("RUNTIME_LOG");
  if (/(^|\/)(?:node_modules|\.next|coverage|\.pnpm-store)(?:\/|$)/i.test(relativePath)) add("GENERATED_DEPENDENCY_OR_BUILD_PATH");
  if (/\.(?:enc|encrypted|cipher|age)$/i.test(relativePath) || /(^|\/)cloud-backup-(?:objects?|provider-objects?)(?:\/|$)/i.test(relativePath)) add("ENCRYPTED_OR_PROVIDER_ARTIFACT");
  if (/^(?:exports?|generated-exports?|generated-reports?|screenshots?|private-screenshots?)(?:\/|$)/i.test(relativePath)
    || /(^|\/)(?:data|tmp|temp|runtime)\/(?:exports?|generated-exports?|generated-reports?|screenshots?|private-screenshots?)(?:\/|$)/i.test(relativePath)) {
    add("GENERATED_EXPORT_OR_SCREENSHOT");
  }
  if (/schoolknot/i.test(lower) && /\.(?:csv|xlsx?|json|zip)$/i.test(relativePath)) add("SCHOOLKNOT_EXPORT_OR_CREDENTIAL_ARTIFACT");
  if (/(^|\/)(?:\.idea|\.vscode|\.vs|\.codex|\.agents)(?:\/|$)/i.test(relativePath)) add("LOCAL_IDE_OR_AGENT_STATE");

  return uniqueFindings(findings);
}

function placeholderValue(value: string) {
  const clean = value.trim().replace(/^["'`]|["'`]$/g, "").trim();
  if (!clean) return true;
  if (/^(?:true|false|disabled)$/i.test(clean)) return true;
  if (/^<[^>]+>$/.test(clean)) return true;
  if (/(?:placeholder|example|sample|mock|local-only|replace|generate-locally|your-)/i.test(clean)) return true;
  if (/^file:\.\/(?:local-|example)/i.test(clean)) return true;
  return false;
}

export function scanTextContent(filePath: string, content: string): SafetyFinding[] {
  const relativePath = normalizeRelative(filePath);
  const findings: SafetyFinding[] = [];
  const add = (reasonCode: string) => findings.push({ relativePath, reasonCode });

  for (const rule of HIGH_CONFIDENCE_PATTERNS) {
    if (rule.pattern.test(content)) add(rule.reasonCode);
  }

  const isDocumentation = /(^|\/)docs?\//i.test(relativePath) || /\.md$/i.test(relativePath);
  const isSyntheticTest = /(^|\/)(?:tests?|fixtures?)(?:\/|$)/i.test(relativePath)
    || /\.test\.[cm]?[jt]sx?$/i.test(relativePath)
    || /(^|\/)scripts\/(?:qa\d+[a-z0-9-]*-fixtures|sec1-runtime-[^/]+)\.[^/]+$/i.test(relativePath);
  const isEnvExample = /(^|\/)\.env\.example$/i.test(relativePath);

  if (isEnvExample) {
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (match && !placeholderValue(match[2])) add("ENV_EXAMPLE_NON_PLACEHOLDER");
    }
  }

  if (!isDocumentation && !isSyntheticTest && !isEnvExample) {
    const assignment = /(?:password|passwd|secret|token|api[_-]?key|encryption[_-]?key|webhook[_-]?secret|session[_-]?cookie|client[_-]?secret)\s*[:=]\s*["'`]([^"'`\r\n]{8,})["'`]/gi;
    let match: RegExpExecArray | null;
    while ((match = assignment.exec(content))) {
      if (!placeholderValue(match[1]) && !/^process\.env\./i.test(match[1])) add("REALISTIC_SECRET_ASSIGNMENT");
    }

    if (/(?:root|path|dir|directory|storage)\s*[:=]\s*["'`]?[A-Za-z]:\\Users\\[^\r\n"'`]+\\(?:Documents|Desktop|Downloads)\\/i.test(content)) {
      add("ABSOLUTE_PRIVATE_STORAGE_PATH");
    }
  }

  return uniqueFindings(findings);
}

export function formatFindings(findings: SafetyFinding[]) {
  return findings.map((finding) => `${finding.reasonCode} ${finding.relativePath}`).join("\n");
}

function gitExecutable() {
  const candidates = [
    process.env.GIT_EXECUTABLE,
    "git",
    "C:\\Program Files\\Git\\cmd\\git.exe",
    path.join(process.env.LOCALAPPDATA ?? "", "Programs", "Git", "cmd", "git.exe")
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ["--version"], { stdio: "ignore" });
      return candidate;
    } catch {
      // Try the next verified/local Git executable.
    }
  }
  return null;
}

function gitOutput(root: string, args: string[]) {
  const git = gitExecutable();
  if (!git) return null;
  try {
    return execFileSync(git, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}

function isGitRepository(root: string) {
  return gitOutput(root, ["rev-parse", "--is-inside-work-tree"])?.trim() === "true";
}

function parseNullList(value: string | null) {
  return value ? value.split("\0").filter(Boolean).map(normalizeRelative) : [];
}

function walkCandidates(root: string) {
  const result: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const relative = normalizeRelative(path.relative(root, absolute));
      if (entry.isDirectory()) {
        if (entry.name === ".git" || classifyRiskyPath(`${relative}/`).length > 0) continue;
        visit(absolute);
      } else if (entry.isFile() && classifyRiskyPath(relative).length === 0) {
        result.push(relative);
      }
    }
  };
  visit(root);
  return result;
}

function filesForSource(root: string, source: ScanSource) {
  if (!isGitRepository(root)) return source === "candidate" ? walkCandidates(root) : [];
  if (source === "candidate") return parseNullList(gitOutput(root, ["ls-files", "--cached", "--others", "--exclude-standard", "-z"]));
  if (source === "staged") return parseNullList(gitOutput(root, ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]));
  return parseNullList(gitOutput(root, ["ls-files", "-z"]));
}

function stagedContent(root: string, relativePath: string) {
  const git = gitExecutable();
  if (!git) return null;
  try {
    return execFileSync(git, ["show", `:${relativePath}`], { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}

function scanFile(root: string, relativePath: string, source: ScanSource) {
  const findings = classifyRiskyPath(relativePath);
  if (findings.length) return findings;
  if (BINARY_EXTENSIONS.has(path.extname(relativePath).toLowerCase())) return findings;

  const absolute = path.join(root, relativePath);
  let content: string | null = null;
  if (source === "staged") content = stagedContent(root, relativePath);
  else if (existsSync(absolute) && lstatSync(absolute).isFile()) content = readFileSync(absolute, "utf8");
  if (content == null || content.includes("\0")) return findings;
  return findings.concat(scanTextContent(relativePath, content));
}

function validateIgnorePolicy(root: string) {
  const ignorePath = path.join(root, ".gitignore");
  if (!existsSync(ignorePath)) return [{ relativePath: ".gitignore", reasonCode: "GITIGNORE_MISSING" }];
  const rules = new Set(readFileSync(ignorePath, "utf8").split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
  return REQUIRED_IGNORE_RULES
    .filter((rule) => !rules.has(rule))
    .map(() => ({ relativePath: ".gitignore", reasonCode: "IGNORE_POLICY_MISSING_REQUIRED_RULE" }));
}

export function runSafetyCheck(root = process.cwd()) {
  const findings: SafetyFinding[] = [...validateIgnorePolicy(root)];
  const sources: ScanSource[] = ["candidate", "staged", "tracked"];
  for (const source of sources) {
    for (const relativePath of filesForSource(root, source)) findings.push(...scanFile(root, relativePath, source));
  }
  return uniqueFindings(findings).sort((a, b) => a.relativePath.localeCompare(b.relativePath) || a.reasonCode.localeCompare(b.reasonCode));
}

function main() {
  const findings = runSafetyCheck();
  if (findings.length) {
    console.error("Git safety check failed. Values are redacted; only reason codes and paths are shown.");
    console.error(formatFindings(findings));
    process.exitCode = 1;
    return;
  }
  console.log("Git safety check passed: candidate, staged, and tracked files contain no detected secret or private runtime artifact.");
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/git-safety-check.ts")) main();
