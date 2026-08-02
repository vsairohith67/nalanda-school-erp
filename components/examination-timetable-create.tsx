"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Scope = { id: string; className: string; section: string; subjectPaperCount: number; versions: Array<{ id: string; versionNumber: number; status: string }> };
type Examination = { id: string; label: string; status: string; scopes: Scope[] };

export function ExaminationTimetableCreate({ examinations }: { examinations: Examination[] }) {
  const router = useRouter();
  const [examinationId, setExaminationId] = useState(examinations[0]?.id ?? "");
  const examination = useMemo(() => examinations.find((row) => row.id === examinationId), [examinations, examinationId]);
  const [scopeId, setScopeId] = useState(examination?.scopes[0]?.id ?? "");
  const [sourceVersionId, setSourceVersionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scope = examination?.scopes.find((row) => row.id === scopeId) ?? examination?.scopes[0];

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!examination || !scope) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/exam-timetables", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ examinationId: examination.id, classScopeId: scope.id, sourceVersionId: sourceVersionId || null, idempotencyKey: crypto.randomUUID() }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Unable to create timetable draft");
      router.push(`/exams/timetable/${encodeURIComponent(data.timetable.id)}`); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create timetable draft"); }
    finally { setBusy(false); }
  }

  function chooseExamination(value: string) {
    setExaminationId(value);
    const next = examinations.find((row) => row.id === value);
    setScopeId(next?.scopes[0]?.id ?? "");
    setSourceVersionId("");
  }

  return <form className="card card-pad form-grid exam-timetable-create" onSubmit={create}>
    <h2 className="field-span">Create timetable draft</h2>
    <label>Existing examination<select value={examinationId} onChange={(event) => chooseExamination(event.target.value)} required>{examinations.map((row) => <option key={row.id} value={row.id}>{row.label} · {human(row.status)}</option>)}</select></label>
    <label>Exact class and section<select value={scope?.id ?? ""} onChange={(event) => { setScopeId(event.target.value); setSourceVersionId(""); }} required>{examination?.scopes.map((row) => <option key={row.id} value={row.id}>{row.className}{row.section ? `-${row.section}` : ""} · {row.subjectPaperCount} paper(s)</option>)}</select></label>
    <label>Clone version (optional)<select value={sourceVersionId} onChange={(event) => setSourceVersionId(event.target.value)}><option value="">Start empty</option>{scope?.versions.map((version) => <option key={version.id} value={version.id}>Version {version.versionNumber} · {human(version.status)}</option>)}</select></label>
    <p className="field-span muted-text">Cloning a published version starts a governed replacement draft. Publication history is never overwritten.</p>
    {error ? <p className="error field-span" role="alert">{error}</p> : null}
    <button disabled={busy || !examination || !scope}>{busy ? "Creating…" : "Create Draft"}</button>
  </form>;
}

function human(value: string) { return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
