import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const workspace = path.resolve(".");
const listed = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: workspace, encoding: "buffer", windowsHide: true });
if (listed.error || listed.status !== 0) throw new Error("BIOMETRIC_PUBLIC_REPO_SCAN_GIT_FAILED");
const files = listed.stdout.toString("utf8").split("\0").filter(Boolean);
const forbiddenArtifact = /(?:^|\/)(?:apps\/nalanda-biometric-bridge|biometric[^/]*)\/.*\.(?:exe|msi|msix|dll|sys|pdb|db|sqlite|sqlite3|bak|dump|zip|7z|rar|pfx|p12|pem|key|enc)$/i;
const secretPatterns: Array<[string, RegExp]> = [
  ["private-key-pem", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["github-token", /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ["aws-access-key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ["private-jwk", /["']d["']\s*:\s*["'][A-Za-z0-9_-]{32,}["']/],
  ["bridge-queue-key", /NALANDA_BIOMETRIC_QUEUE_KEY\s*[=:]\s*["']?[A-Za-z0-9_-]{40,}/],
  ["vendor-license-key", /(?:ESSL|ZKTECO|ZK)_LICENSE_KEY\s*[=:]\s*["']?[A-Za-z0-9_-]{16,}/i]
];
const failures: string[] = [];
for (const relative of files) {
  const normalized = relative.replaceAll("\\", "/");
  if (forbiddenArtifact.test(normalized)) failures.push(`${normalized}:forbidden-biometric-artifact`);
  const absolute = path.join(workspace, relative), stat = statSync(absolute);
  if (!stat.isFile() || stat.size > 5 * 1024 * 1024) continue;
  const buffer = readFileSync(absolute);
  if (buffer.includes(0)) continue;
  const source = buffer.toString("utf8");
  for (const [label, pattern] of secretPatterns) if (pattern.test(source)) failures.push(`${normalized}:${label}`);
}
if (failures.length) throw new Error(`BIOMETRIC_PUBLIC_REPO_SCAN_FAILED\n${failures.join("\n")}`);
process.stdout.write(`${JSON.stringify({ result: "BIOMETRIC_PUBLIC_REPO_SCAN_PASSED", filesScanned: files.length, forbiddenArtifacts: 0, candidateSecrets: 0, publicException: "SOURCE_AND_SYNTHETIC_EVIDENCE_ONLY" })}\n`);
