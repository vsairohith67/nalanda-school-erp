"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, FileSearch, Minus, Plus, RotateCcw, RotateCw, Save, Send, X } from "lucide-react";
import styles from "@/components/ocr-review-workspace.module.css";

type ReviewField = {
  publicKey: string; fieldKey: string; candidateText: string; approvedValue: string | null;
  sourceRegionJson: string | null; recognitionScore: number | null; scriptHint: string;
  validationState: string; reviewState: string; critical: boolean; decision: string;
  editReason: string | null; pageNumber: number | null; version: number;
};
type ReviewPage = {
  publicKey: string; pageNumber: number; width: number; height: number; sourceRotation: number;
  reviewOrientation: number; rasterSha256: string;
};
type ReviewWorkspace = {
  document: {
    publicKey: string; contextType: string; contextId: string; status: string; safeDisplayName: string;
    pageCount: number; languageProfile: string; handwritingDeclared: boolean; reviewVersion: number;
    targetSnapshotVersion: string; targetCurrentVersion: string; targetStale: boolean; duplicateDetected: boolean;
  };
  target: { displayReference: string; currentValues: Record<string, string | null> };
  pages: ReviewPage[];
  fields: ReviewField[];
  latestJob: { status: string; failureCode: string | null; attemptCount: number } | null;
  latestSubmission: { status: string; failureCode: string | null; completedAt: string | null } | null;
};

type Draft = { decision: string; approvedValue: string; editReason: string };

function label(fieldKey: string) {
  return fieldKey.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (character) => character.toUpperCase());
}

function parsedRegion(value: string | null) {
  if (!value) return null;
  try {
    const region = JSON.parse(value) as { pageNumber: number; polygon: Array<[number, number]> };
    return Number.isInteger(region.pageNumber) && Array.isArray(region.polygon) ? region : null;
  } catch { return null; }
}

async function responseJson(response: Response) {
  const body = await response.json().catch(() => ({})) as { error?: string; code?: string; reviewVersion?: number; fieldVersion?: number; status?: string };
  if (!response.ok) throw new Error(body.code || body.error || "OCR_REQUEST_FAILED");
  return body;
}

export function OcrReviewWorkspace({ initial }: { initial: ReviewWorkspace }) {
  const [fields, setFields] = useState(initial.fields);
  const [pages, setPages] = useState(initial.pages);
  const [reviewVersion, setReviewVersion] = useState(initial.document.reviewVersion);
  const [status, setStatus] = useState(initial.document.status);
  const [fieldIndex, setFieldIndex] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [draft, setDraft] = useState<Draft>(() => draftFromField(initial.fields[0]));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const submitKey = useRef(crypto.randomUUID());
  const activeField = fields[fieldIndex] ?? null;
  const activePage = pages[pageIndex] ?? null;
  const sourceRegion = parsedRegion(activeField?.sourceRegionJson ?? null);
  const pending = fields.filter((field) => field.decision === "PENDING").length;
  const decided = fields.length - pending;

  const selectField = useCallback((nextIndex: number) => {
    if (dirty && !window.confirm("Discard the unsaved field decision?")) return;
    const bounded = Math.max(0, Math.min(fields.length - 1, nextIndex));
    setFieldIndex(bounded);
    setDraft(draftFromField(fields[bounded]));
    setDirty(false);
    setNotice(null);
    const region = parsedRegion(fields[bounded]?.sourceRegionJson ?? null);
    if (region) {
      const linkedPage = pages.findIndex((page) => page.pageNumber === region.pageNumber);
      if (linkedPage >= 0) setPageIndex(linkedPage);
    }
  }, [dirty, fields, pages]);

  const chooseDecision = useCallback((decision: string) => {
    setDraft((current) => ({
      ...current,
      decision,
      approvedValue: decision === "ACCEPTED" ? activeField?.candidateText ?? "" : decision === "EDITED" ? current.approvedValue : ""
    }));
    setDirty(true);
  }, [activeField?.candidateText]);

  const saveDraft = useCallback(async () => {
    if (!activeField || !dirty || busy) return;
    setBusy(true); setNotice(null);
    try {
      const response = await fetch(`/api/ocr/documents/${initial.document.publicKey}/review`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "FIELD_DECISION", fieldKey: activeField.fieldKey, decision: draft.decision, approvedValue: draft.approvedValue, editReason: draft.editReason, expectedFieldVersion: activeField.version, expectedReviewVersion: reviewVersion })
      });
      const body = await responseJson(response);
      setFields((current) => current.map((field, index) => index === fieldIndex ? {
        ...field, decision: draft.decision, approvedValue: draft.decision === "ACCEPTED" ? field.candidateText : draft.decision === "EDITED" ? draft.approvedValue : null,
        editReason: draft.decision === "EDITED" ? draft.editReason : null, version: body.fieldVersion ?? field.version + 1
      } : field));
      setReviewVersion(body.reviewVersion ?? reviewVersion + 1);
      setStatus(body.status ?? status);
      setDirty(false); setNotice("Draft decision saved.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "OCR_REQUEST_FAILED"); }
    finally { setBusy(false); }
  }, [activeField, busy, dirty, draft, fieldIndex, initial.document.publicKey, reviewVersion, status]);

  const rotatePage = useCallback(async (clockwise: boolean) => {
    if (!activePage || busy) return;
    const rotation = (activePage.reviewOrientation + (clockwise ? 90 : 270)) % 360;
    setBusy(true); setNotice(null);
    try {
      const response = await fetch(`/api/ocr/documents/${initial.document.publicKey}/review`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ROTATE_PAGE", pageNumber: activePage.pageNumber, rotation, expectedReviewVersion: reviewVersion })
      });
      const body = await responseJson(response);
      setPages((current) => current.map((page) => page.pageNumber === activePage.pageNumber ? { ...page, reviewOrientation: rotation } : page));
      setReviewVersion(body.reviewVersion ?? reviewVersion + 1);
    } catch (error) { setNotice(error instanceof Error ? error.message : "OCR_REQUEST_FAILED"); }
    finally { setBusy(false); }
  }, [activePage, busy, initial.document.publicKey, reviewVersion]);

  const submit = useCallback(async () => {
    if (!confirmed || dirty || pending || busy) return;
    setBusy(true); setNotice(null);
    try {
      const response = await fetch(`/api/ocr/documents/${initial.document.publicKey}/submit`, {
        method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": submitKey.current },
        body: JSON.stringify({ expectedReviewVersion: reviewVersion, confirmation: "CONFIRM_OCR_SUBMISSION" })
      });
      const body = await responseJson(response);
      setStatus(body.status ?? "SUBMITTED"); setConfirmOpen(false); setNotice("Human-approved values were submitted through the authoritative service.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "OCR_REQUEST_FAILED"); }
    finally { setBusy(false); }
  }, [busy, confirmed, dirty, initial.document.publicKey, pending, reviewVersion]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      if (event.ctrlKey && event.key === "Enter") { event.preventDefault(); void saveDraft(); return; }
      if (event.key.toLowerCase() === "j") selectField(fieldIndex + 1);
      else if (event.key.toLowerCase() === "k") selectField(fieldIndex - 1);
      else if (event.key === "Enter") chooseDecision("ACCEPTED");
      else if (event.key.toLowerCase() === "m") chooseDecision("MISSING_VALUE");
      else if (event.key === "[") setPageIndex((current) => Math.max(0, current - 1));
      else if (event.key === "]") setPageIndex((current) => Math.min(pages.length - 1, current + 1));
      else if (event.key === "+" || event.key === "=") setZoom((current) => Math.min(2.5, current + 0.2));
      else if (event.key === "-") setZoom((current) => Math.max(0.5, current - 0.2));
      else if (event.key === "0") setZoom(1);
      else if (event.key.toLowerCase() === "r") void rotatePage(!event.shiftKey);
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [chooseDecision, fieldIndex, pages.length, rotatePage, saveDraft, selectField]);

  const reviewSummary = useMemo(() => ({ green: fields.filter((field) => field.reviewState === "GREEN").length, amber: fields.filter((field) => field.reviewState === "AMBER").length, red: fields.filter((field) => field.reviewState === "RED").length }), [fields]);

  if (!activeField || !activePage) return <ProcessingState initial={initial} />;
  return <main className={styles.shell}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>Local OCR · human review required</span><h1>Review {initial.target.displayReference}</h1><p>{initial.document.safeDisplayName} · {initial.document.languageProfile.replaceAll("_", " + ")}</p></div>
      <div className={styles.headerFacts}><StatusPill value={status} /><span>{decided}/{fields.length} fields reviewed</span></div>
    </header>
    {(initial.document.targetStale || initial.document.duplicateDetected || initial.document.handwritingDeclared) && <section className={styles.warning} role="alert">
      <AlertTriangle aria-hidden="true" />
      <div>{initial.document.targetStale && <p>The authoritative record changed after upload. Final submission is blocked until this review is reconciled.</p>}{initial.document.duplicateDetected && <p>Identical bytes were uploaded earlier for this record. This document remains separate and requires its own review.</p>}{initial.document.handwritingDeclared && <p>Handwriting was declared. Every field stays in manual review; handwriting is not certified.</p>}</div>
    </section>}
    <section className={styles.summary} aria-label="Review state summary"><span className={styles.green}>GREEN {reviewSummary.green}</span><span className={styles.amber}>AMBER {reviewSummary.amber}</span><span className={styles.red}>RED {reviewSummary.red}</span><span>These are workflow cues, not correctness probabilities.</span></section>
    <div className={styles.workspace}>
      <section className={styles.viewerPanel} aria-label="Private source page viewer">
        <div className={styles.toolbar}>
          <button type="button" onClick={() => setPageIndex((current) => Math.max(0, current - 1))} disabled={pageIndex === 0} aria-label="Previous source page"><ChevronLeft /></button>
          <span>Page {activePage.pageNumber} of {pages.length}</span>
          <button type="button" onClick={() => setPageIndex((current) => Math.min(pages.length - 1, current + 1))} disabled={pageIndex === pages.length - 1} aria-label="Next source page"><ChevronRight /></button>
          <button type="button" onClick={() => void rotatePage(false)} aria-label="Rotate page counterclockwise"><RotateCcw /></button>
          <button type="button" onClick={() => void rotatePage(true)} aria-label="Rotate page clockwise"><RotateCw /></button>
          <button type="button" onClick={() => setZoom((current) => Math.max(0.5, current - 0.2))} aria-label="Zoom out"><Minus /></button>
          <button type="button" onClick={() => setZoom(1)} aria-label="Reset zoom">100%</button>
          <button type="button" onClick={() => setZoom((current) => Math.min(2.5, current + 0.2))} aria-label="Zoom in"><Plus /></button>
        </div>
        <div className={styles.canvasScroller}>
          <div className={styles.pageCanvas} style={{ width: `${activePage.width * zoom}px`, aspectRatio: `${activePage.width}/${activePage.height}`, transform: `rotate(${activePage.reviewOrientation}deg)` }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- authenticated, checksum-verified private raster */}
            <img src={`/api/ocr/documents/${initial.document.publicKey}/pages/${activePage.pageNumber}/image`} alt={`Private raster of source page ${activePage.pageNumber}`} draggable={false} />
            {sourceRegion?.pageNumber === activePage.pageNumber && <svg className={styles.overlay} viewBox={`0 0 ${activePage.width} ${activePage.height}`} aria-hidden="true"><polygon points={sourceRegion.polygon.map(([x, y]) => `${x},${y}`).join(" ")} /></svg>}
          </div>
        </div>
        <p className={styles.privateNote}>Private, no-store raster. Uploaded PDF content is never embedded directly.</p>
      </section>
      <section className={styles.reviewPanel} aria-label="OCR candidate review">
        <nav className={styles.fieldNavigator} aria-label="Candidate fields">
          {fields.map((field, index) => <button type="button" key={field.publicKey} className={index === fieldIndex ? styles.activeField : undefined} onClick={() => selectField(index)} aria-current={index === fieldIndex ? "step" : undefined}><span>{field.critical ? "Critical · " : ""}{label(field.fieldKey)}</span><small>{field.decision}</small></button>)}
        </nav>
        <article className={styles.fieldCard}>
          <div className={styles.fieldHeading}><div><span className={styles.eyebrow}>Field {fieldIndex + 1} of {fields.length}</span><h2>{label(activeField.fieldKey)}</h2></div><div><StateBadge value={activeField.reviewState} /><StateBadge value={activeField.validationState} /></div></div>
          <dl className={styles.evidence}><div><dt>OCR candidate</dt><dd>{activeField.candidateText || <em>No candidate found</em>}</dd></div><div><dt>Recognition evidence</dt><dd>{activeField.recognitionScore === null ? "Not available" : activeField.recognitionScore.toFixed(3)} · {activeField.scriptHint}</dd></div><div><dt>Source region</dt><dd>{sourceRegion ? `Page ${sourceRegion.pageNumber}, highlighted` : "Unavailable — RED review"}</dd></div><div><dt>Current ERP value</dt><dd>{initial.target.currentValues[activeField.fieldKey] || <em>Blank</em>}</dd></div></dl>
          <fieldset className={styles.decisions}><legend>Human decision {activeField.critical && "(required critical field)"}</legend>
            <button type="button" className={draft.decision === "ACCEPTED" ? styles.selectedDecision : undefined} onClick={() => chooseDecision("ACCEPTED")} disabled={!activeField.candidateText}><Check />Accept candidate</button>
            <button type="button" className={draft.decision === "EDITED" ? styles.selectedDecision : undefined} onClick={() => chooseDecision("EDITED")}><FileSearch />Enter correction</button>
            <button type="button" className={draft.decision === "REJECTED_CANDIDATE" ? styles.selectedDecision : undefined} onClick={() => chooseDecision("REJECTED_CANDIDATE")}><X />Reject candidate</button>
            <button type="button" className={draft.decision === "MISSING_VALUE" ? styles.selectedDecision : undefined} onClick={() => chooseDecision("MISSING_VALUE")}><AlertTriangle />Mark missing</button>
          </fieldset>
          {draft.decision === "EDITED" && <div className={styles.editFields}><label>Operator-approved value<input value={draft.approvedValue} onChange={(event) => { setDraft((current) => ({ ...current, approvedValue: event.target.value })); setDirty(true); }} maxLength={500} /></label><label>Reason for correction<textarea value={draft.editReason} onChange={(event) => { setDraft((current) => ({ ...current, editReason: event.target.value })); setDirty(true); }} maxLength={400} rows={3} /></label></div>}
          <div className={styles.cardActions}><button type="button" onClick={() => selectField(fieldIndex - 1)} disabled={fieldIndex === 0}><ChevronLeft />Previous</button><button type="button" className={styles.saveButton} onClick={() => void saveDraft()} disabled={!dirty || busy || draft.decision === "PENDING"}><Save />{busy ? "Saving…" : "Save draft"}</button><button type="button" onClick={() => selectField(fieldIndex + 1)} disabled={fieldIndex === fields.length - 1}>Next<ChevronRight /></button></div>
          {notice && <p className={styles.notice} role="status">{notice}</p>}
        </article>
        <aside className={styles.shortcuts}><strong>Keyboard</strong><span>J/K fields</span><span>[ ] pages</span><span>Enter accept</span><span>M missing</span><span>Ctrl+Enter save</span><span>R / Shift+R rotate</span><span>+ − 0 zoom</span></aside>
        <footer className={styles.submitBar}><div><strong>Final authoritative submission</strong><p>All fields need a saved human decision. No OCR value is written before this step.</p></div><button type="button" className={styles.submitButton} disabled={pending > 0 || dirty || status === "SUBMITTED" || initial.document.targetStale} onClick={() => { setConfirmed(false); setConfirmOpen(true); }}><Send />Review final submission</button></footer>
      </section>
    </div>
    {confirmOpen && <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmOpen(false); }}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="ocr-submit-title"><h2 id="ocr-submit-title">Submit human-approved values?</h2><p>This sends only accepted or edited values through the existing {initial.document.contextType.toLowerCase()} service. Rejected and missing candidates are not submitted.</p><label className={styles.confirmCheck}><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />I reviewed every critical field and understand this updates the authoritative record.</label><div><button type="button" onClick={() => setConfirmOpen(false)}>Cancel</button><button type="button" className={styles.submitButton} disabled={!confirmed || busy} onClick={() => void submit()}><Send />{busy ? "Submitting…" : "Submit approved values"}</button></div></section></div>}
  </main>;
}

function draftFromField(field?: ReviewField): Draft {
  return { decision: field?.decision ?? "PENDING", approvedValue: field?.approvedValue ?? field?.candidateText ?? "", editReason: field?.editReason ?? "" };
}
function StatusPill({ value }: { value: string }) { return <span className={styles.statusPill}>{value.replaceAll("_", " ")}</span>; }
function StateBadge({ value }: { value: string }) { return <span className={`${styles.stateBadge} ${value === "GREEN" ? styles.green : value === "AMBER" ? styles.amber : value === "RED" ? styles.red : ""}`}>{value.replaceAll("_", " ")}</span>; }
function ProcessingState({ initial }: { initial: ReviewWorkspace }) { return <main className={styles.processing}><FileSearch aria-hidden="true" /><span className={styles.eyebrow}>Local OCR worker</span><h1>{initial.document.safeDisplayName}</h1><p>Status: {initial.document.status.replaceAll("_", " ")}</p>{initial.latestJob?.failureCode && <p role="alert">Safe failure: {initial.latestJob.failureCode}. Manual entry remains available.</p>}<button type="button" onClick={() => location.reload()}>Refresh status</button></main>; }
