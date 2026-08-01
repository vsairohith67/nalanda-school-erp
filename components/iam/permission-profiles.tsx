"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PermissionOption = { value: string; label: string; classification: string };
type ProfileEntry = { permission: string; effect: "ALLOW" | "DENY" };
type Profile = { handle: string; name: string; description: string | null; status: string; version: number; updatedAt: string; affectedUsers: number; entries: ProfileEntry[] };

export function PermissionProfiles({ initialProfiles, permissions, canManage }: { initialProfiles: Profile[]; permissions: PermissionOption[]; canManage: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Profile | "NEW" | null>(null);
  const [entries, setEntries] = useState<ProfileEntry[]>([]);
  const [permission, setPermission] = useState("");
  const [effect, setEffect] = useState<"ALLOW" | "DENY">("ALLOW");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const labels = new Map(permissions.map((item) => [item.value, item.label]));

  function openEditor(profile: Profile | "NEW") {
    setEditing(profile);
    setEntries(profile === "NEW" ? [] : profile.entries);
    setMessage("");
  }

  function addEntry() {
    if (!permission || entries.some((entry) => entry.permission === permission)) return;
    setEntries([...entries, { permission, effect }]);
    setPermission("");
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      const isNew = editing === "NEW";
      const response = await fetch(isNew ? "/api/iam/profiles" : `/api/iam/profiles/${encodeURIComponent(editing.handle)}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE", name: form.get("name"), description: form.get("description"), entries,
          reason: form.get("reason"), reauthPassword: form.get("reauthPassword"),
          expectedVersion: isNew ? undefined : editing.version,
          impactAcknowledged: form.get("impactAcknowledged") === "on"
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Unable to save permission profile");
      setMessage("Permission profile saved with append-only version history.");
      setEditing(null);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save permission profile");
    } finally {
      setBusy(false);
    }
  }

  async function profileAction(profile: Profile, action: "CLONE" | "ARCHIVE", event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/iam/profiles/${encodeURIComponent(profile.handle)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, name: form.get("name"), reason: form.get("reason"), reauthPassword: form.get("reauthPassword"), expectedVersion: profile.version, impactAcknowledged: form.get("impactAcknowledged") === "on" })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? `Unable to ${action.toLowerCase()} permission profile`);
      setMessage(action === "CLONE" ? "Permission profile cloned." : "Permission profile archived without deleting history.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Profile action failed");
    } finally {
      setBusy(false);
    }
  }

  return <div className="iam-workspace">
    <section className="card iam-section-heading"><div><h2>Reusable permission profiles</h2><p>Explicit denials in profiles override individual grants and base-role access. Non-delegable security invariants are excluded.</p></div>{canManage ? <button type="button" onClick={() => openEditor("NEW")}>Create profile</button> : null}</section>
    {message ? <div className={message.includes("saved") || message.includes("cloned") || message.includes("archived") ? "notice" : "error"} role="status" aria-live="polite">{message}</div> : null}
    <div className="iam-profile-grid">{initialProfiles.map((profile) => <article className="card iam-profile-card" key={profile.handle}><div className="iam-section-heading"><div><h3>{profile.name}</h3><p>{profile.description ?? "No description"}</p></div><span className="status-pill">{label(profile.status)}</span></div><dl className="detail-grid"><div><dt>Version</dt><dd>{profile.version}</dd></div><div><dt>Affected users</dt><dd>{profile.affectedUsers}</dd></div><div><dt>Allowed</dt><dd>{profile.entries.filter((entry) => entry.effect === "ALLOW").length}</dd></div><div><dt>Explicitly denied</dt><dd>{profile.entries.filter((entry) => entry.effect === "DENY").length}</dd></div></dl><ul className="iam-entry-list">{profile.entries.slice(0, 12).map((entry) => <li key={entry.permission}><span>{labels.get(entry.permission) ?? "Governed permission"}</span><strong>{entry.effect === "DENY" ? "Denied" : "Allowed"}</strong></li>)}</ul>{profile.entries.length > 12 ? <p>{profile.entries.length - 12} more permissions in this version.</p> : null}{canManage && profile.status === "ACTIVE" ? <div className="page-actions"><button type="button" className="secondary" onClick={() => openEditor(profile)}>Edit version</button><details><summary className="button secondary">Clone</summary><form onSubmit={(event) => profileAction(profile, "CLONE", event)} className="iam-compact-form"><label>New name<input name="name" defaultValue={`${profile.name} Copy`} required /></label><CriticalFields /><button disabled={busy}>Clone profile</button></form></details><details><summary className="button danger">Archive</summary><form onSubmit={(event) => profileAction(profile, "ARCHIVE", event)} className="iam-compact-form"><CriticalFields /><label className="iam-check"><input type="checkbox" name="impactAcknowledged" />I reviewed {profile.affectedUsers} affected user{profile.affectedUsers === 1 ? "" : "s"}.</label><button className="danger" disabled={busy}>Archive profile</button></form></details></div> : null}</article>)}</div>
    {!initialProfiles.length ? <section className="card empty-state"><h3>No permission profiles yet</h3><p>Create only the bounded profiles the school has approved. No unrestricted profile is created automatically.</p></section> : null}
    {editing ? <div className="dialog-backdrop" role="presentation"><section className="security-dialog iam-dialog iam-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-editor-title"><h2 id="profile-editor-title">{editing === "NEW" ? "Create permission profile" : `Version ${editing.name}`}</h2><form onSubmit={save}><label>Profile name<input name="name" required maxLength={80} defaultValue={editing === "NEW" ? "" : editing.name} autoFocus /></label><label>Description<textarea name="description" maxLength={300} defaultValue={editing === "NEW" ? "" : editing.description ?? ""} /></label><div className="iam-entry-builder"><label>Permission<select value={permission} onChange={(event) => setPermission(event.target.value)}><option value="">Choose delegable permission</option>{permissions.filter((item) => item.classification !== "SUPER ADMIN ONLY NON DELEGABLE").map((item) => <option key={item.value} value={item.value}>{item.label} · {label(item.classification)}</option>)}</select></label><label>Effect<select value={effect} onChange={(event) => setEffect(event.target.value as "ALLOW" | "DENY")}><option value="ALLOW">Allow</option><option value="DENY">Explicitly deny</option></select></label><button type="button" className="secondary" onClick={addEntry}>Add</button></div><ul className="iam-entry-list">{entries.map((entry) => <li key={entry.permission}><span>{labels.get(entry.permission) ?? "Governed permission"}</span><strong>{entry.effect === "DENY" ? "Denied" : "Allowed"}</strong><button type="button" className="secondary" onClick={() => setEntries(entries.filter((item) => item.permission !== entry.permission))}>Remove</button></li>)}</ul><CriticalFields />{editing !== "NEW" && editing.affectedUsers ? <label className="iam-check"><input name="impactAcknowledged" type="checkbox" required />I reviewed {editing.affectedUsers} affected users before changing this shared profile.</label> : null}<div className="dialog-actions"><button type="button" className="secondary" onClick={() => setEditing(null)} disabled={busy}>Cancel</button><button disabled={busy}>{busy ? "Saving…" : "Save profile version"}</button></div></form></section></div> : null}
  </div>;
}

function CriticalFields() {
  return <><label>Bounded reason<textarea name="reason" minLength={8} maxLength={500} required /></label><label>Re-enter your password<input name="reauthPassword" type="password" autoComplete="current-password" maxLength={1024} required /></label></>;
}
function label(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()); }
