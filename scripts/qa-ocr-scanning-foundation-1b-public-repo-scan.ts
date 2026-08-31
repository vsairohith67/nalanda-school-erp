import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

const workspace = path.resolve(".");
const tracked = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: workspace, encoding: "utf8", windowsHide: true })
  .split("\0").filter(Boolean);
const ocrFiles = tracked.filter((name) => name === "package.json" || name === "pnpm-lock.yaml" || /(?:^|\/)(?:ocr|OCR)|ocr-scanning|ocr-worker/i.test(name));
const forbiddenArtifact = /\.(?:pdiparams|onnx|safetensors|gguf|pt|pth|ckpt|engine|plan|tar|tgz|zip|7z|npsbackup|db|sqlite|sqlite3)$/i;
const forbiddenSecret = /(?:-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|hf_[A-Za-z0-9]{24,}|(?:OCR_WORKER_HMAC_SECRET|S3_SECRET_ACCESS_KEY)\s*[=:]\s*["'][^"'\s]{16,}["'])/;
const forbiddenProvider = /(?:@google-cloud\/vision|@azure\/ai-form-recognizer|aws-sdk\/client-textract|cloudinary|tesseract\.js|surya-ocr|unlimited-ocr)/i;
const failures: string[] = [];
let scannedBytes = 0;

for (const name of ocrFiles) {
  if (forbiddenArtifact.test(name)) failures.push(`FORBIDDEN_PUBLIC_ARTIFACT:${name}`);
  const absolute = path.resolve(workspace, ...name.split("/"));
  if (!absolute.startsWith(`${workspace}${path.sep}`)) failures.push(`PATH_ESCAPE:${name}`);
  const stat = statSync(absolute);
  scannedBytes += stat.size;
  if (stat.size > 5 * 1024 * 1024) failures.push(`OCR_FILE_TOO_LARGE_FOR_PUBLIC_REPOSITORY:${name}`);
  if (stat.size <= 5 * 1024 * 1024) {
    const bytes = readFileSync(absolute);
    const text = bytes.toString("utf8");
    if (forbiddenSecret.test(text)) failures.push(`SECRET_LIKE_MATERIAL:${name}`);
    if ((name === "package.json" || name.startsWith("tools/ocr-worker/")) && forbiddenProvider.test(text)) failures.push(`UNAPPROVED_OCR_PROVIDER:${name}`);
  }
}

if (failures.length) throw new Error(`OCR_SCANNING_1B_PUBLIC_REPOSITORY_SCAN_FAILED\n${failures.join("\n")}`);
process.stdout.write(`${JSON.stringify({
  result: "OCR_SCANNING_1B_PUBLIC_REPOSITORY_SCAN_PASSED",
  trackedOcrFiles: ocrFiles.length,
  scannedBytes,
  manifestSha256: createHash("sha256").update(ocrFiles.sort().join("\n")).digest("hex"),
  modelWeights: 0,
  workerImages: 0,
  sourceDocuments: 0,
  databaseBackups: 0,
  secrets: 0
})}\n`);
