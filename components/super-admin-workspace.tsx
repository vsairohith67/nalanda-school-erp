"use client";

import { useMemo, useState } from "react";
import { BookOpenText, CalendarDays, Check, ChevronLeft, ChevronRight, CircleAlert, Clock3, ListChecks, Pencil, Plus, RotateCcw, Star, UsersRound } from "lucide-react";
import { CONTACT_CATEGORIES, CONTACT_STATUSES, DIARY_CATEGORIES, DIARY_STATUSES, TASK_STATUSES, WORK_MODULES, WORK_PRIORITIES, type ContactView, type DiaryView, type SuperAdminWorkSnapshot, type TaskBucket, type TaskView } from "@/lib/super-admin-work-types";

type Tab = "DIARY" | "TASKS" | "CONTACTS";
type Entity = "DIARY" | "TASK" | "CONTACT";

export function SuperAdminWorkspace({ initial }: { initial: SuperAdminWorkSnapshot }) {
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState<Tab>("DIARY");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("Your private work programme is ready.");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<{ entity: Entity; key: string } | null>(null);

  async function refresh() {
    const response = await fetch("/api/super-admin/my-work", { cache: "no-store", credentials: "same-origin" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Unable to refresh the work programme.");
    setData(body);
  }

  async function mutate(entity: Entity, payload: Record<string, unknown>, publicKey?: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/super-admin/my-work", {
        method: publicKey ? "PATCH" : "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, publicKey, data: payload })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "The work item could not be saved.");
      await refresh();
      setEditing(null);
      setNotice(`${entity === "DIARY" ? "Diary entry" : entity === "TASK" ? "Task" : "Contact"} ${publicKey ? "updated" : "created"}.`);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The work item could not be saved.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const editingDiary = editing?.entity === "DIARY" ? data.diary.find((row) => row.publicKey === editing.key) ?? null : null;
  const editingTask = editing?.entity === "TASK" ? data.tasks.find((row) => row.publicKey === editing.key) ?? null : null;
  const editingContact = editing?.entity === "CONTACT" ? data.contacts.find((row) => row.publicKey === editing.key) ?? null : null;

  return (
    <div className="my-work-workspace">
      <div className={`my-work-live ${error ? "is-error" : ""}`} role={error ? "alert" : "status"} aria-live="polite">
        {busy ? <><Clock3 size={17} aria-hidden /> Saving private work…</> : error ? <><CircleAlert size={17} aria-hidden /> {error}</> : <><Check size={17} aria-hidden /> {notice}</>}
      </div>

      <nav className="my-work-tabs" aria-label="My Work sections">
        <TabButton active={tab === "DIARY"} onClick={() => { setTab("DIARY"); setEditing(null); }} icon={<BookOpenText size={18} aria-hidden />}>Diary</TabButton>
        <TabButton active={tab === "TASKS"} onClick={() => { setTab("TASKS"); setEditing(null); }} icon={<ListChecks size={18} aria-hidden />}>Tasks</TabButton>
        <TabButton active={tab === "CONTACTS"} onClick={() => { setTab("CONTACTS"); setEditing(null); }} icon={<UsersRound size={18} aria-hidden />}>Contacts</TabButton>
      </nav>

      {tab === "DIARY" ? <DiarySection rows={data.diary} todayKey={data.todayKey} editing={editingDiary} busy={busy} edit={(row) => setEditing({ entity: "DIARY", key: row.publicKey })} cancel={() => setEditing(null)} save={mutate} /> : null}
      {tab === "TASKS" ? <TaskSection rows={data.tasks} todayKey={data.todayKey} editing={editingTask} busy={busy} edit={(row) => setEditing({ entity: "TASK", key: row.publicKey })} cancel={() => setEditing(null)} save={mutate} /> : null}
      {tab === "CONTACTS" ? <ContactSection rows={data.contacts} todayKey={data.todayKey} editing={editingContact} busy={busy} edit={(row) => setEditing({ entity: "CONTACT", key: row.publicKey })} cancel={() => setEditing(null)} save={mutate} /> : null}
    </div>
  );
}

function DiarySection({ rows, todayKey, editing, busy, edit, cancel, save }: { rows: DiaryView[]; todayKey: string; editing: DiaryView | null; busy: boolean; edit: (row: DiaryView) => void; cancel: () => void; save: (entity: Entity, payload: Record<string, unknown>, publicKey?: string) => Promise<boolean> }) {
  const [status, setStatus] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [date, setDate] = useState("");
  const [query, setQuery] = useState("");
  const visible = useMemo(() => rows.filter((row) =>
    (status === "ALL" || row.status === status) &&
    (category === "ALL" || row.category === category) &&
    (!date || row.entryDate === date) &&
    (!query.trim() || `${row.title} ${row.notes} ${row.contextReference ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()))
  ), [rows, status, category, date, query]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = formObject(form);
    if (await save("DIARY", payload, editing?.publicKey)) form.reset();
  }

  async function changeStatus(row: DiaryView, next: "OPEN" | "CLOSED") {
    await save("DIARY", diaryPayload(row, next), row.publicKey);
  }

  return (
    <section className="my-work-section" aria-labelledby="my-work-diary-title">
      <div className="my-work-section-heading"><div><h2 id="my-work-diary-title">Digital Diary</h2><p>Plain structured notes stay private to your exact Super Admin identity.</p></div><span>{rows.length} bounded recent entries</span></div>
      <div className="my-work-layout">
        <form className="card my-work-form" onSubmit={submit} key={editing?.publicKey ?? "new-diary"}>
          <FormHeading title={editing ? "Edit diary entry" : "New diary entry"} editing={Boolean(editing)} cancel={cancel} />
          <label>Title<input name="title" maxLength={160} required defaultValue={editing?.title ?? ""} /></label>
          <label>Date<input name="entryDate" type="date" required defaultValue={editing?.entryDate ?? todayKey} /></label>
          <label>Category<select name="category" required defaultValue={editing?.category ?? "PERSONAL_WORK"}>{enumOptions(DIARY_CATEGORIES)}</select></label>
          <label>Priority<select name="priority" defaultValue={editing?.priority ?? "NORMAL"}>{enumOptions(WORK_PRIORITIES)}</select></label>
          <label>Status<select name="status" defaultValue={editing?.status ?? "OPEN"}>{enumOptions(DIARY_STATUSES)}</select></label>
          <label>Follow-up date <span>(optional)</span><input name="followUpDate" type="date" defaultValue={editing?.followUpDate ?? ""} /></label>
          <label>School context <span>(optional)</span><select name="contextModule" defaultValue={editing?.contextModule ?? ""}><option value="">No linked module</option>{enumOptions(WORK_MODULES)}</select></label>
          <label>Safe reference <span>(optional)</span><input name="contextReference" maxLength={160} defaultValue={editing?.contextReference ?? ""} placeholder="Record number or short context only" /></label>
          <label className="full">Structured notes<textarea name="notes" rows={8} maxLength={12000} required defaultValue={editing?.notes ?? ""} placeholder={"Key point:\nAction needed:\nDecision / outcome:"} /></label>
          <p className="full my-work-form-note">Stored as plain structured text. No AI summarisation and no broad-audit copy of the note body.</p>
          <button className="full" type="submit" disabled={busy}><Plus size={17} aria-hidden />{editing ? "Save diary entry" : "Add diary entry"}</button>
        </form>

        <div className="my-work-list-panel">
          <div className="card my-work-filters">
            <label>Find<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, note or reference" /></label>
            <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All statuses</option>{enumOptions(DIARY_STATUSES)}</select></label>
            <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="ALL">All categories</option>{enumOptions(DIARY_CATEGORIES)}</select></label>
            <div className="my-work-date-nav"><span>Diary date</span><div><button type="button" aria-label="Previous diary date" onClick={() => setDate(addDays(date || todayKey, -1))}><ChevronLeft size={18} aria-hidden /></button><input aria-label="Diary date filter" type="date" value={date} onChange={(event) => setDate(event.target.value)} /><button type="button" aria-label="Next diary date" onClick={() => setDate(addDays(date || todayKey, 1))}><ChevronRight size={18} aria-hidden /></button></div><button type="button" className="secondary" onClick={() => setDate(date ? "" : todayKey)}>{date ? "All recent" : "Today"}</button></div>
          </div>
          <div className="my-work-list" aria-live="polite">
            {visible.length ? visible.map((row) => <article className="card my-work-item" key={row.publicKey}>
              <header><div><span className={`badge priority-${row.priority.toLowerCase()}`}>{human(row.priority)}</span><h3>{row.title}</h3><p>{human(row.category)} · <time dateTime={row.entryDate}>{formatDate(row.entryDate)}</time></p></div><span className="badge">{human(row.status)}</span></header>
              <p className="my-work-notes">{row.notes}</p>
              {row.contextModule ? <small>Context: {human(row.contextModule)}{row.contextReference ? ` · ${row.contextReference}` : ""}</small> : null}
              {row.followUpDate ? <small>Follow up: {formatDate(row.followUpDate)}</small> : null}
              <footer><button type="button" className="secondary" onClick={() => edit(row)}><Pencil size={16} aria-hidden />Edit</button>{row.status === "CLOSED" ? <button type="button" className="secondary" disabled={busy} onClick={() => changeStatus(row, "OPEN")}><RotateCcw size={16} aria-hidden />Reopen</button> : <button type="button" disabled={busy} onClick={() => changeStatus(row, "CLOSED")}><Check size={16} aria-hidden />Close</button>}</footer>
            </article>) : <Empty title="No diary entries match" detail="Change the date or filters, or add your first private diary entry." />}
          </div>
        </div>
      </div>
    </section>
  );
}

function TaskSection({ rows, todayKey, editing, busy, edit, cancel, save }: { rows: TaskView[]; todayKey: string; editing: TaskView | null; busy: boolean; edit: (row: TaskView) => void; cancel: () => void; save: (entity: Entity, payload: Record<string, unknown>, publicKey?: string) => Promise<boolean> }) {
  const [bucket, setBucket] = useState<TaskBucket>("TODAY");
  const [status, setStatus] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [sort, setSort] = useState("DUE_ASC");
  const [query, setQuery] = useState("");
  const visible = useMemo(() => rows.filter((row) =>
    taskBucketKey(row, todayKey) === bucket &&
    (status === "ALL" || row.status === status) &&
    (category === "ALL" || row.category === category) &&
    (!query.trim() || `${row.title} ${row.description ?? ""} ${row.linkedEntityReference ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()))
  ).sort((left, right) => sort === "PRIORITY" ? priorityRank(right.priority) - priorityRank(left.priority) || left.dueDate.localeCompare(right.dueDate) : sort === "DUE_DESC" ? right.dueDate.localeCompare(left.dueDate) : left.dueDate.localeCompare(right.dueDate)), [rows, todayKey, bucket, status, category, sort, query]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (await save("TASK", formObject(form), editing?.publicKey)) form.reset();
  }

  async function changeStatus(row: TaskView, next: "DONE" | "TO_DO") {
    await save("TASK", taskPayload(row, next), row.publicKey);
  }

  const counts = useMemo(() => rows.reduce<Record<TaskBucket, number>>((totals, row) => {
    totals[taskBucketKey(row, todayKey)] += 1;
    return totals;
  }, { TODAY: 0, OVERDUE: 0, UPCOMING: 0, COMPLETED: 0 }), [rows, todayKey]);

  return (
    <section className="my-work-section" aria-labelledby="my-work-task-title">
      <div className="my-work-section-heading"><div><h2 id="my-work-task-title">Tasks & Reminders</h2><p>Private due dates and local in-app reminder times. No provider messages are sent.</p></div><span>{rows.length} bounded tasks</span></div>
      <div className="my-work-layout">
        <form className="card my-work-form" onSubmit={submit} key={editing?.publicKey ?? "new-task"}>
          <FormHeading title={editing ? "Edit task" : "New task"} editing={Boolean(editing)} cancel={cancel} />
          <label>Title<input name="title" maxLength={160} required defaultValue={editing?.title ?? ""} /></label>
          <label>Status<select name="status" defaultValue={editing?.status ?? "TO_DO"}>{enumOptions(TASK_STATUSES)}</select></label>
          <label>Priority<select name="priority" defaultValue={editing?.priority ?? "NORMAL"}>{enumOptions(WORK_PRIORITIES)}</select></label>
          <label>Category<select name="category" defaultValue={editing?.category ?? "PERSONAL_WORK"}>{enumOptions(DIARY_CATEGORIES)}</select></label>
          <label>Due date<input name="dueDate" type="date" required defaultValue={editing?.dueDate ?? todayKey} /></label>
          <label>Due time <span>(optional)</span><input name="dueTime" type="time" defaultValue={editing?.dueTime ?? ""} /></label>
          <label>Reminder time <span>(optional)</span><input name="reminderAt" type="datetime-local" defaultValue={toIndiaLocalInput(editing?.reminderAt)} /></label>
          <label>Linked module <span>(optional)</span><select name="linkedModule" defaultValue={editing?.linkedModule ?? ""}><option value="">No linked module</option>{enumOptions(WORK_MODULES)}</select></label>
          <label>Entity type <span>(optional)</span><input name="linkedEntityType" maxLength={80} defaultValue={editing?.linkedEntityType ?? ""} placeholder="Student, request, event…" /></label>
          <label>Safe reference <span>(optional)</span><input name="linkedEntityReference" maxLength={160} defaultValue={editing?.linkedEntityReference ?? ""} placeholder="Public or human-readable reference" /></label>
          <label className="full">Description / notes <span>(optional)</span><textarea name="description" rows={6} maxLength={8000} defaultValue={editing?.description ?? ""} /></label>
          <p className="full my-work-form-note">Reminder times remain inside this private workspace and Command Center. SMS, WhatsApp and email are not activated.</p>
          <button className="full" type="submit" disabled={busy}><Plus size={17} aria-hidden />{editing ? "Save task" : "Add task"}</button>
        </form>

        <div className="my-work-list-panel">
          <div className="my-work-buckets" role="group" aria-label="Task time filters">{(["TODAY", "OVERDUE", "UPCOMING", "COMPLETED"] as TaskBucket[]).map((value) => <button type="button" key={value} className={bucket === value ? "active" : ""} aria-pressed={bucket === value} onClick={() => setBucket(value)}><strong>{counts[value]}</strong><span>{human(value)}</span></button>)}</div>
          <div className="card my-work-filters task-filters">
            <label>Find<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, note or reference" /></label>
            <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All statuses</option>{enumOptions(TASK_STATUSES)}</select></label>
            <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="ALL">All categories</option>{enumOptions(DIARY_CATEGORIES)}</select></label>
            <label>Sort<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="DUE_ASC">Due date: soonest</option><option value="DUE_DESC">Due date: latest</option><option value="PRIORITY">Priority</option></select></label>
          </div>
          <div className="my-work-list" aria-live="polite">
            {visible.length ? visible.map((row) => <article className={`card my-work-item ${taskBucketKey(row, todayKey) === "OVERDUE" ? "is-overdue" : ""}`} key={row.publicKey}>
              <header><div><span className={`badge priority-${row.priority.toLowerCase()}`}>{human(row.priority)}</span><h3>{row.title}</h3><p>{human(row.category)} · due <time dateTime={row.dueDate}>{formatDate(row.dueDate)}</time>{row.dueTime ? ` at ${row.dueTime}` : ""}</p></div><span className="badge">{human(row.status)}</span></header>
              {row.description ? <p className="my-work-notes">{row.description}</p> : null}
              {row.reminderAt ? <small><Clock3 size={14} aria-hidden /> Reminder {formatDateTime(row.reminderAt)}</small> : null}
              {row.linkedModule ? <small>Linked: {human(row.linkedModule)}{row.linkedEntityType ? ` · ${row.linkedEntityType}` : ""}{row.linkedEntityReference ? ` · ${row.linkedEntityReference}` : ""}</small> : null}
              <footer><button type="button" className="secondary" onClick={() => edit(row)}><Pencil size={16} aria-hidden />Edit</button>{row.status === "DONE" ? <button type="button" className="secondary" disabled={busy} onClick={() => changeStatus(row, "TO_DO")}><RotateCcw size={16} aria-hidden />Reopen</button> : row.status !== "CANCELLED" ? <button type="button" disabled={busy} onClick={() => changeStatus(row, "DONE")}><Check size={16} aria-hidden />Complete</button> : null}</footer>
            </article>) : <Empty title={`No ${human(bucket).toLowerCase()} tasks`} detail="Change filters or add a private task." />}
          </div>
        </div>
      </div>
    </section>
  );
}

function ContactSection({ rows, editing, busy, edit, cancel, save }: { rows: ContactView[]; todayKey: string; editing: ContactView | null; busy: boolean; edit: (row: ContactView) => void; cancel: () => void; save: (entity: Entity, payload: Record<string, unknown>, publicKey?: string) => Promise<boolean> }) {
  const [status, setStatus] = useState("ACTIVE");
  const [category, setCategory] = useState("ALL");
  const [query, setQuery] = useState("");
  const visible = useMemo(() => rows.filter((row) =>
    (status === "ALL" || row.status === status) &&
    (category === "ALL" || row.category === category) &&
    (!query.trim() || `${row.name} ${row.contactPerson ?? ""} ${row.tags.join(" ")} ${row.phone ?? ""} ${row.email ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()))
  ), [rows, status, category, query]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = formObject(form);
    payload.preferred = new FormData(form).get("preferred") === "on";
    if (await save("CONTACT", payload, editing?.publicKey)) form.reset();
  }

  return (
    <section className="my-work-section" aria-labelledby="my-work-contact-title">
      <div className="my-work-section-heading"><div><h2 id="my-work-contact-title">Contacts & Suppliers</h2><p>A private reference directory, separate from procurement, payments and accounting.</p></div><span>{rows.filter((row) => row.status === "ACTIVE").length} active</span></div>
      <div className="my-work-layout">
        <form className="card my-work-form" onSubmit={submit} key={editing?.publicKey ?? "new-contact"}>
          <FormHeading title={editing ? "Edit contact" : "New contact"} editing={Boolean(editing)} cancel={cancel} />
          <label>Person / company name<input name="name" maxLength={160} required defaultValue={editing?.name ?? ""} /></label>
          <label>Contact person <span>(optional)</span><input name="contactPerson" maxLength={120} defaultValue={editing?.contactPerson ?? ""} /></label>
          <label>Category<select name="category" required defaultValue={editing?.category ?? "OTHER"}>{enumOptions(CONTACT_CATEGORIES)}</select></label>
          <label>Status<select name="status" defaultValue={editing?.status ?? "ACTIVE"}>{enumOptions(CONTACT_STATUSES)}</select></label>
          <label>Phone <span>(optional)</span><input name="phone" inputMode="tel" maxLength={30} defaultValue={editing?.phone ?? ""} /></label>
          <label>Alternate phone <span>(optional)</span><input name="alternatePhone" inputMode="tel" maxLength={30} defaultValue={editing?.alternatePhone ?? ""} /></label>
          <label>Email <span>(optional)</span><input name="email" type="email" maxLength={254} defaultValue={editing?.email ?? ""} /></label>
          <label>Website <span>(optional)</span><input name="website" type="url" maxLength={300} defaultValue={editing?.website ?? ""} placeholder="https://" /></label>
          <label>Last contact <span>(optional)</span><input name="lastContactDate" type="date" defaultValue={editing?.lastContactDate ?? ""} /></label>
          <label>Next follow-up <span>(optional)</span><input name="nextFollowUpDate" type="date" defaultValue={editing?.nextFollowUpDate ?? ""} /></label>
          <label className="full">Address <span>(optional)</span><textarea name="address" rows={3} maxLength={800} defaultValue={editing?.address ?? ""} /></label>
          <label className="full">Tags <span>(optional; comma separated)</span><input name="tags" maxLength={380} defaultValue={editing?.tags.join(", ") ?? ""} /></label>
          <label className="full">Notes <span>(optional)</span><textarea name="notes" rows={5} maxLength={4000} defaultValue={editing?.notes ?? ""} /></label>
          <label className="full my-work-check"><input name="preferred" type="checkbox" defaultChecked={editing?.preferred ?? false} /><span><Star size={17} aria-hidden /> Preferred contact</span></label>
          <p className="full my-work-form-note warning">Never store card details, banking passwords, OTPs, PINs, credentials, government IDs or sensitive financial secrets here.</p>
          <button className="full" type="submit" disabled={busy}><Plus size={17} aria-hidden />{editing ? "Save contact" : "Add contact"}</button>
        </form>

        <div className="my-work-list-panel">
          <div className="card my-work-filters contact-filters">
            <label>Find<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, person, tag, phone or email" /></label>
            <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All statuses</option>{enumOptions(CONTACT_STATUSES)}</select></label>
            <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="ALL">All categories</option>{enumOptions(CONTACT_CATEGORIES)}</select></label>
          </div>
          <div className="my-work-list contact-list" aria-live="polite">
            {visible.length ? visible.map((row) => <article className="card my-work-item" key={row.publicKey}>
              <header><div>{row.preferred ? <span className="badge preferred"><Star size={13} aria-hidden />Preferred</span> : null}<h3>{row.name}</h3><p>{human(row.category)}{row.contactPerson ? ` · ${row.contactPerson}` : ""}</p></div><span className="badge">{human(row.status)}</span></header>
              <dl className="contact-details">{row.phone ? <div><dt>Phone</dt><dd><a href={`tel:${row.phone}`}>{row.phone}</a></dd></div> : null}{row.alternatePhone ? <div><dt>Alternate</dt><dd><a href={`tel:${row.alternatePhone}`}>{row.alternatePhone}</a></dd></div> : null}{row.email ? <div><dt>Email</dt><dd><a href={`mailto:${row.email}`}>{row.email}</a></dd></div> : null}{row.website ? <div><dt>Website</dt><dd><a href={row.website} target="_blank" rel="noreferrer">Open website</a></dd></div> : null}</dl>
              {row.address ? <p className="my-work-notes">{row.address}</p> : null}
              {row.tags.length ? <div className="contact-tags">{row.tags.map((tag) => <span key={tag}>{tag}</span>)}</div> : null}
              {row.nextFollowUpDate ? <small><CalendarDays size={14} aria-hidden /> Follow up {formatDate(row.nextFollowUpDate)}</small> : null}
              <footer><button type="button" className="secondary" onClick={() => edit(row)}><Pencil size={16} aria-hidden />Edit</button></footer>
            </article>) : <Empty title="No contacts match" detail="Change the filters or add your first private directory contact." />}
          </div>
        </div>
      </div>
    </section>
  );
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return <button type="button" className={active ? "active" : ""} aria-pressed={active} onClick={onClick}>{icon}<span>{children}</span></button>;
}

function FormHeading({ title, editing, cancel }: { title: string; editing: boolean; cancel: () => void }) {
  return <header className="full"><div><h3>{title}</h3><p>{editing ? "Update this owner-isolated record." : "Create an owner-isolated private record."}</p></div>{editing ? <button type="button" className="secondary" onClick={cancel}>Cancel edit</button> : null}</header>;
}

function Empty({ title, detail }: { title: string; detail: string }) {
  return <div className="card my-work-empty" role="status"><h3>{title}</h3><p>{detail}</p></div>;
}

function enumOptions(values: readonly string[]) {
  return values.map((value) => <option value={value} key={value}>{human(value)}</option>);
}

function formObject(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form).entries()) as Record<string, unknown>;
}

function diaryPayload(row: DiaryView, status: "OPEN" | "CLOSED") {
  return { title: row.title, entryDate: row.entryDate, notes: row.notes, category: row.category, contextModule: row.contextModule ?? "", contextReference: row.contextReference ?? "", status, priority: row.priority, followUpDate: row.followUpDate ?? "" };
}

function taskPayload(row: TaskView, status: "DONE" | "TO_DO") {
  return { title: row.title, description: row.description ?? "", status, priority: row.priority, dueDate: row.dueDate, dueTime: row.dueTime ?? "", reminderAt: toIndiaLocalInput(row.reminderAt), category: row.category, linkedModule: row.linkedModule ?? "", linkedEntityType: row.linkedEntityType ?? "", linkedEntityReference: row.linkedEntityReference ?? "" };
}

function taskBucketKey(row: Pick<TaskView, "status" | "dueDate">, todayKey: string): TaskBucket {
  if (row.status === "DONE" || row.status === "CANCELLED") return "COMPLETED";
  if (row.dueDate === todayKey) return "TODAY";
  return row.dueDate < todayKey ? "OVERDUE" : "UPCOMING";
}

function priorityRank(value: string) {
  return ({ LOW: 1, NORMAL: 2, HIGH: 3, URGENT: 4 } as Record<string, number>)[value] ?? 0;
}

function human(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function addDays(key: string, amount: number) {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function formatDate(key: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(`${key}T12:00:00+05:30`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value));
}

function toIndiaLocalInput(value?: string | null) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}
