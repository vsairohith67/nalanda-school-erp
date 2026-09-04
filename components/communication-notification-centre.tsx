"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Item = { id: string; title: string; body: string; actionPath: string | null; purpose: string; module: string; locale: string; readAt: string | Date | null; archivedAt: string | Date | null; createdAt: string | Date; expired: boolean };

export function CommunicationNotificationCentre({ items, archived = false }: { items: Item[]; archived?: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function update(action: "READ" | "ARCHIVE" | "MARK_ALL_READ", itemId?: string) {
    setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/communication/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, itemId }) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to update notification.");
      setStatus(action === "ARCHIVE" ? "Notification archived." : action === "MARK_ALL_READ" ? "Eligible notifications marked read." : "Notification marked read.");
      router.refresh();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to update notification."); }
    finally { setBusy(false); }
  }
  return <section aria-labelledby="communication-notification-list">
    <div className="section-title"><div><h2 id="communication-notification-list">{archived ? "Archived notifications" : "Current notifications"}</h2><p>Only notifications owned by the signed-in account are shown. Opening a link does not grant access to its target record.</p></div>{!archived ? <button type="button" className="secondary" aria-label="Mark all eligible notifications as read" disabled={busy} onClick={() => update("MARK_ALL_READ")}>Mark all read</button> : null}</div>
    <p className="sr-only" aria-live="polite">{status}</p>
    <div className="notification-inbox-stack">
      {items.map((item) => <article className={`card card-pad communication-card ${item.readAt ? "" : "is-unread"}`} key={item.id}>
        <div className="notification-heading"><div><span className="badge">{item.purpose.replaceAll("_", " ")}</span> <span className="badge">{item.module.replaceAll("_", " ")}</span> {!item.readAt ? <span className="badge warn">UNREAD</span> : <span className="badge">READ</span>}</div><small>{new Date(item.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</small></div>
        <h3>{item.title}</h3><p>{item.body}</p>
        {item.expired ? <p className="notice warn" role="status">This notification has expired. Its history is retained, but its action may no longer be available.</p> : null}
        <div className="page-actions">
          {!item.readAt ? <button type="button" className="secondary" aria-label={`Mark ${item.title} as read`} disabled={busy} onClick={() => update("READ", item.id)}>Mark read</button> : null}
          {!archived ? <button type="button" className="ghost" aria-label={`Archive ${item.title}`} disabled={busy} onClick={() => update("ARCHIVE", item.id)}>Archive</button> : null}
          {item.actionPath && !item.expired ? <Link className="button secondary" href={item.actionPath}>Open secure record</Link> : null}
        </div>
      </article>)}
      {!items.length ? <div className="card card-pad"><h3>No {archived ? "archived" : "current"} notifications</h3><p>The unified notification centre has no items in this view.</p></div> : null}
    </div>
  </section>;
}
