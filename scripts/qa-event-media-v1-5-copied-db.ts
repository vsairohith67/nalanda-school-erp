import { createHash, randomBytes, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { createAndVerifyEventMediaAssetBackup, restoreEventMediaAssetBackup } from "../lib/event-media-asset-backup";
import { EVENT_MEDIA_BACKUP_KEYS, loadEventMediaBackup, restoreEventMediaBackup, validateEventMediaBackupRows } from "../lib/event-media-backup";
import { createBackupDocument } from "../lib/backup";
import { createEventMediaAlbum, eventMediaPublicGalleryEnabled, getParentEventMedia, getPublicEventMediaAlbums, getPublishedEventMediaDerivative, recordMediaPublicationConsent, revokeMediaPublicationConsent, transitionEventMediaAlbum, updateEventMediaAsset, uploadEventMediaAsset } from "../lib/event-media";
import { readEventMediaBytes } from "../lib/event-media-files";
import { emptyEntityResult } from "../lib/restore";
import { hashPassword } from "../lib/password";
import { assertSqliteCopyReady, assertSqliteSnapshotUnchanged, snapshotSqliteArtifacts } from "./sqlite-copy-safety";

const prefix = process.argv.find((value) => value.startsWith("--prefix="))?.slice(9).trim() || "EVENTMEDIA15";
const keep = process.argv.includes("--keep");
const workspace = path.resolve(".");
const operationalInput = process.env.EVENT_MEDIA_OPERATIONAL_DB?.trim();
const operational = operationalInput ? path.resolve(operationalInput) : "";
const root = path.resolve(workspace, "tmp", `${prefix.toLowerCase()}-copied-qa`);
const copied = path.join(root, "event-media-copy.db"), restored = path.join(root, "event-media-restore.db"), storage = path.join(root, "storage"), artifactRoot = path.join(root, "asset-backup");
const databaseUrl = (file: string) => `file:${file.replaceAll("\\", "/")}`;
const actor = (id: string, role: "DIRECTOR" | "TEACHER") => ({ id, role } as const);
let stage = "preflight";
const browserCredential = `${prefix}-${randomBytes(12).toString("base64url")}Aa1!`;
const browserSessionSecret = randomBytes(48).toString("base64url");

function checkedRoot() { const target = path.resolve(root), parent = path.resolve(workspace, "tmp"); invariant(target.startsWith(`${parent}${path.sep}`) && target.endsWith(`${prefix.toLowerCase()}-copied-qa`), `${prefix}_CLEANUP_SCOPE_REFUSED`); return target; }
function cleanup() { const target = checkedRoot(); if (existsSync(target)) rmSync(target, { recursive: true, force: true }); }
function migrate(file: string) { const prismaEntry = path.join(workspace, "node_modules", "prisma", "build", "index.js"); const run = spawnSync(process.execPath, [prismaEntry, "migrate", "deploy", "--schema", "prisma/schema.prisma"], { cwd: workspace, env: { ...process.env, DATABASE_URL: databaseUrl(file) }, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, windowsHide: true }); if (run.error || run.status !== 0) throw new Error(`${prefix}_MIGRATION_FAILED:${run.error?.message ?? `${run.stdout}\n${run.stderr}`}`); }
function invariant(value: unknown, code: string): asserts value { if (!value) throw new Error(code); }
async function denied(work: () => Promise<unknown>, code: string) { try { await work(); } catch { return; } throw new Error(code); }
function sha(value: Uint8Array) { return createHash("sha256").update(value).digest("hex"); }

async function seedBase(client: PrismaClient) {
  const directorId = randomUUID(), teacherId = randomUUID();
  const passwordHash = await hashPassword(browserCredential);
  let directorUsername = "";
  for (const user of [{ id: directorId, role: "DIRECTOR" as const, label: "Director" }, { id: teacherId, role: "TEACHER" as const, label: "Teacher" }]) {
    const username = `${prefix.toLowerCase()}-${user.label.toLowerCase()}-${randomBytes(3).toString("hex")}`;
    await client.user.create({ data: { id: user.id, iamPublicKey: randomUUID(), name: `${prefix} ${user.label}`, username, passwordHash, role: user.role, isActive: true, lifecycleStatus: "ACTIVE" } });
    await client.authLoginAlias.create({ data: { userId: user.id, type: "USERNAME", normalizedValue: username, displayMasked: username, status: "VERIFIED", isSchoolGoverned: true, verifiedAt: new Date() } });
    await client.userRoleAssignment.create({ data: { id: randomUUID(), publicKey: randomUUID(), userId: user.id, role: user.role, status: "ACTIVE", reason: `${prefix} copied-database browser fixture`, activeKey: `${user.id}:${user.role}` } });
    if (user.role === "DIRECTOR") directorUsername = username;
  }
  const guardianOne = await client.guardian.create({ data: { id: randomUUID(), iamPublicKey: randomUUID(), displayName: `${prefix} Guardian One`, primaryMobile: `91${randomBytes(4).readUInt32BE().toString().padStart(10, "0").slice(-10)}`, status: "Active" } });
  const guardianBoth = await client.guardian.create({ data: { id: randomUUID(), iamPublicKey: randomUUID(), displayName: `${prefix} Guardian Both`, primaryMobile: `92${randomBytes(4).readUInt32BE().toString().padStart(10, "0").slice(-10)}`, status: "Active" } });
  const students = [];
  for (let index = 1; index <= 2; index++) {
    const student = await client.student.create({ data: { id: randomUUID(), admissionNo: `${prefix}-S${index}`, studentName: `${prefix} Synthetic Child ${index}`, fatherName: "Synthetic Guardian", className: "7", section: "A", phone1: "9000000000", academicYear: "2026-27" } });
    await client.studentGuardian.create({ data: { guardianId: guardianBoth.id, studentId: student.id, isPrimaryContact: index === 1 } });
    if (index === 1) await client.studentGuardian.create({ data: { guardianId: guardianOne.id, studentId: student.id, isPrimaryContact: true } });
    students.push(student);
  }
  const parentId = randomUUID(), parentUsername = `${prefix.toLowerCase()}-parent-${randomBytes(3).toString("hex")}`;
  await client.user.create({ data: { id: parentId, iamPublicKey: randomUUID(), name: `${prefix} Parent`, username: parentUsername, passwordHash, role: "PARENT", isActive: true, lifecycleStatus: "ACTIVE", guardianId: guardianBoth.id } });
  await client.authLoginAlias.create({ data: { userId: parentId, type: "USERNAME", normalizedValue: parentUsername, displayMasked: parentUsername, status: "VERIFIED", isSchoolGoverned: true, verifiedAt: new Date() } });
  await client.userRoleAssignment.create({ data: { id: randomUUID(), publicKey: randomUUID(), userId: parentId, role: "PARENT", status: "ACTIVE", reason: `${prefix} copied-database Parent browser fixture`, activeKey: `${parentId}:PARENT` } });
  return { directorId, directorUsername, teacherId, parentId, parentUsername, guardianOne, guardianBoth, students };
}

async function main() {
  cleanup();
  if (!operational) throw new Error(`${prefix}_OPERATIONAL_DB_PATH_REQUIRED`);
  assertSqliteCopyReady(operational, `${prefix}_OPERATIONAL`);
  const operationalBefore = snapshotSqliteArtifacts(operational);
  mkdirSync(root, { recursive: true });
  copyFileSync(operational, copied);
  migrate(copied); migrate(copied);
  stage = "base fixtures";
  const baseClient = new PrismaClient({ datasourceUrl: databaseUrl(copied) });
  const base = await seedBase(baseClient);
  await baseClient.$disconnect();
  assertSqliteCopyReady(copied, `${prefix}_COPIED_BASE`);
  copyFileSync(copied, restored);
  process.env.EVENT_MEDIA_PRIVATE_STORAGE_ROOT = storage;
  delete process.env.EVENT_MEDIA_PUBLIC_GALLERY_ENABLED;
  const client = new PrismaClient({ datasourceUrl: databaseUrl(copied) }), restoreClient = new PrismaClient({ datasourceUrl: databaseUrl(restored) });
  try {
    invariant(!eventMediaPublicGalleryEnabled(), `${prefix}_PUBLIC_DEFAULT_ON`);
    await denied(() => createEventMediaAlbum(client, { title: "Teacher album", eventDate: "2026-08-22", visibility: "PUBLIC" }, actor(base.teacherId, "TEACHER")), `${prefix}_TEACHER_CREATED_ALBUM`);

    stage = "public lifecycle";
    const publicAlbum = await createEventMediaAlbum(client, { title: `${prefix} Public Foundation Day`, eventDate: "2026-08-20", description: "Synthetic no-people publication path.", visibility: "PUBLIC" }, actor(base.directorId, "DIRECTOR"));
    const exifOriginal = await sharp({ create: { width: 120, height: 80, channels: 3, background: "#174a5b" } }).jpeg().withExif({ IFD0: { Make: "SYNTHETIC-QA-DEVICE" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "17/1 23/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "78/1 29/1 0/1" } }).toBuffer();
    const publicAsset = await uploadEventMediaAsset(client, publicAlbum.publicKey, new File([Uint8Array.from(exifOriginal).buffer], "synthetic-gps.jpg", { type: "image/jpeg" }), actor(base.directorId, "DIRECTOR"));
    invariant(publicAsset.publicationStatus === "PRIVATE" && publicAsset.reviewStatus === "PENDING", `${prefix}_UPLOAD_NOT_PRIVATE`);
    const originalReadback = await readEventMediaBytes(publicAsset.originalStorageKey, publicAsset.originalSha256, publicAsset.originalByteSize);
    invariant(originalReadback.equals(exifOriginal), `${prefix}_ORIGINAL_BYTES_CHANGED`);
    const derivative = publicAsset.derivatives.find((row: { kind: string }) => row.kind === "THUMBNAIL");
    invariant(Boolean(derivative?.metadataStripped && derivative.storageKey && derivative.sha256), `${prefix}_DERIVATIVE_NOT_SAFE`);
    const derivativeBytes = await readEventMediaBytes(derivative.storageKey, derivative.sha256, derivative.byteSize);
    const derivativeMetadata = await sharp(derivativeBytes).metadata();
    invariant(!derivativeMetadata.exif && !derivativeMetadata.icc && !derivativeMetadata.xmp && !derivativeBytes.includes(Buffer.from("SYNTHETIC-QA-DEVICE")), `${prefix}_EXIF_GPS_LEAK`);
    await transitionEventMediaAlbum(client, publicAlbum.publicKey, "SUBMIT_REVIEW", actor(base.directorId, "DIRECTOR"));
    await denied(() => transitionEventMediaAlbum(client, publicAlbum.publicKey, "APPROVE", actor(base.directorId, "DIRECTOR")), `${prefix}_UNKNOWN_PEOPLE_APPROVED`);
    await updateEventMediaAsset(client, publicAsset.publicKey, { caption: "A deliberately long synthetic caption used to verify retained governed text without any real person or image data. ".repeat(12), peopleDeclaration: "NO_STUDENTS", reviewStatus: "APPROVED", reviewNote: "Synthetic QA review." }, actor(base.directorId, "DIRECTOR"));
    await transitionEventMediaAlbum(client, publicAlbum.publicKey, "APPROVE", actor(base.directorId, "DIRECTOR"));
    await denied(() => transitionEventMediaAlbum(client, publicAlbum.publicKey, "PUBLISH", actor(base.directorId, "DIRECTOR")), `${prefix}_PUBLIC_FLAG_BYPASSED`);
    invariant((await getPublicEventMediaAlbums(client)).length === 0, `${prefix}_PUBLIC_VISIBLE_WHILE_DISABLED`);
    process.env.EVENT_MEDIA_PUBLIC_GALLERY_ENABLED = "true";
    await transitionEventMediaAlbum(client, publicAlbum.publicKey, "PUBLISH", actor(base.directorId, "DIRECTOR"));
    invariant((await getPublicEventMediaAlbums(client)).some((album) => album.publicKey === publicAlbum.publicKey), `${prefix}_PUBLIC_EXPLICIT_PUBLISH_MISSING`);
    await transitionEventMediaAlbum(client, publicAlbum.publicKey, "UNPUBLISH", actor(base.directorId, "DIRECTOR"));
    await denied(() => getPublishedEventMediaDerivative(client, publicAsset.publicKey, "PUBLIC"), `${prefix}_UNPUBLISHED_DERIVATIVE_VISIBLE`);
    await transitionEventMediaAlbum(client, publicAlbum.publicKey, "ARCHIVE", actor(base.directorId, "DIRECTOR"));

    stage = "multi-student consent";
    const parentAlbum = await createEventMediaAlbum(client, { title: `${prefix} Parent Album`, eventDate: "2026-08-21", visibility: "PARENT_PORTAL" }, actor(base.directorId, "DIRECTOR"));
    const safePng = await sharp({ create: { width: 96, height: 64, channels: 4, background: "#bd8f2f" } }).png().toBuffer();
    const parentAsset = await uploadEventMediaAsset(client, parentAlbum.publicKey, new File([Uint8Array.from(safePng).buffer], "synthetic.png", { type: "image/png" }), actor(base.directorId, "DIRECTOR"));
    await updateEventMediaAsset(client, parentAsset.publicKey, { caption: "Synthetic governed event caption used to verify that longer approved descriptions wrap safely across desktop and mobile without exposing internal Student references. ".repeat(4).trim(), peopleDeclaration: "MANUAL_ASSOCIATIONS_COMPLETE", studentAdmissionNos: base.students.map((row) => row.admissionNo), reviewStatus: "APPROVED" }, actor(base.directorId, "DIRECTOR"));
    await denied(() => updateEventMediaAsset(client, parentAsset.publicKey, { peopleDeclaration: "NO_STUDENTS", studentAdmissionNos: base.students.map((row) => row.admissionNo) }, actor(base.directorId, "DIRECTOR")), `${prefix}_PEOPLE_ASSOCIATION_CONFLICT_ALLOWED`);
    await transitionEventMediaAlbum(client, parentAlbum.publicKey, "SUBMIT_REVIEW", actor(base.directorId, "DIRECTOR"));
    const consentOne = await recordMediaPublicationConsent(client, { studentAdmissionNo: base.students[0].admissionNo, guardianId: base.guardianBoth.id, audience: "PARENT_PORTAL", source: "SIGNED_FORM", wordingVersion: "EVENT-MEDIA-V1", evidenceReference: `${prefix}-FORM-1`, grantedAt: "2026-08-20" }, actor(base.directorId, "DIRECTOR"));
    await denied(() => transitionEventMediaAlbum(client, parentAlbum.publicKey, "APPROVE", actor(base.directorId, "DIRECTOR")), `${prefix}_PARTIAL_CONSENT_APPROVED`);
    await recordMediaPublicationConsent(client, { studentAdmissionNo: base.students[1].admissionNo, guardianId: base.guardianBoth.id, audience: "PARENT_PORTAL", source: "SIGNED_FORM", wordingVersion: "EVENT-MEDIA-V1", evidenceReference: `${prefix}-FORM-2`, grantedAt: "2026-08-20" }, actor(base.directorId, "DIRECTOR"));
    await transitionEventMediaAlbum(client, parentAlbum.publicKey, "APPROVE", actor(base.directorId, "DIRECTOR"));
    await transitionEventMediaAlbum(client, parentAlbum.publicKey, "PUBLISH", actor(base.directorId, "DIRECTOR"));
    invariant(!(await getParentEventMedia(client, base.guardianOne.id)).length, `${prefix}_CROSS_FAMILY_ENUMERATION`);
    invariant((await getParentEventMedia(client, base.guardianBoth.id))[0]?.assets[0]?.publicKey === parentAsset.publicKey, `${prefix}_PARENT_APPROVED_GALLERY_MISSING`);
    await denied(() => getPublishedEventMediaDerivative(client, parentAsset.publicKey, "PARENT_PORTAL", base.guardianOne.id), `${prefix}_CROSS_FAMILY_DIRECT_ASSET`);
    await client.eventMediaAsset.update({ where: { id: parentAsset.id }, data: { peopleDeclaration: "NO_STUDENTS", publicationEligibility: "ELIGIBLE" } });
    invariant(!JSON.stringify(await getParentEventMedia(client, base.guardianBoth.id)).includes(parentAsset.publicKey), `${prefix}_CONTRADICTORY_PEOPLE_GALLERY_VISIBLE`);
    await denied(() => getPublishedEventMediaDerivative(client, parentAsset.publicKey, "PARENT_PORTAL", base.guardianBoth.id), `${prefix}_CONTRADICTORY_PEOPLE_DIRECT_ASSET_VISIBLE`);
    await client.eventMediaAsset.update({ where: { id: parentAsset.id }, data: { peopleDeclaration: "MANUAL_ASSOCIATIONS_COMPLETE", publicationEligibility: "ELIGIBLE" } });
    await revokeMediaPublicationConsent(client, consentOne.publicKey, "Synthetic Guardian withdrawal QA", actor(base.directorId, "DIRECTOR"));
    await denied(() => getPublishedEventMediaDerivative(client, parentAsset.publicKey, "PARENT_PORTAL", base.guardianBoth.id), `${prefix}_REVOKED_CONSENT_ASSET_VISIBLE`);
    const withdrawn = await client.eventMediaAsset.findUniqueOrThrow({ where: { id: parentAsset.id } });
    invariant(withdrawn.publicationStatus === "WITHDRAWN" && withdrawn.withdrawalState === "CONSENT_REVOKED", `${prefix}_REVOCATION_NOT_WITHDRAWN`);
    await recordMediaPublicationConsent(client, { studentAdmissionNo: base.students[0].admissionNo, guardianId: base.guardianBoth.id, audience: "PARENT_PORTAL", source: "SIGNED_FORM", wordingVersion: "EVENT-MEDIA-V1", evidenceReference: `${prefix}-FORM-1-RENEWED`, grantedAt: "2026-08-22" }, actor(base.directorId, "DIRECTOR"));
    await transitionEventMediaAlbum(client, parentAlbum.publicKey, "UNPUBLISH", actor(base.directorId, "DIRECTOR"));
    await transitionEventMediaAlbum(client, parentAlbum.publicKey, "PUBLISH", actor(base.directorId, "DIRECTOR"));
    invariant((await getParentEventMedia(client, base.guardianBoth.id))[0]?.assets[0]?.publicKey === parentAsset.publicKey, `${prefix}_REPUBLISHED_PARENT_GALLERY_MISSING`);

    stage = "backup and restore";
    const eventBackup = validateEventMediaBackupRows(await loadEventMediaBackup(client) as unknown as Record<string, unknown>);
    const logical = createBackupDocument({ generatedAt: new Date(), generatedBy: `${prefix} copied QA`, students: [], feeStructures: [], payments: [], paymentAudits: [], users: [], ...eventBackup });
    invariant(logical.metadata.backupVersion === 42 && logical.eventMediaAlbums.length === 2 && !JSON.stringify(logical).includes(exifOriginal.toString("base64")), `${prefix}_LOGICAL_BACKUP_INVALID`);
    const restoreResult = { ...Object.fromEntries(EVENT_MEDIA_BACKUP_KEYS.map((key) => [key, emptyEntityResult()])), warnings: [] } as any;
    const idMap = (values: string[]) => new Map(values.map((value) => [value, value]));
    await restoreEventMediaBackup(restoreClient, eventBackup, { students: idMap(base.students.map((row) => row.id)), guardians: idMap([base.guardianOne.id, base.guardianBoth.id]), users: idMap([base.directorId, base.teacherId]), restoredBy: base.directorId }, restoreResult);
    invariant(restoreResult.eventMediaAlbums.created === 2 && restoreResult.eventMediaAssets.created === 2 && EVENT_MEDIA_BACKUP_KEYS.every((key) => restoreResult[key].errors.length === 0), `${prefix}_METADATA_RESTORE_FAILED`);
    await restoreEventMediaBackup(restoreClient, eventBackup, { students: idMap(base.students.map((row) => row.id)), guardians: idMap([base.guardianOne.id, base.guardianBoth.id]), users: idMap([base.directorId, base.teacherId]), restoredBy: base.directorId }, restoreResult);
    invariant(restoreResult.eventMediaAlbums.skipped === 2 && restoreResult.eventMediaAssets.skipped === 2, `${prefix}_METADATA_RESTORE_NOT_IDEMPOTENT`);
    const key = randomBytes(32), artifactPath = path.join(artifactRoot, "event-media-assets.npsbackup");
    const proof = await createAndVerifyEventMediaAssetBackup(client, { artifactPath, key, keyVersion: "V1", restoreRoots: [path.join(artifactRoot, "restore-a"), path.join(artifactRoot, "restore-b")] });
    invariant(proof.assetCount === 2 && proof.fileCount === 4 && proof.firstRestore.fileDigest === proof.secondRestore.fileDigest, `${prefix}_ASSET_BACKUP_RESTORE_FAILED`);
    const corrupted = Buffer.from(readFileSync(artifactPath)); corrupted[Math.floor(corrupted.length / 2)] ^= 0xff;
    await denied(() => restoreEventMediaAssetBackup(corrupted, { key, targetRoot: path.join(artifactRoot, "corrupt") }), `${prefix}_CORRUPT_BACKUP_ACCEPTED`);

    stage = "database guards";
    await denied(() => client.$executeRawUnsafe(`UPDATE EventMediaAsset SET originalSha256='${"f".repeat(64)}' WHERE id='${parentAsset.id}'`), `${prefix}_ORIGINAL_MUTABLE`);
    await denied(() => client.eventMediaAuditEvent.deleteMany({ where: { albumId: parentAlbum.id } }), `${prefix}_AUDIT_DELETE_ALLOWED`);
    await denied(() => client.eventMediaAlbum.delete({ where: { id: parentAlbum.id } }), `${prefix}_HARD_DELETE_ALLOWED`);
  } finally {
    await client.$disconnect(); await restoreClient.$disconnect();
    delete process.env.EVENT_MEDIA_PUBLIC_GALLERY_ENABLED; delete process.env.EVENT_MEDIA_PRIVATE_STORAGE_ROOT;
  }
  const operationalAfter = snapshotSqliteArtifacts(operational);
  assertSqliteSnapshotUnchanged(operationalBefore, operationalAfter, `${prefix}_OPERATIONAL_DB_CHANGED`);
  const runtimePath = path.join(root, "browser-runtime.json");
  if (keep) writeFileSync(runtimePath, JSON.stringify({ databaseUrl: databaseUrl(copied), storageRoot: storage, sessionSecret: browserSessionSecret, username: base.directorUsername, parentUsername: base.parentUsername, password: browserCredential }, null, 2), { flag: "wx" });
  const evidence = { result: `${prefix}_COPIED_DB_QA_PASSED`, operationalSha256: operationalBefore[0]?.hash, migration: "20260822113000_event_media_v1_5_foundation", backupVersion: 42, publicPublishing: "DEFAULT_OFF", syntheticImagesOnly: true, kept: keep, ...(keep ? { runtimePath } : {}) };
  console.log(JSON.stringify(evidence, null, 2));
  if (!keep) { cleanup(); invariant(!existsSync(root), `${prefix}_QA_RESIDUE_REMAINS`); }
}

if (process.argv.includes("cleanup")) { cleanup(); console.log(JSON.stringify({ result: `${prefix}_QA_FIXTURES_REMOVED`, exists: existsSync(root) })); }
else main().catch((error) => { console.error(`${stage}: ${error instanceof Error ? error.message : String(error)}`); try { cleanup(); } catch { /* Preserve the primary failure while still failing closed. */ } process.exitCode = 1; });
