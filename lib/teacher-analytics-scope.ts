import type { Prisma, PrismaClient } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";

type ScopeClient = Pick<PrismaClient | Prisma.TransactionClient, "staffMember">;

export async function requireOwnTeacherStaff(client: ScopeClient, user: Pick<AuthUser, "id" | "role">) {
  if (user.role !== "TEACHER") throw new Error("This route is restricted to Teacher self-view.");
  const staff = await client.staffMember.findUnique({
    where: { userId: user.id },
    select: { id: true, fullName: true, displayName: true, staffCode: true, status: true }
  });
  if (!staff || staff.status !== "ACTIVE") throw new Error("No active StaffMember is linked to this Teacher account.");
  return staff;
}

export function ownTeacherSnapshotWhere(staffMemberId: string): Prisma.TeacherAnalyticsSnapshotWhereInput {
  return {
    staffMemberId,
    review: { is: { status: { in: ["SHARED_WITH_TEACHER", "TEACHER_RESPONSE_RECEIVED", "FINALISED"] } } }
  };
}

export function safeTeacherReview(review: any) {
  if (!review) return null;
  return {
    status: review.status,
    strengthsNote: review.strengthsNote,
    supportNeededNote: review.supportNeededNote,
    agreedActionsNote: review.agreedActionsNote,
    leadershipContextNote: review.leadershipContextNote,
    teacherResponse: review.teacherResponse,
    nextReviewDate: review.nextReviewDate,
    sharedAt: review.sharedAt,
    teacherRespondedAt: review.teacherRespondedAt,
    finalisedAt: review.finalisedAt,
    teacherResponseNotice: "A Teacher response provides context and is not a legal acknowledgment or admission."
  };
}
