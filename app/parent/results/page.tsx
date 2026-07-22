import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader, StatusBadge } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getParentReportCards, ReportCardPortalAccessError } from "@/lib/report-card-portals";
import { displayDate } from "@/lib/format";

export default async function ParentResultsPage({ searchParams }: { searchParams: Promise<{ student?: string; card?: string; version?: string }> }) {
  const user = await requirePermission("VIEW_OWN_REPORT_CARDS");
  const q = await searchParams;
  const data = await getParentReportCards(prisma, user.id, q.student).catch((error) => {
    if (error instanceof ReportCardPortalAccessError && error.status === 403) redirect("/unauthorized");
    if (error instanceof ReportCardPortalAccessError) notFound();
    throw error;
  });
  const selectedCard = q.card ? data.reportCards.find((card) => card.reportCardNumber === q.card) : null;
  const selectedVersion = selectedCard ? (q.version ? selectedCard.versions.find((version) => String(version.versionNumber) === q.version) : selectedCard.versions[0]) : null;
  return <div className="page parent-results-page">
    <PageHeader title="Report Cards" description="Read-only issued report cards for linked children only. Drafts and internal workflow data are never shown."/>
    {data.children.length > 1 ? <section className="card card-pad"><h3>Choose Child</h3><div className="page-actions">{data.children.map((child) => <Link key={child.studentId} className={`button ${child.studentId === data.selectedChild?.studentId ? "" : "secondary"}`} href={`/parent/results?student=${encodeURIComponent(child.studentId)}`}>{child.studentName}</Link>)}</div></section> : null}
    {!data.selectedChild ? <p className="notice">No child is linked to this Parent account.</p> : <>
      <section className="card card-pad"><h3>{data.selectedChild.studentName}</h3><p>{data.selectedChild.admissionNo} · {data.selectedChild.className}{data.selectedChild.section ? `-${data.selectedChild.section}` : ""}</p></section>
      <section className="card"><div className="table-wrap"><table><thead><tr><th>Report Card</th><th>Period</th><th>Type</th><th>Latest Version</th><th>Issued</th><th>View / Print</th></tr></thead><tbody>
        {data.reportCards.map((card) => <tr key={card.reportCardNumber}><td>{card.title}<br/><small>{card.reportCardNumber}</small></td><td>{card.reportingPeriod ?? card.academicYear}</td><td>{card.reportType.replaceAll("_", " ")}</td><td>Version {card.latestVersion}</td><td>{card.issuedAt ? displayDate(card.issuedAt) : "-"}</td><td><Link href={`/parent/results?student=${encodeURIComponent(data.selectedChild!.studentId)}&card=${encodeURIComponent(card.reportCardNumber)}`}>Open Issued Card</Link></td></tr>)}
        {!data.reportCards.length ? <tr><td colSpan={6}>No issued report cards are available for this linked child.</td></tr> : null}
      </tbody></table></div></section>
    </>}
    {selectedCard && selectedVersion ? <section className="card card-pad parent-issued-report">
      <div className="section-title"><div><h3>{selectedCard.title} · Version {selectedVersion.versionNumber}</h3><p>{selectedVersion.statusLabel}</p></div><PrintButton/></div>
      <StatusBadge status="ISSUED"/>
      <dl className="detail-list"><div><dt>Student</dt><dd>{selectedVersion.snapshot.student.name}</dd></div><div><dt>Class / Section</dt><dd>{selectedVersion.snapshot.student.className}{selectedVersion.snapshot.student.section ? `-${selectedVersion.snapshot.student.section}` : ""}</dd></div><div><dt>Academic Year</dt><dd>{selectedVersion.snapshot.academicYear}</dd></div><div><dt>Final Grade</dt><dd>{selectedVersion.snapshot.finalGrade ?? "-"}</dd></div><div><dt>Promotion Display</dt><dd>{selectedVersion.snapshot.promotionDisplayText}</dd></div></dl>
      <IssuedResultContent snapshot={selectedVersion.snapshot}/>
      <h4>Comments</h4><p><strong>Class Teacher:</strong> {selectedVersion.snapshot.comments?.teacher ?? "-"}</p><p><strong>Principal:</strong> {selectedVersion.snapshot.comments?.principal ?? "-"}</p>
      <div className="page-actions no-print">{selectedCard.versions.map((version) => <Link key={version.versionNumber} className="button secondary" href={`/parent/results?student=${encodeURIComponent(data.selectedChild!.studentId)}&card=${encodeURIComponent(selectedCard.reportCardNumber)}&version=${version.versionNumber}`}>Version {version.versionNumber} · {version.statusLabel}</Link>)}</div>
    </section> : null}
  </div>;
}

function IssuedResultContent({ snapshot }: { snapshot: any }) {
  if (snapshot.reportType === "MARK_BASED") {
    const subjects = snapshot.data?.calculation?.rows ?? [];
    return <><h4>Academic Result</h4><div className="table-wrap"><table><thead><tr><th>Subject</th><th>Component</th><th>Maximum</th><th>Obtained / State</th><th>Weighted</th></tr></thead><tbody>
      {subjects.map((row: any, index: number) => <tr key={`${row.subjectName}-${row.componentName}-${index}`}><td>{row.subjectName}</td><td>{row.componentName ?? "-"}</td><td>{row.maxMarks}</td><td>{row.status === "PRESENT" ? row.marksObtained : human(row.status)}</td><td>{row.weightedObtained ?? "-"}</td></tr>)}
    </tbody></table></div><p><strong>Total:</strong> {snapshot.data?.calculation?.totalObtained ?? "-"} / {snapshot.data?.calculation?.totalMaximum ?? "-"} · <strong>Percentage:</strong> {snapshot.data?.calculation?.percentage ?? "-"} · <strong>Result:</strong> {snapshot.data?.calculation?.result ?? "-"}</p></>;
  }
  const evaluations = Object.keys(snapshot.data?.summaryGrades ?? {});
  const areas = evaluations.length ? Object.keys(snapshot.data.summaryGrades[evaluations[0]] ?? {}) : [];
  return <><h4>KG Evaluation Summary</h4><div className="table-wrap"><table><thead><tr><th>Development area</th>{evaluations.map((evaluation) => <th key={evaluation}>Evaluation {evaluation}</th>)}</tr></thead><tbody>
    {areas.map((area) => <tr key={area}><td>{human(area)}</td>{evaluations.map((evaluation) => <td key={evaluation}>{snapshot.data.summaryGrades[evaluation]?.[area] ?? "-"}</td>)}</tr>)}
  </tbody></table></div><h4>Attendance</h4><div className="table-wrap"><table><thead><tr><th>Month</th><th>Working Days</th><th>Days Present</th></tr></thead><tbody>{(snapshot.data?.attendance ?? []).map((row: any) => <tr key={row.month}><td>{human(row.month)}</td><td>{row.workingDays}</td><td>{row.daysPresent}</td></tr>)}</tbody></table></div></>;
}

function human(value: string) { return String(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
