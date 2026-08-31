import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  boundedDiagnostic,
  containerBuildInputDigest,
  redactDiagnostic,
  verifyUnlimitedSnapshot,
} from "./integrity.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const benchmarkDirectory = resolve(scriptDirectory, "..");
const repositoryRoot = resolve(benchmarkDirectory, "..", "..");
const artifactRoot = resolve(
  process.env.OCR_BENCHMARK_ARTIFACT_ROOT ||
    join(repositoryRoot, ".codex", "artifacts", "OCR-BENCHMARK-1A"),
);
const evidenceRoot = join(artifactRoot, "evidence");
mkdirSync(evidenceRoot, { recursive: true });
const corpusRoot = join(artifactRoot, "corpus-v1");
const resultsRoot = join(artifactRoot, "results");
mkdirSync(resultsRoot, { recursive: true });
const modelRoot = join(artifactRoot, "models", "unlimited-ocr");
const lockedCandidate = verifyUnlimitedSnapshot(modelRoot);
const serverImage =
  "vllm/vllm-openai@sha256:b7a7be708c9a325107cdeddeba095e5637617716b3ab469c19d34759ec1afa39";
const serverImageDigest = "sha256:b7a7be708c9a325107cdeddeba095e5637617716b3ab469c19d34759ec1afa39";
const clientImage = "nalanda-ocr-benchmark-client:1a";
const maxModelLength = "16384";
const gpuMemoryUtilization = "0.85";
const suffix = `${process.pid}-${randomBytes(4).toString("hex")}`;
const network = `nalanda-ocr-unlimited-internal-${suffix}`;
const serverName = `nalanda-ocr-unlimited-server-${suffix}`;
const apiKey = randomBytes(24).toString("hex");
const allowedEnvironment = ["PATH", "SystemRoot", "WINDIR", "TEMP", "TMP", "COMSPEC", "PATHEXT"];
const minimalEnvironment = Object.fromEntries(
  allowedEnvironment.filter((key) => process.env[key]).map((key) => [key, process.env[key]]),
);
minimalEnvironment.OCR_BENCHMARK_ARTIFACT_ROOT = artifactRoot;
minimalEnvironment.OCR_TRUSTED_LAUNCHER = "unlimited-docker-internal-v1";

function runDocker(args, options = {}) {
  return spawnSync("docker", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: minimalEnvironment,
    ...options,
  });
}

function recordFailure(code, detail) {
  writeFileSync(
    join(evidenceRoot, "unlimited-runtime-failure.json"),
    `${JSON.stringify(
      {
        code,
        detail: boundedDiagnostic(redactDiagnostic(detail, [apiKey])),
        model_revision: "07dea832e22aefee32ad281d4b80551282e1c168",
        runtime_image_digest: serverImageDigest,
        max_model_length: Number(maxModelLength),
        gpu_memory_utilization: Number(gpuMemoryUtilization),
        sandbox: "docker internal network; no outbound; model read-only; no repository or database mount",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function unavailableBenchmark() {
  const uv = process.platform === "win32" ? "uv.exe" : "uv";
  return spawnSync(
    uv,
    [
      "run",
      "--offline",
      "--locked",
      "--project",
      benchmarkDirectory,
      "python",
      "-m",
      "nalanda_ocr_benchmark",
      "benchmark",
      "--candidate",
      "unlimited-ocr",
    ],
    { cwd: repositoryRoot, env: minimalEnvironment, stdio: "inherit", encoding: "utf8" },
  ).status ?? 1;
}

let serverCreated = false;
let networkCreated = false;
let finalStatus = 1;
let clientImageId = "";
try {
  for (const image of [serverImage, clientImage]) {
    const inspection = runDocker(["image", "inspect", image]);
    if (inspection.status !== 0) {
      recordFailure("UNLIMITED_PINNED_CONTAINER_IMAGE_MISSING", image);
      finalStatus = unavailableBenchmark();
      process.exit(finalStatus);
    }
  }
  const expectedClientBuildInput = containerBuildInputDigest("client");
  const clientInspection = runDocker([
    "image",
    "inspect",
    clientImage,
    "--format",
    '{{.Id}} {{index .Config.Labels "nalanda.ocr.build-input-sha256"}}',
  ]);
  const [inspectedClientImageId, clientBuildInput] = clientInspection.stdout.trim().split(/\s+/);
  clientImageId = inspectedClientImageId || "";
  if (
    clientInspection.status !== 0 ||
    !clientImageId.startsWith("sha256:") ||
    clientBuildInput !== expectedClientBuildInput
  ) {
    throw new Error(
      "UNLIMITED_PREPARED_CLIENT_INTEGRITY_MISMATCH:run pnpm.cmd ocr:containers:prepare",
    );
  }
  const networkResult = runDocker([
    "network",
    "create",
    "--internal",
    "--label",
    "nalanda.scope=OCR-BENCHMARK-1A",
    network,
  ]);
  if (networkResult.status !== 0) throw new Error(`NETWORK_CREATE_FAILED:${networkResult.stderr}`);
  networkCreated = true;

  const started = performance.now();
  const serverResult = runDocker([
    "run",
    "--detach",
    "--name",
    serverName,
    "--gpus",
    "all",
    "--network",
    network,
    "--read-only",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--pids-limit",
    "1024",
    "--ulimit",
    "nofile=256:256",
    "--memory",
    "24g",
    "--shm-size",
    "4g",
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,nodev,size=4g",
    "--tmpfs",
    "/root/.cache:rw,noexec,nosuid,nodev,size=2g",
    "--tmpfs",
    "/root/.config:rw,noexec,nosuid,nodev,size=64m",
    "--tmpfs",
    "/root/.triton:rw,exec,nosuid,nodev,size=2g",
    "--mount",
    `type=bind,src=${modelRoot},dst=/model,readonly`,
    "--env",
    "HF_HUB_OFFLINE=1",
    "--env",
    "TRANSFORMERS_OFFLINE=1",
    "--env",
    "TRITON_CACHE_DIR=/root/.triton/cache",
    "--env",
    "TORCHINDUCTOR_CACHE_DIR=/root/.triton/torchinductor",
    serverImage,
    "/model",
    "--served-model-name",
    "Unlimited-OCR",
    "--trust-remote-code",
    "--logits_processors",
    "vllm.model_executor.models.unlimited_ocr:NGramPerReqLogitsProcessor",
    "--no-enable-prefix-caching",
    "--mm-processor-cache-gb",
    "0",
    "--max-num-seqs",
    "1",
    "--max-model-len",
    maxModelLength,
    "--gpu-memory-utilization",
    gpuMemoryUtilization,
    "--enforce-eager",
    "--api-key",
    apiKey,
    "--host",
    "0.0.0.0",
    "--port",
    "8000",
  ]);
  if (serverResult.status !== 0) throw new Error(`SERVER_CREATE_FAILED:${serverResult.stderr}`);
  serverCreated = true;

  const deadline = Date.now() + 600_000;
  let ready = false;
  while (Date.now() < deadline) {
    const state = runDocker(["inspect", "--format", "{{.State.Status}} {{.State.ExitCode}}", serverName]);
    if (state.status !== 0 || state.stdout.trim().startsWith("exited")) break;
    const healthCode = [
      "import os,urllib.request;",
      "r=urllib.request.Request('http://" + serverName + ":8000/health',headers={'Authorization':'Bearer '+os.environ['K']});",
      "print(urllib.request.urlopen(r,timeout=3).status)",
    ].join("");
    const health = runDocker([
      "run",
      "--rm",
      "--network",
      network,
      "--entrypoint",
      "python",
      "--env",
      `K=${apiKey}`,
      clientImageId,
      "-c",
      healthCode,
    ]);
    if (health.status === 0 && health.stdout.trim() === "200") {
      ready = true;
      break;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
  }
  if (!ready) {
    const logs = runDocker(["logs", serverName]);
    throw new Error(`SERVER_STARTUP_FAILED:${logs.stdout}\n${logs.stderr}`);
  }
  const coldStartMs = performance.now() - started;
  writeFileSync(
    join(evidenceRoot, "unlimited-sandbox.json"),
    `${JSON.stringify(
      {
        model_revision: "07dea832e22aefee32ad281d4b80551282e1c168",
        runtime_image_digest: serverImageDigest,
        client_image_id: clientImageId,
        model_snapshot_revision: lockedCandidate.model_revision,
        network_internal: true,
        external_network_route: false,
        model_mount: "read-only",
        compiler_caches: "Triton and TorchInductor on an ephemeral container-only executable tmpfs",
        artifacts_mount_to_server: false,
        repository_mount: false,
        operational_database_mount: false,
        inherited_host_secrets: false,
        max_model_length: Number(maxModelLength),
        gpu_memory_utilization: Number(gpuMemoryUtilization),
        cold_start_ms: coldStartMs,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const benchmark = runDocker(
    [
      "run",
      "--rm",
      "--network",
      network,
      "--read-only",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges",
      "--pids-limit",
      "512",
      "--memory",
      "8g",
      "--ulimit",
      "nofile=256:256",
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,nodev,size=2g",
      "--mount",
      `type=bind,src=${corpusRoot},dst=/artifacts/corpus-v1,readonly`,
      "--mount",
      `type=bind,src=${resultsRoot},dst=/artifacts/results`,
      "--env",
      "OCR_BENCHMARK_ARTIFACT_ROOT=/artifacts",
      "--env",
      `OCR_UNLIMITED_URL=http://${serverName}:8000`,
      "--env",
      `OCR_UNLIMITED_API_KEY=${apiKey}`,
      "--env",
      `OCR_UNLIMITED_COLD_START_MS=${coldStartMs}`,
      "--env",
      "OCR_UNLIMITED_REVISION=07dea832e22aefee32ad281d4b80551282e1c168",
      "--env",
      `OCR_UNLIMITED_IMAGE_DIGEST=${serverImageDigest}`,
      "--env",
      "OCR_TRUSTED_LAUNCHER=unlimited-docker-internal-v1",
      "--env",
      `OCR_UNLIMITED_CLIENT_IMAGE_ID=${clientImageId}`,
      clientImageId,
      "benchmark",
      "--candidate",
      "unlimited-ocr",
    ],
    { stdio: "inherit" },
  );
  finalStatus = benchmark.status ?? 1;
} catch (error) {
  recordFailure("UNLIMITED_RUNTIME_BLOCKED", error instanceof Error ? error.message : error);
  finalStatus = unavailableBenchmark();
} finally {
  if (serverCreated) runDocker(["rm", "--force", serverName]);
  if (networkCreated) runDocker(["network", "rm", network]);
}
process.exit(finalStatus);
