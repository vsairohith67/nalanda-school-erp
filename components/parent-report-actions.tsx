"use client";

import { useState } from "react";
import type { ReportColourMode } from "@/lib/report-publication-types";

export function ParentReportActions({
  publicationReference,
  viewable
}: {
  publicationReference: string;
  viewable: boolean;
}) {
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function access(action: "VIEW" | "DOWNLOAD", mode: ReportColourMode) {
    setBusy(`${action}-${mode}`);
    setMessage("");
    try {
      const response = await fetch("/api/parent/report-cards/access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ publicationReference, action, mode })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Report access is unavailable.");
      window.location.assign(data.access.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Report access is unavailable.");
    } finally {
      setBusy("");
    }
  }

  if (!viewable) return <span className="muted">Content unavailable for this status</span>;
  return (
    <div>
      <div className="page-actions parent-report-actions">
        <button type="button" disabled={busy !== ""} onClick={() => access("VIEW", "COLOUR")}>View</button>
        <button type="button" className="secondary" disabled={busy !== ""} onClick={() => access("DOWNLOAD", "COLOUR")}>Colour PDF</button>
        <button type="button" className="secondary" disabled={busy !== ""} onClick={() => access("DOWNLOAD", "MONOCHROME")}>B&amp;W PDF</button>
      </div>
      {message ? <p className="error-text" role="status">{message}</p> : null}
    </div>
  );
}
