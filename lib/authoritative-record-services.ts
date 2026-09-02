import type { Prisma, PrismaClient } from "@prisma/client";
import { validateGuardianPayload } from "@/lib/guardians";
import { validateStaffInput } from "@/lib/staff";
import { validateStudentPayload } from "@/lib/validation";

type AuthoritativeClient = Pick<PrismaClient | Prisma.TransactionClient, "student" | "guardian" | "staffMember">;

export class AuthoritativeRecordConflictError extends Error {
  readonly code = "AUTHORITATIVE_RECORD_STALE";
  constructor() {
    super("The authoritative record changed. Refresh and review it again.");
    this.name = "AuthoritativeRecordConflictError";
  }
}

function sameVersion(observed: Date, expected?: string) {
  return !expected || observed.toISOString() === expected;
}

export async function createStudentRecord(client: AuthoritativeClient, body: Record<string, unknown>) {
  return client.student.create({ data: validateStudentPayload(body) });
}

export async function updateStudentRecord(client: AuthoritativeClient, id: string, body: Record<string, unknown>, expectedUpdatedAt?: string) {
  const current = await client.student.findFirst({ where: { id, deletedAt: null } });
  if (!current) throw new Error("Student not found");
  if (!sameVersion(current.updatedAt, expectedUpdatedAt)) throw new AuthoritativeRecordConflictError();
  const data = validateStudentPayload({ ...current, ...body, dateOfBirth: body.dateOfBirth ?? current.dateOfBirth?.toISOString() ?? null });
  if (!expectedUpdatedAt) return client.student.update({ where: { id }, data });
  const changed = await client.student.updateMany({ where: { id, updatedAt: current.updatedAt, deletedAt: null }, data });
  if (changed.count !== 1) throw new AuthoritativeRecordConflictError();
  return client.student.findUniqueOrThrow({ where: { id } });
}

export async function createGuardianRecord(client: AuthoritativeClient, body: Record<string, unknown>) {
  return client.guardian.create({ data: validateGuardianPayload(body) });
}

export async function updateGuardianRecord(client: AuthoritativeClient, id: string, body: Record<string, unknown>, expectedUpdatedAt?: string) {
  const current = await client.guardian.findUnique({ where: { id } });
  if (!current) throw new Error("Guardian not found");
  if (!sameVersion(current.updatedAt, expectedUpdatedAt)) throw new AuthoritativeRecordConflictError();
  const data = validateGuardianPayload({ ...current, ...body });
  if (!expectedUpdatedAt) return client.guardian.update({ where: { id }, data });
  const changed = await client.guardian.updateMany({ where: { id, updatedAt: current.updatedAt }, data });
  if (changed.count !== 1) throw new AuthoritativeRecordConflictError();
  return client.guardian.findUniqueOrThrow({ where: { id } });
}

export async function createStaffRecord(client: AuthoritativeClient, body: Record<string, unknown>) {
  return client.staffMember.create({ data: validateStaffInput(body) });
}

export async function updateStaffRecord(client: AuthoritativeClient, id: string, body: Record<string, unknown>, expectedUpdatedAt?: string) {
  const current = await client.staffMember.findUnique({ where: { id } });
  if (!current) throw new Error("Staff member not found");
  if (!sameVersion(current.updatedAt, expectedUpdatedAt)) throw new AuthoritativeRecordConflictError();
  const data = validateStaffInput({ ...current, ...body, dateOfJoining: body.dateOfJoining ?? current.dateOfJoining?.toISOString() ?? null });
  if (!expectedUpdatedAt) return client.staffMember.update({ where: { id }, data });
  const changed = await client.staffMember.updateMany({ where: { id, updatedAt: current.updatedAt }, data });
  if (changed.count !== 1) throw new AuthoritativeRecordConflictError();
  return client.staffMember.findUniqueOrThrow({ where: { id } });
}
