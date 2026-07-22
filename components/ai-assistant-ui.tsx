"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function jsonRequest(url: string, method: string, body?: unknown) {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(value.error ?? "Request failed safely.");
  return value;
}

export function AiAssistantChat({ modes, providerLabel }: { modes: string[]; providerLabel: string }) {
  const [mode, setMode] = useState(modes[0] ?? "DOCUMENTATION");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [clearOpen, setClearOpen] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { setAnswer(await jsonRequest("/api/ai-assistant/ask", "POST", { mode, question })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The assistant failed safely."); }
    finally { setBusy(false); }
  }
  function clear() { setQuestion(""); setAnswer(null); setError(""); setClearOpen(false); }
  return <div className="ai-chat-stack">
    <div className="notice ai-safety-banner"><strong>Read-only assistant. It cannot change school records.</strong><span>Verify important decisions against the cited source.</span></div>
    <section className="card card-pad ai-provider-strip"><span><strong>Provider:</strong> {providerLabel}</span><span><strong>Live model:</strong> Disabled</span><span><strong>Memory:</strong> Current page only</span></section>
    <form className="card card-pad ai-question-form" onSubmit={submit}>
      <label>Retrieval mode<select value={mode} onChange={(event) => setMode(event.target.value)}>{modes.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></label>
      <label>Leadership question<textarea value={question} maxLength={1000} required placeholder="Ask about an allowlisted ERP guide or an aggregate operational summary." onChange={(event) => setQuestion(event.target.value)} /></label>
      <div className="page-actions"><button disabled={busy || !question.trim()}>{busy ? "Retrieving authorised evidence…" : "Ask read-only assistant"}</button><button type="button" className="secondary" onClick={() => setClearOpen(true)}>Clear current conversation</button></div>
      {error ? <p className="notice danger" role="alert">{error}</p> : null}
    </form>
    {answer ? <section className="card card-pad ai-answer" aria-live="polite">
      <div className="ai-answer-meta"><span className="badge">{answer.retrievalMode.replaceAll("_", " ")}</span><span className="badge">{answer.evidenceCompleteness}</span><time>{new Date(answer.generatedAt).toLocaleString("en-IN")}</time></div>
      <div className="ai-answer-text">{answer.answer}</div>
      <p className="notice warning">{answer.safetyNotice}</p>
      <h3>Sources used</h3><p>{answer.sourceCategoriesUsed.join(", ") || "No source category available"}</p>
      <h3>Citations</h3><ol className="ai-citations">{answer.citations.map((item: any) => <li key={item.id}><details><summary>{item.label}{item.heading ? ` — ${item.heading}` : ""}</summary><p>{item.relativePath ?? item.sourceKey}<br />Source timestamp: {new Date(item.sourceTimestamp).toLocaleString("en-IN")}</p></details></li>)}</ol>
    </section> : null}
    {clearOpen ? <Dialog title="Clear Current Assistant Conversation" description="This removes the answer and question from this page. The assistant has no cross-session conversational memory." confirm="Clear conversation" onCancel={() => setClearOpen(false)} onConfirm={clear} /> : null}
  </div>;
}

export function AiProfileActions({ id, code, status, providerKind }: { id: string; code: string; status: string; providerKind: string }) {
  const router = useRouter(), [dialog, setDialog] = useState<"health" | "activate" | "pause" | null>(null), [confirmation, setConfirmation] = useState(""), [message, setMessage] = useState("");
  async function act() {
    if (!dialog) return;
    try {
      const value = await jsonRequest(`/api/ai-assistant/profiles/${id}/${dialog === "health" ? "health" : "workflow"}`, "POST", dialog === "health" ? {} : { action: dialog, confirmation });
      setMessage(value.health?.message ?? "Profile updated."); setDialog(null); router.refresh();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Profile action failed."); }
  }
  return <div className="ai-actions"><div className="page-actions"><button type="button" className="secondary" onClick={() => setDialog("health")}>Health check</button>{status === "ACTIVE" ? <button type="button" className="danger" onClick={() => setDialog("pause")}>Pause</button> : <button type="button" disabled={providerKind !== "MOCK"} onClick={() => setDialog("activate")}>Activate</button>}</div>{message ? <p role="status">{message}</p> : null}
    {dialog ? <div className="confirmation-overlay"><section className="card confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-profile-title"><h3 id="ai-profile-title">{dialog === "health" ? "Check AI Assistant Profile Health" : dialog === "activate" ? "Activate AI Assistant Profile" : "Pause AI Assistant"}</h3><p>{dialog === "health" ? "MOCK health makes no network call. Disabled providers remain disabled." : "Only MOCK can be active in Prompt 20A. This action cannot enable live local or cloud use."}</p>{dialog === "activate" ? <label>Type ACTIVATE {code}<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label> : null}<div className="page-actions"><button type="button" className="secondary" autoFocus onClick={() => setDialog(null)}>Go back</button><button type="button" disabled={dialog === "activate" && confirmation !== `ACTIVATE ${code}`} onClick={act}>Confirm</button></div></section></div> : null}
  </div>;
}

export function AiSourceToggle({ id, enabled, name }: { id: string; enabled: boolean; name: string }) {
  const router = useRouter(), [open, setOpen] = useState(false), [message, setMessage] = useState("");
  async function act() { try { await jsonRequest(`/api/ai-assistant/sources/${id}`, "PATCH", { enabled: !enabled }); setOpen(false); router.refresh(); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Source update failed."); } }
  return <>{enabled ? <button type="button" className="danger" onClick={() => setOpen(true)}>Disable</button> : <button type="button" onClick={act}>Enable</button>}{message ? <span role="alert">{message}</span> : null}{open ? <Dialog title="Disable AI Source" description={`Disable ${name}? Historical audits remain unchanged and hard prohibited-field boundaries cannot be removed.`} confirm="Disable source" onCancel={() => setOpen(false)} onConfirm={act} /> : null}</>;
}

export function AiEvaluationRunButton() {
  const router = useRouter(), [open, setOpen] = useState(false), [message, setMessage] = useState("");
  async function act() { try { const value = await jsonRequest("/api/ai-assistant/evaluations", "POST"); setMessage(`${value.run.passedCases}/${value.run.totalCases} cases passed.`); setOpen(false); router.refresh(); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Evaluation failed."); } }
  return <>{<button type="button" onClick={() => setOpen(true)}>Run MOCK safety evaluations</button>}{message ? <p role="status">{message}</p> : null}{open ? <Dialog title="Run AI Safety Evaluations" description="Runs synthetic cases through deterministic safety rules. It will not enable a provider or use real personal data." confirm="Run evaluations" onCancel={() => setOpen(false)} onConfirm={act} /> : null}</>;
}

function Dialog({ title, description, confirm, onCancel, onConfirm }: { title: string; description: string; confirm: string; onCancel: () => void; onConfirm: () => void }) {
  return <div className="confirmation-overlay"><section className="card confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby={`ai-${title.replace(/\W/g, "-")}`}><h3 id={`ai-${title.replace(/\W/g, "-")}`}>{title}</h3><p>{description}</p><div className="page-actions"><button type="button" className="secondary" autoFocus onClick={onCancel}>Go back</button><button type="button" onClick={onConfirm}>{confirm}</button></div></section></div>;
}
