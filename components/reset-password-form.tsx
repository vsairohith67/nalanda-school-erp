"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function ResetPasswordForm() {
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
    setToken(value);
    window.history.replaceState(null, "", "/reset-password");
    setReady(true);
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !token) return;
    inFlight.current = true;
    setSaving(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch("/api/auth/recovery/reset", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, ...values })
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(json.error ?? "The reset link is invalid or expired"));
      setComplete(true);
      setToken("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The reset link is invalid or expired");
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }
  if (!ready) return <div className="login-form" role="status">Preparing secure reset…</div>;
  if (complete) return <div className="login-form"><div className="login-success" role="status">Password updated. Every existing session has been signed out.</div><Link className="button login-submit" href="/login">Sign in</Link></div>;
  if (!token) return <div className="login-form"><div className="error" role="alert">The reset link is invalid or expired.</div><Link className="recovery-back-link" href="/forgot-password">Request a new reset</Link></div>;
  return <form className="login-form recovery-form" onSubmit={submit} aria-busy={saving}>
    <div className="password-policy"><strong>Choose a strong new password</strong><ul><li>Use 12 to 128 characters.</li><li>Avoid common or repeated-character passwords.</li><li>Do not reuse the current password.</li></ul></div>
    <label>New password<input name="newPassword" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /></label>
    <label>Confirm new password<input name="confirmPassword" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /></label>
    {error ? <div className="error" role="alert">{error}</div> : null}
    <button className="login-submit" disabled={saving}>{saving ? "Updating…" : "Set new password"}</button>
  </form>;
}
