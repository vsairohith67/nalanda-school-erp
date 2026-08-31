import { createHash, randomBytes } from "node:crypto";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { signOcrWorkerRequest } from "../../lib/ocr-scanning/worker-auth";

type ClaimedJob = {
  jobKey: string; documentKey: string; leaseToken: string; sourceSha256: string; sourceMediaType: string;
  sourceExtension: string; pageCount: number; languageProfile: string; handwritingDeclared: boolean; timeoutAt: string;
};
type WorkerResult = { pages: Array<{ pageNumber: number; width: number; height: number; sourceRotation: number; sourceDigest: string; rasterSha256: string; processingDurationMs: number; retryPreprocessing: boolean }>; [key: string]: unknown };

const base = workerBaseUrl(process.env.OCR_WORKER_BASE_URL);
const workerId = validWorkerId(process.env.OCR_WORKER_ID || "nalanda-ocr-worker-1b");
const concurrency = integer(process.env.OCR_WORKER_CONCURRENCY || "1", 1, 4, "OCR_WORKER_CONCURRENCY_INVALID");
const image = safeImage(process.env.OCR_WORKER_IMAGE || "nalanda-ocr-worker:1b");
const modelRoot = resolve(process.env.NALANDA_OCR_MODEL_ROOT || join(process.env.LOCALAPPDATA || "", "Nalanda", "ocr-models", "1b", "paddleocr"));
if (!process.env.LOCALAPPDATA || !modelRoot) throw new Error("OCR_MODEL_ROOT_REQUIRED");
const imageId = inspectImage(image);
let stopping = false;
const active = new Set<Promise<void>>();
const containers = new Map<string, ChildProcess>();
const safeFailureCodes = new Set(["OCR_MODEL_MISSING", "OCR_MODEL_HASH_MISMATCH", "OCR_CUDA_UNSUPPORTED", "OCR_GPU_OOM", "OCR_WORKER_CRASH", "OCR_MODEL_CACHE_CORRUPT", "OCR_NETWORK_DISABLED", "OCR_LANGUAGE_UNAVAILABLE", "OCR_PROCESS_TIMEOUT", "OCR_PROCESS_CANCELLED", "OCR_OUTPUT_INVALID", "OCR_RASTERIZATION_FAILED"]);
const nonRetryableFailures = new Set(["OCR_MODEL_MISSING", "OCR_MODEL_HASH_MISMATCH", "OCR_CUDA_UNSUPPORTED", "OCR_GPU_OOM", "OCR_MODEL_CACHE_CORRUPT", "OCR_LANGUAGE_UNAVAILABLE", "OCR_PROCESS_CANCELLED", "OCR_OUTPUT_INVALID"]);

for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => { stopping = true; for (const name of containers.keys()) terminateContainer(name); });

console.log(JSON.stringify({ event: "OCR_WORKER_STARTED", workerId, concurrency, engine: "paddleocr-3.7.0", runtime: "paddlepaddle-gpu-3.3.1", networkDuringInference: "none" }));
while (!stopping) {
  while (!stopping && active.size < concurrency) {
    const response = await signedJson("/api/internal/ocr/worker/claim", "POST", {});
    if (!response.ok) throw new Error(`OCR_WORKER_CLAIM_FAILED:${response.status}`);
    const body = await response.json() as { job: ClaimedJob | null };
    if (!body.job) break;
    const task = processJob(body.job).finally(() => active.delete(task));
    active.add(task);
  }
  if (!active.size) await delay(1_000);
  else await Promise.race([Promise.race(active), delay(1_000)]);
}
await Promise.allSettled(active);
console.log(JSON.stringify({ event: "OCR_WORKER_STOPPED", workerId }));

async function processJob(job: ClaimedJob) {
  const root = await mkdtemp(join(tmpdir(), "nalanda-ocr-1b-"));
  const output = join(root, "output");
  const source = join(root, `source${sourceExtension(job.sourceExtension)}`);
  const containerName = `nalanda-ocr-${job.jobKey.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 32)}`;
  let failureCode = "OCR_WORKER_CRASH";
  try {
    await mkdir(output, { recursive: true });
    const sourceResponse = await signedJson(`/api/internal/ocr/worker/jobs/${job.jobKey}/source`, "POST", { leaseToken: job.leaseToken });
    if (!sourceResponse.ok) throw new Error(`OCR_SOURCE_READ_FAILED:${sourceResponse.status}`);
    const sourceBytes = Buffer.from(await sourceResponse.arrayBuffer());
    if (sha256(sourceBytes) !== job.sourceSha256 || sourceResponse.headers.get("x-nalanda-ocr-source-sha256") !== job.sourceSha256) throw new Error("OCR_SOURCE_CHECKSUM_MISMATCH");
    await writeFile(source, sourceBytes, { flag: "wx", mode: 0o600 });
    const modelMounts = ["PP-OCRv5_mobile_det", "en_PP-OCRv5_mobile_rec", "devanagari_PP-OCRv5_mobile_rec", "te_PP-OCRv5_mobile_rec"].flatMap((name) => ["--mount", `type=bind,src=${join(modelRoot, "official_models", name)},dst=/paddle-cache/official_models/${name},readonly`]);
    const args = ["run", "--rm", "--name", containerName, "--gpus", "all", "--network", "none", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--pids-limit", "512", "--memory", "24g", "--ulimit", "nofile=256:256", "--shm-size", "2g", "--tmpfs", "/tmp:rw,noexec,nosuid,nodev,size=512m", "--tmpfs", "/paddle-cache:rw,nosuid,nodev,size=64m", "--mount", `type=bind,src=${source},dst=/work/input/source${sourceExtension(job.sourceExtension)},readonly`, "--mount", `type=bind,src=${output},dst=/work/output`, ...modelMounts, "--env", "OCR_PADDLE_DEVICE=gpu:0", "--env", "OCR_TRUSTED_LAUNCHER=paddle-docker-network-none-v1", "--env", `OCR_PADDLE_IMAGE_ID=${imageId}`, "--env", "PADDLE_PDX_CACHE_HOME=/paddle-cache", "--env", "PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True", "--env", "HF_HUB_OFFLINE=1", "--env", "TRANSFORMERS_OFFLINE=1", imageId, "--source", `/work/input/source${sourceExtension(job.sourceExtension)}`, "--output", "/work/output", "--language", job.languageProfile];
    const child = spawn("docker", args, { stdio: "ignore", windowsHide: true, shell: false });
    containers.set(containerName, child);
    const deadlineMs = Math.max(1_000, Math.min(50 * 60_000, new Date(job.timeoutAt).getTime() - Date.now()));
    const timeout = setTimeout(() => { failureCode = "OCR_PROCESS_TIMEOUT"; terminateContainer(containerName); }, deadlineMs);
    const heartbeat = setInterval(async () => {
      try {
        const response = await signedJson(`/api/internal/ocr/worker/jobs/${job.jobKey}/heartbeat`, "POST", { leaseToken: job.leaseToken });
        const body = await response.json() as { cancellationRequested?: boolean };
        if (!response.ok || body.cancellationRequested) { failureCode = body.cancellationRequested ? "OCR_PROCESS_CANCELLED" : "OCR_WORKER_CRASH"; terminateContainer(containerName); }
      } catch { failureCode = "OCR_WORKER_CRASH"; terminateContainer(containerName); }
    }, 30_000);
    const exitCode = await new Promise<number>((accept, reject) => { child.once("error", reject); child.once("exit", (code) => accept(code ?? 1)); });
    clearTimeout(timeout); clearInterval(heartbeat); containers.delete(containerName);
    if (exitCode !== 0) {
      try {
        const receipt = JSON.parse(await readFile(join(output, "failure.json"), "utf8")) as { contractVersion?: unknown; failureCode?: unknown };
        if (receipt.contractVersion === "nalanda-ocr-worker-failure-1" && safeFailureCodes.has(String(receipt.failureCode))) failureCode = String(receipt.failureCode);
      } catch { /* a killed or crashed container may not emit a receipt */ }
      throw new Error(failureCode);
    }
    const resultBytes = await readFile(join(output, "result.json"));
    if (resultBytes.length > 50 * 1024 * 1024) throw new Error("OCR_OUTPUT_INVALID");
    const result = JSON.parse(resultBytes.toString("utf8")) as WorkerResult;
    if (!Array.isArray(result.pages) || result.pages.length !== job.pageCount) throw new Error("OCR_OUTPUT_INVALID");
    for (const page of result.pages) {
      const raster = await readFile(join(output, "rasters", `page-${String(page.pageNumber).padStart(3, "0")}.png`));
      const response = await signedBytes(`/api/internal/ocr/worker/jobs/${job.jobKey}/rasters/${page.pageNumber}`, "PUT", raster, {
        "Content-Type": "image/png", "X-Nalanda-OCR-Lease-Token": job.leaseToken,
        "X-Nalanda-OCR-Width": String(page.width), "X-Nalanda-OCR-Height": String(page.height),
        "X-Nalanda-OCR-Source-Rotation": String(page.sourceRotation), "X-Nalanda-OCR-Source-Digest": page.sourceDigest,
        "X-Nalanda-OCR-Duration-Ms": String(page.processingDurationMs), "X-Nalanda-OCR-Retry-Preprocessing": String(page.retryPreprocessing),
        "X-Nalanda-OCR-Raster-SHA256": page.rasterSha256
      });
      if (!response.ok) throw new Error(`OCR_RASTER_UPLOAD_FAILED:${response.status}`);
    }
    const complete = await signedJson(`/api/internal/ocr/worker/jobs/${job.jobKey}/result`, "POST", { leaseToken: job.leaseToken, result });
    if (!complete.ok) throw new Error(`OCR_RESULT_COMMIT_FAILED:${complete.status}`);
    console.log(JSON.stringify({ event: "OCR_JOB_COMPLETED", workerId, jobKey: job.jobKey, pageCount: job.pageCount, sourceDigestPrefix: job.sourceSha256.slice(0, 12) }));
  } catch (error) {
    terminateContainer(containerName);
    const observed = error instanceof Error ? error.message.split(":", 1)[0] : "OCR_WORKER_CRASH";
    if (["OCR_PROCESS_TIMEOUT", "OCR_PROCESS_CANCELLED", "OCR_OUTPUT_INVALID", "OCR_SOURCE_CHECKSUM_MISMATCH"].includes(observed)) failureCode = observed === "OCR_SOURCE_CHECKSUM_MISMATCH" ? "OCR_OUTPUT_INVALID" : observed;
    await signedJson(`/api/internal/ocr/worker/jobs/${job.jobKey}/failure`, "POST", { leaseToken: job.leaseToken, failureCode, retryable: !nonRetryableFailures.has(failureCode) }).catch(() => undefined);
    console.error(JSON.stringify({ event: "OCR_JOB_FAILED", workerId, jobKey: job.jobKey, failureCode }));
  } finally {
    await removeOwnedTemporary(root);
  }
}

async function signedJson(pathname: string, method: string, value: unknown) { const body = Buffer.from(JSON.stringify(value), "utf8"); return signedBytes(pathname, method, body, { "Content-Type": "application/json" }); }
async function signedBytes(pathname: string, method: string, body: Buffer, headers: Record<string, string>) {
  const url = new URL(pathname, base);
  const signed = signOcrWorkerRequest({ method, pathname: url.pathname, workerId, timestamp: Date.now(), nonce: randomBytes(48).toString("base64url"), body });
  return fetch(url, { method, headers: { ...headers, ...signed }, body: new Uint8Array(body) });
}
function workerBaseUrl(value: string | undefined) { const url = new URL(value || ""); if (url.username || url.password || url.pathname !== "/" || !["localhost", "127.0.0.1", "[::1]", "::1"].includes(url.hostname)) throw new Error("OCR_WORKER_BASE_URL_MUST_BE_LOOPBACK"); if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("OCR_WORKER_BASE_URL_INVALID"); return url; }
function validWorkerId(value: string) { if (!/^[a-z][a-z0-9.-]{2,63}$/.test(value)) throw new Error("OCR_WORKER_ID_INVALID"); return value; }
function safeImage(value: string) { if (!/^[a-z0-9][a-z0-9./:@_-]{2,200}$/i.test(value)) throw new Error("OCR_WORKER_IMAGE_INVALID"); return value; }
function sourceExtension(value: string) { if (![".png", ".jpg", ".pdf"].includes(value)) throw new Error("OCR_SOURCE_EXTENSION_INVALID"); return value; }
function integer(value: string, minimum: number, maximum: number, code: string) { const number = Number(value); if (!Number.isInteger(number) || number < minimum || number > maximum) throw new Error(code); return number; }
function inspectImage(value: string) { const result = execFileSync("docker", ["image", "inspect", value, "--format", "{{.Id}}"], { encoding: "utf8", windowsHide: true }).trim(); if (!result.startsWith("sha256:")) throw new Error("OCR_WORKER_IMAGE_ID_INVALID"); return result; }
function terminateContainer(name: string) { try { execFileSync("docker", ["kill", name], { stdio: "ignore", windowsHide: true }); } catch { /* already stopped */ } const child = containers.get(name); if (process.platform === "win32" && child?.pid) { try { execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true }); } catch { /* already stopped */ } } }
async function removeOwnedTemporary(path: string) { const baseTemp = resolve(tmpdir()); const resolved = resolve(path); const result = relative(baseTemp, resolved); if (!result || result.startsWith("..") || !result.startsWith("nalanda-ocr-1b-")) throw new Error("OCR_TEMP_PATH_UNSAFE"); await rm(resolved, { recursive: true, force: true, maxRetries: 2 }); }
function sha256(value: Uint8Array) { return createHash("sha256").update(value).digest("hex"); }
function delay(milliseconds: number) { return new Promise((accept) => setTimeout(accept, milliseconds)); }
