import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { unzipSync, zipSync, type Zippable } from "fflate";
import { createReleaseManifest, sha256Bytes, stableManifestJson, verifyReleaseManifest } from "@/lib/release-manifest";
import type { ReleaseEnvironment, ReleaseManifestDocument } from "@/lib/release-operations-types";

const FORBIDDEN_PATH = [
  /(^|\/)\.env(?:\.|$)/i, /(^|\/)(?:dev|prod|production|operational)\.(?:db|sqlite3?)(?:-|$)/i,
  /\.(?:db|sqlite3?)(?:-journal|-wal|-shm)?$/i, /(^|\/)coverage(\/|$)/i, /(^|\/)\.git(\/|$)/i,
  /\.(?:log|pid|tmp|temp)$/i, /(^|\/)\.vscode(\/|$)/i, /(^|\/)\.idea(\/|$)/i
];
const FORBIDDEN_DATA_SEGMENT = /(^|\/)(?:backups?|uploads?|private-(?:uploads|assets)|logs?|tmp|temp|qa-artifacts|test-results|report-cards?|payslips?)(\/|$)/i;

const TEXT_SECRET = /(?:-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{20,}|sk_(?:live|test)_[A-Za-z0-9]{16,})/;
const MAX_FILES = 80_000;
const MAX_ARTIFACT_BYTES = 1_500_000_000;

export type ReleasePackageInventoryRow = { path: string; bytes: number; sha256: string };

function safeRelative(value: string) {
  const normalized = value.replaceAll(path.sep, "/").replace(/^\/+/, "");
  if (!normalized || normalized === "." || normalized.split("/").includes("..")) throw new Error("RELEASE_PACKAGE_PATH_INVALID");
  return normalized;
}

function assertAllowed(relative: string, bytes?: Buffer) {
  if (FORBIDDEN_PATH.some((rule) => rule.test(relative))) throw new Error(`RELEASE_PACKAGE_PRIVATE_PATH_REFUSED:${relative}`);
  const compiledServerMetadata = /^runtime\/\.next\/server\/.+\.(?:js(?:\.map)?|json|html|rsc|meta|body)$/i.test(relative);
  if (FORBIDDEN_DATA_SEGMENT.test(relative) && !compiledServerMetadata) throw new Error(`RELEASE_PACKAGE_PRIVATE_PATH_REFUSED:${relative}`);
  if (bytes && bytes.length <= 2_000_000 && TEXT_SECRET.test(bytes.toString("utf8"))) throw new Error(`RELEASE_PACKAGE_SECRET_CONTENT_REFUSED:${relative}`);
}

function collect(root: string, prefix: string, output: Map<string, Buffer>) {
  if (!existsSync(root)) return;
  const stack = [{ absolute: root, relative: prefix }];
  while (stack.length) {
    const current = stack.pop()!;
    const stat = lstatSync(current.absolute);
    if (stat.isSymbolicLink()) throw new Error(`RELEASE_PACKAGE_SYMLINK_REFUSED:${current.relative}`);
    if (stat.isDirectory()) {
      const entries = readdirSync(current.absolute, { withFileTypes: true }).sort((a, b) => b.name.localeCompare(a.name));
      for (const entry of entries) stack.push({ absolute: path.join(current.absolute, entry.name), relative: safeRelative(path.posix.join(current.relative.replaceAll(path.sep, "/"), entry.name)) });
      continue;
    }
    if (!stat.isFile()) continue;
    const relative = safeRelative(current.relative);
    const bytes = readFileSync(current.absolute);
    assertAllowed(relative, bytes);
    output.set(relative, bytes);
    if (output.size > MAX_FILES) throw new Error("RELEASE_PACKAGE_FILE_LIMIT_EXCEEDED");
  }
}

function collectFile(workspaceRoot: string, source: string, destination: string, output: Map<string, Buffer>) {
  const absolute = path.join(workspaceRoot, source);
  if (!existsSync(absolute) || !lstatSync(absolute).isFile()) throw new Error(`RELEASE_PACKAGE_REQUIRED_FILE_MISSING:${source}`);
  const bytes = readFileSync(absolute);
  assertAllowed(destination, bytes);
  output.set(safeRelative(destination), bytes);
}

function payloadDigest(inventory: ReleasePackageInventoryRow[]) {
  const digest = createHash("sha256");
  for (const row of inventory) digest.update(row.path).update("\0").update(String(row.bytes)).update("\0").update(row.sha256).update("\n");
  return digest.digest("hex");
}

function inventory(files: Map<string, Buffer>): ReleasePackageInventoryRow[] {
  return [...files.entries()].map(([file, bytes]) => ({ path: file, bytes: bytes.length, sha256: sha256Bytes(bytes) })).sort((a, b) => a.path.localeCompare(b.path));
}

export function buildReleasePackage(input: {
  workspaceRoot: string;
  outputRoot: string;
  releaseId: string;
  releaseChannel: string;
  environment: ReleaseEnvironment;
  gitCommitSha: string;
  gitTag?: string | null;
  previousKnownGoodRelease: string;
  backupFormatVersion: number;
  runtimeMode?: "standalone" | "framework";
}) {
  const files = new Map<string, Buffer>();
  const runtimeMode = input.runtimeMode ?? "standalone";
  if (runtimeMode === "standalone") {
    const standalone = path.join(input.workspaceRoot, ".next", "standalone");
    if (!existsSync(path.join(standalone, "server.js"))) throw new Error("RELEASE_PACKAGE_STANDALONE_BUILD_MISSING");
    collect(standalone, "runtime", files);
    collect(path.join(input.workspaceRoot, ".next", "static"), "runtime/.next/static", files);
    collect(path.join(input.workspaceRoot, "public"), "runtime/public", files);
  } else {
    if (!existsSync(path.join(input.workspaceRoot, ".next", "server"))) throw new Error("RELEASE_PACKAGE_FRAMEWORK_BUILD_MISSING");
    collect(path.join(input.workspaceRoot, ".next", "server"), "runtime/.next/server", files);
    collect(path.join(input.workspaceRoot, ".next", "static"), "runtime/.next/static", files);
    collect(path.join(input.workspaceRoot, "public"), "runtime/public", files);
    for (const source of [".next/BUILD_ID", ".next/build-manifest.json", ".next/prerender-manifest.json", ".next/required-server-files.json", ".next/routes-manifest.json"]) {
      collectFile(input.workspaceRoot, source, `runtime/${source}`, files);
    }
  }
  collect(path.join(input.workspaceRoot, "prisma", "migrations"), "prisma/migrations", files);
  collect(path.join(input.workspaceRoot, "deploy", "staging"), "deploy/staging", files);
  for (const source of ["prisma/schema.prisma", "package.json", "pnpm-lock.yaml"]) {
    const absolute = path.join(input.workspaceRoot, source);
    if (!existsSync(absolute)) throw new Error(`RELEASE_PACKAGE_REQUIRED_FILE_MISSING:${source}`);
    const bytes = readFileSync(absolute); assertAllowed(source, bytes); files.set(source, bytes);
  }
  const payloadInventory = inventory(files);
  const artifactPayloadSha256 = payloadDigest(payloadInventory);
  const manifest = createReleaseManifest({ ...input, artifactSha256: artifactPayloadSha256 });
  files.set("release/release-manifest.json", Buffer.from(stableManifestJson(manifest)));
  files.set("release/artifact-inventory.json", Buffer.from(`${JSON.stringify({ contractVersion: 1, payloadSha256: artifactPayloadSha256, files: payloadInventory }, null, 2)}\n`));
  const totalBytes = [...files.values()].reduce((sum, bytes) => sum + bytes.length, 0);
  if (totalBytes > MAX_ARTIFACT_BYTES) throw new Error("RELEASE_PACKAGE_SIZE_LIMIT_EXCEEDED");
  mkdirSync(input.outputRoot, { recursive: true });
  const zipInput: Zippable = {};
  for (const [name, bytes] of files) zipInput[name] = [bytes, { level: 6, mtime: new Date("1980-01-01T00:00:00.000Z") }];
  const archive = Buffer.from(zipSync(zipInput, { level: 6 }));
  const archivePath = path.join(input.outputRoot, `${input.releaseId}.zip`);
  writeFileSync(archivePath, archive, { mode: 0o600 });
  const archiveSha256 = sha256Bytes(archive);
  const finalInventory = inventory(files);
  const report = {
    contractVersion: 1,
    releaseId: input.releaseId,
    artifactPath: path.basename(archivePath),
    payloadSha256: artifactPayloadSha256,
    archiveSha256,
    fileCount: finalInventory.length,
    uncompressedBytes: totalBytes,
    archiveBytes: archive.length,
    runtimeMode,
    files: finalInventory
  };
  writeFileSync(path.join(input.outputRoot, `${input.releaseId}.inventory.json`), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  writeFileSync(path.join(input.outputRoot, `${input.releaseId}.sha256`), `${archiveSha256}  ${path.basename(archivePath)}\n`, { mode: 0o600 });
  return { archivePath, manifest, report };
}

export function verifyReleasePackage(input: { archiveBytes: Buffer; expectedArchiveSha256?: string }) {
  const archiveSha256 = sha256Bytes(input.archiveBytes);
  if (input.expectedArchiveSha256 && archiveSha256 !== input.expectedArchiveSha256.toLowerCase()) throw new Error("RELEASE_ARCHIVE_HASH_MISMATCH");
  const unzipped = unzipSync(input.archiveBytes);
  const files = new Map<string, Buffer>();
  for (const [name, bytes] of Object.entries(unzipped)) {
    const relative = safeRelative(name); assertAllowed(relative, Buffer.from(bytes)); files.set(relative, Buffer.from(bytes));
  }
  const manifestBytes = files.get("release/release-manifest.json");
  const inventoryBytes = files.get("release/artifact-inventory.json");
  if (!manifestBytes || !inventoryBytes) throw new Error("RELEASE_PACKAGE_METADATA_MISSING");
  const manifest = verifyReleaseManifest(JSON.parse(manifestBytes.toString("utf8")));
  const stored = JSON.parse(inventoryBytes.toString("utf8")) as { payloadSha256: string; files: ReleasePackageInventoryRow[] };
  files.delete("release/release-manifest.json"); files.delete("release/artifact-inventory.json");
  const actual = inventory(files);
  if (JSON.stringify(actual) !== JSON.stringify(stored.files) || payloadDigest(actual) !== stored.payloadSha256 || manifest.releaseArtifactSha256 !== stored.payloadSha256) throw new Error("RELEASE_PACKAGE_PAYLOAD_MISMATCH");
  return { valid: true, archiveSha256, manifest, fileCount: actual.length, payloadSha256: stored.payloadSha256 };
}

export function deploymentSizeExplanation(report: { uncompressedBytes: number; archiveBytes: number }) {
  return {
    repository: "Source history and development files; never shipped to a Parent or Staff client.",
    buildCache: "Local compiler cache used to create the package; excluded from deployment.",
    deploymentArtifact: `${report.archiveBytes} compressed bytes containing server runtime, public assets, schema and migrations.`,
    webPwaDownload: "Only versioned public static assets requested by the browser; no server database, source tree or private storage.",
    futureNativeBinary: "Not produced in this phase; future app-store packages use the compatibility contract, not the ERP repository."
  };
}
