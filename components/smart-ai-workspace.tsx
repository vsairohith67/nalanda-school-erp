"use client";

import Link from "next/link";
import { ArrowRight, Bot, DatabaseZap, LoaderCircle, LockKeyhole, RotateCcw, Send, ShieldCheck, TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";
import { SMART_AI_LIMITS, type SmartAiProviderStatus, type SmartAiResponse, type SmartAiSource } from "@/lib/smart-ai-contract";
import { PRODUCT_BRAND } from "@/config/product-brand";

type Exchange = {
  id: number;
  question: string;
  response: SmartAiResponse;
};

export function SmartAiWorkspace({ initialProvider }: { initialProvider: SmartAiProviderStatus }) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nextId = useRef(1);
  const [question, setQuestion] = useState("");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function ask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = question.trim().replace(/\s+/g, " ");
    if (trimmed.length < SMART_AI_LIMITS.minimumQuestionCharacters) {
      setError(`Enter at least ${SMART_AI_LIMITS.minimumQuestionCharacters} characters.`);
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    setError("");
    try {
      const request = await fetch("/api/super-admin/ai", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, conversation: conversationWindow(exchanges) })
      });
      const body = await request.json() as SmartAiResponse & { error?: string };
      if (!request.ok) throw new Error(body.error || "Smart AI could not complete the request.");
      setExchanges((current) => [...current, { id: nextId.current++, question: trimmed, response: body }]);
      setQuestion("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Smart AI could not complete the request.");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function newConversation() {
    setExchanges([]);
    setQuestion("");
    setError("");
    inputRef.current?.focus();
  }

  return (
    <div className="smart-ai-workspace">
      <section className={`smart-ai-runtime card runtime-${initialProvider.state.toLowerCase()}`} aria-labelledby="smart-ai-runtime-title">
        <div className="smart-ai-runtime-icon"><Bot size={22} aria-hidden /></div>
        <div><h2 id="smart-ai-runtime-title">{initialProvider.state === "READY" ? "Local runtime ready" : "AI runtime not configured"}</h2><p>{initialProvider.message}</p></div>
        <span>{initialProvider.kind === "LOCAL" ? "Loopback only" : "Disabled"}</span>
      </section>

      <section className="smart-ai-compose card" aria-labelledby="smart-ai-ask-title">
        <div className="smart-ai-compose-heading">
          <div><h2 id="smart-ai-ask-title">Ask Smart AI</h2><p>Ask about authorised {PRODUCT_BRAND.productName} records. Smart AI cannot take actions or use the internet.</p></div>
          <button type="button" className="secondary" onClick={newConversation} disabled={busy || (!exchanges.length && !question)}><RotateCcw size={17} aria-hidden /> New conversation</button>
        </div>
        <form onSubmit={ask} noValidate>
          <label htmlFor="smart-ai-question">Your ERP question</label>
          <textarea
            ref={inputRef}
            id="smart-ai-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            minLength={SMART_AI_LIMITS.minimumQuestionCharacters}
            maxLength={SMART_AI_LIMITS.maximumQuestionCharacters}
            rows={3}
            autoComplete="off"
            placeholder="For example: What tasks are overdue?"
            aria-describedby="smart-ai-help"
          />
          <div className="smart-ai-compose-actions">
            <p id="smart-ai-help">Questions and answers stay in this page session and are not saved as AI conversation history.</p>
            <button type="submit" disabled={busy || question.trim().length < SMART_AI_LIMITS.minimumQuestionCharacters}>{busy ? <LoaderCircle className="spin" size={18} aria-hidden /> : <Send size={18} aria-hidden />}{busy ? "Checking authorised sources…" : "Ask Smart AI"}</button>
          </div>
        </form>
      </section>

      <div className={`smart-ai-live ${error ? "is-error" : ""}`} role="status" aria-live="polite">
        {busy ? "Universal Search is retrieving bounded authorised evidence…" : error || (exchanges.length ? `${exchanges.length} question${exchanges.length === 1 ? "" : "s"} in this temporary conversation.` : "Ready for a grounded ERP question.")}
      </div>

      <section className="smart-ai-conversation" aria-label="Temporary Smart AI conversation" aria-busy={busy}>
        {!exchanges.length ? <SmartAiEmpty /> : exchanges.map((exchange) => <SmartAiExchange exchange={exchange} key={exchange.id} />)}
      </section>

      <section className="smart-ai-privacy" aria-labelledby="smart-ai-privacy-title">
        <ShieldCheck size={20} aria-hidden />
        <div><h2 id="smart-ai-privacy-title">Private and grounded</h2><p>Smart AI uses only permission-filtered Universal Search results, sends them only to an explicitly configured loopback runtime, does not store chat history, and cannot change ERP data.</p></div>
      </section>
    </div>
  );
}
function SmartAiExchange({ exchange }: { exchange: Exchange }) {
  const { response } = exchange;
  const shownSources = response.citations.length ? response.citations : response.sources;
  const degraded = response.retrieval.coverage === "DEGRADED";
  return (
    <article className="smart-ai-exchange">
      <div className="smart-ai-question"><span>You asked</span><p>{exchange.question}</p></div>
      <div className={`smart-ai-answer status-${response.status.toLowerCase()}`}>
        <header><div><Bot size={20} aria-hidden /><strong>Smart AI</strong></div><span>{statusLabel(response.status)}</span></header>
        {degraded ? <p className="smart-ai-warning"><TriangleAlert size={17} aria-hidden /> Source coverage is incomplete; unavailable sources were not treated as zero matches.</p> : null}
        <p className="smart-ai-answer-text">{response.answer}</p>
        <p className="smart-ai-answer-meta"><DatabaseZap size={15} aria-hidden /> {response.retrieval.resultCount} bounded Search source{response.retrieval.resultCount === 1 ? "" : "s"} · read-only · not saved</p>
        {shownSources.length ? <SmartAiSources sources={shownSources} preview={!response.citations.length} /> : null}
      </div>
    </article>
  );
}

function SmartAiSources({ sources, preview }: { sources: SmartAiSource[]; preview: boolean }) {
  return (
    <section className="smart-ai-sources" aria-label={preview ? "Authorised Search evidence preview" : "Sources cited by Smart AI"}>
      <div><h3>Sources</h3>{preview ? <span>Authorised evidence preview</span> : <span>Validated citations</span>}</div>
      <ol>{sources.map((source) => (
        <li key={source.id}>
          <Link href={source.href}>
            <span className="smart-ai-source-id">{source.id}</span>
            <span className="smart-ai-source-copy"><strong>{source.title}</strong><small>{source.module} · {source.type}{source.status ? ` · ${source.status}` : ""}</small>{source.summary ? <p>{source.summary}</p> : null}</span>
            <span className="smart-ai-source-open">Open record <ArrowRight size={16} aria-hidden /></span>
          </Link>
        </li>
      ))}</ol>
    </section>
  );
}

function SmartAiEmpty() {
  return (
    <div className="smart-ai-empty card">
      <div><LockKeyhole size={27} aria-hidden /></div>
      <h2>Grounded school-management assistance</h2>
      <p>Ask for authorised records such as overdue tasks, Diary notes, supplier contacts, admission references, examinations or pending complaints.</p>
      <p>Smart AI will say when evidence is missing. It is not a general-purpose chatbot.</p>
    </div>
  );
}

function conversationWindow(exchanges: Exchange[]) {
  return exchanges.slice(-3).flatMap((exchange) => [
    { role: "USER" as const, content: exchange.question.slice(0, 900) },
    { role: "ASSISTANT" as const, content: exchange.response.answer.slice(0, 900) }
  ]).slice(-SMART_AI_LIMITS.maximumConversationTurns);
}

function statusLabel(status: SmartAiResponse["status"]) {
  if (status === "ANSWER") return "Grounded answer";
  if (status === "REFUSED") return "Outside boundary";
  if (status === "PROVIDER_DISABLED") return "Runtime unavailable";
  if (status === "INSUFFICIENT_EVIDENCE") return "Insufficient evidence";
  if (status === "RETRIEVAL_DEGRADED") return "Search degraded";
  if (status === "RETRIEVAL_FAILURE") return "Search unavailable";
  return "Provider failure";
}
