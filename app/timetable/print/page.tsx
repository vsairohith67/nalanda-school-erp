import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { TimetableNav } from "@/components/timetable-nav";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";
import { loadTimetablePrintSource } from "@/lib/timetable-print-data";
import {
  activeDraftDefault,
  calculateFreePeriodSummary,
  calculateWorkloadSummary,
  shapeClassTimetable,
  shapeTeacherTimetable,
  TIMETABLE_PRINT_PERMISSION,
  type ClassPrintData,
  type TimetablePrintSource
} from "@/lib/timetable-print";
import { TIMETABLE_DAYS } from "@/lib/timetable";

type SearchParams = {
  academicYear?: string;
  draftId?: string;
  view?: string;
  classSectionId?: string;
  teacherId?: string;
};

export default async function TimetablePrintPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePermission(TIMETABLE_PRINT_PERMISSION);
  const query = await searchParams;
  const [settings, drafts] = await Promise.all([
    getSchoolSettings(prisma),
    prisma.timetableDraft.findMany({
      select: { id: true, academicYear: true, name: true, status: true },
      orderBy: [{ academicYear: "desc" }, { updatedAt: "desc" }]
    })
  ]);
  const academicYears = [...new Set([settings.academicYear, ...drafts.map((row) => row.academicYear)])];
  const academicYear = academicYears.includes(query.academicYear ?? "")
    ? query.academicYear as string
    : settings.academicYear;
  const yearDrafts = drafts.filter((row) => row.academicYear === academicYear);
  const activeDraftId = activeDraftDefault(drafts, academicYear);
  const requestedDraft = query.draftId && yearDrafts.some((row) => row.id === query.draftId)
    ? query.draftId
    : "";
  const selectedDraftId = requestedDraft || (!query.draftId ? activeDraftId : "");
  const source = selectedDraftId ? await loadTimetablePrintSource(prisma, selectedDraftId) : null;
  const classSections = source?.classSections.filter((row) => row.isActive) ?? [];
  const teachers = source?.teachers.filter((row) => row.isActive) ?? [];
  const view = normalizeView(query.view);
  const printDate = new Date().toLocaleString("en-IN");

  return <div className="page timetable-print-center">
    <div className="no-print">
      <PageHeader
        title="Timetable Print & Export"
        description="Print or export class-wise and teacher-wise timetables from a saved draft."
      />
      <TimetableNav />
      <section className="card card-pad timetable-print-controls">
        <form method="get" action="/timetable/print" className="print-selection-form">
          <label>Academic Year
            <select name="academicYear" defaultValue={academicYear}>
              {academicYears.map((year) => <option value={year} key={year}>{year}</option>)}
            </select>
          </label>
          <label>Timetable Draft
            <select name="draftId" defaultValue={selectedDraftId}>
              <option value="">Choose a draft</option>
              {yearDrafts.map((draft) => <option value={draft.id} key={draft.id}>
                {draft.name} - {draft.status}{draft.status === "ACTIVE" ? " (Active Draft)" : ""}
              </option>)}
            </select>
          </label>
          <label>Print Type
            <select name="view" defaultValue={view}>
              <option value="classes">All class-wise timetables</option>
              <option value="class">One class timetable</option>
              <option value="teachers">All teacher-wise timetables</option>
              <option value="teacher">One teacher timetable</option>
              <option value="workload">Workload summary</option>
              <option value="free">Free-period summary</option>
            </select>
          </label>
          <label>Class Section
            <select name="classSectionId" defaultValue={query.classSectionId ?? classSections[0]?.id ?? ""}>
              <option value="">Choose a class</option>
              {classSections.map((row) => <option value={row.id} key={row.id}>{row.displayName}</option>)}
            </select>
          </label>
          <label>Teacher
            <select name="teacherId" defaultValue={query.teacherId ?? teachers[0]?.id ?? ""}>
              <option value="">Choose a teacher</option>
              {teachers.map((row) => <option value={row.id} key={row.id}>{row.name}</option>)}
            </select>
          </label>
          <button type="submit">Open Print View</button>
        </form>
        {!activeDraftId
          ? <div className="notice notice-warning">No active timetable selected. Choose a draft to print.</div>
          : <div className="notice"><strong>Active Draft:</strong> {yearDrafts.find((row) => row.id === activeDraftId)?.name}</div>}
        {source ? <div className="page-actions timetable-export-actions">
          <PrintButton />
          <ExportLink type="class" draftId={source.draft.id} label="Export Class Timetable CSV" classSectionId={view === "class" ? query.classSectionId : undefined} />
          <ExportLink type="teacher" draftId={source.draft.id} label="Export Teacher Timetable CSV" teacherId={view === "teacher" ? query.teacherId : undefined} />
          <ExportLink type="workload" draftId={source.draft.id} label="Export Workload CSV" />
          <ExportLink type="free" draftId={source.draft.id} label="Export Free Period CSV" />
        </div> : null}
      </section>
    </div>

    {!source ? <div className="empty-state card no-print">Choose a saved draft to open a print or export view.</div> : (
      <PrintView
        source={source}
        settings={settings}
        view={view}
        classSectionId={query.classSectionId}
        teacherId={query.teacherId}
        printDate={printDate}
      />
    )}
  </div>;
}

function PrintView({ source, settings, view, classSectionId, teacherId, printDate }: {
  source: TimetablePrintSource;
  settings: Awaited<ReturnType<typeof getSchoolSettings>>;
  view: string;
  classSectionId?: string;
  teacherId?: string;
  printDate: string;
}) {
  if (view === "class") {
    const data = classSectionId ? shapeClassTimetable(source, classSectionId) : null;
    if (!data) return <div className="notice notice-warning no-print">Choose a class section for the one-class print view.</div>;
    return <ClassDocument data={data} source={source} settings={settings} printDate={printDate} />;
  }
  if (view === "teacher") {
    const data = teacherId ? shapeTeacherTimetable(source, teacherId) : null;
    if (!data) return <div className="notice notice-warning no-print">Choose a teacher for the one-teacher print view.</div>;
    return <TeacherDocument data={data} source={source} settings={settings} printDate={printDate} />;
  }
  if (view === "teachers") {
    return <div className="timetable-print-stack">{source.teachers.filter((row) => row.isActive).map((teacher) => {
      const data = shapeTeacherTimetable(source, teacher.id);
      return data ? <TeacherDocument data={data} source={source} settings={settings} printDate={printDate} key={teacher.id} /> : null;
    })}</div>;
  }
  if (view === "workload") {
    const rows = calculateWorkloadSummary(source);
    return <article className="print-document timetable-print-document">
      <DocumentHeader title="Workload Summary" source={source} settings={settings} printDate={printDate} />
      <div className="table-wrap timetable-print-table-wrap"><table className="timetable-print-table">
        <thead><tr><th>Teacher</th><th>Department</th><th>Maximum</th><th>Assigned</th><th>Remaining</th>{TIMETABLE_DAYS.map((day) => <th key={day}>{shortDay(day)}</th>)}<th>Status</th></tr></thead>
        <tbody>{rows.map((row) => <tr className={row.overloaded ? "timetable-overload-row" : ""} key={row.teacherId}>
          <td><strong>{row.teacher}</strong><br /><small>{row.shortName}</small></td><td>{row.department}</td>
          <td>{row.maxPeriodsPerWeek}</td><td>{row.assignedPeriods}</td><td>{row.remainingCapacity}</td>
          {TIMETABLE_DAYS.map((day) => <td key={day}>{row.dayLoads[day]}</td>)}
          <td>{row.overloaded ? <strong className="print-danger">OVERLOAD</strong> : "Within limit"}</td>
        </tr>)}</tbody>
      </table></div>
    </article>;
  }
  if (view === "free") {
    const rows = calculateFreePeriodSummary(source);
    return <article className="print-document timetable-print-document">
      <DocumentHeader title="Free Period Summary" source={source} settings={settings} printDate={printDate} />
      <div className="table-wrap timetable-print-table-wrap"><table className="timetable-print-table">
        <thead><tr><th>Teacher</th><th>Department</th><th>Day</th><th>Free Periods</th><th>Day Total</th><th>Weekly Total</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={`${row.teacherId}-${row.dayOfWeek}`}>
          <td><strong>{row.teacher}</strong><br /><small>{row.shortName}</small></td><td>{row.department}</td><td>{row.dayLabel}</td>
          <td>{row.freePeriods.length ? row.freePeriods.map((period) => `P${period}`).join(", ") : "None"}</td>
          <td>{row.freePeriods.length}</td><td>{row.totalFreePeriods}</td>
        </tr>)}</tbody>
      </table></div>
    </article>;
  }

  return <div className="timetable-print-stack">{source.classSections.filter((row) => row.isActive).map((classSection) => {
    const data = shapeClassTimetable(source, classSection.id);
    return data ? <ClassDocument data={data} source={source} settings={settings} printDate={printDate} key={classSection.id} /> : null;
  })}</div>;
}

function ClassDocument({ data, source, settings, printDate }: {
  data: ClassPrintData;
  source: TimetablePrintSource;
  settings: Awaited<ReturnType<typeof getSchoolSettings>>;
  printDate: string;
}) {
  const periods = data.days[0]?.cells.map((cell) => cell.periodNumber) ?? [];
  return <article className="print-document timetable-print-document timetable-page-break">
    <DocumentHeader title={`Class-wise Timetable - ${data.classSection}`} source={source} settings={settings} printDate={printDate} />
    <div className="print-meta-line">
      <span><strong>Class and Section:</strong> {data.classSection}</span>
      <span><strong>Group:</strong> {data.groupName}</span>
    </div>
    <div className="table-wrap timetable-print-table-wrap"><table className="timetable-print-table class-print-grid">
      <thead><tr><th>Day</th>{periods.map((period) => <th key={period}>Period {period}</th>)}</tr></thead>
      <tbody>{data.days.map((day) => <tr key={day.dayOfWeek}>
        <th>{day.dayLabel}{day.scheduleLabels.length ? <small className="print-schedule-labels">{day.scheduleLabels.join(" | ")}</small> : null}</th>
        {day.cells.map((cell) => <td className={!cell.isOpen ? "print-closed-cell" : cell.entryType === "FREE" || cell.entryType === "EMPTY" ? "print-free-cell" : ""} key={cell.periodNumber}>
          {cell.isOpen ? <>
            <small>{cell.periodLabel}<br />{cell.timing}</small>
            <strong>{cell.subject || cell.label}</strong>
            {cell.teacher ? <span>{cell.teacher}</span> : null}
            {!["TEACHING", "EMPTY"].includes(cell.entryType) ? <em>{cell.entryType}</em> : null}
          </> : <span>-</span>}
        </td>)}
      </tr>)}</tbody>
    </table></div>
  </article>;
}

function TeacherDocument({ data, source, settings, printDate }: {
  data: NonNullable<ReturnType<typeof shapeTeacherTimetable>>;
  source: TimetablePrintSource;
  settings: Awaited<ReturnType<typeof getSchoolSettings>>;
  printDate: string;
}) {
  const periods = data.days[0]?.cells.map((cell) => cell.periodNumber) ?? [];
  return <article className="print-document timetable-print-document timetable-page-break">
    <DocumentHeader title={`Teacher-wise Timetable - ${data.teacher}`} source={source} settings={settings} printDate={printDate} />
    <div className="print-meta-line">
      <span><strong>Teacher:</strong> {data.teacher} ({data.shortName})</span>
      <span><strong>Department:</strong> {data.department}</span>
      <span><strong>Total periods per week:</strong> {data.totalPeriods}</span>
    </div>
    <div className="table-wrap timetable-print-table-wrap"><table className="timetable-print-table teacher-print-grid">
      <thead><tr><th>Day</th>{periods.map((period) => <th key={period}>Period {period}</th>)}<th>Day Load</th></tr></thead>
      <tbody>{data.days.map((day) => <tr key={day.dayOfWeek}>
        <th>{day.dayLabel}</th>
        {day.cells.map((cell) => <td className={cell.isFree ? "print-free-cell" : !cell.isOpen ? "print-closed-cell" : ""} key={cell.periodNumber}>
          {!cell.isOpen ? "-" : cell.isFree ? <strong>Free</strong> : <>
            <strong>{cell.classSection}</strong><span>{cell.subject || cell.label}</span>
            {!["TEACHING", "EMPTY"].includes(cell.entryType) ? <em>{cell.entryType}</em> : null}
          </>}
        </td>)}
        <td><strong>{data.dayLoads[day.dayOfWeek]}</strong></td>
      </tr>)}</tbody>
    </table></div>
  </article>;
}

function DocumentHeader({ title, source, settings, printDate }: {
  title: string;
  source: TimetablePrintSource;
  settings: Awaited<ReturnType<typeof getSchoolSettings>>;
  printDate: string;
}) {
  return <header className="timetable-print-header">
    <div><h1>{settings.schoolName}</h1><p>{title}</p></div>
    <div className="timetable-print-meta">
      <span><strong>Academic Year:</strong> {source.draft.academicYear}</span>
      <span><strong>Draft:</strong> {source.draft.name}</span>
      <span><strong>Status:</strong> <b>{source.draft.status}</b></span>
      <span><strong>Print Date:</strong> {printDate}</span>
    </div>
  </header>;
}

function ExportLink({ type, draftId, label, classSectionId, teacherId }: {
  type: string;
  draftId: string;
  label: string;
  classSectionId?: string;
  teacherId?: string;
}) {
  const params = new URLSearchParams({ draftId });
  if (classSectionId) params.set("classSectionId", classSectionId);
  if (teacherId) params.set("teacherId", teacherId);
  return <Link className="button secondary" href={`/api/timetable/export/${type}?${params.toString()}`}>{label}</Link>;
}

function normalizeView(value?: string) {
  return ["classes", "class", "teachers", "teacher", "workload", "free"].includes(value ?? "")
    ? value as string
    : "classes";
}

function shortDay(day: string) {
  return day.slice(0, 3).charAt(0) + day.slice(1, 3).toLowerCase();
}
