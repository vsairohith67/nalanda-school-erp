"use client";

import { useState } from "react";

export function ChangePasswordForm() {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
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
      window.location.replace("/account-security?passwordChanged=1");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to change password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card card-pad form-grid password-form" onSubmit={submit} aria-busy={saving}>
      <div className="full password-policy" aria-labelledby="password-policy-heading">
        <strong id="password-policy-heading">Choose a strong new password</strong>
        <ul>
          <li>Use 12 to 128 characters.</li>
          <li>Avoid common or repeated-character passwords.</li>
          <li>Use a password different from your current password.</li>
        </ul>
      </div>
      <label>Current password<input name="currentPassword" type="password" autoComplete="current-password" required /></label>
      <label>New password<input name="newPassword" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /></label>
      <label>Confirm new password<input name="confirmPassword" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /></label>
      <div className="full page-actions">
        <button disabled={saving} type="submit">{saving ? "Updating password…" : "Change password"}</button>
      </div>
      {error ? <div className="full error" role="alert">{error}</div> : null}
      <span className="sr-only" role="status" aria-live="polite">{saving ? "Updating password securely." : ""}</span>
    </form>
  );
}
