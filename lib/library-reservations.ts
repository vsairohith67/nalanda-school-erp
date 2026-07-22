import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { schoolDateKey } from "@/lib/format";
import { effectiveMemberStatus, parseLibraryDate } from "@/lib/library-members";
import { resolveLibraryPolicy } from "@/lib/library-policies";

function reservationNumber(date: Date) { return `RSV-${schoolDateKey(date).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`; }

export async function createLibraryReservation(client: PrismaClient, input: Record<string, unknown>, actorUserId: string) {
  try {
    return await client.$transaction(async (tx) => {
      const memberId = String(input.memberId ?? ""), titleId = String(input.titleId ?? "");
      const requestedDate = parseLibraryDate(input.requestedDate, "Requested date");
      const [member, title] = await Promise.all([
        tx.libraryMember.findUnique({ where: { id: memberId }, include: { student: { select: { status: true, deletedAt: true } }, staffMember: { select: { status: true } }, _count: { select: { reservations: { where: { status: "WAITING" } } } } } }),
        tx.libraryTitle.findUnique({ where: { id: titleId }, select: { id: true, status: true } })
      ]);
      if (!member) throw new Error("Library member not found"); if (!title || title.status !== "ACTIVE") throw new Error("Only an active library title can be reserved");
      if (effectiveMemberStatus(member, requestedDate) !== "ACTIVE") throw new Error("Only an active library member can reserve a title");
      if (member.memberType === "STUDENT" && (!member.student || member.student.deletedAt || member.student.status.toUpperCase() !== "ACTIVE")) throw new Error("The linked Student is not active");
      if (member.memberType === "STAFF" && (!member.staffMember || member.staffMember.status.toUpperCase() !== "ACTIVE")) throw new Error("The linked StaffMember is not active");
      const { policy } = await resolveLibraryPolicy(tx as any, member.id);
      if (policy.reservationLimit === 0) throw new Error("This member's policy does not permit reservations");
      if (member._count.reservations >= policy.reservationLimit) throw new Error(`Member has reached the ${policy.reservationLimit}-reservation limit`);
      const activeMemberTitleKey = `${memberId}:${titleId}`;
      if (await tx.libraryReservation.findUnique({ where: { activeMemberTitleKey }, select: { reservationNumber: true } })) {
        throw new Error("This member already has an active reservation for the title");
      }
      const reservation = await tx.libraryReservation.create({ data: {
        reservationNumber: reservationNumber(requestedDate), titleId, memberId, status: "WAITING", activeMemberTitleKey,
        requestedDate, expiresDate: input.expiresDate ? parseLibraryDate(input.expiresDate, "Expiry date") : null, createdByUserId: actorUserId
      } });
      if (reservation.expiresDate && reservation.expiresDate < requestedDate) throw new Error("Expiry date cannot be before requested date");
      await tx.libraryLoanEvent.create({ data: { reservationId: reservation.id, memberId, titleId, eventType: "RESERVATION_CREATED", eventDate: requestedDate, recordedByUserId: actorUserId } });
      return reservation;
    });
  } catch (error: any) {
    if (error?.code === "P2002") throw new Error("This member already has an active reservation for the title, or the reservation was created concurrently");
    throw error;
  }
}

async function closeReservation(client: PrismaClient, id: string, status: "CANCELLED" | "EXPIRED", reason: string, actorUserId: string) {
  if (status === "CANCELLED" && !reason.trim()) throw new Error("Cancellation reason is required");
  return client.$transaction(async (tx) => {
    const row = await tx.libraryReservation.findUnique({ where: { id } });
    if (!row || row.status !== "WAITING") throw new Error("Only a waiting reservation can be changed");
    const now = new Date();
    const changed = await tx.libraryReservation.updateMany({ where: { id, status: "WAITING", activeMemberTitleKey: `${row.memberId}:${row.titleId}` }, data: { status, activeMemberTitleKey: null, cancelledAt: status === "CANCELLED" ? now : null, cancellationReason: status === "CANCELLED" ? reason.trim() : null, cancelledByUserId: status === "CANCELLED" ? actorUserId : null } });
    if (changed.count !== 1) throw new Error("Reservation queue changed; refresh and try again");
    await tx.libraryLoanEvent.create({ data: { reservationId: row.id, memberId: row.memberId, titleId: row.titleId, eventType: status === "CANCELLED" ? "RESERVATION_CANCELLED" : "RESERVATION_EXPIRED", eventDate: now, reason: reason.trim() || (status === "EXPIRED" ? "Manually marked expired" : null), recordedByUserId: actorUserId } });
    return tx.libraryReservation.findUniqueOrThrow({ where: { id } });
  });
}

export function cancelLibraryReservation(client: PrismaClient, id: string, reason: string, actorUserId: string) { return closeReservation(client, id, "CANCELLED", reason, actorUserId); }
export function expireLibraryReservation(client: PrismaClient, id: string, actorUserId: string) { return closeReservation(client, id, "EXPIRED", "Manually marked expired", actorUserId); }

export async function libraryReservationQueue(client: PrismaClient, titleId?: string) {
  return client.libraryReservation.findMany({ where: { ...(titleId ? { titleId } : {}) }, include: { title: { select: { titleCode: true, title: true, copies: { select: { status: true, loans: { where: { status: "ISSUED" }, select: { id: true } } } } } }, member: { include: { student: { select: { studentName: true } }, staffMember: { select: { fullName: true } } } } }, orderBy: [{ status: "asc" }, { requestedDate: "asc" }, { createdAt: "asc" }] });
}
