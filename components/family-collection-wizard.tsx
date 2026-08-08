"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

type Instrument = { clientKey: string; mode: string; amountPaise: number; receivedAccount: string; reference: string };

const steps = ["Payer / Guardian", "Eligible children and dues", "Payment instruments", "Child allocation", "Instrument matrix", "Invariant review", "Confirmation", "Receipt"];

export function FamilyCollectionWizard({ academicYear, correction }: { academicYear: string; correction?: { reference: string; version: number } }) {
  const [step, setStep] = useState(1);
  const [payerType, setPayerType] = useState<"GUARDIAN" | "COUNTER">("GUARDIAN");
  const [guardianQuery, setGuardianQuery] = useState("");
  const [guardianRows, setGuardianRows] = useState<any[]>([]);
  const [guardian, setGuardian] = useState<any>(null);
  const [counterpartyDisplay, setCounterpartyDisplay] = useState("");
  const [counterpartyReference, setCounterpartyReference] = useState("");
  const [counterAdmissions, setCounterAdmissions] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [auditReason, setAuditReason] = useState("");
  const [collectionDate, setCollectionDate] = useState(new Date().toISOString().slice(0, 10));
  const [instruments, setInstruments] = useState<Instrument[]>([{ clientKey: "instrument-1", mode: "CASH", amountPaise: 0, receivedAccount: "Cash", reference: "" }]);
  const [allocationMode, setAllocationMode] = useState<"AUTO" | "MANUAL">("AUTO");
  const [preview, setPreview] = useState<any>(null);
  const [manualAllocations, setManualAllocations] = useState<any[]>([]);
  const [manualShares, setManualShares] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [correctionReason, setCorrectionReason] = useState("");
  const [result, setResult] = useState<any>(null);
  const requestKeyRef = useRef(`family:${crypto.randomUUID()}`);

  const students = payerType === "GUARDIAN"
    ? (guardian?.children ?? []).filter((row: any) => selected.includes(row.admissionNo)).map((row: any) => ({ admissionNo: row.admissionNo, academicYear: row.academicYear || academicYear }))
    : counterAdmissions.split(",").map((value) => value.trim()).filter(Boolean).map((admissionNo) => ({ admissionNo, academicYear }));
  const totalPaise = instruments.reduce((sum, row) => sum + Number(row.amountPaise || 0), 0);
  const instrumentColumns = preview?.instruments ?? instruments;
  const allocationTotal = (preview?.allocations ?? []).reduce((sum: number, row: any) => sum + Number(row.amountPaise || 0), 0);
  const balanced = Boolean(preview && totalPaise === allocationTotal && preview.familyCreditPaise === 0);
  const validationSummary = useMemo(() => {
    const issues = [];
    if (!students.length) issues.push("Select at least one eligible Student.");
    if (!instruments.length || totalPaise <= 0) issues.push("Enter a positive instrument total.");
    if (instruments.some((row) => row.mode !== "CASH" && !row.reference.trim())) issues.push("Every non-cash instrument requires a reference.");
    if (preview && !balanced) issues.push("Instrument and allocation totals are not balanced.");
    return issues;
  }, [students.length, instruments, totalPaise, preview, balanced]);

  async function searchGuardians(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/family-collections/eligibility?guardian=${encodeURIComponent(guardianQuery)}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Guardian search failed");
      setGuardianRows(body.rows); setMessage(`${body.rows.length} eligible Guardian result(s).`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Guardian search failed"); }
    finally { setBusy(false); }
  }

  function requestBody(mode = allocationMode) {
    return {
      payerType,
      guardianKey: guardian?.guardianKey,
      counterpartyDisplay,
      counterpartyReference,
      auditReason: auditReason || undefined,
      collectionDate,
      students,
      instruments,
      allocationMode: mode,
      correctionOfReference: correction?.reference,
      ...(mode === "MANUAL" ? { allocations: manualAllocations, shares: manualShares } : {})
    };
  }

  async function buildPreview(mode = allocationMode) {
    setBusy(true); setMessage(""); setPreview(null);
    try {
      const response = await fetch("/api/family-collections/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(requestBody(mode)) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Preview failed");
      setPreview(body.preview);
      setManualAllocations(body.preview.allocations.map((row: any) => ({ clientKey: row.clientKey, admissionNo: row.admissionNo, academicYear: row.academicYear, installment: row.installment, feeHead: row.feeHead, amountPaise: row.amountPaise })));
      setManualShares(body.preview.shares);
      setMessage("Allocation preview is current and balanced. Review every child and instrument before confirmation.");
      setStep(6);
      return body.preview;
    } catch (error) { setMessage(error instanceof Error ? error.message : "Preview failed"); return null; }
    finally { setBusy(false); }
  }

  async function confirmCollection() {
    if (!preview) return;
    setBusy(true); setMessage("");
    try {
      const endpoint = correction ? `/api/family-collections/${encodeURIComponent(correction.reference)}/workflow` : "/api/family-collections/confirm";
      const confirmationBody = { ...requestBody(), requestKey: requestKeyRef.current, planHash: preview.planHash };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(correction ? { action: "CORRECT", expectedVersion: correction.version, reason: correctionReason, replacement: confirmationBody } : confirmationBody)
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Confirmation failed");
      setResult(body.collection); setConfirmOpen(false); setStep(8); setMessage(correction ? "Original collection superseded and replacement receipt issued atomically." : "Family collection posted and one consolidated receipt issued.");
    } catch (error) { setConfirmOpen(false); setMessage(error instanceof Error ? error.message : "Confirmation failed"); }
    finally { setBusy(false); }
  }

  function updateInstrument(index: number, field: keyof Instrument, value: string) {
    setPreview(null);
    setInstruments((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: field === "amountPaise" ? Math.round(Number(value || 0) * 100) : value } : row));
  }

  function addInstrument() {
    if (instruments.length >= 6) return;
    setInstruments((rows) => [...rows, { clientKey: `instrument-${rows.length + 1}`, mode: "UPI", amountPaise: 0, receivedAccount: "NPS Current Account UPI", reference: "" }]);
  }

  function removeInstrument(index: number) {
    setPreview(null); setInstruments((rows) => rows.filter((_, rowIndex) => rowIndex !== index));
  }

  function setManualAllocation(index: number, paise: number) {
    setAllocationMode("MANUAL"); setPreview(null);
    setManualAllocations((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, amountPaise: paise } : row));
  }

  function setManualShare(allocationKey: string, instrumentKey: string, paise: number) {
    setAllocationMode("MANUAL"); setPreview(null);
    setManualShares((rows) => {
      const found = rows.some((row) => row.allocationKey === allocationKey && row.instrumentKey === instrumentKey);
      if (found) return rows.map((row) => row.allocationKey === allocationKey && row.instrumentKey === instrumentKey ? { ...row, amountPaise: paise } : row).filter((row) => row.amountPaise > 0);
      return paise > 0 ? [...rows, { allocationKey, instrumentKey, amountPaise: paise }] : rows;
    });
  }

  return <div className="family-wizard">
    <nav className="family-stepper" aria-label="Family collection steps">{steps.map((label, index) => <button type="button" key={label} className={step === index + 1 ? "active" : step > index + 1 ? "complete" : ""} onClick={() => setStep(index + 1)}><span>{index + 1}</span>{label}</button>)}</nav>
    <div className="family-validation-summary" role="status" aria-live="polite"><strong>{busy ? "Working…" : message || `Step ${step}: ${steps[step - 1]}`}</strong>{validationSummary.length ? <ul>{validationSummary.map((issue) => <li key={issue}>{issue}</li>)}</ul> : null}</div>

    {step === 1 ? <section className="card card-pad family-step"><h2>1. Payer / Guardian</h2><div className="family-choice"><button type="button" aria-pressed={payerType === "GUARDIAN"} onClick={() => setPayerType("GUARDIAN")}>Linked Guardian</button><button type="button" aria-pressed={payerType === "COUNTER"} onClick={() => setPayerType("COUNTER")}>Authorised counterparty</button></div>{payerType === "GUARDIAN" ? <><form onSubmit={searchGuardians} className="family-inline"><label>Guardian name or exact mobile<input value={guardianQuery} onChange={(event) => setGuardianQuery(event.target.value)} minLength={2} maxLength={100} required /></label><button disabled={busy}>Find eligible family</button></form><div className="family-search-results">{guardianRows.map((row) => <button type="button" key={row.guardianKey} onClick={() => { setGuardian(row); setSelected([]); setMessage(`${row.displayName} selected.`); }} aria-pressed={guardian?.guardianKey === row.guardianKey}><strong>{row.displayName}</strong><span>{row.children.length} linked Student(s)</span></button>)}</div></> : <div className="form-grid"><label>Counterparty display name<input value={counterpartyDisplay} onChange={(event) => setCounterpartyDisplay(event.target.value)} maxLength={120} required /></label><label>Bounded counterparty reference<input value={counterpartyReference} onChange={(event) => setCounterpartyReference(event.target.value)} maxLength={120} required /></label><label className="full">Admission numbers, comma separated<input value={counterAdmissions} onChange={(event) => setCounterAdmissions(event.target.value)} maxLength={400} required /></label><label className="full">Audit reason when the children do not share one active Guardian<textarea value={auditReason} onChange={(event) => setAuditReason(event.target.value)} minLength={3} maxLength={500} /></label></div>}<div className="family-actions"><button type="button" disabled={payerType === "GUARDIAN" ? !guardian : !counterAdmissions.trim()} onClick={() => setStep(2)}>Continue to eligible children</button></div></section> : null}

    {step === 2 ? <section className="card card-pad family-step"><h2>2. Eligible children and dues</h2>{payerType === "GUARDIAN" ? <div className="family-child-grid">{guardian?.children.map((child: any) => <label className="family-child-card" key={child.admissionNo}><input type="checkbox" checked={selected.includes(child.admissionNo)} onChange={(event) => setSelected((rows) => event.target.checked ? [...rows, child.admissionNo] : rows.filter((value) => value !== child.admissionNo))} /><span><strong>{child.studentName}</strong><small>{child.admissionNo} · {child.className}{child.section ? `-${child.section}` : ""} · {child.academicYear}</small></span></label>)}</div> : <p>{students.length} admission number(s) will be resolved and authorised server-side.</p>}<label>Collection date<input type="date" value={collectionDate} onChange={(event) => setCollectionDate(event.target.value)} required /></label><div className="family-actions"><button type="button" className="secondary" onClick={() => setStep(1)}>Back</button><button type="button" disabled={!students.length} onClick={() => setStep(3)}>Continue to instruments</button></div></section> : null}

    {step === 3 ? <section className="card card-pad family-step"><h2>3. Payment instruments</h2><div className="family-instruments">{instruments.map((row, index) => <div className="family-instrument-row" key={row.clientKey}><label>Mode<select value={row.mode} onChange={(event) => updateInstrument(index, "mode", event.target.value)}>{["CASH", "UPI", "NEFT", "RTGS", "IMPS", "BANK TRANSFER", "CHEQUE", "OTHER"].map((mode) => <option key={mode}>{mode}</option>)}</select></label><label>Amount (INR)<input type="number" min="0.01" max="100000000" step="0.01" value={(row.amountPaise / 100) || ""} onChange={(event) => updateInstrument(index, "amountPaise", event.target.value)} required /></label><label>Receiving account<input value={row.receivedAccount} onChange={(event) => updateInstrument(index, "receivedAccount", event.target.value)} maxLength={120} required /></label>{row.mode !== "CASH" ? <label>Reference / UTR<input value={row.reference} onChange={(event) => updateInstrument(index, "reference", event.target.value)} maxLength={100} required /></label> : <span className="family-cash-note">Cash requires no external reference.</span>}<button type="button" className="secondary" disabled={instruments.length === 1} onClick={() => removeInstrument(index)}>Remove</button></div>)}</div><div className="family-instrument-total"><span>Instrument total</span><strong>{formatPaise(totalPaise)}</strong></div><div className="family-actions"><button type="button" className="secondary" onClick={addInstrument} disabled={instruments.length >= 6}>Add instrument</button><button type="button" disabled={validationSummary.length > 0} onClick={async () => { const built = await buildPreview("AUTO"); if (built) setStep(4); }}>Build automatic preview</button></div></section> : null}

    {step === 4 && (preview || manualAllocations.length) ? <section className="card card-pad family-step"><h2>4. Child / term / fee-head allocation</h2><p>Automatic allocation is preview-only. Edit exact paise below to switch to a controlled manual allocation.</p><div className="family-allocation-cards">{(preview?.allocations ?? manualAllocations).map((row: any, index: number) => <article key={row.clientKey} className="family-allocation-card"><div><strong>{row.studentName ?? row.admissionNo}</strong><span>{row.className}{row.section ? `-${row.section}` : ""} · {row.academicYear}</span><span>{row.installment} · {row.feeHead}</span></div><label>Allocated INR<input type="number" step="0.01" min="0.01" value={manualAllocations[index] ? manualAllocations[index].amountPaise / 100 : row.amountPaise / 100} onChange={(event) => setManualAllocation(index, Math.round(Number(event.target.value) * 100))} /></label><small>Due before {formatPaise(row.dueBeforePaise)} · remaining {formatPaise(row.dueAfterPaise)}</small></article>)}</div><div className="family-actions"><button type="button" className="secondary" onClick={() => setStep(3)}>Back</button><button type="button" onClick={() => setStep(5)}>Review instrument matrix</button></div></section> : null}

    {step === 5 && (preview || manualAllocations.length) ? <section className="card card-pad family-step"><h2>5. Allocation-to-instrument matrix</h2><div className="family-matrix-wrap"><table className="family-matrix"><thead><tr><th>Student / fee</th>{instrumentColumns.map((instrument: any) => <th key={instrument.clientKey}>{instrument.mode}<small>{formatPaise(instrument.amountPaise)}</small></th>)}</tr></thead><tbody>{(preview?.allocations ?? manualAllocations).map((allocation: any) => <tr key={allocation.clientKey}><th>{allocation.studentName ?? allocation.admissionNo}<small>{allocation.installment}</small></th>{instrumentColumns.map((instrument: any) => { const share = manualShares.find((row) => row.allocationKey === allocation.clientKey && row.instrumentKey === instrument.clientKey); return <td key={instrument.clientKey}><label><span className="sr-only">{allocation.admissionNo} from {instrument.mode}</span><input type="number" step="0.01" min="0" value={share ? share.amountPaise / 100 : ""} onChange={(event) => setManualShare(allocation.clientKey, instrument.clientKey, Math.round(Number(event.target.value || 0) * 100))} /></label></td>; })}</tr>)}</tbody></table></div><div className="family-actions"><button type="button" className="secondary" onClick={() => setStep(4)}>Back</button><button type="button" onClick={() => buildPreview(allocationMode)} disabled={busy}>{allocationMode === "MANUAL" ? "Recompute manual preview" : "Revalidate automatic preview"}</button></div></section> : null}

    {step === 6 && preview ? <section className="card card-pad family-step"><h2>6. Invariant and remaining-balance review</h2><div className={`family-invariant ${balanced ? "balanced" : "imbalanced"}`}><span>Instruments {formatPaise(totalPaise)}</span><span>=</span><span>Student allocations {formatPaise(allocationTotal)}</span><span>+ family credit {formatPaise(preview.familyCreditPaise)}</span><strong>{balanced ? "BALANCED" : "IMBALANCED"}</strong></div><div className="family-child-grid">{preview.remainingByStudent.map((row: any) => <article className="family-child-card" key={`${row.admissionNo}-${row.academicYear}`}><span><strong>{row.studentName}</strong><small>{row.academicYear} · remaining {formatPaise(row.remainingPaise)}</small></span></article>)}</div><p>Plan {preview.policyVersion} · <code>{preview.planHash.slice(0, 16)}…</code>. Family credit is disabled. Confirmation revalidates every due and reference.</p><div className="family-actions"><button type="button" className="secondary" onClick={() => setStep(5)}>Back</button><button type="button" disabled={!balanced || busy} onClick={() => { setStep(7); setConfirmOpen(true); }}>Continue to confirmation</button></div></section> : null}

    {step === 7 ? <section className="card card-pad family-step"><h2>7. Confirmation</h2><p>No posting occurs until the accessible confirmation dialog is submitted. Repeated submission uses the same single-use request key.</p>{correction ? <label>Governed correction reason<textarea value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} minLength={3} maxLength={500} required /></label> : null}<button type="button" disabled={!preview || !balanced || Boolean(correction && correctionReason.trim().length < 3)} onClick={() => setConfirmOpen(true)}>Open confirmation review</button></section> : null}

    {step === 8 && result ? <section className="card card-pad family-step"><h2>8. Receipt and reconciliation result</h2><div className="family-receipt-result"><span className="badge">{result.status}</span><h3>{result.publicReference}</h3><p>{formatPaise(result.totalPaise)} across {result.allocations.length} child allocation row(s) and {result.instruments.length} instrument(s).</p><div className="family-actions"><Link className="button" href={`/family-collections/${encodeURIComponent(result.publicReference)}`}>Open receipt</Link><Link className="button secondary" href={`/family-collections/${encodeURIComponent(result.publicReference)}/print`} target="_blank">Print / PDF view</Link></div></div></section> : null}

    {confirmOpen && preview ? <div className="modal-backdrop" role="presentation"><div className="modal-card family-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="family-confirm-title" aria-describedby="family-confirm-description"><h2 id="family-confirm-title">{correction ? "Confirm compensation and replacement" : "Confirm atomic family collection"}</h2><p id="family-confirm-description">{correction ? `Preserve and compensate ${correction.reference}, then ` : ""}Post {formatPaise(preview.totalPaise)} once, allocate every paise to {preview.allocations.length} exact due row(s), and issue one consolidated receipt. Posted history cannot be edited in place.</p><ul><li>Family credit: disabled</li><li>Instrument references: normalized, masked and uniquely reserved</li><li>Due plan: rechecked inside the transaction</li></ul><div className="family-actions"><button type="button" className="secondary" onClick={() => setConfirmOpen(false)} disabled={busy}>Return to review</button><button type="button" onClick={confirmCollection} disabled={busy || Boolean(correction && correctionReason.trim().length < 3)}>{busy ? "Posting…" : correction ? "Compensate and issue replacement" : "Confirm and issue receipt"}</button></div></div></div> : null}
  </div>;
}

function formatPaise(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(Number(value || 0) / 100);
}
