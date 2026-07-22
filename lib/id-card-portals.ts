import type { PrismaClient } from "@prisma/client";
import { safeIdentityCardPayload } from "@/lib/identity-cards";

async function publicCard(client: PrismaClient, card: any) {
  const version = await client.identityCardVersion.findUnique({ where: { identityCardId_versionNumber: { identityCardId: card.id, versionNumber: card.currentVersionNumber } } });
  return version ? safeIdentityCardPayload(card, version) : null;
}

export async function parentIdentityCards(client: PrismaClient, user: { id: string; role: string; guardianId?: string | null }, admissionNo?: string | null) {
  if (user.role !== "PARENT" || !user.guardianId) return { children: [], selectedChild: null, cards: [] };
  const links = await client.studentGuardian.findMany({ where: { guardianId: user.guardianId, student: { deletedAt: null } }, select: { student: { select: { id: true, admissionNo: true, studentName: true, className: true, section: true } } }, orderBy: { student: { studentName: "asc" } } });
  const selected = admissionNo ? links.find((row) => row.student.admissionNo === admissionNo)?.student : links[0]?.student;
  if (!selected) return { children: links.map((row) => ({ admissionNo: row.student.admissionNo, studentName: row.student.studentName })), selectedChild: null, cards: [] };
  const row = await client.identityCard.findFirst({ where: { studentId: selected.id, cardType: "STUDENT", status: { in: ["ISSUED", "REVOKED"] }, currentVersionNumber: { gt: 0 } }, orderBy: [{ issuedAt: "desc" }, { createdAt: "desc" }] });
  const payload = row ? await publicCard(client, row) : null;
  const cards = payload ? [payload] : [];
  return { children: links.map((row) => ({ admissionNo: row.student.admissionNo, studentName: row.student.studentName })), selectedChild: { admissionNo: selected.admissionNo, studentName: selected.studentName, className: selected.className, section: selected.section }, cards };
}

export async function teacherIdentityCard(client: PrismaClient, user: { id: string; role: string }) {
  if (user.role !== "TEACHER") return { linked: false, card: null };
  const staff = await client.staffMember.findUnique({ where: { userId: user.id }, select: { id: true, fullName: true, staffCode: true, designation: true } });
  if (!staff) return { linked: false, card: null };
  const row = await client.identityCard.findFirst({ where: { staffMemberId: staff.id, cardType: "STAFF", status: { in: ["ISSUED", "REVOKED"] }, currentVersionNumber: { gt: 0 } }, orderBy: [{ issuedAt: "desc" }, { createdAt: "desc" }] });
  return { linked: true, staff: { name: staff.fullName, staffCode: staff.staffCode, designation: staff.designation }, card: row ? await publicCard(client, row) : null };
}
