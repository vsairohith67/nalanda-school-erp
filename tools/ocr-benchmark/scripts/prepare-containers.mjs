import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { containerBuildInputDigest } from "./integrity.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const benchmarkDirectory = resolve(scriptDirectory, "..");
const repositoryRoot = resolve(benchmarkDirectory, "..", "..");
const artifactRoot = resolve(
  process.env.OCR_BENCHMARK_ARTIFACT_ROOT ||
    join(repositoryRoot, ".codex", "artifacts", "OCR-BENCHMARK-1A"),
);

const variants = [
  {
    id: "client",
    tag: "nalanda-ocr-benchmark-client:1a",
    dockerfile: join(benchmarkDirectory, "candidates", "client", "Dockerfile"),
  },
  {
    id: "paddle",
    tag: "nalanda-ocr-paddle:1a",
    dockerfile: join(benchmarkDirectory, "candidates", "paddle", "Dockerfile"),
  },
];

const receipt = {};
for (const variant of variants) {
  const buildInputSha256 = containerBuildInputDigest(variant.id);
  const build = spawnSync(
    "docker",
    [
      "build",
      "--pull",
      "--label",
      `nalanda.ocr.build-input-sha256=${buildInputSha256}`,
      "--tag",
      variant.tag,
      "--file",
      variant.dockerfile,
      benchmarkDirectory,
    ],
    { cwd: repositoryRoot, stdio: "inherit", encoding: "utf8" },
  );
  if (build.status !== 0) throw new Error(`CONTAINER_PREPARATION_FAILED:${variant.id}`);
  const inspection = spawnSync(
    "docker",
    ["image", "inspect", variant.tag, "--format", "{{.Id}}"],
    { encoding: "utf8" },
  );
  if (inspection.status !== 0 || !inspection.stdout.trim().startsWith("sha256:")) {
    throw new Error(`CONTAINER_IMAGE_ID_MISSING:${variant.id}`);
  }
  receipt[variant.id] = {
    tag: variant.tag,
    image_id: inspection.stdout.trim(),
    build_input_sha256: buildInputSha256,
  };
}

const evidenceRoot = join(artifactRoot, "evidence");
mkdirSync(evidenceRoot, { recursive: true });
writeFileSync(
  join(evidenceRoot, "container-images.json"),
  `${JSON.stringify(receipt, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify(receipt, null, 2));
