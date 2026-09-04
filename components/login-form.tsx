"use client";

import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { safeInternalPath } from "@/lib/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";

const GENERIC_LOGIN_ERROR = "We couldn’t sign you in with those details.";
const LOGIN_RATE_LIMIT_ERROR = "Too many sign-in attempts. Please wait before trying again.";
const LOGIN_PROTECTION_UNAVAILABLE = "Sign-in protection is temporarily unavailable. Please retry shortly.";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [mfaChallenge, setMfaChallenge] = useState("");
  const [mfaFactor, setMfaFactor] = useState<"TOTP" | "RECOVERY_CODE" | "WEBAUTHN">("TOTP");
  const [webauthnOptions, setWebauthnOptions] = useState<PublicKeyCredentialRequestOptionsJSON | null>(null);
  const submitInFlight = useRef(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitInFlight.current) return;
    submitInFlight.current = true;
    setSubmitting(true);
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      const factorResponse = mfaChallenge && mfaFactor === "WEBAUTHN" && webauthnOptions
        ? await startAuthentication({ optionsJSON: webauthnOptions })
        : form.get("mfaResponse");
      const response = await fetch(mfaChallenge ? "/api/auth/login/mfa" : "/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mfaChallenge ? {
          challengeToken: mfaChallenge,
          factor: mfaFactor,
          response: factorResponse
        } : { identifier: form.get("identifier"), password: form.get("password") })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(response.status === 429
          ? LOGIN_RATE_LIMIT_ERROR
          : response.status === 503
            ? LOGIN_PROTECTION_UNAVAILABLE
            : GENERIC_LOGIN_ERROR);
        return;
      }
      if (data.mfaRequired && typeof data.challengeToken === "string") {
        setMfaChallenge(data.challengeToken);
        setWebauthnOptions(data.webauthnOptions && typeof data.webauthnOptions === "object" ? data.webauthnOptions as PublicKeyCredentialRequestOptionsJSON : null);
        if (data.webauthnOptions) setMfaFactor("WEBAUTHN");
        setError("");
        return;
      }
      if (data.mustChangePassword) {
        router.replace("/change-password");
        router.refresh();
        return;
      }
      const rolePath = safeInternalPath(typeof data.homePath === "string" ? data.homePath : null);
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
      {mfaChallenge ? <>
        <fieldset className="login-factor-choice">
          <legend>Additional verification</legend>
          <label><input type="radio" name="mfaFactor" checked={mfaFactor === "TOTP"} onChange={() => setMfaFactor("TOTP")} />Authenticator code</label>
          <label><input type="radio" name="mfaFactor" checked={mfaFactor === "RECOVERY_CODE"} onChange={() => setMfaFactor("RECOVERY_CODE")} />Recovery code</label>
          {webauthnOptions ? <label><input type="radio" name="mfaFactor" checked={mfaFactor === "WEBAUTHN"} onChange={() => setMfaFactor("WEBAUTHN")} />Passkey</label> : null}
        </fieldset>
        {mfaFactor === "WEBAUTHN" ? <p>Use your device passkey to finish signing in.</p> : <label>{mfaFactor === "TOTP" ? "Six-digit authenticator code" : "One-time recovery code"}<input name="mfaResponse" inputMode={mfaFactor === "TOTP" ? "numeric" : "text"} autoComplete="one-time-code" pattern={mfaFactor === "TOTP" ? "[0-9]{6}" : undefined} required autoFocus /></label>}
        <button type="button" className="secondary" onClick={() => { setMfaChallenge(""); setError(""); }}>Use a different account</button>
      </> : <><label>
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
      </>}
      {capsLock ? <div className="caps-lock-warning" role="status">Caps Lock is on.</div> : null}
      {error ? <div className="error" role="alert">{error}</div> : null}
      <button className="login-submit" disabled={submitting} type="submit">
        {submitting ? <LoaderCircle className="button-spinner" size={18} aria-hidden /> : null}
        <span>{submitting ? "Signing in…" : mfaChallenge ? "Verify and sign in" : "Sign in"}</span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {submitting ? "Signing in securely." : ""}
      </span>
    </form>
  );
}
