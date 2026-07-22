"use client";
import { FormEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

function useApi() {
  const router = useRouter(), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function send(url: string, body: any, method = "POST") { setBusy(true); setError(""); try { const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Operation failed."); router.refresh(); return data; } catch (error) { setError(error instanceof Error ? error.message : "Operation failed."); throw error; } finally { setBusy(false); } }
  return { router, error, busy, send };
}

export function IdentityCardDraftForm({ students, staff, templates, academicYear }: { students: any[]; staff: any[]; templates: any[]; academicYear: string }) {
  const api = useApi(), formRef = useRef<HTMLFormElement>(null), [cardType, setCardType] = useState("STUDENT"), [preview, setPreview] = useState<any>(null);
  const relevantTemplates = useMemo(() => templates.filter((row) => row.cardType === cardType), [templates, cardType]);
  function payload(form: HTMLFormElement) { const f = new FormData(form); return { cardType, studentId: cardType === "STUDENT" ? f.get("personId") : null, staffMemberId: cardType === "STAFF" ? f.get("personId") : null, templateId: f.get("templateId"), academicYear: f.get("academicYear"), validFrom: f.get("validFrom"), validUntil: f.get("validUntil") }; }
  async function previewSource() { if (!formRef.current?.reportValidity()) return; try { setPreview((await api.send("/api/id-cards/source-preview", payload(formRef.current))).preview); } catch {} }
  async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); if (!preview) return; try { const data = await api.send("/api/id-cards", payload(e.currentTarget)); api.router.push(`/id-cards/${data.card.id}`); } catch {} }
  return <form ref={formRef} className="card form-grid identity-card-form" onSubmit={submit}>
    <label>Card type<select value={cardType} onChange={(e) => { setCardType(e.target.value); setPreview(null); }}><option>STUDENT</option><option>STAFF</option></select></label>
    <label>{cardType === "STUDENT" ? "Active Student enrollment" : "Active StaffMember"}<select name="personId" required>{(cardType === "STUDENT" ? students : staff).map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
    <label>Active template<select name="templateId" required>{relevantTemplates.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
    <label>Academic year<input name="academicYear" defaultValue={academicYear} required/></label>
    <label>Valid from<input name="validFrom" type="date" defaultValue={`${new Date().getFullYear()}-06-01`} required/></label>
    <label>Valid until<input name="validUntil" type="date" defaultValue={`${new Date().getFullYear() + 1}-05-31`} required/></label>
    <div className="field-span page-actions"><button type="button" className="secondary" disabled={api.busy} onClick={previewSource}>Preview Identity and Number</button><button disabled={api.busy || !preview}>Generate ID Card Draft</button></div>
    {preview ? <div className="field-span notice success"><strong>Preview only — no card or number allocated.</strong><br/>{preview.identity?.name} · {preview.identity?.admissionNumber ?? preview.identity?.staffCode ?? "School code unavailable"} · photo placeholder</div> : null}
    {api.error ? <p className="error field-span" role="alert">{api.error}</p> : null}
  </form>;
}

export function IdentityCardWorkflowActions({ id, status, updatedAt, permissions }: { id: string; status: string; updatedAt: string; permissions: string[] }) {
  const api = useApi(), [dialog, setDialog] = useState<string | null>(null), [reason, setReason] = useState("");
  const labels: Record<string, string> = { review: "Send ID Card for Review", approve: "Approve ID Card", issue: "Issue ID Card", correct: "Issue Corrected ID Card", replace: "Replace Lost or Damaged ID Card", revoke: "Revoke ID Card", cancel: "Cancel ID Card" };
  const allowed = [
    ...(status === "DRAFT" && permissions.includes("CREATE_ID_CARDS") ? ["review", "cancel"] : []),
    ...(status === "READY_FOR_REVIEW" && permissions.includes("APPROVE_ID_CARDS") ? ["approve"] : []),
    ...(status === "READY_FOR_REVIEW" && permissions.includes("CREATE_ID_CARDS") ? ["cancel"] : []),
    ...(status === "APPROVED" && permissions.includes("ISSUE_ID_CARDS") ? ["issue"] : []),
    ...(status === "APPROVED" && permissions.includes("CREATE_ID_CARDS") ? ["cancel"] : []),
    ...(status === "ISSUED" && permissions.includes("CORRECT_ISSUED_ID_CARDS") ? ["correct"] : []),
    ...(status === "ISSUED" && permissions.includes("REPLACE_ID_CARDS") ? ["replace"] : []),
    ...(status === "ISSUED" && permissions.includes("REVOKE_ID_CARDS") ? ["revoke"] : [])
  ];
  const needsReason = ["correct", "replace", "revoke", "cancel"].includes(dialog ?? "");
  async function act() { if (!dialog) return; try { const data = await api.send(`/api/id-cards/${id}/workflow`, { action: dialog, expectedUpdatedAt: updatedAt, reason }); setDialog(null); setReason(""); if (dialog === "replace" && data.result?.id) api.router.push(`/id-cards/${data.result.id}`); } catch {} }
  return <section className="card card-pad"><h3>ID Card Workflow</h3><div className="page-actions">{allowed.map((action) => <button key={action} type="button" className={["revoke", "cancel"].includes(action) ? "danger" : ""} onClick={() => setDialog(action)}>{labels[action]}</button>)}</div>{api.error ? <p className="error" role="alert">{api.error}</p> : null}
    {dialog ? <div className="dialog-backdrop" role="presentation"><section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="id-card-dialog-title"><h3 id="id-card-dialog-title">{labels[dialog]}</h3><p>This permission-checked action preserves immutable versions and append-only history.</p>{needsReason ? <label>Reason<textarea autoFocus required maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)}/></label> : null}<div className="page-actions"><button type="button" className="secondary" onClick={() => setDialog(null)}>Go Back</button><button type="button" className={["revoke", "cancel"].includes(dialog) ? "danger" : ""} disabled={api.busy || (needsReason && !reason.trim())} onClick={act}>{labels[dialog]}</button></div></section></div> : null}
  </section>;
}

export function IdentityCardConfigurationForms({ academicYear }: { academicYear: string }) {
  const api = useApi(), [cardType, setCardType] = useState("STUDENT");
  async function series(e: FormEvent<HTMLFormElement>) { e.preventDefault(); try { await api.send("/api/id-cards/number-series", Object.fromEntries(new FormData(e.currentTarget))); e.currentTarget.reset(); } catch {} }
  async function template(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget), type = String(f.get("cardType")); const front = type === "STUDENT" ? { title: "STUDENT ID CARD", fields: ["schoolName", "schoolLogo", "studentName", "admissionNumber", "className", "section", "academicYear", "photoPlaceholder", "cardNumber", "barcode", "versionStatus"] } : { title: "STAFF ID CARD", fields: ["schoolName", "schoolLogo", "staffName", "staffCode", "designation", "department", "photoPlaceholder", "cardNumber", "barcode", "versionStatus"] }; const back = { title: "SCHOOL ID CARD", fields: ["validFrom", "validUntil", ...(type === "STAFF" ? ["primarySubject"] : []), "schoolAddress", "schoolOfficeContact", "returnToSchool", "issuingRole"], footer: "This card is an operational school identity card. It is not a government identity document." }; try { await api.send("/api/id-cards/templates", { templateCode: f.get("templateCode"), cardType: type, name: f.get("name"), academicYear: f.get("academicYear"), status: "ACTIVE", frontDefinition: front, backDefinition: back, photoRequired: false, barcodeEnabled: f.get("barcodeEnabled") === "on", printSettings: { colour: true, cutGuides: true } }); e.currentTarget.reset(); } catch {} }
  return <div className="two-column">
    <form className="card form-grid" onSubmit={series}><h3 className="field-span">Create Number Series</h3><label>Series code<input name="seriesCode" required/></label><label>Card type<select name="cardType"><option>STUDENT</option><option>STAFF</option></select></label><label>Academic year<input name="academicYear" defaultValue={academicYear}/></label><label>Prefix<input name="prefix" placeholder="NPS-ID-STU-"/></label><label>Next number<input name="nextNumber" type="number" min="1" defaultValue="1"/></label><label>Padding<input name="paddingLength" type="number" min="1" max="10" defaultValue="4"/></label><button>Create Series</button></form>
    <form className="card form-grid" onSubmit={template}><h3 className="field-span">Create Active Safe Template</h3><label>Template code<input name="templateCode" required/></label><label>Card type<select name="cardType" value={cardType} onChange={(e) => setCardType(e.target.value)}><option>STUDENT</option><option>STAFF</option></select></label><label>Name<input name="name" required/></label><label>Academic year<input name="academicYear" defaultValue={academicYear}/></label><label className="checkbox-row"><input type="checkbox" name="barcodeEnabled" defaultChecked/>Code 39 card-number barcode</label><p className="field-span muted">Photo uses a placeholder because no managed Student/Staff photo source exists. Personal or external image URLs are never accepted.</p><button>Create and Activate Template</button></form>
    {api.error ? <p className="error" role="alert">{api.error}</p> : null}
  </div>;
}

export function IdentityCardConfigurationStatusAction({ kind, id, status }: { kind: "template" | "number-series"; id: string; status: string }) {
  const api = useApi(), [open, setOpen] = useState(false);
  const next = status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  const noun = kind === "template" ? "Template" : "Number Series";
  const title = `${next === "ACTIVE" ? "Activate" : "Inactivate"} ID Card ${noun}`;
  async function apply() {
    try {
      await api.send(`/api/id-cards/${kind === "template" ? "templates" : "number-series"}/${id}`, { status: next }, "PATCH");
      setOpen(false);
    } catch {}
  }
  return <><button type="button" className="secondary" onClick={() => setOpen(true)}>{next === "ACTIVE" ? "Activate" : "Inactivate"}</button>{open ? <div className="dialog-backdrop"><section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby={`configuration-${id}`}><h3 id={`configuration-${id}`}>{title}</h3><p>New issue operations use active configuration only. Existing issued cards remain immutable.</p><div className="page-actions"><button type="button" className="secondary" onClick={() => setOpen(false)}>Go Back</button><button type="button" disabled={api.busy} onClick={apply}>{title}</button></div>{api.error ? <p className="error" role="alert">{api.error}</p> : null}</section></div> : null}</>;
}

export function IdentityCardBatchForm({ templates, academicYear }: { templates: any[]; academicYear: string }) {
  const api = useApi(), [cardType, setCardType] = useState("STUDENT");
  async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); try { const data = await api.send("/api/id-cards/batches", Object.fromEntries(f)); api.router.push(`/id-cards/batches/${data.batch.id}`); } catch {} }
  return <form className="card form-grid" onSubmit={submit}><label>Card type<select name="cardType" value={cardType} onChange={(e) => setCardType(e.target.value)}><option>STUDENT</option><option>STAFF</option></select></label><label>Scope<select name="scopeType">{cardType === "STUDENT" ? <><option>CLASS_SECTION</option><option>ACTIVE_STUDENTS</option></> : <><option>ACTIVE_STAFF</option><option>STAFF_DESIGNATION</option></>}</select></label><label>Active template<select name="templateId">{templates.filter((row) => row.cardType === cardType).map((row) => <option value={row.id} key={row.id}>{row.name}</option>)}</select></label><label>Academic year<input name="academicYear" defaultValue={academicYear}/></label>{cardType === "STUDENT" ? <><label>Exact class<input name="className"/></label><label>Exact section<input name="section"/></label></> : <label>Exact designation<input name="staffDesignation"/></label>}<label>Valid from<input name="validFrom" type="date" defaultValue={`${new Date().getFullYear()}-06-01`} required/></label><label>Valid until<input name="validUntil" type="date" defaultValue={`${new Date().getFullYear() + 1}-05-31`} required/></label><label className="field-span">Notes<textarea name="notes"/></label>{api.error ? <p className="error field-span" role="alert">{api.error}</p> : null}<button>Create ID Card Batch</button></form>;
}

export function IdentityCardBatchActions({ id, status, updatedAt, permissions }: { id: string; status: string; updatedAt: string; permissions: string[] }) {
  const api = useApi(), [dialog, setDialog] = useState<string | null>(null), [reason, setReason] = useState("");
  const labels: Record<string, string> = { preview: "Preview ID Card Batch", approve: "Approve ID Card Batch", issue: "Issue ID Card Batch", cancel: "Cancel ID Card Batch" };
  const actions = [...(["DRAFT", "PREVIEWED"].includes(status) && permissions.includes("MANAGE_ID_CARD_BATCHES") ? ["preview", "cancel"] : []), ...(status === "PREVIEWED" && permissions.includes("APPROVE_ID_CARDS") ? ["approve"] : []), ...(status === "APPROVED" && permissions.includes("ISSUE_ID_CARDS") ? ["issue"] : [])];
  async function act() { if (!dialog) return; try { await api.send(`/api/id-cards/batches/${id}/workflow`, { action: dialog, expectedUpdatedAt: updatedAt, reason }); setDialog(null); setReason(""); } catch {} }
  return <section className="card card-pad"><h3>Batch Workflow</h3><div className="page-actions">{actions.map((action) => <button type="button" key={action} className={action === "cancel" ? "danger" : ""} onClick={() => setDialog(action)}>{labels[action]}</button>)}</div>{api.error ? <p className="error" role="alert">{api.error}</p> : null}{dialog ? <div className="dialog-backdrop"><section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="batch-dialog-title"><h3 id="batch-dialog-title">{labels[dialog]}</h3><p>{dialog === "preview" ? "Preview writes no cards and consumes no numbers." : "The approved scope is revalidated transactionally before issue."}</p>{dialog === "cancel" ? <label>Reason<textarea autoFocus required value={reason} onChange={(e) => setReason(e.target.value)}/></label> : null}<div className="page-actions"><button type="button" className="secondary" onClick={() => setDialog(null)}>Go Back</button><button type="button" disabled={api.busy || (dialog === "cancel" && !reason.trim())} onClick={act}>{labels[dialog]}</button></div></section></div> : null}</section>;
}

export function IdentityCardLookupForm() {
  const [number, setNumber] = useState(""), [result, setResult] = useState<any>(null), [error, setError] = useState("");
  async function submit(e: FormEvent) { e.preventDefault(); setError(""); setResult(null); const response = await fetch(`/api/id-cards/lookup?cardNumber=${encodeURIComponent(number)}`), data = await response.json(); if (!response.ok) setError(data.error ?? "Lookup failed."); else setResult(data.result); }
  return <><form className="card form-grid" onSubmit={submit}><label>Exact card number<input value={number} onChange={(e) => setNumber(e.target.value)} required autoComplete="off"/></label><button>Exact Authenticated Lookup</button>{error ? <p role="alert" className="error field-span">{error}</p> : null}</form>{result ? <section className="card card-pad lookup-result"><h3>{result.warning ?? result.cardStatus}</h3><p><strong>{result.cardNumber}</strong> · {result.cardType}</p><p>{result.name}</p><p>{result.className ? `${result.className}${result.section ? ` · ${result.section}` : ""}` : result.designation}</p><p>Valid until {String(result.validUntil).slice(0, 10)} · Photo placeholder</p><p className="muted">This exact lookup identifies a school record. It does not authenticate the holder.</p></section> : null}</>;
}
