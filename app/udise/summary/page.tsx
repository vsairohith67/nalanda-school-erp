import { PageHeader } from "@/components/ui";
import { UdiseNav } from "@/components/udise-nav";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadUdiseChecklist } from "@/lib/udise-checklist";

export default async function UdiseSummaryPage() {
  await requirePermission("VIEW_UDISE_CHECKLIST");
  const report = await loadUdiseChecklist(prisma);
  return <div className="page udise-page print-document"><PageHeader title="UDISE+ Compact Planning Summary" description={report.warning} /><UdiseNav current="summary" /><div className="notice-warning udise-warning"><strong>{report.verificationWarning}</strong><span>Possible reporting fields only; school verification is needed.</span></div><section className="card card-pad"><h3>School and academic year</h3><p>{report.school.schoolName} · {report.school.academicYear}</p><p>School address: {report.school.addressStatus}. School phone: {report.school.phoneStatus}. Official UDISE+ identifiers: {report.school.officialFieldsStatus}.</p></section><section className="card card-pad"><h3>Review totals</h3><dl className="udise-summary-list">{Object.entries(report.summary).map(([key, value]) => <div key={key}><dt>{key.replace(/([A-Z])/g, " $1")}</dt><dd>{value}</dd></div>)}</dl></section><section className="card card-pad"><h3>Fields not tracked in ERP</h3><ul>{report.notTrackedFields.map((field) => <li key={field}>{field}</li>)}</ul></section></div>;
}
