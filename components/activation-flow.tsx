"use client";

import { startRegistration } from "@simplewebauthn/browser";
import { useEffect, useRef, useState } from "react";

type Requirements = { roles: string[]; training: string[]; mfaRequired: boolean };
type TrainingModule = { moduleHandle: string; moduleKey: string; title: string; versionNumber: number; content: string; completeAfter: string };
type Step = "ACCEPTING" | "PASSWORD" | "MFA" | "RECOVERY" | "TRAINING" | "POLICY" | "ROLES" | "READY" | "DONE" | "ERROR";

export function ActivationFlow() {
  const started = useRef(false);
  const [step, setStep] = useState<Step>("ACCEPTING");
  const [requirements, setRequirements] = useState<Requirements>({ roles: [], training: [], mfaRequired: false });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [factorHandle, setFactorHandle] = useState("");
  const [provisioningUri, setProvisioningUri] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [savedRecovery, setSavedRecovery] = useState(false);
  const [trainingIndex, setTrainingIndex] = useState(0);
  const [trainingModule, setTrainingModule] = useState<TrainingModule | null>(null);
  const [trainingAccepted, setTrainingAccepted] = useState(false);
  const [clock, setClock] = useState(Date.now());

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(location.hash.slice(1)).get("token") ?? "";
    history.replaceState(null, "", location.pathname);
    if (!token) { setMessage("The invitation is missing or unavailable."); setStep("ERROR"); return; }
    void post("/api/auth/invitations/accept", { token })
      .then((data) => { setRequirements(data.requirements); setStep("PASSWORD"); })
      .catch((error) => { setMessage(error.message); setStep("ERROR"); });
  }, []);

  useEffect(() => {
    if (!trainingModule) return;
    const timer = window.setInterval(() => setClock(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [trainingModule]);

  async function post(url: string, body: Record<string, unknown> = {}) {
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? "The security step could not be completed.");
    return data;
  }

  async function password(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      if (form.get("password") !== form.get("confirmPassword")) throw new Error("Password confirmation does not match.");
      await post("/api/auth/activation/password", { password: form.get("password") }); setStep("MFA");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Password refused."); } finally { setBusy(false); }
  }

  async function startTotp() {
    setBusy(true); setMessage("");
    try { const data = await post("/api/auth/activation/totp/start", { displayName: "Authenticator app" }); setFactorHandle(data.factorHandle); setProvisioningUri(data.provisioningUri); }
    catch (error) { setMessage(error instanceof Error ? error.message : "TOTP unavailable."); } finally { setBusy(false); }
  }

  async function confirmTotp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    try {
      const form = new FormData(event.currentTarget), data = await post("/api/auth/activation/totp/confirm", { factorHandle, token: form.get("token") });
      setProvisioningUri(""); setFactorHandle(""); setRecoveryCodes(data.recoveryCodes); setStep("RECOVERY");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Code refused."); } finally { setBusy(false); }
  }

  async function passkey() {
    setBusy(true); setMessage("");
    try {
      const start = await post("/api/auth/activation/passkeys/start");
      const response = await startRegistration({ optionsJSON: start.options });
      const result = await post("/api/auth/activation/passkeys/confirm", { challengeHandle: start.challengeHandle, response, displayName: "Passkey" });
      if (!result.verified) throw new Error("Passkey registration was refused.");
      setRecoveryCodes(result.recoveryCodes); setStep("RECOVERY");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Passkey unavailable; use the authenticator-app fallback."); } finally { setBusy(false); }
  }

  async function openTraining() {
    setBusy(true); setMessage("");
    try {
      const opened = await post("/api/auth/activation/training", { action: "START", moduleKey: requirements.training[trainingIndex] });
      setTrainingModule(opened); setTrainingAccepted(false); setClock(Date.now());
    } catch (error) { setMessage(error instanceof Error ? error.message : "Training module could not be opened."); } finally { setBusy(false); }
  }

  async function completeTraining(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trainingModule) return;
    setBusy(true); setMessage("");
    try {
      await post("/api/auth/activation/training", { action: "COMPLETE", moduleKey: trainingModule.moduleKey, moduleHandle: trainingModule.moduleHandle, acknowledgement: "I_COMPLETED_THE_TRAINING" });
      if (trainingIndex + 1 >= requirements.training.length) setStep("POLICY");
      else { setTrainingIndex((value) => value + 1); setTrainingModule(null); setTrainingAccepted(false); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Training evidence was refused."); } finally { setBusy(false); }
  }

  async function policy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    try { await post("/api/auth/activation/policy", { acknowledgement: "I_ACCEPT_THE_SECURITY_AND_PRIVACY_POLICY" }); setStep("ROLES"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Policy gate failed."); } finally { setBusy(false); }
  }

  async function roles() {
    setBusy(true);
    try { await post("/api/auth/activation/roles", { roles: requirements.roles }); setStep("READY"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Role confirmation failed."); } finally { setBusy(false); }
  }

  async function finish() {
    setBusy(true);
    try { await post("/api/auth/activation/complete"); setStep("DONE"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Activation requirements are incomplete."); } finally { setBusy(false); }
  }

  const trainingWait = trainingModule ? Math.max(0, Math.ceil((Date.parse(trainingModule.completeAfter) - clock) / 1_000)) : 0;
  return <div className="activation-flow" aria-busy={busy}>
    {message ? <div className="error" role="alert">{message}</div> : null}
    {step === "ACCEPTING" ? <p role="status">Validating the one-time invitation…</p> : null}
    {step === "PASSWORD" ? <form onSubmit={password}><h2>1. Establish your password</h2><p>Use a long, unique passphrase. No password is emailed or displayed again.</p><label>New password<input name="password" type="password" autoComplete="new-password" minLength={requirements.mfaRequired ? 12 : 15} maxLength={128} required autoFocus /></label><label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={requirements.mfaRequired ? 12 : 15} maxLength={128} required /></label><button disabled={busy}>Continue securely</button></form> : null}
    {step === "MFA" ? <section><h2>2. Add strong verification</h2><p>Passkeys are phishing-resistant where this browser and platform support them. An authenticator app is the interoperable fallback.</p><div className="activation-actions"><button disabled={busy} onClick={() => void passkey()}>Create a passkey</button><button className="secondary" disabled={busy || Boolean(provisioningUri)} onClick={() => void startTotp()}>Use authenticator app</button></div>{provisioningUri ? <form onSubmit={confirmTotp}><p className="secret-warning">One-time setup value. Do not share or screenshot it.</p><label>Authenticator setup URI<textarea readOnly value={provisioningUri} onFocus={(event) => event.currentTarget.select()} /></label><label>Current six-digit code<input name="token" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required autoFocus /></label><button disabled={busy}>Verify authenticator</button></form> : null}</section> : null}
    {step === "RECOVERY" ? <section><h2>3. Save recovery codes</h2><p>Each code works once. Store them offline; they will disappear after this step. Creating a replacement set invalidates every older unused code.</p><ol className="recovery-code-list">{recoveryCodes.map((code) => <li key={code}><code>{code}</code></li>)}</ol><label className="activation-check"><input type="checkbox" checked={savedRecovery} onChange={(event) => setSavedRecovery(event.target.checked)} />I stored these codes safely.</label><button disabled={!savedRecovery} onClick={() => { setRecoveryCodes([]); setStep(requirements.training.length ? "TRAINING" : "POLICY"); }}>Hide codes permanently and continue</button></section> : null}
    {step === "TRAINING" ? <section><h2>4. Required training</h2><p>Module {trainingIndex + 1} of {requirements.training.length}. Completion comes from the server-controlled module record, not from a checkbox alone.</p>{!trainingModule ? <button disabled={busy} onClick={() => void openTraining()}>Open {requirements.training[trainingIndex]?.replaceAll("_", " ")}</button> : <form onSubmit={completeTraining}><h3>{trainingModule.title}</h3><p>Version {trainingModule.versionNumber}</p><p>{trainingModule.content}</p><label className="activation-check"><input type="checkbox" required checked={trainingAccepted} onChange={(event) => setTrainingAccepted(event.target.checked)} />I reviewed and understood this module.</label><button disabled={busy || !trainingAccepted || trainingWait > 0}>{trainingWait > 0 ? `Continue in ${trainingWait}s` : "Record server-verified completion"}</button></form>}</section> : null}
    {step === "POLICY" ? <form onSubmit={policy}><h2>5. Security and privacy policy</h2><p>I will use only my approved role and scope, protect credentials, report suspicious access, and never access another person’s records without authority.</p><label className="activation-check"><input type="checkbox" required />I explicitly accept version 1 of this policy.</label><button disabled={busy}>Accept policy</button></form> : null}
    {step === "ROLES" ? <section><h2>6. Confirm active role contexts</h2><ul>{requirements.roles.map((role) => <li key={role}>{role.replaceAll("_", " ")}</li>)}</ul><p>Only the role selected in a session controls navigation and actions; permissions are not unioned.</p><button disabled={busy} onClick={() => void roles()}>These are the roles I was approved for</button></section> : null}
    {step === "READY" ? <section><h2>7. Final server check</h2><p>The server will re-check identity eligibility, approvals, invitation, credential, MFA, training, policy, role scope and feature gates.</p><button disabled={busy} onClick={() => void finish()}>Complete activation</button></section> : null}
    {step === "DONE" ? <section role="status"><h2>Activation complete</h2><p>Your account is active. Sign in with your new credential and additional verification.</p><a className="button" href="/login">Go to sign in</a></section> : null}
  </div>;
}
