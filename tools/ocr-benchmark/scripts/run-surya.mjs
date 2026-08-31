import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifySuryaRuntime } from "./integrity.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const benchmarkDirectory = resolve(scriptDirectory, "..");
const repositoryRoot = resolve(benchmarkDirectory, "..", "..");
const artifactRoot = resolve(
  process.env.OCR_BENCHMARK_ARTIFACT_ROOT ||
    join(repositoryRoot, ".codex", "artifacts", "OCR-BENCHMARK-1A"),
);
const modelRoot = join(artifactRoot, "models", "surya-ocr-2-gguf");
const model = join(modelRoot, "surya-2.gguf");
const projector = join(modelRoot, "surya-2-mmproj.gguf");
const chatTemplate = join(modelRoot, "chat_template.jinja");
for (const path of [model, projector, chatTemplate]) {
  if (!existsSync(path)) {
    throw new Error(`SURYA_OFFLINE_MODEL_MISSING:${path}`);
  }
}

const runtimeName = process.platform === "win32" ? "llama-server.exe" : "llama-server";
const locator = spawnSync(
  process.platform === "win32" ? "where.exe" : "which",
  [runtimeName],
  { encoding: "utf8" },
);
if (locator.status !== 0 || !locator.stdout.trim()) {
  throw new Error("SURYA_LLAMA_SERVER_NOT_AVAILABLE");
}
const runtime = locator.stdout.trim().split(/\r?\n/)[0];
const lockedCandidate = verifySuryaRuntime(modelRoot, runtime);
const versionProbe = spawnSync(runtime, ["--version"], { encoding: "utf8" });
if (versionProbe.status !== 0) {
  throw new Error("SURYA_LLAMA_SERVER_NOT_AVAILABLE");
}
const runtimeVersion = `${versionProbe.stdout || ""}\n${versionProbe.stderr || ""}`.trim().split("\n")[0];
if (!runtimeVersion.includes("build 10679") || !runtimeVersion.includes("commit 50f068fff")) {
  throw new Error("SURYA_LLAMA_SERVER_VERSION_MISMATCH");
}
const port = 32137;
const apiKey = randomBytes(24).toString("hex");
const url = `http://127.0.0.1:${port}`;
const allowedEnvironment = [
  "PATH",
  "SystemRoot",
  "WINDIR",
  "TEMP",
  "TMP",
  "COMSPEC",
  "PATHEXT",
  "NUMBER_OF_PROCESSORS",
  "PROCESSOR_ARCHITECTURE",
  "ProgramFiles",
];
const environment = Object.fromEntries(
  allowedEnvironment.filter((key) => process.env[key]).map((key) => [key, process.env[key]]),
);
Object.assign(environment, {
  NO_PROXY: "127.0.0.1,localhost",
  HTTP_PROXY: "",
  HTTPS_PROXY: "",
  ALL_PROXY: "",
  DO_NOT_TRACK: "1",
  HF_HUB_OFFLINE: "1",
  TRANSFORMERS_OFFLINE: "1",
});

const started = performance.now();
const server = spawn(
  runtime,
  [
    "-m",
    model,
    "-mm",
    projector,
    "--chat-template-file",
    chatTemplate,
    "-a",
    "surya-ocr-2-gguf",
    "-dev",
    "Vulkan1",
    "-mmdev",
    "Vulkan1",
    "-ngl",
    "all",
    "-c",
    "8192",
    "-np",
    "1",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--api-key",
    apiKey,
    "--no-webui",
    "--log-disable",
  ],
  { cwd: repositoryRoot, env: environment, stdio: "inherit", windowsHide: true },
);

async function waitUntilReady() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`SURYA_SERVER_EARLY_EXIT:${server.exitCode}`);
    }
    try {
      const response = await fetch(`${url}/health`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (response.ok) return;
    } catch {
      // The bound loopback endpoint is expected to refuse connections while loading.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error("SURYA_SERVER_STARTUP_TIMEOUT");
}

let status = 1;
try {
  await waitUntilReady();
  const coldStartMs = performance.now() - started;
  const command = process.platform === "win32" ? "uv.exe" : "uv";
  const benchmarkEnvironment = {
    ...environment,
    OCR_BENCHMARK_ARTIFACT_ROOT: artifactRoot,
    OCR_SURYA_URL: url,
    OCR_SURYA_API_KEY: apiKey,
    OCR_SURYA_SERVER_PID: String(server.pid),
    OCR_SURYA_COLD_START_MS: String(coldStartMs),
    OCR_SURYA_REVISION: "6a3a4c30e5e74446d4f8b6afd05b2f2da970f470",
    OCR_SURYA_RUNTIME_VERSION: runtimeVersion,
    OCR_TRUSTED_LAUNCHER: "surya-loopback-v1",
    OCR_SURYA_RUNTIME_BUNDLE_SHA256: lockedCandidate.runtime_bundle_sha256,
  };
  const benchmark = spawnSync(
    command,
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
      "surya",
    ],
    { cwd: repositoryRoot, env: benchmarkEnvironment, stdio: "inherit", encoding: "utf8" },
  );
  if (benchmark.error) throw benchmark.error;
  status = benchmark.status ?? 1;
} finally {
  server.kill("SIGTERM");
}
process.exit(status);
