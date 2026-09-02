import { createHash, randomBytes, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

import { hashPassword } from "../lib/password";
import { admitOcrDocument } from "../lib/ocr-scanning/admission";
import { OCR_ENGINE_LOCK } from "../lib/ocr-scanning/model-lock";
import { createOcrUpload } from "../lib/ocr-scanning/workflow";
import { claimOcrJob, completeOcrJob, uploadWorkerOcrRaster } from "../lib/ocr-scanning/worker-service";

const workspace = path.resolve(".");
const operational = path.resolve(process.env.OCR_OPERATIONAL_DB?.trim() || path.join(process.env.USERPROFILE ?? "C:\\Users\\rohit", "Documents", "school software", "prisma", "dev.db"));
const root = path.join(workspace, "tmp", "ocr-scanning-foundation-1b-browser");
const database = path.join(root, "browser.db");
const privateRoot = path.join(root, "private-objects");
const credentialsPath = path.join(root, "credentials.json");
const runtimePath = path.join(root, "runtime-env.json");
const port = 3271;
const databaseUrl = `file:${database.replaceAll("\\", "/")}`;

function digest(value: Uint8Array | string) { return createHash("sha256").update(value).digest("hex"); }
function identity(file: string) { const stat = statSync(file); return { sha256: digest(readFileSync(file)), size: stat.size, mtime: stat.mtime.toISOString() }; }
function cleanup() {
  const target = path.resolve(root), parent = path.resolve(workspace, "tmp");
  if (!target.startsWith(`${parent}${path.sep}`) || !target.endsWith("ocr-scanning-foundation-1b-browser")) throw new Error("OCR_BROWSER_CLEANUP_SCOPE_REFUSED");
  if (existsSync(target)) rmSync(target, { recursive: true, force: true });
}
function migrate() {
  const entry = path.join(workspace, "node_modules", "prisma", "build", "index.js");
  const result = spawnSync(process.execPath, [entry, "migrate", "deploy", "--schema", "prisma/schema.prisma"], { cwd: workspace, env: { ...process.env, DATABASE_URL: databaseUrl, DATABASE_PROVIDER: "sqlite" }, encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0 || result.error) throw new Error(`OCR_BROWSER_MIGRATION_FAILED:${result.error?.message ?? result.stderr}`);
}

async function setup() {
  cleanup();
  if (!existsSync(operational)) throw new Error("OCR_BROWSER_OPERATIONAL_DATABASE_MISSING");
  const before = identity(operational);
  mkdirSync(root, { recursive: true });
  copyFileSync(operational, database);
  migrate(); migrate();
  process.env.DATABASE_URL = databaseUrl;
  process.env.DATABASE_PROVIDER = "sqlite";
  process.env.PRIVATE_STORAGE_ROOT = privateRoot;
  const client = new PrismaClient({ datasourceUrl: databaseUrl });
  const syntheticCredential = `OcrBrowser-${randomBytes(18).toString("base64url")}!9a`;
  try {
    const user = await client.user.create({ data: { id: randomUUID(), iamPublicKey: randomUUID(), name: "OCR Browser Super Admin", designation: "Synthetic OCR QA", username: "ocr-browser-super-admin", passwordHash: await hashPassword(syntheticCredential), role: "SUPER_ADMIN", isActive: true, lifecycleStatus: "ACTIVE" } });
    await client.authLoginAlias.create({ data: { userId: user.id, type: "USERNAME", normalizedValue: user.username, displayMasked: user.username, status: "VERIFIED", isSchoolGoverned: true, verifiedAt: new Date() } });
    await client.userRoleAssignment.create({ data: { id: randomUUID(), publicKey: randomUUID(), userId: user.id, role: "SUPER_ADMIN", status: "ACTIVE", reason: "OCR 1B isolated Browser QA", activeKey: `${user.id}:SUPER_ADMIN` } });
    const student = await client.student.create({ data: { id: randomUUID(), admissionNo: "OCR-BROWSER-001", studentName: "Asha Synthetic Rao", fatherName: "Vijay Synthetic Rao", motherName: "Meera Synthetic Rao", className: "II", section: "A", academicYear: "2026-27", phone1: "9000000001", address: "Old synthetic address", dateOfBirth: new Date("2015-01-15") } });
    const raster = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "#f8f3e8" } }).png().toBuffer();
    const admitted = await admitOcrDocument({ bytes: raster, filename: "synthetic-student-form.png", declaredMime: "image/png" });
    const actor = { id: user.id, username: user.username, name: user.name, role: user.role } as never;
    const uploaded = await createOcrUpload({ client, actor, contextType: "STUDENT", contextId: student.id, languageProfile: "ENGLISH_HINDI_TELUGU", handwritingDeclared: true, idempotencyKey: `ocr-browser-${randomUUID()}`, admitted });
    const claim = await claimOcrJob({ client, workerId: "nalanda-ocr-worker-1b", nonceHash: digest(`claim:${randomUUID()}`) });
    if (!claim) throw new Error("OCR_BROWSER_JOB_NOT_CLAIMED");
    const sourceDigest = digest(`${admitted.sha256}\npage:1`), rasterSha256 = digest(raster);
    await uploadWorkerOcrRaster({ client, workerId: "nalanda-ocr-worker-1b", nonceHash: digest(`raster:${randomUUID()}`), jobKey: claim.jobKey, leaseToken: claim.leaseToken, pageNumber: 1, width: 1200, height: 800, sourceRotation: 0, sourceDigest, processingDurationMs: 1100, retryPreprocessing: false, rasterSha256, bytes: raster });
    const values = [
      ["Student name", "Asha Synthetic Rao"], ["Date of birth", "15-01-2015"], ["Class", "II"], ["Admission number", "OCR-BROWSER-001"],
      ["Father name", "Vijay Synthetic Rao"], ["Mother name", "Meera Synthetic Rao"], ["Phone", "9000000001"], ["Address", "New synthetic address"]
    ];
    const blocks = values.map(([label, value], index) => ({ pageNumber: 1, text: `${label}: ${value}`, polygon: [[80, 70 + index * 75], [800, 70 + index * 75], [800, 115 + index * 75], [80, 115 + index * 75]] as Array<[number, number]>, recognitionScore: index < 4 ? 0.98 : 0.88, scriptHint: "LATIN" as const, processingDurationMs: 1100, retryPreprocessing: false }));
    await completeOcrJob({ client, workerId: "nalanda-ocr-worker-1b", nonceHash: digest(`result:${randomUUID()}`), jobKey: claim.jobKey, leaseToken: claim.leaseToken, result: { contractVersion: "nalanda-ocr-worker-result-1", engineId: "paddleocr", engineRevision: "3.7.0", runtimeRevision: "paddlepaddle-gpu-3.3.1", modelReceipt: OCR_ENGINE_LOCK.models.map(({ name, revision, weightSha256 }) => ({ name, revision, weightSha256 })), sourceSha256: admitted.sha256, pages: [{ pageNumber: 1, width: 1200, height: 800, sourceRotation: 0, sourceDigest, rasterSha256, processingDurationMs: 1100, retryPreprocessing: false, blocks }], totalDurationMs: 1100 } });
    writeFileSync(credentialsPath, JSON.stringify({ username: user.username, password: syntheticCredential, role: user.role }, null, 2), { flag: "wx", mode: 0o600 });
    writeFileSync(runtimePath, JSON.stringify({ DATABASE_URL: databaseUrl, DATABASE_PROVIDER: "sqlite", PRIVATE_STORAGE_ROOT: privateRoot, SESSION_SECRET: randomBytes(48).toString("base64url"), AUTH_SECRET: randomBytes(48).toString("base64url"), APP_ORIGIN: `http://127.0.0.1:${port}`, RELEASE_FEATURE_FLAGS_QA_MODE: "SYNTHETIC_COPY_ONLY", RELEASE_FEATURE_FLAGS_QA_ENABLED: "ocr-scanning-foundation-1b", NODE_ENV: "development", PORT: String(port), documentKey: uploaded.publicKey }, null, 2), { flag: "wx", mode: 0o600 });
    if (JSON.stringify(before) !== JSON.stringify(identity(operational))) throw new Error("OCR_BROWSER_OPERATIONAL_DATABASE_CHANGED");
    process.stdout.write(`${JSON.stringify({ result: "OCR_SCANNING_FOUNDATION_1B_BROWSER_READY", copiedDatabase: true, syntheticOnly: true, operationalMutation: false, port, documentKey: uploaded.publicKey, credentialsPath, runtimePath })}\n`);
  } finally { await client.$disconnect(); }
}

if (process.argv[2] === "cleanup") { cleanup(); process.stdout.write('{"result":"OCR_SCANNING_FOUNDATION_1B_BROWSER_REMOVED"}\n'); }
else setup().catch((error) => { process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`); process.exitCode = 1; });
