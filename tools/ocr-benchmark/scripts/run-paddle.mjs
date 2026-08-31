import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { containerBuildInputDigest, verifyPaddleModels } from "./integrity.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const benchmarkDirectory = resolve(scriptDirectory, "..");
const repositoryRoot = resolve(benchmarkDirectory, "..", "..");
const artifactRoot = resolve(
  process.env.OCR_BENCHMARK_ARTIFACT_ROOT ||
    join(repositoryRoot, ".codex", "artifacts", "OCR-BENCHMARK-1A"),
);
const cacheRoot = join(artifactRoot, "models", "paddleocr");
const corpusRoot = join(artifactRoot, "corpus-v1");
const resultsRoot = join(artifactRoot, "results");
mkdirSync(resultsRoot, { recursive: true });
verifyPaddleModels(cacheRoot);

const image = "nalanda-ocr-paddle:1a";
const expectedBuildInput = containerBuildInputDigest("paddle");
const inspection = spawnSync(
  "docker",
  [
    "image",
    "inspect",
    image,
    "--format",
    '{{.Id}} {{index .Config.Labels "nalanda.ocr.build-input-sha256"}}',
  ],
  { encoding: "utf8" },
);
const [imageId, buildInput] = inspection.stdout.trim().split(/\s+/);
if (
  inspection.status !== 0 ||
  !imageId?.startsWith("sha256:") ||
  buildInput !== expectedBuildInput
) {
  throw new Error("PADDLE_PREPARED_CONTAINER_INTEGRITY_MISMATCH:run pnpm.cmd ocr:containers:prepare");
}
const result = spawnSync(
  "docker",
  [
    "run",
    "--rm",
    "--gpus",
    "all",
    "--network",
    "none",
    "--read-only",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--pids-limit",
    "512",
    "--memory",
    "24g",
    "--ulimit",
    "nofile=256:256",
    "--shm-size",
    "2g",
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,nodev,size=2g",
    "--mount",
    `type=bind,src=${corpusRoot},dst=/artifacts/corpus-v1,readonly`,
    "--mount",
    `type=bind,src=${cacheRoot},dst=/artifacts/models/paddleocr,readonly`,
    "--mount",
    `type=bind,src=${resultsRoot},dst=/artifacts/results`,
    "--env",
    "OCR_BENCHMARK_ARTIFACT_ROOT=/artifacts",
    "--env",
    "OCR_PADDLE_DEVICE=gpu:0",
    "--env",
    "OCR_TRUSTED_LAUNCHER=paddle-docker-network-none-v1",
    "--env",
    `OCR_PADDLE_IMAGE_ID=${imageId}`,
    "--env",
    "PADDLE_PDX_CACHE_HOME=/artifacts/models/paddleocr",
    "--env",
    "PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True",
    "--env",
    "HF_HUB_OFFLINE=1",
    "--env",
    "TRANSFORMERS_OFFLINE=1",
    imageId,
    "benchmark",
    "--candidate",
    "paddleocr",
  ],
  {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: "inherit",
  },
);
if (result.error) {
  throw result.error;
}
process.exit(result.status ?? 1);
