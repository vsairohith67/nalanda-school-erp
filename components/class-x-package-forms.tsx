"use client";

import { FormEvent, ReactNode, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type PermissionFlags = { manage?: boolean; review?: boolean; approve?: boolean; custody?: boolean; approveCharge?: boolean; collect?: boolean; waive?: boolean; handover?: boolean };

async function api(url: string, body: Record<string, unknown>, method = "POST") {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The action could not be completed");
  return data;
}

function Dialog({ title, open, onClose, children, busy }: { title: string; open: boolean; onClose: () => void; children: ReactNode; busy?: boolean }) {
  if (!open) return null;
  return <div className="modal-backdrop" role="presentation"><section className="modal-card class-x-dialog" role="dialog" aria-modal="true" aria-labelledby={`dialog-${title.replaceAll(" ", "-")}`}><h2 id={`dialog-${title.replaceAll(" ", "-")}`}>{title}</h2>{children}<div className="modal-actions"><button type="button" className="button secondary" onClick={onClose} disabled={busy}>Cancel</button></div></section></div>;
}

function Feedback({ error, success }: { error?: string; success?: string }) { return <>{error ? <p className="alert danger" role="alert">{error}</p> : null}{success ? <p className="alert success" role="status">{success}</p> : null}</>; }

export function ClassXPackageCreateForm({ students, templates, academicYear }: { students: Array<{ id: string; admissionNo: string; studentName: string; className: string; section: string | null }>; templates: Array<{ id: string; name: string; templateCode: string; paymentRequired: boolean }>; academicYear: string }) {
  const router = useRouter(), [error, setError] = useState(""), [preview, setPreview] = useState<any>(null), [charge, setCharge] = useState<any>(null), [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const values = (form: HTMLFormElement) => Object.fromEntries(new FormData(form).entries());
  async function previewSource() { const form = formRef.current; if (!form || !form.reportValidity()) return; setBusy(true); setError(""); try { const body = values(form); const [e, c] = await Promise.all([api("/api/class-x-documents/eligibility", body), api("/api/class-x-documents/charge-preview", body)]); setPreview(e.eligibility); setCharge(c.preview); } catch (e) { setError(e instanceof Error ? e.message : "Preview failed"); } finally { setBusy(false); } }
  async function create(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); try { const data = await api("/api/class-x-documents", values(event.currentTarget)); router.push(`/class-x-documents/${data.package.id}`); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Creation failed"); setBusy(false); } }
  return <form ref={formRef} className="card form-grid class-x-form" onSubmit={create}>
    <label>Student<select name="studentId" required><option value="">Select Student</option>{students.map((s) => <option key={s.id} value={s.id}>{s.studentName} ({s.admissionNo}) · {s.className}{s.section ? `-${s.section}` : ""}</option>)}</select></label>
    <label>Academic year<input name="academicYear" required defaultValue={academicYear} /></label>
    <label>Package template<select name="templateId" required><option value="">Select active template</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.templateCode}){t.paymentRequired ? " · charge required" : ""}</option>)}</select></label>
    <label className="wide">Purpose<textarea name="purpose" maxLength={500} placeholder="Operational purpose for the package" /></label>
    <label className="wide">Public note<textarea name="publicNotes" maxLength={1000} /></label>
    <div className="wide page-actions"><button type="button" className="button secondary" disabled={busy} onClick={previewSource}>Preview Class X Source & Charge</button><button disabled={busy}>{busy ? "Working…" : "Create Class X Package"}</button></div>
    <Feedback error={error} />
    {preview ? <div className="wide notice"><strong>Source confirmed:</strong> {preview.student.studentName} · Class X {preview.classXEnrollment.academicYear}. This does not claim Board eligibility or mutate lifecycle/progression.</div> : null}
    {charge ? <div className="wide notice"><strong>Charge preview:</strong> ₹{charge.amount} · {charge.itemCode ?? "Not required"}. Financial write created: <strong>{String(charge.financialWriteCreated)}</strong>.</div> : null}
  </form>;
}

export function PackageWorkflowActions({ id, status, updatedAt, permissions }: { id: string; status: string; updatedAt: string; permissions: PermissionFlags }) {
  const router = useRouter(), [dialog, setDialog] = useState<string | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const choices = [
    permissions.manage && status === "DRAFT" ? ["submit", "Submit Class X Package"] : null,
    permissions.review && status === "SUBMITTED" ? ["review", "Start Package Review"] : null,
    permissions.approve && ["UNDER_REVIEW", "DOCUMENTS_PENDING", "PAYMENT_PENDING", "READY_FOR_APPROVAL"].includes(status) ? ["approve", "Approve Class X Package"] : null,
    permissions.handover && ["APPROVED", "READY_FOR_HANDOVER", "PARTIALLY_HANDED_OVER"].includes(status) ? ["complete", "Complete Class X Package"] : null,
    permissions.manage && ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "DOCUMENTS_PENDING", "PAYMENT_PENDING", "READY_FOR_APPROVAL"].includes(status) ? ["cancel", "Cancel Class X Package"] : null,
    permissions.approve && ["APPROVED", "READY_FOR_HANDOVER"].includes(status) ? ["cancel", "Cancel Approved Class X Package"] : null
  ].filter(Boolean) as string[][];
  async function run(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget); try { await api(`/api/class-x-documents/${id}/workflow`, { action: dialog, expectedUpdatedAt: updatedAt, reason: form.get("reason") }); setDialog(null); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Action failed"); } finally { setBusy(false); } }
  return <section className="card"><h3>Package workflow</h3><div className="page-actions">{choices.map(([action, label]) => <button key={action} type="button" className={action === "cancel" ? "button danger" : "button"} onClick={() => { setError(""); setDialog(action); }}>{label}</button>)}</div>{choices.map(([action, label]) => <Dialog key={action} title={label} open={dialog === action} onClose={() => setDialog(null)} busy={busy}><form onSubmit={run} className="form-grid"><p className="wide">This audited action changes only the package workflow. It does not change Student enrollment, lifecycle, progression, marks, report cards, or fee dues.</p>{action === "cancel" ? <label className="wide">Cancellation reason<textarea name="reason" required maxLength={1000} /></label> : null}<Feedback error={error} /><div className="wide modal-actions"><button disabled={busy}>{busy ? "Processing…" : label}</button></div></form></Dialog>)}</section>;
}

export function DocumentItemActions({ packageId, item, certificates, canManage }: { packageId: string; item: any; certificates: Array<{ id: string; certificateType: string; certificateNumber: string | null; currentVersionNumber: number }>; canManage: boolean }) {
  const router = useRouter(), [dialog, setDialog] = useState<string | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  if (!canManage || ["HANDED_OVER", "CANCELLED"].includes(item.status)) return null;
  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const fd = new FormData(event.currentTarget), body = Object.fromEntries(fd.entries());
    try {
      if (dialog === "link") await api(`/api/class-x-documents/${packageId}/documents/${item.id}/link-certificate`, body);
      else await api(`/api/class-x-documents/${packageId}/documents/${item.id}/workflow`, { ...body, action: dialog });
      setDialog(null); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Document action failed"); } finally { setBusy(false); }
  }
  const school = item.issuerType === "SCHOOL";
  return <div className="item-actions">{school ? <button type="button" className="button secondary" onClick={() => setDialog("link")}>Link Issued School Certificate</button> : <>
    {["NOT_STARTED", "REQUESTED", "AWAITING_BOARD"].includes(item.status) ? <button type="button" className="button secondary" onClick={() => setDialog("request")}>Record Request</button> : null}
    {["REQUESTED", "AWAITING_BOARD"].includes(item.status) ? <button type="button" className="button secondary" onClick={() => setDialog("receive")}>Record Board Document Receipt</button> : null}
    {["RECEIVED", "UNDER_VERIFICATION"].includes(item.status) ? <button type="button" className="button secondary" onClick={() => setDialog("verify")}>Verify Board Document</button> : null}
  </>}
  <Dialog title={dialog === "link" ? "Link Issued School Certificate" : dialog === "receive" ? "Record Board Document Receipt" : dialog === "verify" ? "Verify Board Document" : "Record Board Document Request"} open={Boolean(dialog)} onClose={() => setDialog(null)} busy={busy}><form className="form-grid" onSubmit={run}>
    {dialog === "link" ? <><label className="wide">Issued Prompt 18A certificate<select name="certificateId" required><option value="">Select exact Student certificate</option>{certificates.map((c) => <option key={c.id} value={c.id}>{c.certificateType} · {c.certificateNumber} · current version {c.currentVersionNumber}</option>)}</select></label><label>Version number<input name="versionNumber" type="number" min={1} /></label><p className="wide"><a href={`/certificates/new?student=${encodeURIComponent(item.packageStudentId ?? "")}&type=${item.itemType.replace("_CERTIFICATE", "")}`}>Create Missing School Certificate</a> opens Prompt 18A and never issues automatically.</p></> : <>
      {dialog === "request" ? <label>Request date<input name="requestDate" type="date" required /></label> : null}
      {dialog === "receive" ? <><label>Received date<input name="receivedDate" type="date" required /></label><label>External issue date<input name="externalIssueDate" type="date" /></label></> : null}
      {dialog === "verify" ? <label>Verified date<input name="verifiedDate" type="date" required /></label> : null}
      {dialog !== "verify" ? <><label>Board / authority name<input name="authorityName" required maxLength={120} defaultValue={item.authorityName ?? ""} /></label><label>External reference (if policy requires)<input name="externalDocumentReference" maxLength={80} defaultValue={item.externalDocumentReference ?? ""} /></label></> : null}
      <label className="wide">Safe internal note<textarea name="sourceNotes" maxLength={1000} /></label>
      <p className="wide notice">This records custody/status only. No official Board document, branding, scan, security feature, or certificate body is generated or stored.</p>
    </>}
    <Feedback error={error} /><div className="wide modal-actions"><button disabled={busy}>{busy ? "Processing…" : "Confirm Action"}</button></div>
  </form></Dialog></div>;
}

export function PackageChargeActions({ packageId, charge, permissions, academicYear }: { packageId: string; charge: any; permissions: PermissionFlags; academicYear: string }) {
  const router = useRouter(), [dialog, setDialog] = useState<string | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const title = dialog === "approve" ? "Approve Package Charge" : dialog === "collect" ? "Collect Package Payment" : "Waive Document Package Charge";
  async function run(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); const body = Object.fromEntries(new FormData(event.currentTarget).entries()); try { await api(`/api/class-x-documents/${packageId}/payment/${dialog}`, body); setDialog(null); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Payment action failed"); } finally { setBusy(false); } }
  return <section className="card"><h3>Payment actions</h3><div className="page-actions">{permissions.approveCharge && charge.status === "PENDING" ? <button type="button" onClick={() => setDialog("approve")}>Approve Package Charge</button> : null}{permissions.collect && charge.status === "APPROVED_FOR_COLLECTION" ? <button type="button" onClick={() => setDialog("collect")}>Collect Package Payment</button> : null}{permissions.waive && ["PENDING", "APPROVED_FOR_COLLECTION"].includes(charge.status) ? <button type="button" className="button secondary" onClick={() => setDialog("waive")}>Waive Document Package Charge</button> : null}</div>
    <Dialog title={title} open={Boolean(dialog)} onClose={() => setDialog(null)} busy={busy}><form className="form-grid" onSubmit={run}>
      {dialog === "approve" ? <input type="hidden" name="expectedUpdatedAt" value={charge.updatedAt} /> : null}
      {dialog === "collect" ? <><label>Receipt date<input name="receiptDate" type="date" required /></label><label>Full amount<input name="amount" inputMode="decimal" required defaultValue={charge.payableAmount} /></label><label>Payment method<select name="paymentMethod" required defaultValue="CASH"><option>CASH</option><option>UPI</option><option>BANK_TRANSFER</option><option>CHEQUE</option></select></label><label>Received account<select name="receivedAccount"><option value="CASH_COUNTER">School cash counter</option><option value="DIRECTOR_GPAY">Director GPay</option><option value="NPS_CURRENT_ACCOUNT">School current account</option></select></label><label>Transaction reference<input name="transactionReference" maxLength={120} /></label><label>Cheque number<input name="chequeNumber" maxLength={40} /></label><label>Cheque date<input name="chequeDate" type="date" /></label><input type="hidden" name="academicYear" value={academicYear} /></> : null}
      {dialog === "waive" ? <label className="wide">Waiver reason<textarea name="reason" required maxLength={1000} /></label> : null}
      <p className="wide notice">Collection creates one Miscellaneous Income receipt and contributes once to the existing Cash Book source. It creates no fee Payment and no Student fee-ledger mutation.</p>
      <Feedback error={error} /><div className="wide modal-actions"><button disabled={busy}>{busy ? "Processing…" : title}</button></div>
    </form></Dialog>
  </section>;
}

export function HandoverForm({ packageId, items }: { packageId: string; items: Array<{ id: string; displayName: string; issuerType: string }> }) {
  const router = useRouter(), [open, setOpen] = useState(false), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function run(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); const fd = new FormData(event.currentTarget); try { const result = await api(`/api/class-x-documents/${packageId}/handover`, { itemIds: fd.getAll("itemIds"), handoverDate: fd.get("handoverDate"), recipientType: fd.get("recipientType"), recipientName: fd.get("recipientName"), relationship: fd.get("relationship"), identityChecked: fd.get("identityChecked") === "on", identityCheckMethod: fd.get("identityCheckMethod"), recipientAcknowledgementText: fd.get("recipientAcknowledgementText") }); setOpen(false); router.push(`/class-x-documents/${packageId}/handover/${result.handover.id}/print`); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Handover failed"); } finally { setBusy(false); } }
  return <section className="card"><button type="button" disabled={!items.length} onClick={() => setOpen(true)}>Record Document Handover</button>{!items.length ? <p>No document is currently ready for handover.</p> : null}<Dialog title="Record Document Handover" open={open} onClose={() => setOpen(false)} busy={busy}><form className="form-grid" onSubmit={run}><fieldset className="wide"><legend>Ready documents</legend>{items.map((item) => <label className="check-row" key={item.id}><input type="checkbox" name="itemIds" value={item.id} /> {item.displayName} ({item.issuerType})</label>)}</fieldset><label>Handover date<input type="date" name="handoverDate" required /></label><label>Recipient type<select name="recipientType" required><option>STUDENT</option><option>GUARDIAN</option><option>AUTHORISED_REPRESENTATIVE</option></select></label><label>Recipient name<input name="recipientName" required maxLength={120} /></label><label>Relationship<input name="relationship" maxLength={80} /></label><label>Identity check category<select name="identityCheckMethod" required><option>SCHOOL_RECORD_MATCH</option><option>SCHOOL_ID_CHECK</option><option>AUTHORISATION_LETTER_CHECK</option><option>KNOWN_GUARDIAN_CONFIRMATION</option><option>OTHER_APPROVED_CATEGORY</option></select></label><label className="check-row"><input type="checkbox" name="identityChecked" required /> Identity checked; no ID number stored</label><label className="wide">Acknowledgement text<textarea name="recipientAcknowledgementText" required defaultValue="I acknowledge physical receipt of the listed documents." maxLength={1000} /></label><p className="wide notice">Typed names are operational records, not digital signatures. The printout includes blank physical-signature lines.</p><Feedback error={error} /><div className="wide modal-actions"><button disabled={busy}>{busy ? "Recording…" : "Record Document Handover"}</button></div></form></Dialog></section>;
}

export function ClassXConfigurationForms({ academicYear, defaultDefinition }: { academicYear: string; defaultDefinition: string }) {
  const router = useRouter(), [error, setError] = useState(""), [success, setSuccess] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>, endpoint: string) { event.preventDefault(); setError(""); setSuccess(""); const form = event.currentTarget, fd = new FormData(form), body: Record<string, unknown> = Object.fromEntries(fd.entries()); for (const key of ["paymentRequired", "waiverAllowed"]) body[key] = fd.get(key) === "on"; try { await api(endpoint, body); setSuccess("Configuration saved."); form.reset(); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Configuration failed"); } }
  return <div className="dashboard-grid"><form className="card form-grid" onSubmit={(e) => submit(e, "/api/class-x-documents/templates")}><h3 className="wide">New checklist template</h3><label>Template code<input name="templateCode" required placeholder="CLASS-X-2026" /></label><label>Name<input name="name" required /></label><label>Academic year<input name="academicYear" defaultValue={academicYear} /></label><label>School Board<input name="schoolBoard" maxLength={120} /></label><label>Status<select name="status"><option>DRAFT</option><option>ACTIVE</option></select></label><label className="check-row"><input name="paymentRequired" type="checkbox" /> Payment required</label><label className="wide">Strict document definition JSON<textarea name="documentDefinitionJson" required rows={14} defaultValue={defaultDefinition} /></label><label className="wide">Instructions<textarea name="instructions" maxLength={2000} /></label><button className="wide">Create Package Template</button></form>
  <form className="card form-grid" onSubmit={(e) => submit(e, "/api/class-x-documents/charge-rules")}><h3 className="wide">New service-charge rule</h3><label>Rule code<input name="ruleCode" required placeholder="CLASS-X-SERVICE-2026" /></label><label>Name<input name="name" required /></label><label>Academic year<input name="academicYear" defaultValue={academicYear} /></label><label>Amount<input name="amount" required inputMode="decimal" /></label><label>Misc. Income item code<input name="miscellaneousIncomeItemCode" required defaultValue="CLASS-X-CERT" /></label><label>Status<select name="status"><option>ACTIVE</option><option>INACTIVE</option></select></label><label className="check-row"><input name="paymentRequired" type="checkbox" defaultChecked /> Payment required</label><label className="check-row"><input name="waiverAllowed" type="checkbox" /> Waiver allowed</label><label className="wide">Notes<textarea name="notes" maxLength={1000} /></label><button className="wide">Create Charge Rule</button></form><Feedback error={error} success={success} /></div>;
}

export function ClassXConfigurationStatusButton({ endpoint, status, label }: { endpoint: string; status: string; label: string }) {
  const router = useRouter(), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const nextStatus = status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  async function changeStatus() {
    setBusy(true);
    setError("");
    try {
      await api(endpoint, { status: nextStatus }, "PATCH");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Unable to update ${label}`);
    } finally {
      setBusy(false);
    }
  }
  return <div className="item-actions"><button type="button" className="button secondary" disabled={busy} onClick={changeStatus}>{busy ? "Updating…" : `${nextStatus === "ACTIVE" ? "Activate" : "Inactivate"} ${label}`}</button><Feedback error={error} /></div>;
}

export function ParentClassXRequestForm({ childAdmissionNo, templates, academicYear }: { childAdmissionNo: string; templates: Array<{ id: string; name: string }>; academicYear: string }) {
  const router = useRouter(), [open, setOpen] = useState(false), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); const body = Object.fromEntries(new FormData(event.currentTarget).entries()); try { await api("/api/parent/class-x-documents", body); setOpen(false); router.push(`/parent/class-x-documents?student=${encodeURIComponent(childAdmissionNo)}`); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Request failed"); } finally { setBusy(false); } }
  return <><button type="button" onClick={() => setOpen(true)}>Request Class X Package</button><Dialog title="Submit Class X Package" open={open} onClose={() => setOpen(false)} busy={busy}><form className="form-grid" onSubmit={submit}><input type="hidden" name="admissionNo" value={childAdmissionNo} /><input type="hidden" name="academicYear" value={academicYear} /><label className="wide">Active package template<select name="templateId" required>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label className="wide">Purpose<textarea name="purpose" required maxLength={500} /></label><p className="wide notice">You can request only for this linked child. The school verifies eligibility, official procedures, documents, charges, and readiness.</p><Feedback error={error} /><div className="wide modal-actions"><button disabled={busy}>{busy ? "Submitting…" : "Submit Class X Package"}</button></div></form></Dialog></>;
}
