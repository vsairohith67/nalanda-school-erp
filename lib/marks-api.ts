import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";
import { requireMarksTarget, resolveMarksScope } from "@/lib/marks-scope";

export class MarksApiError extends Error { constructor(message: string, public status = 400) { super(message); } }

export async function loadScopedAssessment(user: AuthUser, assessmentId: string) {
  const assessment = await prisma.examAssessment.findUnique({ where: { id: assessmentId }, include: { examCycle: true } });
  if (!assessment) throw new MarksApiError("Assessment was not found.", 404);
  const scope = await resolveMarksScope(prisma, user, assessment.academicYear);
  try { requireMarksTarget(scope, assessment); } catch (error) { throw new MarksApiError(error instanceof Error ? error.message : "Assessment is outside your scope.", 403); }
  return assessment;
}

export function marksError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return { message: "A record with the same unique details already exists.", status: 409 };
    return { message: "Unable to process exam marks safely.", status: 400 };
  }
  const message = error instanceof Error ? error.message : "Unable to process exam marks.";
  const status = error instanceof MarksApiError ? error.status : /not found/i.test(message) ? 404 : /another session|cannot|locked|immutable|already/i.test(message) ? 409 : 400;
  return { message, status };
}
