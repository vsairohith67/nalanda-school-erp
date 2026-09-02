import type { Prisma } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";
import { applyHumanApprovedOcrAdmissionFieldsInTransaction } from "@/lib/admissions";
import {
  AuthoritativeRecordConflictError,
  updateGuardianRecord,
  updateStaffRecord,
  updateStudentRecord
} from "@/lib/authoritative-record-services";
import { OcrScanningError, type OcrContextType } from "@/lib/ocr-scanning/contracts";

export type OcrTargetSnapshot = {
  contextType: OcrContextType;
  contextId: string;
  version: string;
  displayReference: string;
  currentValues: Record<string, string | null>;
};

function isoDate(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}

export async function loadOcrTargetSnapshot(
  client: Prisma.TransactionClient,
  contextType: OcrContextType,
  contextId: string
): Promise<OcrTargetSnapshot> {
  if (contextType === "ADMISSION") {
    const row = await client.admissionApplication.findUnique({
      where: { publicKey: contextId },
      include: { child: true, guardians: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], take: 1 } }
    });
    if (!row?.child || !row.guardians[0]) throw new OcrScanningError("OCR_TARGET_NOT_READY", 409);
    return {
      contextType,
      contextId,
      version: String(row.rowVersion),
      displayReference: row.applicationNumber,
      currentValues: {
        applicationNumber: row.applicationNumber,
        fullName: row.child.fullName,
        dateOfBirth: isoDate(row.child.dateOfBirth),
        desiredClass: row.child.desiredClass,
        previousSchool: row.child.previousSchool,
        guardianName: row.guardians[0].displayName,
        guardianPhone: row.guardians[0].contactMethod === "PHONE" ? row.guardians[0].contactValue : null
      }
    };
  }
  if (contextType === "STUDENT") {
    const row = await client.student.findFirst({ where: { id: contextId, deletedAt: null } });
    if (!row) throw new OcrScanningError("OCR_TARGET_NOT_FOUND", 404);
    return {
      contextType,
      contextId,
      version: row.updatedAt.toISOString(),
      displayReference: row.admissionNo,
      currentValues: {
        admissionNo: row.admissionNo, studentName: row.studentName, dateOfBirth: isoDate(row.dateOfBirth),
        className: row.className, fatherName: row.fatherName, motherName: row.motherName,
        phone1: row.phone1, address: row.address
      }
    };
  }
  if (contextType === "GUARDIAN") {
    const row = await client.guardian.findUnique({ where: { id: contextId } });
    if (!row) throw new OcrScanningError("OCR_TARGET_NOT_FOUND", 404);
    return {
      contextType,
      contextId,
      version: row.updatedAt.toISOString(),
      displayReference: row.id,
      currentValues: {
        displayName: row.displayName, primaryMobile: row.primaryMobile, alternateMobile: row.alternateMobile,
        email: row.email, relationship: row.relationship
      }
    };
  }
  const row = await client.staffMember.findUnique({ where: { id: contextId } });
  if (!row) throw new OcrScanningError("OCR_TARGET_NOT_FOUND", 404);
  return {
    contextType,
    contextId,
    version: row.updatedAt.toISOString(),
    displayReference: row.staffCode ?? row.id,
    currentValues: {
      staffCode: row.staffCode, fullName: row.fullName, mobile: row.mobile, email: row.email,
      address: row.address, designation: row.designation
    }
  };
}

function normalizedDate(value: string) {
  const match = value.trim().match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (!match) return value;
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function ensureIdentity(field: string, supplied: string | undefined, current: string | null) {
  if (supplied && supplied !== current) throw new OcrScanningError("OCR_TARGET_IDENTITY_MISMATCH", 409);
}

export async function applyHumanApprovedOcrValues(input: {
  client: Prisma.TransactionClient;
  contextType: OcrContextType;
  contextId: string;
  expectedVersion: string;
  values: Record<string, string>;
  actor: AuthUser;
}) {
  try {
    if (input.contextType === "ADMISSION") {
      const version = Number(input.expectedVersion);
      if (!Number.isSafeInteger(version) || version < 1) throw new OcrScanningError("OCR_TARGET_VERSION_INVALID", 409);
      return applyHumanApprovedOcrAdmissionFieldsInTransaction(input.client, input.contextId, input.values, version, input.actor);
    }
    const snapshot = await loadOcrTargetSnapshot(input.client, input.contextType, input.contextId);
    if (snapshot.version !== input.expectedVersion) throw new OcrScanningError("OCR_TARGET_STALE", 409);
    if (input.contextType === "STUDENT") {
      ensureIdentity("admissionNo", input.values.admissionNo, snapshot.currentValues.admissionNo);
      const { admissionNo: _identity, ...changes } = input.values;
      if (changes.dateOfBirth) changes.dateOfBirth = normalizedDate(changes.dateOfBirth);
      const row = await updateStudentRecord(input.client, input.contextId, changes, input.expectedVersion);
      return { service: "STUDENTS", reference: row.id, version: row.updatedAt.toISOString(), appliedAt: row.updatedAt };
    }
    if (input.contextType === "GUARDIAN") {
      const row = await updateGuardianRecord(input.client, input.contextId, input.values, input.expectedVersion);
      return { service: "GUARDIANS", reference: row.id, version: row.updatedAt.toISOString(), appliedAt: row.updatedAt };
    }
    ensureIdentity("staffCode", input.values.staffCode, snapshot.currentValues.staffCode);
    const { staffCode: _identity, ...changes } = input.values;
    const row = await updateStaffRecord(input.client, input.contextId, changes, input.expectedVersion);
    return { service: "STAFF", reference: row.id, version: row.updatedAt.toISOString(), appliedAt: row.updatedAt };
  } catch (error) {
    if (error instanceof AuthoritativeRecordConflictError) throw new OcrScanningError("OCR_TARGET_STALE", 409);
    throw error;
  }
}
