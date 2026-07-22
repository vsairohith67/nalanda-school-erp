import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { schoolDateKey } from "@/lib/format";
import { CLASS_X_PACKAGE_TYPE, validateClassXTemplateDefinition, validateClassXTemplateSnapshot } from "@/lib/class-x-package-templates";
import { newChargeData, resolveClassXChargeRule } from "@/lib/class-x-package-payments";

export const CLASS_X_PACKAGE_STATUSES = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "DOCUMENTS_PENDING", "PAYMENT_PENDING", "READY_FOR_APPROVAL", "APPROVED", "READY_FOR_HANDOVER", "PARTIALLY_HANDED_OVER", "COMPLETED", "CANCELLED"] as const;
export const CLASS_X_REQUEST_SOURCES = ["INTERNAL", "PARENT_PORTAL"] as const;
export const CLASS_X_ACTIVE_PACKAGE_STATUSES = CLASS_X_PACKAGE_STATUSES.filter((status) => !["COMPLETED", "CANCELLED"].includes(status));
export const CLASS_X_POST_APPROVAL_CANCEL_STATUSES = ["APPROVED", "READY_FOR_HANDOVER"] as const;

function requiredText(value: unknown, label: string, max = 2000) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} is required`);
  if (text.length > max) throw new Error(`${label} must be at most ${max} characters`);
  return text;
}

function optionalText(value: unknown, label: string, max = 2000) {
  const text = String(value ?? "").trim();
  if (text.length > max) throw new Error(`${label} must be at most ${max} characters`);
  return text || null;
}

function isClassX(value: string) {
  return ["10", "X", "CLASS 10", "CLASS X", "10TH", "TENTH"].includes(value.trim().toUpperCase().replace(/\s+/g, " "));
}

function packageNumber(date = new Date(), qaPrefix = false) {
  return `${qaPrefix ? "QA18B-" : ""}CXP-${schoolDateKey(date).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function buildClassXEligibilitySnapshot(client: PrismaClient | Prisma.TransactionClient, studentId: string, academicYear: string) {
  const student = await client.student.findFirst({ where: { id: studentId, deletedAt: null }, select: { id: true, admissionNo: true, studentName: true, className: true, section: true, status: true } });
  if (!student) throw new Error("Selected Student was not found");
  const [enrollments, lifecycle, progression, reportCards, certificates] = await Promise.all([
    client.academicYearEnrollment.findMany({ where: { studentId }, select: { id: true, academicYear: true, className: true, section: true, status: true, enrollmentDate: true, exitDate: true }, orderBy: { academicYear: "desc" } }),
    client.studentLifecycleEvent.findMany({ where: { studentId }, select: { eventType: true, academicYear: true, effectiveDate: true, toStatus: true }, orderBy: { effectiveDate: "desc" }, take: 20 }),
    client.studentProgressionDecision.findMany({ where: { studentId, status: "FINALIZED" }, select: { academicYear: true, decisionType: true, fromClass: true, toClass: true, effectiveDate: true }, orderBy: { effectiveDate: "desc" }, take: 10 }),
    client.studentReportCard.findMany({ where: { studentId, status: "ISSUED" }, select: { reportCardNumber: true, academicYear: true, className: true, currentVersionNumber: true }, orderBy: { issuedAt: "desc" }, take: 10 }),
    client.studentCertificate.findMany({ where: { studentId, status: "ISSUED" }, select: { id: true, certificateType: true, certificateNumber: true, currentVersionNumber: true, issuedAt: true }, orderBy: { issuedAt: "desc" } })
  ]);
  const classXEnrollments = enrollments.filter((row) => isClassX(row.className));
  const source = classXEnrollments.find((row) => row.academicYear === academicYear) ?? null;
  if (!source) throw new Error(`An exact Class X enrollment for ${academicYear} is required. Another year's enrollment and marks do not establish eligibility for this package`);
  return {
    sourceStatus: "EXACT_YEAR_CLASS_X_ENROLLMENT",
    student: { admissionNo: student.admissionNo, studentName: student.studentName, currentClass: student.className, currentSection: student.section, lifecycleStatus: student.status },
    classXEnrollment: { academicYear: source.academicYear, className: source.className, section: source.section, status: source.status, enrollmentDate: source.enrollmentDate, exitDate: source.exitDate },
    lifecycle, progression, issuedReportCards: reportCards, issuedSchoolCertificates: certificates,
    boardEligibilityClaimed: false, warnings: [
      "The ERP confirms only the available Class X source record; it does not determine Board eligibility or pass status.",
      "This read-only snapshot does not change enrollment, lifecycle, progression, marks, report cards, or fee dues."
    ]
  };
}

export async function createClassXPackage(client: PrismaClient, input: Record<string, unknown>, actor: { id: string; source: "INTERNAL" | "PARENT_PORTAL"; guardianId?: string | null }) {
  const studentId = requiredText(input.studentId, "Student", 80);
  const academicYear = requiredText(input.academicYear, "Academic year", 20);
  const templateId = requiredText(input.templateId, "Template", 80);
  const purpose = optionalText(input.purpose, "Purpose", 500);
  return client.$transaction(async (tx) => {
    if (actor.source === "PARENT_PORTAL") {
      if (!actor.guardianId) throw new Error("Parent account is not linked to a Guardian");
      const owned = await tx.studentGuardian.findUnique({ where: { guardianId_studentId: { guardianId: actor.guardianId, studentId } } });
      if (!owned) throw new Error("This Student is not linked to the signed-in Parent");
    }
    const duplicate = await tx.classXDocumentPackage.findFirst({
      where: { studentId, academicYear, packageType: CLASS_X_PACKAGE_TYPE, status: { in: [...CLASS_X_ACTIVE_PACKAGE_STATUSES] } },
      select: { packageNumber: true }
    });
    if (duplicate) throw new Error(`An active Class X package already exists for this Student and academic year (${duplicate.packageNumber})`);
    const template = await tx.classXPackageTemplate.findUnique({ where: { id: templateId } });
    if (!template || template.status !== "ACTIVE") throw new Error("Only an active Class X package template can create a package");
    const definition = validateClassXTemplateDefinition(template.documentDefinitionJson);
    const eligibility = await buildClassXEligibilitySnapshot(tx as never, studentId, academicYear);
    const rule = await resolveClassXChargeRule(tx as never, academicYear, new Date(), template.defaultChargeRuleId);
    if (template.paymentRequired && (!rule || !rule.paymentRequired)) throw new Error("This template requires payment but no single active required charge rule applies");
    const now = new Date();
    const initialStatus = actor.source === "PARENT_PORTAL" ? "SUBMITTED" : "DRAFT";
    const pkg = await tx.classXDocumentPackage.create({ data: {
      packageNumber: packageNumber(now, eligibility.student.admissionNo.startsWith("QA18B-")), packageType: CLASS_X_PACKAGE_TYPE, studentId, academicYear, templateId,
      status: initialStatus, requestSource: actor.source, applicantGuardianId: actor.source === "PARENT_PORTAL" ? actor.guardianId : null,
      purpose, templateSnapshotJson: JSON.stringify({ templateCode: template.templateCode, name: template.name, versionNumber: template.versionNumber, schoolBoard: template.schoolBoard, instructions: template.instructions, ...definition }),
      eligibilitySnapshotJson: JSON.stringify(eligibility), paymentRequired: template.paymentRequired,
      totalRequiredItems: definition.documents.filter((item) => item.required).length,
      internalNotes: optionalText(input.internalNotes, "Internal notes", 2000), publicNotes: optionalText(input.publicNotes, "Public notes", 1000),
      createdByUserId: actor.id, submittedAt: initialStatus === "SUBMITTED" ? now : null,
      items: { create: definition.documents.map((item) => ({ ...item })) },
      charge: { create: newChargeData(rule, template.paymentRequired, eligibility.student.admissionNo.startsWith("QA18B-")) },
      events: { create: [
        { eventType: "PACKAGE_CREATED", newStatus: initialStatus, recordedByUserId: actor.id },
        ...(initialStatus === "SUBMITTED" ? [{ eventType: "PACKAGE_SUBMITTED", previousStatus: "DRAFT", newStatus: "SUBMITTED", recordedByUserId: actor.id }] : [])
      ] }
    }, include: { items: true, charge: true } });
    return pkg;
  });
}

export async function recomputeClassXPackage(client: Prisma.TransactionClient, packageId: string) {
  const pkg = await client.classXDocumentPackage.findUnique({ where: { id: packageId }, include: { items: true, charge: true } });
  if (!pkg) throw new Error("Class X package not found");
  const readyItems = pkg.items.filter((item) => item.status === "READY_FOR_HANDOVER").length;
  const handedOverItems = pkg.items.filter((item) => item.status === "HANDED_OVER").length;
  const unresolvedRequired = pkg.items.filter((item) => item.required && !["READY_FOR_HANDOVER", "HANDED_OVER", "NOT_APPLICABLE"].includes(item.status));
  const paymentResolved = !pkg.paymentRequired || ["PAID", "WAIVED", "NOT_REQUIRED"].includes(pkg.charge?.status ?? "");
  let status = pkg.status;
  if (["UNDER_REVIEW", "DOCUMENTS_PENDING", "PAYMENT_PENDING", "READY_FOR_APPROVAL"].includes(status)) {
    status = unresolvedRequired.length ? "DOCUMENTS_PENDING" : paymentResolved ? "READY_FOR_APPROVAL" : "PAYMENT_PENDING";
  }
  await client.classXDocumentPackage.update({ where: { id: packageId }, data: { readyItems, handedOverItems, status } });
  return { readyItems, handedOverItems, unresolvedRequired, paymentResolved, status };
}

export async function transitionClassXPackage(client: PrismaClient, id: string, action: "submit" | "review" | "approve" | "complete" | "cancel", actorId: string, input: Record<string, unknown> = {}) {
  return client.$transaction(async (tx) => {
    const pkg = await tx.classXDocumentPackage.findUnique({ where: { id }, include: { items: true, charge: true } });
    if (!pkg) throw new Error("Class X package not found");
    const expected = input.expectedUpdatedAt ? new Date(String(input.expectedUpdatedAt)) : pkg.updatedAt;
    if (action === "submit") {
      if (pkg.status === "SUBMITTED") return pkg;
      if (pkg.status !== "DRAFT") throw new Error("Only a draft package can be submitted");
      await cas(tx, pkg, expected, "SUBMITTED", { submittedAt: new Date() });
      await event(tx, id, "PACKAGE_SUBMITTED", "DRAFT", "SUBMITTED", actorId);
    } else if (action === "review") {
      if (pkg.status === "UNDER_REVIEW") return pkg;
      if (pkg.status !== "SUBMITTED") throw new Error("Only a submitted package can start review");
      await cas(tx, pkg, expected, "UNDER_REVIEW", { reviewedByUserId: actorId, reviewedAt: new Date() });
      await event(tx, id, "REVIEW_STARTED", "SUBMITTED", "UNDER_REVIEW", actorId);
      await recomputeClassXPackage(tx, id);
    } else if (action === "approve") {
      if (["APPROVED", "READY_FOR_HANDOVER", "PARTIALLY_HANDED_OVER"].includes(pkg.status)) return pkg;
      if (!["UNDER_REVIEW", "DOCUMENTS_PENDING", "PAYMENT_PENDING", "READY_FOR_APPROVAL"].includes(pkg.status)) throw new Error("Package is not in an approvable review state");
      const definition = validateClassXTemplateSnapshot(pkg.templateSnapshotJson);
      const unresolved = pkg.items.filter((item) => item.required && !["READY_FOR_HANDOVER", "HANDED_OVER", "NOT_APPLICABLE"].includes(item.status));
      const allowedWaiting = definition.allowPartialApprovalWhileAwaitingBoard && unresolved.every((item) => item.issuerType !== "SCHOOL" && ["REQUESTED", "AWAITING_BOARD"].includes(item.status));
      if (unresolved.length && !allowedWaiting) throw new Error("All mandatory document readiness checks must be resolved before approval");
      if (pkg.paymentRequired && !["PAID", "WAIVED", "NOT_REQUIRED"].includes(pkg.charge?.status ?? "")) throw new Error("Required package charge must be paid or waived before approval");
      const next = pkg.items.some((item) => item.status === "READY_FOR_HANDOVER") ? "READY_FOR_HANDOVER" : "APPROVED";
      await cas(tx, pkg, expected, next, { approvedByUserId: actorId, approvedAt: new Date() });
      await event(tx, id, "PACKAGE_APPROVED", pkg.status, next, actorId);
    } else if (action === "complete") {
      if (pkg.status === "COMPLETED") return pkg;
      if (!["READY_FOR_HANDOVER", "PARTIALLY_HANDED_OVER", "APPROVED"].includes(pkg.status)) throw new Error("Package is not ready for completion");
      const unresolved = pkg.items.filter((item) => item.required && !["HANDED_OVER", "NOT_APPLICABLE"].includes(item.status));
      if (unresolved.length) throw new Error("Every required document must be handed over or explicitly resolved before completion");
      await cas(tx, pkg, expected, "COMPLETED", { completedByUserId: actorId, completedAt: new Date() });
      await event(tx, id, "PACKAGE_COMPLETED", pkg.status, "COMPLETED", actorId);
    } else {
      if (pkg.status === "CANCELLED") return pkg;
      if (pkg.status === "COMPLETED") throw new Error("A completed package cannot be cancelled");
      if (pkg.status === "PARTIALLY_HANDED_OVER") throw new Error("A partially handed-over package cannot be cancelled; use an authorised compensating closure");
      if ((CLASS_X_POST_APPROVAL_CANCEL_STATUSES as readonly string[]).includes(pkg.status) && input.postApprovalAuthorized !== true) {
        throw new Error("Post-approval package cancellation requires approval authority");
      }
      const reason = requiredText(input.reason, "Cancellation reason", 1000);
      await cas(tx, pkg, expected, "CANCELLED", { cancellationReason: reason, cancelledByUserId: actorId, cancelledAt: new Date() });
      await event(tx, id, "PACKAGE_CANCELLED", pkg.status, "CANCELLED", actorId, reason);
    }
    return tx.classXDocumentPackage.findUniqueOrThrow({ where: { id }, include: { items: true, charge: true } });
  });
}

async function cas(tx: Prisma.TransactionClient, pkg: any, expected: Date, status: string, data: Record<string, unknown>) {
  const changed = await tx.classXDocumentPackage.updateMany({ where: { id: pkg.id, status: pkg.status, updatedAt: expected }, data: { status, ...data } });
  if (changed.count !== 1) throw new Error("Package changed while this action was processed; refresh and try again");
}

async function event(tx: Prisma.TransactionClient, packageId: string, eventType: string, previousStatus: string | null, newStatus: string | null, actorId: string, reason?: string) {
  await tx.classXPackageEvent.create({ data: { packageId, eventType, previousStatus, newStatus, recordedByUserId: actorId, reason } });
}

export function parseClassXSnapshot(value: string) { try { return JSON.parse(value); } catch { return {}; } }

export function safeClassXPackage(row: any) {
  return {
    packageNumber: row.packageNumber, status: row.status, academicYear: row.academicYear, requestSource: row.requestSource,
    purpose: row.purpose, paymentRequired: row.paymentRequired, totalRequiredItems: row.totalRequiredItems,
    readyItems: row.readyItems, handedOverItems: row.handedOverItems, publicNotes: row.publicNotes,
    submittedAt: row.submittedAt, reviewedAt: row.reviewedAt, approvedAt: row.approvedAt, completedAt: row.completedAt, cancelledAt: row.cancelledAt
  };
}
