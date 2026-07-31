import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader, StatusBadge } from "@/components/ui";
import { ParentReportActions } from "@/components/parent-report-actions";
import { PrintButton } from "@/components/print-button";
import { requireRolePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getParentPublishedReports } from "@/lib/report-parent-delivery";
import { ReportPublicationError } from "@/lib/report-publication";
import { displayDate } from "@/lib/format";

export default async function ParentResultsPage({
  searchParams
}: {
  searchParams: Promise<{ student?: string; card?: string; version?: string }>;
}) {
  const user = await requireRolePermission("VIEW_OWN_REPORT_CARDS", "PARENT");
  const query = await searchParams;
  const data = await getParentPublishedReports(prisma, user.id, query.student).catch((error) => {
    if (error instanceof ReportPublicationError && error.status === 403) redirect("/unauthorized");
    if (error instanceof ReportPublicationError) notFound();
    throw error;
  });
  const selectedLegacyCard = query.card
    ? data.legacyReportCards.find((card: any) => card.reportCardNumber === query.card)
    : null;
  const selectedLegacyVersion = selectedLegacyCard
    ? query.version
      ? selectedLegacyCard.versions.find(
          (version: any) => String(version.versionNumber) === query.version
        )
      : selectedLegacyCard.versions[0]
    : null;
  return (
    <div className="page parent-results-page">
      <PageHeader
        title="Issued Report Cards"
        description="Authenticated access to current issued reports for linked children only. Drafts, previews, moderation, and unpublished reports are never shown."
      />
      {data.children.length > 1 ? (
        <section className="card card-pad">
          <h2>Choose linked child</h2>
          <div className="page-actions">
            {data.children.map((child: {
              studentReference: string;
              studentName: string;
            }) => (
              <Link
                key={child.studentReference}
                className={`button ${child.studentReference === data.selectedChild?.studentReference ? "" : "secondary"}`}
                href={`/parent/results?student=${encodeURIComponent(child.studentReference)}`}
              >
                {child.studentName}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      {!data.selectedChild ? (
        <p className="notice">No child is linked to this Parent account.</p>
      ) : (
        <>
          <section className="card card-pad">
            <h2>{data.selectedChild.studentName}</h2>
            <p>{data.selectedChild.admissionNo} | {data.selectedChild.className}{data.selectedChild.section ? `-${data.selectedChild.section}` : ""}</p>
          </section>
          <section className="card">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Report</th><th>Version</th><th>Status</th><th>Issued</th><th>Authenticated view / download</th></tr></thead>
                <tbody>
                  {data.reportCards.flatMap((card: {
                    reportCardNumber: string;
                    versions: Array<{
                      publicationReference: string;
                      title: string;
                      examination: string;
                      versionNumber: number;
                      status: string;
                      issuedAt: Date;
                      viewable: boolean;
                    }>;
                  }) =>
                    card.versions.map((version) => (
                      <tr key={version.publicationReference}>
                        <td>{version.title}<br /><small>{version.examination} | {version.publicationReference}</small></td>
                        <td>Version {version.versionNumber}</td>
                        <td><StatusBadge status={version.status} /></td>
                        <td>{displayDate(version.issuedAt)}</td>
                        <td><ParentReportActions publicationReference={version.publicationReference} viewable={version.viewable} /></td>
                      </tr>
                    ))
                  )}
                  {!data.reportCards.length ? (
                    <tr><td colSpan={5}>No issued report cards are available for this linked child.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
          {data.legacyReportCards.length ? (
            <section className="card">
              <div className="section-title">
                <div>
                  <h2>Earlier issued report cards</h2>
                  <p>Existing immutable issued reports remain available through the same linked-child boundary.</p>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Report card</th><th>Period</th><th>Type</th><th>Latest version</th><th>Issued</th><th>View / print</th></tr></thead>
                  <tbody>
                    {data.legacyReportCards.map((card: any) => (
                      <tr key={card.reportCardNumber}>
                        <td>{card.title}<br /><small>{card.reportCardNumber}</small></td>
                        <td>{card.reportingPeriod ?? card.academicYear}</td>
                        <td>{card.reportType.replaceAll("_", " ")}</td>
                        <td>Version {card.latestVersion}</td>
                        <td>{card.issuedAt ? displayDate(card.issuedAt) : "-"}</td>
                        <td>
                          <Link href={`/parent/results?student=${encodeURIComponent(data.selectedChild!.studentReference)}&card=${encodeURIComponent(card.reportCardNumber)}`}>
                            Open issued card
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      )}
      {selectedLegacyCard && selectedLegacyVersion ? (
        <section className="card card-pad parent-issued-report">
          <div className="section-title">
            <div>
              <h2>{selectedLegacyCard.title} · Version {selectedLegacyVersion.versionNumber}</h2>
              <p>{selectedLegacyVersion.statusLabel}</p>
            </div>
            <PrintButton />
          </div>
          <StatusBadge status="ISSUED" />
          <dl className="detail-list">
            <div><dt>Student</dt><dd>{selectedLegacyVersion.snapshot.student.name}</dd></div>
            <div><dt>Class / section</dt><dd>{selectedLegacyVersion.snapshot.student.className}{selectedLegacyVersion.snapshot.student.section ? `-${selectedLegacyVersion.snapshot.student.section}` : ""}</dd></div>
            <div><dt>Academic year</dt><dd>{selectedLegacyVersion.snapshot.academicYear}</dd></div>
            <div><dt>Final grade</dt><dd>{selectedLegacyVersion.snapshot.finalGrade ?? "-"}</dd></div>
            <div><dt>Promotion display</dt><dd>{selectedLegacyVersion.snapshot.promotionDisplayText}</dd></div>
          </dl>
          <IssuedLegacyResultContent snapshot={selectedLegacyVersion.snapshot} />
          <h3>Comments</h3>
          <p><strong>Class Teacher:</strong> {selectedLegacyVersion.snapshot.comments?.teacher ?? "-"}</p>
          <p><strong>Principal:</strong> {selectedLegacyVersion.snapshot.comments?.principal ?? "-"}</p>
          <div className="page-actions no-print">
            {selectedLegacyCard.versions.map((version: any) => (
              <Link
                key={version.versionNumber}
                className="button secondary"
                href={`/parent/results?student=${encodeURIComponent(data.selectedChild!.studentReference)}&card=${encodeURIComponent(selectedLegacyCard.reportCardNumber)}&version=${version.versionNumber}`}
              >
                Version {version.versionNumber} · {version.statusLabel}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      <p className="notice">
        Replaced and withdrawn records remain visible as status history, but their report content cannot be opened or downloaded.
      </p>
    </div>
  );
}

function IssuedLegacyResultContent({ snapshot }: { snapshot: any }) {
  if (snapshot.reportType === "MARK_BASED") {
    const subjects = snapshot.data?.calculation?.rows ?? [];
    const calculation = snapshot.data?.calculation;
    return (
      <>
        <h3>Academic result</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Subject</th><th>Component</th><th>Maximum</th><th>Obtained / state</th><th>Weighted</th></tr></thead>
            <tbody>
              {subjects.map((row: any, index: number) => (
                <tr key={`${row.subjectName}-${row.componentName}-${index}`}>
                  <td>{row.subjectName}</td>
                  <td>{row.componentName ?? "-"}</td>
                  <td>{row.maxMarks}</td>
                  <td>{row.status === "PRESENT" ? row.marksObtained : human(row.status)}</td>
                  <td>{row.weightedObtained ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          <strong>Total:</strong> {calculation?.totalObtained ?? "-"} / {calculation?.totalMaximum ?? "-"}
          {" · "}<strong>Percentage:</strong> {calculation?.percentage ?? "-"}
          {" · "}<strong>Result:</strong> {calculation?.result ?? "-"}
        </p>
      </>
    );
  }
  const evaluations = Object.keys(snapshot.data?.summaryGrades ?? {});
  const areas = evaluations.length
    ? Object.keys(snapshot.data.summaryGrades[evaluations[0]] ?? {})
    : [];
  return (
    <>
      <h3>KG evaluation summary</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Development area</th>{evaluations.map((evaluation) => <th key={evaluation}>Evaluation {evaluation}</th>)}</tr></thead>
          <tbody>
            {areas.map((area) => (
              <tr key={area}>
                <td>{human(area)}</td>
                {evaluations.map((evaluation) => (
                  <td key={evaluation}>{snapshot.data.summaryGrades[evaluation]?.[area] ?? "-"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Attendance</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Month</th><th>Working days</th><th>Days present</th></tr></thead>
          <tbody>
            {(snapshot.data?.attendance ?? []).map((row: any) => (
              <tr key={row.month}><td>{human(row.month)}</td><td>{row.workingDays}</td><td>{row.daysPresent}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function human(value: string) {
  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
