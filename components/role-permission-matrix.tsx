"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PERMISSION_GROUPS,
  ROLES,
  type CanonicalPermission,
  type Role
} from "@/lib/permissions";
import type { RolePermissionMatrix } from "@/lib/role-permissions";
import { roleDisplayLabel } from "@/lib/user-management";

export function RolePermissionMatrixEditor({ initialMatrix }: { initialMatrix: RolePermissionMatrix }) {
  const router = useRouter();
  const [matrix, setMatrix] = useState(initialMatrix);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function toggle(role: Role, permission: CanonicalPermission, enabled: boolean) {
    if (role === "SUPER_ADMIN") return;
    setMatrix((current) => ({
      ...current,
      [role]: { ...current[role], [permission]: enabled }
    }));
  }

  async function submit(url: string, body?: unknown) {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {})
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Unable to save permissions");
      setMatrix(json.matrix);
      router.refresh();
      setMessage(json.message || "Permissions saved");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save permissions");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid">
      <section className="card card-pad">
        <div className="section-title">
          <div>
            <h3>Role Permission Matrix</h3>
            <p>Changing permissions affects what users can see and do.</p>
          </div>
          <div className="page-actions">
            <button className="secondary" type="button" onClick={() => submit("/api/roles/permissions/reset")} disabled={saving}>
              Reset to Recommended Defaults
            </button>
            <button type="button" onClick={() => submit("/api/roles/permissions", { matrix })} disabled={saving}>
              {saving ? "Saving..." : "Save Permissions"}
            </button>
          </div>
        </div>
        <p className="notice">SUPER_ADMIN is locked on. Teacher opens only the safe placeholder by default. Parent opens only the read-only parent portal.</p>
        {message ? <p className="success-text" role="status">{message}</p> : null}
        {error ? <p className="error" role="alert">{error}</p> : null}
      </section>

      <section className="card role-matrix-card">
        <div className="table-wrap role-matrix-wrap">
          <table className="role-matrix">
            <thead>
              <tr>
                <th>Permission</th>
                {ROLES.map((role) => (
                  <th key={role}>
                    {roleDisplayLabel(role)}
                    {role === "TEACHER" ? <span>Portal placeholder</span> : null}
                    {role === "PARENT" ? <span>Read-only portal</span> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_GROUPS.map((group) => (
                <GroupRows
                  group={group}
                  matrix={matrix}
                  onToggle={toggle}
                  key={group.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function GroupRows({
  group,
  matrix,
  onToggle
}: {
  group: (typeof PERMISSION_GROUPS)[number];
  matrix: RolePermissionMatrix;
  onToggle: (role: Role, permission: CanonicalPermission, enabled: boolean) => void;
}) {
  return (
    <>
      <tr className="role-matrix-group">
        <td colSpan={ROLES.length + 1}>{group.title}</td>
      </tr>
      {group.permissions.map((item) => (
        <tr key={item.permission}>
          <td>
            <strong>{item.label}</strong>
            <span>{item.description}</span>
          </td>
          {ROLES.map((role) => (
            <td key={`${role}-${item.permission}`}>
              <label className="permission-toggle">
                <input
                  aria-label={`${roleDisplayLabel(role)} ${item.label}`}
                  type="checkbox"
                  checked={role === "SUPER_ADMIN" ? true : matrix[role][item.permission]}
                  disabled={role === "SUPER_ADMIN"}
                  onChange={(event) => onToggle(role, item.permission, event.target.checked)}
                />
              </label>
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
