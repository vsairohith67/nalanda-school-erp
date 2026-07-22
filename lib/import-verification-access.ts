import { can, type Role } from "@/lib/permissions";
import type { ImportBatchType } from "@/lib/import-verification";

export function canViewImportVerification(role: Role, type?: ImportBatchType) {
  if (can(role, "VIEW_IMPORT_VERIFICATION")) return true;
  return role === "ACCOUNTANT" && type !== "STUDENTS" && can(role, "ADD_PAYMENT");
}
