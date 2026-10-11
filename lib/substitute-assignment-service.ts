import type { Prisma, PrismaClient, SubstituteAssignment } from "@prisma/client";
import { evaluateEffectivePermission } from "@/lib/iam/effective-access";
import { publicDatabaseError, withDatabaseRetry } from "@/lib/database-retry";
import { substituteInclude, validateSubstituteInput, validateSubstituteLinks } from "@/lib/substitutes";

export type SubstituteActor = { userId: string; sessionId: string; roleAssignmentId: string };
type Action = "draft" | "edit" | "assign" | "confirm" | "complete" | "cancel";
type Input = ReturnType<typeof validateSubstituteInput>;

export class SubstituteAssignmentError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

async function authorize(tx: Prisma.TransactionClient, actor: SubstituteActor, action: Action) {
  if (!actor.sessionId || !actor.roleAssignmentId) throw new SubstituteAssignmentError("Authentication required", 401);
  const permissions = ["MANAGE_SUBSTITUTES", ...(action === "assign" ? ["ASSIGN_SUBSTITUTES"] : []), ...(["confirm", "complete"].includes(action) ? ["CONFIRM_SUBSTITUTES"] : [])];
  for (const permission of permissions) {
    if (!(await evaluateEffectivePermission(tx, { ...actor, permission })).allowed) throw new SubstituteAssignmentError("You do not have permission for this substitute action", 403);
  }
  const [user, session] = await Promise.all([
    tx.user.findUnique({ where: { id: actor.userId }, select: { credentialVersion: true, mustChangePassword: true } }),
    tx.authSession.findUnique({ where: { id: actor.sessionId }, select: { credentialVersion: true } })
  ]);
  if (!user || user.mustChangePassword || session?.credentialVersion !== user.credentialVersion) throw new SubstituteAssignmentError("The session is no longer current", 403);
}

function expectedTimestamp(value: unknown) {
  if (typeof value !== "string" || !value) throw new SubstituteAssignmentError("Refresh the assignment before changing it", 409);
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) throw new SubstituteAssignmentError("Refresh the assignment before changing it", 409);
  return timestamp;
}

function sameInput(existing: SubstituteAssignment, input: Input) {
  return Object.entries(input).every(([key, value]) => {
    const stored = existing[key as keyof SubstituteAssignment];
    return value instanceof Date ? stored instanceof Date && stored.getTime() === value.getTime() : stored === value;
  });
}

/** Every mutating path shares database Serializable isolation. Both the
 * availability predicates and the write are inside that transaction; separate
 * processes cannot pass an advisory snapshot and both commit overlapping duty.
 * Retry only the existing supported serialization/deadlock class, re-reading
 * authority and availability on each attempt. No process-local mutex is used. */
export async function saveSubstituteAssignment(client: PrismaClient, actor: SubstituteActor, value: unknown, id?: string) {
  const source = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<string, unknown>;
  const action = String(source.action ?? (id ? "edit" : "draft")) as Action;
  if (!(["draft", "edit", "assign", "confirm", "complete", "cancel"] as string[]).includes(action) || (id ? action === "draft" : !["draft", "assign"].includes(action))) throw new SubstituteAssignmentError("Unknown substitute workflow action");
  try {
    return await withDatabaseRetry(() => client.$transaction(async (tx) => {
      await authorize(tx, actor, action);
      if (!id) {
        const input = validateSubstituteInput(source);
        await validateSubstituteLinks(tx, input, { requireSubstitute: action === "assign" });
        return tx.substituteAssignment.create({ data: { ...input, status: action === "assign" ? "ASSIGNED" : "DRAFT", assignedByUserId: action === "assign" ? actor.userId : null, assignedAt: action === "assign" ? new Date() : null }, include: substituteInclude });
      }
      const existing = await tx.substituteAssignment.findUnique({ where: { id } });
      if (!existing) throw new SubstituteAssignmentError("Substitute assignment not found", 404);
      const expectedUpdatedAt = expectedTimestamp(source.expectedUpdatedAt);
      let data: Prisma.SubstituteAssignmentUncheckedUpdateManyInput;
      if (["edit", "assign"].includes(action)) {
        if (!["DRAFT", "ASSIGNED"].includes(existing.status)) throw new SubstituteAssignmentError("Only draft or assigned substitute duties can be edited", 409);
        const input = validateSubstituteInput({ ...existing, assignmentDate: existing.assignmentDate.toISOString().slice(0, 10), ...source });
        const exactRetry = action === "assign" && existing.status === "ASSIGNED" && existing.assignedByUserId === actor.userId && sameInput(existing, input);
        if (!exactRetry && existing.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw new SubstituteAssignmentError("The assignment changed; refresh before saving", 409);
        await validateSubstituteLinks(tx, input, { requireSubstitute: action === "assign" || existing.status === "ASSIGNED", excludeId: id });
        if (exactRetry) return tx.substituteAssignment.findUniqueOrThrow({ where: { id }, include: substituteInclude });
        data = { ...input, status: action === "assign" ? "ASSIGNED" : existing.status, assignedByUserId: action === "assign" ? actor.userId : existing.assignedByUserId, assignedAt: action === "assign" ? new Date() : existing.assignedAt };
      } else {
        if (existing.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw new SubstituteAssignmentError("The assignment changed; refresh before saving", 409);
        if (action === "confirm") {
          if (existing.status !== "ASSIGNED") throw new SubstituteAssignmentError("Only assigned substitute duties can be confirmed", 409);
          await validateSubstituteLinks(tx, validateSubstituteInput({ ...existing, assignmentDate: existing.assignmentDate.toISOString().slice(0, 10) }), { requireSubstitute: true, excludeId: id });
          data = { status: "CONFIRMED", confirmedByUserId: actor.userId, confirmedAt: new Date() };
        } else if (action === "complete") {
          if (existing.status !== "CONFIRMED") throw new SubstituteAssignmentError("Only confirmed substitute duties can be completed", 409);
          data = { status: "COMPLETED", completedByUserId: actor.userId, completedAt: new Date() };
        } else {
          if (["COMPLETED", "CANCELLED"].includes(existing.status)) throw new SubstituteAssignmentError("Completed or cancelled substitute duties cannot be cancelled again", 409);
          const cancellationReason = String(source.cancellationReason ?? "").trim();
          if (!cancellationReason) throw new SubstituteAssignmentError("Cancellation reason is required");
          data = { status: "CANCELLED", cancelledByUserId: actor.userId, cancelledAt: new Date(), cancellationReason };
        }
      }
      // Strictly advance the existing timestamp even for same-millisecond edits.
      data.updatedAt = new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1));
      const changed = await tx.substituteAssignment.updateMany({ where: { id, status: existing.status, updatedAt: existing.updatedAt }, data });
      if (changed.count !== 1) throw new SubstituteAssignmentError("The assignment changed; refresh before saving", 409);
      return tx.substituteAssignment.findUniqueOrThrow({ where: { id }, include: substituteInclude });
    }, { isolationLevel: "Serializable" }));
  } catch (error) {
    if (error instanceof SubstituteAssignmentError) throw error;
    if (error && typeof error === "object" && "code" in error) {
      const publicError = publicDatabaseError(error);
      throw new SubstituteAssignmentError(publicError.message, publicError.status);
    }
    throw error;
  }
}
