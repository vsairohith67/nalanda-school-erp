"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PROGRESSION_DECISION_TYPES, decisionLabel } from "@/lib/student-progression";
import { useSecurityDialog } from "@/components/security-dialog-provider";

type Enrollment = { id: string; academicYear: string; className: string; section: string | null; status: string };
type StudentOption = { id: string; admissionNo: string; studentName: string; academicYearEnrollments: Enrollment[] };
type Decision = Record<string, any> & { id: string; status: string; decisionType: string; studentId: string; sourceEnrollmentId: string | null };

export function StudentProgressionForm({ students, decision, permissions }: { students: StudentOption[]; decision?: Decision | null; permissions: { manage: boolean; approve: boolean; finalize: boolean } }) {
  const router = useRouter();
  const requestDialog = useSecurityDialog();
  const initialStudent = decision?.studentId ?? students[0]?.id ?? "";
  const initialEnrollment = decision?.sourceEnrollmentId ?? students.find((row) => row.id === initialStudent)?.academicYearEnrollments[0]?.id ?? "";
  const initialEnrollmentRow = students.find((row) => row.id === initialStudent)?.academicYearEnrollments.find((row) => row.id === initialEnrollment);
  const [form, setForm] = useState<Record<string, string>>({
    studentId: initialStudent, sourceEnrollmentId: initialEnrollment, academicYear: decision?.academicYear ?? initialEnrollmentRow?.academicYear ?? "",
    decisionType: decision?.decisionType ?? "PROMOTE", effectiveDate: dateValue(decision?.effectiveDate) || new Date().toISOString().slice(0, 10),
    toAcademicYear: decision?.toAcademicYear ?? "", toClass: decision?.toClass ?? "", toSection: decision?.toSection ?? "",
    reason: decision?.reason ?? "", evidenceNotes: decision?.evidenceNotes ?? "", marksSummary: decision?.marksSummary ?? "",
    attendanceSummary: decision?.attendanceSummary ?? "", parentRequestNotes: decision?.parentRequestNotes ?? "",
    parentAcknowledgementNotes: decision?.parentAcknowledgementNotes ?? "", feeWarningNotes: decision?.feeWarningNotes ?? "",
    udiseReviewNotes: decision?.udiseReviewNotes ?? "", destinationSchool: decision?.destinationSchool ?? "", followUpNotes: decision?.followUpNotes ?? ""
  });
  const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const student = useMemo(() => students.find((row) => row.id === form.studentId), [students, form.studentId]);
  const enrollment = student?.academicYearEnrollments.find((row) => row.id === form.sourceEnrollmentId);
  const editable = permissions.manage && (!decision || decision.status === "DRAFT");
  function update(name: string, value: string) { setForm((current) => ({ ...current, [name]: value })); }
  function chooseStudent(studentId: string) { const row = students.find((item) => item.id === studentId); const source = row?.academicYearEnrollments[0]; setForm((current) => ({ ...current, studentId, sourceEnrollmentId: source?.id ?? "", academicYear: source?.academicYear ?? "" })); }
  function chooseEnrollment(id: string) { const source = student?.academicYearEnrollments.find((row) => row.id === id); setForm((current) => ({ ...current, sourceEnrollmentId: id, academicYear: source?.academicYear ?? current.academicYear })); }
  async function act(action: string) {
    if (action === "finalize" && !await requestDialog({ title: "Finalize progression decision?", message: "This changes enrollment status and writes permanent lifecycle history. It cannot be casually undone.", confirmLabel: "Finalize decision" })) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(decision ? `/api/students/progression/${decision.id}` : "/api/students/progression", { method: decision ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, action, reason: ["reject", "cancel"].includes(action) ? reason : form.reason }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to update progression decision");
      if (!decision) { router.push(`/students/progression/${data.decision.id}`); return; }
      setMessage(`${decisionLabel(action)} completed safely.`); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update progression decision"); } finally { setBusy(false); }
  }
  return <div className="progression-stack">
    {editable ? <section className="card card-pad"><div className="form-grid progression-form-grid">
      <label>Student<select aria-label="Student" value={form.studentId} onChange={(e) => chooseStudent(e.target.value)} disabled={Boolean(decision)}><option value="">Choose student</option>{students.map((row) => <option key={row.id} value={row.id}>{row.admissionNo} - {row.studentName}</option>)}</select></label>
      <label>Source enrollment<select aria-label="Source Enrollment" value={form.sourceEnrollmentId} onChange={(e) => chooseEnrollment(e.target.value)}><option value="">Choose enrollment</option>{student?.academicYearEnrollments.map((row) => <option key={row.id} value={row.id}>{row.academicYear} / {row.className}{row.section ? `-${row.section}` : ""} / {decisionLabel(row.status)}</option>)}</select></label>
      <label>Decision type<select aria-label="Decision Type" value={form.decisionType} onChange={(e) => update("decisionType", e.target.value)}>{PROGRESSION_DECISION_TYPES.map((value) => <option key={value} value={value}>{decisionLabel(value)}</option>)}</select></label>
      <label>Effective date<input aria-label="Effective Date" type="date" value={form.effectiveDate} onChange={(e) => update("effectiveDate", e.target.value)} /></label>
      <label>Target academic year<input aria-label="Target Academic Year" value={form.toAcademicYear} onChange={(e) => update("toAcademicYear", e.target.value)} placeholder="Required for promote/repeat" /></label>
      <label>Target class<input aria-label="Target Class" value={form.toClass} onChange={(e) => update("toClass", e.target.value)} /></label>
      <label>Target section<input aria-label="Target Section" value={form.toSection} onChange={(e) => update("toSection", e.target.value)} /></label>
      <label>Destination school <span className="muted-text">(optional)</span><input aria-label="Destination School" value={form.destinationSchool} onChange={(e) => update("destinationSchool", e.target.value)} /></label>
      <label className="wide">Reason<textarea aria-label="Reason" value={form.reason} onChange={(e) => update("reason", e.target.value)} /></label>
      <label className="wide">Evidence / decision notes<textarea aria-label="Evidence Notes" value={form.evidenceNotes} onChange={(e) => update("evidenceNotes", e.target.value)} /></label>
      <label className="wide">Parent request notes <span className="muted-text">(optional)</span><textarea aria-label="Parent Request Notes" value={form.parentRequestNotes} onChange={(e) => update("parentRequestNotes", e.target.value)} /></label>
      <label className="wide">Parent acknowledgement notes<textarea aria-label="Parent Acknowledgement Notes" value={form.parentAcknowledgementNotes} onChange={(e) => update("parentAcknowledgementNotes", e.target.value)} /></label>
      <label className="wide">Marks summary <span className="muted-text">(text only; no marks module)</span><textarea aria-label="Marks Summary" value={form.marksSummary} onChange={(e) => update("marksSummary", e.target.value)} /></label>
      <label className="wide">Attendance summary <span className="muted-text">(text only)</span><textarea aria-label="Attendance Summary" value={form.attendanceSummary} onChange={(e) => update("attendanceSummary", e.target.value)} /></label>
      <label className="wide">Fee warning <span className="muted-text">(informational only; never blocks progression)</span><textarea aria-label="Fee Warning Notes" value={form.feeWarningNotes} onChange={(e) => update("feeWarningNotes", e.target.value)} /></label>
      <label className="wide">UDISE review notes <span className="muted-text">(no export in this phase)</span><textarea aria-label="UDISE Review Notes" value={form.udiseReviewNotes} onChange={(e) => update("udiseReviewNotes", e.target.value)} /></label>
      <label className="wide">Follow-up notes <span className="muted-text">(optional)</span><textarea aria-label="Follow Up Notes" value={form.followUpNotes} onChange={(e) => update("followUpNotes", e.target.value)} /></label>
      <div className="full notice notice-warning"><strong>Preview only until finalization.</strong><br />Source: {enrollment ? `${enrollment.academicYear} / ${enrollment.className}${enrollment.section ? `-${enrollment.section}` : ""} / ${decisionLabel(enrollment.status)}` : "Choose an enrollment"}. Outcome: {decisionLabel(form.decisionType)}{form.toAcademicYear ? ` into ${form.toAcademicYear}` : ""}{form.toClass ? ` / ${form.toClass}${form.toSection ? `-${form.toSection}` : ""}` : ""}.</div>
      <div className="full page-actions"><button type="button" className="secondary" disabled={busy} onClick={() => act(decision ? "edit" : "draft")}>Save Draft</button><button type="button" disabled={busy} onClick={() => act("submit")}>{decision ? "Submit for Approval" : "Save and Submit"}</button></div>
    </div></section> : null}
    {decision ? <section className="card card-pad progression-workflow"><h3>Workflow actions</h3>
      {decision.status === "PENDING_APPROVAL" && permissions.approve ? <><button type="button" disabled={busy} onClick={() => act("approve")}>Approve Decision</button><label>Rejection reason (required)<textarea aria-label="Rejection Reason" value={reason} onChange={(e) => setReason(e.target.value)} /></label><button type="button" className="danger" disabled={busy} onClick={() => act("reject")}>Reject Decision</button></> : null}
      {decision.status === "APPROVED" && permissions.finalize ? <div className="notice notice-warning"><strong>Irreversible confirmation</strong><p>Finalization updates the source enrollment, may create a target enrollment, and appends lifecycle history in one transaction.</p><button type="button" className="danger" disabled={busy || decision.decisionType === "CORRECTION"} onClick={() => act("finalize")}>{decision.decisionType === "CORRECTION" ? "Correction Finalization Not Available" : "Finalize Decision"}</button></div> : null}
      {["DRAFT", "PENDING_APPROVAL"].includes(decision.status) && permissions.manage ? <><label>Cancellation reason (required)<textarea aria-label="Cancellation Reason" value={reason} onChange={(e) => setReason(e.target.value)} /></label><button type="button" className="danger" disabled={busy} onClick={() => act("cancel")}>Cancel Decision</button></> : null}
    </section> : null}
    {message ? <div className="notice success-notice" role="status">{message}</div> : null}{error ? <div className="notice notice-danger" role="alert">{error}</div> : null}
  </div>;
}
function dateValue(value: unknown) { if (!value) return ""; const date = new Date(String(value)); return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10); }
