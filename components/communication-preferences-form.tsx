"use client";

import { useState } from "react";

const CHANNELS = ["IN_APP", "EMAIL", "SMS", "WHATSAPP", "NATIVE_PUSH"];
const LOCALES = [{ value: "en-IN", label: "English" }, { value: "te-IN", label: "Telugu — draft pending language review" }, { value: "hi-IN", label: "Hindi — draft pending language review" }];

export function CommunicationPreferencesForm() {
  const [channel, setChannel] = useState("IN_APP"), [locale, setLocale] = useState("en-IN"), [start, setStart] = useState(""), [end, setEnd] = useState(""), [optionalEnabled, setOptionalEnabled] = useState(false), [status, setStatus] = useState(""), [busy, setBusy] = useState(false);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/communication/preferences", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: "INFORMATIONAL_OPTIONAL", channel, locale, quietHoursStart: start || null, quietHoursEnd: end || null, optionalEnabled, preferred: optionalEnabled, digestFrequency: "IMMEDIATE" }) });
      const value = await response.json(); if (!response.ok) throw new Error(value.error ?? "Unable to save preferences."); setStatus("Communication preference saved for your account.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to save preferences."); }
    finally { setBusy(false); }
  }
  return <form className="card card-pad stack" onSubmit={save}>
    <h2>Optional communication preference</h2><p>Security-critical and safety-critical notices follow separately approved policy. This optional control cannot be used for marketing or to bypass mandatory safety governance.</p>
    <label>Channel<select aria-label="Optional communication channel" value={channel} onChange={(event) => setChannel(event.target.value)}>{CHANNELS.map((value) => <option key={value}>{value}</option>)}</select></label>
    <label>Language<select aria-label="Preferred communication language" value={locale} onChange={(event) => setLocale(event.target.value)}>{LOCALES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    <div className="form-grid"><label>Quiet hours start<input type="time" value={start} onChange={(event) => setStart(event.target.value)} /></label><label>Quiet hours end<input type="time" value={end} onChange={(event) => setEnd(event.target.value)} /></label></div>
    <label className="checkbox-row"><input type="checkbox" checked={optionalEnabled} onChange={(event) => setOptionalEnabled(event.target.checked)} /> Allow optional informational communication on this channel</label>
    <button type="submit" disabled={busy}>{busy ? "Saving…" : "Save my preference"}</button><p aria-live="polite" role="status">{status}</p>
  </form>;
}
