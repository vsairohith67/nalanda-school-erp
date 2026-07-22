"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const labels: Record<string, string> = {
  approve: "Approve Notification", publish: "Publish Notification", schedule: "Schedule Notification",
  withdraw: "Withdraw Notification", cancel: "Cancel Notification", archive: "Archive Notification",
  correction: "Publish Corrected Notification"
};
export function NotificationWorkflowActions({ campaignId, status, permissions }: { campaignId: string; status: string; permissions: Record<string, boolean> }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const actions = [
    { action: "approve", show: status === "READY_FOR_REVIEW" && permissions.approve },
    { action: "publish", show: status === "APPROVED" && permissions.publish },
    { action: "schedule", show: status === "APPROVED" && permissions.schedule },
    { action: "withdraw", show: ["PUBLISHED","SCHEDULED"].includes(status) && permissions.withdraw },
    { action: "cancel", show: ["DRAFT","READY_FOR_REVIEW","APPROVED","SCHEDULED"].includes(status) && permissions.cancel },
    { action: "archive", show: ["PUBLISHED","WITHDRAWN"].includes(status) && permissions.archive },
    { action: "correction", show: ["PUBLISHED","WITHDRAWN","ARCHIVED"].includes(status) && permissions.correction }
  ].filter((row) => row.show);
  async function act() {
    if (!dialog) return; setBusy(true); setError("");
    try {
      const correction = dialog === "correction";
      const response = await fetch(correction ? `/api/notifications/campaigns/${campaignId}/correction` : `/api/notifications/campaigns/${campaignId}/workflow`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(correction ? {} : { action: dialog, reason, scheduledFor: scheduledFor || null })
      });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Unable to complete notification action");
      setDialog(null); setReason(""); setScheduledFor("");
      if (correction && data.campaign?.id) router.push(`/notifications/manage/${data.campaign.id}`); else router.refresh();
    } catch (value) { setDialog(null); setError(value instanceof Error ? value.message : "Unable to complete notification action"); } finally { setBusy(false); }
  }
  return <section className="card card-pad"><h3>Campaign Workflow</h3><p>Every transition is permission checked, compare-and-set, and appended to history.</p><div className="page-actions">{actions.map((row) => <button type="button" className={["withdraw","cancel"].includes(row.action) ? "danger" : ""} key={row.action} onClick={() => setDialog(row.action)}>{labels[row.action]}</button>)}</div>{error ? <div className="notice danger" role="alert">{error}</div> : null}{dialog ? <div className="confirmation-overlay" role="presentation"><section className="card confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="notification-workflow-title"><h3 id="notification-workflow-title">{labels[dialog]}</h3><p>{dialog === "correction" ? "Create a visibly labelled correction draft linked to the preserved original. It still requires review and approval before publication." : "Confirm this preserved in-app notification workflow transition."}</p>{dialog === "schedule" ? <label>Future India-local time<input autoFocus type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} /></label> : null}{["withdraw","cancel"].includes(dialog) ? <label>Reason<textarea autoFocus value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} /></label> : null}<div className="page-actions"><button type="button" className="secondary" disabled={busy} onClick={() => setDialog(null)}>Go Back</button><button type="button" disabled={busy || (dialog === "schedule" && !scheduledFor) || (["withdraw","cancel"].includes(dialog) && !reason.trim())} onClick={act}>{labels[dialog]}</button></div></section></div> : null}</section>;
}
