"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

async function requestJson(url: string, body: unknown) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(value.error ?? "Request failed.");
  return value;
}

export function WhatsAppActionButton({
  label, title, description, url, body, className = "secondary"
}: {
  label: string; title: string; description: string; url: string; body: Record<string, unknown>; className?: string;
}) {
  const router = useRouter(), [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function confirm() {
    setBusy(true); setMessage("");
    try { await requestJson(url, body); setOpen(false); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Action failed."); }
    finally { setBusy(false); }
  }
  return <><button type="button" className={className} onClick={() => setOpen(true)}>{label}</button>
    {open ? <div className="confirmation-overlay" role="presentation"><section className="card confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby={`wa-${label.replace(/\W/g, "")}`}>
      <h3 id={`wa-${label.replace(/\W/g, "")}`}>{title}</h3><p>{description}</p>
      {message ? <p className="notice danger" role="alert">{message}</p> : null}
      <div className="page-actions"><button type="button" className="secondary" onClick={() => setOpen(false)}>Go Back</button><button type="button" disabled={busy} onClick={confirm}>{busy ? "Working..." : label}</button></div>
    </section></div> : null}</>;
}

export function WhatsAppProfileCreateForm() {
  const router = useRouter(), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    try { await requestJson("/api/whatsapp/profiles", values); form.reset(); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create profile."); }
    finally { setBusy(false); }
  }
  return <form className="card card-pad form-grid whatsapp-form" onSubmit={submit}>
    <h3 className="wide">Create non-secret integration profile</h3>
    <label>Profile code<input name="profileCode" placeholder="NPS_MOCK" required /></label>
    <label>Display name<input name="displayName" placeholder="Nalanda mock provider" required /></label>
    <label>Mode<select name="mode" defaultValue="MOCK"><option>MOCK</option><option>LIVE</option></select></label>
    <label>Graph API version<input name="graphApiVersion" defaultValue="v25.0" required /></label>
    <label>Default country code<input name="defaultCountryCode" defaultValue="+91" /></label>
    <label>Quiet hours start<input name="quietHoursStart" type="time" /></label>
    <label>Quiet hours end<input name="quietHoursEnd" type="time" /></label>
    <label>Hourly limit<input name="hourlyMessageLimit" type="number" min="1" /></label>
    <label>Daily limit<input name="dailyMessageLimit" type="number" min="1" /></label>
    <label className="check-row"><input name="costCapEnabled" type="checkbox" /> Enable estimated-cost cap</label>
    <label>Maximum estimated batch cost (INR)<input name="maximumEstimatedBatchCost" type="number" min="0.01" step="0.01" /></label>
    <label>Maximum retries<input name="maximumRetryCount" type="number" min="0" max="8" defaultValue="3" /></label>
    <label>Worker chunk<input name="workerChunkSize" type="number" min="1" max="100" defaultValue="25" /></label>
    <p className="wide muted-text">No access-token, app-secret, webhook-token, or full sending-number fields exist here. Live values come only from the server environment.</p>
    <button disabled={busy}>{busy ? "Saving..." : "Create disabled profile"}</button><span className="wide" role="status">{message}</span>
  </form>;
}

export function WhatsAppProfileActions({ id, code, status, costCapEnabled, maximumEstimatedBatchCostMinor }: { id: string; code: string; status: string; costCapEnabled: boolean; maximumEstimatedBatchCostMinor: number | null }) {
  const router = useRouter(), [dialog, setDialog] = useState<"health" | "activate" | "pause" | "cost-policy" | null>(null);
  const [confirmation, setConfirmation] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const [capEnabled, setCapEnabled] = useState(costCapEnabled), [capAmount, setCapAmount] = useState(maximumEstimatedBatchCostMinor == null ? "" : (maximumEstimatedBatchCostMinor / 100).toFixed(2));
  async function act() {
    if (!dialog) return; setBusy(true); setMessage("");
    const url = dialog === "health" ? `/api/whatsapp/profiles/${id}/health` : `/api/whatsapp/profiles/${id}/workflow`;
    const body = dialog === "health" ? { network: false } : dialog === "cost-policy" ? { action: dialog, costCapEnabled: capEnabled, maximumEstimatedBatchCost: capAmount } : { action: dialog, confirmation };
    try { const value = await requestJson(url, body); setMessage(value.health?.message ?? "Profile updated."); if (dialog !== "health") { setDialog(null); router.refresh(); } }
    catch (error) { setMessage(error instanceof Error ? error.message : "Profile action failed."); }
    finally { setBusy(false); }
  }
  return <><div className="page-actions"><button type="button" className="secondary" onClick={() => setDialog("health")}>Health Check</button><button type="button" className="secondary" onClick={() => setDialog("cost-policy")}>Cost Cap</button>{status !== "ACTIVE" ? <button type="button" onClick={() => setDialog("activate")}>Activate</button> : <button type="button" className="danger" onClick={() => setDialog("pause")}>Pause</button>}</div>
    {dialog ? <div className="confirmation-overlay" role="presentation"><section className="card confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="wa-profile-dialog"><h3 id="wa-profile-dialog">{dialog === "health" ? "Check WhatsApp Integration Health" : dialog === "activate" ? "Activate WhatsApp Integration" : dialog === "cost-policy" ? "Configure Estimated WhatsApp Cost Cap" : "Pause WhatsApp Integration"}</h3>
      <p>{dialog === "activate" ? "Activation still cannot bypass the environment live flag, successful health check, or approved templates." : dialog === "pause" ? "New sends stop; webhook status processing remains available." : "This checks non-secret readiness. MOCK makes no network request."}</p>
      {dialog === "activate" ? <label>Type ACTIVATE {code}<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label> : null}
      {dialog === "cost-policy" ? <><label className="check-row"><input type="checkbox" checked={capEnabled} onChange={(event) => setCapEnabled(event.target.checked)} /> Enable estimated-cost safety cap</label><label>Maximum estimated batch cost (INR)<input type="number" min="0.01" step="0.01" value={capAmount} onChange={(event) => setCapAmount(event.target.value)} /></label><p className="muted-text">Estimate only. This policy never creates or changes a finance record.</p></> : null}
      {message ? <p role={message.includes("failed") ? "alert" : "status"}>{message}</p> : null}
      <div className="page-actions"><button type="button" className="secondary" onClick={() => setDialog(null)}>Go Back</button><button type="button" disabled={busy || (dialog === "cost-policy" && capEnabled && !capAmount)} onClick={act}>{busy ? "Working..." : dialog === "health" ? "Run Health Check" : dialog === "activate" ? "Activate Integration" : dialog === "cost-policy" ? "Save Cost Cap" : "Pause Integration"}</button></div>
    </section></div> : null}</>;
}

export function WhatsAppTemplateCreateForm({ profiles }: { profiles: Array<{ id: string; label: string }> }) {
  const router = useRouter(), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    try { await requestJson("/api/whatsapp/templates", values); form.reset(); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create mapping."); }
    finally { setBusy(false); }
  }
  return <form className="card card-pad form-grid whatsapp-form" onSubmit={submit}>
    <h3 className="wide">Map an approved Meta text template</h3>
    <label>Profile<select name="integrationProfileId" required defaultValue=""><option value="">Select profile</option>{profiles.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
    <label>Mapping code<input name="mappingCode" placeholder="GENERAL_UTILITY_EN" required /></label>
    <label>Prompt 19A category<input name="notificationCategory" placeholder="GENERAL" required /></label>
    <label>Internal purpose<input name="internalPurpose" required /></label>
    <label>Meta template name<input name="metaTemplateName" placeholder="school_operational_update" required /></label>
    <label>Language<input name="metaTemplateLanguage" defaultValue="en_US" required /></label>
    <label>Meta-approved category<select name="metaTemplateCategory"><option>UTILITY</option><option>MARKETING</option></select></label>
    <label>Provider status<select name="providerStatus" defaultValue="UNKNOWN"><option>UNKNOWN</option><option>PENDING</option><option>APPROVED</option><option>REJECTED</option><option>PAUSED</option><option>DISABLED</option></select></label>
    <label className="wide">Allowlisted parameters<input name="parameterDefinition" defaultValue="school_name,campaign_title,recipient_label,child_context" /><small>Only school_name, campaign_title, campaign_category, recipient_label, child_context.</small></label>
    <button disabled={busy}>{busy ? "Saving..." : "Create draft mapping"}</button><span className="wide" role="status">{message}</span>
  </form>;
}

export function WhatsAppConsentOfficeForm() {
  const router = useRouter(), formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState(""), [agreed, setAgreed] = useState(false), [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<"record" | "invalidate" | null>(null);
  const [pending, setPending] = useState<Record<string, FormDataEntryValue> | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    if (!agreed) { setMessage("Explicit opt-in confirmation is required."); return; }
    setPending(Object.fromEntries(new FormData(event.currentTarget)));
    setDialog("record");
  }
  async function confirm() {
    if (dialog === "record") { setDialog("invalidate"); return; }
    if (!pending) return;
    setBusy(true); setMessage("");
    try {
      await requestJson("/api/whatsapp/consents", { ...pending, explicitlyAgreed: true, confirmDefaultCountryCode: true });
      formRef.current?.reset(); setAgreed(false); setPending(null); setDialog(null); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Consent update failed."); }
    finally { setBusy(false); }
  }
  return <><form ref={formRef} className="card card-pad form-grid whatsapp-form" onSubmit={submit}>
    <h3 className="wide">Record office or paper evidence</h3>
    <label>Subject type<select name="subjectType"><option>GUARDIAN</option><option>STAFF</option></select></label>
    <label>Guardian ID (if Guardian)<input name="guardianId" /></label><label>StaffMember ID (if Staff)<input name="staffMemberId" /></label>
    <label>Source<select name="consentSource"><option>SCHOOL_OFFICE</option><option>PAPER_FORM</option><option>IMPORTED_WITH_EVIDENCE</option></select></label>
    <label>Evidence reference<input name="evidenceReference" required /></label><label>Expiry date<input name="expiresAt" type="date" /></label>
    <label className="wide check-row"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} /> I confirm this person explicitly opted in; this box was not pre-selected.</label>
    <button>Record explicit consent</button><span className="wide" role="status">{message}</span>
  </form>
    {dialog ? <div className="confirmation-overlay" role="presentation"><section className="card confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="wa-office-consent">
      <h3 id="wa-office-consent">{dialog === "record" ? "Record Verified WhatsApp Consent" : "Invalidate Consent for Changed Number"}</h3>
      <p>{dialog === "record"
        ? "Record only after checking the named paper or office evidence and confirming that the person explicitly opted in."
        : "If the authoritative phone number changed, the prior consent will be invalidated and preserved in append-only history. Fresh consent will be bound only to the current phone hash."}</p>
      {message ? <p className="notice danger" role="alert">{message}</p> : null}
      <div className="page-actions"><button type="button" className="secondary" onClick={() => setDialog(null)}>Go Back</button><button type="button" disabled={busy} onClick={confirm}>{busy ? "Working..." : dialog === "record" ? "Continue" : "Record Consent"}</button></div>
    </section></div> : null}</>;
}

export function WhatsAppBatchCreateForm({ campaigns, profiles, mappings }: {
  campaigns: Array<{ id: string; label: string }>; profiles: Array<{ id: string; label: string }>; mappings: Array<{ id: string; profileId: string; label: string }>;
}) {
  const router = useRouter(), [profileId, setProfileId] = useState(profiles[0]?.id ?? ""), [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget));
    try { const value = await requestJson("/api/whatsapp/batches", values); router.push(`/whatsapp/batches/${value.batch.id}`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create batch."); }
  }
  return <form className="card card-pad form-grid whatsapp-form" onSubmit={submit}>
    <label className="wide">Published Prompt 19A campaign<select name="notificationCampaignId" required defaultValue=""><option value="">Select campaign</option>{campaigns.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
    <label>Integration profile<select name="integrationProfileId" value={profileId} onChange={(event) => setProfileId(event.target.value)} required>{profiles.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
    <label>Approved mapping<select name="templateMappingId" required defaultValue=""><option value="">Select mapping</option>{mappings.filter((row) => row.profileId === profileId).map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
    <p className="wide muted-text">Creation snapshots the campaign and template. Preview writes zero delivery rows; approval and send remain separate.</p>
    <button>Create draft batch</button><span className="wide" role="status">{message}</span>
  </form>;
}

export function WhatsAppBatchWorkflow({ id, status, permissions }: { id: string; status: string; permissions: string[] }) {
  const router = useRouter(), [dialog, setDialog] = useState<string | null>(null), [message, setMessage] = useState(""), [schedule, setSchedule] = useState(""), [reason, setReason] = useState("");
  const has = (permission: string) => permissions.includes(permission);
  async function act() {
    if (!dialog) return; setMessage("");
    const isPreview = dialog === "preview";
    try {
      const workflowAction = dialog === "emergency-override" ? "send" : dialog;
      const value = await requestJson(isPreview ? `/api/whatsapp/batches/${id}/preview` : `/api/whatsapp/batches/${id}/workflow`,
        isPreview ? {} : { action: workflowAction, scheduledFor: dialog === "schedule" ? schedule : null, reason, emergencyOverride: dialog === "emergency-override", emergencyOverrideReason: reason });
      setMessage(isPreview ? `Eligible ${value.preview.eligibleContacts}; skipped ${value.preview.skippedContacts}; delivery rows written 0. ${value.preview.estimate.warning}` : "Batch updated.");
      setDialog(null); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Batch action failed."); }
  }
  const actions = [
    status === "DRAFT" || status === "PREVIEWED" ? ["preview", "Preview WhatsApp Batch", "CREATE_WHATSAPP_BATCHES"] : null,
    status === "PREVIEWED" ? ["submit", "Submit WhatsApp Batch for Approval", "CREATE_WHATSAPP_BATCHES"] : null,
    status === "READY_FOR_APPROVAL" ? ["approve", "Approve WhatsApp Batch", "APPROVE_WHATSAPP_BATCHES"] : null,
    ["PREVIEWED", "READY_FOR_APPROVAL"].includes(status) ? ["override-cost-cap", "Override Estimated WhatsApp Cost Cap", "OVERRIDE_WHATSAPP_COST_CAP"] : null,
    status === "APPROVED" ? ["send", "Send WhatsApp Batch", "SEND_WHATSAPP_BATCHES"] : null,
    status === "APPROVED" ? ["schedule", "Schedule WhatsApp Batch", "SCHEDULE_WHATSAPP_BATCHES"] : null,
    status === "APPROVED" && has("SEND_WHATSAPP_BATCHES") ? ["emergency-override", "Emergency Quiet-Hours Override", "OVERRIDE_WHATSAPP_QUIET_HOURS"] : null,
    ["FAILED", "PARTIALLY_FAILED"].includes(status) ? ["retry", "Retry Failed WhatsApp Deliveries", "RETRY_WHATSAPP_DELIVERIES"] : null,
    !["COMPLETED", "CANCELLED"].includes(status) ? ["cancel", "Cancel WhatsApp Batch", "CANCEL_WHATSAPP_BATCHES"] : null
  ].filter(Boolean) as string[][];
  return <section className="card card-pad"><h3>Controlled batch workflow</h3><div className="page-actions">{actions.filter((row) => has(row[2])).map((row) => <button type="button" key={row[0]} className={row[0] === "cancel" ? "danger" : row[0] === "send" ? "" : "secondary"} onClick={() => setDialog(row[0])}>{row[1]}</button>)}</div>{message ? <p role="status">{message}</p> : null}
    {dialog ? <div className="confirmation-overlay" role="presentation"><section className="card confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="wa-batch-dialog"><h3 id="wa-batch-dialog">{dialog === "emergency-override" ? "Confirm Emergency Quiet-Hours Override" : actions.find((row) => row[0] === dialog)?.[1] ?? "Confirm WhatsApp batch action"}</h3>
      <p>All consent, source-phone, template, profile, permission, rate, and quiet-hour checks run again on the server. LIVE external sending is not enabled for QA.</p>
      {dialog === "schedule" ? <label>India-local schedule time<input type="datetime-local" value={schedule} onChange={(event) => setSchedule(event.target.value)} /></label> : null}
      {["cancel", "emergency-override", "override-cost-cap"].includes(dialog) ? <label>Required {dialog === "cancel" ? "cancellation" : dialog === "override-cost-cap" ? "cost-cap override" : "emergency override"} reason<textarea required value={reason} onChange={(event) => setReason(event.target.value)} /></label> : null}
      <div className="page-actions"><button type="button" className="secondary" onClick={() => setDialog(null)}>Go Back</button><button type="button" disabled={["emergency-override", "override-cost-cap"].includes(dialog) && !reason.trim()} onClick={act}>Confirm</button></div>
    </section></div> : null}</section>;
}

export function OwnWhatsAppConsentForm({ subjectType, existing, authoritativeMask = null }: { subjectType: "GUARDIAN" | "STAFF"; existing: any; authoritativeMask?: string | null }) {
  const router = useRouter(), [agreed, setAgreed] = useState(false), [dialog, setDialog] = useState<"opt-in" | "opt-out" | null>(null), [message, setMessage] = useState("");
  const canOptIn = subjectType !== "STAFF" || Boolean(authoritativeMask);
  const url = subjectType === "GUARDIAN" ? "/api/parent/communication-preferences" : "/api/teacher/communication-preferences";
  async function act() {
    if (!dialog) return;
    try {
      await requestJson(url, dialog === "opt-out" ? { action: "opt-out", consentId: existing?.id } : { action: "opt-in", explicitlyAgreed: agreed, confirmDefaultCountryCode: true });
      setDialog(null); setAgreed(false); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Consent update failed."); }
  }
  return <section className="card card-pad whatsapp-page"><h3>Optional WhatsApp communication</h3><p>One-way school operational updates only. WhatsApp is optional; opting out does not remove in-app notifications. Message and data charges may apply.</p>
    <p><strong>Status:</strong> {existing?.status ?? "NOT OPTED IN"}</p>
    {authoritativeMask || existing?.phoneLast4 ? <p><strong>Your authoritative number:</strong> {authoritativeMask ?? `${existing.countryCode} ******${existing.phoneLast4}`}</p> : <p className="notice">No valid authoritative mobile number is available. Consent cannot be recorded until your own Staff record is corrected.</p>}
    {existing?.status === "OPTED_IN" ? <button type="button" className="danger" onClick={() => setDialog("opt-out")}>Opt out</button> : <><label className="check-row"><input type="checkbox" disabled={!canOptIn} checked={agreed} onChange={(event) => setAgreed(event.target.checked)} /> I explicitly agree to receive one-way Nalanda Public School operational updates on WhatsApp. I can opt out at any time.</label><button type="button" disabled={!agreed || !canOptIn} onClick={() => setDialog("opt-in")}>Review opt-in</button></>}
    {message ? <p role="alert">{message}</p> : null}
    {dialog ? <div className="confirmation-overlay" role="presentation"><section className="card confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="wa-own-consent"><h3 id="wa-own-consent">{dialog === "opt-in" ? "Confirm WhatsApp Opt-In" : "Confirm WhatsApp Opt-Out"}</h3><p>{dialog === "opt-in" ? "Consent is bound to your current authoritative mobile number. A number change requires fresh consent." : "Opt-out is immediate and queued deliveries will be cancelled."}</p><div className="page-actions"><button type="button" className="secondary" onClick={() => setDialog(null)}>Go Back</button><button type="button" onClick={act}>{dialog === "opt-in" ? "Confirm explicit opt-in" : "Confirm opt-out"}</button></div></section></div> : null}
  </section>;
}
