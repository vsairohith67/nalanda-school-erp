"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type RoleContext = { handle: string; label: string; designation: string | null; active: boolean; validUntil: string | null };
type ChildContext = { handle: string; name: string; admissionNo: string; className: string; section: string | null; status: string; active: boolean };

export function ActiveContextSwitcher({ activeRole }: { activeRole: string }) {
  const router = useRouter();
  const [roles, setRoles] = useState<RoleContext[]>([]);
  const [roleVersion, setRoleVersion] = useState(1);
  const [roleHandle, setRoleHandle] = useState("");
  const [children, setChildren] = useState<ChildContext[]>([]);
  const [childVersion, setChildVersion] = useState(1);
  const [childHandle, setChildHandle] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const roleSelectRef = useRef<HTMLSelectElement>(null);
  const childSelectRef = useRef<HTMLSelectElement>(null);
  const roleSelectId = useId();
  const childSelectId = useId();

  useEffect(() => {
    void loadRoles();
    if (activeRole === "PARENT") void loadChildren();
  }, [activeRole]);

  async function loadRoles() {
    const response = await fetch("/api/auth/context", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return;
    const rows = data.contexts as RoleContext[];
    setRoles(rows);
    setRoleVersion(data.contextVersion);
    setRoleHandle(rows.find((row) => row.active)?.handle ?? "");
  }

  async function loadChildren() {
    const response = await fetch("/api/auth/child-context", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return;
    const rows = data.children as ChildContext[];
    setChildren(rows);
    setChildVersion(data.contextVersion);
    setChildHandle(rows.find((row) => row.active)?.handle ?? "");
  }

  async function switchContext(endpoint: string, handle: string, expectedVersion: number, success: string) {
    if (!handle) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle, expectedVersion })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Context switch failed");
      setStatus(success);
      router.refresh();
      await loadRoles();
      if (endpoint === "/api/auth/child-context" || data.role === "Parent") {
        await loadChildren();
      } else {
        setChildren([]);
        setChildHandle("");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Context switch failed");
    } finally {
      setBusy(false);
    }
  }

  if (roles.length <= 1 && children.length <= 1) return null;
  return (
    <section className="iam-context-switcher" aria-label="Active access context">
      {roles.length > 1 ? (
        <div className="iam-context-field">
          <label htmlFor={roleSelectId}>Active role context</label>
          <span className="iam-context-control">
            <select id={roleSelectId} ref={roleSelectRef} value={roleHandle} onChange={(event) => setRoleHandle(event.target.value)} disabled={busy}>
              {roles.map((context) => <option key={context.handle} value={context.handle}>{context.label}{context.designation ? ` · ${context.designation}` : ""}</option>)}
            </select>
            <button type="button" className="secondary" disabled={busy || !roleHandle} onClick={() => switchContext("/api/auth/context", roleSelectRef.current?.value ?? roleHandle, roleVersion, "Role context changed.")}>Switch</button>
          </span>
        </div>
      ) : null}
      {activeRole === "PARENT" && children.length > 1 ? (
        <div className="iam-context-field">
          <label htmlFor={childSelectId}>Linked child context</label>
          <span className="iam-context-control">
            <select id={childSelectId} ref={childSelectRef} value={childHandle} onChange={(event) => setChildHandle(event.target.value)} disabled={busy}>
              <option value="">Choose linked child</option>
              {children.map((child) => <option key={child.handle} value={child.handle}>{child.name} · {child.admissionNo} · {child.className}{child.section ? `-${child.section}` : ""}</option>)}
            </select>
            <button type="button" className="secondary" disabled={busy || !childHandle} onClick={() => switchContext("/api/auth/child-context", childSelectRef.current?.value ?? childHandle, childVersion, "Linked child context changed.")}>Choose</button>
          </span>
        </div>
      ) : null}
      {status ? <span className="iam-context-status" role="status" aria-live="polite">{status}</span> : null}
    </section>
  );
}
