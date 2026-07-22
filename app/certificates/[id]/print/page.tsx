import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PrintButton } from "@/components/print-button";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseCertificateSnapshot } from "@/lib/student-certificates";
import { getSchoolSettings } from "@/lib/school-settings";
import { displayDate } from "@/lib/format";

function renderBody(body: string, snapshot: any) {
  return body
    .replaceAll("{{studentName}}", snapshot.student?.name ?? "")
    .replaceAll("{{conductText}}", snapshot.template?.definition?.customConductText ?? snapshot.template?.definition?.conductStatement ?? "approved")
    .replaceAll("{{academicYear}}", snapshot.academicYear ?? "");
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><dt>{label}</dt><dd>{children || "Not recorded in the certificate snapshot"}</dd></div>;
}

export default async function CertificatePrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ version?: string }> }) {
  await requirePermission("VIEW_CERTIFICATES");
  const id = (await params).id;
  const query = await searchParams;
  const [row, settings] = await Promise.all([prisma.studentCertificate.findUnique({ where: { id } }), getSchoolSettings(prisma)]);
  if (!row) notFound();
  const requestedVersion = Number(query.version ?? row.currentVersionNumber);
  const version = requestedVersion ? await prisma.studentCertificateVersion.findUnique({ where: { certificateId_versionNumber: { certificateId: id, versionNumber: requestedVersion } } }) : null;
  const snapshot = version ? parseCertificateSnapshot(version.snapshotJson) : parseCertificateSnapshot(row.draftDataJson);
  const definition = snapshot.template?.definition ?? {};
  const enabledFields = new Set<string>(Array.isArray(definition.enabledFields) ? definition.enabledFields : []);
  const enabled = (field: string) => enabledFields.has(field);
  const baseLabel = version ? snapshot.versionLabel ?? (version.versionType === "ORIGINAL" ? "ORIGINAL" : version.versionType) : "DRAFT PREVIEW";
  const label = row.status === "CANCELLED" ? "CANCELLED" : version && version.versionNumber < row.currentVersionNumber ? `SUPERSEDED · ${baseLabel}` : baseLabel;
  const history = Array.isArray(snapshot.enrollmentHistory) ? snapshot.enrollmentHistory : [];
  const firstEnrollment = history[0];
  const lastEnrollment = history.at(-1);
  const issueDate = version?.issuedAt ?? row.issuedAt;
  return (
    <main className="certificate-print">
      <div className="no-print page-actions"><PrintButton /></div>
      {label !== "ORIGINAL" ? <div className="certificate-watermark">{label}</div> : null}
      <header>
        <img src={settings.logoPath} alt="School logo" />
        <h1>{settings.schoolName}</h1>
        <p>{settings.addressLine1}, {settings.city}</p>
        <h2>{definition.heading ?? `${row.certificateType} CERTIFICATE`}</h2>
      </header>
      <div className="print-meta">
        <span><strong>Certificate No:</strong> {row.certificateNumber ?? "Allocated only on issue"}</span>
        <span><strong>Issue Date:</strong> {issueDate ? displayDate(issueDate) : "Draft preview"}</span>
      </div>
      <section>
        <p>{renderBody(definition.body ?? "", snapshot)}</p>
        {row.certificateType === "BONAFIDE" && snapshot.enrollmentWording ? <p><strong>Enrollment basis:</strong> {snapshot.enrollmentWording}</p> : null}
        <dl className="certificate-field-table">
          {enabled("studentName") ? <Field label="Student Name">{snapshot.student?.name}</Field> : null}
          {enabled("admissionNumber") ? <Field label="Admission Number">{snapshot.student?.admissionNumber}</Field> : null}
          {enabled("dateOfBirth") ? <Field label="Date of Birth">{snapshot.student?.dateOfBirth ? displayDate(snapshot.student.dateOfBirth) : null}</Field> : null}
          {enabled("fatherName") ? <Field label="Father Name">{snapshot.student?.fatherName}</Field> : null}
          {enabled("motherName") ? <Field label="Mother Name">{snapshot.student?.motherName}</Field> : null}
          {enabled("academicYear") ? <Field label="Academic Year">{snapshot.academicYear}</Field> : null}
          {enabled("className") || enabled("section") ? <Field label="Class / Section">{enabled("className") ? snapshot.currentEnrollment?.className : null} {enabled("section") ? snapshot.currentEnrollment?.section : null}</Field> : null}
          {enabled("admissionDate") ? <Field label="Admission Date">{firstEnrollment?.enrollmentDate ? displayDate(firstEnrollment.enrollmentDate) : null}</Field> : null}
          {enabled("leavingDate") ? <Field label="Leaving Date">{lastEnrollment?.exitDate ? displayDate(lastEnrollment.exitDate) : null}</Field> : null}
          {enabled("lastAttendanceDate") ? <Field label="Last Attendance Date">{snapshot.attendance?.coveredPeriod?.to ? displayDate(snapshot.attendance.coveredPeriod.to) : null}</Field> : null}
          {enabled("attendanceSummary") ? <Field label="Attendance">{snapshot.attendance ? `${snapshot.attendance.recordedDays} recorded days during the covered period` : null}</Field> : null}
          {enabled("reasonForLeaving") ? <Field label="Reason for Leaving">{lastEnrollment?.exitReason}</Field> : null}
          {enabled("promotionDisplay") ? <Field label="Promotion">{snapshot.progression?.display ?? (snapshot.progression?.qualifiedForPromotion ? `Qualified for promotion to ${snapshot.progression.nextClass ?? "next class"}` : "Finalised progression decision recorded")}</Field> : null}
          {enabled("mediumOfInstruction") && definition.mediumOfInstruction ? <Field label="Medium of Instruction">{definition.mediumOfInstruction}</Field> : null}
        </dl>
        {row.certificateType === "STUDY" ? <section><h3>Reviewed Enrollment History</h3><div className="table-wrap"><table><thead><tr><th>Academic Year</th><th>Class</th><th>Section</th><th>Admission Period</th></tr></thead><tbody>{history.map((item: any) => <tr key={`${item.academicYear}-${item.className}`}><td>{item.academicYear}</td><td>{item.className}</td><td>{item.section ?? "-"}</td><td>{item.enrollmentDate ? displayDate(item.enrollmentDate) : "Not recorded"} – {item.exitDate ? displayDate(item.exitDate) : "Current/Not recorded"}</td></tr>)}</tbody></table></div></section> : null}
        {enabled("purpose") ? <p><strong>Purpose:</strong> {snapshot.purpose}</p> : null}
        {snapshot.publicNotes ? <p>{snapshot.publicNotes}</p> : null}
      </section>
      <footer>
        <div className="signature-space"><span>Physical signature</span><strong>{definition.signatories?.[0]?.role ?? "Principal"}</strong></div>
        <p>Typed signatory labels are not digital signatures. This document is not digitally signed.</p>
        <p className="version-label">{label}{version ? ` · VERSION ${version.versionNumber}` : ""}</p>
      </footer>
    </main>
  );
}
