import Link from "next/link";
import { redirect } from "next/navigation";
import { GoLiveChecklist } from "@/components/go-live-checklist";
import { PageHeader, StatusBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { defaultGoLiveChecklist, GO_LIVE_CHECKLIST_ITEMS } from "@/lib/go-live-checklist";
import { prisma } from "@/lib/prisma";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";
import {
  importBatchStatusLabel,
  IMPORT_BATCH_STATUS_EXPLANATIONS,
  IMPORT_BATCH_STATUSES,
  IMPORT_BATCH_TYPES
} from "@/lib/import-verification";
import { PILOT_SAMPLE_IMPORT_FILES } from "@/lib/pilot-sample-constants";

export default async function ImportVerificationPage({
  searchParams
}: {
  searchParams?: Promise<{ type?: string; status?: string }>;
}) {
  const user = await requireUser();
  const permissions = await getEffectivePermissions(prisma, user.role);
  const canViewAll = permissionSetCan(permissions, "VIEW_IMPORT_VERIFICATION");
  const canViewPaymentImports = user.role === "ACCOUNTANT" && permissionSetCan(permissions, "CREATE_PAYMENTS");
  if (!canViewAll && !canViewPaymentImports) redirect("/unauthorized");
  const filters = await searchParams;
  const typeFilter = canViewAll && IMPORT_BATCH_TYPES.includes(filters?.type as never)
    ? filters?.type
    : undefined;
  const statusFilter = IMPORT_BATCH_STATUSES.includes(filters?.status as never)
    ? filters?.status
    : undefined;
  const where = {
    ...(canViewAll ? {} : { type: "PAYMENTS" }),
    ...(typeFilter ? { type: typeFilter } : {}),
    ...(statusFilter ? { status: statusFilter } : {})
  };

  const [batches, checklistRow] = await Promise.all([
    prisma.importBatch.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { importedAt: "desc" },
      take: 50
    }),
    canViewAll ? prisma.goLiveChecklist.findUnique({ where: { id: "go-live" } }) : Promise.resolve(null)
  ]);
  const checklist = defaultGoLiveChecklist();
  if (checklistRow) {
    for (const [key] of GO_LIVE_CHECKLIST_ITEMS) checklist[key] = checklistRow[key];
  }

  return (
    <div className="page">
      <PageHeader
        title="Import Verification"
        description="Review trial runs and completed imports before reconciling real school data."
        action={<Link className="button" href="/import-export">Open Import / Export</Link>}
      />
      <section className="notice">
        <strong>Safe import rule:</strong> Before a large import, take a backup. To undo a bad import,
        restore the backup taken before import. Rollback by batch is not yet implemented.
      </section>
      {canViewAll ? (
        <>
          <GoLiveChecklist initial={checklist} />
        </>
      ) : null}
      <section className="card">
        <div className="section-title">
          <div>
            <h3>Recent Import Batches</h3>
            <p>{canViewAll ? "Student and payment batches" : "Payment batches available to your role"}</p>
          </div>
        </div>
        <form className="form-grid" style={{ margin: "0 16px 12px" }}>
          {canViewAll ? (
            <label>
              Type
              <select name="type" defaultValue={typeFilter ?? ""}>
                <option value="">All types</option>
                {IMPORT_BATCH_TYPES.map((type) => (
                  <option value={type} key={type}>{type === "STUDENTS" ? "Students" : "Payments"}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            Status
              <select name="status" defaultValue={statusFilter ?? ""}>
                <option value="">All statuses</option>
                {IMPORT_BATCH_STATUSES.map((status) => (
                  <option value={status} key={status}>{importBatchStatusLabel(status)}</option>
                ))}
              </select>
            </label>
          <div className="reconciliation-load">
            <button className="secondary" type="submit">Filter</button>
          </div>
        </form>
        <div className="notice" style={{ margin: "0 16px 12px" }}>
          <strong>Status legend:</strong>{" "}
          {IMPORT_BATCH_STATUSES.map((status) => IMPORT_BATCH_STATUS_EXPLANATIONS[status]).join(". ")}.
          Sample batches are marked as Sample Data.
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date / Time</th><th>Type</th><th>File</th><th>Imported By</th><th>Mode</th>
                <th>Status</th><th>Created</th><th>Updated</th><th>Skipped</th><th>Errors</th><th>Warnings</th><th />
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id}>
                  <td>{formatDateTime(batch.importedAt)}</td>
                  <td>{batch.type === "STUDENTS" ? "Students" : "Payments"}</td>
                  <td>
                    {batch.fileName}
                    {PILOT_SAMPLE_IMPORT_FILES.includes(batch.fileName as never) ? (
                      <span className="badge warn" style={{ marginLeft: 8 }}>Sample Data</span>
                    ) : null}
                  </td>
                  <td>{batch.importedByName}</td>
                  <td>{batch.mode}</td>
                  <td><StatusBadge status={importBatchStatusLabel(batch.status)} /></td>
                  <td>{batch.createdCount}</td>
                  <td>{batch.updatedCount}</td>
                  <td>{batch.skippedCount}</td>
                  <td>{batch.errorCount}</td>
                  <td>{batch.warningCount}</td>
                  <td><Link href={`/import-verification/${batch.id}`}>View Details</Link></td>
                </tr>
              ))}
              {!batches.length ? <tr><td colSpan={12}>No saved trial or import batches yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}
