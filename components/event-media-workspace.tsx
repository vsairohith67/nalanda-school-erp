"use client";

import { useMemo, useRef, useState } from "react";
import { Archive, Check, ChevronRight, CircleAlert, FileCheck2, Globe2, ImagePlus, Images, LockKeyhole, Plus, RefreshCw, ShieldCheck, Upload, UsersRound, X } from "lucide-react";

type Derivative = { kind: string; status: string; width: number | null; height: number | null };
type Association = { studentId: string; student: { admissionNo: string; studentName: string; className: string; section: string | null } };
type Asset = { id: string; publicKey: string; caption: string | null; reviewStatus: string; reviewNote: string | null; peopleDeclaration: string; publicationEligibility: string; publicationStatus: string; withdrawalState: string; derivativeStatus: string; createdAt: string; derivatives: Derivative[]; studentAssociations: Association[] };
type Audit = { publicKey: string; eventType: string; actorRole: string; eventDate: string; previousState: string | null; newState: string | null; reason: string | null };
type Album = { publicKey: string; title: string; description: string | null; eventDate: string; visibility: string; status: string; reviewStatus: string; publicationState: string; coverAssetPublicKey: string | null; retentionReviewAt: string | null; assets: Asset[]; auditEvents: Audit[] };
type Consent = { publicKey: string; studentId: string; audience: string; status: string; source: string; wordingVersion: string; grantedAt: string; expiresAt: string | null; revokedAt: string | null };
type Dashboard = { publicGalleryEnabled: boolean; albums: Album[]; consents: Consent[] };
type Capabilities = { create: boolean; upload: boolean; review: boolean; consent: boolean; approve: boolean; publish: boolean; archive: boolean };

const tabs = ["ALL", "UNDER_REVIEW", "APPROVED", "PUBLISHED", "ARCHIVED"] as const;
const tabLabels: Record<(typeof tabs)[number], string> = { ALL: "All albums", UNDER_REVIEW: "Needs review", APPROVED: "Approved", PUBLISHED: "Published", ARCHIVED: "Archived" };

export function EventMediaWorkspace({ initialData, capabilities }: { initialData: Dashboard; capabilities: Capabilities }) {
  const [data, setData] = useState(initialData);
  const [tab, setTab] = useState<(typeof tabs)[number]>("ALL");
  const [selectedAlbumKey, setSelectedAlbumKey] = useState(initialData.albums[0]?.publicKey ?? "");
  const [selectedAssetKey, setSelectedAssetKey] = useState(initialData.albums[0]?.assets[0]?.publicKey ?? "");
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const albums = useMemo(() => tab === "ALL" ? data.albums : data.albums.filter((album) => album.status === tab), [data.albums, tab]);
  const selectedAlbum = data.albums.find((album) => album.publicKey === selectedAlbumKey) ?? albums[0] ?? data.albums[0];
  const selectedAsset = selectedAlbum?.assets.find((asset) => asset.publicKey === selectedAssetKey) ?? selectedAlbum?.assets[0];
  const consentBlocked = Boolean(selectedAlbum?.assets.some((asset) => asset.publicationEligibility !== "ELIGIBLE"));

  async function refresh(preferredAlbumKey = selectedAlbumKey) {
    const response = await fetch("/api/event-media/albums", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Event Media could not refresh.");
    setData(payload);
    const next = payload.albums.find((album: Album) => album.publicKey === preferredAlbumKey) ?? payload.albums[0];
    setSelectedAlbumKey(next?.publicKey ?? "");
    setSelectedAssetKey((current) => next?.assets.some((asset: Asset) => asset.publicKey === current) ? current : next?.assets[0]?.publicKey ?? "");
  }

  async function run(task: () => Promise<void>, success: string) {
    setBusy(true); setNotice(null);
    try { await task(); setNotice({ tone: "success", text: success }); }
    catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "The request failed." }); }
    finally { setBusy(false); }
  }

  async function jsonRequest(url: string, method: string, body: unknown) {
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "The request failed.");
    return payload;
  }

  async function createAlbum(form: FormData) {
    await run(async () => {
      const created = await jsonRequest("/api/event-media/albums", "POST", { title: form.get("title"), eventDate: form.get("eventDate"), description: form.get("description"), visibility: form.get("visibility"), retentionReviewAt: form.get("retentionReviewAt") || null });
      setShowCreate(false); await refresh(created.publicKey);
    }, "Private album created.");
  }

  async function upload(file: File) {
    if (!selectedAlbum) return;
    await run(async () => {
      const form = new FormData(); form.set("photo", file);
      const response = await fetch(`/api/event-media/albums/${selectedAlbum.publicKey}/assets`, { method: "POST", body: form });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Upload failed.");
      await refresh(selectedAlbum.publicKey); setSelectedAssetKey(payload.publicKey);
    }, "Original stored privately and safe derivative processed.");
  }

  async function workflow(action: string) {
    if (!selectedAlbum) return;
    await run(async () => { await jsonRequest(`/api/event-media/albums/${selectedAlbum.publicKey}/workflow`, "POST", { action }); await refresh(selectedAlbum.publicKey); }, `${action.replaceAll("_", " ").toLowerCase()} completed.`);
  }

  return <div className="event-media-workspace">
    <section className="event-media-guardrail" aria-label="Privacy guardrail">
      <ShieldCheck aria-hidden /><div><strong>Default-off privacy</strong><span>{data.publicGalleryEnabled ? "Public gallery feature flag is enabled; consent and explicit publication still apply." : "Public publishing is disabled globally. Uploads remain private."}</span></div>
      <LockKeyhole aria-hidden />
    </section>

    {notice ? <div className={`event-media-notice ${notice.tone}`} role={notice.tone === "danger" ? "alert" : "status"}>{notice.tone === "danger" ? <CircleAlert aria-hidden /> : <Check aria-hidden />}<span>{notice.text}</span><button aria-label="Dismiss message" onClick={() => setNotice(null)}><X aria-hidden /></button></div> : null}

    <div className="event-media-toolbar">
      <div className="event-media-tabs" role="tablist" aria-label="Album status">
        {tabs.map((item) => <button key={item} role="tab" aria-selected={tab === item} onClick={() => setTab(item)}>{tabLabels[item]}<span>{item === "ALL" ? data.albums.length : data.albums.filter((album) => album.status === item).length}</span></button>)}
      </div>
      {capabilities.create ? <button className="button" onClick={() => setShowCreate((value) => !value)}><Plus size={18} aria-hidden />Create album</button> : null}
    </div>

    {showCreate ? <form className="event-media-create" action={createAlbum}>
      <div><h3>Create a private album</h3><p>Creation never publishes content.</p></div>
      <label>Album title<input name="title" required minLength={3} maxLength={180} /></label>
      <label>Event date<input name="eventDate" type="date" required /></label>
      <label>Approved audience<select name="visibility" defaultValue="PRIVATE_LEADERSHIP"><option value="PRIVATE_LEADERSHIP">Private leadership</option><option value="INTERNAL_AUTHORISED">Internal authorised</option><option value="PARENT_PORTAL">Parent portal</option><option value="PUBLIC">Public (feature flag applies)</option></select></label>
      <label>Retention review<input name="retentionReviewAt" type="date" /></label>
      <label className="wide">Description<textarea name="description" rows={3} maxLength={4000} /></label>
      <div className="event-media-form-actions"><button type="button" className="button secondary" onClick={() => setShowCreate(false)}>Cancel</button><button className="button" disabled={busy}>Create private album</button></div>
    </form> : null}

    {!data.albums.length ? <section className="event-media-empty"><Images aria-hidden /><h3>No event albums yet</h3><p>Create an album to begin the private upload and review workflow. Nothing is publicly visible.</p>{capabilities.create ? <button className="button" onClick={() => setShowCreate(true)}>Create first album</button> : null}</section> : <div className="event-media-layout">
      <aside className="event-media-album-rail" aria-label="Event albums">
        {albums.length ? albums.map((album) => {
          const cover = album.assets.find((asset) => asset.publicKey === album.coverAssetPublicKey) ?? album.assets[0];
          return <button key={album.publicKey} className={album.publicKey === selectedAlbum?.publicKey ? "selected" : ""} onClick={() => { setSelectedAlbumKey(album.publicKey); setSelectedAssetKey(album.assets[0]?.publicKey ?? ""); }}>
            <span className="event-album-cover">{cover ? <img src={`/api/event-media/assets/${cover.publicKey}/file`} alt="" /> : <ImagePlus aria-hidden />}</span>
            <span className="event-album-copy"><strong>{album.title}</strong><small>{formatDate(album.eventDate)} · {album.assets.length} {album.assets.length === 1 ? "photo" : "photos"}</small><Status value={album.status} /><small><LockKeyhole size={13} aria-hidden />{audienceLabel(album.visibility)}</small></span><ChevronRight aria-hidden />
          </button>;
        }) : <div className="event-media-rail-empty"><Archive aria-hidden /><p>No albums in this state.</p></div>}
      </aside>

      {selectedAlbum ? <main className="event-media-detail">
        <header><div><Status value={selectedAlbum.status} /><h2>{selectedAlbum.title}</h2><p>{formatDate(selectedAlbum.eventDate)} · {audienceLabel(selectedAlbum.visibility)}</p></div><span className="event-media-row-version">{selectedAlbum.publicationState.replaceAll("_", " ")}</span></header>
        {consentBlocked && ["PARENT_PORTAL", "PUBLIC"].includes(selectedAlbum.visibility) ? <div className="event-media-consent-warning" role="status"><CircleAlert aria-hidden /><div><strong>Consent incomplete — publication blocked</strong><span>Every manually associated Student needs current consent for this exact audience.</span></div></div> : null}
        <Workflow album={selectedAlbum} />
        <div className="event-media-actions">
          {capabilities.upload ? <><input ref={uploadRef} className="sr-only" type="file" aria-label="Choose a photo to upload" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = ""; }} /><button className="button secondary" disabled={busy || !["DRAFT", "PRIVATE"].includes(selectedAlbum.status)} onClick={() => uploadRef.current?.click()}><Upload size={17} aria-hidden />Upload photos</button></> : null}
          {capabilities.review ? <button className="button secondary" disabled={busy || !["DRAFT", "PRIVATE"].includes(selectedAlbum.status) || !selectedAlbum.assets.length} onClick={() => void workflow("SUBMIT_REVIEW")}><FileCheck2 size={17} aria-hidden />Review</button> : null}
          {capabilities.approve ? <button className="button secondary" disabled={busy || selectedAlbum.status !== "UNDER_REVIEW" || consentBlocked} onClick={() => void workflow("APPROVE")}><ShieldCheck size={17} aria-hidden />Approve</button> : null}
          {capabilities.publish && selectedAlbum.status !== "PUBLISHED" ? <button className="button" disabled={busy || selectedAlbum.status !== "APPROVED" || selectedAlbum.visibility === "PRIVATE_LEADERSHIP" || (selectedAlbum.visibility === "PUBLIC" && !data.publicGalleryEnabled) || consentBlocked} onClick={() => void workflow("PUBLISH")}><Globe2 size={17} aria-hidden />Publish</button> : null}
          {capabilities.publish && selectedAlbum.status === "PUBLISHED" ? <button className="button danger" disabled={busy} onClick={() => void workflow("UNPUBLISH")}><LockKeyhole size={17} aria-hidden />Unpublish</button> : null}
          {capabilities.archive ? <button className="button secondary" disabled={busy || selectedAlbum.status === "PUBLISHED" || selectedAlbum.status === "ARCHIVED"} onClick={() => void workflow("ARCHIVE")}><Archive size={17} aria-hidden />Archive</button> : null}
        </div>
        {selectedAlbum.assets.length ? <div className="event-media-thumbnails" aria-label="Album photos">{selectedAlbum.assets.map((asset, index) => <button key={asset.publicKey} className={selectedAsset?.publicKey === asset.publicKey ? "selected" : ""} aria-label={`Review photo ${index + 1}`} onClick={() => setSelectedAssetKey(asset.publicKey)}><img src={`/api/event-media/assets/${asset.publicKey}/file`} alt="" /><Status value={asset.reviewStatus} /></button>)}</div> : <div className="event-media-inner-empty"><ImagePlus aria-hidden /><p>Upload the first synthetic or approved school photo. Originals remain private.</p></div>}
        <section className="event-media-audit"><h3>Audit history</h3>{selectedAlbum.auditEvents.length ? <ol>{selectedAlbum.auditEvents.map((event) => <li key={event.publicKey}><time dateTime={event.eventDate}>{formatDateTime(event.eventDate)}</time><strong>{event.eventType.replaceAll("_", " ")}</strong><span>{event.actorRole.replaceAll("_", " ")}</span></li>)}</ol> : <p>No audit events are available.</p>}</section>
      </main> : null}

      <aside className="event-media-review-panel" aria-label="Selected photo review">
        {selectedAsset && selectedAlbum ? <>
          <header><div><small>Selected photo</small><h2>Review item {selectedAlbum.assets.findIndex((asset) => asset.publicKey === selectedAsset.publicKey) + 1} of {selectedAlbum.assets.length}</h2></div><Status value={selectedAsset.publicationStatus} /></header>
          <img className="event-media-review-image" src={`/api/event-media/assets/${selectedAsset.publicKey}/file`} alt={selectedAsset.caption || "Private event media thumbnail awaiting caption"} />
          <AssetReviewForm album={selectedAlbum} asset={selectedAsset} canReview={capabilities.review} busy={busy} onSave={async (payload) => run(async () => { await jsonRequest(`/api/event-media/assets/${selectedAsset.publicKey}`, "PATCH", payload); await refresh(selectedAlbum.publicKey); }, "Photo review saved.")} />
          <ConsentPanel asset={selectedAsset} audience={selectedAlbum.visibility} consents={data.consents} canManage={capabilities.consent} busy={busy} onRecord={async (payload) => run(async () => { await jsonRequest("/api/event-media/consents", "POST", payload); await refresh(selectedAlbum.publicKey); }, "Specific media-publication consent recorded.")} onRevoke={async (consentKey, reason) => run(async () => { await jsonRequest(`/api/event-media/consents/${consentKey}/revoke`, "POST", { reason }); await refresh(selectedAlbum.publicKey); }, "Consent revoked and affected publication withdrawn.")} />
        </> : <div className="event-media-review-empty"><ImagePlus aria-hidden /><h3>No photo selected</h3><p>Select or upload a private photo to review it.</p></div>}
      </aside>
    </div>}
    <footer className="event-media-footer"><LockKeyhole aria-hidden /><span>Original files are immutable and private. Unpublishing or revoking consent withdraws access without erasing audit evidence.</span><button className="button tertiary" disabled={busy} onClick={() => void run(() => refresh(), "Event Media refreshed.")}><RefreshCw size={16} aria-hidden />Refresh</button></footer>
  </div>;
}

function AssetReviewForm({ album, asset, canReview, busy, onSave }: { album: Album; asset: Asset; canReview: boolean; busy: boolean; onSave: (payload: unknown) => Promise<void> }) {
  return <form className="event-media-review-form" key={asset.publicKey} action={async (form) => onSave({ caption: form.get("caption"), peopleDeclaration: form.get("peopleDeclaration"), studentAdmissionNos: String(form.get("studentAdmissionNos") ?? "").split(",").map((value) => value.trim()).filter(Boolean), reviewStatus: form.get("reviewStatus"), reviewNote: form.get("reviewNote") })}>
    <label>Caption<textarea name="caption" rows={5} maxLength={2000} defaultValue={asset.caption ?? ""} disabled={!canReview} /></label>
    <label>People declaration<select name="peopleDeclaration" defaultValue={asset.peopleDeclaration} disabled={!canReview}><option value="UNKNOWN">Unknown — fail closed</option><option value="NO_STUDENTS">Reviewer confirms no Students visible</option><option value="MANUAL_ASSOCIATIONS_COMPLETE">Manual associations complete</option></select></label>
    <label>Student admission numbers <span>(comma-separated, internal only)</span><textarea name="studentAdmissionNos" rows={2} defaultValue={asset.studentAssociations.map((association) => association.student.admissionNo).join(", ")} disabled={!canReview} /></label>
    <div className="event-media-association-summary"><UsersRound aria-hidden /><span>{asset.studentAssociations.length} manual {asset.studentAssociations.length === 1 ? "association" : "associations"}</span><strong>{asset.publicationEligibility.replaceAll("_", " ")}</strong></div>
    <label>Review decision<select name="reviewStatus" defaultValue={asset.reviewStatus} disabled={!canReview}><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select></label>
    <label>Review note<textarea name="reviewNote" rows={2} maxLength={2000} defaultValue={asset.reviewNote ?? ""} disabled={!canReview} /></label>
    {canReview ? <button className="button" disabled={busy}>Save photo review</button> : null}
    <p className="event-media-review-footnote">Target audience: {audienceLabel(album.visibility)}. Internal Student identifiers are never exposed to Parent or public galleries.</p>
  </form>;
}

function ConsentPanel({ asset, audience, consents, canManage, busy, onRecord, onRevoke }: { asset: Asset; audience: string; consents: Consent[]; canManage: boolean; busy: boolean; onRecord: (payload: unknown) => Promise<void>; onRevoke: (key: string, reason: string) => Promise<void> }) {
  const rows = asset.studentAssociations.map((association) => ({ association, consent: consents.find((consent) => consent.studentId === association.studentId && consent.audience === audience && consent.status === "GRANTED" && (!consent.expiresAt || new Date(consent.expiresAt) > new Date())) }));
  return <section className="event-media-consent-panel"><h3>Publication consent</h3>{rows.length ? <ul>{rows.map(({ association, consent }) => <li key={association.studentId}><div><strong>{association.student.studentName}</strong><span>{association.student.className}{association.student.section ? ` ${association.student.section}` : ""} · internal association</span></div>{consent ? <><Status value="GRANTED" />{canManage ? <button type="button" disabled={busy} onClick={() => { const reason = window.prompt("Reason for revoking this publication consent"); if (reason) void onRevoke(consent.publicKey, reason); }}>Revoke</button> : null}</> : <Status value="UNKNOWN" />}</li>)}</ul> : <p>No Students are manually associated with this photo.</p>}
    {canManage && asset.studentAssociations.length && ["PARENT_PORTAL", "PUBLIC"].includes(audience) ? <details><summary>Record specific consent</summary><form action={async (form) => onRecord({ studentAdmissionNo: form.get("studentAdmissionNo"), audience, source: form.get("source"), wordingVersion: form.get("wordingVersion"), evidenceReference: form.get("evidenceReference"), grantedAt: form.get("grantedAt"), expiresAt: form.get("expiresAt") || null })}><label>Student<select name="studentAdmissionNo">{asset.studentAssociations.map((association) => <option key={association.studentId} value={association.student.admissionNo}>{association.student.studentName} · {association.student.admissionNo}</option>)}</select></label><p>Publication audience: <strong>{audienceLabel(audience)}</strong></p><label>Evidence source<select name="source"><option value="SIGNED_FORM">Signed form</option><option value="GUARDIAN_PORTAL">Guardian portal</option><option value="IN_PERSON_GUARDIAN">In-person Guardian</option><option value="OTHER_DOCUMENTED">Other documented evidence</option></select></label><label>Wording version<input name="wordingVersion" required minLength={3} maxLength={100} placeholder="MEDIA-CONSENT-V1" /></label><label>Evidence reference<input name="evidenceReference" required minLength={3} maxLength={240} placeholder="Form or governed record reference" /></label><label>Granted date<input name="grantedAt" type="date" required /></label><label>Expiry <span>(optional)</span><input name="expiresAt" type="date" /></label><button className="button" disabled={busy}>Record consent</button><p>WhatsApp, SMS and enrolment are not accepted consent sources.</p></form></details> : null}
  </section>;
}

function Workflow({ album }: { album: Album }) {
  const steps = [{ label: "Upload", active: album.assets.length > 0 }, { label: "Review", active: ["UNDER_REVIEW", "APPROVED", "PUBLISHED"].includes(album.status) }, { label: "Approve", active: ["APPROVED", "PUBLISHED"].includes(album.status) }, { label: "Publish", active: album.status === "PUBLISHED" }];
  return <div className="event-media-workflow" aria-label="Publication workflow">{steps.map((step, index) => <div key={step.label} className={step.active ? "active" : ""}><span>{step.active ? <Check aria-hidden /> : index + 1}</span><strong>{step.label}</strong>{index < steps.length - 1 ? <ChevronRight aria-hidden /> : null}</div>)}</div>;
}
function Status({ value }: { value: string }) { const tone = ["APPROVED", "PUBLISHED", "GRANTED", "READY", "ELIGIBLE"].includes(value) ? "good" : ["REJECTED", "FAILED", "WITHDRAWN", "REVOKED", "BLOCKED_CONSENT", "BLOCKED_PEOPLE_CONFLICT"].includes(value) ? "bad" : ["UNDER_REVIEW", "PENDING", "UNKNOWN", "BLOCKED_PEOPLE_UNKNOWN"].includes(value) ? "warn" : "neutral"; return <span className={`event-media-status ${tone}`}>{value.replaceAll("_", " ")}</span>; }
function audienceLabel(value: string) { return ({ PRIVATE_LEADERSHIP: "Private leadership", INTERNAL_AUTHORISED: "Internal authorised", PARENT_PORTAL: "Parent portal", PUBLIC: "Public" } as Record<string, string>)[value] ?? value; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(value)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value)); }
