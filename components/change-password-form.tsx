"use client";

import { useState } from "react";

export function ChangePasswordForm() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Unable to change password");
      form.reset();
      setMessage(json.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to change password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card card-pad form-grid password-form" onSubmit={submit}>
      <label>Current Password<input name="currentPassword" type="password" autoComplete="current-password" required /></label>
      <label>New Password<input name="newPassword" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /></label>
      <label>Confirm New Password<input name="confirmPassword" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /></label>
      <div className="full page-actions">
        <button disabled={saving}>{saving ? "Saving..." : "Change Password"}</button>
      </div>
      {message ? <div className="full success-text" role="status">{message}</div> : null}
      {error ? <div className="full error" role="alert">{error}</div> : null}
    </form>
  );
}
