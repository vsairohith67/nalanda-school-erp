"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function api(url: string, method: string, body: unknown) {
  const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Unable to complete action.");
  return data;
}

export function TeacherAnalyticsCycleForm({ readiness }: { readiness: { eligibleTeachers: Array<{ teacherName: string; staffCode: string; state: string }>; sources: Record<string, number>; warnings: string[] } }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await api("/api/teacher-analytics/cycles", "POST", Object.fromEntries(form));
      router.push(`/teacher-analytics/${result.cycle.id}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create cycle."); } finally { setBusy(false); }
  }
  return <div className="grid two">
    <form className="card card-pad form-grid" onSubmit={submit}>
      <h3>Create Review Cycle</h3>
      <label>Cycle code<input name="cycleCode" required maxLength={40} placeholder="QA17D-2026-TERM1"/></label>
      <label>Academic year<input name="academicYear" required defaultValue="2026-27" pattern="\d{4}-\d{2}"/></label>
      <label className="full">Title<input name="title" required maxLength={160}/></label>
      <label>Period start<input type="date" name="periodStart" required/></label>
      <label>Period end<input type="date" name="periodEnd" required/></label>
      <label>Minimum Student cohort<input type="number" name="minimumStudentCohort" min={5} defaultValue={5} required/></label>
      <label className="full">Context notes<textarea name="notes" maxLength={2000}/></label>
      <p className="notice full">This cycle produces evidence categories only. It cannot create a composite score, rank, automatic employment recommendation, or Student-level comparison.</p>
      {message ? <p role="alert" className="notice full">{message}</p> : null}
      <button disabled={busy}>{busy ? "Creating…" : "Create Analytics Review Cycle"}</button>
    </form>
    <section className="card card-pad">
      <h3>Source-readiness preview</h3>
      <dl className="detail-list">{Object.entries(readiness.sources).map(([key, value]) => <div key={key}><dt>{key.replaceAll(/([A-Z])/g, " $1")}</dt><dd>{value}</dd></div>)}</dl>
      {readiness.warnings.map((warning) => <p className="notice" key={warning}>{warning}</p>)}
      <div className="table-wrap"><table><thead><tr><th>Teacher</th><th>Staff Code</th><th>Timetable Link</th></tr></thead><tbody>{readiness.eligibleTeachers.map((teacher) => <tr key={`${teacher.staffCode}-${teacher.teacherName}`}><td>{teacher.teacherName}</td><td>{teacher.staffCode}</td><td>{teacher.state}</td></tr>)}</tbody></table></div>
    </section>
  </div>;
}

type CycleAction = "open" | "generate" | "finalise" | "archive" | "cancel";
export function TeacherAnalyticsCycleActions({ id, status, updatedAt, permissions }: { id: string; status: string; updatedAt: string; permissions: { manage: boolean; generate: boolean; finalise: boolean } }) {
  const router = useRouter(); const [confirm, setConfirm] = useState<CycleAction | null>(null); const [reason, setReason] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const actions = [
    { action: "open" as const, label: "Open Analytics Review Cycle", show: status === "DRAFT" && permissions.manage },
    { action: "generate" as const, label: "Generate Teacher Snapshots", show: status === "OPEN" && permissions.generate },
    { action: "finalise" as const, label: "Finalise Analytics Cycle", show: ["SNAPSHOTS_GENERATED", "UNDER_REVIEW"].includes(status) && permissions.finalise },
    { action: "archive" as const, label: "Archive Analytics Cycle", show: status === "FINALISED" && permissions.manage },
    { action: "cancel" as const, label: "Cancel Analytics Cycle", show: ["DRAFT", "OPEN"].includes(status) && permissions.manage }
  ];
  async function act(action: CycleAction) {
    setBusy(true); setMessage("");
    try {
      await api(action === "generate" ? `/api/teacher-analytics/cycles/${id}/snapshots` : `/api/teacher-analytics/cycles/${id}/workflow`, "POST", { action, expectedUpdatedAt: updatedAt, reason });
      setConfirm(null); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to complete action."); } finally { setBusy(false); }
  }
  return <section className="card card-pad"><h3>Cycle Workflow</h3><p>Every transition is explicit, concurrency-checked, and preserved in the event history.</p><div className="page-actions">{actions.filter((a) => a.show).map((a) => <button type="button" key={a.action} className={a.action === "cancel" ? "danger" : ""} onClick={() => setConfirm(a.action)}>{a.label}</button>)}</div>{message ? <p role="alert" className="notice">{message}</p> : null}{confirm ? <div className="confirmation-overlay" role="presentation"><section className="card confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="analytics-cycle-dialog-title"><h3 id="analytics-cycle-dialog-title">{actions.find((a) => a.action === confirm)?.label}</h3><p>{confirm === "generate" ? "This creates immutable evidence snapshots for eligible active Teachers." : "Confirm this preserved analytics workflow transition."}</p>{confirm === "cancel" ? <label>Cancellation reason<textarea autoFocus value={reason} maxLength={1000} onChange={(event) => setReason(event.target.value)}/></label> : null}<div className="page-actions"><button autoFocus={confirm !== "cancel"} type="button" className="secondary" onClick={() => setConfirm(null)}>Go Back</button><button type="button" disabled={busy || (confirm === "cancel" && !reason.trim())} onClick={() => act(confirm)}>{busy ? "Working…" : actions.find((a) => a.action === confirm)?.label}</button></div></section></div> : null}</section>;
}

export function TeacherAnalyticsReviewForm({ snapshotId, review, permissions }: { snapshotId: string; review: any; permissions: { review: boolean; share: boolean; finalise: boolean; regenerate: boolean } }) {
  const router = useRouter(); const [dialog, setDialog] = useState<"share" | "finalise" | "regenerate" | null>(null); const [reason, setReason] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function save(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); try { await api(`/api/teacher-analytics/snapshots/${snapshotId}/review`, "POST", { action: "save", ...Object.fromEntries(new FormData(event.currentTarget)) }); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save review."); } finally { setBusy(false); } }
  async function act() { if (!dialog) return; setBusy(true); try { if (dialog === "regenerate") await api(`/api/teacher-analytics/snapshots/${snapshotId}/regenerate`, "POST", { reason }); else await api(`/api/teacher-analytics/snapshots/${snapshotId}/review`, "POST", { action: dialog, reviewId: review?.id, expectedUpdatedAt: review?.updatedAt }); setDialog(null); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update review."); } finally { setBusy(false); } }
  return <section className="card card-pad"><h3>Leadership Review</h3><p>Notes must be factual and professionally worded. The system does not generate allegations or conclusions.</p>{permissions.review && review?.status !== "FINALISED" ? <form className="form-grid" onSubmit={save}><label>Evidence and strengths<textarea name="strengthsNote" defaultValue={review?.strengthsNote ?? ""} maxLength={4000}/></label><label>Support needed<textarea name="supportNeededNote" defaultValue={review?.supportNeededNote ?? ""} maxLength={4000}/></label><label>Agreed actions<textarea name="agreedActionsNote" defaultValue={review?.agreedActionsNote ?? ""} maxLength={4000}/></label><label>Leadership context<textarea name="leadershipContextNote" defaultValue={review?.leadershipContextNote ?? ""} maxLength={4000}/></label><label>Next review date<input type="date" name="nextReviewDate" defaultValue={review?.nextReviewDate?.slice?.(0, 10) ?? ""}/></label><button disabled={busy}>Save Factual Review Notes</button></form> : <p>Status: {review?.status ?? "NOT_STARTED"}</p>}<div className="page-actions">{permissions.regenerate && !["SHARED_WITH_TEACHER", "TEACHER_RESPONSE_RECEIVED", "FINALISED"].includes(review?.status ?? "") ? <button type="button" className="secondary" onClick={() => setDialog("regenerate")}>Regenerate Draft Snapshot</button> : null}{permissions.share && review?.status === "DRAFT" ? <button type="button" onClick={() => setDialog("share")}>Share Review with Teacher</button> : null}{permissions.finalise && ["DRAFT", "SHARED_WITH_TEACHER", "TEACHER_RESPONSE_RECEIVED"].includes(review?.status ?? "") ? <button type="button" onClick={() => setDialog("finalise")}>Finalise Teacher Review</button> : null}</div>{message ? <p role="alert" className="notice">{message}</p> : null}{dialog ? <div className="confirmation-overlay" role="presentation"><section className="card confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="analytics-review-dialog-title"><h3 id="analytics-review-dialog-title">{dialog === "share" ? "Share Review with Teacher" : dialog === "finalise" ? "Finalise Teacher Review" : "Regenerate Draft Snapshot"}</h3><p>{dialog === "regenerate" ? "This replaces only the unshared draft snapshot and records the prior hash." : "This is an explicit preserved workflow action."}</p>{dialog === "regenerate" ? <label>Reason<textarea autoFocus value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000}/></label> : null}<div className="page-actions"><button autoFocus={dialog !== "regenerate"} className="secondary" type="button" onClick={() => setDialog(null)}>Go Back</button><button type="button" disabled={busy || (dialog === "regenerate" && !reason.trim())} onClick={act}>{busy ? "Working…" : "Confirm Action"}</button></div></section></div> : null}</section>;
}

export function TeacherAnalyticsResponseForm({ reviewId, existing, finalised }: { reviewId: string; existing: string | null; finalised: boolean }) {
  const router = useRouter(); const [confirm, setConfirm] = useState(false); const [value, setValue] = useState(existing ?? ""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function submit() { setBusy(true); try { await api("/api/teacher/analytics", "POST", { reviewId, teacherResponse: value }); setConfirm(false); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to submit response."); } finally { setBusy(false); } }
  if (finalised) return <section className="card card-pad"><h3>My Response</h3><p>{existing || "No response was submitted before finalisation."}</p><p className="notice">The review is finalised and immutable. A response is contextual and is not a legal acknowledgment or admission.</p></section>;
  return <section className="card card-pad"><h3>My Response</h3><label>Teacher response<textarea value={value} onChange={(event) => setValue(event.target.value)} maxLength={4000}/></label><button type="button" disabled={!value.trim()} onClick={() => setConfirm(true)}>{existing ? "Update Teacher Response" : "Submit Teacher Response"}</button>{message ? <p role="alert" className="notice">{message}</p> : null}{confirm ? <div className="confirmation-overlay"><section className="card confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="teacher-response-dialog-title"><h3 id="teacher-response-dialog-title">Submit Teacher Response</h3><p>Your response provides context. It does not overwrite leadership notes and is not a legal acknowledgment or admission.</p><div className="page-actions"><button autoFocus className="secondary" type="button" onClick={() => setConfirm(false)}>Go Back</button><button type="button" disabled={busy} onClick={submit}>{busy ? "Submitting…" : "Submit Teacher Response"}</button></div></section></div> : null}</section>;
}
