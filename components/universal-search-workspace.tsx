"use client";

import Link from "next/link";
import {
  Baby,
  BookOpenText,
  BriefcaseBusiness,
  BusFront,
  CalendarDays,
  CalendarClock,
  ContactRound,
  FileText,
  GraduationCap,
  HeartPulse,
  Images,
  ListTodo,
  LoaderCircle,
  MessageSquareWarning,
  PackageCheck,
  ReceiptText,
  Search,
  ShieldCheck,
  UtensilsCrossed,
  UserRound,
  Users
} from "lucide-react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import type { UniversalSearchResponse, UniversalSearchSourceCoverage, UniversalSearchSourceId, UniversalSearchSourceState } from "@/lib/universal-search-contract";

type SourceOption = {
  id: UniversalSearchSourceId;
  label: string;
  priority: number;
  available: boolean;
  coverage: UniversalSearchSourceCoverage;
  href: string;
};

const icons: Record<UniversalSearchSourceId, LucideIcon> = {
  STUDENTS: GraduationCap,
  ADMISSIONS: FileText,
  GUARDIANS: UserRound,
  STAFF: BriefcaseBusiness,
  DIARY: BookOpenText,
  TASKS: ListTodo,
  CONTACTS: ContactRound,
  FEES: ReceiptText,
  ATTENDANCE: PackageCheck,
  EXAMINATIONS: FileText,
  REPORT_CARDS: FileText,
  SUPPORT: MessageSquareWarning,
  SAFE_EXIT: ShieldCheck,
  EVENTS: CalendarDays,
  PARENT_MEETINGS: CalendarClock,
  TRANSPORT: BusFront,
  CAFETERIA: UtensilsCrossed,
  KG_REPORTS: Baby,
  EVENT_MEDIA: Images,
  USERS_IAM: Users,
  RECENT_ACTIVITY: ShieldCheck,
  RELEASE_OPERATIONS: PackageCheck,
  OBSERVABILITY: HeartPulse
};

export function UniversalSearchWorkspace({ sources }: { sources: SourceOption[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [selectedSources, setSelectedSources] = useState<UniversalSearchSourceId[]>(sources.map((source) => source.id));
  const [response, setResponse] = useState<UniversalSearchResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function quickFocus(event: KeyboardEvent) {
      if (event.key !== "/" || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable=true]")) return;
      event.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", quickFocus);
    return () => window.removeEventListener("keydown", quickFocus);
  }, []);

  const groups = useMemo(() => sources.map((source) => ({
    source,
    status: response?.sources.find((item) => item.source === source.id) ?? null,
    results: response?.results.filter((item) => item.source === source.id) ?? []
  })).filter((group) => group.status), [response, sources]);

  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim().replace(/\s+/g, " ");
    if (trimmed.length < 2) {
      setError("Enter at least 2 letters or numbers.");
      setResponse(null);
      inputRef.current?.focus();
      return;
    }
    if (!selectedSources.length) {
      setError("Choose at least one source.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const request = await fetch("/api/super-admin/search", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed, sources: selectedSources, limit: 50 })
      });
      const body = await request.json() as UniversalSearchResponse & { error?: string };
      if (!request.ok) throw new Error(body.error || "Search could not be completed.");
      setResponse(body);
    } catch (caught) {
      setResponse(null);
      setError(caught instanceof Error ? caught.message : "Search could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  function toggleSource(source: UniversalSearchSourceId) {
    setSelectedSources((current) => current.includes(source) ? current.filter((item) => item !== source) : [...current, source]);
  }

  function clear() {
    setQuery("");
    setResponse(null);
    setError("");
    inputRef.current?.focus();
  }

  function keyboardResults(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      clear();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const links = [...(resultsRef.current?.querySelectorAll<HTMLAnchorElement>("[data-search-result]") ?? [])];
    if (!links.length) return;
    const current = links.indexOf(document.activeElement as HTMLAnchorElement);
    const next = event.key === "ArrowDown"
      ? current < 0 ? 0 : Math.min(current + 1, links.length - 1)
      : current < 0 ? links.length - 1 : Math.max(current - 1, 0);
    event.preventDefault();
    links[next]?.focus();
  }

  const unavailable = groups.filter((group) => group.status && ["UNAVAILABLE", "DEGRADED", "TIMEOUT"].includes(group.status.state));
  return (
    <div className="universal-search-workspace" onKeyDown={keyboardResults}>
      <section className="universal-search-box card" aria-labelledby="universal-search-input-title">
        <div className="universal-search-box-heading">
          <div><h2 id="universal-search-input-title">Find an authorised record</h2><p>Use a name, school reference, receipt, task, exam or other approved identifier.</p></div>
          <kbd>/</kbd>
        </div>
        <form onSubmit={search} role="search" noValidate>
          <label htmlFor="universal-search-query">Search all selected modules</label>
          <div className="universal-search-input-row">
            <div><Search size={20} aria-hidden /><input ref={inputRef} id="universal-search-query" value={query} onChange={(event) => setQuery(event.target.value)} minLength={2} maxLength={120} autoComplete="off" spellCheck="false" placeholder="Student, admission, staff, task, receipt, exam…" aria-describedby="universal-search-help" /></div>
            <button type="submit" disabled={busy || !selectedSources.length}>{busy ? <LoaderCircle className="spin" size={19} aria-hidden /> : <Search size={19} aria-hidden />}{busy ? "Searching…" : "Search"}</button>
            <button type="button" className="secondary" onClick={clear} disabled={busy && !query}>Clear</button>
          </div>
          <p id="universal-search-help">2–120 characters. Results are bounded and the search term is not placed in the URL or persisted by Search.</p>
        </form>

        <fieldset className="universal-search-filters">
          <legend>Sources</legend>
          <div className="universal-search-filter-actions">
            <button type="button" className="secondary" onClick={() => setSelectedSources(sources.map((source) => source.id))}>Select all</button>
            <button type="button" className="secondary" onClick={() => setSelectedSources(sources.filter((source) => source.priority === 1).map((source) => source.id))}>Priority sources</button>
          </div>
          <div className="universal-search-filter-grid">
            {sources.map((source) => (
              <button type="button" key={source.id} className={selectedSources.includes(source.id) ? "active" : ""} aria-pressed={selectedSources.includes(source.id)} onClick={() => toggleSource(source.id)}>
                <SourceIcon source={source.id} /><span>{source.label}</span>{source.coverage !== "SEARCHABLE" ? <small style={source.coverage === "SAFE_METADATA_ONLY" ? { color: "var(--muted)" } : undefined}>{source.coverage === "UNAVAILABLE" ? "Unavailable" : "Safe metadata"}</small> : null}
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      <div className={`universal-search-live ${error ? "is-error" : ""}`} role="status" aria-live="polite">
        {busy ? "Searching selected authorised sources…" : error || (response ? `${response.total} result${response.total === 1 ? "" : "s"} across ${response.sources.length} selected source${response.sources.length === 1 ? "" : "s"}.` : "Enter a query to search. No module is dumped by an empty request.")}
      </div>

      {response ? (
        <div className="universal-search-results" ref={resultsRef} aria-busy={busy}>
          {response.results.length ? (
            <div className="universal-search-result-groups">
              {groups.filter((group) => group.results.length).map((group) => (
                <section key={group.source.id} className="universal-search-result-group" aria-labelledby={`search-group-${group.source.id.toLowerCase()}`}>
                  <header>
                    <div><SourceIcon source={group.source.id} /><div><h2 id={`search-group-${group.source.id.toLowerCase()}`}>{group.source.label}</h2><p>{group.results.length} bounded match{group.results.length === 1 ? "" : "es"}{group.source.coverage === "SAFE_METADATA_ONLY" ? " · Safe metadata only" : ""}</p></div></div>
                    <Link href={group.source.href}>Open module</Link>
                  </header>
                  <ol>
                    {group.results.map((result, index) => (
                      <li key={`${result.href}-${result.title}-${index}`}>
                        <Link href={result.href} data-search-result>
                          <span className="universal-search-result-icon"><SourceIcon source={result.source} /></span>
                          <span className="universal-search-result-copy">
                            <span><strong>{result.title}</strong>{result.status ? <small>{result.status}</small> : null}</span>
                            <span>{result.type} · {result.subtitle}</span>
                            {result.snippet ? <p>{result.snippet}</p> : null}
                          </span>
                          <span className="universal-search-open">Open</span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          ) : (
            <section className="universal-search-zero card" aria-labelledby="universal-search-zero-title">
              <Search size={32} aria-hidden />
              <h2 id="universal-search-zero-title">No matches</h2>
              <p>No selected available source matched this deterministic query. Try a full reference, a shorter name, or another source.</p>
            </section>
          )}

          {unavailable.length ? (
            <section className="universal-search-source-states card" aria-labelledby="universal-search-source-state-title">
              <h2 id="universal-search-source-state-title">Source availability</h2>
              <p>These states are not zero results.</p>
              <ul>{unavailable.map((group) => <li key={group.source.id}><SourceIcon source={group.source.id} /><div><strong>{group.source.label}</strong><span>{group.status?.message}</span></div><SourceState state={group.status!.state} /></li>)}</ul>
            </section>
          ) : null}

          {response.truncated ? <p className="universal-search-truncated">The first 50 highest-ranked results are shown. Open the owning module for more.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function SourceIcon({ source }: { source: UniversalSearchSourceId }) {
  const Icon = icons[source];
  return <Icon size={18} aria-hidden />;
}

function SourceState({ state }: { state: UniversalSearchSourceState }) {
  const text = state === "TIMEOUT" ? "Timed out" : state === "DEGRADED" ? "Degraded" : state === "UNAVAILABLE" ? "Unavailable" : state === "EMPTY" ? "No matches" : "Available";
  return <span className={`universal-search-state state-${state.toLowerCase()}`}>{text}</span>;
}
