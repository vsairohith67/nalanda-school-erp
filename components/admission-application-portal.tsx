"use client";

import { useState } from "react";

type Application = {
  applicationNumber: string;
  status: string;
  version: number;
  expiresAt: string;
  cycle: { name: string; academicYear: string; enabledClasses: string[]; declarations: string[]; documentTypes: string[] };
  child: any;
  guardians: any[];
  documents: any[];
};

function presentLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function api(token: string, method: string, body?: unknown) {
  const response = await fetch("/api/public/admissions/application", {
    method,
    headers: { "x-admission-invitation": token, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store"
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "The invitation is unavailable.");
  return data;
}

export function AdmissionApplicationPortal() {
  const [token, setToken] = useState("");
  const [application, setApplication] = useState<Application | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function open(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const data = await api(token, "GET");
      setApplication(data.application);
      setMessage("Invitation opened securely.");
    } catch (error) {
      setApplication(null);
      setMessage(error instanceof Error ? error.message : "Invitation unavailable.");
    } finally {
      setBusy(false);
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>, submit: boolean) {
    event.preventDefault();
    if (!application) return;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const guardians = [{ displayName: form.get("guardianName"), relationshipToChild: form.get("relationship"), contactMethod: form.get("contactMethod"), contactValue: form.get("contactValue"), isPrimary: true }];
    const body = { fullName: form.get("fullName"), dateOfBirth: form.get("dateOfBirth"), desiredAcademicYear: form.get("desiredAcademicYear"), desiredClass: form.get("desiredClass"), previousSchool: form.get("previousSchool"), previousClass: form.get("previousClass"), guardians, declarationVersion: "ADMISSION-DECLARATIONS-V1", declarationAccepted: form.get("declarationAccepted") === "on", expectedVersion: application.version };
    try {
      await api(token, submit ? "POST" : "PATCH", body);
      const fresh = await api(token, "GET").catch(() => null);
      if (fresh) setApplication(fresh.application);
      else setApplication(null);
      setMessage(submit ? "Application submitted. This invitation can no longer be reused." : "Private draft saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The application could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!application) return;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/public/admissions/application/documents", { method: "POST", headers: { "x-admission-invitation": token }, body: form, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const fresh = await api(token, "GET");
      setApplication(fresh.application);
      setMessage("Private document uploaded. It remains unavailable to staff until encrypted recovery verification is complete.");
      event.currentTarget.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Document upload failed safely.");
    } finally {
      setBusy(false);
    }
  }

  if (!application) return <main className="public-section admissions-portal"><div className="public-section-heading"><span>Invitation only</span><h1>Secure admission application</h1><p>Enter the one-time token supplied by authorised school staff. The token is sent only in a private request header and is never placed in the page URL.</p></div><form className="admission-token-form" onSubmit={open}><label>Invitation token<input value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" minLength={40} required /></label><button className="public-primary-button" disabled={busy}>{busy ? "Opening…" : "Open application"}</button><p role="status" aria-live="polite">{message}</p></form></main>;

  return <main key={application.applicationNumber} className="public-section admissions-portal"><div className="public-section-heading"><span>{presentLabel(application.status)}</span><h1>Application {application.applicationNumber}</h1><p>{application.cycle.name} · invitation expires {new Date(application.expiresAt).toLocaleString()}</p></div><form className="admissions-public-form" onSubmit={(event) => save(event, false)}><label>Child full name<input name="fullName" defaultValue={application.child?.fullName ?? ""} maxLength={120} required /></label><label>Date of birth <span>(only if required)</span><input name="dateOfBirth" type="date" defaultValue={application.child?.dateOfBirth ?? ""} /></label><label>Academic year<input name="desiredAcademicYear" defaultValue={application.child?.desiredAcademicYear ?? application.cycle.academicYear} readOnly /></label><label>Desired class<select name="desiredClass" defaultValue={application.child?.desiredClass ?? application.cycle.enabledClasses[0]}>{application.cycle.enabledClasses.map((item) => <option key={item}>{item}</option>)}</select></label><label>Previous school <span>(optional)</span><input name="previousSchool" defaultValue={application.child?.previousSchool ?? ""} maxLength={120} /></label><label>Previous class <span>(optional)</span><input name="previousClass" defaultValue={application.child?.previousClass ?? ""} maxLength={40} /></label><label>Primary Guardian name<input name="guardianName" defaultValue={application.guardians[0]?.displayName ?? ""} maxLength={100} required /></label><label>Relationship<input name="relationship" defaultValue={application.guardians[0]?.relationshipToChild ?? "Parent"} maxLength={60} required /></label><label>Contact method<select name="contactMethod" defaultValue={application.guardians[0]?.contactMethod ?? "PHONE"}><option value="PHONE">Phone</option><option value="EMAIL">Email</option></select></label><label>Contact value<input name="contactValue" defaultValue={application.guardians[0]?.contactValue ?? ""} maxLength={254} required /></label><div className="wide admission-declarations"><h2>Approved declarations</h2>{application.cycle.declarations.map((item) => <p key={item}>{item}</p>)}<label className="admissions-consent"><input name="declarationAccepted" type="checkbox" /><span>I accept the approved declarations for this version.</span></label></div><div className="wide admission-action-row"><button className="public-secondary-button" disabled={busy}>Save private draft</button><button className="public-primary-button" type="button" disabled={busy} onClick={(event) => { const form = event.currentTarget.closest("form"); if (form) save({ preventDefault() {}, currentTarget: form } as unknown as React.FormEvent<HTMLFormElement>, true); }}>Submit application</button></div></form><form className="admission-document-form" onSubmit={upload}><h2>Configured document checklist</h2><label>Document type<select name="documentType">{application.cycle.documentTypes.map((item) => <option key={item} value={item}>{presentLabel(item)}</option>)}</select></label><label>PDF, PNG, JPEG or still WebP<input name="file" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" required /></label><button className="public-secondary-button" disabled={busy}>Upload privately</button><ul>{application.documents.map((item) => <li key={item.publicKey}>{presentLabel(item.documentType)} · {presentLabel(item.status)} · recovery {presentLabel(item.recoveryStatus)}</li>)}</ul></form><p className="admissions-live" role="status" aria-live="polite">{message}</p><p className="admission-boundary">This application does not request an address, location, Aadhaar, PAN, medical information, payment data or admission fee.</p></main>;
}
