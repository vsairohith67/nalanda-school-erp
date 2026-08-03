import type { PrismaClient } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";
import { ClassworkAccessError, isClassworkLeadershipRole, requireClassworkTeacherTarget, requireLearnerAudience, resolveClassworkTeacherScope, type ClassworkLearnerContext } from "@/lib/classwork-access";
import { ClassworkError } from "@/lib/classwork";
import { assertAttachmentQuota, readClassworkFile, rollbackStoredClassworkFile, storeClassworkFile, validateClassworkUpload } from "@/lib/classwork-files";

export async function uploadItemVersionAttachment(client: PrismaClient, versionPublicKey: string, file: File, actor: AuthUser) {
  const version = await client.classworkItemVersion.findUnique({ where: { publicKey: safeKey(versionPublicKey) }, include: { item: true, attachments: { select: { byteSize: true } } } });
  if (!version) throw new ClassworkAccessError();
  await requireStaffScope(client, actor, version.item);
  if (version.versionStatus !== "DRAFT" || version.versionNumber !== version.item.currentVersionNumber || !["DRAFT", "PUBLISHED"].includes(version.item.status)) throw new ClassworkError("Only the current private instruction draft accepts attachments.", 409);
  const validated = await validateClassworkUpload(file);
  await assertAttachmentQuota(version.attachments, validated.byteSize, "ITEM");
  const storageKey = await storeClassworkFile(validated);
  try {
    return await client.classworkAttachment.create({ data: {
      itemVersionId: version.id,
      storageKey,
      safeDisplayName: validated.safeDisplayName,
      mediaType: validated.mediaType,
      extension: validated.extension,
      byteSize: validated.byteSize,
      sha256: validated.sha256,
      width: validated.width,
      height: validated.height,
      createdByUserId: actor.id
    } });
  } catch (error) {
    await rollbackStoredClassworkFile(storageKey);
    throw error;
  }
}

export async function uploadSubmissionAttachment(client: PrismaClient, itemPublicKey: string, file: File, context: ClassworkLearnerContext) {
  const item = await client.classworkItem.findUnique({ where: { publicKey: safeKey(itemPublicKey) } });
  if (!item) throw new ClassworkAccessError();
  requireLearnerAudience(context, item);
  if (item.status !== "PUBLISHED") throw new ClassworkError("This classwork item is closed for submissions.", 409);
  const submission = await client.classworkSubmission.findUnique({ where: { itemId_studentId: { itemId: item.id, studentId: context.studentId } }, include: { versions: { orderBy: { versionNumber: "desc" }, take: 1, include: { attachments: { select: { byteSize: true } } } } } });
  const version = submission?.versions[0];
  if (!submission || submission.status !== "DRAFT" || !version || version.versionStatus !== "DRAFT") throw new ClassworkError("Save a private submission draft before uploading files.", 409);
  const validated = await validateClassworkUpload(file);
  await assertAttachmentQuota(version.attachments, validated.byteSize, "SUBMISSION");
  const storageKey = await storeClassworkFile(validated);
  try {
    return await client.classworkAttachment.create({ data: {
      submissionVersionId: version.id,
      storageKey,
      safeDisplayName: validated.safeDisplayName,
      mediaType: validated.mediaType,
      extension: validated.extension,
      byteSize: validated.byteSize,
      sha256: validated.sha256,
      width: validated.width,
      height: validated.height,
      createdByUserId: context.actorUserId
    } });
  } catch (error) {
    await rollbackStoredClassworkFile(storageKey);
    throw error;
  }
}

export async function retrieveClassworkAttachment(client: PrismaClient, attachmentPublicKey: string, actor: AuthUser, learnerContext?: ClassworkLearnerContext | null) {
  const attachment = await client.classworkAttachment.findUnique({
    where: { publicKey: safeKey(attachmentPublicKey) },
    include: {
      itemVersion: { include: { item: true } },
      submissionVersion: { include: { submission: { include: { item: true } } } }
    }
  });
  if (!attachment) throw new ClassworkAccessError();
  const item = attachment.itemVersion?.item ?? attachment.submissionVersion?.submission.item;
  if (!item) throw new ClassworkAccessError();
  if (isClassworkLeadershipRole(actor.role) || actor.role === "TEACHER") {
    await requireStaffScope(client, actor, item);
  } else {
    if (!learnerContext || (actor.role !== "PARENT" && actor.role !== "STUDENT")) throw new ClassworkAccessError();
    requireLearnerAudience(learnerContext, item);
    if (attachment.submissionVersion && attachment.submissionVersion.submission.studentId !== learnerContext.studentId) throw new ClassworkAccessError();
    if (attachment.itemVersion && (!attachment.itemVersion.publishedAt || !["PUBLISHED", "REPLACED"].includes(attachment.itemVersion.versionStatus))) throw new ClassworkAccessError();
  }
  if (attachment.recoveryStatus !== "VERIFIED" || !attachment.backupVerifiedAt) throw new ClassworkError("The attachment is not released because recovery proof is incomplete.", 409, "ATTACHMENT_RECOVERY_REQUIRED");
  const bytes = await readClassworkFile(attachment.storageKey, attachment.sha256);
  return { bytes, attachment: { safeDisplayName: attachment.safeDisplayName, mediaType: attachment.mediaType, byteSize: attachment.byteSize, sha256: attachment.sha256 } };
}

async function requireStaffScope(client: PrismaClient, actor: AuthUser, item: { academicYear: string; className: string; section: string; subjectName: string; timetableSubjectId: string }) {
  if (isClassworkLeadershipRole(actor.role)) return;
  if (actor.role !== "TEACHER") throw new ClassworkAccessError();
  requireClassworkTeacherTarget(await resolveClassworkTeacherScope(client, actor, item.academicYear), item);
}

function safeKey(value: string) {
  const key = String(value ?? "").trim();
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(key)) throw new ClassworkAccessError();
  return key;
}
