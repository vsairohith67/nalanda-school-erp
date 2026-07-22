export const TIMETABLE_ACADEMIC_YEAR = "2026-27";
export const TIMETABLE_DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;
export const TIMETABLE_GROUPS = ["LKG", "UKG", "I-V", "VI-X"] as const;

export type TimetableTeacherInput = {
  name?: unknown;
  shortName?: unknown;
  department?: unknown;
  phone?: unknown;
  email?: unknown;
  maxPeriodsPerWeek?: unknown;
  maxPeriodsPerDay?: unknown;
  notes?: unknown;
  isActive?: unknown;
};

export type TimetableSubjectInput = {
  name?: unknown;
  shortName?: unknown;
  department?: unknown;
  isLabSubject?: unknown;
  isActivitySubject?: unknown;
  allowConsecutivePeriods?: unknown;
  notes?: unknown;
  isActive?: unknown;
};

export type TimetableClassInput = {
  academicYear?: unknown;
  className?: unknown;
  section?: unknown;
  groupName?: unknown;
  isActive?: unknown;
};

export function requiredText(value: unknown, label: string) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} is required`);
  return text;
}

export function optionalText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

export function positiveInt(value: unknown, label: string, optional = false) {
  if (optional && (value === null || value === undefined || value === "")) return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error(`${label} must be a positive whole number`);
  return number;
}

export function boolValue(value: unknown, fallback = false) {
  if (value === undefined) return fallback;
  return value === true || value === "true" || value === "on" || value === 1;
}

export function normalizeCode(value: unknown, label = "Short code") {
  return requiredText(value, label).toUpperCase().replace(/\s+/g, "");
}

export function validateTeacherInput(input: TimetableTeacherInput) {
  return {
    name: requiredText(input.name, "Teacher name"),
    shortName: normalizeCode(input.shortName),
    department: optionalText(input.department),
    phone: optionalText(input.phone),
    email: optionalText(input.email)?.toLowerCase() ?? null,
    maxPeriodsPerWeek: positiveInt(input.maxPeriodsPerWeek, "Maximum periods per week")!,
    maxPeriodsPerDay: positiveInt(input.maxPeriodsPerDay, "Maximum periods per day", true),
    notes: optionalText(input.notes),
    isActive: boolValue(input.isActive, true)
  };
}

export function validateSubjectInput(input: TimetableSubjectInput) {
  return {
    name: requiredText(input.name, "Subject name"),
    shortName: normalizeCode(input.shortName),
    department: optionalText(input.department),
    isLabSubject: boolValue(input.isLabSubject),
    isActivitySubject: boolValue(input.isActivitySubject),
    allowConsecutivePeriods: boolValue(input.allowConsecutivePeriods),
    notes: optionalText(input.notes),
    isActive: boolValue(input.isActive, true)
  };
}

export function classDisplayName(className: string, section: string) {
  return [className.trim(), section.trim()].filter(Boolean).join(" ");
}

export function classSectionKey(academicYear: string, className: string, section: string) {
  return `${academicYear.trim()}|${className.trim().toUpperCase()}|${section.trim().toUpperCase()}`;
}

export function validateClassInput(input: TimetableClassInput) {
  const className = requiredText(input.className, "Class");
  const section = String(input.section ?? "").trim().toUpperCase();
  const academicYear = requiredText(input.academicYear ?? TIMETABLE_ACADEMIC_YEAR, "Academic year");
  return {
    academicYear,
    className,
    section,
    displayName: classDisplayName(className, section),
    groupName: requiredText(input.groupName, "Class group"),
    isActive: boolValue(input.isActive, true)
  };
}

export function allowsConsecutivePeriods(subjectAllows: boolean, override: boolean | null | undefined) {
  return override ?? subjectAllows;
}

type Teacher = { id: string; name: string; isActive: boolean; maxPeriodsPerWeek: number; maxPeriodsPerDay?: number | null };
type Subject = { id: string; name: string; isActive: boolean; allowConsecutivePeriods?: boolean };
type ClassSection = { id: string; displayName: string; isActive: boolean };
type Assignment = {
  id?: string;
  teacherId?: string | null;
  subjectId?: string | null;
  classSectionId?: string | null;
  periodsPerWeek?: number | null;
  allowConsecutiveOverride?: boolean | null;
};
type FixedPeriod = {
  id?: string;
  classSectionId?: string | null;
  teacherId?: string | null;
  subjectId?: string | null;
  dayOfWeek: string;
  periodNumber: number;
};
type Unavailability = { teacherId: string; dayOfWeek: string; periodNumber: number };

export type TimetableWarning = {
  code: string;
  message: string;
  severity: "warning" | "error";
  entityId?: string;
};

export const TIMETABLE_ENTRY_TYPES = ["TEACHING", "FIXED", "FREE", "ACTIVITY", "SUBSTITUTION", "EMPTY"] as const;
export const TIMETABLE_DRAFT_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;

export type DraftEntry = {
  id?: string;
  draftId?: string;
  academicYear: string;
  classSectionId: string;
  dayOfWeek: string;
  periodNumber: number;
  assignmentId?: string | null;
  teacherId?: string | null;
  subjectId?: string | null;
  label?: string | null;
  entryType: string;
  isLocked?: boolean;
  notes?: string | null;
};

type DraftTeacher = Teacher & { maxPeriodsPerDay?: number | null };
type DraftSubject = Subject & { allowConsecutivePeriods?: boolean };
type DraftClass = ClassSection & { groupName?: string };
type DraftAssignment = Assignment & {
  id: string;
  classSectionId: string;
  teacherId: string;
  subjectId: string;
  periodsPerWeek: number;
};

export function validateDraftTimetable(input: {
  entries: DraftEntry[];
  teachers: DraftTeacher[];
  subjects: DraftSubject[];
  classSections: DraftClass[];
  assignments: DraftAssignment[];
  unavailability?: Unavailability[];
  fixedPeriods?: FixedPeriod[];
  teachingSlots?: Array<{ classSectionId: string; dayOfWeek: string; periodNumber: number }>;
  fridayMaxPeriod?: number;
}) {
  const issues: TimetableWarning[] = [];
  const teachers = new Map(input.teachers.map((row) => [row.id, row]));
  const subjects = new Map(input.subjects.map((row) => [row.id, row]));
  const classes = new Map(input.classSections.map((row) => [row.id, row]));
  const assignments = new Map(input.assignments.map((row) => [row.id, row]));
  const unavailable = new Set((input.unavailability ?? []).map((row) => slotKey(row.teacherId, row.dayOfWeek, row.periodNumber)));
  const teachingEntries = input.entries.filter((row) => ["TEACHING", "FIXED", "SUBSTITUTION"].includes(row.entryType));

  const classSlots = new Map<string, DraftEntry[]>();
  const teacherSlots = new Map<string, DraftEntry[]>();
  for (const entry of input.entries) {
    const classKey = slotKey(entry.classSectionId, entry.dayOfWeek, entry.periodNumber);
    classSlots.set(classKey, [...(classSlots.get(classKey) ?? []), entry]);
    if (entry.teacherId && teachingEntries.includes(entry)) {
      const teacherKey = slotKey(entry.teacherId, entry.dayOfWeek, entry.periodNumber);
      teacherSlots.set(teacherKey, [...(teacherSlots.get(teacherKey) ?? []), entry]);
    }
    const classSection = classes.get(entry.classSectionId);
    const teacher = entry.teacherId ? teachers.get(entry.teacherId) : undefined;
    const subject = entry.subjectId ? subjects.get(entry.subjectId) : undefined;
    const assignment = entry.assignmentId ? assignments.get(entry.assignmentId) : undefined;
    if (!classSection?.isActive) issues.push(issue("INACTIVE_CLASS", `${classSection?.displayName ?? "Class section"} is inactive.`, "error", entry.id));
    if (entry.teacherId && !teacher?.isActive) issues.push(issue("INACTIVE_TEACHER", `${teacher?.name ?? "Teacher"} is inactive.`, "error", entry.id));
    if (entry.subjectId && !subject?.isActive) issues.push(issue("INACTIVE_SUBJECT", `${subject?.name ?? "Subject"} is inactive.`, "error", entry.id));
    if (entry.assignmentId && (!assignment || assignment.classSectionId !== entry.classSectionId)) {
      issues.push(issue("INVALID_ASSIGNMENT_CLASS", "The selected assignment does not belong to this class section.", "error", entry.id));
    }
    if (entry.teacherId && unavailable.has(slotKey(entry.teacherId, entry.dayOfWeek, entry.periodNumber))) {
      issues.push(issue("TEACHER_UNAVAILABLE", `${teacher?.name ?? "Teacher"} is unavailable on ${titleDay(entry.dayOfWeek)} Period ${entry.periodNumber}.`, "error", entry.id));
    }
    if (entry.dayOfWeek === "FRIDAY" && input.fridayMaxPeriod && entry.periodNumber > input.fridayMaxPeriod && entry.entryType !== "EMPTY") {
      issues.push(issue("FRIDAY_HALF_DAY", `Period ${entry.periodNumber} is beyond the Friday half-day timetable.`, "warning", entry.id));
    }
  }
  for (const rows of classSlots.values()) {
    if (rows.length > 1) issues.push(issue("CLASS_DOUBLE_BOOKED", "This class has more than one entry in the same period.", "error", rows[0].id));
  }
  for (const rows of teacherSlots.values()) {
    const classCount = new Set(rows.map((row) => row.classSectionId)).size;
    if (classCount > 1) {
      const teacher = rows[0].teacherId ? teachers.get(rows[0].teacherId) : undefined;
      issues.push(issue("TEACHER_DOUBLE_BOOKED", `${teacher?.name ?? "Teacher"} is assigned to two classes at the same time.`, "error", rows[0].id));
    }
  }

  for (const fixed of input.fixedPeriods ?? []) {
    const matching = input.entries.filter((entry) =>
      entry.dayOfWeek === fixed.dayOfWeek &&
      entry.periodNumber === fixed.periodNumber &&
      (!fixed.classSectionId || entry.classSectionId === fixed.classSectionId)
    );
    for (const entry of matching) {
      const mismatched = (fixed.teacherId && entry.teacherId !== fixed.teacherId)
        || (fixed.subjectId && entry.subjectId !== fixed.subjectId)
        || (fixed.classSectionId && entry.classSectionId !== fixed.classSectionId);
      if (mismatched) issues.push(issue("FIXED_PERIOD_CONFLICT", "This entry conflicts with a configured fixed period.", "error", entry.id));
    }
  }

  const assignmentCounts = new Map<string, number>();
  const teacherWeek = new Map<string, number>();
  const teacherDay = new Map<string, number>();
  for (const entry of teachingEntries) {
    if (entry.assignmentId) assignmentCounts.set(entry.assignmentId, (assignmentCounts.get(entry.assignmentId) ?? 0) + 1);
    if (entry.teacherId) {
      teacherWeek.set(entry.teacherId, (teacherWeek.get(entry.teacherId) ?? 0) + 1);
      const key = `${entry.teacherId}|${entry.dayOfWeek}`;
      teacherDay.set(key, (teacherDay.get(key) ?? 0) + 1);
    }
  }
  for (const assignment of input.assignments) {
    const used = assignmentCounts.get(assignment.id) ?? 0;
    if (used > assignment.periodsPerWeek) issues.push(issue("ASSIGNMENT_OVERUSED", `Assignment is placed ${used}/${assignment.periodsPerWeek} periods.`, "warning", assignment.id));
    if (used < assignment.periodsPerWeek) issues.push(issue("ASSIGNMENT_UNDERUSED", `Assignment is placed ${used}/${assignment.periodsPerWeek} periods.`, "warning", assignment.id));
  }
  for (const teacher of input.teachers) {
    const weekly = teacherWeek.get(teacher.id) ?? 0;
    if (weekly > teacher.maxPeriodsPerWeek) issues.push(issue("TEACHER_WEEKLY_OVERLOAD", `${teacher.name} has ${weekly} periods; weekly maximum is ${teacher.maxPeriodsPerWeek}.`, "warning", teacher.id));
    if (teacher.maxPeriodsPerDay) {
      for (const day of TIMETABLE_DAYS) {
        const daily = teacherDay.get(`${teacher.id}|${day}`) ?? 0;
        if (daily > teacher.maxPeriodsPerDay) issues.push(issue("TEACHER_DAILY_OVERLOAD", `${teacher.name} has ${daily} periods on ${titleDay(day)}; daily maximum is ${teacher.maxPeriodsPerDay}.`, "warning", teacher.id));
      }
    }
  }

  const classDayEntries = new Map<string, DraftEntry[]>();
  for (const entry of teachingEntries) {
    const key = `${entry.classSectionId}|${entry.dayOfWeek}`;
    classDayEntries.set(key, [...(classDayEntries.get(key) ?? []), entry]);
  }
  for (const rows of classDayEntries.values()) {
    const sorted = [...rows].sort((a, b) => a.periodNumber - b.periodNumber);
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      if (current.periodNumber !== previous.periodNumber + 1 || !current.subjectId || current.subjectId !== previous.subjectId) continue;
      const assignment = current.assignmentId ? assignments.get(current.assignmentId) : undefined;
      const subject = subjects.get(current.subjectId);
      if (!allowsConsecutivePeriods(Boolean(subject?.allowConsecutivePeriods), assignment?.allowConsecutiveOverride)) {
        issues.push(issue("CONSECUTIVE_SUBJECT", `${subject?.name ?? "Subject"} is placed in consecutive periods for the same class.`, "warning", current.id));
      }
    }
  }
  if (input.teachingSlots) {
    const occupied = new Set(input.entries.filter((row) => row.entryType !== "EMPTY").map((row) => slotKey(row.classSectionId, row.dayOfWeek, row.periodNumber)));
    for (const slot of input.teachingSlots) {
      if (!occupied.has(slotKey(slot.classSectionId, slot.dayOfWeek, slot.periodNumber))) {
        issues.push(issue("EMPTY_TEACHING_PERIOD", `Empty teaching period: ${titleDay(slot.dayOfWeek)} Period ${slot.periodNumber}.`, "warning", slot.classSectionId));
      }
    }
  }
  return dedupeIssues(issues);
}

function slotKey(entityId: string, dayOfWeek: string, periodNumber: number) {
  return `${entityId}|${dayOfWeek}|${periodNumber}`;
}

function issue(code: string, message: string, severity: "warning" | "error", entityId?: string): TimetableWarning {
  return { code, message, severity, entityId };
}

function dedupeIssues(issues: TimetableWarning[]) {
  return issues.filter((row, index) => issues.findIndex((other) =>
    other.code === row.code && other.message === row.message && other.entityId === row.entityId
  ) === index);
}

function titleDay(day: string) {
  return day.charAt(0) + day.slice(1).toLowerCase();
}

export function teacherWeeklyLoads(assignments: Assignment[]) {
  const loads = new Map<string, number>();
  for (const assignment of assignments) {
    if (!assignment.teacherId) continue;
    loads.set(assignment.teacherId, (loads.get(assignment.teacherId) ?? 0) + Math.max(0, Number(assignment.periodsPerWeek) || 0));
  }
  return loads;
}

export function validateTimetableFoundation(input: {
  teachers: Teacher[];
  subjects: Subject[];
  classSections: ClassSection[];
  assignments: Assignment[];
  fixedPeriods?: FixedPeriod[];
  unavailability?: Unavailability[];
}) {
  const warnings: TimetableWarning[] = [];
  const teachers = new Map(input.teachers.map((row) => [row.id, row]));
  const subjects = new Map(input.subjects.map((row) => [row.id, row]));
  const classes = new Map(input.classSections.map((row) => [row.id, row]));
  const loads = teacherWeeklyLoads(input.assignments);
  const classSubjects = new Map<string, Assignment[]>();
  const assignedClassIds = new Set(input.assignments.map((row) => row.classSectionId).filter(Boolean));

  for (const classSection of input.classSections) {
    if (classSection.isActive && !assignedClassIds.has(classSection.id)) {
      warnings.push({ code: "CLASS_WITHOUT_WORKLOAD", message: `${classSection.displayName} has no subject workload assignments yet.`, severity: "warning", entityId: classSection.id });
    }
  }

  for (const assignment of input.assignments) {
    if (!assignment.teacherId || !assignment.subjectId || !assignment.classSectionId) {
      warnings.push({ code: "ASSIGNMENT_MISSING_DATA", message: "An assignment is missing its teacher, subject, or class section.", severity: "error", entityId: assignment.id });
      continue;
    }
    if (!assignment.periodsPerWeek || assignment.periodsPerWeek <= 0) {
      warnings.push({ code: "MISSING_WORKLOAD", message: "Periods per week must be greater than zero.", severity: "error", entityId: assignment.id });
    }
    const teacher = teachers.get(assignment.teacherId);
    const subject = subjects.get(assignment.subjectId);
    const classSection = classes.get(assignment.classSectionId);
    if (teacher && !teacher.isActive) warnings.push({ code: "INACTIVE_TEACHER", message: `${teacher.name} is inactive but is used in an assignment.`, severity: "warning", entityId: assignment.id });
    if (subject && !subject.isActive) warnings.push({ code: "INACTIVE_SUBJECT", message: `${subject.name} is inactive but is used in an assignment.`, severity: "warning", entityId: assignment.id });
    if (classSection && !classSection.isActive) warnings.push({ code: "INACTIVE_CLASS", message: `${classSection.displayName} is inactive but has an assignment.`, severity: "warning", entityId: assignment.id });
    const key = `${assignment.classSectionId}|${assignment.subjectId}`;
    classSubjects.set(key, [...(classSubjects.get(key) ?? []), assignment]);
  }

  for (const [teacherId, load] of loads) {
    const teacher = teachers.get(teacherId);
    if (teacher && load > teacher.maxPeriodsPerWeek) {
      warnings.push({ code: "TEACHER_OVERLOAD", message: `${teacher.name} has ${load} periods per week; maximum is ${teacher.maxPeriodsPerWeek}.`, severity: "error", entityId: teacherId });
    }
  }
  const fixedDailyLoads = new Map<string, number>();
  for (const row of input.fixedPeriods ?? []) {
    if (!row.teacherId) continue;
    const key = `${row.teacherId}|${row.dayOfWeek}`;
    fixedDailyLoads.set(key, (fixedDailyLoads.get(key) ?? 0) + 1);
  }
  for (const [key, load] of fixedDailyLoads) {
    const [teacherId, day] = key.split("|");
    const teacher = teachers.get(teacherId);
    if (teacher?.maxPeriodsPerDay && load > teacher.maxPeriodsPerDay) {
      warnings.push({ code: "TEACHER_DAILY_OVERLOAD", message: `${teacher.name} has ${load} fixed periods on ${day}; daily maximum is ${teacher.maxPeriodsPerDay}.`, severity: "error", entityId: teacherId });
    }
  }
  for (const rows of classSubjects.values()) {
    if (new Set(rows.map((row) => row.teacherId)).size > 1) {
      const row = rows[0];
      const className = classes.get(row.classSectionId!)?.displayName ?? "Class";
      const subjectName = subjects.get(row.subjectId!)?.name ?? "subject";
      warnings.push({ code: "DUPLICATE_CLASS_SUBJECT", message: `${className} has ${subjectName} assigned to more than one teacher. Review whether this is intentional.`, severity: "warning", entityId: row.classSectionId ?? undefined });
    }
  }

  const fixed = input.fixedPeriods ?? [];
  const unavailable = new Set((input.unavailability ?? []).map((row) => `${row.teacherId}|${row.dayOfWeek}|${row.periodNumber}`));
  for (let index = 0; index < fixed.length; index += 1) {
    const row = fixed[index];
    if (row.teacherId && unavailable.has(`${row.teacherId}|${row.dayOfWeek}|${row.periodNumber}`)) {
      warnings.push({ code: "TEACHER_UNAVAILABLE_CONFLICT", message: "A fixed period uses a teacher during an unavailable period.", severity: "error", entityId: row.id });
    }
    const conflicts = fixed.slice(index + 1).filter((other) =>
      other.dayOfWeek === row.dayOfWeek &&
      other.periodNumber === row.periodNumber &&
      ((row.teacherId && row.teacherId === other.teacherId) || (row.classSectionId && row.classSectionId === other.classSectionId))
    );
    if (conflicts.length) warnings.push({ code: "FIXED_PERIOD_CONFLICT", message: "Two fixed periods use the same teacher or class section at the same time.", severity: "error", entityId: row.id });
  }
  return warnings;
}

type PeriodSeed = {
  groupName: string;
  dayOfWeek: string;
  periodNumber: number | null;
  label: string;
  startTime: string;
  endTime: string;
  type: string;
  isTeachingPeriod: boolean;
  sortOrder: number;
  isDefault: boolean;
};

function row(groupName: string, dayOfWeek: string, sortOrder: number, label: string, startTime: string, endTime: string, type: string, periodNumber: number | null = null): PeriodSeed {
  return { groupName, dayOfWeek, sortOrder, label, startTime, endTime, type, periodNumber, isTeachingPeriod: type === "TEACHING", isDefault: true };
}

function regularDay(groupName: string, day: string): PeriodSeed[] {
  const common = [
    row(groupName, day, 1, "1st Bell", "08:40", "08:40", "FIXED"),
    row(groupName, day, 2, "2nd Bell", "08:45", "08:45", "FIXED"),
    row(groupName, day, 3, "Assembly", "08:45", "09:00", "ASSEMBLY"),
    row(groupName, day, 4, "Period I", "09:00", "09:50", "TEACHING", 1),
    row(groupName, day, 5, "Period II", "09:50", "10:35", "TEACHING", 2),
    row(groupName, day, 6, "Short Break", "10:35", "10:45", "BREAK"),
    row(groupName, day, 7, "Period III", "10:45", "11:30", "TEACHING", 3),
    row(groupName, day, 8, "Period IV", "11:30", "12:15", "TEACHING", 4)
  ];
  if (groupName === "LKG") return [...common, row(groupName, day, 9, "Closing / Dispersal", "12:15", "12:30", "DIARY")];
  const afterLunch = [
    row(groupName, day, 9, "Lunch", "12:15", "12:45", "LUNCH"),
    row(groupName, day, 10, "Period V", "12:45", "13:30", "TEACHING", 5),
    row(groupName, day, 11, "Period VI", "13:30", "14:15", "TEACHING", 6)
  ];
  if (groupName === "UKG") return [...common, ...afterLunch, row(groupName, day, 12, "Diary / Dispersal", "14:15", "14:30", "DIARY")];
  if (groupName === "I-V") return [...common, ...afterLunch, row(groupName, day, 12, "Period VII", "14:15", "15:00", "TEACHING", 7), row(groupName, day, 13, "Diary / Dispersal", "15:00", "15:15", "DIARY")];
  return [...common, ...afterLunch, row(groupName, day, 12, "Period VII", "14:15", "15:00", "TEACHING", 7), row(groupName, day, 13, "Period VIII", "15:00", "15:45", "TEACHING", 8), row(groupName, day, 14, "Diary Period", "15:45", "16:00", "DIARY")];
}

function fridayOverride(): PeriodSeed[] {
  const group = "FRIDAY";
  const day = "FRIDAY";
  return [
    row(group, day, 1, "1st Bell", "08:40", "08:40", "FIXED"),
    row(group, day, 2, "2nd Bell", "08:45", "08:45", "FIXED"),
    row(group, day, 3, "Assembly", "08:45", "09:00", "ASSEMBLY"),
    row(group, day, 4, "Period I", "09:00", "09:40", "TEACHING", 1),
    row(group, day, 5, "Period II", "09:40", "10:20", "TEACHING", 2),
    row(group, day, 6, "Short Break", "10:20", "10:30", "BREAK"),
    row(group, day, 7, "Period III", "10:30", "11:10", "TEACHING", 3),
    row(group, day, 8, "Period IV", "11:10", "11:50", "TEACHING", 4),
    row(group, day, 9, "Period V / Closing", "11:50", "12:25", "TEACHING", 5)
  ];
}

export function defaultPeriodTemplates() {
  return [
    ...TIMETABLE_GROUPS.flatMap((group) => ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "SATURDAY"].flatMap((day) => regularDay(group, day))),
    ...fridayOverride()
  ];
}

export const DEFAULT_CLASS_SECTIONS = [
  ["LKG", "", "LKG"], ["UKG", "A", "UKG"], ["UKG", "B", "UKG"],
  ...["I", "II", "III", "IV", "V"].flatMap((className) => [["A", "I-V"], ["B", "I-V"]].map(([section, group]) => [className, section, group])),
  ...["VI", "VII", "VIII", "IX", "X"].flatMap((className) => [["A", "VI-X"], ["B", "VI-X"]].map(([section, group]) => [className, section, group]))
] as const;

export async function seedTimetableDefaults(prisma: {
  timetableClassSection: { upsert(args: unknown): Promise<unknown> };
  timetablePeriodTemplate: { upsert(args: unknown): Promise<unknown> };
}, academicYear = TIMETABLE_ACADEMIC_YEAR) {
  for (const [className, section, groupName] of DEFAULT_CLASS_SECTIONS) {
    await prisma.timetableClassSection.upsert({
      where: { academicYear_className_section: { academicYear, className, section } },
      update: {},
      create: { academicYear, className, section, displayName: classDisplayName(className, section), groupName, isActive: true }
    });
  }
  for (const template of defaultPeriodTemplates()) {
    await prisma.timetablePeriodTemplate.upsert({
      where: { academicYear_groupName_dayOfWeek_sortOrder: { academicYear, groupName: template.groupName, dayOfWeek: template.dayOfWeek, sortOrder: template.sortOrder } },
      update: {},
      create: { academicYear, ...template }
    });
  }
}
