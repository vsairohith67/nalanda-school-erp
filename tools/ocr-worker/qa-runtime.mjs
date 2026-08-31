#!/usr/bin/env node

import { createHash } from "node:crypto";
import { appendFile, cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const workspace = path.resolve(".");
const corpusRoot = path.resolve(workspace, ".codex", "artifacts", "OCR-BENCHMARK-1A", "corpus-v1");
const modelRoot = path.resolve(process.env.NALANDA_OCR_MODEL_ROOT || "");
if (!modelRoot || !inside(path.resolve(os.homedir()), modelRoot)) throw new Error("OCR_QA_MODEL_ROOT_REQUIRED_OUTSIDE_REPOSITORY");
if (inside(workspace, modelRoot)) throw new Error("OCR_QA_MODEL_ROOT_MUST_BE_EXTERNAL");
const imageTag = process.env.OCR_WORKER_IMAGE || "nalanda-ocr-worker:1b";
const imageId = command("docker", ["image", "inspect", imageTag, "--format", "{{.Id}}"]).trim();
if (!imageId.startsWith("sha256:")) throw new Error("OCR_QA_IMAGE_ID_INVALID");

const artifactRoot = await mkdtemp(path.join(path.resolve(workspace, ".codex", "artifacts"), "OCR-SCANNING-1B-runtime-"));
const cases = [
  { id: "english", relative: "images/base/admission-english.png", language: "ENGLISH", device: "gpu:0", gpu: true },
  { id: "hindi", relative: "images/base/guardian-hindi.png", language: "HINDI", device: "gpu:0", gpu: true },
  { id: "telugu", relative: "images/base/student-telugu.png", language: "TELUGU", device: "gpu:0", gpu: true },
  { id: "mixed", relative: "images/base/transfer-all-languages.png", language: "ENGLISH_HINDI_TELUGU", device: "gpu:0", gpu: true },
  { id: "cpu", relative: "images/base/admission-english.png", language: "ENGLISH", device: "cpu", gpu: false, optional: true }
];
const success = [];
for (const test of cases) success.push(await runtimeCase(test));
const missingModel = await failureCase("missing-model", "images/base/admission-english.png", "ENGLISH", ["PP-OCRv5_mobile_det"]);
const badLanguage = await failureCase("bad-language", "images/base/admission-english.png", "UNSUPPORTED", modelNames());
const corruptCache = await corruptModelVerification();
const report = {
  result: "OCR_SCANNING_FOUNDATION_1B_LOCAL_RUNTIME_QA_PASSED",
  imageId,
  networkDuringInference: "none",
  modelRoot: "external-checksum-verified-cache",
  successes: success,
  failures: [missingModel, badLanguage, corruptCache],
  artifactRoot
};
await writeFile(path.join(artifactRoot, "runtime-report.json"), `${JSON.stringify(report, null, 2)}\n`, { flag: "wx", mode: 0o600 });
console.log(JSON.stringify(report, null, 2));

async function runtimeCase(test) {
  const output = path.join(artifactRoot, test.id);
  await mkdir(output, { recursive: true });
  const input = path.join(corpusRoot, test.relative);
  const name = `nalanda-ocr-qa-${process.pid}-${test.id}`;
  const args = dockerArgs({ name, input, output, language: test.language, device: test.device, gpu: test.gpu, models: modelNames() });
  const started = Date.now();
  const executed = await monitoredDocker(name, args);
  if (executed.code !== 0) {
    if (!test.optional) throw new Error(`OCR_QA_RUNTIME_FAILED:${test.id}:${executed.code}`);
    const receipt = JSON.parse(await readFile(path.join(output, "failure.json"), "utf8"));
    return { id: test.id, device: test.device, available: false, failureCode: receipt.failureCode, suitabilityClaim: false };
  }
  const result = JSON.parse(await readFile(path.join(output, "result.json"), "utf8"));
  if (result.contractVersion !== "nalanda-ocr-worker-result-1" || result.engineRevision !== "3.7.0" || result.runtimeRevision !== "paddlepaddle-gpu-3.3.1") throw new Error(`OCR_QA_RUNTIME_RECEIPT_INVALID:${test.id}`);
  const blockCount = result.pages.reduce((sum, page) => sum + page.blocks.length, 0);
  return {
    id: test.id,
    device: test.device,
    available: true,
    sourceSha256: sha256(await readFile(input)),
    pages: result.pages.length,
    blocks: blockCount,
    scripts: [...new Set(result.pages.flatMap((page) => page.blocks.map((block) => block.scriptHint)))].sort(),
    engineDurationMs: result.totalDurationMs,
    wallDurationMs: Date.now() - started,
    peakContainerMemoryBytes: executed.peakMemoryBytes,
    pagesPerMinute: Number((result.pages.length * 60_000 / Math.max(1, result.totalDurationMs)).toFixed(2))
  };
}

async function failureCase(id, relative, language, models) {
  const output = path.join(artifactRoot, id);
  await mkdir(output, { recursive: true });
  const input = path.join(corpusRoot, relative);
  const name = `nalanda-ocr-qa-${process.pid}-${id}`;
  const executed = await monitoredDocker(name, dockerArgs({ name, input, output, language, device: "gpu:0", gpu: true, models }));
  if (executed.code === 0) throw new Error(`OCR_QA_FAILURE_CASE_SUCCEEDED:${id}`);
  const receipt = JSON.parse(await readFile(path.join(output, "failure.json"), "utf8"));
  if (receipt.contractVersion !== "nalanda-ocr-worker-failure-1") throw new Error(`OCR_QA_FAILURE_RECEIPT_INVALID:${id}`);
  return { id, failureCode: receipt.failureCode, safeReceipt: true };
}

async function corruptModelVerification() {
  const corruptRoot = await mkdtemp(path.join(os.tmpdir(), "nalanda-ocr-corrupt-model-cache-"));
  await cp(modelRoot, corruptRoot, { recursive: true, errorOnExist: true });
  await appendFile(path.join(corruptRoot, "official_models", "PP-OCRv5_mobile_det", "inference.yml"), "\n");
  const result = spawnSync(process.execPath, [path.join(workspace, "tools", "ocr-worker", "models.mjs"), "verify"], {
    cwd: workspace, encoding: "utf8", windowsHide: true, env: { ...process.env, NALANDA_OCR_MODEL_ROOT: corruptRoot }
  });
  if (result.status === 0 || !String(result.stderr).includes("OCR_MODEL_CONTENT_MISMATCH")) throw new Error("OCR_QA_CORRUPT_MODEL_CACHE_NOT_REJECTED");
  return { id: "wrong-hash-corrupt-cache", failureCode: "OCR_MODEL_CONTENT_MISMATCH", safeReceipt: true, residueRoot: corruptRoot };
}

function dockerArgs(input) {
  const extension = path.extname(input.input).toLowerCase();
  const args = ["run", "--rm", "--name", input.name];
  if (input.gpu) args.push("--gpus", "all");
  args.push(
    "--network", "none", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
    "--pids-limit", "512", "--memory", "24g", "--ulimit", "nofile=256:256", "--shm-size", "2g",
    "--tmpfs", "/tmp:rw,noexec,nosuid,nodev,size=512m", "--tmpfs", "/paddle-cache:rw,nosuid,nodev,size=64m",
    "--mount", `type=bind,src=${input.input},dst=/work/input/source${extension},readonly`,
    "--mount", `type=bind,src=${input.output},dst=/work/output`
  );
  for (const model of input.models) args.push("--mount", `type=bind,src=${path.join(modelRoot, "official_models", model)},dst=/paddle-cache/official_models/${model},readonly`);
  args.push(
    "--env", `OCR_PADDLE_DEVICE=${input.device}`, "--env", "OCR_TRUSTED_LAUNCHER=paddle-docker-network-none-v1",
    "--env", `OCR_PADDLE_IMAGE_ID=${imageId}`, "--env", "PADDLE_PDX_CACHE_HOME=/paddle-cache",
    "--env", "PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True", "--env", "HF_HUB_OFFLINE=1", "--env", "TRANSFORMERS_OFFLINE=1",
    imageId, "--source", `/work/input/source${extension}`, "--output", "/work/output", "--language", input.language
  );
  return args;
}

async function monitoredDocker(name, args) {
  let peakMemoryBytes = 0;
  const child = spawn("docker", args, { stdio: "ignore", windowsHide: true, shell: false });
  const monitor = setInterval(() => {
    const result = spawnSync("docker", ["stats", name, "--no-stream", "--format", "{{.MemUsage}}"], { encoding: "utf8", windowsHide: true, timeout: 3_000 });
    if (result.status === 0) peakMemoryBytes = Math.max(peakMemoryBytes, memoryBytes(result.stdout.split("/", 1)[0].trim()));
  }, 250);
  const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", (value) => resolve(value ?? 1)); });
  clearInterval(monitor);
  return { code, peakMemoryBytes };
}

function memoryBytes(value) {
  const match = value.match(/^([0-9.]+)\s*([KMGT]i?B)$/i);
  if (!match) return 0;
  const scale = { KIB: 1024, MIB: 1024 ** 2, GIB: 1024 ** 3, TIB: 1024 ** 4, KB: 1000, MB: 1000 ** 2, GB: 1000 ** 3, TB: 1000 ** 4 }[match[2].toUpperCase()] ?? 1;
  return Math.round(Number(match[1]) * scale);
}
function modelNames() { return ["PP-OCRv5_mobile_det", "en_PP-OCRv5_mobile_rec", "devanagari_PP-OCRv5_mobile_rec", "te_PP-OCRv5_mobile_rec"]; }
function command(program, args) { const result = spawnSync(program, args, { encoding: "utf8", windowsHide: true }); if (result.status !== 0) throw new Error(result.stderr.trim() || `${program} failed`); return result.stdout; }
function inside(root, candidate) { const relative = path.relative(root, candidate); return relative === "" || relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative); }
function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
