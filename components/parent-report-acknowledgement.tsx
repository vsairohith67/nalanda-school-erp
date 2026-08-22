"use client";

import { useState } from "react";

export function ParentReportAcknowledgement({ reportCardNumber, versionNumber, acknowledged }: { reportCardNumber: string; versionNumber: number; acknowledged: boolean }) {
  const [done, setDone] = useState(acknowledged);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(acknowledged ? "Acknowledged" : "");
  async function acknowledge() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/parent/report-cards/acknowledge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reportCardNumber, versionNumber }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to acknowledge this report.");
      setDone(true); setMessage("Acknowledged. The issued report remains unchanged.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to acknowledge this report."); }
    finally { setBusy(false); }
  }
  return <div className="parent-report-acknowledgement">{done ? <span className="badge">Parent acknowledged</span> : <button type="button" className="secondary" disabled={busy} onClick={acknowledge}>{busy ? "Recording…" : "Acknowledge issued report"}</button>}{message ? <small role="status">{message}</small> : null}</div>;
}
