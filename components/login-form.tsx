"use client";

import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { defaultPathForRole, safeInternalPath } from "@/lib/navigation";

const GENERIC_LOGIN_ERROR = "We couldn’t sign you in with those details.";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const submitInFlight = useRef(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitInFlight.current) return;
    submitInFlight.current = true;
    setSubmitting(true);
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          identifier: form.get("identifier"),
          password: form.get("password")
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(GENERIC_LOGIN_ERROR);
        return;
      }
      const rolePath = defaultPathForRole(data.user?.role ?? "");
      router.replace(rolePath === "/dashboard" ? safeInternalPath(searchParams.get("next")) : rolePath);
      router.refresh();
    } catch {
      setError(GENERIC_LOGIN_ERROR);
    } finally {
      submitInFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form className="login-form" method="post" action="/api/auth/login" onSubmit={submit} aria-busy={submitting}>
      {searchParams.get("passwordChanged") === "1" ? (
        <div className="login-success" role="status">
          Password updated. Sign in again with your new password.
        </div>
      ) : null}
      <label>
        Username or verified login identifier
        <input
          name="identifier"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          required
        />
      </label>
      <label>
        Password
        <span className="password-field">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            onKeyDown={(event) => setCapsLock(event.getModifierState("CapsLock"))}
            onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))}
            onBlur={() => setCapsLock(false)}
            required
          />
          <button
            type="button"
            className="password-toggle"
            aria-pressed={showPassword}
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? <EyeOff size={19} aria-hidden /> : <Eye size={19} aria-hidden />}
          </button>
        </span>
      </label>
      {capsLock ? <div className="caps-lock-warning" role="status">Caps Lock is on.</div> : null}
      {error ? <div className="error" role="alert">{error}</div> : null}
      <button className="login-submit" disabled={submitting} type="submit">
        {submitting ? <LoaderCircle className="button-spinner" size={18} aria-hidden /> : null}
        <span>{submitting ? "Signing in…" : "Sign in"}</span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {submitting ? "Signing in securely." : ""}
      </span>
    </form>
  );
}
