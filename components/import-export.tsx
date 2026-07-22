import { BackupPanel } from "@/components/backup-panel";
import { PaymentImportPanel } from "@/components/payment-import-panel";
import { RestorePanel } from "@/components/restore-panel";
import { StudentImportPanel } from "@/components/student-import-panel";
import { GuardianImportPanel } from "@/components/guardian-import-panel";
import { StaffImportPanel } from "@/components/staff-import-panel";

type ImportExportProps = {
  canImportStudents: boolean;
  canImportGuardians: boolean;
  canImportStaff: boolean;
  canImportPayments: boolean;
  canExportStudents: boolean;
  canExportPayments: boolean;
  canExportReports: boolean;
  canBackup: boolean;
  canRestore: boolean;
};

export function ImportExport(props: ImportExportProps) {
  return (
    <div className="grid">
      {props.canImportStudents ? <StudentImportPanel /> : null}
      {props.canImportGuardians ? <GuardianImportPanel /> : null}
      {props.canImportStaff ? <StaffImportPanel /> : null}
      {props.canImportPayments ? <PaymentImportPanel /> : null}
      {props.canExportStudents || props.canExportPayments || props.canExportReports ? (
        <section className="card card-pad">
          <h3>Exports</h3>
          <div className="top-actions" style={{ flexWrap: "wrap" }}>
            {props.canExportStudents ? <a className="button secondary" href="/api/export/students">Student Master CSV</a> : null}
            {props.canExportPayments ? <a className="button secondary" href="/api/export/payments">Payment Entry CSV</a> : null}
            {props.canExportReports ? <a className="button secondary" href="/api/export/pending-dues">Pending Dues CSV</a> : null}
            {props.canExportReports ? (
              <a className="button secondary" href={`/api/export/daily-collection?date=${new Date().toISOString().slice(0, 10)}`}>
                Today Collection CSV
              </a>
            ) : null}
          </div>
        </section>
      ) : null}
      {props.canBackup ? <BackupPanel /> : null}
      {props.canRestore ? <RestorePanel /> : null}
    </div>
  );
}
