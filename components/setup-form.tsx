"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SetupForm({ bootstrapTokenRequired = false }: { bootstrapTokenRequired?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const body = Object.fromEntries(new FormData(event.currentTarget).entries());
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(json?.error || "Unable to complete first-run setup");
      router.replace("/login?setup=complete");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to complete first-run setup");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="setup-form" onSubmit={submit}>
      <div className="form-grid">
        <label className="wide">
          School Name
          <input name="schoolName" autoFocus required />
        </label>
        <label>
          Academic Year
          <input name="academicYear" placeholder="2026-27" required />
        </label>
        <label>
          School Phone
          <input name="phone" inputMode="tel" required />
        </label>
        <label className="full">
          School Address
          <textarea name="address" required />
        </label>
        <label className="wide">
          Director Name
          <input name="directorName" autoComplete="name" required />
        </label>
        <label>
          Director Username
          <input name="username" autoComplete="username" required />
        </label>
        <label>
          Director Email
          <input name="email" type="email" autoComplete="email" />
        </label>
        <label className="wide">
          Director Password
          <input name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required />
          <span className="muted-text">Minimum 8 characters. Use a unique password for this school computer.</span>
        </label>
        {bootstrapTokenRequired ? (
          <label className="wide">
            First-run Bootstrap Token
            <input name="bootstrapToken" type="password" autoComplete="off" required />
            <span className="muted-text">Enter the one-time token provided by the system operator.</span>
          </label>
        ) : null}
      </div>
      {error ? <div className="error" role="alert">{error}</div> : null}
      <button disabled={submitting}>{submitting ? "Completing Setup..." : "Create Director and Finish Setup"}</button>
    </form>
  );
}
