"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function NotificationTemplateManager({ templates }: { templates: any[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const formElement = event.currentTarget;
    try {
      const form = new FormData(formElement);
      const response = await fetch("/api/notifications/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Unable to create template");
      formElement.reset(); router.refresh();
    } catch (value) { setError(value instanceof Error ? value.message : "Unable to create template"); } finally { setBusy(false); }
  }
  async function workflow() {
    const item = pending; if (!item) return; setBusy(true); setError("");
    try {
      const action = item.status === "ACTIVE" ? "inactivate" : "activate";
      const response = await fetch(`/api/notifications/templates/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Unable to update template");
      setPending(null); router.refresh();
    } catch (value) { setPending(null); setError(value instanceof Error ? value.message : "Unable to update template"); } finally { setBusy(false); }
  }
  return <div className="notification-template-stack"><form className="card card-pad form-grid notification-form" onSubmit={create}><label>Template code<input name="templateCode" required placeholder="GENERAL-UPDATE" /></label><label>Name<input name="name" required maxLength={120} /></label><label>Category<select name="category">{["GENERAL","ACADEMIC","ATTENDANCE","HOMEWORK","EXAM","REPORT_CARD","FEE_INFORMATION","LIBRARY","CERTIFICATE","CLASS_X_DOCUMENTS","ID_CARD","SAFETY","EMERGENCY","SYSTEM"].map((value) => <option key={value}>{value}</option>)}</select></label><label>Default priority<select name="defaultPriority"><option>NORMAL</option><option>IMPORTANT</option><option>URGENT</option></select></label><label className="wide">Title template<input name="titleTemplate" required maxLength={120} /></label><label className="wide">Body template<textarea name="bodyTemplate" required maxLength={2000} rows={6} /></label><label>Action label<input name="actionLabel" maxLength={80} /></label><label>Allowlisted internal path<input name="actionPath" placeholder="/parent/homework" /></label><label className="check-row"><input name="acknowledgmentRequired" type="checkbox" value="true" /> Acknowledgment required</label><button disabled={busy}>Create Draft Template</button></form>{error ? <div className="notice danger" role="alert">{error}</div> : null}<section className="card"><div className="table-wrap"><table><thead><tr><th>Code</th><th>Name</th><th>Category</th><th>Priority</th><th>Status</th><th>Version</th><th>Action</th></tr></thead><tbody>{templates.map((item) => <tr key={item.id}><td>{item.templateCode}</td><td>{item.name}</td><td>{item.category}</td><td>{item.defaultPriority}</td><td>{item.status}</td><td>{item.versionNumber}</td><td><button type="button" className="secondary" onClick={() => setPending(item)}>{item.status === "ACTIVE" ? "Inactivate" : "Activate"}</button></td></tr>)}{!templates.length ? <tr><td colSpan={7}>No templates yet.</td></tr> : null}</tbody></table></div></section>{pending ? <div className="confirmation-overlay"><section className="card confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="notification-template-dialog-title"><h3 id="notification-template-dialog-title">{pending.status === "ACTIVE" ? "Inactivate Notification Template" : "Activate Notification Template"}</h3><p>Existing campaign snapshots are unchanged. Inactive templates cannot start new campaigns.</p><div className="page-actions"><button type="button" className="secondary" onClick={() => setPending(null)}>Go Back</button><button type="button" disabled={busy} onClick={workflow}>{pending.status === "ACTIVE" ? "Inactivate Notification Template" : "Activate Notification Template"}</button></div></section></div> : null}</div>;
}
