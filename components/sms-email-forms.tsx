"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

async function requestJson(url: string, body: unknown) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(value.error ?? "Request failed.");
  return value;
}

export function SmsEmailActionButton({ label, title, description, url, body, className = "secondary" }: {
  label: string; title: string; description: string; url: string; body: Record<string, unknown>; className?: string;
}) {
  const router = useRouter(), [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function act() {
    setBusy(true); setMessage("");
    try { await requestJson(url, body); setOpen(false); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Action failed."); }
    finally { setBusy(false); }
  }
  return <><button type="button" className={className} onClick={() => setOpen(true)}>{label}</button>
    {open ? <div className="confirmation-overlay" role="presentation"><section className="card confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby={`se-${title.replace(/\W/g, "-")}`}>
      <h3 id={`se-${title.replace(/\W/g, "-")}`}>{title}</h3><p>{description}</p>
      {message ? <p className="notice danger" role="alert">{message}</p> : null}
      <div className="page-actions"><button type="button" className="secondary" autoFocus onClick={() => setOpen(false)}>Go Back</button><button type="button" disabled={busy} onClick={act}>{busy ? "Working…" : "Confirm"}</button></div>
    </section></div> : null}</>;
}

export function SmsEmailProfileCreateForm() {
  const router = useRouter(), [channel, setChannel] = useState<"SMS" | "EMAIL">("SMS"), [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try { await requestJson("/api/sms-email/profiles", Object.fromEntries(new FormData(event.currentTarget))); event.currentTarget.reset(); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Profile creation failed."); }
  }
  return <form className="card card-pad form-grid" onSubmit={submit}>
    <h3 className="wide">Create non-secret integration profile</h3>
    <label>Channel<select name="channel" value={channel} onChange={(event) => setChannel(event.target.value as "SMS" | "EMAIL")}><option>SMS</option><option>EMAIL</option></select></label>
    <label>Mode<select name="mode" defaultValue="MOCK"><option>MOCK</option><option>LIVE</option></select></label>
    <label>Provider kind<select name="providerKind" key={channel} defaultValue={channel === "SMS" ? "MOCK_SMS" : "MOCK_EMAIL"}>{channel === "SMS" ? <><option>MOCK_SMS</option><option>SELECTED_DLT_SMS</option></> : <><option>MOCK_EMAIL</option><option>GMAIL_API</option></>}</select></label>
    <label>Profile code<input name="profileCode" required placeholder={channel === "SMS" ? "SCHOOL_SMS" : "SCHOOL_EMAIL"} /></label>
    <label>Display name<input name="displayName" required /></label>
    <label>Hourly limit<input name="hourlyLimit" type="number" min="1" /></label>
    <label>Daily limit<input name="dailyLimit" type="number" min="1" /></label>
    <label>Quiet hours start<input name="quietHoursStart" type="time" /></label><label>Quiet hours end<input name="quietHoursEnd" type="time" /></label>
    {channel === "SMS" ? <><label>Principal Entity reference<input name="dltPrincipalEntityReference" /></label><label>Registered header reference<input name="dltHeaderReference" /></label><label>Default country code<input name="defaultCountryCode" defaultValue="+91" /></label></> : <>
      <label>Sender domain<input name="senderDomain" defaultValue="nalandaps.com" /></label>
      <label>Masked sender identity<input name="senderIdentityMasked" placeholder="s***@nalandaps.com" /></label>
      {["spfStatus", "dkimStatus", "dmarcStatus", "senderAliasStatus"].map((name) => <label key={name}>{name.replace("Status", "").toUpperCase()} status<select name={name} defaultValue="UNKNOWN"><option>UNKNOWN</option><option>VERIFIED</option><option>WARNING</option><option>FAILED</option></select></label>)}
    </>}
    <label className="check-row"><input name="costCapEnabled" type="checkbox" /> Enable estimated-cost cap</label><label>Maximum estimate (INR)<input name="maximumEstimatedBatchCost" type="number" min="0.01" step="0.01" /></label>
    <p className="wide muted-text">No credential fields exist. LIVE activation remains disabled for Prompt 19C.</p>
    <button>Create draft profile</button><span className="wide" role="status">{message}</span>
  </form>;
}

export function SmsEmailProfileActions({ id, code, channel, status }: { id: string; code: string; channel: string; status: string }) {
  const router = useRouter(), [dialog, setDialog] = useState<"health" | "activate" | "pause" | null>(null), [confirmation, setConfirmation] = useState(""), [message, setMessage] = useState("");
  async function act() {
    if (!dialog) return;
    const url = dialog === "health" ? `/api/sms-email/profiles/${id}/health` : `/api/sms-email/profiles/${id}/workflow`;
    try {
      const value = await requestJson(url, dialog === "health" ? { network: false } : { action: dialog, confirmation });
      setMessage(value.health?.message ?? "Profile updated."); if (dialog !== "health") { setDialog(null); router.refresh(); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Profile action failed."); }
  }
  const title = dialog === "health" ? `Check ${channelLabel(channel)} Integration Health` : dialog === "activate" ? `Activate ${channelLabel(channel)} Integration` : `Pause ${channelLabel(channel)} Integration`;
  return <><div className="page-actions"><button type="button" className="secondary" onClick={() => setDialog("health")}>Health Check</button>{status !== "ACTIVE" ? <button type="button" onClick={() => setDialog("activate")}>Activate</button> : <button type="button" className="danger" onClick={() => setDialog("pause")}>Pause</button>}</div>
    {dialog ? <div className="confirmation-overlay" role="presentation"><section className="card confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="se-profile-dialog"><h3 id="se-profile-dialog">{title}</h3>
      <p>{dialog === "health" ? "MOCK makes no network request. LIVE readiness never displays credentials." : "This cannot bypass feature flags, provider/DLT/domain health, approved templates or supervised activation."}</p>
      {dialog === "activate" ? <label>Type ACTIVATE {code}<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label> : null}
      {message ? <p role="status">{message}</p> : null}
      <div className="page-actions"><button type="button" className="secondary" autoFocus onClick={() => setDialog(null)}>Go Back</button><button type="button" onClick={act}>Confirm</button></div>
    </section></div> : null}</>;
}

export function SmsEmailTemplateCreateForm({ profiles }: { profiles: Array<{ id: string; channel: string; label: string }> }) {
  const router = useRouter(), [channel, setChannel] = useState<"SMS" | "EMAIL">("SMS"), [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try { await requestJson("/api/sms-email/templates", Object.fromEntries(new FormData(event.currentTarget))); event.currentTarget.reset(); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Template creation failed."); }
  }
  return <form className="card card-pad form-grid" onSubmit={submit}>
    <h3 className="wide">Create approved channel mapping</h3>
    <label>Channel<select name="channel" value={channel} onChange={(event) => setChannel(event.target.value as "SMS" | "EMAIL")}><option>SMS</option><option>EMAIL</option></select></label>
    <label>Profile<select name="integrationProfileId" required defaultValue=""><option value="">Select profile</option>{profiles.filter((row) => row.channel === channel).map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
    <label>Mapping code<input name="mappingCode" required /></label><label>Prompt 19A category<input name="notificationCategory" required defaultValue="GENERAL" /></label>
    <label>Internal purpose<input name="internalPurpose" required /></label><label>Provider status<select name="providerStatus" defaultValue="UNKNOWN"><option>UNKNOWN</option><option>PENDING</option><option>APPROVED</option><option>REJECTED</option></select></label>
    {channel === "SMS" ? <><label>Principal Entity reference<input name="smsPrincipalEntityReference" required /></label><label>Registered header<input name="smsHeader" required /></label><label>DLT template ID<input name="smsDltTemplateId" required /></label><label className="wide">Exact registered SMS text<textarea name="smsTemplateText" required defaultValue="{{schoolName}}: {{notificationTitle}}" /></label></> : <>
      <label>Approved sender alias<input name="emailSenderAlias" required defaultValue="notifications@nalandaps.com" /></label><label>Reply-to alias<input name="emailReplyToAlias" /></label><label className="wide">Plain-text subject<input name="emailSubjectTemplate" required defaultValue="{{notificationTitle}}" /></label><label className="wide">Plain-text body<textarea name="emailTextTemplate" required defaultValue={"{{schoolName}}\n\n{{notificationBody}}"} /></label>
    </>}
    <label className="wide">Allowlisted parameters<input name="parameterDefinition" defaultValue={channel === "SMS" ? "schoolName,notificationTitle" : "schoolName,notificationTitle,notificationBody"} /></label>
    <button>Create draft mapping</button><span className="wide" role="status">{message}</span>
  </form>;
}

export function SmsEmailConsentOfficeForm() {
  const router = useRouter(), formRef = useRef<HTMLFormElement>(null), [channel, setChannel] = useState<"SMS" | "EMAIL">("SMS"), [agreed, setAgreed] = useState(false);
  const [pending, setPending] = useState<Record<string, FormDataEntryValue> | null>(null), [open, setOpen] = useState(false), [message, setMessage] = useState("");
  function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (!agreed) return setMessage("Explicit opt-in confirmation is required."); setPending(Object.fromEntries(new FormData(event.currentTarget))); setOpen(true); }
  async function act() {
    try { await requestJson("/api/sms-email/consents", { ...pending, explicitlyAgreed: true, confirmDefaultCountryCode: true }); setOpen(false); setAgreed(false); formRef.current?.reset(); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Consent update failed."); }
  }
  return <><form ref={formRef} className="card card-pad form-grid" onSubmit={submit}><h3 className="wide">Record verified office consent</h3>
    <label>Channel<select name="channel" value={channel} onChange={(event) => setChannel(event.target.value as "SMS" | "EMAIL")}><option>SMS</option><option>EMAIL</option></select></label>
    <label>Subject type<select name="subjectType"><option>GUARDIAN</option><option>STAFF</option></select></label><label>Guardian ID<input name="guardianId" /></label><label>StaffMember ID<input name="staffMemberId" /></label>
    <label>Source<select name="consentSource"><option>SCHOOL_OFFICE</option><option>PAPER_FORM</option><option>IMPORTED_WITH_EVIDENCE</option></select></label><label>Evidence reference<input name="evidenceReference" required /></label>
    <label className="wide check-row"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} /> I confirm explicit consent; this box was not pre-selected.</label>
    <button>Review consent</button><span role="status">{message}</span>
  </form>{open ? <div className="confirmation-overlay" role="presentation"><section className="card confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="se-office-consent"><h3 id="se-office-consent">Record Verified {channelLabel(channel)} Consent</h3><p>Consent binds only the exact current authoritative contact. Changed contact invalidation preserves the previous history.</p><div className="page-actions"><button type="button" className="secondary" autoFocus onClick={() => setOpen(false)}>Go Back</button><button type="button" onClick={act}>Record Consent</button></div></section></div> : null}</>;
}

export function OwnSmsEmailConsentForm({ channel, subjectType, existing, maskedContact, contactChanged = false }: { channel: "SMS" | "EMAIL"; subjectType: "GUARDIAN" | "STAFF"; existing: any; maskedContact: string | null; contactChanged?: boolean }) {
  const router = useRouter(), [agreed, setAgreed] = useState(false), [dialog, setDialog] = useState<"opt-in" | "opt-out" | null>(null), [message, setMessage] = useState("");
  const url = subjectType === "GUARDIAN" ? "/api/parent/communication-preferences" : "/api/teacher/communication-preferences";
  async function act() {
    try { await requestJson(url, dialog === "opt-out" ? { channel, action: contactChanged ? "invalidate" : "opt-out", consentId: existing?.id } : { channel, action: "opt-in", explicitlyAgreed: agreed, confirmDefaultCountryCode: true }); setDialog(null); setAgreed(false); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Consent update failed."); }
  }
  return <section className="card card-pad sms-email-own-consent" id={channel.toLowerCase()}><h3>{channel === "SMS" ? "SMS" : "Email"} operational communication</h3><p>Optional, one-way school operational updates only. Consent is independent from other channels.</p><p><strong>Contact:</strong> {maskedContact ?? "No valid authoritative contact"}</p><p><strong>Status:</strong> {existing?.status ?? "NOT OPTED IN"}</p>
    {contactChanged ? <p className="notice danger" role="alert">Your authoritative {channel === "SMS" ? "phone number" : "email address"} changed. The earlier consent does not apply to this contact.</p> : null}
    {existing?.status === "OPTED_IN" ? <button type="button" className="danger" onClick={() => setDialog("opt-out")}>{contactChanged ? "Review changed contact" : "Opt out"}</button> : <><label className="check-row"><input type="checkbox" disabled={!maskedContact} checked={agreed} onChange={(event) => setAgreed(event.target.checked)} /> I explicitly agree to one-way {channel === "SMS" ? "SMS" : "Email"} operational updates.</label><button type="button" disabled={!agreed || !maskedContact} onClick={() => setDialog("opt-in")}>Review opt-in</button></>}
    {message ? <p role="alert">{message}</p> : null}
    {dialog ? <div className="confirmation-overlay" role="presentation"><section className="card confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="se-own-consent"><h3 id="se-own-consent">{dialog === "opt-in" ? `Confirm ${channelLabel(channel)} Opt-In` : contactChanged ? `Invalidate ${channelLabel(channel)} Consent for Changed ${channel === "SMS" ? "Number" : "Address"}` : `Confirm ${channelLabel(channel)} Opt-Out`}</h3><p>{dialog === "opt-in" ? `Consent is bound to the exact current ${channel === "SMS" ? "phone number" : "email address"}. A change requires fresh consent.` : contactChanged ? "The old contact-bound consent will be invalidated. Fresh explicit consent is required for the new contact." : "Opt-out is immediate and cancels unsent rows."}</p><div className="page-actions"><button type="button" className="secondary" autoFocus onClick={() => setDialog(null)}>Go Back</button><button type="button" onClick={act}>Confirm</button></div></section></div> : null}
  </section>;
}

export function SmsEmailBatchCreateForm({ campaigns, profiles, mappings }: { campaigns: any[]; profiles: any[]; mappings: any[] }) {
  const router = useRouter(), [profileId, setProfileId] = useState(profiles[0]?.id ?? ""), [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try { const value = await requestJson("/api/sms-email/batches", Object.fromEntries(new FormData(event.currentTarget))); router.push(`/sms-email/batches/${value.batch.id}`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Batch creation failed."); }
  }
  return <form className="card card-pad form-grid" onSubmit={submit}><label className="wide">Published Prompt 19A campaign<select name="notificationCampaignId" required defaultValue=""><option value="">Select campaign</option>{campaigns.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
    <label>Profile<select name="integrationProfileId" value={profileId} onChange={(event) => setProfileId(event.target.value)}>{profiles.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
    <label>Approved mapping<select name="templateMappingId" required defaultValue=""><option value="">Select mapping</option>{mappings.filter((row) => row.profileId === profileId).map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
    <p className="wide">Preview resolves masked contacts and writes zero deliveries or attempts. Approval and send remain separate.</p><button>Create draft batch</button><span role="status">{message}</span></form>;
}

export function SmsEmailBatchWorkflow({ id, channel, status, permissions }: { id: string; channel: string; status: string; permissions: string[] }) {
  const router = useRouter(), [dialog, setDialog] = useState<string | null>(null), [reason, setReason] = useState(""), [schedule, setSchedule] = useState(""), [message, setMessage] = useState("");
  const actions = [
    ["DRAFT", "PREVIEWED"].includes(status) ? ["preview", `Preview ${channelLabel(channel)} Batch`, "CREATE_SMS_EMAIL_BATCHES"] : null,
    status === "PREVIEWED" ? ["submit", "Submit External Batch for Approval", "CREATE_SMS_EMAIL_BATCHES"] : null,
    status === "READY_FOR_APPROVAL" ? ["approve", `Approve ${channelLabel(channel)} Batch`, "APPROVE_SMS_EMAIL_BATCHES"] : null,
    ["PREVIEWED", "READY_FOR_APPROVAL"].includes(status) ? ["override-cost-cap", "Override Estimated SMS/Email Cost Cap", "OVERRIDE_SMS_EMAIL_LIMITS"] : null,
    status === "APPROVED" ? ["send", `Send ${channelLabel(channel)} Batch`, "SEND_SMS_EMAIL_BATCHES"] : null,
    status === "APPROVED" ? ["schedule", `Schedule ${channelLabel(channel)} Batch`, "SCHEDULE_SMS_EMAIL_BATCHES"] : null,
    status === "APPROVED" ? ["emergency", "Confirm Emergency Quiet-Hours Override", "OVERRIDE_SMS_EMAIL_LIMITS"] : null,
    ["FAILED", "PARTIALLY_FAILED"].includes(status) ? ["retry", "Retry Failed Deliveries", "RETRY_SMS_EMAIL_DELIVERIES"] : null,
    !["COMPLETED", "CANCELLED"].includes(status) ? ["cancel", "Cancel External Batch", "CANCEL_SMS_EMAIL_BATCHES"] : null
  ].filter(Boolean) as string[][];
  async function act() {
    if (!dialog) return;
    try {
      const value = await requestJson(dialog === "preview" ? `/api/sms-email/batches/${id}/preview` : `/api/sms-email/batches/${id}/workflow`, dialog === "preview" ? {} : { action: dialog === "emergency" ? "send" : dialog, reason, scheduledFor: dialog === "schedule" ? schedule : null, emergencyOverride: dialog === "emergency", emergencyOverrideReason: reason });
      setMessage(dialog === "preview" ? `Eligible ${value.preview.eligibleContacts}; skipped ${value.preview.skippedContacts}; delivery rows 0; attempt rows 0.` : "Batch updated."); setDialog(null); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Batch action failed."); }
  }
  return <section className="card card-pad"><h3>Controlled batch workflow</h3><div className="page-actions">{actions.filter((row) => permissions.includes(row[2])).map((row) => <button key={row[0]} type="button" className={row[0] === "cancel" ? "danger" : "secondary"} onClick={() => setDialog(row[0])}>{row[1]}</button>)}</div>{message ? <p role="status">{message}</p> : null}
    {dialog ? <div className="confirmation-overlay" role="presentation"><section className="card confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="se-batch-dialog"><h3 id="se-batch-dialog">{actions.find((row) => row[0] === dialog)?.[1]}</h3><p>Ownership, contact, consent, suppression, DLT/domain readiness, rate, cost, quiet-hours and permission controls run again. QA uses MOCK only.</p>
      {dialog === "schedule" ? <label>India-local schedule time<input type="datetime-local" value={schedule} onChange={(event) => setSchedule(event.target.value)} /></label> : null}
      {["cancel", "override-cost-cap", "emergency"].includes(dialog) ? <label>Required reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} /></label> : null}
      <div className="page-actions"><button type="button" className="secondary" autoFocus onClick={() => setDialog(null)}>Go Back</button><button type="button" disabled={["cancel", "override-cost-cap", "emergency"].includes(dialog) && reason.trim().length < 3} onClick={act}>Confirm</button></div>
    </section></div> : null}</section>;
}

export function ClearSuppressionButton({ id }: { id: string }) {
  const router = useRouter(), [open, setOpen] = useState(false), [reason, setReason] = useState(""), [message, setMessage] = useState("");
  async function act() { try { await requestJson(`/api/sms-email/suppressions/${id}/clear`, { reason }); setOpen(false); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Review failed."); } }
  return <><button type="button" className="secondary" onClick={() => setOpen(true)}>Review clear</button>{open ? <div className="confirmation-overlay" role="presentation"><section className="card confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="se-clear"><h3 id="se-clear">Clear Email Suppression</h3><p>Clearing does not create consent. Authorised evidence review and a reason are required.</p><label>Review reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} /></label>{message ? <p role="alert">{message}</p> : null}<div className="page-actions"><button type="button" className="secondary" autoFocus onClick={() => setOpen(false)}>Go Back</button><button type="button" disabled={reason.trim().length < 5} onClick={act}>Clear after review</button></div></section></div> : null}</>;
}

function channelLabel(channel: string) {
  return channel === "EMAIL" ? "Email" : "SMS";
}
