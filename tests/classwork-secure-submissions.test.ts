import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { PDFDocument, PDFName } from "pdf-lib";
import { validateClassworkBackupRows } from "@/lib/classwork-backup";
import { validateClassworkDraftInput, validateExpectedVersion, validateRequestKey } from "@/lib/classwork";
import { assertAttachmentQuota, resolveStorageKey, validateClassworkUpload } from "@/lib/classwork-files";
import { OBJECT_SCOPED_PERMISSIONS } from "@/lib/iam/permission-governance";
import { can } from "@/lib/permissions";

const source = (file: string) => readFileSync(file, "utf8");
const upload = (name: string, type: string, bytes: Uint8Array): Pick<File, "name" | "type" | "size" | "arrayBuffer"> => ({
  name,
  type,
  size: bytes.length,
  arrayBuffer: async () => Uint8Array.from(bytes).buffer
});

describe("Prompt 23F governed classwork and secure submissions", () => {
  it("uses exact role defaults and treats every learner/Teacher capability as object scoped", () => {
    for (const permission of ["VIEW_CLASSWORK","MANAGE_CLASSWORK","PUBLISH_CLASSWORK","REVIEW_CLASSWORK_SUBMISSIONS"] as const) expect(can("TEACHER", permission)).toBe(true);
    expect(can("PRINCIPAL", "MANAGE_CLASSWORK_RECOVERY")).toBe(true);
    expect(can("ADMIN", "VIEW_CLASSWORK")).toBe(false);
    expect(can("VIEWER", "VIEW_CLASSWORK_AGGREGATES")).toBe(true);
    expect(can("VIEWER", "EXPORT_CLASSWORK_AGGREGATES")).toBe(false);
    for (const role of ["PARENT", "STUDENT"] as const) { expect(can(role, "VIEW_OWN_CLASSWORK")).toBe(true); expect(can(role, "SUBMIT_OWN_CLASSWORK")).toBe(true); }
    for (const permission of ["VIEW_CLASSWORK","MANAGE_CLASSWORK","VIEW_OWN_CLASSWORK","SUBMIT_OWN_CLASSWORK"] as const) expect(OBJECT_SCOPED_PERMISSIONS.has(permission)).toBe(true);
  });

  it("binds Teacher, Parent and Student access to active server-side identities", () => {
    const access = source("lib/classwork-access.ts");
    const workspacePage = source("components/classwork-workspace-page.tsx");
    for (const evidence of ["staffMember.findUnique", "timetableTeacher", "assignments", "requireClassworkTeacherTarget", "resolveActiveParentChildContext", "roleAssignmentId", "expectedContextVersion", 'type: "ADMISSION_NUMBER"', 'status: "VERIFIED"', "admissionStudentId"]) expect(access).toContain(evidence);
    expect(access).not.toContain("permissionSetCan");
    expect(workspacePage).toContain('error instanceof ClassworkAccessError');
    expect(workspacePage).toContain('"TEACHER_SCOPE_MISSING", "TEACHER_SCOPE_EMPTY"');
    expect(workspacePage).toContain("Permission alone never reveals another cohort.");
  });

  it("validates bounded plain-text drafts, expected versions and idempotency keys", () => {
    expect(validateClassworkDraftInput({ kind: "ASSIGNMENT", academicYear: "2026-27", className: "VII", section: "a", subjectName: "Science", timetableSubjectId: "subject-01", title: "Worksheet", instructions: "Complete all questions", dueAt: "2026-08-04T09:00:00Z" })).toMatchObject({ kind: "ASSIGNMENT", section: "A" });
    expect(() => validateClassworkDraftInput({ kind: "CLASSWORK", academicYear: "2026-27", className: "VII", section: "A", subjectName: "Science", timetableSubjectId: "subject-01", title: "<script>", instructions: "Unsafe" })).toThrow(/plain text/);
    expect(() => validateExpectedVersion(0)).toThrow(/Reload/);
    expect(validateRequestKey("CLASS23F_request_key_0001")).toBe("CLASS23F_request_key_0001");
    expect(() => validateRequestKey("short")).toThrow(/idempotency/);
  });

  it("accepts structurally valid PNG, JPEG, still WebP and passive PDF bytes", async () => {
    const png = await sharp({ create: { width: 2, height: 2, channels: 4, background: "white" } }).png().toBuffer();
    const jpeg = await sharp(png).jpeg().toBuffer();
    const webp = await sharp(png).webp().toBuffer();
    const document = await PDFDocument.create(); document.addPage([20, 20]); const pdf = await document.save();
    await expect(validateClassworkUpload(upload("safe.png", "image/png", png))).resolves.toMatchObject({ mediaType: "image/png", width: 2, height: 2 });
    await expect(validateClassworkUpload(upload("safe.jpeg", "image/jpeg", jpeg))).resolves.toMatchObject({ mediaType: "image/jpeg", safeDisplayName: "Private attachment.jpg" });
    await expect(validateClassworkUpload(upload("safe.webp", "image/webp", webp))).resolves.toMatchObject({ mediaType: "image/webp" });
    await expect(validateClassworkUpload(upload("safe.pdf", "application/pdf", pdf))).resolves.toMatchObject({ mediaType: "application/pdf" });
  });

  it("rejects traversal names, extension/MIME/magic mismatch, active PDF and truncation", async () => {
    const png = await sharp({ create: { width: 1, height: 1, channels: 4, background: "white" } }).png().toBuffer();
    await expect(validateClassworkUpload(upload("../safe.png", "image/png", png))).rejects.toThrow(/unsafe/);
    await expect(validateClassworkUpload(upload("fake.jpg", "image/jpeg", png))).rejects.toThrow(/contents/);
    await expect(validateClassworkUpload(upload("payload.svg", "image/svg+xml", Buffer.from("<svg><script/></svg>")))).rejects.toThrow(/Only PDF/);
    await expect(validateClassworkUpload(upload("payload.exe", "application/octet-stream", Buffer.from("MZpayload")))).rejects.toThrow(/Only PDF/);
    const active = Buffer.from("%PDF-1.4\n1 0 obj<</OpenAction 2 0 R>>endobj\n%%EOF\n");
    await expect(validateClassworkUpload(upload("active.pdf", "application/pdf", active))).rejects.toThrow(/active or embedded/);
    const compressed = await PDFDocument.create(); compressed.addPage([20, 20]);
    compressed.catalog.set(PDFName.of("OpenAction"), compressed.context.register(compressed.context.obj({ S: PDFName.of("JavaScript"), JS: "synthetic" })));
    const compressedBytes = Buffer.from(await compressed.save({ useObjectStreams: true }));
    expect(compressedBytes.includes(Buffer.from("/OpenAction"))).toBe(false);
    await expect(validateClassworkUpload(upload("compressed-active.pdf", "application/pdf", compressedBytes))).rejects.toThrow(/active or embedded/);
    const plain = Buffer.from(await compressed.save({ useObjectStreams: false }));
    const escaped = Buffer.from(plain.toString("latin1").replaceAll("/OpenAction", "/Open#41ction"), "latin1");
    await expect(validateClassworkUpload(upload("escaped-active.pdf", "application/pdf", escaped))).rejects.toThrow(/active or embedded/);
    await expect(validateClassworkUpload(upload("cut.png", "image/png", png.subarray(0, png.length - 12)))).rejects.toThrow(/truncated/);
  });

  it("rejects HTML, office payloads, animated WebP, excessive dimensions and size bypass", async () => {
    const animatedWebp = Buffer.alloc(30); animatedWebp.write("RIFF", 0); animatedWebp.writeUInt32LE(22, 4); animatedWebp.write("WEBP", 8); animatedWebp.write("VP8X", 12); animatedWebp[20] = 0x02;
    const wide = await sharp({ create: { width: 8001, height: 1, channels: 4, background: "white" } }).png().toBuffer();
    await expect(validateClassworkUpload(upload("page.html", "text/html", Buffer.from("<!doctype html><script/></html>")))).rejects.toThrow(/Only PDF/);
    await expect(validateClassworkUpload(upload("macro.docm", "application/vnd.ms-word.document.macroEnabled.12", Buffer.from("PK\u0003\u0004")))).rejects.toThrow(/Only PDF/);
    await expect(validateClassworkUpload(upload("animated.webp", "image/webp", animatedWebp))).rejects.toThrow(/Animated/);
    await expect(validateClassworkUpload(upload("wide.png", "image/png", wide))).rejects.toThrow(/8000/);
    const oversize = upload("large.png", "image/png", Buffer.from([0x89,0x50,0x4e,0x47]));
    await expect(validateClassworkUpload({ ...oversize, size: 5 * 1024 * 1024 + 1 })).rejects.toThrow(/5 MB/);
  });

  it("enforces private key grammar and attachment quotas", async () => {
    expect(() => resolveStorageKey("../../public/payload.svg")).toThrow(/invalid/);
    expect(() => resolveStorageKey("aa/bb/not-a-uuid.png")).toThrow(/invalid/);
    await expect(assertAttachmentQuota(Array.from({ length: 5 }, () => ({ byteSize: 1 })), 1, "SUBMISSION")).rejects.toThrow(/quota/);
    await expect(assertAttachmentQuota([{ byteSize: 15 * 1024 * 1024 }], 1, "SUBMISSION")).rejects.toThrow(/quota/);
  });

  it("preserves immutable lifecycle, append-only feedback/audit and no hard deletion in SQL", () => {
    const sql = source("prisma/migrations/20260803123000_classwork_secure_submissions/migration.sql");
    for (const trigger of ["ClassworkItemVersion_published_content_immutable", "ClassworkSubmissionVersion_locked_immutable", "ClassworkFeedback_no_update", "ClassworkFeedback_no_delete", "ClassworkAuditEvent_no_update", "ClassworkAuditEvent_no_delete"]) expect(sql).toContain(trigger);
    for (const table of ["ClassworkItem", "ClassworkItemVersion", "ClassworkSubmission", "ClassworkSubmissionVersion", "ClassworkAttachment", "ClassworkFeedback", "ClassworkAuditEvent"]) {
      expect(sql).not.toContain(`DROP TABLE "${table}"`);
    }
    for (const file of ["app/api/classwork/route.ts","app/api/classwork/[publicKey]/publish/route.ts","app/api/my-classwork/[publicKey]/submit/route.ts"]) expect(source(file)).not.toContain("export async function DELETE");
  });

  it("validates linked metadata, immutable evidence and encrypted attachment recovery", () => {
    const rows = classworkRows(); expect(() => validateClassworkBackupRows(rows)).not.toThrow();
    const missingRecovery = structuredClone(rows) as any; delete missingRecovery.classworkAttachments[0].backupArtifactSha256;
    expect(() => validateClassworkBackupRows(missingRecovery)).toThrow(/encrypted recovery evidence/);
    const badLink = structuredClone(rows); badLink.classworkSubmissionVersions[0].itemVersionId = "unrelated";
    expect(() => validateClassworkBackupRows(badLink)).toThrow(/preserved link/);
  });

  it("uses authenticated no-store retrieval without public or PWA paths", () => {
    const route = source("app/api/classwork/attachments/[publicKey]/route.ts"), files = source("lib/classwork-files.ts"), backup = source("lib/classwork-asset-backup.ts");
    expect(route).toContain("requireApiPermission"); expect(route).toContain('"Cache-Control": "private, no-store"'); expect(route).toContain('"Content-Security-Policy": "sandbox; default-src \'none\'"');
    expect(files).toContain('path.join(process.cwd(), "storage", "classwork")'); expect(files).not.toContain("public/"); expect(files).not.toContain("serviceWorker");
    expect(backup).toContain("restoreRoots: [string, string]"); expect(backup).toContain("first.manifestSha256 !== second.manifestSha256"); expect(backup).toContain('row.entry !== row.storageKey');
    for (const encryptedOwnershipField of ["safeDisplayName", "ownerType", "itemPublicKey", "itemVersionPublicKey", "itemVersionNumber", "submissionPublicKey", "submissionVersionPublicKey", "submissionVersionNumber", "ownershipDigest"]) expect(backup).toContain(encryptedOwnershipField);
    expect(backup).toContain("A requested classwork attachment is missing from the encrypted backup set.");
  });
});

function classworkRows() {
  const createdAt = "2026-08-03T10:00:00.000Z";
  return {
    classworkItems: [{ id:"item",publicKey:"item-public",itemNumber:"CW-CLASS23F",kind:"ASSIGNMENT",academicYear:"2026-27",className:"VII",section:"A",subjectName:"Science",timetableSubjectId:"subject",status:"PUBLISHED",currentVersionNumber:1,rowVersion:2,createdByUserId:"teacher",publishedAt:createdAt,createdAt,updatedAt:createdAt }],
    classworkItemVersions: [{ id:"item-version",publicKey:"item-version-public",itemId:"item",versionNumber:1,versionStatus:"PUBLISHED",title:"Worksheet",instructions:"Complete it",publishRequestKey:"CLASS23F_publish_key",createdByUserId:"teacher",publishedByUserId:"teacher",publishedAt:createdAt,createdAt }],
    classworkSubmissions: [{ id:"submission",publicKey:"submission-public",itemId:"item",studentId:"student",status:"SUBMITTED",currentVersionNumber:1,rowVersion:2,createdByUserId:"parent",createdByRole:"PARENT",lastSubmittedByUserId:"parent",lastSubmittedByRole:"PARENT",firstSubmittedAt:createdAt,lastSubmittedAt:createdAt,createdAt,updatedAt:createdAt }],
    classworkSubmissionVersions: [{ id:"submission-version",publicKey:"submission-version-public",submissionId:"submission",itemVersionId:"item-version",versionNumber:1,versionStatus:"SUBMITTED",textBody:"Answer",submissionRequestKey:"CLASS23F_submit_key",createdByUserId:"parent",createdByRole:"PARENT",parentGuardianId:"guardian",submittedAt:createdAt,lockedAt:createdAt,createdAt,updatedAt:createdAt }],
    classworkAttachments: [{ id:"attachment",publicKey:"attachment-public",submissionVersionId:"submission-version",storageKey:"aa/bb/00000000-0000-4000-8000-000000000000.png",safeDisplayName:"Private attachment.png",mediaType:"image/png",extension:".png",byteSize:100,sha256:"a".repeat(64),recoveryStatus:"VERIFIED",backupArtifactSha256:"b".repeat(64),backupKeyVersion:"CLASS23F-K1",backupVerifiedAt:createdAt,createdByUserId:"parent",createdAt }],
    classworkFeedback: [{ id:"feedback",publicKey:"feedback-public",submissionId:"submission",submissionVersionId:"submission-version",sequenceNumber:1,feedbackType:"COMMENT",body:"Please explain step two.",createdByUserId:"teacher",createdByRole:"TEACHER",createdAt }],
    classworkAuditEvents: [{ id:"audit",itemId:"item",submissionId:"submission",eventType:"SUBMITTED",actorUserId:"parent",actorRole:"PARENT",snapshotJson:"{}",occurredAt:createdAt,createdAt }]
  };
}
