import { PageHeader, StatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import {
  assignmentRoleLabel,
  calculationModeLabel,
  configurationStatusLabel,
  roundingPolicyLabel
} from "@/lib/exam-configuration-labels";
import { listTeacherExamAssignments } from "@/lib/exam-configurations";
import { displayDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function Page() {
  const user = await requirePermission("VIEW_OWN_EXAM_ASSIGNMENTS");
  const assignments = await listTeacherExamAssignments(prisma, user);
  return (
    <div className="page teacher-exam-assignment-page">
      <PageHeader
        title="My Examination Assignments"
        description="Exact timetable-backed paper and component ownership. This phase does not provide a marks-entry grid."
      />
      <section className="card">
        <div className="table-wrap">
          <table className="teacher-exam-assignment-table">
            <thead><tr><th>Examination</th><th>Class / section</th><th>Subject / paper</th><th>Component</th><th>Ownership</th><th>Scheme</th><th>Status</th></tr></thead>
            <tbody>
              {assignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td data-label="Examination"><span>{assignment.examination.name}<br /><small>{assignment.examination.examCode} - {displayDate(assignment.examination.startDate)} - {displayDate(assignment.examination.endDate)}</small></span></td>
                  <td data-label="Class / section"><span>{assignment.className} - {assignment.section}</span></td>
                  <td data-label="Subject / paper"><span>{assignment.subjectPaper.subjectNameSnapshot}<br /><small>{assignment.subjectPaper.paperName}</small></span></td>
                  <td data-label="Component"><span>{assignment.component.name}<br /><small>Maximum {assignment.component.maximumMarks.toString()}</small></span></td>
                  <td data-label="Ownership"><span>{assignmentRoleLabel(assignment.assignmentRole)}</span></td>
                  <td data-label="Scheme"><span>v{assignment.schemeVersion.versionNumber} - {calculationModeLabel(assignment.schemeVersion.calculationMode)}<br /><small>{roundingPolicyLabel(assignment.schemeVersion.roundingPolicyVersion)}</small></span></td>
                  <td data-label="Status"><StatusBadge status={configurationStatusLabel(assignment.examination.status)} /></td>
                </tr>
              ))}
              {!assignments.length ? <tr><td colSpan={7}>No active exact examination assignment is linked to this Teacher account.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
