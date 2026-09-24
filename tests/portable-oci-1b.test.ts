import { it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
const script = path.resolve("scripts/portable/oci-index.mjs");
const source = "a".repeat(40);
it.each(["valid", "skopeo-index", "missing-layer", "wrong-size", "wrong-platform", "wrong-source"])("checks OCI manifest closure: %s", mode => {
  const root = mkdtempSync(path.join(tmpdir(), "nalanda-oci-test-"));
  try {
    for (const architecture of ["amd64", "arm64"]) {
      const arch = path.join(root, "oci-input", architecture); const layout = path.join(arch, "oci-layout");
      mkdirSync(path.join(layout, "blobs/sha256"), { recursive: true });
      const blob = (value: unknown, mediaType: string) => {
        const bytes = Buffer.from(typeof value === "string" ? value : JSON.stringify(value));
        const hash = createHash("sha256").update(bytes).digest("hex"); writeFileSync(path.join(layout, "blobs/sha256", hash), bytes);
        return { mediaType, digest: `sha256:${hash}`, size: bytes.length };
      };
      const config = blob({ architecture: mode === "wrong-platform" ? "invalid" : architecture, os: "linux", config: { Labels: { "org.opencontainers.image.revision": source } } }, "application/vnd.oci.image.config.v1+json");
      const layer = blob("synthetic-layer-bytes", "application/vnd.oci.image.layer.v1.tar");
      if (mode === "missing-layer") unlinkSync(path.join(layout, "blobs/sha256", layer.digest.slice(7)));
      if (mode === "wrong-size") layer.size++;
      const manifest = blob({ schemaVersion: 2, mediaType: "application/vnd.oci.image.manifest.v1+json", config, layers: [layer] }, "application/vnd.oci.image.manifest.v1+json");
      writeFileSync(path.join(layout, "index.json"), JSON.stringify({ schemaVersion: 2, mediaType: mode === "skopeo-index" ? undefined : "application/vnd.oci.image.index.v1+json", manifests: [manifest] }));
      writeFileSync(path.join(arch, "build-provenance.json"), JSON.stringify({ sourceCommit: mode === "wrong-source" ? "b".repeat(40) : source, architecture, emulationUsed: false, imageId: config.digest }));
    }
    const execute = () => execFileSync(process.execPath, [script], { cwd: root, env: { ...process.env, EXPECTED_SHA: source }, stdio: "pipe" });
    if (mode === "valid" || mode === "skopeo-index") { execute(); expect(JSON.parse(readFileSync(path.join(root, "oci-release/index.json"), "utf8")).manifests.map((m: any) => m.platform.architecture)).toEqual(["amd64", "arm64"]); }
    else expect(execute).toThrow();
  } finally { if (!root.startsWith(path.join(tmpdir(), "nalanda-oci-test-"))) throw new Error("TEST_CLEANUP_BOUNDARY"); rmSync(root, { recursive: true }); }
});
