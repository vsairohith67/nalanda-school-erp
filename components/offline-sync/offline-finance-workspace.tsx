"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { lockOfflineVault, offlineVaultConfigured, offlineVaultUnlocked, resetOfflineVault, setupOfflineVault, unlockOfflineVault } from "@/lib/offline-sync/client/crypto";
import { localDevice, requestDeviceRegistration, updateLocalDeviceStatus, type LocalDevice } from "@/lib/offline-sync/client/device";
import { currentReferencePack, listDrafts, purgeExpiredLocalRecords, queueDraft, refreshReferencePack, saveDraft, syncOutbox, type LocalDraft, type ReferencePack } from "@/lib/offline-sync/client/workflow";
import type { OfflineOperationType } from "@/lib/offline-sync/contracts";
import { schoolDateKey } from "@/lib/format";
import { selectOfflineMiscRate, type OfflineMiscRateReference } from "@/lib/offline-sync/rate-intent";
import { lockOfflineVaultAcrossTabs, onOfflineVaultLocked } from "@/lib/offline-sync/client/coordinator";

type Context = { userId: string; role: string; devices: Array<{ publicDeviceId: string; status: string }> };
type StudentRef = { id: string; admissionNo: string; name: string; academicYear: string; entityVersion: string; due?: { totalPending: number } | null };
type NamedRef = { id: string; name: string; code?: string | null; entityVersion: string };
type MiscRef = NamedRef & { rates: Array<OfflineMiscRateReference & { amount: string }> };
const initialDraftForm = () => ({ date: schoolDateKey(), expenseDate: schoolDateKey(), receiptDate: schoolDateKey(), paymentMode: "Cash", receivedAccount: "Cash", feeType: "Current Year Fee", termHint: "Auto", paymentMethod: "CASH", academicYear: "2026-27", grossAmount: "", taxAmount: "0", deductionAmount: "0", netAmount: "", quantity: "1", discountAmount: "0" });

export function OfflineFinanceWorkspace() {
  const [context, setContext] = useState<Context | null>(null);
  const [device, setDevice] = useState<LocalDevice | null>(null);
  const [configured, setConfigured] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [label, setLabel] = useState("Accounts counter device");
  const [references, setReferences] = useState<ReferencePack | null>(null);
  const [drafts, setDrafts] = useState<LocalDraft[]>([]);
  const [operation, setOperation] = useState<OfflineOperationType>("FEE_PAYMENT");
  const [form, setForm] = useState<Record<string, string>>(initialDraftForm);
  const [message, setMessage] = useState("Checking this browser…");
  const [busy, setBusy] = useState(false);
  const [onlineHint, setOnlineHint] = useState(true);
  const [resetOpen, setResetOpen] = useState(false);

  const reloadLocal = useCallback(async () => {
    const nextDevice = await localDevice(); setDevice(nextDevice ?? null); setConfigured(await offlineVaultConfigured()); setUnlocked(offlineVaultUnlocked());
    if (offlineVaultUnlocked()) { setReferences(await currentReferencePack()); setDrafts(await listDrafts()); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setOnlineHint(navigator.onLine);
    const online = () => setOnlineHint(true); const offline = () => setOnlineHint(false);
    window.addEventListener("online", online); window.addEventListener("offline", offline);
    const removeVaultLockListener = onOfflineVaultLocked(() => {
      setUnlocked(false); setPin(""); setReferences(null); setDrafts([]); setForm(initialDraftForm());
      setMessage("Encrypted offline vault locked across all ERP tabs.");
    });
    void (async () => {
      await purgeExpiredLocalRecords().catch(() => undefined); await reloadLocal();
      try {
        const response = await fetch("/api/offline-sync/context", { cache: "no-store" }); const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Offline finance drafts are unavailable.");
        if (cancelled) return; setContext(result);
        const local = await localDevice();
        if (local) { const remote = result.devices.find((row: { publicDeviceId: string }) => row.publicDeviceId === local.publicDeviceId); if (remote) setDevice(await updateLocalDeviceStatus(remote.status)); }
        setMessage("This workspace stores draft content only in the encrypted browser vault. Official records are created by the server after review and sync.");
      } catch (error) {
        if (!cancelled) setMessage((await localDevice()) ? "Offline mode: use the encrypted drafts already authorized on this browser. Connectivity will be checked privately before sync." : error instanceof Error ? error.message : "Offline finance drafts are unavailable.");
      }
    })();
    return () => { cancelled = true; window.removeEventListener("online", online); window.removeEventListener("offline", offline); removeVaultLockListener(); lockOfflineVault(); };
  }, [reloadLocal]);

  const students = (references?.students ?? []) as StudentRef[];
  const vendors = (references?.vendors ?? []) as NamedRef[];
  const categories = (references?.expenseCategories ?? []) as NamedRef[];
  const departments = (references?.expenseDepartments ?? []) as NamedRef[];
  const miscItems = (references?.miscIncomeItems ?? []) as MiscRef[];
  const set = (key: string) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const selectedStudent = students.find((row) => row.admissionNo === form.admissionNo);

  async function run(action: () => Promise<void>) { setBusy(true); try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : "The action could not be completed."); } finally { setBusy(false); } }
  async function register() { if (!context) throw new Error("Reconnect and sign in before registering this browser."); const remote = await requestDeviceRegistration(label, context.userId); setDevice((await localDevice()) ?? null); setMessage(`Device request ${remote.status.toLowerCase().replaceAll("_", " ")}. A Super Admin must approve it before reference data or sync is allowed.`); }
  async function configureVault() { if (!device) throw new Error("Register this browser first."); await setupOfflineVault(pin, { userId: device.ownerUserId, publicDeviceId: device.publicDeviceId }); setPin(""); await reloadLocal(); setMessage("Offline PIN configured. Keep it private; it cannot be recovered by the school."); }
  async function unlock() { if (!device) throw new Error("This browser has no offline device identity."); await unlockOfflineVault(pin, { userId: device.ownerUserId, publicDeviceId: device.publicDeviceId }); setPin(""); await reloadLocal(); setMessage("Encrypted offline vault unlocked for this tab."); }
  async function refresh() { const pack = await refreshReferencePack(); setReferences(pack); setMessage(`Reference pack refreshed. It expires on ${new Date(pack.hardExpiresAt).toLocaleString()}.`); }
  async function saveAndQueue() {
    if (!references) throw new Error("Refresh reference data first.");
    let payload: Record<string, unknown>; let baseEntityVersion: string | null | undefined;
    if (operation === "FEE_PAYMENT") {
      if (!selectedStudent) throw new Error("Select an active student from the approved reference pack.");
      payload = { admissionNo: selectedStudent.admissionNo, amountPaid: form.amountPaid, date: form.date, paymentMode: form.paymentMode, receivedAccount: form.receivedAccount, transactionRefNo: form.transactionRefNo || null, feeType: form.feeType, termHint: form.termHint, remarks: form.remarks || null }; baseEntityVersion = selectedStudent.entityVersion;
    } else if (operation === "EXPENSE_DRAFT") {
      payload = { expenseDate: form.expenseDate, academicYear: form.academicYear, vendorId: form.vendorId || null, categoryId: form.categoryId, departmentId: form.departmentId || null, description: form.description, invoiceNumber: form.invoiceNumber || null, grossAmount: form.grossAmount, taxAmount: form.taxAmount, deductionAmount: form.deductionAmount, netAmount: form.netAmount, paymentMethod: form.paymentMethod, notes: form.notes || null };
    } else {
      const item = miscItems.find((row) => row.id === form.itemId); if (!item) throw new Error("Select an active miscellaneous-income item.");
      const rate = selectOfflineMiscRate(item.rates, form.academicYear, form.receiptDate);
      payload = { receiptDate: form.receiptDate, academicYear: form.academicYear, studentId: students.find((row: any) => row.admissionNo === form.miscAdmissionNo)?.id ?? null, payerName: form.payerName || null, paymentMethod: form.paymentMethod, receivedAccount: form.paymentMethod === "CASH" ? "CASH_COUNTER" : form.miscReceivedAccount || null, transactionReference: form.transactionReference || null, lines: [{ itemId: item.id, expectedRateId: rate.id, expectedRateVersion: rate.entityVersion, quantity: form.quantity, discountAmount: form.discountAmount, notes: form.notes || null }], remarks: form.remarks || null };
    }
    const draft = await saveDraft({ operationType: operation, payload, baseEntityVersion }); await queueDraft(draft.id); await reloadLocal(); setMessage("Draft encrypted and queued. It is not an official transaction until the server accepts it.");
  }
  async function synchronize() { const result = await syncOutbox(); await reloadLocal(); setMessage(result.results.length ? `Sync finished: ${result.results.map((row: { outcome: string }) => row.outcome).join(", ")}.` : "No queued drafts are waiting to sync."); }
  async function reset() { await resetOfflineVault(); setContext(null); setDevice(null); setReferences(null); setDrafts([]); setConfigured(false); setUnlocked(false); setResetOpen(false); setMessage("This browser's app-owned offline data was deleted."); }

  const counts = useMemo(() => drafts.reduce((map, row) => ({ ...map, [row.state]: (map[row.state] ?? 0) + 1 }), {} as Record<string, number>), [drafts]);
  return (
    <main className="page offline-finance-page">
      <header className="page-header"><div><p className="eyebrow">Encrypted Accountant workspace</p><h1>Offline finance drafts</h1><p>{message}</p></div><span className={`status-badge ${onlineHint ? "success" : "warning"}`}>{onlineHint ? "Browser reports online" : "Browser reports offline"}</span></header>
      <section className="card offline-safety" aria-label="Offline safety summary"><strong>Drafts are not receipts.</strong><span>Only fee payments, expense drafts and miscellaneous-income receipts are supported. No student contacts, identity numbers, files, photos, payroll, attendance, marks or unrestricted exports are stored offline.</span></section>
      {!device ? <section className="card"><h2>1. Register this browser</h2><label>Device label<input value={label} maxLength={80} onChange={(event) => setLabel(event.target.value)} /></label><button onClick={() => void run(register)} disabled={busy || !context}>Request registration</button></section> : null}
      {device ? <section className="card"><h2>Device trust</h2><dl className="summary-list"><div><dt>Device</dt><dd>{device.label}</dd></div><div><dt>Status</dt><dd>{device.status.replaceAll("_", " ")}</dd></div><div><dt>Key version</dt><dd>{device.keyVersion}</dd></div></dl>{device.status === "PENDING_APPROVAL" ? <p>A Super Admin must approve this device while online.</p> : null}</section> : null}
      {device && !configured ? <section className="card"><h2>2. Create an offline PIN</h2><p>This PIN unlocks encrypted drafts on this browser only. It is separate from your ERP password.</p><label>Offline PIN<input type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={(event) => setPin(event.target.value)} /></label><button onClick={() => void run(configureVault)} disabled={busy}>Create encrypted vault</button></section> : null}
      {device && configured && !unlocked ? <section className="card"><h2>Unlock offline drafts</h2><label>Offline PIN<input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(event) => setPin(event.target.value)} /></label><button onClick={() => void run(unlock)} disabled={busy}>Unlock</button></section> : null}
      {device && unlocked ? <>
        <section className="card offline-workspace-actions"><div><h2>Reference data and sync</h2><p>{references ? `Last pack: ${new Date(references.generatedAt).toLocaleString()} · hard expiry: ${new Date(references.hardExpiresAt).toLocaleString()}` : "No approved reference pack on this browser."}</p></div><div className="page-actions"><button className="secondary" onClick={() => void run(refresh)} disabled={busy || device.status !== "ACTIVE"}>Refresh references</button><button onClick={() => void run(synchronize)} disabled={busy || device.status !== "ACTIVE"}>Sync queued drafts</button><button className="secondary" onClick={() => lockOfflineVaultAcrossTabs("MANUAL_LOCK")}>Lock</button></div></section>
        <section className="metric-grid"><article className="metric-card"><span>Editing</span><strong>{counts.EDITING ?? 0}</strong></article><article className="metric-card"><span>Queued</span><strong>{counts.QUEUED ?? 0}</strong></article><article className="metric-card"><span>Conflicts</span><strong>{counts.CONFLICT ?? 0}</strong></article><article className="metric-card"><span>Rejected</span><strong>{counts.REJECTED ?? 0}</strong></article></section>
        <section className="card"><h2>3. Prepare a draft</h2><div className="segmented-control" role="group" aria-label="Draft type">{(["FEE_PAYMENT", "EXPENSE_DRAFT", "MISC_INCOME"] as OfflineOperationType[]).map((type) => <button key={type} type="button" className={operation === type ? "active" : "secondary"} onClick={() => setOperation(type)}>{({ FEE_PAYMENT: "Fee payment", EXPENSE_DRAFT: "Expense", MISC_INCOME: "Misc. income" } as const)[type]}</button>)}</div>
          <form className="form-grid" onSubmit={(event) => { event.preventDefault(); void run(saveAndQueue); }}>
            {operation === "FEE_PAYMENT" ? <><label>Student<select required value={form.admissionNo ?? ""} onChange={set("admissionNo")}><option value="">Select student</option>{students.map((row) => <option key={row.admissionNo} value={row.admissionNo}>{row.name} · {row.admissionNo}{row.due ? ` · due ${row.due.totalPending}` : ""}</option>)}</select></label><label>Amount<input required inputMode="decimal" value={form.amountPaid ?? ""} onChange={set("amountPaid")} /></label><label>Date<input required type="date" value={form.date} onChange={set("date")} /></label><label>Payment method<select value={form.paymentMode} onChange={set("paymentMode")}>{(references?.dictionaries.paymentMethods ?? ["Cash"]).map((value) => <option key={value}>{value}</option>)}</select></label><label>Received account<select value={form.receivedAccount} onChange={set("receivedAccount")}>{(references?.dictionaries.receivedAccounts ?? ["Cash"]).map((value) => <option key={value}>{value}</option>)}</select></label><label>Fee type<select value={form.feeType} onChange={set("feeType")}>{(references?.dictionaries.feeTypes ?? ["Current Year Fee"]).map((value) => <option key={value}>{value}</option>)}</select></label><label>Term<select value={form.termHint} onChange={set("termHint")}>{(references?.dictionaries.termHints ?? ["Auto"]).map((value) => <option key={value}>{value}</option>)}</select></label><label>Transaction reference<input value={form.transactionRefNo ?? ""} maxLength={120} onChange={set("transactionRefNo")} /></label></> : null}
            {operation === "EXPENSE_DRAFT" ? <><label>Expense date<input required type="date" value={form.expenseDate} onChange={set("expenseDate")} /></label><label>Academic year<input required value={form.academicYear} onChange={set("academicYear")} /></label><label>Category<select required value={form.categoryId ?? ""} onChange={set("categoryId")}><option value="">Select category</option>{categories.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label>Vendor<select value={form.vendorId ?? ""} onChange={set("vendorId")}><option value="">No vendor</option>{vendors.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label>Department<select value={form.departmentId ?? ""} onChange={set("departmentId")}><option value="">No department</option>{departments.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label className="span-2">Description<input required maxLength={500} value={form.description ?? ""} onChange={set("description")} /></label><label>Gross<input required inputMode="decimal" value={form.grossAmount} onChange={set("grossAmount")} /></label><label>Tax<input required inputMode="decimal" value={form.taxAmount} onChange={set("taxAmount")} /></label><label>Deduction<input required inputMode="decimal" value={form.deductionAmount} onChange={set("deductionAmount")} /></label><label>Net<input required inputMode="decimal" value={form.netAmount} onChange={set("netAmount")} /></label><label>Payment method<select value={form.paymentMethod} onChange={set("paymentMethod")}>{["CASH", "UPI", "BANK_TRANSFER", "NEFT", "RTGS", "IMPS", "CHEQUE", "OTHER"].map((value) => <option key={value}>{value}</option>)}</select></label></> : null}
            {operation === "MISC_INCOME" ? <><label>Receipt date<input required type="date" value={form.receiptDate} onChange={set("receiptDate")} /></label><label>Academic year<input required value={form.academicYear} onChange={set("academicYear")} /></label><label>Item<select required value={form.itemId ?? ""} onChange={set("itemId")}><option value="">Select item</option>{miscItems.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label>Quantity<input required inputMode="numeric" value={form.quantity} onChange={set("quantity")} /></label><label>Discount<input required inputMode="decimal" value={form.discountAmount} onChange={set("discountAmount")} /></label><label>Student (when required)<select value={form.miscAdmissionNo ?? ""} onChange={set("miscAdmissionNo")}><option value="">No student</option>{students.map((row) => <option key={row.admissionNo} value={row.admissionNo}>{row.name} · {row.admissionNo}</option>)}</select></label><label>Payer name<input maxLength={120} value={form.payerName ?? ""} onChange={set("payerName")} /></label><label>Payment method<select value={form.paymentMethod} onChange={set("paymentMethod")}>{["CASH", "UPI", "BANK_TRANSFER", "NEFT", "RTGS", "IMPS", "CHEQUE", "OTHER"].map((value) => <option key={value}>{value}</option>)}</select></label></> : null}
            <label className="span-2">Notes<textarea maxLength={1000} value={form.notes ?? form.remarks ?? ""} onChange={operation === "FEE_PAYMENT" ? set("remarks") : set("notes")} /></label><div className="span-2"><button type="submit" disabled={busy || !references || device.status !== "ACTIVE"}>Encrypt and queue draft</button></div>
          </form>
        </section>
        <section className="card"><h2>Draft queue</h2>{drafts.length ? <ul className="offline-draft-list">{drafts.map((draft) => <li key={draft.id}><strong>{draft.operationType.replaceAll("_", " ")}</strong><span>{draft.state} · {new Date(draft.updatedAt).toLocaleString()}</span></li>)}</ul> : <p>No encrypted drafts on this browser.</p>}</section>
      </> : null}
      <section className="card danger-zone"><h2>Reset local offline data</h2><p>Use this if the PIN is forgotten or the device is reassigned. This deletes only this app's IndexedDB database. Pending drafts cannot be recovered.</p><button className="danger" onClick={() => setResetOpen(true)} disabled={busy}>Reset this browser's offline data</button></section>
      {resetOpen ? <div className="confirmation-overlay" role="presentation"><section className="card confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="offline-reset-title" aria-describedby="offline-reset-description"><h2 id="offline-reset-title">Delete local offline data?</h2><p id="offline-reset-description">Encrypted drafts, device keys, reference packs and accepted-result history in this browser will be permanently deleted. Official ERP records are unchanged.</p><div className="page-actions"><button type="button" className="secondary" autoFocus disabled={busy} onClick={() => setResetOpen(false)}>Go back</button><button type="button" className="danger" disabled={busy} onClick={() => void run(reset)}>{busy ? "Deleting…" : "Delete local offline data"}</button></div></section></div> : null}
    </main>
  );
}
