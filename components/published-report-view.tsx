import type {
  ReportColourMode,
  SafePublishedReportSnapshot
} from "@/lib/report-publication-types";

export function PublishedReportView({
  report,
  mode = "COLOUR",
  preview = false
}: {
  report: SafePublishedReportSnapshot;
  mode?: ReportColourMode;
  preview?: boolean;
}) {
  return (
    <article
      className={`published-report-view ${mode === "MONOCHROME" ? "report-monochrome" : "report-colour"}`}
      aria-label={`${preview ? "Preview" : "Issued"} report ${report.publicationReference}`}
    >
      <header className="published-report-header">
        <div>
          <p className="published-school-name">{report.school.name}</p>
          <p>{report.school.address}, {report.school.city}{report.school.phone ? ` | ${report.school.phone}` : ""}</p>
        </div>
        <div className="publication-reference">
          <strong>{preview ? "Exact publication preview" : "Issued report"}</strong>
          <span>{report.publicationReference}</span>
          <span>Version {report.versionNumber}</span>
        </div>
      </header>
      <section className="published-report-title">
        <h2>{report.title}</h2>
        <p>{report.examination.code} | {report.examination.name} | {report.reportingPeriod}</p>
      </section>
      <dl className="published-profile">
        <div><dt>Student</dt><dd>{report.student.name}</dd></div>
        <div><dt>Admission number</dt><dd>{report.student.admissionNumber}</dd></div>
        <div><dt>Class / section</dt><dd>{report.student.className}{report.student.section ? ` - ${report.student.section}` : ""}</dd></div>
        <div><dt>Roll number</dt><dd>{report.student.rollNumber ?? "-"}</dd></div>
        <div><dt>Academic year</dt><dd>{report.academicYear}</dd></div>
        <div><dt>Date of birth</dt><dd>{report.student.dateOfBirth ?? "-"}</dd></div>
      </dl>
      {report.templateFamily === "KG_DEVELOPMENTAL_BOOKLET" ? (
        <DevelopmentalSections report={report} />
      ) : (
        <AcademicSections report={report} />
      )}
      <section className="published-report-section">
        <h3>Locked attendance period</h3>
        <dl className="published-profile">
          <div><dt>Period</dt><dd>{report.content.attendance.periodStart} to {report.content.attendance.periodEnd}</dd></div>
          <div><dt>Locked working days</dt><dd>{report.content.attendance.totalLockedDays}</dd></div>
          <div><dt>Recorded days</dt><dd>{report.content.attendance.recordedDays}</dd></div>
          <div><dt>Present equivalent</dt><dd>{report.content.attendance.presentEquivalentDays}</dd></div>
        </dl>
      </section>
      <section className="published-report-section">
        <h3>Remarks</h3>
        <p><strong>Class Teacher:</strong> {report.content.remarks.classTeacher ?? "No approved remark recorded."}</p>
        <p><strong>Principal:</strong> {report.content.remarks.principal ?? "No approved remark recorded."}</p>
        {report.content.remarks.general ? <p>{report.content.remarks.general}</p> : null}
      </section>
      {report.content.legends.length ? (
        <section className="published-report-section">
          <h3>Legend</h3>
          <div className="report-legend">
            {report.content.legends.map((row) => (
              <span key={`${row.code}-${row.label}`}><strong>{row.code}</strong> {row.label}</span>
            ))}
          </div>
        </section>
      ) : null}
      <section className="published-signatures" aria-label="Required signature spaces">
        {report.signatures.map((signature) => (
          <div key={signature.role}><span aria-hidden="true" /><p>{signature.label}</p></div>
        ))}
      </section>
      <footer className="published-report-footer">
        <span>{report.template.name} v{report.template.version} / binding v{report.template.bindingVersion}</span>
        <span>{report.governance.calculationRunReference} / result snapshot v{report.governance.resultSnapshotVersion}</span>
        <span>{report.publicationReference}</span>
      </footer>
    </article>
  );
}

function AcademicSections({ report }: { report: SafePublishedReportSnapshot }) {
  return (
    <>
      <section className="published-report-section">
        <h3>Academic result</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Subject / paper</th><th>Component</th><th>State</th><th>Obtained</th><th>Maximum</th><th>Contribution</th></tr></thead>
            <tbody>
              {report.content.papers.flatMap((paper) =>
                paper.components.map((component, index) => (
                  <tr key={`${paper.code}-${component.code}-${index}`}>
                    <td>{index === 0 ? <>{paper.subjectName}<br /><small>{paper.paperName}</small></> : ""}</td>
                    <td>{component.name}</td>
                    <td>{human(component.state)}</td>
                    <td>{component.state === "PRESENT" ? component.obtained ?? "0.00" : human(component.state)}</td>
                    <td>{component.maximum}</td>
                    <td>{component.contribution ?? "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="report-performance" aria-label={`Overall percentage ${report.content.percentage} percent`}>
          <div className="report-performance-fill" style={{ width: `${boundedPercentage(report.content.percentage)}%` }} />
          <strong>Overall percentage: {report.content.percentage}%</strong>
        </div>
        <dl className="published-profile">
          <div><dt>Total</dt><dd>{report.content.totalObtained} / {report.content.totalMaximum}</dd></div>
          <div><dt>Grade</dt><dd>{report.content.grade ? `${report.content.grade.code} - ${report.content.grade.label}` : "Not enabled"}</dd></div>
          <div><dt>Grade point</dt><dd>{report.content.grade?.point ?? "Not enabled"}</dd></div>
          <div><dt>Pass / result</dt><dd>{report.content.passResult ?? "Not enabled"}</dd></div>
          <div><dt>Rank</dt><dd>{report.content.rank ?? "Not enabled"}</dd></div>
          <div><dt>Cohort average</dt><dd>{report.content.cohortAverage ?? "Not available"}</dd></div>
        </dl>
      </section>
      {report.content.groups.length ? (
        <SimpleTable
          title="Configured subject groups"
          headers={["Group", "Obtained", "Maximum", "Percentage", "Mode"]}
          rows={report.content.groups.map((group) => [
            String(group.groupName ?? group.groupCode ?? "Group"),
            String(group.obtained ?? "-"),
            String(group.maximum ?? "-"),
            String(group.percentage ?? "-"),
            String(group.calculationMode ?? "-")
          ])}
        />
      ) : null}
      {report.content.combinedResults.length ? (
        <SimpleTable
          title="Configured combined result"
          headers={["Examination / term", "Obtained", "Maximum", "Percentage", "Configured weight"]}
          rows={report.content.combinedResults.map((row) => [
            row.label,
            row.obtained,
            row.maximum,
            row.percentage,
            row.configuredWeight ?? "-"
          ])}
        />
      ) : null}
      {report.content.skills.length ? (
        <RatingTable title="Skills and co-scholastic development" rows={report.content.skills} />
      ) : null}
      {report.content.personality.length ? (
        <RatingTable title="Personality development" rows={report.content.personality} />
      ) : null}
    </>
  );
}

function DevelopmentalSections({ report }: { report: SafePublishedReportSnapshot }) {
  return (
    <>
      {report.content.developmentalSections.map((section) => (
        <RatingTable key={section.title} title={section.title} rows={section.items.map((item) => ({
          area: item.area,
          rating: item.rating,
          remarks: item.remarks
        }))} />
      ))}
      <SimpleTable
        title="Academic observations"
        headers={["Area", "Component", "State", "Observation / mark", "Maximum"]}
        rows={report.content.papers.flatMap((paper) =>
          paper.components.map((component) => [
            paper.subjectName,
            component.name,
            human(component.state),
            component.state === "PRESENT" ? component.obtained ?? "0.00" : human(component.state),
            component.maximum
          ])
        )}
      />
    </>
  );
}

function RatingTable({
  title,
  rows
}: {
  title: string;
  rows: Array<{ area: string; rating: string; remarks: string | null }>;
}) {
  return (
    <SimpleTable
      title={title}
      headers={["Area", "Rating", "Remarks"]}
      rows={rows.map((row) => [row.area, row.rating, row.remarks ?? "-"])}
    />
  );
}

function SimpleTable({
  title,
  headers,
  rows
}: {
  title: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <section className="published-report-section">
      <h3>{title}</h3>
      <div className="table-wrap"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>
        {rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}
      </tbody></table></div>
    </section>
  );
}

function human(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function boundedPercentage(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : 0;
}
