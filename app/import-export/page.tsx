import { PageHeader } from "@/components/ui";
import { ImportExport } from "@/components/import-export";
import { requireUser, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { canOpenImportExportWorkspace } from "@/lib/access-rules";
import { prisma } from "@/lib/prisma";
import { permissionSetCan } from "@/lib/role-permissions";
import { redirect } from "next/navigation";

export default async function ImportExportPage() {
  const user = await requireUser();
  const permissions = await getCurrentUserEffectivePermissions();
  const canOpen = permissionSetCan(permissions, "VIEW_IMPORT_EXPORT");
  const canImportStudents = permissionSetCan(permissions, "IMPORT_STUDENTS");
  const canImportGuardians = permissionSetCan(permissions, "IMPORT_GUARDIANS");
  const canImportStaff = permissionSetCan(permissions, "IMPORT_STAFF");
  const canImportPayments = permissionSetCan(permissions, "CREATE_PAYMENTS");
  const canExportStudents = permissionSetCan(permissions, "EXPORT_STUDENTS");
  const canExportPayments = permissionSetCan(permissions, "EXPORT_PAYMENTS");
  const canExportReports = permissionSetCan(permissions, "EXPORT_REPORTS");
  const canBackup = permissionSetCan(permissions, "RUN_BACKUP");
  const canRestore = permissionSetCan(permissions, "RUN_RESTORE");
  if (!canOpen || !canOpenImportExportWorkspace(permissions)) redirect("/unauthorized");

  return (
    <div className="page">
      <PageHeader
        title="Import / Export"
        description="Preview and validate student, guardian, staff, or payment Excel/CSV files before importing, then export operational data."
      />
      <ImportExport
        canImportStudents={canImportStudents}
        canImportGuardians={canImportGuardians}
        canImportStaff={canImportStaff}
        canImportPayments={canImportPayments}
        canExportStudents={canExportStudents}
        canExportPayments={canExportPayments}
        canExportReports={canExportReports}
        canBackup={canBackup}
        canRestore={canRestore}
      />
    </div>
  );
}
