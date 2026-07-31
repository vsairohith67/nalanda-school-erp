import { redirect } from "next/navigation";
import { PageHeader, StatCard } from "@/components/ui";
import { ReportPublicationWorkspace } from "@/components/report-publication-workspace";
import { requirePermission } from "@/lib/auth";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";
import { prisma } from "@/lib/prisma";
import {
  loadReportPublicationReadiness,
  parsePublishedSnapshot
} from "@/lib/report-publication";
import { listReportPdfJobs } from "@/lib/report-pdf-jobs";

export default async function ReportPublicationPage() {
  const user = await requirePermission("VIEW_REPORT_CARDS");
  if (!["PRINCIPAL", "DIRECTOR", "SUPER_ADMIN"].includes(user.role)) {
    redirect("/unauthorized");
  }
  const [readiness, permissions, cards] = await Promise.all([
    loadReportPublicationReadiness(prisma),
    getEffectivePermissions(prisma, user.role),
    prisma.studentReportCard.findMany({
      where: {
        status: { in: ["ISSUED", "WITHDRAWN"] },
        currentVersionNumber: { gt: 0 }
      },
      include: {
        student: {
          select: { studentName: true, admissionNo: true }
        },
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1
        }
      },
      orderBy: { issuedAt: "desc" }
    })
  ]);
  const history = cards.flatMap((card) => {
    const version = card.versions[0];
    if (!version) return [];
    try {
      const snapshot = parsePublishedSnapshot(version.snapshotJson);
      return [{
        reportCardNumber: card.reportCardNumber,
        publicationReference: snapshot.publicationReference,
        studentName: card.student.studentName,
        admissionNumber: card.student.admissionNo,
        className: snapshot.student.className,
        section: snapshot.student.section,
        title: snapshot.title,
        templateFamily: snapshot.templateFamily,
        status: card.status,
        currentVersion: card.currentVersionNumber,
        updatedAt: card.updatedAt.toISOString(),
        issuedAt: version.issuedAt.toISOString()
      }];
    } catch {
      return [];
    }
  });
  const jobs = listReportPdfJobs(user);
  return (
    <div className="page report-publication-page">
      <PageHeader
        title="Report Publication and Parent Delivery"
        description="Publish exact locked result snapshots, preserve immutable replacements, and generate private colour or printer-safe black-and-white PDFs."
      />
      <div className="grid four">
        <StatCard label="Ready locked runs" value={String(readiness.summary.ready)} />
        <StatCard label="Blocked runs" value={String(readiness.summary.blocked)} />
        <StatCard label="Issued current reports" value={String(history.filter((row) => row.status === "ISSUED").length)} />
        <StatCard label="Withdrawn reports" value={String(history.filter((row) => row.status === "WITHDRAWN").length)} />
      </div>
      <p className="notice">
        Publication and PDFs are governed local capabilities. No cloud deployment or public file
        path is enabled.
      </p>
      <ReportPublicationWorkspace
        runs={readiness.runs}
        history={history}
        initialJobs={jobs}
        permissions={{
          publish: permissionSetCan(permissions, "ISSUE_REPORT_CARDS"),
          correct: permissionSetCan(permissions, "CORRECT_ISSUED_REPORT_CARDS"),
          export: permissionSetCan(permissions, "EXPORT_REPORT_CARD_REPORTS")
        }}
      />
    </div>
  );
}
