"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Option = { id: string; label: string; className?: string; section?: string; subjectId?: string };
export function NotificationCampaignForm({
  templates,
  classes,
  teacherScopes = [],
  teacherMode = false
}: {
  templates: Array<{ id: string; name: string; category: string; defaultPriority: string; titleTemplate: string; bodyTemplate: string; actionLabel: string | null; actionPath: string | null; acknowledgmentRequired: boolean }>;
  classes: Array<{ className: string; section: string }>;
  teacherScopes?: Option[];
  teacherMode?: boolean;
}) {
  const router = useRouter();
  const [campaignId, setCampaignId] = useState("");
  const [campaignNumber, setCampaignNumber] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [dialog, setDialog] = useState<"submit" | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    templateId: "", category: teacherMode ? "ACADEMIC" : "GENERAL", priority: "NORMAL", title: "", body: "",
    actionLabel: "", actionPath: "", audienceType: teacherMode ? "TEACHER_TIMETABLE_SCOPE" : "CLASS_SECTION",
    academicYear: "2026-27", className: classes[0]?.className ?? "", section: classes[0]?.section ?? "",
    subjectId: teacherScopes[0]?.subjectId ?? "", exactIds: "", role: "PARENT", acknowledgmentRequired: false,
    scheduledFor: "", expiresAt: ""
  });

  function chooseTemplate(id: string) {
    const template = templates.find((row) => row.id === id);
    setForm((current) => template ? { ...current, templateId: id, category: template.category, priority: template.defaultPriority, title: template.titleTemplate, body: template.bodyTemplate, actionLabel: template.actionLabel ?? "", actionPath: template.actionPath ?? "", acknowledgmentRequired: template.acknowledgmentRequired } : { ...current, templateId: id });
  }
  function chooseTeacherScope(id: string) {
    const scope = teacherScopes.find((row) => row.id === id);
    if (!scope) return;
    setForm((current) => ({ ...current, className: scope.className ?? "", section: scope.section ?? "", subjectId: scope.subjectId ?? "" }));
  }
  function definition() {
    if (teacherMode || form.audienceType === "TEACHER_TIMETABLE_SCOPE") return { academicYear: form.academicYear, className: form.className, section: form.section, subjectId: form.subjectId };
    if (form.audienceType === "CLASS") return { academicYear: form.academicYear, className: form.className };
    if (form.audienceType === "CLASS_SECTION") return { academicYear: form.academicYear, className: form.className, section: form.section };
    if (form.audienceType === "ROLE") return { role: form.role };
    const keys: Record<string, string> = { SPECIFIC_STUDENTS: "studentIds", SPECIFIC_GUARDIANS: "guardianIds", SPECIFIC_STAFF: "staffIds", SPECIFIC_USERS: "userIds" };
    const key = keys[form.audienceType];
    if (key) return { [key]: form.exactIds.split(",").map((value) => value.trim()).filter(Boolean), ...(key === "studentIds" ? { academicYear: form.academicYear } : {}) };
    return { academicYear: form.academicYear };
  }
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(teacherMode ? "/api/teacher/notifications" : "/api/notifications/campaigns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, audienceDefinition: definition(), scheduledFor: form.scheduledFor || null, expiresAt: form.expiresAt || null })
      });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Unable to save draft");
      setCampaignId(data.campaign.id); setCampaignNumber(data.campaign.campaignNumber); setMessage(`Draft ${data.campaign.campaignNumber} saved.`);
    } catch (value) { setError(value instanceof Error ? value.message : "Unable to save draft"); } finally { setBusy(false); }
  }
  async function previewAudience() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/notifications/campaigns/${campaignId}/preview`, { method: "POST" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Unable to preview audience");
      setPreview(data.preview); setMessage("Audience preview complete. No recipient rows were written.");
    } catch (value) { setError(value instanceof Error ? value.message : "Unable to preview audience"); } finally { setBusy(false); }
  }
  async function submit() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/notifications/campaigns/${campaignId}/workflow`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submit" }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Unable to submit notification");
      setDialog(null); setMessage("Notification submitted for leadership review."); router.refresh();
    } catch (value) { setDialog(null); setError(value instanceof Error ? value.message : "Unable to submit notification"); } finally { setBusy(false); }
  }
  const set = (key: string, value: unknown) => setForm((current) => ({ ...current, [key]: value }));
  return <div className="notification-form-stack">
    <section className="card card-pad">
      <div className="form-grid notification-form">
        {!teacherMode ? <label>Template<select value={form.templateId} onChange={(event) => chooseTemplate(event.target.value)}><option value="">No template</option>{templates.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label> : null}
        <label>Category<select value={form.category} onChange={(e) => set("category", e.target.value)}>{(teacherMode ? ["GENERAL","ACADEMIC","HOMEWORK"] : ["GENERAL","ACADEMIC","ATTENDANCE","HOMEWORK","EXAM","REPORT_CARD","FEE_INFORMATION","LIBRARY","CERTIFICATE","CLASS_X_DOCUMENTS","ID_CARD","SAFETY","EMERGENCY","SYSTEM"]).map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Priority<select value={form.priority} onChange={(e) => set("priority", e.target.value)}><option>NORMAL</option><option>IMPORTANT</option><option>URGENT</option></select></label>
        <label className="wide">Title<input value={form.title} maxLength={120} onChange={(e) => set("title", e.target.value)} /></label>
        <label className="wide">Plain-text message<textarea rows={7} value={form.body} maxLength={2000} onChange={(e) => set("body", e.target.value)} /></label>
        <label>Action label<input value={form.actionLabel} maxLength={80} onChange={(e) => set("actionLabel", e.target.value)} /></label>
        <label>Allowlisted internal path<input value={form.actionPath} placeholder="/parent/homework" onChange={(e) => set("actionPath", e.target.value)} /></label>
        {teacherMode ? <label className="wide">Exact timetable scope<select defaultValue={teacherScopes[0]?.id ?? ""} onChange={(e) => chooseTeacherScope(e.target.value)}>{teacherScopes.map((scope) => <option key={scope.id} value={scope.id}>{scope.label}</option>)}</select></label> : <label>Audience<select value={form.audienceType} onChange={(e) => set("audienceType", e.target.value)}>{["ALL_PARENTS","ALL_TEACHERS","ALL_STAFF","ROLE","CLASS","CLASS_SECTION","SPECIFIC_STUDENTS","SPECIFIC_GUARDIANS","SPECIFIC_STAFF","SPECIFIC_USERS"].map((value) => <option key={value}>{value}</option>)}</select></label>}
        {!teacherMode && form.audienceType === "ROLE" ? <label>Exact role<select value={form.role} onChange={(e) => set("role", e.target.value)}>{["PARENT","TEACHER","ACCOUNTANT","ADMIN","PRINCIPAL","DIRECTOR","VIEWER"].map((value) => <option key={value}>{value}</option>)}</select></label> : null}
        {!teacherMode && ["CLASS","CLASS_SECTION"].includes(form.audienceType) ? <><label>Class<input value={form.className} onChange={(e) => set("className", e.target.value)} /></label>{form.audienceType === "CLASS_SECTION" ? <label>Section<input value={form.section} onChange={(e) => set("section", e.target.value.toUpperCase())} /></label> : null}</> : null}
        {!teacherMode && form.audienceType.startsWith("SPECIFIC_") ? <label className="wide">Exact internal IDs (comma separated)<textarea value={form.exactIds} onChange={(e) => set("exactIds", e.target.value)} /><small>No phone number or email target fields are accepted.</small></label> : null}
        <label>Scheduled for (optional)<input type="datetime-local" value={form.scheduledFor} onChange={(e) => set("scheduledFor", e.target.value)} /></label>
        <label>Expires at (optional)<input type="datetime-local" value={form.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} /></label>
        <label className="check-row"><input type="checkbox" checked={form.acknowledgmentRequired} onChange={(e) => set("acknowledgmentRequired", e.target.checked)} /> Acknowledgment required</label>
      </div>
      <p className="muted-text">IN_APP only. Plain text, allowlisted internal links, immutable audience snapshot at schedule/publication.</p>
      <div className="page-actions"><button type="button" className="secondary" disabled={busy || Boolean(campaignId)} onClick={save}>Save Draft</button>{campaignId ? <button type="button" className="secondary" disabled={busy} onClick={previewAudience}>Preview Audience</button> : null}{preview ? <button type="button" disabled={busy} onClick={() => setDialog("submit")}>Submit for Review</button> : null}</div>
    </section>
    {campaignNumber ? <div className="notice success" role="status"><strong>{campaignNumber}</strong> · {message}</div> : message ? <div className="notice success" role="status">{message}</div> : null}
    {error ? <div className="notice danger" role="alert">{error}</div> : null}
    {preview ? <section className="card card-pad"><h3>Audience Preview — no writes</h3><div className="grid three"><div><strong>{preview.recipientCount}</strong><span>deduplicated users</span></div><div><strong>{preview.skippedCount}</strong><span>skipped targets</span></div><div><strong>0</strong><span>recipient rows written</span></div></div><pre className="notification-json">{JSON.stringify(preview.summary, null, 2)}</pre>{preview.skippedReasons.map((row: any) => <p key={row.reasonCode}>{row.reasonCode}: {row.count}</p>)}</section> : null}
    {dialog ? <div className="confirmation-overlay" role="presentation"><section className="card confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="notification-submit-title"><h3 id="notification-submit-title">Submit Notification for Review</h3><p>Content and audience become review-locked. Approval and publication remain separate leadership actions.</p><div className="page-actions"><button type="button" className="secondary" onClick={() => setDialog(null)}>Go Back</button><button type="button" disabled={busy} onClick={submit}>Submit Notification for Review</button></div></section></div> : null}
  </div>;
}
