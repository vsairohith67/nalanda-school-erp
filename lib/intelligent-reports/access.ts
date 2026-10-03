import type { Prisma, PrismaClient } from "@prisma/client";
import { loadAuthorizationSnapshot, evaluatePermissionFromSnapshot } from "@/lib/iam/effective-access";
import { operationalReleaseFeatureAvailability, BULK_EXPORTS_FEATURE } from "@/lib/release-feature-flag-runtime";
import { ReportError, type Family } from "./contract";

export type Client = PrismaClient | Prisma.TransactionClient;
export type Identity = { userId: string; sessionId: string; roleAssignmentId?: string | null };
export const MODULE_FEATURE = { key:"intelligent-reports-1a", environment:"PRODUCTION", expectedVersion:1, activationRole:"SUPER_ADMIN" } as const;
const roles = ["SUPER_ADMIN","DIRECTOR","PRINCIPAL","ACCOUNTANT"];
const domains = { ACADEMIC:"VIEW_EXAM_REPORTS", ATTENDANCE:"VIEW_STUDENT_ATTENDANCE_REPORTS", FEES:"VIEW_PENDING_DUES" } as const;
const exports = { ACADEMIC:"EXPORT_EXAM_REPORTS", ATTENDANCE:"EXPORT_REPORTS", FEES:"EXPORT_REPORTS" } as const;

export async function authorize(client: Client, identity: Identity, family?: Family, exporting = false) {
  const snapshot = await loadAuthorizationSnapshot(client, identity);
  const role = snapshot.roleAssignment?.role;
  if (!identity.sessionId || !role || !roles.includes(role)) throw new ReportError("This selected role cannot use Ask Nalanda.","ACCESS_DENIED",403);
  const requirePermission = async (permission: string, explicit = false) => {
    const decision = await evaluatePermissionFromSnapshot(client,snapshot,permission,true);
    if (!decision.allowed || (explicit && !["USER_ALLOW","PROFILE_ALLOW"].includes(decision.source))) throw new ReportError("Ask Nalanda access is denied for this domain or action.","ACCESS_DENIED",403);
  };
  await requirePermission("USE_INTELLIGENT_REPORTS");
  // P1-specific OFF precedence; do not alter shared IAM grant semantics.
  const switches = ["USE_INTELLIGENT_REPORTS", ...(family ? [`USE_IR_${family}`] : []), ...(exporting ? ["EXPORT_INTELLIGENT_REPORTS"] : [])];
  const disabled = await client.rolePermission.findFirst({where:{role,permission:{in:switches},enabled:false},select:{permission:true}});
  if (disabled) throw new ReportError("Ask Nalanda is switched off for this role.","ROLE_OFF",403);
  if (!operationalReleaseFeatureAvailability(MODULE_FEATURE).enabled) throw new ReportError("Ask Nalanda is currently switched off.","MODULE_OFF",403);
  if (family) {
    await requirePermission(`USE_IR_${family}`);
    await requirePermission(domains[family],role === "ACCOUNTANT" && family !== "FEES");
  }
  if (exporting) {
    await requirePermission("EXPORT_INTELLIGENT_REPORTS");
    if (!family) throw new ReportError("An export needs a report family.");
    await requirePermission(exports[family]);
    if (!operationalReleaseFeatureAvailability(BULK_EXPORTS_FEATURE).enabled) throw new ReportError("Governed bulk exports are switched off.","EXPORT_OFF",403);
  }
  return { role, userId:identity.userId, authorizationVersion:snapshot.user!.authorizationVersion };
}
