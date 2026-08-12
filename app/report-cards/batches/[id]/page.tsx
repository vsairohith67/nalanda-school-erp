import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { ReportCardBatchWorkflow } from "@/components/report-card-workflow";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionSetCan } from "@/lib/role-permissions";
import { resolveReportCardScope, requireReportCardTarget } from "@/lib/report-card-scope";
import { parseDraft, reportCardValidationGaps } from "@/lib/report-cards";
import { isKgReportCardOperationallyAvailable } from "@/lib/report-card-release-policy";

export default async function BatchPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("VIEW_REPORT_CARDS");
  const id = (await params).id;
  const [batch, permissions] = await Promise.all([
    prisma.reportCardBatch.findUnique({
      where: { id },
      include: {
        template: { select: { templateCode: true, name: true } },
        examSources: { include: { examCycle: { select: { examCode: true, name: true, status: true } } } },
        reportCards: {
          include: {
            student: { select: { studentName: true, admissionNo: true } },
            _count: { select: { versions: true } }
          },
          orderBy: { student: { studentName: "asc" } }
        }
      }
    }),
    getCurrentUserEffectivePermissions()
  ]);
  if (!batch) notFound();
  const scope = await resolveReportCardScope(prisma, user, batch.academicYear);
  requireReportCardTarget(scope, batch);
  const cards = batch.reportCards.filter((card) => {
    try { requireReportCardTarget(scope, card); return true; } catch { return false; }
  });
  const gapCount = cards.reduce((total, card) => total + reportCardValidationGaps(card, parseDraft(card)).length, 0);
  const ready = cards.filter((card) => card.status === "READY_FOR_REVIEW").length;
  const operational = batch.reportType !== "KG_RUBRIC" || isKgReportCardOperationallyAvailable();
  return <div className="page report-cards-page">
    <PageHeader title={batch.title} description={`${batch.batchNumber} · ${batch.academicYear} · ${batch.className}${batch.section ? `-${batch.section}` : ""}`} action={<StatusBadge status={batch.status} />} />
    {scope.reason ? <p className="notice">{scope.reason}</p> : null}
    {!operational && user.role === "SUPER_ADMIN" ? <p className="notice"><strong>KG report-card family — planned for V1.5.</strong> Historical records remain readable; operational workflow controls are disabled in V1.</p> : null}
    <div className="grid four">
      <StatCard label="Student Cards" value={String(cards.length)} />
      <StatCard label="Ready for Review" value={String(ready)} />
      <StatCard label="Validation Gaps" value={String(gapCount)} />
      <StatCard label="Issued Versions" value={String(cards.reduce((total, card) => total + card._count.versions, 0))} />
    </div>
    <section className="card card-pad"><dl className="detail-list">
      <div><dt>Template</dt><dd>{batch.template.templateCode} - {batch.template.name}</dd></div>
      <div><dt>Report type</dt><dd>{batch.reportType.replaceAll("_", " ")}</dd></div>
      <div><dt>Reporting period</dt><dd>{batch.reportingPeriod ?? "Not recorded"}</dd></div>
      <div><dt>Locked source</dt><dd>{batch.examSources[0] ? `${batch.examSources[0].examCycle.examCode} - ${batch.examSources[0].examCycle.name} (${batch.examSources[0].examCycle.status})` : "Dedicated KG rubric"}</dd></div>
    </dl></section>
    <ReportCardBatchWorkflow id={batch.id} status={batch.status} updatedAt={batch.updatedAt.toISOString()} qaRecord={batch.batchNumber.startsWith("QA17C")} permissions={{
      manage: operational && permissionSetCan(permissions, "MANAGE_REPORT_CARD_BATCHES"),
      submit: operational && permissionSetCan(permissions, "SUBMIT_REPORT_CARDS"),
      approve: operational && permissionSetCan(permissions, "APPROVE_REPORT_CARDS"),
      issue: operational && permissionSetCan(permissions, "ISSUE_REPORT_CARDS")
    }} />
    <section className="card"><div className="section-title"><div><h3>Included Students</h3><p>Cards must be complete and individually submitted before batch submission.</p></div></div><div className="table-wrap"><table><thead><tr><th>Admission</th><th>Student</th><th>Status</th><th>Gaps</th><th>Versions</th><th>Open</th></tr></thead><tbody>
      {cards.map((card) => { const gaps = reportCardValidationGaps(card, parseDraft(card)); return <tr key={card.id}><td>{card.student.admissionNo}</td><td>{card.student.studentName}</td><td><StatusBadge status={card.status} /></td><td>{gaps.length ? `${gaps.length} gap(s)` : "Complete"}</td><td>{card._count.versions}</td><td><Link href={`/report-cards/${card.id}`}>View Card</Link></td></tr>; })}
    </tbody></table></div></section>
  </div>;
}
