import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { AlertTriangle, CheckCircle2, CloudOff, FileClock, IndianRupee, LayoutDashboard, LockKeyhole, LogOut, RefreshCcw, ReceiptText, Settings2, ShieldCheck, Wifi } from "lucide-react";
import { formatCurrency, stateForServerOutcome, syncGuidance, validateDraft, type LocalDraft } from "./domain";
import { appProfile, exportDiagnostics, isNativeRuntime, openOnlineErp, recordDiagnostic, resetLocalCache, VaultSession, type AppProfile, type DiagnosticEvent } from "./native";
import { APP_VERSION, listenForNativeAuthorization, nativeSessionRequest, refreshNativeTokens, sha256Hex, startNativeAuthorization, versionAtLeast, type NativeTokens } from "./auth";
import { NativeOfflineStorageAdapter, type OfflineMutationEnvelope, type ReferencePack } from "./offline-adapter";
import { PRODUCT_BRAND } from "../../../config/product-brand";

function previewDraft(id: string, type: LocalDraft["type"], summary: string, amountPaise: number, state: LocalDraft["state"], updatedAt: string): LocalDraft {
  return { id, type, summary, amountPaise, state, updatedAt, clientMutationId: `preview-${id}`, payload: {}, referenceSnapshotVersion: "preview-only", baseEntityVersion: null, createdClientAt: updatedAt };
}
const seedDrafts: LocalDraft[] = [
  previewDraft("preview-1", "FEE_PAYMENT", "April fee · NPS-1042", 185000, "QUEUED", "2026-08-25T09:40:00.000Z"),
  previewDraft("preview-2", "EXPENSE_DRAFT", "Science lab supplies", 248000, "SERVER_UNAVAILABLE", "2026-08-25T09:30:00.000Z"),
  previewDraft("preview-3", "MISC_INCOME", "Hall booking receipt", 75000, "CONFLICT", "2026-08-25T08:45:00.000Z")
];

export function App() {
  const [locked, setLocked] = useState(isNativeRuntime());
  const [vault, setVault] = useState<VaultSession | null>(null);
  const [tokens, setTokens] = useState<NativeTokens | null>(null);
  const [referencePack, setReferencePack] = useState<ReferencePack | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [active, setActive] = useState("workspace");
  const [drafts, setDrafts] = useState(seedDrafts);
  const [profile, setProfile] = useState<AppProfile>({ name: "LOADING", origin: null, remoteConfigured: false, minimumServerVersion: "0.1.0", appVersion: APP_VERSION });
  const [compatibility, setCompatibility] = useState<"UNKNOWN" | "READY" | "UPDATE_REQUIRED" | "SERVER_INCOMPATIBLE" | "MAINTENANCE" | "FEATURE_DISABLED">("UNKNOWN");
  const [form, setForm] = useState({ type: "FEE_PAYMENT", summary: "", amount: "", primaryRef: "", secondaryRef: "", tertiaryRef: "", academicYear: "2026-27" });
  const [notice, setNotice] = useState("");
  const adapter = useMemo(() => vault ? new NativeOfflineStorageAdapter(vault) : null, [vault]);
  const pending = useMemo(() => drafts.filter((draft) => !["SYNCED", "REJECTED"].includes(draft.state)).length, [drafts]);

  useEffect(() => {
    appProfile().then(setProfile).catch(() => setProfile({ name: "PROFILE_ERROR", origin: null, remoteConfigured: false, minimumServerVersion: "0.1.0", appVersion: APP_VERSION }));
    const markOnline = () => setOnline(true);
    const markOffline = () => setOnline(false);
    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);
    return () => { window.removeEventListener("online", markOnline); window.removeEventListener("offline", markOffline); };
  }, []);

  useEffect(() => {
    if (!vault) return;
    let dispose: (() => void) | undefined;
    let inactivityTimer = window.setTimeout(requestLock, 5 * 60 * 1000);
    const resetInactivity = () => { window.clearTimeout(inactivityTimer); inactivityTimer = window.setTimeout(requestLock, 5 * 60 * 1000); };
    listenForNativeAuthorization(vault, (nextTokens) => { setTokens(nextTokens); setNotice("Server authorization completed. Refreshing encrypted reference data…"); void refreshReferenceData(nextTokens); }, setNotice).then((unlisten) => { dispose = unlisten; });
    const backgroundLock = () => { if (document.visibilityState === "hidden") requestLock(); else resetInactivity(); };
    document.addEventListener("visibilitychange", backgroundLock);
    for (const event of ["pointerdown", "keydown"] as const) window.addEventListener(event, resetInactivity);
    return () => { dispose?.(); window.clearTimeout(inactivityTimer); document.removeEventListener("visibilitychange", backgroundLock); for (const event of ["pointerdown", "keydown"] as const) window.removeEventListener(event, resetInactivity); };
  }, [vault]);

  async function saveDraft() {
    try {
      const localDraft = validateDraft(form);
      const contract = referencePack ? buildDraftContract(form, referencePack) : null;
      if (isNativeRuntime() && !contract) throw new Error("Connect once and download current reference data before creating an offline draft.");
      const draft: LocalDraft = { ...localDraft, payload: contract?.payload ?? {}, referenceSnapshotVersion: referencePack?.snapshotVersion ?? "", baseEntityVersion: contract?.baseEntityVersion ?? null };
      if (isNativeRuntime()) {
        if (!adapter) throw new Error("Unlock the encrypted app workspace first.");
        await adapter.drafts.put(draft);
      }
      setDrafts((current) => [draft, ...current]);
      setForm((current) => ({ ...current, summary: "", amount: "" }));
      setNotice("Draft saved locally. It is not a receipt or server-posted transaction.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Draft could not be saved."); }
  }

  async function unlock(pin: string) {
    if (!isNativeRuntime()) { setLocked(false); return; }
    const session = await VaultSession.unlock(pin);
    if (!session) throw new Error("Native secret storage is unavailable.");
    await session.initialize();
    const storage = new NativeOfflineStorageAdapter(session);
    const [restored, references] = await Promise.all([storage.drafts.list(), storage.references.current()]);
    setDrafts(restored); setReferencePack(references); setVault(session); setLocked(false);
  }

  async function lockNow() {
    const current = vault;
    if (!current) return;
    await current?.lock();
    setVault(null); setTokens(null); setReferencePack(null); setLocked(true); setDrafts([]); setNotice("");
    await recordDiagnostic("VAULT_LOCKED").catch(() => undefined);
  }

  function requestLock() {
    void lockNow().catch((error) => setNotice(`APP_LOCK_FAILED: ${error instanceof Error ? error.message : "Close the app immediately."}`));
  }

  async function persistState(id: string, state: LocalDraft["state"]) {
    const current = drafts.find((draft) => draft.id === id);
    if (!current) return;
    const next = { ...current, state, updatedAt: new Date().toISOString() };
    setDrafts((rows) => rows.map((draft) => draft.id === id ? next : draft));
    await adapter?.drafts.put(next);
  }

  async function refreshReferenceData(providedTokens?: NativeTokens) {
    if (!vault || !adapter) throw new Error("Unlock the encrypted workspace first.");
    const activeTokens = providedTokens ?? tokens ?? await refreshNativeTokens(vault);
    setTokens(activeTokens);
    const contextResponse = await nativeSessionRequest(vault, activeTokens, "CONTEXT");
    const context = JSON.parse(contextResponse.body) as { code?: string; serverVersion?: string; nativeApiVersion?: number; currentSyncSchemaVersion?: number; minimumSupportedSyncSchema?: number; minimumSupportedAppVersion?: string; maintenanceState?: string; featureAvailability?: { crossPlatformApps?: boolean; offlineSync?: boolean } };
    if (contextResponse.status !== 200 || context.nativeApiVersion !== 1 || !context.serverVersion || !context.minimumSupportedAppVersion) throw new Error(context.code ?? "Server compatibility check failed.");
    if (context.maintenanceState === "ACTIVE") { setCompatibility("MAINTENANCE"); throw new Error("Server maintenance is active. Local encrypted drafts are preserved."); }
    if (!context.featureAvailability?.crossPlatformApps || !context.featureAvailability.offlineSync) { setCompatibility("FEATURE_DISABLED"); throw new Error("FEATURE_DISABLED"); }
    if (!versionAtLeast(APP_VERSION, context.minimumSupportedAppVersion)) { setCompatibility("UPDATE_REQUIRED"); throw new Error("Update required. Sync is blocked and local drafts are preserved."); }
    if (!versionAtLeast(context.serverVersion, profile.minimumServerVersion) || context.currentSyncSchemaVersion !== 1 || context.minimumSupportedSyncSchema !== 1) { setCompatibility("SERVER_INCOMPATIBLE"); throw new Error("Server version is incompatible. Sync is blocked and local drafts are preserved."); }
    setCompatibility("READY");
    const response = await nativeSessionRequest(vault, activeTokens, "REFERENCE_PACK");
    const pack = JSON.parse(response.body) as ReferencePack & { code?: string };
    if (response.status !== 200 || pack.schemaVersion !== 1 || !pack.snapshotVersion || !pack.hardExpiresAt) throw new Error(pack.code ?? "Reference pack refresh failed.");
    await Promise.all([adapter.references.put(pack), adapter.cursors.put(pack.cursor)]);
    await recordDiagnostic("REFERENCE_REFRESHED").catch(() => undefined);
    setReferencePack(pack);
    setNotice("Current server reference data is encrypted on this device and ready for offline drafts.");
    return { activeTokens, pack };
  }

  async function stageSync(id: string) {
    if (!online || !profile.remoteConfigured) {
      await persistState(id, "SERVER_UNAVAILABLE");
      setNotice("Sync is unavailable. Your encrypted draft remains local and unchanged.");
      return;
    }
    if (!vault || !adapter) { setNotice("Unlock the encrypted workspace before checking server sync."); return; }
    const draft = drafts.find((item) => item.id === id);
    if (!draft || !draft.referenceSnapshotVersion || !Object.keys(draft.payload).length) { await persistState(id, "NEEDS_REVIEW"); setNotice("This preview or legacy draft needs review before server sync."); return; }
    try {
      await persistState(id, "QUEUED");
      const { activeTokens } = await refreshReferenceData();
      const mutation: OfflineMutationEnvelope = { clientMutationId: draft.clientMutationId, localDraftId: draft.id, operationType: draft.type, payload: draft.payload, payloadHash: await sha256Hex(stableJson(draft.payload)), createdClientAt: draft.createdClientAt, referenceSnapshotVersion: draft.referenceSnapshotVersion, baseEntityVersion: draft.baseEntityVersion };
      await adapter.outbox.put(mutation);
      await persistState(id, "SYNCING");
      const response = await nativeSessionRequest(vault, activeTokens, "SYNC", { schemaVersion: 1, mutations: [mutation] });
      const payload = JSON.parse(response.body) as { code?: string; results?: Array<{ outcome: string; code?: string; result?: Record<string, unknown> }> };
      if (response.status !== 200 || !payload.results?.length) {
        const state = response.status === 401 ? "AUTH_EXPIRED" : response.status === 404 ? "FEATURE_DISABLED" : "SERVER_UNAVAILABLE";
        await persistState(id, state); throw new Error(payload.code ?? state);
      }
      const result = payload.results[0]; const state = stateForServerOutcome(result.outcome, result.code);
      await persistState(id, state);
      await recordDiagnostic(diagnosticEventForState(state)).catch(() => undefined);
      if (state === "SYNCED") await adapter.acceptedResults.put({ clientMutationId: mutation.clientMutationId, acceptedAt: new Date().toISOString(), safeResult: result.result ?? null });
      if (state !== "SERVER_UNAVAILABLE") await adapter.outbox.remove(mutation.clientMutationId);
      setNotice(state === "SYNCED" ? "The server accepted this draft. Open the governed online ERP for the official receipt or record." : syncGuidance(state));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Server sync failed; the encrypted draft remains local.";
      const state = stateForSyncError(message);
      await persistState(id, state);
      await recordDiagnostic(diagnosticEventForState(state)).catch(() => undefined);
      setNotice(message);
    }
  }

  async function wipeLocalData(confirmation: string) {
    if (!vault || confirmation !== "ERASE LOCAL DRAFTS") throw new Error("Type the exact confirmation phrase.");
    if (tokens) await nativeSessionRequest(vault, tokens, "LOGOUT").catch(() => undefined);
    await vault.wipe();
    await resetLocalCache(confirmation);
    setVault(null); setTokens(null); setReferencePack(null); setDrafts([]); setLocked(true); setNotice("");
  }

  if (locked) return <LockScreen onUnlock={unlock} />;

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div className="brand"><img src={PRODUCT_BRAND.logoPath} alt="Nalanda Public School emblem" /><div><strong>{PRODUCT_BRAND.schoolName}</strong><span>{PRODUCT_BRAND.nativeShortName}</span></div></div>
        <nav aria-label="App sections">
          <button className={active === "workspace" ? "active" : ""} onClick={() => setActive("workspace")}><LayoutDashboard />Workspace</button>
          <button className={active === "drafts" ? "active" : ""} onClick={() => setActive("drafts")}><ReceiptText />Finance drafts <em>{pending}</em></button>
          <button className={active === "activity" ? "active" : ""} onClick={() => setActive("activity")}><FileClock />Sync activity</button>
          <button className={active === "security" ? "active" : ""} onClick={() => setActive("security")}><ShieldCheck />Security</button>
          <button className="mobile-lock" onClick={requestLock}><LockKeyhole />Lock</button>
        </nav>
        <div className="sidebar-foot"><span><Settings2 />{profile.name.replaceAll("_", " ")}</span><button onClick={requestLock}><LockKeyhole />Lock app</button></div>
      </aside>

      <main>
        <header className="topbar"><div><p className="eyebrow">ACCOUNTANT WORKSPACE</p><h1>{active === "workspace" ? PRODUCT_BRAND.productName : sectionTitle(active)}</h1></div><div className="top-actions"><span className={online ? "network online" : "network offline"}>{online ? <Wifi /> : <CloudOff />}{online ? "Network available" : "Offline"}</span><button className="secondary" onClick={() => void lockNow()}><LogOut />Lock</button></div></header>

        {!online || !profile.remoteConfigured ? <div className="offline-banner"><CloudOff /><div><strong>{!online ? "You are offline." : "No remote server is configured."}</strong><span>Drafts stay encrypted on this device and sync only after server permission, device and business-rule checks.</span></div></div> : null}
        {compatibility !== "UNKNOWN" && compatibility !== "READY" ? <div className="offline-banner" role="alert"><AlertTriangle /><div><strong>{compatibility.replaceAll("_", " ")}</strong><span>Server mutation is blocked. Local encrypted drafts are preserved for review after the condition is resolved.</span></div></div> : null}
        {notice ? <div className="notice" role="status">{notice}<button aria-label="Dismiss message" onClick={() => setNotice("")}>×</button></div> : null}

        {active === "workspace" || active === "drafts" ? <>
          <section className="summary-grid" aria-label="Workspace summary">
            <article><span className="icon navy"><IndianRupee /></span><div><small>Local draft value</small><strong>{formatCurrency(drafts.reduce((sum, draft) => sum + draft.amountPaise, 0))}</strong><p>Not posted to school accounts</p></div></article>
            <article><span className="icon amber"><RefreshCcw /></span><div><small>Awaiting server checks</small><strong>{pending}</strong><p>Safe to close and resume</p></div></article>
            <article><span className="icon teal"><ShieldCheck /></span><div><small>App protection</small><strong>{isNativeRuntime() ? "Encrypted" : "Preview"}</strong><p>Auto-lock · device-bound session</p></div></article>
          </section>

          <section className="workspace-grid">
            <article className="panel draft-panel">
              <div className="panel-title"><div><p className="eyebrow">NEW LOCAL DRAFT</p><h2>Record finance work safely</h2></div><span className="local-pill"><LockKeyhole />Local only</span></div>
              <label>Draft type<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option value="FEE_PAYMENT">Fee payment</option><option value="EXPENSE_DRAFT">Expense draft</option><option value="MISC_INCOME">Miscellaneous income</option></select></label>
              <DraftReferenceFields form={form} setForm={setForm} referencePack={referencePack} />
              <label>Student, vendor or purpose<input value={form.summary} maxLength={120} onChange={(event) => setForm({ ...form, summary: event.target.value })} placeholder="e.g. April fee · NPS-1042" /></label>
              <label>Amount (₹)<input inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0.00" /></label>
              <div className="safety-note"><AlertTriangle /><p><strong>This is a draft, not a receipt.</strong><br />The server remains authoritative for balances, permissions, receipt numbers and posting.</p></div>
              <button className="primary" onClick={saveDraft}>Save encrypted draft</button>
            </article>

            <article className="panel queue-panel">
              <div className="panel-title"><div><p className="eyebrow">SYNC QUEUE</p><h2>Recent drafts</h2></div><span>{drafts.length} items</span></div>
              <div className="draft-list">{drafts.map((draft) => <div className="draft-row" key={draft.id}><span className={`state-dot ${draft.state.toLowerCase()}`} /><div className="draft-copy"><strong>{draft.summary}</strong><span>{draft.type.replaceAll("_", " ")} · {syncGuidance(draft.state)}</span></div><div className="draft-amount"><strong>{formatCurrency(draft.amountPaise)}</strong><button onClick={() => void stageSync(draft.id)} disabled={draft.state === "SYNCED" || draft.state === "SYNCING"}>{draft.state === "DRAFT_SAVED_LOCALLY" ? "Queue" : draft.state.replaceAll("_", " ")}</button></div></div>)}</div>
            </article>
          </section>
        </> : <InfoSection active={active} remoteConfigured={profile.remoteConfigured} referenceReady={Boolean(referencePack)} appVersion={profile.appVersion} compatibility={compatibility} openOnline={() => openOnlineErp().catch((error) => setNotice(error instanceof Error ? error.message : "Online ERP unavailable."))} connect={() => vault ? startNativeAuthorization(vault, PRODUCT_BRAND.nativeShortName).catch((error) => { void recordDiagnostic("AUTHORIZATION_FAILED"); setNotice(error instanceof Error ? error.message : "Authorization could not start."); }) : setNotice("Unlock the app before connecting to the server.")} refresh={() => refreshReferenceData().catch((error) => { void recordDiagnostic("REFERENCE_REFRESH_FAILED"); setNotice(error instanceof Error ? error.message : "Reference data refresh failed."); })} wipe={(confirmation) => wipeLocalData(confirmation).catch((error) => setNotice(`LOCAL_RESET_FAILED: ${error instanceof Error ? error.message : "Close the app and contact the owner."}`))} diagnosticExport={exportDiagnostics} />}
      </main>
    </div>
  );
}

type DraftForm = { type: string; summary: string; amount: string; primaryRef: string; secondaryRef: string; tertiaryRef: string; academicYear: string };

function buildDraftContract(form: DraftForm, pack: ReferencePack) {
  if (Date.now() >= new Date(pack.hardExpiresAt).getTime()) throw new Error("Reference data expired. Reconnect before saving another draft.");
  const amount = Number(form.amount).toFixed(2); const date = new Date().toISOString().slice(0, 10);
  if (form.type === "FEE_PAYMENT") {
    const student = pack.students.find((row) => row.admissionNo === form.primaryRef);
    if (!student) throw new Error("Choose a current student reference.");
    return { baseEntityVersion: student.entityVersion, payload: { admissionNo: student.admissionNo, amountPaid: amount, date, paymentMode: "Cash", receivedAccount: "Cash", feeType: "Current Year Fee", termHint: "Auto" } };
  }
  if (form.type === "EXPENSE_DRAFT") {
    const vendor = pack.vendors.find((row) => row.id === form.primaryRef); const category = pack.expenseCategories.find((row) => row.id === form.secondaryRef); const department = pack.expenseDepartments.find((row) => row.id === form.tertiaryRef);
    if (!vendor || !category || !department || !/^\d{4}-\d{2}$/.test(form.academicYear)) throw new Error("Choose current vendor, category, department and academic-year references.");
    return { baseEntityVersion: null, payload: { expenseDate: date, academicYear: form.academicYear, vendorId: vendor.id, categoryId: category.id, departmentId: department.id, description: form.summary.trim(), grossAmount: amount, taxAmount: "0.00", deductionAmount: "0.00", netAmount: amount, paymentMethod: "CASH" } };
  }
  const item = pack.miscIncomeItems.find((row) => row.id === form.primaryRef); const rate = item?.rates.find((row) => row.academicYear === form.academicYear); const student = form.secondaryRef ? pack.students.find((row) => row.id === form.secondaryRef) : null;
  if (!item || !rate || !/^\d{4}-\d{2}$/.test(form.academicYear)) throw new Error("Choose a current miscellaneous-income item and academic-year rate.");
  if (Number(form.amount).toFixed(2) !== Number(rate.amount).toFixed(2)) throw new Error(`Use the current configured rate of ₹${rate.amount} for this offline draft.`);
  return { baseEntityVersion: item.entityVersion, payload: { receiptDate: date, academicYear: form.academicYear, studentId: student?.id ?? null, payerName: form.summary.trim(), paymentMethod: "CASH", receivedAccount: "CASH_COUNTER", lines: [{ itemId: item.id, expectedRateId: rate.id, expectedRateVersion: rate.entityVersion, quantity: 1, discountAmount: "0.00" }] } };
}

function stateForSyncError(message: string): LocalDraft["state"] {
  if (/DEVICE_NO_LONGER_ACTIVE|DEVICE_REVOKED/i.test(message)) return "DEVICE_REVOKED";
  if (/REFERENCE.*HARD_EXPIRED|REFERENCE_EXPIRED/i.test(message)) return "REFERENCE_EXPIRED";
  if (/REFERENCE.*STALE/i.test(message)) return "REFERENCE_STALE";
  if (/NATIVE_APP_UNAVAILABLE|FEATURE_DISABLED/i.test(message)) return "FEATURE_DISABLED";
  if (/AUTH|ACCESS|SESSION|401/i.test(message)) return "AUTH_EXPIRED";
  if (/APP_VERSION_INCOMPATIBLE|review/i.test(message)) return "NEEDS_REVIEW";
  return "SERVER_UNAVAILABLE";
}

function diagnosticEventForState(state: LocalDraft["state"]): DiagnosticEvent {
  if (state === "SYNCED") return "SYNC_ACCEPTED";
  if (state === "CONFLICT" || state === "NEEDS_REVIEW" || state === "REFERENCE_STALE" || state === "REFERENCE_EXPIRED") return "SYNC_CONFLICT";
  if (state === "REJECTED" || state === "FEATURE_DISABLED" || state === "AUTH_EXPIRED") return "SYNC_REJECTED";
  if (state === "DEVICE_REVOKED") return "DEVICE_REVOKED";
  return "SYNC_RETRY_LATER";
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(",")}}`;
}

function DraftReferenceFields({ form, setForm, referencePack }: { form: DraftForm; setForm: Dispatch<SetStateAction<DraftForm>>; referencePack: ReferencePack | null }) {
  if (!referencePack) return <div className="safety-note"><ShieldCheck /><p><strong>Reference data not downloaded.</strong><br />Connect through the system browser once; the app then keeps the bounded reference pack encrypted for offline use.</p></div>;
  const option = (id: string, label: string) => <option key={id} value={id}>{label}</option>;
  if (form.type === "FEE_PAYMENT") return <label>Student reference<select value={form.primaryRef} onChange={(event) => setForm({ ...form, primaryRef: event.target.value })}><option value="">Choose student</option>{referencePack.students.map((row) => option(row.admissionNo, `${row.admissionNo} · ${row.name}`))}</select></label>;
  if (form.type === "EXPENSE_DRAFT") return <>
    <label>Vendor<select value={form.primaryRef} onChange={(event) => setForm({ ...form, primaryRef: event.target.value })}><option value="">Choose vendor</option>{referencePack.vendors.map((row) => option(row.id, `${row.code} · ${row.name}`))}</select></label>
    <label>Category<select value={form.secondaryRef} onChange={(event) => setForm({ ...form, secondaryRef: event.target.value })}><option value="">Choose category</option>{referencePack.expenseCategories.map((row) => option(row.id, `${row.code} · ${row.name}`))}</select></label>
    <label>Department<select value={form.tertiaryRef} onChange={(event) => setForm({ ...form, tertiaryRef: event.target.value })}><option value="">Choose department</option>{referencePack.expenseDepartments.map((row) => option(row.id, `${row.code} · ${row.name}`))}</select></label>
    <label>Academic year<input value={form.academicYear} maxLength={7} onChange={(event) => setForm({ ...form, academicYear: event.target.value })} /></label>
  </>;
  return <>
    <label>Income item<select value={form.primaryRef} onChange={(event) => setForm({ ...form, primaryRef: event.target.value })}><option value="">Choose item</option>{referencePack.miscIncomeItems.map((row) => option(row.id, `${row.code} · ${row.name}`))}</select></label>
    <label>Student (optional)<select value={form.secondaryRef} onChange={(event) => setForm({ ...form, secondaryRef: event.target.value })}><option value="">No student link</option>{referencePack.students.map((row) => option(row.id, `${row.admissionNo} · ${row.name}`))}</select></label>
    <label>Academic year<input value={form.academicYear} maxLength={7} onChange={(event) => setForm({ ...form, academicYear: event.target.value })} /></label>
  </>;
}

function sectionTitle(section: string) { return section === "activity" ? "Sync activity" : "Security & device"; }

function InfoSection({ active, openOnline, connect, refresh, wipe, diagnosticExport, remoteConfigured, referenceReady, appVersion, compatibility }: { active: string; openOnline: () => void; connect: () => void; refresh: () => void; wipe: (confirmation: string) => void; diagnosticExport: typeof exportDiagnostics; remoteConfigured: boolean; referenceReady: boolean; appVersion: string; compatibility: string }) {
  const [resetArmed, setResetArmed] = useState(false); const [confirmation, setConfirmation] = useState(""); const [diagnostics, setDiagnostics] = useState("");
  if (active === "activity") return <section className="panel info-panel"><FileClock /><p className="eyebrow">PRIVACY-SAFE HISTORY</p><h2>Every transition is explicit</h2><p>Accepted, duplicate, conflict, rejected and retry-later outcomes are kept separately. A conflict never overwrites server data automatically.</p><button className="secondary" onClick={openOnline}>Open governed online ERP</button></section>;
  return <section className="panel info-panel"><ShieldCheck /><p className="eyebrow">DEVICE SECURITY</p><h2>The server still decides</h2><p>App unlock protects local encrypted data. Server access additionally requires an active user, current role assignment, approved device, current authorization versions and both release flags.</p><div className="security-list"><span><CheckCircle2 />App {appVersion} · compatibility {compatibility.replaceAll("_", " ")}</span><span><CheckCircle2 />No password stored in this app</span><span><CheckCircle2 />Rotating, revocable native session</span><span><CheckCircle2 />Background, inactivity and failed-attempt lock</span></div><button className="primary" disabled={!remoteConfigured} onClick={connect}>{remoteConfigured ? "Connect through system browser" : "No remote server configured"}</button><button className="secondary" disabled={!remoteConfigured} onClick={refresh} style={{ marginTop: 12 }}>{referenceReady ? "Refresh encrypted reference data" : "Download encrypted reference data"}</button><button className="secondary" style={{ marginTop: 12 }} onClick={() => void diagnosticExport().then((report) => setDiagnostics(JSON.stringify(report, null, 2)))}>Prepare redacted diagnostics</button>{diagnostics ? <label>Opt-in diagnostic report (contains no draft payload)<textarea readOnly rows={8} value={diagnostics} /></label> : null}{resetArmed ? <div className="reset-boundary"><p>This permanently erases encrypted local drafts, outbox, cached references, device key and session material. Unsynced drafts cannot be recovered.</p><label>Type ERASE LOCAL DRAFTS<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label><button className="danger" disabled={confirmation !== "ERASE LOCAL DRAFTS"} onClick={() => wipe(confirmation)}>Erase this app's local data</button><button className="secondary" onClick={() => { setResetArmed(false); setConfirmation(""); }}>Cancel</button></div> : <button className="danger" style={{ marginTop: 12 }} onClick={() => setResetArmed(true)}>Reset app data</button>}</section>;
}

function LockScreen({ onUnlock }: { onUnlock: (pin: string) => Promise<void> }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [retryAfter, setRetryAfter] = useState(0);
  useEffect(() => { if (retryAfter < 1) return; const timer = window.setInterval(() => setRetryAfter((value) => Math.max(0, value - 1)), 1000); return () => window.clearInterval(timer); }, [retryAfter > 0]);
  const submit = async () => {
    setBusy(true); setError("");
    try { await onUnlock(pin); }
    catch (reason) {
      const message = reason instanceof Error ? reason.message : "Unlock failed.";
      const blocked = message.match(/^APP_UNLOCK_BACKOFF:(\d+)$/); const failed = message.match(/^APP_UNLOCK_FAILED:(\d+)$/);
      if (blocked) { const seconds = Number(blocked[1]); setRetryAfter(seconds); setError(`Too many failed attempts. Try again in ${seconds} seconds.`); }
      else if (failed) setError(`App PIN was not accepted. ${failed[1]} attempts remain before a timed lock.`);
      else setError(message);
    } finally { setBusy(false); }
  };
  return <main className="lock-screen"><div className="lock-card"><img src={PRODUCT_BRAND.logoPath} alt="Nalanda Public School emblem" /><p className="eyebrow">{PRODUCT_BRAND.technicalDescriptor.toUpperCase()}</p><h1>Welcome back</h1><p>Unlock local encrypted drafts. This does not sign you into the school server.</p><label>App PIN<input type="password" inputMode="numeric" autoComplete="off" minLength={8} maxLength={12} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} placeholder="8–12 digits" /></label>{error ? <p role="alert">{retryAfter > 0 ? `Too many failed attempts. Try again in ${retryAfter} seconds.` : error}</p> : null}<button className="primary" disabled={pin.length < 8 || busy || retryAfter > 0} onClick={() => void submit()}><LockKeyhole />{busy ? "Unlocking…" : retryAfter > 0 ? `Wait ${retryAfter}s` : "Unlock app"}</button><span className="reset-boundary">Forgot the PIN? An owner-authorized reset erases this app's encrypted local data and requires fresh device approval.</span></div></main>;
}
