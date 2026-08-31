import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const inputs = [
  "tools/ocr-worker/Dockerfile", "tools/ocr-worker/Dockerfile.source", "tools/ocr-worker/runtime/main.py",
  "tools/ocr-benchmark/pyproject.toml", "tools/ocr-benchmark/uv.lock",
  "tools/ocr-benchmark/candidates/candidate-lock.json",
  "tools/ocr-benchmark/candidates/paddle/pyproject.toml", "tools/ocr-benchmark/candidates/paddle/uv.lock",
  ...walk(join(root, "tools", "ocr-benchmark", "src")).map((path) => relative(root, path).replaceAll("\\", "/"))
].sort();
const digest = createHash("sha256").update(inputs.map((name) => { const path = join(root, name); return `${name}\0${statSync(path).size}\0${createHash("sha256").update(readFileSync(path)).digest("hex")}\n`; }).join("")).digest("hex");
const image = "nalanda-ocr-worker:1b";
const clearedBase = spawnSync("docker", ["image", "inspect", "nalanda-ocr-paddle:1a", "--format", '{{.Id}} {{index .Config.Labels "nalanda.ocr.build-input-sha256"}}'], { cwd: root, encoding: "utf8" });
const [baseImageId, baseBuildInput] = clearedBase.stdout.trim().split(/\s+/);
if (clearedBase.status !== 0 || !baseImageId?.startsWith("sha256:") || baseBuildInput !== "e6135c88183eaf75dbfb55502a85d4494dd5635e7c26f760a5229c51e5a2e167") throw new Error("OCR_BENCHMARK_CLEARED_BASE_REQUIRED");
const build = spawnSync("docker", ["build", "--label", `nalanda.ocr.build-input-sha256=${digest}`, "--label", `nalanda.ocr.base-image-id=${baseImageId}`, "--tag", image, "--file", "tools/ocr-worker/Dockerfile", "."], { cwd: root, stdio: "inherit", encoding: "utf8" });
if (build.error) throw build.error;
if (build.status !== 0) throw new Error("OCR_WORKER_IMAGE_BUILD_FAILED");
const inspect = spawnSync("docker", ["image", "inspect", image, "--format", '{{.Id}} {{index .Config.Labels "nalanda.ocr.build-input-sha256"}}'], { cwd: root, encoding: "utf8" });
const [imageId, observedDigest] = inspect.stdout.trim().split(/\s+/);
if (inspect.status !== 0 || !imageId?.startsWith("sha256:") || observedDigest !== digest) throw new Error("OCR_WORKER_IMAGE_INTEGRITY_FAILED");
console.log(JSON.stringify({ image, imageId, buildInputSha256: digest, baseImageId, baseBuildInputSha256: baseBuildInput, publicArtifactPublished: false }, null, 2));
function walk(directory) { return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.name === "__pycache__" ? [] : entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)]); }
