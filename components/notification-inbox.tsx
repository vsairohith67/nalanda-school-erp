"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type NotificationInboxItem = {
  campaignNumber: string;
  category: string;
  priority: string;
  title: string;
  body: string;
  actionLabel: string | null;
  actionPath: string | null;
  acknowledgmentRequired: boolean;
  correctionOfCampaignNumber: string | null;
  status: string;
  contextType: string;
  context: { targetedChildren?: Array<{ admissionNo: string; displayName: string; classSection: string }>; [key: string]: unknown };
  availableAt: string | Date;
  firstViewedAt: string | Date | null;
  readAt: string | Date | null;
  acknowledgedAt: string | Date | null;
  dismissedAt: string | Date | null;
};

export function NotificationInbox({ items, history = false }: { items: NotificationInboxItem[]; history?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<{ item: NotificationInboxItem; action: "acknowledge" | "dismiss" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function act(item: NotificationInboxItem, action: "read" | "acknowledge" | "dismiss") {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/notifications/own/${encodeURIComponent(item.campaignNumber)}/action`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to update notification");
      setPending(null);
      window.dispatchEvent(new Event("notification-count-refresh"));
      router.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Unable to update notification");
      setPending(null);
    } finally { setBusy(false); }
  }

  return <div className="notification-inbox-stack">
    {error ? <div className="notice danger" role="alert">{error}</div> : null}
    {items.map((item) => <article className={`card card-pad notification-card priority-${item.priority.toLowerCase()} ${!item.readAt ? "is-unread" : ""}`} key={item.campaignNumber}>
      <div className="notification-heading">
        <div><span className="badge">{item.category.replaceAll("_", " ")}</span> <span className={`badge ${item.priority === "URGENT" ? "danger" : item.priority === "IMPORTANT" ? "warn" : ""}`}>{item.priority}</span>{item.correctionOfCampaignNumber ? <span className="badge warn">CORRECTION</span> : null}</div>
        <small>{new Date(item.availableAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</small>
      </div>
      <h3>{item.title}</h3>
      <p className="notification-body">{item.body}</p>
      {item.context.targetedChildren?.length ? <div className="notification-context"><strong>Child context</strong>{item.context.targetedChildren.map((child) => <span key={child.admissionNo}>{child.displayName} · {child.classSection}</span>)}</div> : null}
      {item.status !== "AVAILABLE" ? <div className="notice"><strong>{item.status}</strong> — preserved notification history.</div> : null}
      {history ? <div className="notification-history-states">
        {item.readAt ? <span className="badge">READ</span> : <span className="badge">UNREAD</span>}
        {item.acknowledgedAt ? <span className="badge">ACKNOWLEDGED</span> : null}
        {item.dismissedAt ? <span className="badge">DISMISSED</span> : null}
      </div> : null}
      {item.acknowledgmentRequired ? <p className="operational-note"><strong>Acknowledgment required.</strong> This is an operational confirmation only, not a legal or digital signature.</p> : null}
      <div className="page-actions">
        {!item.readAt && item.status === "AVAILABLE" ? <button type="button" className="secondary" disabled={busy} onClick={() => act(item, "read")}>Mark Read</button> : null}
        {item.acknowledgmentRequired && !item.acknowledgedAt && item.status === "AVAILABLE" ? <button type="button" disabled={busy} onClick={() => setPending({ item, action: "acknowledge" })}>Acknowledge Notification</button> : null}
        {!history && !item.dismissedAt && item.status === "AVAILABLE" ? <button type="button" className="ghost" disabled={busy} onClick={() => setPending({ item, action: "dismiss" })}>Dismiss Notification</button> : null}
        {item.actionPath && item.actionLabel ? <Link className="button secondary" href={item.actionPath}>{item.actionLabel}</Link> : null}
      </div>
    </article>)}
    {!items.length ? <section className="card card-pad"><h3>{history ? "No notification history" : "No active notifications"}</h3><p>Only in-app messages addressed to this authenticated account appear here.</p></section> : null}
    {pending ? <div className="confirmation-overlay" role="presentation"><section className="card confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="notification-recipient-dialog-title"><h3 id="notification-recipient-dialog-title">{pending.action === "acknowledge" ? "Acknowledge Notification" : "Dismiss Notification"}</h3><p>{pending.action === "acknowledge" ? "Confirm that you have seen this operational notification. This is not a legal or digital signature." : "Dismiss this notification from the active inbox. It remains in history."}</p><div className="page-actions"><button type="button" className="secondary" disabled={busy} onClick={() => setPending(null)}>Go Back</button><button type="button" disabled={busy} onClick={() => act(pending.item, pending.action)}>{pending.action === "acknowledge" ? "Acknowledge Notification" : "Dismiss Notification"}</button></div></section></div> : null}
  </div>;
}
