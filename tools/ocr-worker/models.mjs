import { createHash } from "node:crypto";
import { createWriteStream, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, closeSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..", "..");
const lock = JSON.parse(readFileSync(join(repositoryRoot, "tools", "ocr-benchmark", "candidates", "candidate-lock.json"), "utf8"));
const paddle = lock.candidates.find((candidate) => candidate.id === "paddleocr");
if (!paddle) throw new Error("OCR_PADDLE_LOCK_MISSING");
const defaultBase = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "Nalanda", "ocr-models", "1b", "paddleocr") : "";
const cacheRoot = resolve(process.env.NALANDA_OCR_MODEL_ROOT || defaultBase);
if (!defaultBase || !isAbsolute(cacheRoot) || within(repositoryRoot, cacheRoot)) throw new Error("OCR_MODEL_CACHE_MUST_BE_OUTSIDE_REPOSITORY");

function within(parent, candidate) {
  const result = relative(parent, candidate);
  return result === "" || (result !== ".." && !result.startsWith(`..\\`) && !result.startsWith("../") && !isAbsolute(result));
}
function hashFile(path) {
  const hash = createHash("sha256"); const descriptor = openSync(path, "r"); const buffer = Buffer.allocUnsafe(1024 * 1024);
  try { let read; do { read = readSync(descriptor, buffer, 0, buffer.length, null); if (read) hash.update(buffer.subarray(0, read)); } while (read); }
  finally { closeSync(descriptor); }
  return hash.digest("hex");
}
function safeFile(path, expected, label) {
  if (!existsSync(path)) return false;
  const stats = lstatSync(path);
  if (!stats.isFile() || stats.isSymbolicLink() || stats.size !== Number(expected.bytes) || hashFile(path) !== expected.sha256) throw new Error(`OCR_MODEL_CONTENT_MISMATCH:${label}`);
  return true;
}
function verify() {
  for (const model of paddle.models) {
    const modelRoot = join(cacheRoot, "official_models", model.name);
    for (const [filename, expected] of Object.entries(model.runtime_files)) safeFile(join(modelRoot, filename), expected, `${model.name}:${filename}`) || (() => { throw new Error(`OCR_MODEL_FILE_MISSING:${model.name}:${filename}`); })();
    const revisionReceipt = join(cacheRoot, ".nalanda-revisions", model.name);
    if (!existsSync(revisionReceipt) || readFileSync(revisionReceipt, "utf8").trim() !== model.revision) throw new Error(`OCR_MODEL_REVISION_RECEIPT_MISMATCH:${model.name}`);
  }
  return { verified: true, offlineReady: true, cacheRoot, engine: paddle.package, runtime: paddle.runtime_package, models: paddle.models.map(({ name, revision, weight_sha256 }) => ({ name, revision, weightSha256: weight_sha256 })) };
}
async function download(url, target, expected, label) {
  const partial = `${target}.partial`;
  if (existsSync(partial)) rmSync(partial, { force: true });
  const response = await fetch(url, { redirect: "follow", headers: { "User-Agent": "Nalanda-OCR-Model-Provisioner/1.0" } });
  if (!response.ok || !response.body) throw new Error(`OCR_MODEL_DOWNLOAD_FAILED:${label}:${response.status}`);
  const declared = Number(response.headers.get("content-length") ?? expected.bytes);
  if (!Number.isSafeInteger(declared) || declared !== Number(expected.bytes)) throw new Error(`OCR_MODEL_DOWNLOAD_SIZE_DECLARATION_MISMATCH:${label}`);
  const output = createWriteStream(partial, { flags: "wx", mode: 0o600 });
  let bytes = 0;
  try {
    for await (const chunk of response.body) { bytes += chunk.length; if (bytes > Number(expected.bytes)) throw new Error(`OCR_MODEL_DOWNLOAD_TOO_LARGE:${label}`); if (!output.write(chunk)) await new Promise((accept) => output.once("drain", accept)); }
    await new Promise((accept, reject) => output.end((error) => error ? reject(error) : accept()));
    if (bytes !== Number(expected.bytes) || hashFile(partial) !== expected.sha256) throw new Error(`OCR_MODEL_DOWNLOAD_INTEGRITY_FAILED:${label}`);
    renameSync(partial, target);
  } catch (error) { output.destroy(); if (existsSync(partial)) rmSync(partial, { force: true }); throw error; }
}
async function provision() {
  mkdirSync(cacheRoot, { recursive: true, mode: 0o700 });
  mkdirSync(join(cacheRoot, ".nalanda-revisions"), { recursive: true, mode: 0o700 });
  for (const model of paddle.models) {
    const modelRoot = join(cacheRoot, "official_models", model.name); mkdirSync(modelRoot, { recursive: true, mode: 0o700 });
    for (const [filename, expected] of Object.entries(model.runtime_files)) {
      const target = join(modelRoot, filename);
      if (safeFile(target, expected, `${model.name}:${filename}`)) continue;
      const url = `https://huggingface.co/PaddlePaddle/${encodeURIComponent(model.name)}/resolve/${model.revision}/${encodeURIComponent(filename)}?download=true`;
      await download(url, target, expected, `${model.name}:${filename}`);
    }
    const receipt = join(cacheRoot, ".nalanda-revisions", model.name);
    if (existsSync(receipt) && readFileSync(receipt, "utf8").trim() !== model.revision) throw new Error(`OCR_MODEL_REVISION_RECEIPT_MISMATCH:${model.name}`);
    if (!existsSync(receipt)) writeFileSync(receipt, `${model.revision}\n`, { flag: "wx", mode: 0o600 });
  }
  return verify();
}

// Avoid accepting any credential/token input. Public immutable snapshots need none.
const action = process.argv[2] || "verify";
const receipt = action === "provision" ? await provision() : action === "verify" ? verify() : (() => { throw new Error("OCR_MODEL_COMMAND_INVALID"); })();
console.log(JSON.stringify(receipt, null, 2));
