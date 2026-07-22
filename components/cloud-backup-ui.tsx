"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function jsonRequest(url: string, method: string, body?: unknown) {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(value.error ?? "Cloud backup action failed safely.");
  return value;
}

type DialogKind = "activate" | "pause" | "run" | "verify" | "rehearse" | "retention" | "purge" | "cancel" | "key" | "live" | null;

export function CloudBackupActionPanel({
  profile,
  artifact,
  pendingRun,
  policy,
  permissions
}: {
  profile: any | null;
  artifact?: any | null;
  pendingRun?: any | null;
  policy?: any | null;
  permissions: string[];
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [version, setVersion] = useState(profile?.encryptionKeyVersion ?? "V1");
  const [retentionKeep, setRetentionKeep] = useState(policy?.keepLatestVerifiedCount ?? 2);
  const [retentionMinimum, setRetentionMinimum] = useState(policy?.minimumVerifiedCopies ?? 2);
  const [retentionDaily, setRetentionDaily] = useState(policy?.keepDailyDays ?? 14);
  const [retentionWeekly, setRetentionWeekly] = useState(policy?.keepWeeklyWeeks ?? 8);
  const [retentionMonthly, setRetentionMonthly] = useState(policy?.keepMonthlyMonths ?? 12);
  const [retentionAuto, setRetentionAuto] = useState(policy?.autoPruneEnabled ?? false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const can = (permission: string) => permissions.includes(permission);
  const open = (kind: DialogKind) => {
    setDialog(kind); setConfirmation(""); setReason(""); setMessage("");
    if (kind === "retention") {
      setRetentionKeep(policy?.keepLatestVerifiedCount ?? 2);
      setRetentionMinimum(policy?.minimumVerifiedCopies ?? 2);
      setRetentionDaily(policy?.keepDailyDays ?? 14);
      setRetentionWeekly(policy?.keepWeeklyWeeks ?? 8);
      setRetentionMonthly(policy?.keepMonthlyMonths ?? 12);
      setRetentionAuto(policy?.autoPruneEnabled ?? false);
    }
  };

  async function act() {
    if (!dialog || !profile) return;
    setBusy(true); setMessage("");
    try {
      if (dialog === "activate" || dialog === "pause") {
        await jsonRequest("/api/cloud-backup/profiles", "PATCH", { id: profile.id, action: dialog, confirmation });
      } else if (dialog === "run") {
        await jsonRequest("/api/cloud-backup/runs", "POST", { profileId: profile.id, confirmation });
      } else if (dialog === "verify") {
        await jsonRequest(`/api/cloud-backup/artifacts/${artifact.id}/verify`, "POST");
      } else if (dialog === "rehearse") {
        await jsonRequest("/api/cloud-backup/restore-rehearsals", "POST", { artifactId: artifact.id, confirmation });
      } else if (dialog === "retention") {
        await jsonRequest("/api/cloud-backup/retention", "PATCH", {
          profileId: profile.id,
          keepLatestVerifiedCount: retentionKeep,
          minimumVerifiedCopies: retentionMinimum,
          keepDailyDays: retentionDaily,
          keepWeeklyWeeks: retentionWeekly,
          keepMonthlyMonths: retentionMonthly,
          autoPruneEnabled: retentionAuto,
          confirmation
        });
      } else if (dialog === "purge") {
        await jsonRequest("/api/cloud-backup/retention", "POST", { profileId: profile.id, confirmation });
      } else if (dialog === "cancel") {
        await jsonRequest(`/api/cloud-backup/runs/${pendingRun.id}/workflow`, "POST", { action: "cancel", confirmation, reason });
      } else if (dialog === "key") {
        await jsonRequest("/api/cloud-backup/profiles", "PATCH", { id: profile.id, action: "key-version", version, confirmation });
      } else if (dialog === "live") {
        await jsonRequest("/api/cloud-backup/profiles", "PATCH", { id: profile.id, action: "activate-live", confirmation });
      }
      setDialog(null);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Cloud backup action failed safely."); }
    finally { setBusy(false); }
  }

  if (!profile) return <p className="notice warning">No active QA backup profile is configured.</p>;
  return <div className="cloud-backup-actions">
    <div className="page-actions">
      {can("MANAGE_CLOUD_BACKUP_PROFILES") ? <button type="button" className={profile.status === "ACTIVE" ? "danger" : "secondary"} onClick={() => open(profile.status === "ACTIVE" ? "pause" : "activate")}>{profile.status === "ACTIVE" ? "Pause Cloud Backup Profile" : "Activate Cloud Backup Profile"}</button> : null}
      {can("RUN_CLOUD_BACKUP") && profile.status === "ACTIVE" ? <button type="button" onClick={() => open("run")}>Run Encrypted Backup Now</button> : null}
      {can("VERIFY_CLOUD_BACKUP") && artifact ? <button type="button" className="secondary" onClick={() => open("verify")}>Verify Cloud Backup</button> : null}
      {can("RUN_CLOUD_BACKUP_RESTORE_REHEARSAL") && artifact?.status === "VERIFIED" ? <button type="button" className="secondary" onClick={() => open("rehearse")}>Run Isolated Restore Rehearsal</button> : null}
      {can("MANAGE_CLOUD_BACKUP_RETENTION") && policy ? <button type="button" className="secondary" onClick={() => open("retention")}>Apply Cloud Backup Retention Policy</button> : null}
      {can("PURGE_CLOUD_BACKUPS") && policy ? <button type="button" className="danger" onClick={() => open("purge")}>Purge Expired Cloud Backups</button> : null}
      {can("RUN_CLOUD_BACKUP") && pendingRun ? <button type="button" className="danger" onClick={() => open("cancel")}>Cancel Cloud Backup Run</button> : null}
      {can("CHANGE_CLOUD_BACKUP_KEY_VERSION") ? <button type="button" className="secondary" onClick={() => open("key")}>Activate New Backup Encryption Key Version</button> : null}
      {can("ACTIVATE_LIVE_CLOUD_BACKUP") ? <button type="button" className="secondary" onClick={() => open("live")}>Confirm Live Cloud Backup Activation</button> : null}
    </div>
    {message && !dialog ? <p className="notice danger" role="alert">{message}</p> : null}
    {dialog ? <CloudBackupDialog title={dialogTitle(dialog)} description={dialogDescription(dialog)} confirm={dialogConfirm(dialog)} busy={busy} onCancel={() => setDialog(null)} onConfirm={act}>
      {["activate", "run", "rehearse", "retention", "purge", "cancel", "key", "live"].includes(dialog) ? <label>Exact confirmation phrase<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={confirmationPhrase(dialog, profile, artifact, pendingRun, version)} /><small>Type: {confirmationPhrase(dialog, profile, artifact, pendingRun, version)}</small></label> : null}
      {dialog === "cancel" ? <label>Cancellation reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} /></label> : null}
      {dialog === "key" ? <label>Environment key version reference<input value={version} onChange={(event) => { setVersion(event.target.value.toUpperCase()); setConfirmation(""); }} pattern="V[1-9][0-9]{0,2}" /><small>The encryption key is never entered in the Browser or stored in Prisma.</small></label> : null}
      {dialog === "retention" ? <>
        <label>Keep latest verified copies<input type="number" min="2" max="365" value={retentionKeep} onChange={(event) => setRetentionKeep(Number(event.target.value))} /></label>
        <label>Minimum verified copies after prune<input type="number" min="2" max="365" value={retentionMinimum} onChange={(event) => setRetentionMinimum(Number(event.target.value))} /></label>
        <label>Keep daily recovery points (days)<input type="number" min="0" max="365" value={retentionDaily} onChange={(event) => setRetentionDaily(Number(event.target.value))} /></label>
        <label>Keep weekly recovery points (weeks)<input type="number" min="0" max="260" value={retentionWeekly} onChange={(event) => setRetentionWeekly(Number(event.target.value))} /></label>
        <label>Keep monthly recovery points (months)<input type="number" min="0" max="120" value={retentionMonthly} onChange={(event) => setRetentionMonthly(Number(event.target.value))} /></label>
        <label className="checkbox-row"><input type="checkbox" checked={retentionAuto} onChange={(event) => setRetentionAuto(event.target.checked)} />Enable guarded automatic prune command</label>
        <p>This action updates policy only and never deletes an object. Use the separate purge dialog after reviewing the preview.</p>
      </> : null}
      {dialog === "live" ? <p className="notice warning"><strong>LIVE remains disabled.</strong> Prompt 20C never makes an external provider call.</p> : null}
      {message ? <p className="notice danger" role="alert">{message}</p> : null}
    </CloudBackupDialog> : null}
  </div>;
}

export function CloudBackupProfileForm() {
  const router = useRouter(), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try { await jsonRequest("/api/cloud-backup/profiles", "POST", body); event.currentTarget.reset(); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Profile creation failed safely."); }
    finally { setBusy(false); }
  }
  return <form className="card card-pad form-grid" onSubmit={submit}>
    <h2 className="full-span">Create QA backup profile</h2>
    <label>Profile code<input name="profileCode" required pattern="QA20C-[A-Za-z0-9-]{3,40}" placeholder="QA20C-LOCAL-01" /></label>
    <label>Name<input name="name" required maxLength={100} placeholder="QA20C local encrypted recovery" /></label>
    <label>Provider mode<select name="providerKind" defaultValue="MOCK"><option>MOCK</option><option>LOCAL_FOLDER</option><option disabled>OBJECT_STORAGE — disabled</option><option disabled>GOOGLE_DRIVE — disabled</option></select></label>
    <label>Destination label<input name="destinationLabel" required maxLength={120} placeholder="Isolated QA recovery folder" /><small>No endpoint or absolute path is accepted here.</small></label>
    <label>Encryption key version reference<input name="encryptionKeyVersion" required defaultValue="V1" pattern="V[1-9][0-9]{0,2}" /><small>Key material remains environment-only.</small></label>
    <p className="notice warning full-span">No credential, access-token, encryption-key, OAuth, endpoint, bucket, Shared Drive, or folder-path fields exist in this form.</p>
    {message ? <p className="notice danger full-span" role="alert">{message}</p> : null}
    <div className="page-actions full-span"><button disabled={busy}>{busy ? "Creating safely…" : "Create configured profile"}</button></div>
  </form>;
}

export function CloudBackupScheduleForm({ profiles }: { profiles: any[] }) {
  const router = useRouter(), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const [frequency, setFrequency] = useState("DAILY");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const raw = Object.fromEntries(new FormData(event.currentTarget));
    const body = {
      ...raw,
      frequency,
      hourOfDay: frequency === "MANUAL_ONLY" ? null : Number(raw.hourOfDay),
      minuteOfHour: frequency === "MANUAL_ONLY" ? null : Number(raw.minuteOfHour),
      dayOfWeek: frequency === "WEEKLY" ? Number(raw.dayOfWeek) : null,
      dayOfMonth: frequency === "MONTHLY" ? Number(raw.dayOfMonth) : null,
      intervalCount: Number(raw.intervalCount),
      enabled: raw.enabled === "on"
    };
    try {
      const result = await jsonRequest("/api/cloud-backup/schedules", "POST", body);
      setMessage(`Schedule saved. Next India-local due time: ${result.schedule.nextRunAt ? new Date(result.schedule.nextRunAt).toLocaleString("en-IN") : "manual only"}. External scheduler setup is still required.`);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Schedule creation failed safely."); }
    finally { setBusy(false); }
  }
  return <form className="card card-pad form-grid" onSubmit={submit}>
    <h2 className="full-span">Create database-backed schedule</h2>
    <label>Schedule code<input name="scheduleCode" required pattern="QA20C-[A-Za-z0-9-]{3,40}" placeholder="QA20C-DAILY-01" /></label>
    <label>Profile<select name="profileId" required>{profiles.filter((row) => ["MOCK", "LOCAL_FOLDER"].includes(row.providerKind)).map((row) => <option key={row.id} value={row.id}>{row.profileCode} · {row.providerKind}</option>)}</select></label>
    <label>Frequency<select name="frequency" value={frequency} onChange={(event) => setFrequency(event.target.value)}><option>HOURLY</option><option>DAILY</option><option>WEEKLY</option><option>MONTHLY</option><option>MANUAL_ONLY</option></select></label>
    <label>Interval count<input name="intervalCount" type="number" min="1" max="365" defaultValue="1" /></label>
    {frequency !== "MANUAL_ONLY" ? <label>India-local hour<input name="hourOfDay" type="number" min="0" max="23" defaultValue="2" /></label> : null}
    {frequency !== "MANUAL_ONLY" ? <label>Minute<input name="minuteOfHour" type="number" min="0" max="59" defaultValue="0" /></label> : null}
    {frequency === "WEEKLY" ? <label>India-local weekday<select name="dayOfWeek" defaultValue="1"><option value="0">Sunday</option><option value="1">Monday</option><option value="2">Tuesday</option><option value="3">Wednesday</option><option value="4">Thursday</option><option value="5">Friday</option><option value="6">Saturday</option></select></label> : null}
    {frequency === "MONTHLY" ? <label>India-local day of month<input name="dayOfMonth" type="number" min="1" max="28" defaultValue="1" /></label> : null}
    <label>Missed-run policy<select name="catchUpPolicy" defaultValue="SKIP_MISSED"><option value="SKIP_MISSED">Skip missed run</option><option value="RUN_ONE_MISSED">Run one missed backup</option></select></label>
    <label className="checkbox-row"><input name="enabled" type="checkbox" />Enable schedule</label>
    <p className="notice warning full-span">Saving a schedule does not configure Windows Task Scheduler or a hosting cron.</p>
    {message ? <p className={message.startsWith("Schedule saved") ? "notice full-span" : "notice danger full-span"} role="status">{message}</p> : null}
    <div className="page-actions full-span"><button disabled={busy}>Create and preview due time</button></div>
  </form>;
}

export function CloudBackupHealthCheckButton({ profileId }: { profileId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function checkHealth() {
    setBusy(true); setMessage("");
    try {
      const result = await jsonRequest("/api/cloud-backup/profiles", "PATCH", { id: profileId, action: "health" });
      setMessage(`${result.health.ready ? "READY" : "NOT_READY"}: ${result.health.safeMessage}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Profile health check failed safely.");
    } finally {
      setBusy(false);
    }
  }
  return <div className="page-actions">
    <button type="button" className="secondary" onClick={checkHealth} disabled={busy}>{busy ? "Checking provider safely…" : "Run Profile Health Check"}</button>
    {message ? <p className="notice" role="status">{message}</p> : null}
  </div>;
}

function CloudBackupDialog({ title, description, confirm, busy, onCancel, onConfirm, children }: { title: string; description: string; confirm: string; busy: boolean; onCancel: () => void; onConfirm: () => void; children?: React.ReactNode }) {
  const id = `cloud-backup-dialog-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return <div className="confirmation-overlay"><section className="card confirmation-dialog cloud-backup-dialog" role="dialog" aria-modal="true" aria-labelledby={id}><h3 id={id}>{title}</h3><p>{description}</p>{children}<div className="page-actions"><button type="button" className="secondary" autoFocus onClick={onCancel} disabled={busy}>Go back</button><button type="button" onClick={onConfirm} disabled={busy}>{busy ? "Working safely…" : confirm}</button></div></section></div>;
}

function dialogTitle(dialog: Exclude<DialogKind, null>) {
  return ({ activate: "Activate Cloud Backup Profile", pause: "Pause Cloud Backup Profile", run: "Run Encrypted Backup Now", verify: "Verify Cloud Backup", rehearse: "Run Isolated Restore Rehearsal", retention: "Apply Cloud Backup Retention Policy", purge: "Purge Expired Cloud Backups", cancel: "Cancel Cloud Backup Run", key: "Activate New Backup Encryption Key Version", live: "Confirm Live Cloud Backup Activation" } as const)[dialog];
}
function dialogDescription(dialog: Exclude<DialogKind, null>) {
  return ({
    activate: "Activates one QA MOCK or LOCAL_FOLDER profile. LIVE use remains false.",
    pause: "Stops new manual and scheduled claims; immutable history remains.",
    run: "Creates, validates, compresses, encrypts, uploads, reads back, authenticates and hash-verifies one ERP JSON backup.",
    verify: "Reads the encrypted object back and repeats authentication, decryption, hashing and backup-schema validation.",
    rehearse: "This verifies recovery in a temporary database. It does not restore or change the operational ERP.",
    retention: "Applies protected minimum-copy settings after an explicit preview. This step performs no deletion.",
    purge: "Deletes only exact preview-eligible encrypted objects after latest-good and minimum-copy checks.",
    cancel: "Only an unclaimed PENDING run can be cancelled. Uploaded or verifying runs are never interrupted from the Browser.",
    key: "Confirms only a version reference whose matching 32-byte key must already exist in the server environment.",
    live: "LIVE providers remain fail-closed pending exact provider review and a later supervised phase."
  } as const)[dialog];
}
function dialogConfirm(dialog: Exclude<DialogKind, null>) {
  return ({ activate: "Activate QA profile", pause: "Pause profile", run: "Run encrypted backup", verify: "Verify read-back object", rehearse: "Run isolated rehearsal", retention: "Apply protected policy", purge: "Purge exact eligible objects", cancel: "Cancel pending run", key: "Activate version reference", live: "Attempt supervised activation" } as const)[dialog];
}
function confirmationPhrase(dialog: Exclude<DialogKind, null>, profile: any, artifact: any, run: any, version: string) {
  return ({
    activate: `ACTIVATE ${profile.profileCode}`, pause: "", run: `RUN ${profile.profileCode}`,
    verify: "", rehearse: `REHEARSE ${artifact?.id ?? ""}`, retention: `APPLY RETENTION ${profile.id}`,
    purge: `PURGE EXPIRED ${profile.id}`, cancel: `CANCEL ${run?.runNumber ?? ""}`,
    key: `ACTIVATE KEY ${version}`, live: `ACTIVATE LIVE ${profile.profileCode}`
  } as const)[dialog];
}
