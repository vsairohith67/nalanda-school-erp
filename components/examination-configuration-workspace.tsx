"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type ComponentRow = {
  id?: string;
  componentCode: string;
  name: string;
  componentKind: string;
  displayOrder: number;
  maximumMarks: string;
  contributionWeight: string | null;
  isRequired: boolean;
};

type SchemeVersion = {
  id: string;
  versionNumber: number;
  calculationMode: string;
  roundingPolicyVersion: string;
  status: string;
  version: number;
  frozenAt: string | null;
  components: ComponentRow[];
};

type SubjectPaper = {
  id: string;
  paperCode: string;
  paperName: string;
  subjectNameSnapshot: string;
  displayOrder: number;
  status: string;
};

type Assignment = {
  id: string;
  assignmentRole: string;
  assignmentReason: string;
  status: string;
  version: number;
  staffMember: { displayName: string | null; fullName: string };
  subjectPaper: { id: string; paperCode: string; paperName: string; subjectNameSnapshot: string };
  component: { id: string; componentCode: string; name: string };
  schemeVersion: { id: string; versionNumber: number; status: string };
};

type Scope = {
  id: string;
  className: string;
  section: string;
  status: string;
  timetableClassSection: { displayName: string };
  schemeVersions: SchemeVersion[];
  subjectPapers: SubjectPaper[];
  subjectGroups: Array<{
    id: string;
    groupCode: string;
    groupName: string;
    calculationMode: string;
    status: string;
    members: Array<{ id: string; contributionWeight: string | null; subjectPaper: { paperCode: string; paperName: string } }>;
  }>;
  gradeScaleVersions: Array<{
    id: string;
    name: string;
    scaleFamily: string;
    versionNumber: number;
    status: string;
    bands: Array<{ id: string; gradeCode: string; label: string; minimumPercentage: string; maximumPercentage: string }>;
  }>;
  coScholasticVersions: Array<{
    id: string;
    name: string;
    schemeFamily: string;
    versionNumber: number;
    status: string;
    ratingScaleJson: string;
    items: Array<{ id: string; label: string; itemCode: string }>;
  }>;
  templateBindings: Array<{
    id: string;
    templateFamily: string;
    versionNumber: number;
    status: string;
    evidenceStatus: string;
    reportCardTemplate: { templateCode: string; name: string } | null;
  }>;
  teacherAssignments: Assignment[];
};

type Examination = {
  id: string;
  examCode: string;
  academicYear: string;
  name: string;
  examType: string;
  status: string;
  version: number;
  classScopes: Scope[];
  schemeAudits: Array<{
    id: string;
    eventType: string;
    targetType: string;
    previousStatus: string | null;
    newStatus: string | null;
    reason: string | null;
    actorRole: string;
    eventDate: string;
  }>;
};

type Option = { id: string; label: string };

const emptyComponent = (displayOrder: number): ComponentRow => ({
  componentCode: "",
  name: "",
  componentKind: "",
  displayOrder,
  maximumMarks: "",
  contributionWeight: null,
  isRequired: true
});

export function ExaminationConfigurationWorkspace({
  examination,
  timetableSubjects,
  teachers,
  reportCardTemplates,
  canManage,
  canActivate,
  canAssign,
  requiresInterventionReason
}: {
  examination: Examination;
  timetableSubjects: Option[];
  teachers: Option[];
  reportCardTemplates: Option[];
  canManage: boolean;
  canActivate: boolean;
  canAssign: boolean;
  requiresInterventionReason: boolean;
}) {
  const router = useRouter();
  const [scopeId, setScopeId] = useState(examination.classScopes[0]?.id ?? "");
  const [components, setComponents] = useState<ComponentRow[]>([emptyComponent(1)]);
  const [calculationMode, setCalculationMode] = useState("");
  const [interventionReason, setInterventionReason] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const scope = examination.classScopes.find((item) => item.id === scopeId) ?? examination.classScopes[0];

  const draftSchemes = useMemo(
    () => scope?.schemeVersions.filter((scheme) => scheme.status === "DRAFT") ?? [],
    [scope]
  );
  const draftComponents = draftSchemes.flatMap((scheme) => scheme.components.map((component) => ({
    ...component,
    schemeId: scheme.id,
    schemeVersion: scheme.versionNumber
  })));

  async function mutate(path: string, payload: Record<string, unknown>, label: string, method = "POST") {
    setBusy(label);
    setMessage("");
    setError("");
    try {
      const response = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          ...(requiresInterventionReason ? { interventionReason } : {})
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to save examination configuration.");
      setMessage(label);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save examination configuration.");
    } finally {
      setBusy("");
    }
  }

  if (!scope) {
    return <div className="notice danger">No active class/section scope is configured.</div>;
  }

  const activePrimaryKeys = new Set(
    scope.teacherAssignments
      .filter((assignment) => assignment.status === "ACTIVE" && assignment.assignmentRole === "PRIMARY_SUBMITTER")
      .map((assignment) => `${assignment.subjectPaper.id}|${assignment.component.id}`)
  );
  const activationScheme = draftSchemes[0];
  const missingPrimary = activationScheme
    ? scope.subjectPapers.flatMap((paper) => activationScheme.components
        .filter((component) => !activePrimaryKeys.has(`${paper.id}|${component.id}`))
        .map((component) => `${paper.paperName} / ${component.name}`))
    : [];
  const readiness = [
    { label: "Draft numeric scheme", ready: Boolean(activationScheme) },
    { label: "Subject paper", ready: scope.subjectPapers.length > 0 },
    { label: "Grade scale version", ready: scope.gradeScaleVersions.some((row) => row.status === "DRAFT") },
    { label: "Co-scholastic version", ready: scope.coScholasticVersions.some((row) => row.status === "DRAFT") },
    { label: "Template family binding", ready: scope.templateBindings.some((row) => row.status === "DRAFT" && row.evidenceStatus === "DIRECTLY_EVIDENCED") },
    { label: "Exact primary ownership", ready: Boolean(activationScheme) && missingPrimary.length === 0 }
  ];

  return (
    <div className="exam-configuration-workspace">
      {requiresInterventionReason ? (
        <label className="card card-pad intervention-reason">
          Super Admin intervention audit reason
          <textarea
            required
            rows={3}
            maxLength={1_000}
            value={interventionReason}
            onChange={(event) => setInterventionReason(event.target.value)}
          />
        </label>
      ) : null}
      <section className="card card-pad configuration-scope-header">
        <label>
          Configure class and section
          <select value={scope.id} onChange={(event) => setScopeId(event.target.value)}>
            {examination.classScopes.map((item) => (
              <option key={item.id} value={item.id}>{item.timetableClassSection.displayName || `${item.className} ${item.section}`}</option>
            ))}
          </select>
        </label>
        <div className="configuration-readiness" aria-label="Activation readiness">
          {readiness.map((item) => (
            <span className={item.ready ? "ready" : "pending"} key={item.label}>
              {item.ready ? "Ready" : "Pending"}: {item.label}
            </span>
          ))}
        </div>
        {missingPrimary.length ? <p className="muted">Missing primary ownership: {missingPrimary.join(", ")}</p> : null}
      </section>

      {canManage ? (
        <>
          <section className="card card-pad">
            <h2>1. Versioned numeric scheme</h2>
            <p className="muted">Choose RAW_SUM or WEIGHTED_NORMALIZED explicitly. No maxima or historical weights are prefilled.</p>
            <div className="form-grid">
              <label>
                Calculation mode
                <select value={calculationMode} onChange={(event) => setCalculationMode(event.target.value)} required>
                  <option value="">Select mode</option>
                  <option value="RAW_SUM">RAW SUM</option>
                  <option value="WEIGHTED_NORMALIZED">WEIGHTED NORMALIZED</option>
                </select>
              </label>
              <div className="full table-wrap">
                <table>
                  <thead><tr><th>Code</th><th>Name</th><th>Kind</th><th>Maximum</th><th>Contribution %</th><th>Required</th><th>Remove</th></tr></thead>
                  <tbody>
                    {components.map((component, index) => (
                      <tr key={index}>
                        <td><input aria-label={`Component ${index + 1} code`} value={component.componentCode} onChange={(event) => setComponents((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, componentCode: event.target.value } : row))} /></td>
                        <td><input aria-label={`Component ${index + 1} name`} value={component.name} onChange={(event) => setComponents((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, name: event.target.value } : row))} /></td>
                        <td><select aria-label={`Component ${index + 1} kind`} value={component.componentKind} onChange={(event) => setComponents((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, componentKind: event.target.value } : row))}><option value="">Select</option>{["INTERNAL", "WRITTEN", "PRACTICAL", "ORAL", "PROJECT", "OTHER_APPROVED"].map((value) => <option key={value}>{value}</option>)}</select></td>
                        <td><input aria-label={`Component ${index + 1} maximum`} inputMode="decimal" value={component.maximumMarks} onChange={(event) => setComponents((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, maximumMarks: event.target.value } : row))} /></td>
                        <td><input aria-label={`Component ${index + 1} contribution`} inputMode="decimal" disabled={calculationMode !== "WEIGHTED_NORMALIZED"} value={component.contributionWeight ?? ""} onChange={(event) => setComponents((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, contributionWeight: event.target.value } : row))} /></td>
                        <td><input aria-label={`Component ${index + 1} required`} type="checkbox" checked={component.isRequired} onChange={(event) => setComponents((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, isRequired: event.target.checked } : row))} /></td>
                        <td><button type="button" className="button secondary" disabled={components.length === 1} onClick={() => setComponents((rows) => rows.filter((_, rowIndex) => rowIndex !== index).map((row, rowIndex) => ({ ...row, displayOrder: rowIndex + 1 })))}>Remove</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="full page-actions">
                <button type="button" className="button secondary" onClick={() => setComponents((rows) => [...rows, emptyComponent(rows.length + 1)])}>Add Component</button>
                <button
                  type="button"
                  disabled={busy !== "" || !calculationMode}
                  onClick={() => mutate(`/api/exam-configurations/${examination.id}/schemes`, { classScopeId: scope.id, calculationMode, components }, "Scheme version created")}
                >
                  Create Scheme Version
                </button>
              </div>
            </div>
            {scope.schemeVersions.length ? (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Version</th><th>Mode</th><th>Components</th><th>Status</th><th>Rounding</th><th>Clone</th></tr></thead>
                  <tbody>{scope.schemeVersions.map((scheme) => <tr key={scheme.id}><td>v{scheme.versionNumber}</td><td>{scheme.calculationMode}</td><td>{scheme.components.map((component) => `${component.name} / ${component.maximumMarks}${component.contributionWeight ? ` / ${component.contributionWeight}%` : ""}`).join(", ")}</td><td>{scheme.status}</td><td>{scheme.roundingPolicyVersion}</td><td><button type="button" className="button secondary" disabled={busy !== ""} onClick={() => mutate(`/api/exam-configurations/${examination.id}/schemes`, { classScopeId: scope.id, cloneSourceId: scheme.id }, `Scheme v${scheme.versionNumber} cloned`)}>Clone</button></td></tr>)}</tbody>
                </table>
              </div>
            ) : null}
          </section>

          <PaperForm examinationId={examination.id} scope={scope} timetableSubjects={timetableSubjects} busy={busy} mutate={mutate} />
          <SubjectGroupForm examinationId={examination.id} scope={scope} busy={busy} mutate={mutate} />
          <GradeScaleForm examinationId={examination.id} scope={scope} busy={busy} mutate={mutate} />
          <CoScholasticForm examinationId={examination.id} scope={scope} busy={busy} mutate={mutate} />
          <TemplateBindingForm examinationId={examination.id} scope={scope} reportCardTemplates={reportCardTemplates} busy={busy} mutate={mutate} />
        </>
      ) : null}

      {canAssign ? (
        <AssignmentForm
          examinationId={examination.id}
          scope={scope}
          teachers={teachers}
          draftComponents={draftComponents}
          busy={busy}
          mutate={mutate}
        />
      ) : null}

      <section className="card card-pad">
        <h2>Complete configuration preview</h2>
        <div className="grid two">
          <div>
            <h3>Class scope</h3>
            <p>{examination.academicYear} · {scope.className} · Section {scope.section || "Class-wide"}</p>
            <h3>Subject papers</h3>
            <ul>{scope.subjectPapers.map((paper) => <li key={paper.id}>{paper.paperCode}: {paper.paperName} ({paper.subjectNameSnapshot})</li>)}</ul>
            <h3>Subject groups</h3>
            <ul>{scope.subjectGroups.map((group) => <li key={group.id}>{group.groupName} · {group.calculationMode} · {group.members.map((member) => member.subjectPaper.paperName).join(", ")}</li>)}</ul>
          </div>
          <div>
            <h3>Grade scheme</h3>
            <ul>{scope.gradeScaleVersions.map((scale) => <li key={scale.id}>v{scale.versionNumber} {scale.name} · {scale.status} · {scale.bands.map((band) => `${band.gradeCode} ${band.minimumPercentage}-${band.maximumPercentage}`).join(", ")}</li>)}</ul>
            <h3>Co-scholastic scheme</h3>
            <ul>{scope.coScholasticVersions.map((scheme) => <li key={scheme.id}>v{scheme.versionNumber} {scheme.name} · {scheme.status} · {scheme.items.map((item) => item.label).join(", ")}</li>)}</ul>
            <h3>Template family</h3>
            <ul>{scope.templateBindings.map((binding) => <li key={binding.id}>v{binding.versionNumber} {binding.templateFamily} · {binding.evidenceStatus} · {binding.status}</li>)}</ul>
          </div>
        </div>
        <h3>Exact Teacher ownership</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Paper</th><th>Component</th><th>Teacher</th><th>Role</th><th>Status</th></tr></thead>
            <tbody>{scope.teacherAssignments.map((assignment) => <tr key={assignment.id}><td>{assignment.subjectPaper.paperName}</td><td>{assignment.component.name}</td><td>{assignment.staffMember.displayName ?? assignment.staffMember.fullName}</td><td>{assignment.assignmentRole.replaceAll("_", " ")}</td><td>{assignment.status}</td></tr>)}{!scope.teacherAssignments.length ? <tr><td colSpan={5}>No exact Teacher assignments recorded.</td></tr> : null}</tbody>
          </table>
        </div>
      </section>

      {canActivate && activationScheme ? (
        <section className="card card-pad">
          <h2>Activate and freeze scheme</h2>
          <form onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void mutate(`/api/exam-configurations/${examination.id}/workflow`, {
              action: "activate_scheme",
              schemeVersionId: form.get("schemeVersionId"),
              expectedVersion: Number(form.get("expectedVersion")),
              activationReason: form.get("activationReason")
            }, "Scheme activated and frozen");
          }} className="form-grid">
            <label>
              Draft scheme
              <select name="schemeVersionId" required>
                {draftSchemes.map((scheme) => <option value={scheme.id} key={scheme.id}>Version {scheme.versionNumber} · {scheme.calculationMode}</option>)}
              </select>
            </label>
            <input type="hidden" name="expectedVersion" value={activationScheme.version} />
            <label className="wide">
              Activation reason
              <input name="activationReason" required maxLength={1_000} />
            </label>
            <div className="full page-actions"><button disabled={busy !== "" || readiness.some((item) => !item.ready)} type="submit">Activate and Freeze</button></div>
          </form>
        </section>
      ) : null}

      {canManage && examination.status !== "ARCHIVED" ? (
        <section className="card card-pad">
          <h2>Archive examination</h2>
          <form className="form-grid" onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void mutate(`/api/exam-configurations/${examination.id}/workflow`, {
              action: "archive_examination",
              expectedVersion: examination.version,
              archiveReason: form.get("archiveReason")
            }, "Examination archived");
          }}>
            <label className="wide">Archive reason<input name="archiveReason" required maxLength={1_000} /></label>
            <div className="full page-actions"><button className="button danger" disabled={busy !== ""} type="submit">Archive Without Deleting History</button></div>
          </form>
        </section>
      ) : null}

      <section className="card card-pad">
        <h2>Append-only configuration audit</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Event</th><th>Target</th><th>Status</th><th>Actor role</th><th>Reason</th></tr></thead>
            <tbody>{examination.schemeAudits.map((audit) => <tr key={audit.id}><td>{new Date(audit.eventDate).toLocaleString("en-IN")}</td><td>{audit.eventType.replaceAll("_", " ")}</td><td>{audit.targetType.replaceAll("_", " ")}</td><td>{audit.previousStatus ?? "—"} → {audit.newStatus ?? "—"}</td><td>{audit.actorRole.replaceAll("_", " ")}</td><td>{audit.reason ?? "—"}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
      {message ? <div className="notice success" role="status">{message}</div> : null}
      {error ? <div className="notice danger" role="alert">{error}</div> : null}
    </div>
  );
}

type Mutate = (path: string, payload: Record<string, unknown>, label: string, method?: string) => Promise<void>;

function PaperForm({ examinationId, scope, timetableSubjects, busy, mutate }: { examinationId: string; scope: Scope; timetableSubjects: Option[]; busy: string; mutate: Mutate }) {
  return <section className="card card-pad"><h2>2. Subject papers</h2><form className="form-grid" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void mutate(`/api/exam-configurations/${examinationId}/papers`, { classScopeId: scope.id, timetableSubjectId: form.get("timetableSubjectId"), paperCode: form.get("paperCode"), paperName: form.get("paperName"), displayOrder: Number(form.get("displayOrder")) }, "Subject paper created"); }}><label>Timetable subject<select name="timetableSubjectId" required defaultValue=""><option value="" disabled>Select subject</option>{timetableSubjects.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label><label>Paper code<input name="paperCode" required maxLength={40} /></label><label>Paper name<input name="paperName" required maxLength={120} /></label><label>Display order<input name="displayOrder" required type="number" min={1} max={500} /></label><div className="full page-actions"><button disabled={busy !== ""} type="submit">Add Subject Paper</button></div></form></section>;
}

function SubjectGroupForm({ examinationId, scope, busy, mutate }: { examinationId: string; scope: Scope; busy: string; mutate: Mutate }) {
  return <section className="card card-pad"><h2>3. Subject groups (optional)</h2><form className="form-grid" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const members = scope.subjectPapers.filter((paper) => form.get(`paper_${paper.id}`) === "on").map((paper) => ({ subjectPaperId: paper.id, contributionWeight: form.get(`weight_${paper.id}`) || null })); void mutate(`/api/exam-configurations/${examinationId}/groups`, { classScopeId: scope.id, groupCode: form.get("groupCode"), groupName: form.get("groupName"), calculationMode: form.get("calculationMode"), displayOrder: Number(form.get("displayOrder")), members }, "Subject group created"); }}><label>Group code<input name="groupCode" required maxLength={40} /></label><label>Group name<input name="groupName" required maxLength={120} /></label><label>Calculation mode<select name="calculationMode" required defaultValue=""><option value="" disabled>Select mode</option><option>RAW_SUM</option><option>WEIGHTED_NORMALIZED</option></select></label><label>Display order<input name="displayOrder" required type="number" min={1} max={500} /></label><fieldset className="full"><legend>Group papers and optional weighted contribution</legend>{scope.subjectPapers.map((paper) => <div className="group-member-row" key={paper.id}><label className="check-row"><input type="checkbox" name={`paper_${paper.id}`} />{paper.paperName}</label><label>Weight %<input name={`weight_${paper.id}`} inputMode="decimal" /></label></div>)}</fieldset><div className="full page-actions"><button disabled={busy !== "" || scope.subjectPapers.length < 2} type="submit">Add Subject Group</button></div></form></section>;
}

function GradeScaleForm({ examinationId, scope, busy, mutate }: { examinationId: string; scope: Scope; busy: string; mutate: Mutate }) {
  return <section className="card card-pad"><h2>4. Grade scale version</h2><form className="form-grid" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const bands = String(form.get("bands") ?? "").split(/\r?\n/).filter(Boolean).map((line, index) => { const [gradeCode, label, minimumPercentage, maximumPercentage] = line.split("|").map((value) => value.trim()); return { gradeCode, label, minimumPercentage, maximumPercentage, displayOrder: index + 1 }; }); void mutate(`/api/exam-configurations/${examinationId}/grade-scales`, { classScopeId: scope.id, name: form.get("name"), scaleFamily: form.get("scaleFamily"), bands }, "Grade scale version created"); }}><label>Name<input name="name" required maxLength={120} /></label><label>Scale family<select name="scaleFamily" required defaultValue=""><option value="" disabled>Select family</option><option>KG</option><option>PRIMARY_I_V</option><option>SECONDARY_VI_X</option></select></label><label className="full">Bands, one per line: code | label | minimum | maximum<textarea name="bands" required rows={5} placeholder="A | Outstanding | 90 | 100" /></label><div className="full page-actions"><button disabled={busy !== ""} type="submit">Create Grade Scale Version</button></div></form></section>;
}

function CoScholasticForm({ examinationId, scope, busy, mutate }: { examinationId: string; scope: Scope; busy: string; mutate: Mutate }) {
  return <section className="card card-pad"><h2>5. Co-scholastic scheme version</h2><form className="form-grid" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void mutate(`/api/exam-configurations/${examinationId}/co-scholastic`, { classScopeId: scope.id, name: form.get("name"), schemeFamily: form.get("schemeFamily"), ratingScale: String(form.get("ratingScale") ?? "").split(",").map((value) => value.trim()).filter(Boolean), items: String(form.get("items") ?? "").split(/\r?\n/).map((value) => value.trim()).filter(Boolean) }, "Co-scholastic version created"); }}><label>Name<input name="name" required maxLength={120} /></label><label>Scheme family<select name="schemeFamily" required defaultValue=""><option value="" disabled>Select family</option><option>KG_DEVELOPMENTAL</option><option>PRIMARY_SKILLS</option><option>SECONDARY_PERSONALITY</option></select></label><label className="full">Rating scale, comma separated<input name="ratingScale" required placeholder="G, S, N" /></label><label className="full">Ordered items, one per line<textarea name="items" required rows={5} /></label><div className="full page-actions"><button disabled={busy !== ""} type="submit">Create Co-scholastic Version</button></div></form></section>;
}

function TemplateBindingForm({ examinationId, scope, reportCardTemplates, busy, mutate }: { examinationId: string; scope: Scope; reportCardTemplates: Option[]; busy: string; mutate: Mutate }) {
  return <section className="card card-pad"><h2>6. Report-template family</h2><form className="form-grid" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void mutate(`/api/exam-configurations/${examinationId}/template-bindings`, { classScopeId: scope.id, templateFamily: form.get("templateFamily"), reportCardTemplateId: form.get("reportCardTemplateId") || null }, "Template family version created"); }}><label>Approved family<select name="templateFamily" required defaultValue=""><option value="" disabled>Select family</option>{["KG_DEVELOPMENTAL_BOOKLET", "PRIMARY_10_40_SKILLS", "SECONDARY_10_40_GROUPED", "RETAINED_MULTI_EXAM_I_X"].map((value) => <option key={value}>{value}</option>)}</select></label><label>Existing report-card template (optional)<select name="reportCardTemplateId" defaultValue=""><option value="">No legacy template link</option>{reportCardTemplates.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label><div className="full notice">Family names preserve evidence provenance; they do not seed 10+40 or any other universal maxima.</div><div className="full page-actions"><button disabled={busy !== ""} type="submit">Create Template Binding Version</button></div></form></section>;
}

function AssignmentForm({ examinationId, scope, teachers, draftComponents, busy, mutate }: { examinationId: string; scope: Scope; teachers: Option[]; draftComponents: Array<ComponentRow & { schemeId: string; schemeVersion: number }>; busy: string; mutate: Mutate }) {
  return <section className="card card-pad"><h2>7. Exact Teacher assignment</h2><p className="muted">The server requires an active StaffMember, active timetable Teacher, and exact timetable assignment for this year, class, section, and subject.</p><form className="form-grid" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void mutate(`/api/exam-configurations/${examinationId}/assignments`, { classScopeId: scope.id, subjectPaperId: form.get("subjectPaperId"), componentId: form.get("componentId"), staffMemberId: form.get("staffMemberId"), assignmentRole: form.get("assignmentRole"), assignmentReason: form.get("assignmentReason") }, "Exact Teacher assignment created"); }}><label>Subject paper<select name="subjectPaperId" required defaultValue=""><option value="" disabled>Select paper</option>{scope.subjectPapers.map((paper) => <option value={paper.id} key={paper.id}>{paper.paperName}</option>)}</select></label><label>Draft scheme component<select name="componentId" required defaultValue=""><option value="" disabled>Select component</option>{draftComponents.map((component) => <option value={component.id} key={component.id}>v{component.schemeVersion} · {component.name}</option>)}</select></label><label>Teacher Staff link<select name="staffMemberId" required defaultValue=""><option value="" disabled>Select Teacher</option>{teachers.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label><label>Ownership role<select name="assignmentRole" required defaultValue=""><option value="" disabled>Select role</option><option>PRIMARY_SUBMITTER</option><option>CONTRIBUTOR</option></select></label><label className="full">Assignment reason<input name="assignmentReason" required maxLength={1_000} /></label><div className="full page-actions"><button disabled={busy !== "" || !scope.subjectPapers.length || !draftComponents.length || !teachers.length} type="submit">Assign Exact Ownership</button></div></form></section>;
}
