"use client";

import { KeyRound, Laptop, LogOut, MailCheck, ShieldCheck, Smartphone } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Alias = { id: string; type: string; label: string; maskedValue: string; status: string; schoolGoverned: boolean; version: number; verifiedAt: string | null; removedAt: string | null };
type Session = { id: string; current: boolean; state: string; device: string; browser: string; network: string; createdAt: string; lastSeenAt: string; expiresAt: string; revokedAt: string | null; revocationReason: string | null; version: number };
type SecurityData = { aliases: Alias[]; sessions: Session[] };
type DialogState = { kind: "alias"; alias: Alias } | { kind: "session"; session: Session } | { kind: "others" } | { kind: "all" };

export function AccountSecurityPanel({ passwordChanged }: { passwordChanged: boolean }) {
  const [data, setData] = useState<SecurityData | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(passwordChanged ? "Password updated. Other sessions were signed out." : "");
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const operationInFlight = useRef(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/auth/security", { cache: "no-store" });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error ?? "Unable to load account security");
    setData(json);
  }, []);
  useEffect(() => { load().catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load account security")); }, [load]);

  async function post(url: string, body: Record<string, unknown>) {
    if (operationInFlight.current) return null;
    operationInFlight.current = true;
    setBusy(true); setError(""); setStatus("");
    try {
      const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(json.error ?? "Unable to update account security"));
      return json;
    } finally {
      operationInFlight.current = false;
      setBusy(false);
    }
  }

  async function addAlias(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const body = Object.fromEntries(new FormData(form).entries());
      const result = await post("/api/auth/security/aliases", { action: "add", ...body });
      if (!result) return;
      form.reset(); setStatus(`Verification sent to ${result.displayMasked}.`); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to add login identifier"); }
  }

  async function verifyAlias(event: React.FormEvent<HTMLFormElement>, alias: Alias) {
    event.preventDefault();
    try {
      const code = new FormData(event.currentTarget).get("code");
      const result = await post("/api/auth/security/aliases", { action: "verify", aliasId: alias.id, expectedVersion: alias.version, code });
      if (!result) return;
      setStatus(`${alias.label} verified and ready for sign-in.`); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to verify login identifier"); }
  }

  async function confirmDialog() {
    if (!dialog) return;
    try {
      if (dialog.kind === "alias") {
        const result = await post("/api/auth/security/aliases", { action: "remove", aliasId: dialog.alias.id, expectedVersion: dialog.alias.version });
        if (!result) return;
        setStatus(`${dialog.alias.label} removed from sign-in and recovery.`);
      } else {
        const body = dialog.kind === "session"
          ? { action: "revoke-one", sessionId: dialog.session.id, expectedVersion: dialog.session.version }
          : dialog.kind === "others" ? { action: "revoke-others" } : { action: "revoke-all", confirmCurrentSession: confirmAll };
        const result = await post("/api/auth/security/sessions", body);
        if (!result) return;
        if (result.currentRevoked) { window.location.replace("/login"); return; }
        setStatus(`${result.revokedCount} session${result.revokedCount === 1 ? "" : "s"} signed out.`);
      }
      setDialog(null); setConfirmAll(false); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update account security"); }
  }

  if (!data) return <section className="card card-pad" role="status">Loading account security…{error ? <span className="error">{error}</span> : null}</section>;
  const activeOthers = data.sessions.filter((session) => !session.current && session.state === "CURRENT").length;
  return <div className="security-stack" aria-busy={busy}>
    {status ? <div className="notice success" role="status">{status}</div> : null}
    {error ? <div className="error" role="alert">{error}</div> : null}

    <section className="card card-pad security-section" aria-labelledby="aliases-heading">
      <div className="section-title"><div><h3 id="aliases-heading"><MailCheck size={20} aria-hidden /> Login identifiers</h3><p>Only verified identifiers can sign in. Profile contact data is never enabled automatically.</p></div></div>
      <div className="security-list">
        {data.aliases.map((alias) => <article className="security-row" key={alias.id}>
          <div><strong>{alias.label}</strong><span>{alias.maskedValue}</span><small>{alias.status === "VERIFIED" ? "Verified" : alias.status === "PENDING" ? "Verification pending" : "Removed"}{alias.schoolGoverned ? " · School governed" : ""}</small></div>
          {alias.status === "VERIFIED" && !alias.schoolGoverned ? <button className="secondary" type="button" onClick={() => setDialog({ kind: "alias", alias })}>Remove</button> : null}
          {alias.status === "PENDING" ? <form className="inline-verify" onSubmit={(event) => verifyAlias(event, alias)}><label>Verification code<input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required /></label><button disabled={busy}>Verify</button></form> : null}
        </article>)}
      </div>
      <form className="form-grid security-add-form" onSubmit={addAlias}>
        <label>Identifier type<select name="type" defaultValue="WORK_EMAIL"><option value="WORK_EMAIL">Work email</option><option value="PERSONAL_EMAIL">Personal email</option><option value="MOBILE">Mobile with country code</option></select></label>
        <label>New identifier<input name="value" autoCapitalize="none" autoComplete="off" required /></label>
        <div className="full"><button disabled={busy}>Add and verify</button></div>
        <p className="full muted-text">Email/SMS delivery remains disabled unless an approved adapter is configured. The copied-database local sink cannot run on the operational database.</p>
      </form>
    </section>

    <section className="card card-pad security-section" aria-labelledby="sessions-heading">
      <div className="section-title"><div><h3 id="sessions-heading"><Laptop size={20} aria-hidden /> Recent login activity</h3><p>Network evidence is masked. Exact IP addresses are neither stored nor shown here.</p></div><div className="page-actions"><button className="secondary" disabled={!activeOthers || busy} onClick={() => setDialog({ kind: "others" })}>Log out other sessions</button><button className="secondary" disabled={busy} onClick={() => setDialog({ kind: "all" })}>Log out all sessions</button></div></div>
      <div className="security-list">
        {data.sessions.map((session) => <article className="security-row session-row" key={session.id}>
          <div className="session-icon" aria-hidden>{session.device === "Mobile" ? <Smartphone size={20} /> : <Laptop size={20} />}</div>
          <div><strong>{session.device} · {session.browser}{session.current ? " · This device" : ""}</strong><span>{session.network}</span><small>Last seen {dateTime(session.lastSeenAt)} · Created {dateTime(session.createdAt)} · {session.state.toLowerCase()}</small></div>
          {session.state === "CURRENT" ? <button className="secondary" type="button" onClick={() => setDialog({ kind: "session", session })}>{session.current ? "Log out this device" : "Revoke"}</button> : null}
        </article>)}
      </div>
    </section>

    <section className="card card-pad security-section"><div className="section-title"><div><h3><KeyRound size={20} aria-hidden /> Password</h3><p>Changing your password rotates this session and revokes every other active session.</p></div><Link className="button" href="/change-password">Change Password</Link></div></section>

    {dialog ? <div className="security-dialog-backdrop" role="presentation"><div className="security-dialog" role="dialog" aria-modal="true" aria-labelledby="security-dialog-title" aria-describedby="security-dialog-description">
      <ShieldCheck size={28} aria-hidden /><h3 id="security-dialog-title">{dialogTitle(dialog)}</h3><p id="security-dialog-description">{dialogDescription(dialog)}</p>
      {dialog.kind === "all" ? <label className="dialog-confirm"><input type="checkbox" checked={confirmAll} onChange={(event) => setConfirmAll(event.target.checked)} /> I understand this device will also be signed out.</label> : null}
      <div className="page-actions"><button className="secondary" type="button" onClick={() => { setDialog(null); setConfirmAll(false); }} disabled={busy}>Cancel</button><button type="button" onClick={confirmDialog} disabled={busy || (dialog.kind === "all" && !confirmAll)}><LogOut size={16} aria-hidden /> {busy ? "Updating…" : "Confirm"}</button></div>
    </div></div> : null}
  </div>;
}

function dateTime(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function dialogTitle(dialog: DialogState) { return dialog.kind === "alias" ? "Remove login identifier?" : dialog.kind === "session" ? "Revoke this session?" : dialog.kind === "others" ? "Log out other sessions?" : "Log out all sessions?"; }
function dialogDescription(dialog: DialogState) { return dialog.kind === "alias" ? `${dialog.alias.maskedValue} will no longer work for sign-in or recovery. Its audit history remains.` : dialog.kind === "session" ? `${dialog.session.device} · ${dialog.session.browser} will need to sign in again.` : dialog.kind === "others" ? "Every active session except this device will be revoked." : "Every active session, including this device, will be revoked."; }
