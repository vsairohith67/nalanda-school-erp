import { toCsv } from "@/lib/format";
import { can, type Permission, type Role } from "@/lib/permissions";
import { TIMETABLE_DAYS } from "@/lib/timetable";

export const TIMETABLE_PRINT_PERMISSION: Permission = "PRINT_TIMETABLE";

export type PrintDraft = {
  id: string;
  academicYear: string;
  name: string;
  status: string;
};

export type PrintTeacher = {
  id: string;
  name: string;
  shortName: string;
  department: string | null;
  isActive: boolean;
  maxPeriodsPerWeek: number;
};

export type PrintSubject = {
  id: string;
  name: string;
  shortName: string;
};

export type PrintClassSection = {
  id: string;
  academicYear: string;
  displayName: string;
  groupName: string;
  isActive: boolean;
};

export type PrintTemplate = {
  academicYear: string;
  groupName: string;
  dayOfWeek: string;
  periodNumber: number | null;
  label: string;
  startTime: string;
  endTime: string;
  type: string;
  isTeachingPeriod: boolean;
  sortOrder: number;
};

export type PrintEntry = {
  id?: string;
  classSectionId: string;
  dayOfWeek: string;
  periodNumber: number;
  teacherId: string | null;
  subjectId: string | null;
  label: string | null;
  entryType: string;
  isLocked: boolean;
};

export type TimetablePrintSource = {
  draft: PrintDraft;
  teachers: PrintTeacher[];
  subjects: PrintSubject[];
  classSections: PrintClassSection[];
  templates: PrintTemplate[];
  entries: PrintEntry[];
};

export type ClassPrintCell = {
  periodNumber: number;
  periodLabel: string;
  timing: string;
  entryType: string;
  subject: string;
  teacher: string;
  label: string;
  isLocked: boolean;
  isOpen: boolean;
};

export type ClassPrintData = {
  classSectionId: string;
  classSection: string;
  groupName: string;
  days: Array<{
    dayOfWeek: string;
    dayLabel: string;
    scheduleLabels: string[];
    cells: ClassPrintCell[];
  }>;
};

export type TeacherPrintCell = {
  periodNumber: number;
  classSection: string;
  subject: string;
  label: string;
  entryType: string;
  isFree: boolean;
  isOpen: boolean;
};

export type TeacherPrintData = {
  teacherId: string;
  teacher: string;
  shortName: string;
  department: string;
  totalPeriods: number;
  dayLoads: Record<string, number>;
  days: Array<{
    dayOfWeek: string;
    dayLabel: string;
    cells: TeacherPrintCell[];
  }>;
};

export type WorkloadSummaryRow = {
  teacherId: string;
  teacher: string;
  shortName: string;
  department: string;
  maxPeriodsPerWeek: number;
  assignedPeriods: number;
  remainingCapacity: number;
  overloaded: boolean;
  dayLoads: Record<string, number>;
};

export type FreePeriodSummaryRow = {
  teacherId: string;
  teacher: string;
  shortName: string;
  department: string;
  dayOfWeek: string;
  dayLabel: string;
  freePeriods: number[];
  totalFreePeriods: number;
};

export function canPrintTimetable(role: Role) {
  return can(role, TIMETABLE_PRINT_PERMISSION);
}

export function activeDraftDefault(drafts: PrintDraft[], academicYear: string) {
  return drafts.find((draft) => draft.academicYear === academicYear && draft.status === "ACTIVE")?.id ?? "";
}

export function shapeClassTimetable(source: TimetablePrintSource, classSectionId: string): ClassPrintData | null {
  const classSection = source.classSections.find((row) => row.id === classSectionId);
  if (!classSection) return null;
  const teacherMap = new Map(source.teachers.map((row) => [row.id, row]));
  const subjectMap = new Map(source.subjects.map((row) => [row.id, row]));
  const periodNumbers = classPeriodNumbers(source.templates, classSection);

  return {
    classSectionId: classSection.id,
    classSection: classSection.displayName,
    groupName: classSection.groupName,
    days: TIMETABLE_DAYS.map((dayOfWeek) => {
      const templates = templatesForClassDay(source.templates, classSection, dayOfWeek);
      const teaching = new Map(
        templates.filter((row) => row.isTeachingPeriod && row.periodNumber !== null)
          .map((row) => [row.periodNumber as number, row])
      );
      const entries = new Map(
        source.entries.filter((row) => row.classSectionId === classSection.id && row.dayOfWeek === dayOfWeek)
          .map((row) => [row.periodNumber, row])
      );
      return {
        dayOfWeek,
        dayLabel: titleDay(dayOfWeek),
        scheduleLabels: templates.filter((row) => !row.isTeachingPeriod).map((row) => `${row.label} ${row.startTime}-${row.endTime}`),
        cells: periodNumbers.map((periodNumber) => {
          const template = teaching.get(periodNumber);
          const entry = entries.get(periodNumber);
          return {
            periodNumber,
            periodLabel: template?.label ?? `Period ${periodNumber}`,
            timing: template ? `${template.startTime}-${template.endTime}` : "",
            entryType: entry?.entryType ?? "EMPTY",
            subject: entry?.subjectId ? subjectMap.get(entry.subjectId)?.name ?? "" : "",
            teacher: entry?.teacherId
              ? teacherMap.get(entry.teacherId)?.shortName || teacherMap.get(entry.teacherId)?.name || ""
              : "",
            label: entry?.label ?? entryTypeLabel(entry?.entryType ?? "EMPTY"),
            isLocked: Boolean(entry?.isLocked),
            isOpen: Boolean(template)
          };
        })
      };
    })
  };
}

export function shapeTeacherTimetable(source: TimetablePrintSource, teacherId: string): TeacherPrintData | null {
  const teacher = source.teachers.find((row) => row.id === teacherId);
  if (!teacher) return null;
  const classMap = new Map(source.classSections.map((row) => [row.id, row]));
  const subjectMap = new Map(source.subjects.map((row) => [row.id, row]));
  const slots = schoolTeachingSlots(source.templates, source.classSections, source.draft.academicYear);
  const periodNumbers = [...new Set([...slots.values()].flatMap((row) => [...row]))].sort((a, b) => a - b);
  const teacherEntries = source.entries.filter((row) => row.teacherId === teacherId && isAssignedEntry(row));
  const dayLoads = Object.fromEntries(TIMETABLE_DAYS.map((day) => [
    day,
    teacherEntries.filter((row) => row.dayOfWeek === day).length
  ]));

  return {
    teacherId: teacher.id,
    teacher: teacher.name,
    shortName: teacher.shortName,
    department: teacher.department ?? "-",
    totalPeriods: teacherEntries.length,
    dayLoads,
    days: TIMETABLE_DAYS.map((dayOfWeek) => {
      const openPeriods = slots.get(dayOfWeek) ?? new Set<number>();
      const entries = new Map(
        teacherEntries.filter((row) => row.dayOfWeek === dayOfWeek).map((row) => [row.periodNumber, row])
      );
      return {
        dayOfWeek,
        dayLabel: titleDay(dayOfWeek),
        cells: periodNumbers.map((periodNumber) => {
          const entry = entries.get(periodNumber);
          const isOpen = openPeriods.has(periodNumber);
          return {
            periodNumber,
            classSection: entry ? classMap.get(entry.classSectionId)?.displayName ?? "" : "",
            subject: entry?.subjectId ? subjectMap.get(entry.subjectId)?.name ?? "" : "",
            label: entry?.label ?? entryTypeLabel(entry?.entryType ?? "FREE"),
            entryType: entry?.entryType ?? "FREE",
            isFree: isOpen && !entry,
            isOpen
          };
        })
      };
    })
  };
}

export function calculateWorkloadSummary(source: TimetablePrintSource): WorkloadSummaryRow[] {
  return source.teachers
    .filter((teacher) => teacher.isActive)
    .map((teacher) => {
      const entries = source.entries.filter((entry) => entry.teacherId === teacher.id && isAssignedEntry(entry));
      const assignedPeriods = entries.length;
      return {
        teacherId: teacher.id,
        teacher: teacher.name,
        shortName: teacher.shortName,
        department: teacher.department ?? "-",
        maxPeriodsPerWeek: teacher.maxPeriodsPerWeek,
        assignedPeriods,
        remainingCapacity: Math.max(0, teacher.maxPeriodsPerWeek - assignedPeriods),
        overloaded: assignedPeriods > teacher.maxPeriodsPerWeek,
        dayLoads: Object.fromEntries(TIMETABLE_DAYS.map((day) => [
          day,
          entries.filter((entry) => entry.dayOfWeek === day).length
        ]))
      };
    })
    .sort((left, right) => left.teacher.localeCompare(right.teacher));
}

export function calculateFreePeriodSummary(source: TimetablePrintSource): FreePeriodSummaryRow[] {
  const slots = schoolTeachingSlots(source.templates, source.classSections, source.draft.academicYear);
  return source.teachers
    .filter((teacher) => teacher.isActive)
    .flatMap((teacher) => {
      const occupied = new Set(
        source.entries.filter((entry) => entry.teacherId === teacher.id && isAssignedEntry(entry))
          .map((entry) => `${entry.dayOfWeek}|${entry.periodNumber}`)
      );
      const dayRows = TIMETABLE_DAYS.map((dayOfWeek) => {
        const freePeriods = [...(slots.get(dayOfWeek) ?? new Set<number>())]
          .filter((periodNumber) => !occupied.has(`${dayOfWeek}|${periodNumber}`))
          .sort((a, b) => a - b);
        return { dayOfWeek, freePeriods };
      });
      const totalFreePeriods = dayRows.reduce((sum, row) => sum + row.freePeriods.length, 0);
      return dayRows.map((row) => ({
        teacherId: teacher.id,
        teacher: teacher.name,
        shortName: teacher.shortName,
        department: teacher.department ?? "-",
        dayOfWeek: row.dayOfWeek,
        dayLabel: titleDay(row.dayOfWeek),
        freePeriods: row.freePeriods,
        totalFreePeriods
      }));
    });
}

export function classTimetableCsvRows(source: TimetablePrintSource, classSectionId?: string) {
  return source.classSections
    .filter((row) => row.academicYear === source.draft.academicYear && (!classSectionId || row.id === classSectionId))
    .flatMap((classSection) => {
      const shaped = shapeClassTimetable(source, classSection.id);
      return shaped?.days.flatMap((day) => day.cells.filter((cell) => cell.isOpen).map((cell) => ({
        academicYear: source.draft.academicYear,
        draft: source.draft.name,
        status: source.draft.status,
        classSection: shaped.classSection,
        day: day.dayLabel,
        period: cell.periodNumber,
        periodLabel: cell.periodLabel,
        timing: cell.timing,
        subject: cell.subject,
        teacher: cell.teacher,
        entryType: cell.entryType,
        label: cell.label,
        locked: cell.isLocked ? "Yes" : "No"
      }))) ?? [];
    });
}

export function teacherTimetableCsvRows(source: TimetablePrintSource, teacherId?: string) {
  return source.teachers
    .filter((row) => row.isActive && (!teacherId || row.id === teacherId))
    .flatMap((teacher) => {
      const shaped = shapeTeacherTimetable(source, teacher.id);
      return shaped?.days.flatMap((day) => day.cells.filter((cell) => cell.isOpen).map((cell) => ({
        academicYear: source.draft.academicYear,
        draft: source.draft.name,
        status: source.draft.status,
        teacher: shaped.teacher,
        department: shaped.department,
        day: day.dayLabel,
        period: cell.periodNumber,
        classSection: cell.classSection,
        subject: cell.subject,
        entryType: cell.entryType,
        label: cell.isFree ? "Free" : cell.label
      }))) ?? [];
    });
}

export function workloadCsvRows(source: TimetablePrintSource) {
  return calculateWorkloadSummary(source).map((row) => ({
    teacher: row.teacher,
    shortName: row.shortName,
    department: row.department,
    maxPeriodsPerWeek: row.maxPeriodsPerWeek,
    assignedPeriods: row.assignedPeriods,
    remainingCapacity: row.remainingCapacity,
    overloadWarning: row.overloaded ? "OVERLOAD" : "",
    monday: row.dayLoads.MONDAY,
    tuesday: row.dayLoads.TUESDAY,
    wednesday: row.dayLoads.WEDNESDAY,
    thursday: row.dayLoads.THURSDAY,
    friday: row.dayLoads.FRIDAY,
    saturday: row.dayLoads.SATURDAY
  }));
}

export function freePeriodCsvRows(source: TimetablePrintSource) {
  return calculateFreePeriodSummary(source).map((row) => ({
    teacher: row.teacher,
    shortName: row.shortName,
    department: row.department,
    day: row.dayLabel,
    freePeriods: row.freePeriods.map((period) => `Period ${period}`).join("; "),
    freePeriodCount: row.freePeriods.length,
    totalFreePeriodsPerWeek: row.totalFreePeriods
  }));
}

export function formatTimetableCsv(rows: Record<string, unknown>[]) {
  const csv = toCsv(rows);
  return `\uFEFF${csv}${csv ? "\n" : ""}`;
}

function templatesForClassDay(templates: PrintTemplate[], classSection: PrintClassSection, dayOfWeek: string) {
  let rows = templates.filter((row) =>
    row.academicYear === classSection.academicYear
    && row.dayOfWeek === dayOfWeek
    && row.groupName === (dayOfWeek === "FRIDAY" ? "FRIDAY" : classSection.groupName)
  );
  if (!rows.length && dayOfWeek === "SATURDAY") {
    rows = templates.filter((row) =>
      row.academicYear === classSection.academicYear
      && row.dayOfWeek === "MONDAY"
      && row.groupName === classSection.groupName
    );
  }
  return [...rows].sort((left, right) => left.sortOrder - right.sortOrder);
}

function classPeriodNumbers(templates: PrintTemplate[], classSection: PrintClassSection) {
  return [...new Set(TIMETABLE_DAYS.flatMap((day) =>
    templatesForClassDay(templates, classSection, day)
      .filter((row) => row.isTeachingPeriod && row.periodNumber !== null)
      .map((row) => row.periodNumber as number)
  ))].sort((a, b) => a - b);
}

function schoolTeachingSlots(templates: PrintTemplate[], classes: PrintClassSection[], academicYear: string) {
  const map = new Map<string, Set<number>>(TIMETABLE_DAYS.map((day) => [day, new Set<number>()]));
  for (const classSection of classes.filter((row) => row.academicYear === academicYear && row.isActive)) {
    for (const day of TIMETABLE_DAYS) {
      for (const row of templatesForClassDay(templates, classSection, day)) {
        if (row.isTeachingPeriod && row.periodNumber !== null) map.get(day)?.add(row.periodNumber);
      }
    }
  }
  return map;
}

function isAssignedEntry(entry: PrintEntry) {
  return ["TEACHING", "FIXED", "ACTIVITY", "SUBSTITUTION"].includes(entry.entryType);
}

function entryTypeLabel(entryType: string) {
  return entryType === "FREE" ? "Free"
    : entryType === "ACTIVITY" ? "Activity"
    : entryType === "FIXED" ? "Fixed"
    : entryType === "SUBSTITUTION" ? "Substitution"
    : entryType === "EMPTY" ? "Empty"
    : entryType;
}

function titleDay(day: string) {
  return day.charAt(0) + day.slice(1).toLowerCase();
}
