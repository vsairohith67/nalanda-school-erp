"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Detail = {
  handle: string;
  name: string;
  username: string;
  email: string | null;
  designation: string | null;
  status: string;
  active: boolean;
  version: number;
  mustChangePassword: boolean;
  roles: Array<{ handle: string; label: string; status: string; validFrom: string; validUntil: string | null; endedAt: string | null; version: number }>;
  profiles: Array<{ handle: string; name: string; profileStatus: string; status: string; validUntil: string | null; version: number }>;
  overrides: Array<{ handle: string; permission: string; effect: string; status: string; validUntil: string | null; version: number }>;
  sessions: Array<{ status: string; device: string; browser: string; createdAt: string }>;
  history: Array<{ action: string; actor: string; details: Record<string, unknown> | null; createdAt: string }>;
};
type Decision = { permission: string | null; allowed: boolean; source: string; reason: string; profileNames: string[]; objectScopeRequired: boolean; delegability: string | null };
type Option = { value: string; label: string };
type Profile = { handle: string; label: string };
type PendingAction = { action: string; title: string; assignmentHandle?: string; overrideHandle?: string } | null;

export function NamedUserDetail({ detail, decisions, roles, profiles, permissions, canManage, canAssignProfiles, canManageOverrides }: {
  detail: Detail;
  decisions: Decision[];
  roles: Option[];
  profiles: Profile[];
  permissions: Option[];
  canManage: boolean;
  canAssignProfiles: boolean;
  canManageOverrides: boolean;
}) {
  const router = useRouter();
  const [version, setVersion] = useState(detail.version);
  const [pending, setPending] = useState<PendingAction>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [accessFilter, setAccessFilter] = useState("ALLOWED");
  const permissionLabels = new Map(permissions.map((permission) => [permission.value, permission.label]));
  const visibleDecisions = decisions.filter((decision) => accessFilter === "ALL" || (accessFilter === "ALLOWED" ? decision.allowed : !decision.allowed));

  async function mutate(payload: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/iam/users/${encodeURIComponent(detail.handle)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, expectedVersion: version })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Unable to change access");
      if (data.version) setVersion(data.version);
      setMessage("Governed access change completed. Affected sessions were invalidated.");
      setPending(null);
      router.refresh();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to change access");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function submitStructured(event: React.FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = Object.fromEntries(form.entries()) as Record<string, unknown>;
    void mutate({ ...payload, action }).then((succeeded) => {
      if (succeeded) formElement.reset();
      else clearReauthenticationField(formElement);
    });
  }

  async function confirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await mutate({ ...pending, reason: form.get("reason"), reauthPassword: form.get("reauthPassword") });
    clearReauthenticationField(formElement);
  }

  return (
    <div className="iam-workspace">
      {message ? <div className={message.startsWith("Governed") ? "notice" : "error"} role="status" aria-live="polite">{message}</div> : null}
      <section className="card iam-identity-card"><div><span>Named user</span><strong>{detail.name}</strong><small>@{detail.username}</small></div><div><span>Human designation</span><strong>{detail.designation ?? "Not set"}</strong><small>Designation does not grant authority.</small></div><div><span>Lifecycle</span><strong>{label(detail.status)}</strong><small>{detail.mustChangePassword ? "Password change required" : "Credential state governed"}</small></div><div><span>Version</span><strong>{version}</strong><small>Expected-version protected</small></div></section>
      {canManage || canAssignProfiles || canManageOverrides ? <section className="card iam-action-grid">
        {canManage && roles.length ? <form onSubmit={(event) => submitStructured(event, "ASSIGN_ROLE")}><h3>Add base role context</h3><label>Role<select name="role" required defaultValue=""><option value="">Choose role</option>{roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label><label>Valid until<input name="validUntil" type="datetime-local" /></label><CriticalFields /><button disabled={busy}>Assign role</button></form> : null}
        {canAssignProfiles ? <form onSubmit={(event) => submitStructured(event, "ASSIGN_PROFILE")}><h3>Assign permission profile</h3><label>Profile<select name="profileHandle" required defaultValue=""><option value="">Choose profile</option>{profiles.map((profile) => <option key={profile.handle} value={profile.handle}>{profile.label}</option>)}</select></label><label>Valid until<input name="validUntil" type="datetime-local" /></label><CriticalFields /><button disabled={busy}>Assign profile</button></form> : null}
        {canManageOverrides ? <form onSubmit={(event) => submitStructured(event, "SET_OVERRIDE")}><h3>Individual grant or denial</h3><label>Permission<select name="permission" required defaultValue=""><option value="">Choose permission</option>{permissions.map((permission) => <option key={permission.value} value={permission.value}>{permission.label}</option>)}</select></label><label>Effect<select name="effect"><option value="DENY">Explicit denial</option><option value="ALLOW">Narrow additional grant</option></select></label><label>Valid until<input name="validUntil" type="datetime-local" /></label><CriticalFields /><button disabled={busy}>Set override</button></form> : null}
        {canManage ? <form onSubmit={(event) => submitStructured(event, "UPDATE_IDENTITY")}><h3>Display identity</h3><label>Name<input name="name" defaultValue={detail.name} required maxLength={100} /></label><label>Username<input name="username" defaultValue={detail.username} required maxLength={64} autoComplete="off" /></label><label>Email<input name="email" type="email" defaultValue={detail.email ?? ""} maxLength={254} autoComplete="off" /></label><label>Human designation<input name="designation" defaultValue={detail.designation ?? ""} maxLength={100} /></label><CriticalFields /><button disabled={busy}>Update identity</button></form> : null}
      </section> : null}
      {canManage && detail.status === "ACTIVE" ? <div className="page-actions"><button type="button" className="danger" onClick={() => setPending({ action: "SUSPEND", title: "Suspend this named user?" })}>Suspend user</button></div> : null}
      {canManage && detail.status === "SUSPENDED" ? <div className="page-actions"><button type="button" className="secondary" onClick={() => setPending({ action: "REACTIVATE", title: "Reactivate this named user?" })}>Reactivate user</button></div> : null}

      <section className="card"><h2>Base role assignments</h2><div className="table-wrap"><table><thead><tr><th>Role context</th><th>Status</th><th>Validity</th><th>Action</th></tr></thead><tbody>{detail.roles.map((role) => <tr key={role.handle}><td>{role.label}</td><td>{label(role.status)}</td><td>{new Date(role.validFrom).toLocaleString("en-IN")} → {role.validUntil ? new Date(role.validUntil).toLocaleString("en-IN") : "Open ended"}</td><td>{canManage && role.status === "ACTIVE" ? <button type="button" className="secondary" onClick={() => setPending({ action: "END_ROLE", title: `End ${role.label} assignment?`, assignmentHandle: role.handle })}>End assignment</button> : "Historical"}</td></tr>)}</tbody></table></div></section>
      <section className="card"><h2>Assigned permission profiles</h2><div className="table-wrap"><table><thead><tr><th>Profile</th><th>Status</th><th>Validity</th><th>Action</th></tr></thead><tbody>{detail.profiles.map((profile) => <tr key={profile.handle}><td>{profile.name}</td><td>{label(profile.status)} · profile {label(profile.profileStatus)}</td><td>{profile.validUntil ? new Date(profile.validUntil).toLocaleString("en-IN") : "Open ended"}</td><td>{canAssignProfiles && profile.status === "ACTIVE" ? <button type="button" className="secondary" onClick={() => setPending({ action: "END_PROFILE", title: `End ${profile.name} assignment?`, assignmentHandle: profile.handle })}>End assignment</button> : "Historical"}</td></tr>)}{!detail.profiles.length ? <tr><td colSpan={4}>No profile assignments.</td></tr> : null}</tbody></table></div></section>
      <section className="card"><h2>Individual grants and explicit denials</h2><div className="table-wrap"><table><thead><tr><th>Permission</th><th>Source</th><th>Status / validity</th><th>Action</th></tr></thead><tbody>{detail.overrides.map((override) => <tr key={override.handle}><td>{permissionLabels.get(override.permission) ?? "Governed permission"}</td><td>{override.effect === "DENY" ? "Individual denial" : "Individual grant"}</td><td>{label(override.status)}{override.validUntil ? ` · until ${new Date(override.validUntil).toLocaleString("en-IN")}` : ""}</td><td>{canManageOverrides && override.status === "ACTIVE" ? <button type="button" className="secondary" onClick={() => setPending({ action: "REVOKE_OVERRIDE", title: "Revoke this individual override?", overrideHandle: override.handle })}>Revoke override</button> : "Historical"}</td></tr>)}{!detail.overrides.length ? <tr><td colSpan={4}>No individual overrides.</td></tr> : null}</tbody></table></div></section>

      <section className="card"><div className="iam-section-heading"><div><h2>Effective-access preview</h2><p>Denials win. Object-scoped grants still require the exact server-side relationship resolver.</p></div><label>Show<select value={accessFilter} onChange={(event) => setAccessFilter(event.target.value)}><option value="ALLOWED">Allowed</option><option value="DENIED">Denied</option><option value="ALL">All decisions</option></select></label></div><div className="table-wrap"><table><thead><tr><th>Permission</th><th>Decision</th><th>Source</th><th>Restriction</th></tr></thead><tbody>{visibleDecisions.map((decision) => <tr key={decision.permission ?? decision.reason}><td>{decision.permission ? permissionLabels.get(decision.permission) ?? "Governed permission" : "Unknown permission"}</td><td>{decision.allowed ? "Allowed" : "Denied"}</td><td>{label(decision.source)}{decision.profileNames.length ? ` · ${decision.profileNames.join(", ")}` : ""}<small>{decision.reason}</small></td><td>{decision.objectScopeRequired ? "Exact object scope required" : label(decision.delegability ?? "Ordinary delegable")}</td></tr>)}</tbody></table></div></section>
      <section className="card"><h2>Session and security status</h2><div className="table-wrap"><table><thead><tr><th>Status</th><th>Device</th><th>Browser</th><th>Created</th></tr></thead><tbody>{detail.sessions.map((session, index) => <tr key={`${session.createdAt}-${index}`}><td>{session.status}</td><td>{session.device}</td><td>{session.browser}</td><td>{new Date(session.createdAt).toLocaleString("en-IN")}</td></tr>)}{!detail.sessions.length ? <tr><td colSpan={4}>No session history.</td></tr> : null}</tbody></table></div></section>
      <section className="card"><h2>Append-only access history</h2><div className="table-wrap"><table><thead><tr><th>Action</th><th>Actor</th><th>When</th><th>Evidence</th></tr></thead><tbody>{detail.history.map((event, index) => <tr key={`${event.createdAt}-${index}`}><td>{label(event.action)}</td><td>{event.actor}</td><td>{new Date(event.createdAt).toLocaleString("en-IN")}</td><td>{event.details ? Object.entries(event.details).map(([key, value]) => `${label(key)}: ${auditValue(key, value, permissionLabels)}`).join(" · ") : "Privacy-safe event"}</td></tr>)}{!detail.history.length ? <tr><td colSpan={4}>No IAM history yet.</td></tr> : null}</tbody></table></div></section>

      {pending ? <div className="dialog-backdrop" role="presentation"><section className="security-dialog iam-dialog" role="dialog" aria-modal="true" aria-labelledby="iam-confirm-title"><h2 id="iam-confirm-title">{pending.title}</h2><p>This is append-only and expected-version protected. Critical access changes invalidate affected sessions.</p><form onSubmit={confirm}><CriticalFields autoFocus /><div className="dialog-actions"><button type="button" className="secondary" onClick={() => setPending(null)} disabled={busy}>Cancel</button><button type="submit" className="danger" disabled={busy}>{busy ? "Applying…" : "Confirm governed change"}</button></div></form></section></div> : null}
    </div>
  );
}

function CriticalFields({ autoFocus = false }: { autoFocus?: boolean }) {
  return <><label>Bounded reason<textarea name="reason" minLength={8} maxLength={500} required autoFocus={autoFocus} /></label><label>Re-enter your password<input name="reauthPassword" type="password" autoComplete="current-password" maxLength={1024} required /></label></>;
}

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function auditValue(key: string, value: unknown, permissionLabels: Map<string, string>): string {
  if (key === "permission" && typeof value === "string") return permissionLabels.get(value) ?? "Governed permission";
  if (Array.isArray(value)) return value.map((item) => auditValue(key, item, permissionLabels)).join(", ");
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([nestedKey]) => !sensitiveAuditKey(nestedKey))
      .map(([nestedKey, nestedValue]) => `${label(nestedKey)}: ${auditValue(nestedKey, nestedValue, permissionLabels)}`)
      .join(", ");
  }
  if (value === null || value === undefined || value === "") return "Not set";
  return typeof value === "string" && /^[A-Z][A-Z0-9_]+$/.test(value) ? label(value) : String(value);
}

function sensitiveAuditKey(key: string) {
  return /(?:^id$|id$|token|hash|password|credential|privateKey|publicKey|handle)/i.test(key);
}

function clearReauthenticationField(form: HTMLFormElement) {
  const field = form.elements.namedItem("reauthPassword");
  if (field instanceof HTMLInputElement) field.value = "";
}
