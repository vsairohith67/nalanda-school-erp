"use client";

import { useCallback, useEffect, useState } from "react";

type Device = { id: string; publicDeviceId: string; label: string; platform: string; status: string; keyVersion: number; requestedAt: string; lastSeenAt: string | null; owner?: { name: string; role: string } };
type PendingAction = { device: Device; action: "APPROVE" | "REVOKE" | "RETIRE" };

export function OfflineDeviceGovernance() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/offline-sync/devices?scope=all", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Unable to load devices.");
    setDevices(result.devices);
  }, []);

  useEffect(() => { void load().catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load devices.")); }, [load]);

  function openAction(device: Device, action: PendingAction["action"]) {
    setReason("");
    setPending({ device, action });
  }

  async function confirmAction() {
    if (!pending) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/offline-sync/devices/${pending.device.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: pending.action, reason })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Device action failed.");
      setMessage(`${pending.device.label}: ${pending.action.toLowerCase()} completed.`);
      setPending(null);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Device action failed.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="page"><header className="page-header"><div><p className="eyebrow">Super Admin governance</p><h1>Offline device trust</h1><p>Approvals and revocations are server-side and audited. Private signing keys never leave the registered browser.</p></div></header>
    {message ? <div className="notice" role="status">{message}</div> : null}
    <section className="card"><h2>Registered devices</h2><div className="table-wrap"><table><thead><tr><th>Accountant</th><th>Label</th><th>Platform</th><th>Status</th><th>Key</th><th>Last seen</th><th>Actions</th></tr></thead><tbody>{devices.map((device) => <tr key={device.id}><td>{device.owner ? `${device.owner.name} (${device.owner.role.replaceAll("_", " ")})` : "Unavailable"}</td><td>{device.label}</td><td>{device.platform}</td><td>{device.status.replaceAll("_", " ")}</td><td>v{device.keyVersion}</td><td>{device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : "Never"}</td><td><div className="page-actions">{device.status === "PENDING_APPROVAL" ? <button disabled={busy} onClick={() => openAction(device, "APPROVE")}>Approve</button> : null}{device.status === "ACTIVE" ? <><button className="danger" disabled={busy} onClick={() => openAction(device, "REVOKE")}>Revoke / lost</button><button className="secondary" disabled={busy} onClick={() => openAction(device, "RETIRE")}>Retire</button></> : null}</div></td></tr>)}</tbody></table></div>{!devices.length ? <p>No offline devices are registered.</p> : null}</section>
    {pending ? <div className="confirmation-overlay" role="presentation"><section className="card confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="offline-device-action-title"><h2 id="offline-device-action-title">{pending.action === "APPROVE" ? "Approve offline device" : pending.action === "REVOKE" ? "Revoke offline device" : "Retire offline device"}</h2><p>{pending.action === "APPROVE" ? `Approve ${pending.device.label} for ${pending.device.owner?.name ?? "this Accountant"}'s encrypted offline drafts? Confirm the named Accountant and physical device before proceeding. Signed requests remain subject to session and permission checks.` : `${pending.device.label} will immediately lose reference-pack and synchronization access. Existing official ERP records are unchanged.`}</p>{pending.action !== "APPROVE" ? <label>Governance reason<textarea autoFocus minLength={4} maxLength={500} required value={reason} onChange={(event) => setReason(event.target.value)} /></label> : null}<div className="page-actions"><button type="button" className="secondary" disabled={busy} onClick={() => setPending(null)}>Go back</button><button type="button" className={pending.action === "REVOKE" ? "danger" : undefined} disabled={busy || (pending.action !== "APPROVE" && reason.trim().length < 4)} onClick={() => void confirmAction()}>{busy ? "Working…" : `Confirm ${pending.action.toLowerCase()}`}</button></div></section></div> : null}
  </main>;
}
