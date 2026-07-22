"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { defaultPathForRole, safeInternalPath } from "@/lib/navigation";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        identifier: form.get("identifier"),
        password: form.get("password")
      })
    });
    const data = await response.json();
    setSubmitting(false);
    if (!response.ok) {
      setError(data.error || "Unable to sign in");
      return;
    }
    const rolePath = defaultPathForRole(data.user?.role ?? "");
    router.replace(rolePath === "/dashboard" ? safeInternalPath(searchParams.get("next")) : rolePath);
    router.refresh();
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label>
        Username or email
        <input name="identifier" autoComplete="username" autoFocus required />
      </label>
      <label>
        Password
        <span className="password-field">
          <input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required />
          <button
            type="button"
            className="secondary password-toggle"
            aria-pressed={showPassword}
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </span>
      </label>
      {error ? <div className="error" role="alert">{error}</div> : null}
      <button disabled={submitting}>{submitting ? "Signing in..." : "Login"}</button>
    </form>
  );
}
