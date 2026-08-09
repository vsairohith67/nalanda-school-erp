"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export function PublicSupportForm() {
  const [busy, setBusy] = useState(false), [result, setResult] = useState<{ message: string; reference: string } | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setResult(null);
    const form = event.currentTarget, data = new FormData(form);
    data.set("consent", data.get("consent") === "on" ? "true" : "false"); data.set("submissionKey", crypto.randomUUID());
    try { const response = await fetch("/api/public/support/requests", { method: "POST", body: data, cache: "no-store" }), body = await response.json(); setResult({ message: body.message, reference: body.reference }); form.reset(); }
    catch { setResult({ message: "Your support request has been received. Keep the reference shown on this page.", reference: `NPS-SUP-${crypto.randomUUID().slice(0, 8).toUpperCase()}` }); }
    finally { setBusy(false); }
  }
  return <section className="public-section public-support-section" aria-labelledby="contact-support-title">
    <div className="public-section-heading"><p className="public-eyebrow">Limited pre-login help</p><h2 id="contact-support-title">Contact Support</h2><p>Use this form only for login, account access, technical or admissions help. It cannot reset an account or retrieve Student or Staff information.</p></div>
    <div className="support-emergency" role="note"><strong>Urgent physical danger or medical emergency?</strong><span>Use the school&apos;s immediate emergency channel or local emergency services. This form does not replace emergency response.</span></div>
    {result ? <div className="card support-reference" role="status" aria-live="polite"><strong>{result.message}</strong><output>{result.reference}</output><p>The reference is an acknowledgment only. It does not confirm that any username, admission number, employee reference, mobile or email exists.</p></div> : null}
    <form className="card form-grid public-support-form" onSubmit={submit} encType="multipart/form-data">
      <label>Requester name<input name="requesterName" autoComplete="name" minLength={2} maxLength={100} required /></label>
      <label>Requester type<select name="requesterType" required defaultValue=""><option value="" disabled>Choose one</option><option value="PARENT">Parent</option><option value="STAFF">Staff</option><option value="APPLICANT">Applicant</option><option value="OTHER">Other</option></select></label>
      <label className="wide">Username, admission number or employee reference <span className="muted-text">(optional and unverified)</span><input name="requesterIdentifier" maxLength={80} autoComplete="off" /></label>
      <label>Preferred contact channel<select name="contactChannel" defaultValue="MOBILE"><option value="MOBILE">Mobile</option><option value="EMAIL">Email</option></select></label>
      <label>Preferred contact<input name="contactValue" maxLength={254} required autoComplete="email" /></label>
      <label className="wide">Category<select name="category" required defaultValue=""><option value="" disabled>Choose category</option><option value="LOGIN_SUPPORT">Login support</option><option value="ACCOUNT_ACCESS">Account access</option><option value="TECHNICAL_LOGIN">Technical login</option><option value="ADMISSION">Admission</option><option value="OTHER">Other</option></select></label>
      <label className="wide">Message<textarea name="message" minLength={20} maxLength={2000} required /></label>
      <label className="wide">Optional screenshot (one PNG, JPEG or still WebP; maximum 2 MB)<input name="screenshot" type="file" accept="image/png,image/jpeg,image/webp" /></label>
      <label className="wide support-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      <label className="wide checkbox-row"><input name="consent" type="checkbox" required /> I consent to the school using this minimum information to respond to this request. I have not entered a password, security answer, Aadhaar, PAN, bank detail or unrelated private information.</label>
      <p className="wide field-hint">Privacy wording is <strong>DRAFT_PENDING_APPROVAL</strong>. Read the <Link href="/privacy">Privacy page</Link> and <Link href="/terms">Terms</Link>.</p>
      <button className="wide" disabled={busy}>{busy ? "Submitting safely…" : "Submit support request"}</button>
    </form>
  </section>;
}
