"use client";

import { useMemo, useState } from "react";

export type NoticeView = {
  id: string;
  title: string;
  body: string;
  audienceType: string;
  className: string | null;
  section: string | null;
  status: string;
  publishDate: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { name: string } | null;
  updatedBy: { name: string } | null;
};

type NoticeForm = {
  title: string;
  body: string;
  audienceType: "ALL_PARENTS" | "CLASS" | "SECTION";
  className: string;
  section: string;
  publishDate: string;
  expiresAt: string;
};

const emptyForm: NoticeForm = {
  title: "",
  body: "",
  audienceType: "ALL_PARENTS",
  className: "",
  section: "",
  publishDate: "",
  expiresAt: ""
};

export function NoticeManager(props: {
  initialNotices: NoticeView[];
  classOptions: string[];
  sectionOptions: string[];
  canManage: boolean;
  canPublish: boolean;
}) {
  const [notices, setNotices] = useState(props.initialNotices);
  const [form, setForm] = useState<NoticeForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [audienceFilter, setAudienceFilter] = useState("ALL");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const visible = useMemo(() => notices.filter((notice) =>
    (statusFilter === "ALL" || notice.status === statusFilter) &&
    (audienceFilter === "ALL" || notice.audienceType === audienceFilter)
  ), [notices, statusFilter, audienceFilter]);

  async function save(status: "DRAFT" | "PUBLISHED") {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(editingId ? `/api/notices/${editingId}` : "/api/notices", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, status, action: "save" })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save notice");
      const saved = normalizeNotice(data.notice);
      replaceNotice(saved);
      resetForm();
      setMessage(status === "PUBLISHED" ? "Notice published to the relevant parents." : "Draft notice saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save notice");
    } finally {
      setSaving(false);
    }
  }

  async function runAction(id: string, action: "publish" | "archive", showMessage = true) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/notices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Unable to ${action} notice`);
      const notice = normalizeNotice(data.notice);
      replaceNotice(notice);
      if (showMessage) setMessage(action === "publish" ? "Notice published." : "Notice archived. It is no longer visible to parents.");
      return notice;
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : `Unable to ${action} notice`);
      throw actionError;
    } finally {
      setSaving(false);
    }
  }

  function edit(notice: NoticeView) {
    setEditingId(notice.id);
    setForm({
      title: notice.title,
      body: notice.body,
      audienceType: notice.audienceType as NoticeForm["audienceType"],
      className: notice.className ?? "",
      section: notice.section ?? "",
      publishDate: localDateTime(notice.publishDate),
      expiresAt: localDateTime(notice.expiresAt)
    });
    setMessage("");
    setError("");
    document.getElementById("notice-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function replaceNotice(notice: NoticeView) {
    setNotices((current) => [notice, ...current.filter((item) => item.id !== notice.id)]);
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  return (
    <div className="notice-management-stack">
      {props.canManage ? (
        <section className="card card-pad" id="notice-editor">
          <div className="section-title section-title-plain">
            <div>
              <h3>{editingId ? "Edit Notice" : "Create Notice"}</h3>
              <p>Save a draft first when the wording or audience still needs review.</p>
            </div>
          </div>
          <div className="form-grid notice-form-grid">
            <label className="wide">Title<input value={form.title} maxLength={160} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></label>
            <label className="wide">Notice Message<textarea rows={6} value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} /></label>
            <label>Audience<select value={form.audienceType} onChange={(event) => setForm((current) => ({ ...current, audienceType: event.target.value as NoticeForm["audienceType"], className: event.target.value === "ALL_PARENTS" ? "" : current.className, section: event.target.value === "SECTION" ? current.section : "" }))}>
              <option value="ALL_PARENTS">All Parents</option><option value="CLASS">Class</option><option value="SECTION">Section</option>
            </select></label>
            {form.audienceType !== "ALL_PARENTS" ? <label>Class<select value={form.className} onChange={(event) => setForm((current) => ({ ...current, className: event.target.value }))}><option value="">Choose class</option>{props.classOptions.map((value) => <option key={value}>{value}</option>)}</select></label> : null}
            {form.audienceType === "SECTION" ? <label>Section<select value={form.section} onChange={(event) => setForm((current) => ({ ...current, section: event.target.value }))}><option value="">Choose section</option>{props.sectionOptions.map((value) => <option key={value}>{value}</option>)}</select></label> : null}
            <label>Publish Date and Time <span className="muted-text">(optional)</span><input type="datetime-local" value={form.publishDate} onChange={(event) => setForm((current) => ({ ...current, publishDate: event.target.value }))} /></label>
            <label>Expiry Date and Time <span className="muted-text">(optional)</span><input type="datetime-local" value={form.expiresAt} onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))} /></label>
            <p className="full muted-text">A future publish date keeps a published notice hidden until that time. After the expiry time, parents no longer see it.</p>
            <div className="full page-actions notice-editor-actions">
              <button type="button" className="secondary" disabled={saving} onClick={() => save("DRAFT")}>Save as Draft</button>
              {props.canPublish ? <button type="button" disabled={saving} onClick={() => save("PUBLISHED")}>Publish Notice</button> : null}
              {editingId ? <button type="button" className="ghost" disabled={saving} onClick={resetForm}>Cancel Editing</button> : null}
            </div>
          </div>
        </section>
      ) : <div className="notice">You have view-only access. You can read notices but cannot create, edit, publish, or archive them.</div>}

      {message ? <div className="notice success" role="status">{message}</div> : null}
      {error ? <div className="notice danger" role="alert">{error}</div> : null}

      <section className="card">
        <div className="section-title notice-list-heading">
          <div><h3>Notice List</h3><p>{visible.length} notice{visible.length === 1 ? "" : "s"} shown.</p></div>
          <div className="notice-filters">
            <label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">All statuses</option><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option></select></label>
            <label>Audience<select value={audienceFilter} onChange={(event) => setAudienceFilter(event.target.value)}><option value="ALL">All audiences</option><option value="ALL_PARENTS">All Parents</option><option value="CLASS">Class</option><option value="SECTION">Section</option></select></label>
          </div>
        </div>
        <div className="notice-admin-list">
          {visible.map((notice) => (
            <article className="notice-admin-card" key={notice.id}>
              <div className="notice-admin-main">
                <div className="notice-admin-title"><h4>{notice.title}</h4><span className={`badge ${notice.status === "PUBLISHED" ? "success" : notice.status === "ARCHIVED" ? "" : "warn"}`}>{titleCase(notice.status)}</span></div>
                <p className="notice-audience-line"><strong>{audienceLabel(notice)}</strong> · Publish: {dateLabel(notice.publishDate)}{notice.expiresAt ? ` · Expires: ${dateLabel(notice.expiresAt)}` : " · No expiry"}</p>
                <p className="notice-body-preview">{notice.body}</p>
                <small>Created by {notice.createdBy?.name ?? "Staff"} · Last updated by {notice.updatedBy?.name ?? notice.createdBy?.name ?? "Staff"} on {dateLabel(notice.updatedAt)}</small>
              </div>
              {(props.canManage || props.canPublish) ? <div className="notice-card-actions">
                {props.canManage && (notice.status !== "PUBLISHED" || props.canPublish) ? <button type="button" className="secondary" disabled={saving} onClick={() => edit(notice)}>Edit</button> : null}
                {props.canPublish && notice.status !== "PUBLISHED" ? <button type="button" disabled={saving} onClick={() => void runAction(notice.id, "publish")}>Publish</button> : null}
                {props.canManage && notice.status !== "ARCHIVED" ? <button type="button" className="ghost" disabled={saving} onClick={() => void runAction(notice.id, "archive")}>Archive</button> : null}
              </div> : null}
            </article>
          ))}
          {!visible.length ? <div className="notice-empty-state"><h4>No notices match these filters.</h4><p>Change the filters or create a new draft notice.</p></div> : null}
        </div>
      </section>
    </div>
  );
}

function normalizeNotice(value: NoticeView): NoticeView {
  return value;
}

function audienceLabel(notice: NoticeView) {
  if (notice.audienceType === "CLASS") return `Class ${notice.className}`;
  if (notice.audienceType === "SECTION") return `Class ${notice.className}-${notice.section}`;
  return "All Parents";
}

function dateLabel(value: string | null) {
  if (!value) return "On publish";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function localDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
