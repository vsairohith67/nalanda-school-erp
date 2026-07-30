"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ClassSectionOption = {
  id: string;
  displayName: string;
  className: string;
  section: string;
};

export function ExaminationConfigurationCreate({
  academicYear,
  classSections,
  requiresInterventionReason
}: {
  academicYear: string;
  classSections: ClassSectionOption[];
  requiresInterventionReason: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/exam-configurations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examCode: form.get("examCode"),
          academicYear: form.get("academicYear"),
          name: form.get("name"),
          examType: form.get("examType"),
          startDate: form.get("startDate"),
          endDate: form.get("endDate"),
          description: form.get("description"),
          interventionReason: form.get("interventionReason"),
          classSectionIds: selected
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to create examination configuration.");
      router.push(`/exams/configuration/${encodeURIComponent(data.examination.id)}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create examination configuration.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card card-pad form-grid exam-configuration-form" onSubmit={submit}>
      <label>
        Examination code
        <input name="examCode" required maxLength={40} placeholder="EXAM1" />
      </label>
      <label>
        Academic year
        <input name="academicYear" required pattern="\d{4}-\d{2}" defaultValue={academicYear} />
      </label>
      <label className="wide">
        Examination name
        <input name="name" required maxLength={160} />
      </label>
      <label>
        Examination type
        <select name="examType" required defaultValue="">
          <option value="" disabled>Select type</option>
          {["FORMATIVE", "SUMMATIVE", "TERM", "ANNUAL", "PREBOARD", "PRACTICAL", "OTHER_APPROVED"].map((value) => (
            <option key={value} value={value}>{value.replaceAll("_", " ")}</option>
          ))}
        </select>
      </label>
      <label>
        Start date
        <input name="startDate" required type="date" />
      </label>
      <label>
        End date
        <input name="endDate" required type="date" />
      </label>
      <label className="full">
        Description (optional)
        <textarea name="description" rows={3} maxLength={2_000} />
      </label>
      {requiresInterventionReason ? (
        <label className="full">
          Super Admin intervention audit reason
          <textarea name="interventionReason" required rows={3} maxLength={1_000} />
        </label>
      ) : null}
      <fieldset className="full configuration-scope-picker">
        <legend>Applicable classes and sections</legend>
        <p className="muted">Only active timetable class/section offerings in this academic year can be selected.</p>
        <div className="scope-option-grid">
          {classSections.map((scope) => (
            <label className="check-row" key={scope.id}>
              <input
                type="checkbox"
                checked={selected.includes(scope.id)}
                onChange={(event) => setSelected((current) => (
                  event.target.checked
                    ? [...current, scope.id]
                    : current.filter((id) => id !== scope.id)
                ))}
              />
              <span>{scope.displayName || `${scope.className} ${scope.section}`}</span>
            </label>
          ))}
        </div>
        {!classSections.length ? <div className="notice danger">No active timetable class/section offerings are available.</div> : null}
      </fieldset>
      <div className="full page-actions">
        <button type="submit" disabled={busy || selected.length === 0}>
          {busy ? "Creating..." : "Create Draft Examination"}
        </button>
      </div>
      {error ? <div className="full notice danger" role="alert">{error}</div> : null}
    </form>
  );
}
