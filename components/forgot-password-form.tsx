"use client";

import { useRef, useState } from "react";
import Link from "next/link";

export function ForgotPasswordForm({ mobileAvailable }: { mobileAvailable: boolean }) {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setMessage("");
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch("/api/auth/recovery/request", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
      });
      const json = await response.json().catch(() => ({}));
      setMessage(String(json.message ?? "If an eligible account uses that recovery channel, reset instructions will be sent."));
    } catch {
      setMessage("If an eligible account uses that recovery channel, reset instructions will be sent.");
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }
  return <form className="login-form recovery-form" onSubmit={submit} aria-busy={submitting}>
    <label>Login identifier<input name="identifier" autoComplete="username" autoCapitalize="none" spellCheck={false} required /></label>
    <fieldset>
      <legend>Recovery channel</legend>
      <label className="radio-option"><input type="radio" name="channelType" value="WORK_EMAIL" defaultChecked /> Work email</label>
      <label className="radio-option"><input type="radio" name="channelType" value="PERSONAL_EMAIL" /> Personal email</label>
      {mobileAvailable ? <label className="radio-option"><input type="radio" name="channelType" value="MOBILE" /> Mobile</label> : null}
    </fieldset>
    <p className="muted-text">Stored addresses and numbers are never displayed here.</p>
    {message ? <div className="login-success" role="status">{message}</div> : null}
    <button className="login-submit" disabled={submitting}>{submitting ? "Requesting…" : "Request reset"}</button>
    <Link className="recovery-back-link" href="/login">Back to sign in</Link>
  </form>;
}
