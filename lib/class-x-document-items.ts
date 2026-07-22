import type { PrismaClient } from "@prisma/client";
import { recomputeClassXPackage } from "@/lib/class-x-document-packages";

const SCHOOL_TYPE_MAP: Record<string, string> = {
  TRANSFER_CERTIFICATE: "TRANSFER",
  STUDY_CERTIFICATE: "STUDY",
  CONDUCT_CERTIFICATE: "CONDUCT",
  BONAFIDE_CERTIFICATE: "BONAFIDE"
};

function text(value: unknown, label: string, max: number, required = true) {
  const result = String(value ?? "").trim();
  if ((required && !result) || result.length > max) throw new Error(`${label} ${required ? "is required and " : ""}must be at most ${max} characters`);
  return result || null;
}

function safeReference(value: unknown, required = false) {
  const result = text(value, "External reference", 80, required);
  if (result && !/^[A-Za-z0-9][A-Za-z0-9 ._\/()#:-]{0,79}$/.test(result)) throw new Error("External reference contains unsupported characters");
  return result;
}

function date(value: unknown, label: string, required = false) {
  if (!value && !required) return null;
  const result = new Date(`${text(value, label, 10)!}T00:00:00.000Z`);
  if (Number.isNaN(result.getTime())) throw new Error(`${label} is invalid`);
  return result;
}

export async function linkSchoolCertificate(client: PrismaClient, packageId: string, itemId: string, input: Record<string, unknown>, actorId: string) {
  return client.$transaction(async (tx) => {
    const item = await tx.classXPackageDocumentItem.findFirst({ where: { id: itemId, packageId }, include: { package: true } });
    if (!item || item.issuerType !== "SCHOOL") throw new Error("School-issued package item was not found");
    if (item.status === "HANDED_OVER") throw new Error("A handed-over document link is immutable");
    const expectedType = SCHOOL_TYPE_MAP[item.itemType];
    if (!expectedType) throw new Error("This item is not a supported Prompt 18A school certificate type");
    const certificateId = text(input.certificateId, "Certificate", 80)!;
    const certificate = await tx.studentCertificate.findUnique({ where: { id: certificateId } });
    if (!certificate || certificate.studentId !== item.package.studentId) throw new Error("Certificate does not belong to the exact package Student");
    if (certificate.certificateType !== expectedType) throw new Error(`Certificate type must be ${expectedType}`);
    if (certificate.status !== "ISSUED" || certificate.currentVersionNumber < 1) throw new Error("Only an issued, non-cancelled Prompt 18A certificate can be linked");
    const selectedVersion = Number(String(input.versionNumber ?? "").trim() || certificate.currentVersionNumber);
    if (!Number.isInteger(selectedVersion) || selectedVersion < 1) throw new Error("Certificate version is invalid");
    const version = await tx.studentCertificateVersion.findUnique({ where: { certificateId_versionNumber: { certificateId, versionNumber: selectedVersion } } });
    if (!version) throw new Error("Selected immutable certificate version was not found");
    const warning = selectedVersion === certificate.currentVersionNumber ? null : `Historical version ${selectedVersion} was intentionally selected; current version is ${certificate.currentVersionNumber}.`;
    const changed = await tx.classXPackageDocumentItem.updateMany({
      where: { id: itemId, packageId, status: item.status, updatedAt: item.updatedAt },
      data: { status: "READY_FOR_HANDOVER", linkedStudentCertificateId: certificate.id, linkedStudentCertificateVersionId: version.id, sourceNotes: warning }
    });
    if (changed.count !== 1) throw new Error("Document item changed during linking; refresh and try again");
    await tx.classXPackageEvent.create({ data: { packageId, documentItemId: itemId, eventType: "SCHOOL_CERTIFICATE_LINKED", previousStatus: item.status, newStatus: "READY_FOR_HANDOVER", notes: warning, recordedByUserId: actorId } });
    await recomputeClassXPackage(tx, packageId);
    return { item: await tx.classXPackageDocumentItem.findUniqueOrThrow({ where: { id: itemId } }), warning };
  });
}

export async function updateBoardDocument(client: PrismaClient, packageId: string, itemId: string, action: "request" | "receive" | "verify" | "not_applicable", input: Record<string, unknown>, actorId: string) {
  return client.$transaction(async (tx) => {
    const item = await tx.classXPackageDocumentItem.findFirst({ where: { id: itemId, packageId }, include: { package: true } });
    if (!item || item.issuerType === "SCHOOL") throw new Error("Board/external custody item was not found");
    if (["HANDED_OVER", "CANCELLED"].includes(item.status)) throw new Error("This custody record is immutable in its current state");
    let data: Record<string, unknown>, eventType: string, next: string, reason: string | null = null;
    if (action === "request") {
      if (!["NOT_STARTED", "REQUESTED", "AWAITING_BOARD"].includes(item.status)) throw new Error("Only a not-started or awaiting item can record a request");
      next = "AWAITING_BOARD"; eventType = "DOCUMENT_ITEM_UPDATED";
      data = { status: next, requestDate: date(input.requestDate, "Request date", true), authorityName: text(input.authorityName, "Board or authority name", 120)!, externalDocumentReference: safeReference(input.externalDocumentReference), publicNotes: text(input.publicNotes, "Public notes", 500, false), sourceNotes: text(input.sourceNotes, "Internal source notes", 1000, false) };
    } else if (action === "receive") {
      if (!["REQUESTED", "AWAITING_BOARD"].includes(item.status)) throw new Error("Only a requested or awaiting Board document can be received");
      next = "RECEIVED"; eventType = "BOARD_DOCUMENT_RECEIVED";
      data = { status: next, receivedDate: date(input.receivedDate, "Received date", true), externalIssueDate: date(input.externalIssueDate, "External issue date"), authorityName: text(input.authorityName ?? item.authorityName, "Board or authority name", 120)!, externalDocumentReference: safeReference(input.externalDocumentReference ?? item.externalDocumentReference, item.serialNumberRequired), sourceNotes: text(input.sourceNotes, "Safe verification notes", 1000, false) };
    } else if (action === "verify") {
      if (!["RECEIVED", "UNDER_VERIFICATION"].includes(item.status)) throw new Error("Only a received Board document can be verified");
      next = "READY_FOR_HANDOVER"; eventType = "BOARD_DOCUMENT_VERIFIED";
      data = { status: next, verifiedDate: date(input.verifiedDate, "Verified date", true), verifiedByUserId: actorId, sourceNotes: text(input.sourceNotes, "Safe verification notes", 1000, false) };
    } else {
      reason = text(input.reason, "Not-applicable reason", 1000)!;
      if (item.required) throw new Error("A required item cannot be silently marked not applicable");
      next = "NOT_APPLICABLE"; eventType = "DOCUMENT_ITEM_UPDATED"; data = { status: next, notApplicableReason: reason };
    }
    const changed = await tx.classXPackageDocumentItem.updateMany({ where: { id: itemId, packageId, status: item.status, updatedAt: item.updatedAt }, data });
    if (changed.count !== 1) throw new Error("Document item changed during this action; refresh and try again");
    await tx.classXPackageEvent.create({ data: { packageId, documentItemId: itemId, eventType, previousStatus: item.status, newStatus: next, reason, recordedByUserId: actorId } });
    await recomputeClassXPackage(tx, packageId);
    return tx.classXPackageDocumentItem.findUniqueOrThrow({ where: { id: itemId } });
  });
}

export function parentDocumentStatus(status: string) {
  return ({ NOT_STARTED: "Not started", REQUESTED: "Requested", AWAITING_SCHOOL_ISSUE: "School certificate in progress", AWAITING_BOARD: "Awaiting Board", RECEIVED: "Received by School", UNDER_VERIFICATION: "Received by School", VERIFIED: "Ready for Collection", READY_FOR_HANDOVER: "Ready for Collection", HANDED_OVER: "Handed Over", NOT_APPLICABLE: "Not applicable", REJECTED: "Under school review", CANCELLED: "Cancelled" } as Record<string, string>)[status] ?? "In progress";
}
