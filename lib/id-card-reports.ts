import type { PrismaClient } from "@prisma/client";
import { effectiveIdentityCardStatus } from "@/lib/identity-cards";
import { schoolDateKey } from "@/lib/format";

export async function identityCardReport(client: PrismaClient) {
  const [cards, versions, batches, events, templates, series, activeStudents, activeStaff] = await Promise.all([
    client.identityCard.findMany({ include: { template: { select: { name: true } }, numberSeries: { select: { seriesCode: true } }, student: { select: { studentName: true, admissionNo: true } }, staffMember: { select: { fullName: true, staffCode: true, designation: true } } } }),
    client.identityCardVersion.findMany(),
    client.identityCardBatch.findMany(),
    client.identityCardEvent.findMany({ select: { eventType: true } }),
    client.identityCardTemplate.findMany({ select: { id: true, name: true } }),
    client.identityCardNumberSeries.findMany({ select: { id: true, seriesCode: true, nextNumber: true } }),
    client.academicYearEnrollment.count({ where: { status: "ACTIVE" } }),
    client.staffMember.count({ where: { status: "ACTIVE" } })
  ]);
  const effective = cards.map((card) => ({ card, status: effectiveIdentityCardStatus(card) }));
  const now = new Date(`${schoolDateKey()}T00:00:00.000Z`).getTime();
  const expiring = (days: number) => effective.filter(({ card, status }) => status === "ACTIVE" && new Date(card.validUntil).getTime() <= now + days * 86400000).length;
  const issuedStudents = new Set(cards.filter((card) => card.cardType === "STUDENT" && card.status === "ISSUED").map((card) => card.studentId));
  const issuedStaff = new Set(cards.filter((card) => card.cardType === "STAFF" && card.status === "ISSUED").map((card) => card.staffMemberId));
  const countBy = (label: string, values: string[]) => Array.from(values.reduce((map, value) => map.set(value || "Not set", (map.get(value || "Not set") ?? 0) + 1), new Map<string, number>())).map(([value, count]) => ({ label, value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  const snapshots = cards.map((card) => { try { return { card, snapshot: JSON.parse(card.draftDataJson) as any }; } catch { return { card, snapshot: {} as any }; } });
  return {
    cards,
    groups: {
      academicYear: countBy("Academic year", cards.map((card) => card.academicYear ?? "Not set")),
      classSection: countBy("Class / section", snapshots.filter(({ card }) => card.cardType === "STUDENT").map(({ snapshot }) => `${snapshot.identity?.className ?? "Not set"} / ${snapshot.identity?.section ?? "Not set"}`)),
      template: countBy("Template", cards.map((card) => card.template.name)),
      numberSeries: countBy("Number series", cards.map((card) => card.numberSeries?.seriesCode ?? "Unallocated draft"))
    },
    summary: {
      total: cards.length,
      student: cards.filter((card) => card.cardType === "STUDENT").length,
      staff: cards.filter((card) => card.cardType === "STAFF").length,
      active: effective.filter((row) => row.status === "ACTIVE").length,
      expired: effective.filter((row) => row.status === "EXPIRED").length,
      revoked: effective.filter((row) => row.status === "REVOKED").length,
      cancelled: effective.filter((row) => row.status === "CANCELLED").length,
      awaitingReview: cards.filter((card) => card.status === "DRAFT").length,
      awaitingApproval: cards.filter((card) => card.status === "READY_FOR_REVIEW").length,
      awaitingIssue: cards.filter((card) => card.status === "APPROVED").length,
      supersededVersions: versions.filter((version) => version.supersedesVersionId).length,
      replacements: cards.filter((card) => card.replacesCardId).length,
      corrections: versions.filter((version) => version.versionType === "CORRECTION").length,
      missingPhotoPlaceholders: cards.length,
      expiring30: expiring(30), expiring60: expiring(60), expiring90: expiring(90),
      activeStudentCoverage: issuedStudents.size,
      activeStudentMissing: Math.max(0, activeStudents - issuedStudents.size),
      activeStaffCoverage: issuedStaff.size,
      activeStaffMissing: Math.max(0, activeStaff - issuedStaff.size),
      lookupEvents: events.filter((event) => event.eventType === "LOOKUP_PERFORMED").length,
      batches: batches.length,
      batchSkipped: batches.reduce((sum, batch) => sum + batch.skippedCount, 0),
      templates: templates.length,
      series: series.length
    }
  };
}

export function formulaSafeCsvCell(value: unknown) {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

export function identityCardCsv(cards: any[]) {
  const rows = cards.map((card) => [
    card.cardNumber ?? "",
    card.cardType,
    card.student?.studentName ?? card.staffMember?.fullName ?? "",
    card.student?.admissionNo ?? card.staffMember?.staffCode ?? "",
    card.staffMember?.designation ?? "",
    card.academicYear ?? "",
    card.status,
    effectiveIdentityCardStatus(card),
    card.validUntil.toISOString().slice(0, 10),
    card.currentVersionNumber
  ].map(formulaSafeCsvCell));
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [["Card Number", "Type", "Name", "School Code", "Designation", "Academic Year", "Stored Status", "Effective Status", "Valid Until", "Version"], ...rows].map((row) => row.map(escape).join(",")).join("\n");
}
