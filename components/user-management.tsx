"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CanonicalPermission, Role } from "@/lib/permissions";
import { assignableRolesFor, canManageUser, roleDisplayLabel, ROLE_DESCRIPTIONS } from "@/lib/user-management";
import { displayDate } from "@/lib/format";
import { permissionSetCan } from "@/lib/role-permissions";

type UserRow = {
  id: string;
  name: string;
  username: string;
  email: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function UserManagement({
  users,
  actorRole,
  actorPermissions
}: {
  users: UserRow[];
  actorRole: Role;
  actorPermissions: CanonicalPermission[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const permissionSet = new Set(actorPermissions);
  const canManageUsers = permissionSetCan(permissionSet, "MANAGE_USERS");
  const canResetPasswords = permissionSetCan(permissionSet, "RESET_USER_PASSWORDS");
  const assignableRoles = assignableRolesFor(actorRole);

  async function request(url: string, method: string, body: Record<string, unknown>, success: string) {
    setMessage("");
    setError("");
    const response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const json = await response.json();
    if (!response.ok) {
      setError(json.error || "Unable to save user");
      return false;
    }
    setMessage(success);
    router.refresh();
    return true;
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    if (await request("/api/users", "POST", body, "User created")) form.reset();
  }

  async function update(event: React.FormEvent<HTMLFormElement>, user: UserRow) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await request(`/api/users/${user.id}`, "PUT", {
      ...Object.fromEntries(data.entries()),
      isActive: data.get("isActive") === "true"
    }, "User updated");
  }

  async function resetPassword(event: React.FormEvent<HTMLFormElement>, user: UserRow) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    if (await request(`/api/users/${user.id}/reset-password`, "POST", body, `Password reset for ${user.username}`)) {
      form.reset();
    }
  }

  return (
    <div className="grid">
      {canManageUsers ? (
        <form className="card card-pad form-grid" onSubmit={create}>
          <h3 className="full form-heading">Create User</h3>
          <label>Name<input name="name" required /></label>
          <label>Username<input name="username" autoCapitalize="none" required /></label>
          <label>Email<input name="email" type="email" /></label>
          <label>Role<select name="role" defaultValue={assignableRoles[0]}>{assignableRoles.map((role) => <option value={role} key={role}>{roleDisplayLabel(role)}</option>)}</select></label>
          <p className="full muted-text">Teacher opens the safe teacher placeholder. Parent opens the read-only parent portal. Viewer / Auditor is read-only. Super Admin is owner-level and protected.</p>
          <RoleHelp roles={assignableRoles} />
          <label className="wide">Temporary Password<input name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /></label>
          <div className="page-actions"><button>Create User</button></div>
        </form>
      ) : (
        <section className="card card-pad">
          <h3>User Access</h3>
          <p className="muted-text">Your role can view users but cannot create or change accounts.</p>
        </section>
      )}
      {message ? <div className="success-text" role="status">{message}</div> : null}
      {error ? <div className="error" role="alert">{error}</div> : null}
      <section className="card">
        <div className="section-title"><h3>{users.length} User Accounts</h3></div>
        <div className="table-wrap user-table-wrap">
          <table>
            <thead><tr><th>User</th><th>Role / Status</th><th>Last Login</th><th>Created / Updated</th><th>Manage</th></tr></thead>
            <tbody>
              {users.map((user) => {
                const targetRole = user.role as Role;
                const manageable = canManageUsers && canManageUser(actorRole, targetRole);
                const roles = actorRole === "DIRECTOR" ? assignableRoles : [targetRole, ...assignableRoles.filter((role) => role !== targetRole)];
                return (
                  <tr key={user.id}>
                    <td><strong>{user.name}</strong><br /><span>@{user.username}</span><br /><span>{user.email || "No email"}</span></td>
                    <td><span className="badge">{roleDisplayLabel(user.role)}</span> <span className={`badge ${user.isActive ? "success" : "danger"}`}>{user.isActive ? "Active" : "Inactive"}</span></td>
                    <td>{user.lastLoginAt ? displayDate(user.lastLoginAt) : "Never"}</td>
                    <td>{displayDate(user.createdAt)}<br /><span className="muted-text">Updated {displayDate(user.updatedAt)}</span></td>
                    <td>
                      {manageable ? (
                        <details className="manage-user">
                          <summary>Manage</summary>
                          <div className="manage-user-panel">
                            <form className="form-grid compact-form" onSubmit={(event) => update(event, user)}>
                              <label>Name<input name="name" defaultValue={user.name} required /></label>
                              <label>Username<input name="username" defaultValue={user.username} required /></label>
                              <label>Email<input name="email" type="email" defaultValue={user.email ?? ""} /></label>
                              <label>Role<select name="role" defaultValue={user.role}>{Array.from(new Set(roles)).map((role) => <option value={role} key={role}>{roleDisplayLabel(role)}</option>)}</select></label>
                              <label>Status<select name="isActive" defaultValue={String(user.isActive)}><option value="true">Active</option><option value="false">Inactive</option></select></label>
                              <p className="full muted-text">{ROLE_DESCRIPTIONS[targetRole]}</p>
                              <div className="page-actions"><button>Save User</button></div>
                            </form>
                            {canResetPasswords ? (
                              <form className="form-grid compact-form reset-form" onSubmit={(event) => resetPassword(event, user)}>
                                <label>New Temporary Password<input name="password" type="password" minLength={12} maxLength={128} required /></label>
                                <label>Confirm Password<input name="confirmPassword" type="password" minLength={12} maxLength={128} required /></label>
                                <div className="page-actions"><button className="secondary">Reset Password</button></div>
                              </form>
                            ) : null}
                          </div>
                        </details>
                      ) : <span className="muted-text">View only</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function RoleHelp({ roles }: { roles: Role[] }) {
  return (
    <div className="full role-help">
      {roles.map((role) => (
        <p key={role}><strong>{roleDisplayLabel(role)}:</strong> {ROLE_DESCRIPTIONS[role]}</p>
      ))}
    </div>
  );
}
