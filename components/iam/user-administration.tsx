"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type NamedUser = {
  handle: string;
  name: string;
  username: string;
  designation: string | null;
  status: string;
  active: boolean;
  version: number;
  lastLoginAt: string | null;
  roles: Array<{ label: string; validUntil: string | null }>;
  profiles: string[];
  activeSessions: number;
  activeOverrides: number;
};
type Option = { handle: string; label: string; status?: string };
type RoleOption = { value: string; label: string };

export function UserAdministration({
  initialUsers,
  roles,
  profiles,
  staff,
  guardians,
  canManage
}: {
  initialUsers: NamedUser[];
  roles: RoleOption[];
  profiles: Option[];
  staff: Option[];
  guardians: Option[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [activationMethod, setActivationMethod] = useState("PENDING");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const filtered = useMemo(() => initialUsers.filter((user) => {
    const text = `${user.name} ${user.username} ${user.designation ?? ""} ${user.roles.map((role) => role.label).join(" ")}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (!statusFilter || user.status === statusFilter);
  }), [initialUsers, query, statusFilter]);

  function toggle(list: string[], value: string, setter: (next: string[]) => void) {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  async function createUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/iam/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"), username: form.get("username"), email: form.get("email"), designation: form.get("designation"),
          roles: selectedRoles, profileHandles: selectedProfiles, staffHandle: form.get("staffHandle"), guardianHandle: form.get("guardianHandle"),
          activationMethod, temporaryPassword: form.get("temporaryPassword"), temporaryPasswordDays: 1,
          reason: form.get("reason"), reauthPassword: form.get("reauthPassword")
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Unable to create named user");
      setMessage("Named user created. No password was displayed or logged.");
      setShowCreate(false);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create named user");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="iam-workspace">
      <section className="card iam-toolbar" aria-label="Named user filters">
        <label>Search named users<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, username, designation or role" /></label>
        <label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="PENDING_ACTIVATION">Pending activation</option><option value="SUSPENDED">Suspended</option></select></label>
        {canManage ? <button type="button" onClick={() => setShowCreate(true)}>Create pending user</button> : null}
      </section>
      {message ? <div className={message.startsWith("Named") ? "notice" : "error"} role="status" aria-live="polite">{message}</div> : null}
      <section className="card">
        <div className="table-wrap iam-user-table"><table><thead><tr><th>Named user</th><th>Status</th><th>Designation and contexts</th><th>Profiles / overrides</th><th>Security</th><th>Action</th></tr></thead><tbody>
          {filtered.map((user) => <tr key={user.handle}>
            <td><strong>{user.name}</strong><small>@{user.username}</small></td>
            <td><span className={`status-pill ${user.active ? "status-active" : "status-inactive"}`}>{statusLabel(user.status)}</span></td>
            <td>{user.designation ? <strong>{user.designation}</strong> : <span>No designation</span>}<small>{user.roles.map((role) => role.label).join(" + ")}</small></td>
            <td>{user.profiles.length ? user.profiles.join(", ") : "No profile"}<small>{user.activeOverrides} individual override{user.activeOverrides === 1 ? "" : "s"}</small></td>
            <td>{user.activeSessions} active session{user.activeSessions === 1 ? "" : "s"}<small>{user.lastLoginAt ? `Last login ${new Date(user.lastLoginAt).toLocaleString("en-IN")}` : "No login recorded"}</small></td>
            <td><Link className="button secondary" href={`/users/${encodeURIComponent(user.handle)}`}>Review access</Link></td>
          </tr>)}
          {!filtered.length ? <tr><td colSpan={6}>No named users match these filters.</td></tr> : null}
        </tbody></table></div>
      </section>
      {showCreate ? (
        <div className="dialog-backdrop" role="presentation">
          <section className="security-dialog iam-dialog" role="dialog" aria-modal="true" aria-labelledby="create-user-title">
            <h2 id="create-user-title">Create a governed named user</h2>
            <p>The account remains pending unless a temporary password is entered. Temporary passwords are hidden, hashed, expire, and require change at first login.</p>
            <form onSubmit={createUser} className="iam-form-grid">
              <label>Display name<input name="name" required maxLength={100} autoFocus /></label>
              <label>Username<input name="username" required maxLength={64} autoComplete="off" /></label>
              <label>Human designation<input name="designation" maxLength={100} placeholder="Associate Director, Computer Operator…" /></label>
              <label>Email (profile only)<input name="email" type="email" maxLength={254} /></label>
              <fieldset className="iam-fieldset"><legend>Base role contexts</legend>{roles.map((role) => <label className="iam-check" key={role.value}><input type="checkbox" checked={selectedRoles.includes(role.value)} onChange={() => toggle(selectedRoles, role.value, setSelectedRoles)} />{role.label}</label>)}</fieldset>
              <fieldset className="iam-fieldset"><legend>Permission profiles (optional)</legend>{profiles.length ? profiles.map((profile) => <label className="iam-check" key={profile.handle}><input type="checkbox" checked={selectedProfiles.includes(profile.handle)} onChange={() => toggle(selectedProfiles, profile.handle, setSelectedProfiles)} />{profile.label}</label>) : <span>No active profiles</span>}</fieldset>
              <label>Existing Staff link<select name="staffHandle" defaultValue=""><option value="">Not linked</option>{staff.map((row) => <option key={row.handle} value={row.handle}>{row.label} · {statusLabel(row.status ?? "")}</option>)}</select></label>
              <label>Existing Guardian link<select name="guardianHandle" defaultValue=""><option value="">Not linked</option>{guardians.map((row) => <option key={row.handle} value={row.handle}>{row.label} · {statusLabel(row.status ?? "")}</option>)}</select></label>
              <label>Activation<select value={activationMethod} onChange={(event) => setActivationMethod(event.target.value)}><option value="PENDING">Keep pending activation</option><option value="TEMPORARY_PASSWORD">Activate with temporary password</option></select></label>
              {activationMethod === "TEMPORARY_PASSWORD" ? <label>Temporary password<input name="temporaryPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label> : null}
              <label className="full">Bounded reason<textarea name="reason" required minLength={8} maxLength={500} /></label>
              <label className="full">Re-enter your password<input name="reauthPassword" type="password" autoComplete="current-password" required maxLength={1024} /></label>
              <div className="dialog-actions full"><button type="button" className="secondary" onClick={() => setShowCreate(false)} disabled={busy}>Cancel</button><button type="submit" disabled={busy || selectedRoles.length === 0}>{busy ? "Creating…" : "Create named user"}</button></div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}
