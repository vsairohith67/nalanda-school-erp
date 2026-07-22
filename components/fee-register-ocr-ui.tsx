"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

async function jsonRequest(url: string, method: string, body?: unknown) {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(value.error ?? "The OCR request failed safely.");
  return value;
}

export function OcrNewBatchForm({ profiles, academicYear }: { profiles: any[]; academicYear: string }) {
  const router = useRouter(), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await jsonRequest("/api/fee-register-ocr/batches", "POST", Object.fromEntries(data));
      router.push(`/fee-register-ocr/${result.batch.id}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Batch creation failed."); }
    finally { setBusy(false); }
  }
  return <form className="card card-pad form-grid ocr-form" onSubmit={submit}>
    <label>Register name<input name="registerName" required maxLength={160} placeholder="QA20B Synthetic Fee Register" /></label>
    <label>Academic year<input name="academicYear" required defaultValue={academicYear} pattern="\d{4}-\d{2}" /></label>
    <label>Register period start<input name="registerPeriodStart" type="date" /></label>
    <label>Register period end<input name="registerPeriodEnd" type="date" /></label>
    <label className="full-span">Provider mode<select name="profileId" required defaultValue={profiles.find((row) => row.providerKind === "MOCK")?.id}>{profiles.filter((row) => row.status === "ACTIVE").map((row) => <option key={row.id} value={row.id}>{row.name} · {row.providerKind}</option>)}</select><small>Only deterministic MOCK and MANUAL transcription are active in Prompt 20B.</small></label>
    {message ? <p className="notice danger full-span" role="alert">{message}</p> : null}
    <div className="page-actions full-span"><button disabled={busy}>{busy ? "Creating private batch…" : "Create OCR batch"}</button><Link className="button secondary" href="/fee-register-ocr">Go back</Link></div>
  </form>;
}

type DialogKind = "upload" | "extract" | "submit" | "approve" | "cancel" | "purge" | null;
export function OcrBatchActions({ batch, permissions }: { batch: any; permissions: string[] }) {
  const router = useRouter(), [dialog, setDialog] = useState<DialogKind>(null), [targetPage, setTargetPage] = useState<any>(null), [file, setFile] = useState<File | null>(null), [reason, setReason] = useState(""), [confirmation, setConfirmation] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const can = (permission: string) => permissions.includes(permission);
  function open(kind: DialogKind, page?: any) { setDialog(kind); setTargetPage(page ?? null); setReason(""); setConfirmation(""); setMessage(""); }
  async function act() {
    if (!dialog) return; setBusy(true); setMessage("");
    try {
      if (dialog === "upload") {
        if (!file) throw new Error("Choose a JPEG, PNG, or WebP register image.");
        const form = new FormData(); form.append("file", file);
        const response = await fetch(`/api/fee-register-ocr/batches/${batch.id}/pages`, { method: "POST", body: form });
        const value = await response.json().catch(() => ({})); if (!response.ok) throw new Error(value.error ?? "Upload failed safely.");
      } else if (dialog === "extract") {
        await jsonRequest(`/api/fee-register-ocr/pages/${targetPage.id}/extract`, "POST");
      } else if (dialog === "purge") {
        await jsonRequest(`/api/fee-register-ocr/pages/${targetPage.id}/purge`, "POST", { confirmation });
      } else {
        await jsonRequest(`/api/fee-register-ocr/batches/${batch.id}`, "PATCH", {
          action: dialog, reason, ...(dialog === "approve" && confirmation === "SAME PERSON OVERRIDE" ? { samePersonOverride: true } : {})
        });
      }
      setDialog(null); setFile(null); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "OCR workflow action failed safely."); }
    finally { setBusy(false); }
  }
  return <div className="ocr-actions">
    <div className="page-actions">
      {can("UPLOAD_FEE_REGISTER_PAGES") && !["CANCELLED", "POSTED", "ARCHIVED"].includes(batch.status) ? <button type="button" onClick={() => open("upload")}>Upload register pages</button> : null}
      {can("REVIEW_FEE_REGISTER_OCR_ROWS") && batch.pages?.length ? <Link className="button secondary" href={`/fee-register-ocr/${batch.id}/review`}>Review rows</Link> : null}
      {can("REVIEW_FEE_REGISTER_OCR_ROWS") && ["NEEDS_REVIEW", "UPLOADED"].includes(batch.status) ? <button type="button" className="secondary" onClick={() => open("submit")}>Submit for approval</button> : null}
      {can("APPROVE_FEE_REGISTER_OCR_BATCHES") && batch.status === "READY_FOR_APPROVAL" ? <button type="button" onClick={() => open("approve")}>Approve batch</button> : null}
      {can("PREVIEW_FEE_REGISTER_OCR_POSTING") && batch.status === "APPROVED" ? <Link className="button secondary" href={`/fee-register-ocr/${batch.id}/posting`}>Posting preview</Link> : null}
      {((can("REVIEW_FEE_REGISTER_OCR_ROWS") && ["DRAFT", "UPLOADED", "PROCESSING", "NEEDS_REVIEW", "READY_FOR_APPROVAL"].includes(batch.status)) || (can("APPROVE_FEE_REGISTER_OCR_BATCHES") && batch.status === "APPROVED")) ? <button type="button" className="danger" onClick={() => open("cancel")}>Cancel batch</button> : null}
    </div>
    {message && !dialog ? <p role="status">{message}</p> : null}
    <div className="ocr-page-actions">
      {batch.pages?.map((page: any) => <div className="card card-pad" key={page.id}><strong>Page {page.pageNumber}</strong><span>{page.status} · {page.mimeType} · {Math.round(page.byteSize / 1024)} KB</span><div className="page-actions"><Link className="button secondary" href={`/fee-register-ocr/${batch.id}/pages/${page.id}`}>Open private image</Link>{can("RUN_FEE_REGISTER_OCR") && ["UPLOADED", "FAILED"].includes(page.status) ? <button type="button" onClick={() => open("extract", page)}>Start extraction</button> : null}{can("PURGE_FEE_REGISTER_OCR_IMAGES") && ["CANCELLED", "POSTED", "ARCHIVED"].includes(batch.status) && !["PURGED", "MISSING_SOURCE"].includes(page.status) ? <button type="button" className="danger" onClick={() => open("purge", page)}>Purge source</button> : null}</div></div>)}
    </div>
    {dialog ? <OcrDialog title={dialogTitle(dialog)} description={dialogDescription(dialog)} confirm={dialogConfirm(dialog)} busy={busy} onCancel={() => setDialog(null)} onConfirm={act}>
      {dialog === "upload" ? <label>Private register image<input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><small>PDF, HEIC, SVG, HTML and office files are not supported.</small></label> : null}
      {["submit", "approve", "cancel"].includes(dialog) ? <label>{dialog === "cancel" ? "Required cancellation reason" : "Review notes"}<textarea value={reason} required={dialog === "cancel"} maxLength={1000} onChange={(event) => setReason(event.target.value)} /></label> : null}
      {dialog === "approve" ? <label>Director/Super Admin override (only if reviewer is also approver)<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Leave blank for independent approval" /><small>Type SAME PERSON OVERRIDE and provide a reason only when policy permits.</small></label> : null}
      {dialog === "purge" ? <label>Type PURGE {targetPage.sourceSha256.slice(0, 12)}<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label> : null}
      {message ? <p className="notice danger" role="alert">{message}</p> : null}
    </OcrDialog> : null}
  </div>;
}

export function OcrReviewWorkspace({ batch, canResolveDuplicates }: { batch: any; canResolveDuplicates: boolean }) {
  const router = useRouter(), rows = batch.pages.flatMap((page: any) => page.rows.map((row: any) => ({ ...row, page })));
  const [active, setActive] = useState<any>(rows[0] ?? null), [dialog, setDialog] = useState<"match" | "verify" | "duplicate" | "reject" | null>(null), [message, setMessage] = useState(""), [reason, setReason] = useState(""), [selectedCandidateId, setSelectedCandidateId] = useState(""), [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<string, string>>(() => active ? rowForm(active) : {});
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const candidates = useMemo(() => parseJson<any[]>(active?.candidateMatchesJson, []), [active]);
  function select(row: any) { setActive(row); setForm(rowForm(row)); setDialog(null); setMessage(""); setReason(""); setSelectedCandidateId(""); setChecklist({}); }
  function openReviewDialog(kind: "match" | "verify" | "duplicate" | "reject", candidateId = "") {
    setDialog(kind);
    setReason("");
    setSelectedCandidateId(candidateId);
    setChecklist({});
  }
  async function action(body: Record<string, unknown>) {
    if (!active) return; setBusy(true); setMessage("");
    try { await jsonRequest(`/api/fee-register-ocr/rows/${active.id}`, "PATCH", body); setDialog(null); router.refresh(); setMessage("OCR row updated. Refresh shows the latest review version."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "OCR row action failed safely."); }
    finally { setBusy(false); }
  }
  return <div className="ocr-review-layout">
    <aside className="card card-pad ocr-row-list" aria-label="OCR rows">{rows.map((row: any) => <button type="button" className={active?.id === row.id ? "active" : ""} key={row.id} onClick={() => select(row)}>Page {row.page.pageNumber} · Row {row.rowNumber}<span>{row.status} · {row.duplicateClassification}</span></button>)}</aside>
    {active ? <section className="card card-pad ocr-review-card">
      <div className="ocr-review-source"><div><h2>Page {active.page.pageNumber}, row {active.rowNumber}</h2><p>OCR confidence is informational only. Verify every field against the source.</p></div><Link className="button secondary" href={`/fee-register-ocr/${batch.id}/pages/${active.page.id}`}>Open source and overlay</Link></div>
      <div className="ocr-row-crop" aria-label="Private source image review crop"><img src={`/api/fee-register-ocr/pages/${active.page.id}/image`} alt={`Private register page ${active.page.pageNumber} for OCR row ${active.rowNumber}`} /></div>
      <ConfidenceGrid values={parseJson(active.fieldConfidenceJson, {})} />
      <div className="form-grid ocr-form">
        <label>Payment date<input type="date" value={form.paymentDate ?? ""} onChange={field(setForm, "paymentDate")} /></label>
        <label>Admission number<input value={form.admissionNumber ?? ""} onChange={field(setForm, "admissionNumber")} /></label>
        <label>Student name<input value={form.studentName ?? ""} onChange={field(setForm, "studentName")} /></label>
        <label>Class<input value={form.className ?? ""} onChange={field(setForm, "className")} /></label>
        <label>Section<input value={form.section ?? ""} onChange={field(setForm, "section")} /></label>
        <label>Amount<input type="number" min="0.01" step="0.01" value={form.amount ?? ""} onChange={field(setForm, "amount")} /></label>
        <label>Payment mode<select value={form.paymentMode ?? ""} onChange={field(setForm, "paymentMode")}><option value="">Choose</option>{["Cash", "UPI", "Bank Transfer", "NEFT", "RTGS", "IMPS", "Cheque", "Other"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Received account<select value={form.receivedAccount ?? ""} onChange={field(setForm, "receivedAccount")}><option value="">Choose</option>{["Cash", "Director Sir GPay", "NPS Current Account UPI", "NPS Bank Account", "Other"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Academic term<select value={form.academicTerm ?? ""} onChange={field(setForm, "academicTerm")}><option value="">Choose</option>{["Term 1", "Term 2", "Term 3", "Term 4", "Multiple", "Auto"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Handwritten receipt/reference<input value={form.handwrittenReceiptReference ?? ""} onChange={field(setForm, "handwrittenReceiptReference")} /></label>
        <label className="full-span">Register remarks<textarea value={form.registerRemarks ?? ""} maxLength={500} onChange={field(setForm, "registerRemarks")} /></label>
        <label className="full-span">Required correction reason<input value={form.changeReason ?? ""} maxLength={500} onChange={field(setForm, "changeReason")} /></label>
      </div>
      <div className="page-actions"><button type="button" className="secondary" disabled={!form.changeReason || busy || ["POSTED", "REJECTED"].includes(active.status)} onClick={() => action({ action: "update", ...form })}>Save correction and revision</button><button type="button" onClick={() => openReviewDialog("verify")} disabled={active.status === "POSTED"}>Verify row</button><button type="button" className="danger" onClick={() => openReviewDialog("reject")} disabled={active.status === "POSTED"}>Reject row</button>{canResolveDuplicates ? <button type="button" className="secondary" onClick={() => openReviewDialog("duplicate")} disabled={active.status === "POSTED"}>Mark duplicate</button> : null}</div>
      <h3>Student match</h3><p>Method: {active.matchingMethod} · matched ID is retained server-side and revalidated; fuzzy candidates never auto-select.</p>
      <div className="ocr-candidates">{candidates.length ? candidates.map((candidate: any) => <div className="card card-pad" key={candidate.id}><strong>{candidate.studentName}</strong><span>{candidate.admissionNo} · {candidate.className}{candidate.section ? `-${candidate.section}` : ""} · {candidate.enrollmentStatus}</span><small>{candidate.matchReason} · {candidate.confidence}%</small><button type="button" className="secondary" onClick={() => openReviewDialog("match", candidate.id)}>Confirm this Student</button></div>) : <p className="notice warning">No safe candidate. Search or correct authoritative fields; do not guess.</p>}</div>
      <h3>Immutable revisions</h3><div className="table-wrap"><table><thead><tr><th>Revision</th><th>Reason</th><th>Time</th></tr></thead><tbody>{active.revisions?.map((revision: any) => <tr key={revision.id}><td>{revision.revisionNumber}</td><td>{revision.changeReason}</td><td>{new Date(revision.createdAt).toLocaleString("en-IN")}</td></tr>)}</tbody></table></div>
      {message ? <p className={message.includes("failed") ? "notice danger" : "notice"} role="status">{message}</p> : null}
      {dialog ? <OcrDialog title={dialog === "match" ? "Confirm Student Match" : dialog === "verify" ? "Verify OCR Row" : dialog === "duplicate" ? "Mark OCR Row as Duplicate" : "Reject OCR Row"} description={dialog === "verify" ? "Confirm each field only after comparing it against the visible source row." : "This action preserves the source, row and event history."} confirm={dialog === "verify" ? "Verify reviewed row" : dialog === "match" ? "Confirm exact Student" : dialog === "duplicate" ? "Mark duplicate" : "Reject row"} busy={busy} onCancel={() => setDialog(null)} onConfirm={() => action(dialog === "match" ? { action: "match", studentId: selectedCandidateId } : dialog === "verify" ? { action: "verify", checklist } : dialog === "duplicate" ? { action: "markDuplicate", reason } : { action: "reject", reason })}>
        {dialog === "verify" ? <div className="ocr-checklist">{[["sourceRowVisible", "Source row is visible"], ["studentMatch", "Student match"], ["paymentDate", "Payment date"], ["amount", "Amount"], ["paymentMode", "Payment mode"], ["academicYearTerm", "Academic year / term"], ["handwrittenReference", "Handwritten reference (or absence)"], ["duplicateResult", "Duplicate result"], ["registerRemarks", "Register remarks (or absence)"]].map(([key, label]) => <label key={key}><input type="checkbox" checked={checklist[key] === true} onChange={(event) => setChecklist((value) => ({ ...value, [key]: event.target.checked }))} />{label}</label>)}</div> : dialog === "match" ? <p>Selected Student record: {candidates.find((candidate: any) => candidate.id === selectedCandidateId)?.studentName ?? "candidate"}. This will not post a Payment.</p> : <label>Required reason<textarea value={reason} required maxLength={500} onChange={(event) => setReason(event.target.value)} /></label>}
      </OcrDialog> : null}
    </section> : <p className="notice">No OCR rows are available yet.</p>}
  </div>;
}

export function OcrPostingWorkspace({ batch }: { batch: any }) {
  const router = useRouter(), rows = batch.pages.flatMap((page: any) => page.rows).filter((row: any) => row.status === "VERIFIED"), [selected, setSelected] = useState<string[]>(rows.map((row: any) => row.id)), [dialog, setDialog] = useState<"preview" | "post" | null>(null), [result, setResult] = useState<any>(null), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  async function act() {
    if (!dialog) return; setBusy(true); setMessage("");
    try {
      const value = await jsonRequest(`/api/fee-register-ocr/batches/${batch.id}/posting`, "POST", { action: dialog === "preview" ? "preview" : "process", selectedRowIds: selected });
      setResult(value); setDialog(null); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "OCR posting action failed safely."); }
    finally { setBusy(false); }
  }
  return <div className="ocr-posting">
    <p className="notice warning"><strong>Posting is disabled.</strong> Historical dates feed the Cash Book by Payment.date, but the current Payment helper has not proven outstanding-balance and exact fee-allocation enforcement for OCR rows. Use the reviewed staging export.</p>
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Select</th><th>Row</th><th>Date</th><th>Amount</th><th>Mode</th><th>Handwritten reference</th></tr></thead><tbody>{rows.map((row: any) => <tr key={row.id}><td><input aria-label={`Select row ${row.rowNumber}`} type="checkbox" checked={selected.includes(row.id)} onChange={(event) => setSelected((value) => event.target.checked ? [...value, row.id] : value.filter((id) => id !== row.id))} /></td><td>{row.rowNumber}</td><td>{row.paymentDate?.slice?.(0, 10) ?? new Date(row.paymentDate).toISOString().slice(0, 10)}</td><td>₹{((row.amountMinor ?? 0) / 100).toFixed(2)}</td><td>{row.paymentMode}</td><td>{row.handwrittenReceiptReference || "Not written"}<br /><small>Never used as ERP receipt number</small></td></tr>)}</tbody></table></div></section>
    <div className="page-actions"><button type="button" onClick={() => setDialog("preview")} disabled={!selected.length}>Preview financial impact</button><button type="button" className="danger" onClick={() => setDialog("post")} disabled={!batch.profile.paymentPostingEnabled}>Post verified rows</button><a className="button secondary" href={`/api/fee-register-ocr/reports/export?batchId=${encodeURIComponent(batch.id)}`}>Reviewed staging CSV</a></div>
    {result ? <pre className="card card-pad ocr-json">{JSON.stringify(result.financialPreview ?? result, null, 2)}</pre> : null}{message ? <p className="notice danger" role="alert">{message}</p> : null}
    {dialog ? <OcrDialog title={dialog === "preview" ? "Preview OCR Payment Posting" : "Post Verified OCR Rows to Fee Ledger"} description={dialog === "preview" ? "This creates a posting-run preview and performs duplicate rechecks with zero Payment writes." : "Posting remains fail-closed until every finance invariant is proven."} confirm={dialog === "preview" ? "Run zero-write preview" : "Post selected rows"} busy={busy} onCancel={() => setDialog(null)} onConfirm={act} /> : null}
  </div>;
}

export function OcrProfileActions({ profile }: { profile: any }) {
  const router = useRouter(), [open, setOpen] = useState(false), [confirmation, setConfirmation] = useState(""), [message, setMessage] = useState("");
  async function act() { try { await jsonRequest("/api/fee-register-ocr/profiles", "PATCH", { id: profile.id, action: profile.status === "ACTIVE" ? "pause" : "activate", confirmation }); setOpen(false); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Profile action failed."); } }
  return <div><button type="button" className={profile.status === "ACTIVE" ? "danger" : "secondary"} disabled={!["MOCK", "MANUAL"].includes(profile.providerKind) && profile.status !== "ACTIVE"} onClick={() => setOpen(true)}>{profile.status === "ACTIVE" ? "Pause" : "Activate"}</button>{message ? <small role="alert">{message}</small> : null}{open ? <OcrDialog title={`${profile.status === "ACTIVE" ? "Pause" : "Activate"} OCR Profile`} description="No endpoint or credential is stored. Prompt 20B permits MOCK and MANUAL only, with Payment posting disabled." confirm={profile.status === "ACTIVE" ? "Pause profile" : "Activate profile"} onCancel={() => setOpen(false)} onConfirm={act}>{profile.status !== "ACTIVE" ? <label>Type ACTIVATE {profile.profileCode}<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label> : null}</OcrDialog> : null}</div>;
}

function OcrDialog({ title, description, confirm, busy = false, onCancel, onConfirm, children }: { title: string; description: string; confirm: string; busy?: boolean; onCancel: () => void; onConfirm: () => void; children?: React.ReactNode }) {
  const id = `ocr-dialog-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return <div className="confirmation-overlay"><section className="card confirmation-dialog ocr-dialog" role="dialog" aria-modal="true" aria-labelledby={id}><h3 id={id}>{title}</h3><p>{description}</p>{children}<div className="page-actions"><button type="button" className="secondary" autoFocus onClick={onCancel} disabled={busy}>Go back</button><button type="button" onClick={onConfirm} disabled={busy}>{busy ? "Working safely…" : confirm}</button></div></section></div>;
}

function dialogTitle(dialog: Exclude<DialogKind, null>) {
  return ({ upload: "Upload Fee Register Pages", extract: "Start OCR Extraction", submit: "Submit OCR Batch for Approval", approve: "Approve OCR Batch", cancel: "Cancel OCR Batch", purge: "Purge OCR Source Images" } as const)[dialog];
}
function dialogDescription(dialog: Exclude<DialogKind, null>) {
  return ({ upload: "The image is validated by magic bytes and dimensions, then stored under an opaque key outside public assets.", extract: "OCR output is untrusted draft evidence. Extraction never posts a Payment or changes dues.", submit: "Every row must already be verified, rejected, or an exact duplicate.", approve: "Approval is bound to the exact current review version and does not post a Payment.", cancel: "Cancellation preserves pages, rows, revisions and events.", purge: "Purge removes only private image bytes and preserves metadata, hashes and review history." } as const)[dialog];
}
function dialogConfirm(dialog: Exclude<DialogKind, null>) { return ({ upload: "Upload private image", extract: "Run safe extraction", submit: "Submit reviewed batch", approve: "Approve current version", cancel: "Cancel and preserve history", purge: "Purge source bytes" } as const)[dialog]; }
function parseJson<T>(value: string | null | undefined, fallback: T): T { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } }
function rowForm(row: any) {
  const extracted = parseJson<Record<string, string>>(row.extractedFieldsJson, {});
  return {
    paymentDate: row.paymentDate ? new Date(row.paymentDate).toISOString().slice(0, 10) : extracted.paymentDate ?? "",
    admissionNumber: extracted.admissionNumber ?? "", studentName: extracted.studentName ?? "", className: extracted.className ?? "", section: extracted.section ?? "",
    amount: row.amountMinor == null ? extracted.amount ?? "" : (row.amountMinor / 100).toFixed(2), paymentMode: row.paymentMode ?? extracted.paymentMode ?? "",
    receivedAccount: row.receivedAccount ?? "", academicTerm: row.academicTerm ?? extracted.academicTerm ?? "", handwrittenReceiptReference: row.handwrittenReceiptReference ?? "",
    registerRemarks: row.registerRemarks ?? "", changeReason: ""
  };
}
function field(setter: React.Dispatch<React.SetStateAction<Record<string, string>>>, key: string) { return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setter((value) => ({ ...value, [key]: event.target.value })); }
function ConfidenceGrid({ values }: { values: Record<string, string> }) { return <div className="ocr-confidence" aria-label="Field confidence">{Object.entries(values).map(([field, level]) => <span className={`badge confidence-${level.toLowerCase()}`} key={field}>{field}: {level}</span>)}</div>; }
