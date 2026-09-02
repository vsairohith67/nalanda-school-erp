"use client";

import { useState } from "react";
import { AlertTriangle, FileUp, ScanLine } from "lucide-react";
import styles from "@/components/ocr-upload-workspace.module.css";

export function OcrUploadWorkspace() {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setNotice(null);
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) { setBusy(false); setNotice("Choose a synthetic PNG, JPEG, or PDF."); return; }
    try {
      const response = await fetch("/api/ocr/documents", {
        method: "POST",
        headers: {
          "X-Nalanda-OCR-Context-Type": String(form.get("contextType") ?? ""),
          "X-Nalanda-OCR-Context-ID": String(form.get("contextId") ?? ""),
          "X-Nalanda-OCR-Language": String(form.get("languageProfile") ?? "ENGLISH"),
          "X-Nalanda-OCR-Handwriting": String(form.get("handwritingDeclared") === "on"),
          "Idempotency-Key": crypto.randomUUID()
        },
        body: (() => { const body = new FormData(); body.set("file", file); return body; })()
      });
      const body = await response.json() as { document?: { publicKey: string }; error?: string; code?: string };
      if (!response.ok || !body.document) throw new Error(body.code || body.error || "OCR_UPLOAD_FAILED");
      location.assign(`/ocr-scanning/${body.document.publicKey}`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "OCR_UPLOAD_FAILED"); setBusy(false); }
  }
  return <main className={styles.shell}>
    <section className={styles.hero}><ScanLine aria-hidden="true" /><span>Local OCR · foundation 1B</span><h1>Scan into a human review draft</h1><p>PaddleOCR runs in a separate local worker. Nothing reaches an authoritative record until every field is reviewed and the final confirmation is submitted.</p></section>
    <section className={styles.warning} role="alert"><AlertTriangle aria-hidden="true" /><div><strong>Synthetic/copied QA only.</strong><p>Real school documents and operational activation are not authorised by this software clearance.</p></div></section>
    <form className={styles.form} onSubmit={upload}>
      <label>Authoritative module<select name="contextType" required defaultValue="ADMISSION"><option value="ADMISSION">Admissions</option><option value="STUDENT">Student</option><option value="GUARDIAN">Guardian</option><option value="STAFF">Staff</option></select></label>
      <label>Existing record key<input name="contextId" required maxLength={100} pattern="[A-Za-z0-9_-]+" aria-describedby="target-help" /></label><p id="target-help" className={styles.help}>OCR only updates an existing governed record. It does not create people or applications.</p>
      <label>Language profile<select name="languageProfile" defaultValue="ENGLISH"><option value="ENGLISH">English</option><option value="HINDI">Hindi</option><option value="TELUGU">Telugu</option><option value="ENGLISH_HINDI">English + Hindi</option><option value="ENGLISH_TELUGU">English + Telugu</option><option value="ENGLISH_HINDI_TELUGU">English + Hindi + Telugu</option></select></label>
      <label className={styles.fileLabel}><FileUp aria-hidden="true" />Synthetic source document<input name="file" type="file" required accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf" /><small>PNG, JPEG, or scanner-produced PDF · maximum 25 MiB and 25 pages</small></label>
      <label className={styles.check}><input name="handwritingDeclared" type="checkbox" />This document contains handwriting-like content and must remain manual review.</label>
      <button type="submit" disabled={busy}><FileUp />{busy ? "Admitting securely…" : "Upload to private review"}</button>
      {notice && <p className={styles.notice} role="status">{notice}</p>}
    </form>
  </main>;
}
