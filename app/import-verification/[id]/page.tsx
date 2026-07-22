import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StoredErrorCsvButton } from "@/components/stored-error-csv-button";
import { PageHeader, StatusBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { money } from "@/lib/format";
import { parseImportBatchDetails } from "@/lib/import-verification";
import { prisma } from "@/lib/prisma";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";

export default async function ImportBatchDetailsPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const batch = await prisma.importBatch.findUnique({ where: { id: (await params).id } });
  if (!batch) notFound();
  const permissions = await getEffectivePermissions(prisma, user.role);
  const canViewAll = permissionSetCan(permissions, "VIEW_IMPORT_VERIFICATION");
  const canViewPaymentImports = user.role === "ACCOUNTANT" &&
    batch.type !== "STUDENTS" &&
    permissionSetCan(permissions, "CREATE_PAYMENTS");
  if (!canViewAll && !canViewPaymentImports) {
    redirect("/unauthorized");
  }
  const details = parseImportBatchDetails(batch.detailsJson);

  return (
    <div className="page">
      <PageHeader
        title={`${batch.type === "STUDENTS" ? "Student" : "Payment"} Import Batch`}
        description={`${batch.fileName} · ${formatDateTime(batch.importedAt)}`}
        action={<Link className="button secondary" href="/import-verification">Back to Batches</Link>}
      />
      <section className="notice">
        <strong>No batch rollback:</strong> To undo a bad import, restore the backup taken immediately before it.
      </section>
      <section className="card card-pad">
        <div className="section-title inline-section-title">
          <h3>Batch Summary</h3>
          <StatusBadge status={batch.status} />
        </div>
        <div className="grid four">
          <Summary label="Total Rows" value={batch.totalRows} />
          <Summary label="Created" value={batch.createdCount} />
          <Summary label="Updated" value={batch.updatedCount} />
          <Summary label="Skipped" value={batch.skippedCount} />
          <Summary label="Errors" value={batch.errorCount} />
          <Summary label="Warnings" value={batch.warningCount} />
          <Summary label="Mode" value={batch.mode} />
          <Summary label="Imported By" value={batch.importedByName} />
        </div>
        {batch.notes ? <p className="notice"><strong>Notes:</strong> {batch.notes}</p> : null}
      </section>

      {details.reconciliation ? <PaymentTotals reconciliation={details.reconciliation} /> : null}
      {details.expectedComparison?.length ? (
        <section className="card">
          <div className="section-title"><h3>Expected Totals Comparison</h3></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Total</th><th>Expected</th><th>Actual Valid</th><th>Difference</th><th>Result</th></tr></thead>
              <tbody>
                {details.expectedComparison.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td><td>{money(row.expected)}</td><td>{money(row.actual)}</td>
                    <td className={row.matched ? "match-text" : "mismatch-text"}>{money(row.difference)}</td>
                    <td><span className={`badge ${row.matched ? "success" : "danger"}`}>{row.matched ? "Matched" : "Mismatch"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <SampleRows type={batch.type} rows={details.samples} />

      <section className="card card-pad">
        <div className="section-title inline-section-title">
          <div><h3>Warnings and Errors</h3><p>Stored verification evidence from this batch.</p></div>
          <StoredErrorCsvButton
            errors={details.errors}
            fileName={`${batch.type.toLowerCase()}-${batch.id}-errors.csv`}
          />
        </div>
        {details.warnings.length ? <details><summary>{details.warnings.length} warning(s)</summary><ul>{details.warnings.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></details> : <p>No stored warnings.</p>}
        {details.errors.length ? <details><summary>{details.errors.length} stored error row(s)</summary><pre>{JSON.stringify(details.errors, null, 2)}</pre></details> : <p>No stored errors.</p>}
      </section>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string | number }) {
  return <div className="card stat"><span>{label}</span><strong className="compact-stat">{value}</strong></div>;
}

function PaymentTotals({ reconciliation }: { reconciliation: NonNullable<ReturnType<typeof parseImportBatchDetails>["reconciliation"]> }) {
  return (
    <section className="card card-pad">
      <div className="section-title inline-section-title"><h3>Payment Reconciliation</h3></div>
      <div className="grid four">
        <Summary label="Uploaded Total" value={money(reconciliation.uploadedTotalAmount)} />
        <Summary label="Valid Importable" value={money(reconciliation.validImportableTotalAmount)} />
        <Summary label="Duplicate Amount" value={money(reconciliation.skippedDuplicateAmount)} />
        <Summary label="Error Amount" value={money(reconciliation.errorRowAmount)} />
        <Summary label="Created Amount" value={money(reconciliation.createdAmount)} />
        <Summary label="Duplicate Rows" value={reconciliation.duplicateRows} />
        <Summary label="From Date" value={reconciliation.dateRange.from || "—"} />
        <Summary label="To Date" value={reconciliation.dateRange.to || "—"} />
      </div>
      <div className="grid two reconciliation-tables">
        <SimpleTotals title="Amount by Received Account" values={reconciliation.amountByReceivedAccount} />
        <SimpleTotals title="Total by Date" values={reconciliation.totalByDate} />
        <SimpleTotals title="Total by Payment Mode" values={reconciliation.totalByPaymentMode} />
      </div>
    </section>
  );
}

function SimpleTotals({ title, values }: { title: string; values: Record<string, number> }) {
  return <div className="table-wrap compact-table"><table><thead><tr><th>{title}</th><th>Amount</th></tr></thead><tbody>{Object.entries(values).map(([label, value]) => <tr key={label}><td>{label}</td><td>{money(value)}</td></tr>)}</tbody></table></div>;
}

function SampleRows({ type, rows }: { type: string; rows: Array<Record<string, unknown>> }) {
  const fields = type === "STUDENTS"
    ? ["admissionNo", "studentName", "className", "fatherName", "phone1", "studentType", "discountPercent", "status"]
    : ["date", "receiptNo", "admissionNo", "studentName", "amountPaid", "paymentMode", "receivedAccount", "transactionRefNo", "status"];
  return (
    <section className="card">
      <div className="section-title"><div><h3>Random Verification Sample</h3><p>Verify up to 10 rows against Excel and physical records.</p></div></div>
      <div className="table-wrap">
        <table>
          <thead><tr>{fields.map((field) => <th key={field}>{fieldLabel(field)}</th>)}</tr></thead>
          <tbody>
            {rows.map((row, index) => <tr key={index}>{fields.map((field) => <td key={field}>{String(row[field] ?? "—")}</td>)}</tr>)}
            {!rows.length ? <tr><td colSpan={fields.length}>No sample rows stored for this batch.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function fieldLabel(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(value);
}
