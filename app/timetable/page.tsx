import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { PageHeader, StatCard } from "@/components/ui";
import { TimetableNav } from "@/components/timetable-nav";
import { teacherWeeklyLoads, validateTimetableFoundation } from "@/lib/timetable";

export default async function TimetablePage() {
  await requirePermission("VIEW_TIMETABLE");
  const [teachers, subjects, classes, assignments, fixedPeriods, unavailability] = await Promise.all([
    prisma.timetableTeacher.findMany(),
    prisma.timetableSubject.findMany(),
    prisma.timetableClassSection.findMany(),
    prisma.timetableAssignment.findMany(),
    prisma.timetableFixedPeriod.findMany(),
    prisma.timetableTeacherUnavailability.findMany()
  ]);
  const warnings = validateTimetableFoundation({ teachers, subjects, classSections: classes, assignments, fixedPeriods, unavailability });
  const overloads = warnings.filter((row) => row.code === "TEACHER_OVERLOAD").length;
  const missing = warnings.filter((row) => ["ASSIGNMENT_MISSING_DATA", "MISSING_WORKLOAD", "CLASS_WITHOUT_WORKLOAD"].includes(row.code)).length;
  const loads = teacherWeeklyLoads(assignments);
  return <div className="page">
    <PageHeader title="Timetable Foundation" description="Prepare clean teachers, subjects, class sections, workload, and scheduling rules before automatic generation." />
    <TimetableNav />
    <div className="grid stats">
      <StatCard label="Teachers" value={String(teachers.length)} /><StatCard label="Subjects" value={String(subjects.length)} />
      <StatCard label="Class Sections" value={String(classes.length)} /><StatCard label="Assignments" value={String(assignments.length)} />
    </div>
    <div className="grid two">
      <section className="card card-pad"><h3>Data Readiness</h3><p><span className={`badge ${missing ? "danger" : "success"}`}>{missing} missing workload warnings</span> <span className={`badge ${overloads ? "danger" : "success"}`}>{overloads} teacher overload warnings</span></p><p className="muted-text">Resolve foundation warnings before using the automatic generator, then review every generated draft manually.</p></section>
      <section className="card card-pad"><h3>Teacher Load</h3>{teachers.length ? teachers.map((teacher) => <div className="load-row" key={teacher.id}><span>{teacher.name}</span><strong>{loads.get(teacher.id) ?? 0} / {teacher.maxPeriodsPerWeek}</strong></div>) : <p className="muted-text">Add teachers to begin tracking weekly load and free-period capacity.</p>}</section>
    </div>
    <section className="card card-pad">
      <h3>Principal Setup Steps</h3>
      <ol className="setup-steps">
        <li><Link href="/timetable/teachers">Add teachers</Link></li><li><Link href="/timetable/subjects">Add subjects</Link></li>
        <li><Link href="/timetable/classes">Review classes and sections</Link></li><li><Link href="/timetable/assignments">Assign teacher + subject + weekly periods</Link></li>
        <li><Link href="/timetable/settings">Add unavailable and fixed periods</Link></li><li><Link href="/timetable/builder">Build and check a manual timetable draft</Link></li>
        <li><Link href="/timetable/generate">Generate a new timetable draft</Link></li><li><Link href="/timetable/print">Print or export the reviewed timetable</Link></li>
      </ol>
    </section>
    {warnings.length ? <section className="card card-pad"><h3>Current Warnings</h3><div className="warning-list">{warnings.slice(0, 12).map((warning, index) => <div className={`notice ${warning.severity === "error" ? "notice-danger" : ""}`} key={`${warning.code}-${index}`}>{warning.message}</div>)}</div></section> : null}
  </div>;
}
