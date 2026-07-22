"use client";

import { useState } from "react";
import {
  GO_LIVE_CHECKLIST_ITEMS,
  type GoLiveChecklistState
} from "@/lib/go-live-checklist";

export function GoLiveChecklist({ initial }: { initial: GoLiveChecklistState }) {
  const [state, setState] = useState(initial);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const completed = Object.values(state).filter(Boolean).length;

  async function save(next: GoLiveChecklistState) {
    setState(next);
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/import-verification/checklist", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next)
      });
      const json = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(json?.error || "Unable to save checklist");
      setMessage("Checklist saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save checklist");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card card-pad">
      <div className="section-title inline-section-title">
        <div>
          <h3>Real Data Go-Live Checklist</h3>
          <p>{completed} of {GO_LIVE_CHECKLIST_ITEMS.length} checks completed.</p>
        </div>
        <span className={`badge ${completed === GO_LIVE_CHECKLIST_ITEMS.length ? "success" : "warn"}`}>
          {completed === GO_LIVE_CHECKLIST_ITEMS.length ? "Ready for review" : "In progress"}
        </span>
      </div>
      <div className="checklist-grid">
        {GO_LIVE_CHECKLIST_ITEMS.map(([key, label]) => (
          <label className="checklist-item" key={key}>
            <input
              type="checkbox"
              checked={state[key]}
              disabled={saving}
              onChange={(event) => save({ ...state, [key]: event.target.checked })}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
      {message ? <p className="muted-text" role="status">{message}</p> : null}
    </section>
  );
}
