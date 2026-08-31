import { createHash } from "node:crypto";
import { closeSync, openSync, readFileSync, readSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const lockPath = resolve(scriptDirectory, "..", "candidates", "candidate-lock.json");
const lock = JSON.parse(readFileSync(lockPath, "utf8"));

export function redactDiagnostic(value, secrets = []) {
  let redacted = String(value || "");
  for (const secret of secrets) {
    if (typeof secret === "string" && secret.length >= 8) {
      redacted = redacted.split(secret).join("[REDACTED_EPHEMERAL_SECRET]");
    }
  }
  return redacted
    .replace(/(['"]?api_key['"]?\s*[:=]\s*\[?\s*['"])[^'"]+(['"]\s*\]?)/gi, "$1[REDACTED_EPHEMERAL_SECRET]$2")
    .replace(/(authorization\s*[:=]\s*['"]?bearer\s+)[a-z0-9._~-]+/gi, "$1[REDACTED_EPHEMERAL_SECRET]");
}

export function boundedDiagnostic(value, maxLength = 20_000) {
  if (value.length <= maxLength) return value;
  const marker = "\n...[BOUNDED_DIAGNOSTIC_MIDDLE_REMOVED]...\n";
  const headLength = Math.floor((maxLength - marker.length) * 0.4);
  const tailLength = maxLength - marker.length - headLength;
  return `${value.slice(0, headLength)}${marker}${value.slice(-tailLength)}`;
}

export function candidateLock(id) {
  const candidate = lock.candidates.find((item) => item.id === id);
  if (!candidate) throw new Error(`CANDIDATE_LOCK_ENTRY_MISSING:${id}`);
  return candidate;
}

function hashFile(path) {
  const digest = createHash("sha256");
  const descriptor = openSync(path, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead;
    do {
      bytesRead = readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead) digest.update(buffer.subarray(0, bytesRead));
    } while (bytesRead);
  } finally {
    closeSync(descriptor);
  }
  return digest.digest("hex");
}

export function verifyFile(path, expected, label) {
  let stats;
  try {
    stats = statSync(path);
  } catch {
    throw new Error(`CANDIDATE_FILE_MISSING:${label}`);
  }
  if (!stats.isFile() || stats.size !== Number(expected.bytes)) {
    throw new Error(`CANDIDATE_FILE_SIZE_MISMATCH:${label}`);
  }
  if (hashFile(path) !== String(expected.sha256).toLowerCase()) {
    throw new Error(`CANDIDATE_FILE_SHA256_MISMATCH:${label}`);
  }
}

export function verifyUnlimitedSnapshot(modelRoot) {
  const candidate = candidateLock("unlimited-ocr");
  for (const [name, expected] of Object.entries(candidate.files)) {
    verifyFile(join(modelRoot, name), expected, `unlimited-ocr:${name}`);
  }
  const observed = readdirSync(modelRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
  const expected = Object.keys(candidate.files).sort();
  if (JSON.stringify(observed) !== JSON.stringify(expected)) {
    throw new Error("UNLIMITED_MODEL_FILE_ALLOWLIST_MISMATCH");
  }
  return candidate;
}

export function verifyPaddleModels(cacheRoot) {
  const candidate = candidateLock("paddleocr");
  for (const model of candidate.models) {
    const modelRoot = join(cacheRoot, "official_models", model.name);
    for (const [name, expected] of Object.entries(model.runtime_files)) {
      verifyFile(join(modelRoot, name), expected, `paddleocr:${model.name}:${name}`);
    }
    const observed = readdirSync(modelRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile() && ![".gitattributes", "README.md"].includes(entry.name))
      .map((entry) => entry.name)
      .sort();
    const expected = Object.keys(model.runtime_files).sort();
    if (JSON.stringify(observed) !== JSON.stringify(expected)) {
      throw new Error(`PADDLE_MODEL_FILE_ALLOWLIST_MISMATCH:${model.name}`);
    }
  }
  return candidate;
}

function directoryBundleHash(directory) {
  const names = readdirSync(directory)
    .filter((name) => statSync(join(directory, name)).isFile())
    .sort();
  const receipt = names
    .map((name) => {
      const path = join(directory, name);
      const bytes = statSync(path).size;
      return `${name}\0${bytes}\0${hashFile(path)}\n`;
    })
    .join("");
  return createHash("sha256").update(receipt).digest("hex");
}

export function verifySuryaRuntime(modelRoot, runtimePath) {
  const candidate = candidateLock("surya");
  verifyFile(join(modelRoot, "surya-2.gguf"), candidate.files["surya-2.gguf"], "surya:model");
  verifyFile(
    join(modelRoot, "surya-2-mmproj.gguf"),
    candidate.files["surya-2-mmproj.gguf"],
    "surya:projector",
  );
  verifyFile(join(modelRoot, "chat_template.jinja"), candidate.chat_template, "surya:chat-template");
  if (directoryBundleHash(dirname(runtimePath)) !== candidate.runtime_bundle_sha256) {
    throw new Error("SURYA_RUNTIME_BUNDLE_INTEGRITY_MISMATCH");
  }
  return candidate;
}

function walkFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "__pycache__" || entry.name.endsWith(".pyc")) return [];
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(path) : [path];
  });
}

export function containerBuildInputDigest(variant) {
  const benchmarkRoot = resolve(scriptDirectory, "..");
  const paths = [
    join(benchmarkRoot, "pyproject.toml"),
    join(benchmarkRoot, "uv.lock"),
    join(benchmarkRoot, "README.md"),
    ...walkFiles(join(benchmarkRoot, "src")),
  ];
  if (variant === "paddle") {
    paths.push(
      join(benchmarkRoot, "candidates", "candidate-lock.json"),
      join(benchmarkRoot, "candidates", "paddle", "Dockerfile"),
      join(benchmarkRoot, "candidates", "paddle", "pyproject.toml"),
      join(benchmarkRoot, "candidates", "paddle", "uv.lock"),
    );
  } else if (variant === "client") {
    paths.push(join(benchmarkRoot, "candidates", "client", "Dockerfile"));
  } else {
    throw new Error(`UNKNOWN_CONTAINER_VARIANT:${variant}`);
  }
  const receipt = paths
    .sort()
    .map((path) => {
      const relative = path.slice(benchmarkRoot.length + 1).replaceAll("\\", "/");
      return `${relative}\0${statSync(path).size}\0${hashFile(path)}\n`;
    })
    .join("");
  return createHash("sha256").update(receipt).digest("hex");
}
