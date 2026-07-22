import type { Prisma, PrismaClient } from "@prisma/client";
import { getSchoolSettings } from "@/lib/school-settings";
import { type IdentityCardType, parseIdentityCardTemplate } from "@/lib/id-card-templates";

type Client = PrismaClient | Prisma.TransactionClient;

export async function buildIdentityCardSourceSnapshot(
  client: Client,
  input: { cardType: IdentityCardType; studentId?: string | null; staffMemberId?: string | null; academicYear?: string | null; validFrom: Date; validUntil: Date },
  template: any
) {
  if (input.validUntil < input.validFrom) throw new Error("Valid-until date cannot precede valid-from date.");
  const settings = await getSchoolSettings(client as PrismaClient);
  const parsedTemplate = parseIdentityCardTemplate(template);
  const enabled = new Set([...parsedTemplate.front.fields, ...parsedTemplate.back.fields]);
  const school = {
    name: settings.schoolName,
    logoPath: settings.logoPath,
    address: `${settings.addressLine1}, ${settings.city}`,
    officeContact: settings.phone
  };
  const common = {
    schemaVersion: 1,
    cardType: input.cardType,
    academicYear: input.academicYear ?? settings.academicYear,
    validFrom: input.validFrom,
    validUntil: input.validUntil,
    school,
    photo: { available: false, placeholder: "Photo not available" },
    returnToSchool: "If found, return to school",
    issuingRole: "Authorised School Officer",
    governmentIdentityDocument: false,
    barcodeAuthentication: false,
    template: { code: template.templateCode, versionNumber: template.versionNumber, definition: parsedTemplate }
  };
  if (input.cardType === "STUDENT") {
    if (!input.studentId || input.staffMemberId) throw new Error("A Student ID card requires exactly one Student.");
    const student = await (client as any).student.findUnique({
      where: { id: input.studentId },
      select: { id: true, admissionNo: true, studentName: true, fatherName: true, motherName: true, dateOfBirth: true, status: true, deletedAt: true, guardians: { orderBy: { isPrimaryContact: "desc" }, take: 1, select: { guardian: { select: { displayName: true } } } } }
    });
    const enrollment = await (client as any).academicYearEnrollment.findUnique({ where: { studentId_academicYear: { studentId: input.studentId, academicYear: common.academicYear } } });
    if (!student || student.deletedAt) throw new Error("Student not found.");
    if (!enrollment || enrollment.status !== "ACTIVE") throw new Error(`Student requires an ACTIVE enrollment for ${common.academicYear}.`);
    return {
      ...common,
      identity: {
        name: student.studentName,
        admissionNumber: student.admissionNo,
        className: enrollment.className,
        section: enrollment.section,
        ...(enabled.has("dateOfBirth") ? { dateOfBirth: student.dateOfBirth } : {}),
        ...(enabled.has("guardianName") ? { guardianName: student.guardians[0]?.guardian.displayName ?? null } : {})
      },
      sourceWarning: student.status.toUpperCase() === "ACTIVE" ? null : `Student master status is ${student.status}; enrollment remains the issuance authority.`
    };
  }
  if (!input.staffMemberId || input.studentId) throw new Error("A Staff ID card requires exactly one StaffMember.");
  const staff = await (client as any).staffMember.findUnique({ where: { id: input.staffMemberId }, select: { id: true, staffCode: true, fullName: true, displayName: true, designation: true, department: true, primarySubject: true, status: true } });
  if (!staff) throw new Error("StaffMember not found.");
  if (staff.status !== "ACTIVE") throw new Error("Staff ID cards require an ACTIVE StaffMember.");
  return {
    ...common,
    identity: {
      name: staff.displayName || staff.fullName,
      staffCode: staff.staffCode,
      designation: staff.designation,
      department: staff.department,
      primarySubject: staff.primarySubject
    },
    sourceWarning: null
  };
}

export function parseIdentityCardSnapshot(value: string) {
  try { return JSON.parse(value); } catch { throw new Error("ID-card snapshot is invalid."); }
}
