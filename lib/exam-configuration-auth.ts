import { requireApiPermission } from "@/lib/auth";
import type { Permission } from "@/lib/permissions";

export async function requireExamConfigurationMutation(permission: Permission) {
  const auth = await requireApiPermission(permission);
  if (auth.response || !auth.user) return auth;
  if (auth.user.role !== "SUPER_ADMIN") return auth;
  const intervention = await requireApiPermission("INTERVENE_EXAM_SCHEMES");
  if (intervention.response || !intervention.user) return intervention;
  return auth;
}
