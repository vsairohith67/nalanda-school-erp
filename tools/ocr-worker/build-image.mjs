import { createHash } from "node:crypto";
import { createReadStream, readdirSync, readFileSync, statSync } from "node:fs";
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
const wheel = resolve(process.env.NALANDA_OCR_PADDLE_WHEEL || "");
const wheelRelative = relative(root, wheel);
if (!process.env.NALANDA_OCR_PADDLE_WHEEL || wheelRelative === "" || !wheelRelative.startsWith("..") || statSync(wheel).size !== 2_021_398_367) throw new Error("OCR_EXTERNAL_PINNED_PADDLE_WHEEL_REQUIRED");
const wheelSha256 = await fileSha256(wheel);
if (wheelSha256 !== "b1500120002c2bf4542c841e25296cf10c52e0d395053aa395f79bd9c0303cce") throw new Error("OCR_PINNED_PADDLE_WHEEL_INTEGRITY_FAILED");
const baseImage = "ubuntu:24.04@sha256:33ceb71981b602c1a7443a53469e4dba065f7503eab3078a2d7a57a2ab987517";
const pull = spawnSync("docker", ["pull", baseImage], { cwd: root, stdio: "inherit", encoding: "utf8" });
if (pull.error) throw pull.error;
if (pull.status !== 0) throw new Error("OCR_PINNED_UBUNTU_LTS_BASE_PULL_FAILED");
const base = spawnSync("docker", ["image", "inspect", baseImage, "--format", "{{.Id}}"], { cwd: root, encoding: "utf8" });
const baseImageId = base.stdout.trim();
if (base.status !== 0 || baseImageId !== "sha256:33ceb71981b602c1a7443a53469e4dba065f7503eab3078a2d7a57a2ab987517") throw new Error("OCR_PINNED_UBUNTU_LTS_BASE_REQUIRED");
const build = spawnSync("docker", ["build", "--pull", "--build-context", `paddlewheel=${dirname(wheel)}`, "--label", `nalanda.ocr.build-input-sha256=${digest}`, "--label", `nalanda.ocr.base-image-id=${baseImageId}`, "--label", `nalanda.ocr.base-image-digest=${baseImage.split("@", 2)[1]}`, "--label", `nalanda.ocr.paddle-wheel-sha256=${wheelSha256}`, "--tag", image, "--file", "tools/ocr-worker/Dockerfile", "."], { cwd: root, stdio: "inherit", encoding: "utf8" });
if (build.error) throw build.error;
if (build.status !== 0) throw new Error("OCR_WORKER_IMAGE_BUILD_FAILED");
const inspect = spawnSync("docker", ["image", "inspect", image, "--format", '{{.Id}} {{index .Config.Labels "nalanda.ocr.build-input-sha256"}}'], { cwd: root, encoding: "utf8" });
const [imageId, observedDigest] = inspect.stdout.trim().split(/\s+/);
if (inspect.status !== 0 || !imageId?.startsWith("sha256:") || observedDigest !== digest) throw new Error("OCR_WORKER_IMAGE_INTEGRITY_FAILED");
console.log(JSON.stringify({ image, imageId, buildInputSha256: digest, baseImage, baseImageId, paddleWheelSha256: wheelSha256, publicArtifactPublished: false }, null, 2));
function walk(directory) { return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.name === "__pycache__" ? [] : entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)]); }
function fileSha256(path) { return new Promise((resolveHash, rejectHash) => { const hash = createHash("sha256"); const stream = createReadStream(path); stream.on("data", (chunk) => hash.update(chunk)); stream.on("error", rejectHash); stream.on("end", () => resolveHash(hash.digest("hex"))); }); }
