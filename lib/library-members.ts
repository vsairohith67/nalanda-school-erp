import type { Prisma, PrismaClient } from "@prisma/client";
import { schoolDateKey } from "@/lib/format";

export const LIBRARY_MEMBER_TYPES = ["STUDENT", "STAFF"] as const;
export const LIBRARY_MEMBER_STATUSES = ["ACTIVE", "SUSPENDED", "INACTIVE"] as const;

type LibraryClient = Pick<PrismaClient | Prisma.TransactionClient, "libraryMember" | "student" | "staffMember">;

export function normalizeMemberCode(value: unknown) {
  const code = String(value ?? "").trim().toUpperCase().replace(/\s+/g, "-");
  if (!/^[A-Z0-9][A-Z0-9._/-]{2,39}$/.test(code)) throw new Error("Member code must be 3-40 letters, numbers, dots, slashes, underscores, or hyphens");
  return code;
}

export function parseLibraryDate(value: unknown, label = "Date") {
  const key = String(value ?? "").trim();
  const match = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error(`${label} must use YYYY-MM-DD`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.toISOString().slice(0, 10) !== key) throw new Error(`${label} must be a valid calendar date`);
  return date;
}

export function effectiveMemberStatus(member: { status: string; suspendedUntil?: Date | null }, now = new Date()) {
  if (member.status === "SUSPENDED" && member.suspendedUntil && schoolDateKey(member.suspendedUntil) < schoolDateKey(now)) return "ACTIVE";
  return member.status;
}

export async function validateMemberLink(client: LibraryClient, input: { memberType: string; studentId?: unknown; staffMemberId?: unknown }) {
  const memberType = String(input.memberType ?? "").toUpperCase();
  if (!LIBRARY_MEMBER_TYPES.includes(memberType as never)) throw new Error("Member type must be STUDENT or STAFF");
  const studentId = String(input.studentId ?? "").trim() || null;
  const staffMemberId = String(input.staffMemberId ?? "").trim() || null;
  if ((studentId ? 1 : 0) + (staffMemberId ? 1 : 0) !== 1) throw new Error("Exactly one Student or StaffMember link is required");
  if (memberType === "STUDENT" && !studentId) throw new Error("A STUDENT membership requires an exact Student link");
  if (memberType === "STAFF" && !staffMemberId) throw new Error("A STAFF membership requires an exact StaffMember link");
  if (studentId) {
    const student = await client.student.findUnique({ where: { id: studentId }, select: { status: true, deletedAt: true, studentName: true, admissionNo: true } });
    if (!student) throw new Error("The selected Student does not exist");
    if (student.deletedAt || student.status.trim().toUpperCase() !== "ACTIVE") throw new Error("Only an active Student can receive an active library membership");
    return { memberType, studentId, staffMemberId: null, linkedLabel: `${student.admissionNo} - ${student.studentName}` };
  }
  const staff = await client.staffMember.findUnique({ where: { id: staffMemberId! }, select: { status: true, fullName: true, staffCode: true } });
  if (!staff) throw new Error("The selected StaffMember does not exist");
  if (staff.status.trim().toUpperCase() !== "ACTIVE") throw new Error("Only an active StaffMember can receive an active library membership");
  return { memberType, studentId: null, staffMemberId, linkedLabel: `${staff.staffCode ?? "Staff"} - ${staff.fullName}` };
}

export async function createLibraryMember(client: LibraryClient, input: Record<string, unknown>, actorUserId: string) {
  const link = await validateMemberLink(client, { memberType: String(input.memberType ?? ""), studentId: input.studentId, staffMemberId: input.staffMemberId });
  const status = String(input.status ?? "ACTIVE").toUpperCase();
  if (!LIBRARY_MEMBER_STATUSES.includes(status as never)) throw new Error("Unsupported membership status");
  if (status === "SUSPENDED" && !String(input.suspensionReason ?? "").trim()) throw new Error("Suspension reason is required");
  return client.libraryMember.create({ data: {
    memberCode: normalizeMemberCode(input.memberCode), memberType: link.memberType,
    studentId: link.studentId, staffMemberId: link.staffMemberId, status,
    joinedDate: parseLibraryDate(input.joinedDate, "Joined date"),
    suspendedUntil: input.suspendedUntil ? parseLibraryDate(input.suspendedUntil, "Suspended until") : null,
    suspensionReason: String(input.suspensionReason ?? "").trim() || null,
    notes: String(input.notes ?? "").trim() || null, createdByUserId: actorUserId, updatedByUserId: actorUserId
  } });
}

export async function changeLibraryMemberStatus(client: LibraryClient, id: string, input: Record<string, unknown>, actorUserId: string) {
  const status = String(input.status ?? "").toUpperCase();
  if (!LIBRARY_MEMBER_STATUSES.includes(status as never)) throw new Error("Unsupported membership status");
  const reason = String(input.reason ?? "").trim();
  if (status === "SUSPENDED" && !reason) throw new Error("Suspension reason is required");
  const member = await client.libraryMember.findUnique({ where: { id } });
  if (!member) throw new Error("Library member not found");
  return client.libraryMember.update({ where: { id }, data: {
    status, suspendedUntil: status === "SUSPENDED" && input.suspendedUntil ? parseLibraryDate(input.suspendedUntil, "Suspended until") : null,
    suspensionReason: status === "SUSPENDED" ? reason : null, updatedByUserId: actorUserId
  } });
}

export function safeMemberLabel(member: any, masked = false) {
  if (masked) return `${member.memberType === "STUDENT" ? "Student" : "Staff"} ${member.memberCode.slice(0, 3)}***`;
  return member.student ? `${member.memberCode} - ${member.student.studentName}` : `${member.memberCode} - ${member.staffMember?.fullName ?? "Staff member"}`;
}

export const libraryMemberInclude = {
  student: { select: { studentName: true, admissionNo: true, status: true, className: true, section: true } },
  staffMember: { select: { fullName: true, staffCode: true, status: true, staffType: true, designation: true } },
  _count: { select: { loans: { where: { status: "ISSUED" } }, reservations: { where: { status: "WAITING" } } } }
} satisfies Prisma.LibraryMemberInclude;
