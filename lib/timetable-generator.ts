import {
  TIMETABLE_DAYS,
  allowsConsecutivePeriods,
  validateDraftTimetable,
  type DraftEntry,
  type TimetableWarning
} from "./timetable";

export type GeneratorScope = "ALL" | "CLASS" | "GROUP";

export type GeneratorSettings = {
  academicYear: string;
  scope: GeneratorScope;
  classSectionId?: string | null;
  groupName?: string | null;
  baseDraftId?: string | null;
  respectLockedCells: boolean;
  copyManualEntries: boolean;
  applyFixedPeriodsFirst: boolean;
  avoidConsecutiveSameSubject: boolean;
  spreadSubjectsAcrossWeek: boolean;
  avoidTeacherOverloadPerDay: boolean;
};

export type GeneratorTeacher = {
  id: string;
  name: string;
  shortName?: string;
  isActive: boolean;
  maxPeriodsPerWeek: number;
  maxPeriodsPerDay?: number | null;
};

export type GeneratorSubject = {
  id: string;
  name: string;
  shortName?: string;
  isActive: boolean;
  allowConsecutivePeriods?: boolean;
};

export type GeneratorClassSection = {
  id: string;
  academicYear: string;
  displayName: string;
  groupName: string;
  isActive: boolean;
};

export type GeneratorAssignment = {
  id: string;
  academicYear: string;
  classSectionId: string;
  teacherId: string;
  subjectId: string;
  periodsPerWeek: number;
  allowConsecutiveOverride?: boolean | null;
  priority?: number | null;
};

export type GeneratorTemplate = {
  academicYear: string;
  groupName: string;
  dayOfWeek: string;
  periodNumber: number | null;
  isTeachingPeriod: boolean;
  sortOrder: number;
};

export type GeneratorUnavailability = {
  teacherId: string;
  dayOfWeek: string;
  periodNumber: number;
};

export type GeneratorFixedPeriod = {
  id?: string;
  academicYear: string;
  classSectionId?: string | null;
  teacherId?: string | null;
  subjectId?: string | null;
  dayOfWeek: string;
  periodNumber: number;
  label: string;
  reason?: string | null;
};

export type GeneratorBaseDraft = {
  id: string;
  academicYear: string;
  name: string;
  status: string;
  entries: DraftEntry[];
};

export type GeneratorInput = {
  settings: GeneratorSettings;
  teachers: GeneratorTeacher[];
  subjects: GeneratorSubject[];
  classSections: GeneratorClassSection[];
  assignments: GeneratorAssignment[];
  templates: GeneratorTemplate[];
  unavailability: GeneratorUnavailability[];
  fixedPeriods: GeneratorFixedPeriod[];
  baseDraft?: GeneratorBaseDraft | null;
  generatedAt?: Date;
};

export type GeneratorUnresolved = {
  assignmentId: string;
  classSectionId: string;
  classSection: string;
  subjectId: string;
  subject: string;
  teacherId: string;
  teacher: string;
  remainingPeriods: number;
  reason: string;
};

export type GeneratorClassCompletion = {
  classSectionId: string;
  classSection: string;
  requiredPeriods: number;
  placedPeriods: number;
  completionPercentage: number;
};

export type GeneratorTeacherWorkload = {
  teacherId: string;
  teacher: string;
  placedPeriods: number;
  maxPeriodsPerWeek: number;
  dailyLoads: Array<{ dayOfWeek: string; periods: number; maximum: number | null }>;
};

export type GeneratorResult = {
  generatedDraftName: string;
  settings: GeneratorSettings;
  entries: DraftEntry[];
  summary: {
    classSectionsProcessed: number;
    totalRequiredPeriods: number;
    placedPeriods: number;
    unresolvedPeriods: number;
    hardConflictsAvoided: number;
    errors: number;
    warnings: number;
  };
  classCompletion: GeneratorClassCompletion[];
  teacherWorkloads: GeneratorTeacherWorkload[];
  unresolved: GeneratorUnresolved[];
  validation: {
    errors: TimetableWarning[];
    warnings: TimetableWarning[];
  };
  generationWarnings: string[];
};

type Slot = { classSectionId: string; dayOfWeek: string; periodNumber: number };

export function defaultGeneratorSettings(academicYear: string): GeneratorSettings {
  return {
    academicYear,
    scope: "ALL",
    classSectionId: null,
    groupName: null,
    baseDraftId: null,
    respectLockedCells: true,
    copyManualEntries: false,
    applyFixedPeriodsFirst: true,
    avoidConsecutiveSameSubject: true,
    spreadSubjectsAcrossWeek: true,
    avoidTeacherOverloadPerDay: true
  };
}

export function generatedTimetableName(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `Generated Timetable - ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function generateTimetable(input: GeneratorInput): GeneratorResult {
  const settings = input.settings;
  const teacherMap = new Map(input.teachers.map((row) => [row.id, row]));
  const subjectMap = new Map(input.subjects.map((row) => [row.id, row]));
  const yearClasses = input.classSections.filter((row) => row.academicYear === settings.academicYear);
  const yearClassMap = new Map(yearClasses.map((row) => [row.id, row]));
  const selectedClasses = yearClasses
    .filter((row) => row.isActive)
    .filter((row) => settings.scope === "ALL"
      || (settings.scope === "CLASS" && row.id === settings.classSectionId)
      || (settings.scope === "GROUP" && row.groupName === settings.groupName))
    .sort((a, b) => a.displayName.localeCompare(b.displayName) || a.id.localeCompare(b.id));
  const classMap = new Map(selectedClasses.map((row) => [row.id, row]));
  const assignments = input.assignments
    .filter((row) => row.academicYear === settings.academicYear && classMap.has(row.classSectionId))
    .sort((a, b) => a.id.localeCompare(b.id));
  const assignmentMap = new Map(assignments.map((row) => [row.id, row]));
  const slots = selectedClasses.flatMap((classSection) =>
    TIMETABLE_DAYS.flatMap((dayOfWeek) =>
      teachingPeriodNumbers(input.templates, settings.academicYear, classSection.groupName, dayOfWeek)
        .map((periodNumber) => ({ classSectionId: classSection.id, dayOfWeek, periodNumber }))
    )
  );
  const slotSet = new Set(slots.map((row) => classSlotKey(row.classSectionId, row.dayOfWeek, row.periodNumber)));
  const allTeachingSlotSet = new Set(yearClasses.filter((row) => row.isActive).flatMap((classSection) =>
    TIMETABLE_DAYS.flatMap((dayOfWeek) =>
      teachingPeriodNumbers(input.templates, settings.academicYear, classSection.groupName, dayOfWeek)
        .map((periodNumber) => classSlotKey(classSection.id, dayOfWeek, periodNumber))
    )
  ));
  const unavailable = new Set(input.unavailability.map((row) => teacherSlotKey(row.teacherId, row.dayOfWeek, row.periodNumber)));
  const entries: DraftEntry[] = [];
  const classOccupied = new Set<string>();
  const teacherOccupied = new Set<string>();
  const assignmentCounts = new Map<string, number>();
  const teacherWeek = new Map<string, number>();
  const teacherDay = new Map<string, number>();
  const classDay = new Map<string, number>();
  const generationWarnings: string[] = [];
  let hardConflictsAvoided = 0;

  const addEntry = (entry: DraftEntry) => {
    entries.push(entry);
    if (entry.entryType !== "EMPTY" || entry.isLocked) {
      classOccupied.add(classSlotKey(entry.classSectionId, entry.dayOfWeek, entry.periodNumber));
    }
    if (entry.teacherId && isTeachingEntry(entry)) {
      const teacherKey = teacherSlotKey(entry.teacherId, entry.dayOfWeek, entry.periodNumber);
      if (teacherOccupied.has(teacherKey)) {
        generationWarnings.push(`Base or fixed data already double-books a teacher on ${entry.dayOfWeek} Period ${entry.periodNumber}.`);
      }
      teacherOccupied.add(teacherKey);
      teacherWeek.set(entry.teacherId, (teacherWeek.get(entry.teacherId) ?? 0) + 1);
      const dailyKey = `${entry.teacherId}|${entry.dayOfWeek}`;
      teacherDay.set(dailyKey, (teacherDay.get(dailyKey) ?? 0) + 1);
    }
    if (entry.assignmentId && isTeachingEntry(entry)) {
      assignmentCounts.set(entry.assignmentId, (assignmentCounts.get(entry.assignmentId) ?? 0) + 1);
    }
    if (isTeachingEntry(entry)) {
      const dailyKey = `${entry.classSectionId}|${entry.dayOfWeek}`;
      classDay.set(dailyKey, (classDay.get(dailyKey) ?? 0) + 1);
    }
  };

  const baseEntries = input.baseDraft?.academicYear === settings.academicYear
    ? input.baseDraft.entries
      .filter((row) => yearClassMap.has(row.classSectionId))
      .filter((row) => row.isLocked || settings.copyManualEntries)
      .sort(compareEntries)
    : [];
  const lockedBaseEntries = baseEntries.filter((row) => row.isLocked);
  const manualBaseEntries = baseEntries.filter((row) => !row.isLocked);
  for (const entry of lockedBaseEntries) {
    if (!allTeachingSlotSet.has(classSlotKey(entry.classSectionId, entry.dayOfWeek, entry.periodNumber))) {
      generationWarnings.push(`Locked base entry for ${yearClassMap.get(entry.classSectionId)?.displayName ?? "a class"} is outside the current teaching template but was preserved.`);
    }
    addEntry(copyBaseEntry(entry));
  }

  const scopedFixedPeriods = expandFixedPeriods(input.fixedPeriods, selectedClasses, settings.academicYear);
  const applyFixed = () => {
    for (const fixed of scopedFixedPeriods) {
      const key = classSlotKey(fixed.classSectionId!, fixed.dayOfWeek, fixed.periodNumber);
      if (!slotSet.has(key)) {
        generationWarnings.push(`${fixed.label} is outside the teaching template and was not applied.`);
        continue;
      }
      if (classOccupied.has(key)) {
        generationWarnings.push(`${fixed.label} could not replace an existing locked or manual base period.`);
        hardConflictsAvoided += 1;
        continue;
      }
      const teacherId = fixed.teacherId ?? null;
      if (teacherId && unavailable.has(teacherSlotKey(teacherId, fixed.dayOfWeek, fixed.periodNumber))) {
        generationWarnings.push(`${fixed.label} was not applied because the teacher is unavailable.`);
        hardConflictsAvoided += 1;
        continue;
      }
      if (teacherId && teacherOccupied.has(teacherSlotKey(teacherId, fixed.dayOfWeek, fixed.periodNumber))) {
        generationWarnings.push(`${fixed.label} was not applied because the teacher is already occupied.`);
        hardConflictsAvoided += 1;
        continue;
      }
      const assignment = teacherId && fixed.subjectId
        ? assignments.find((row) =>
          row.classSectionId === fixed.classSectionId
          && row.teacherId === teacherId
          && row.subjectId === fixed.subjectId)
        : undefined;
      addEntry({
        academicYear: settings.academicYear,
        classSectionId: fixed.classSectionId!,
        dayOfWeek: fixed.dayOfWeek,
        periodNumber: fixed.periodNumber,
        assignmentId: assignment?.id ?? null,
        teacherId,
        subjectId: fixed.subjectId ?? null,
        label: fixed.label,
        entryType: "FIXED",
        isLocked: true,
        notes: fixed.reason ?? null
      });
    }
  };

  if (settings.applyFixedPeriodsFirst) applyFixed();
  for (const entry of manualBaseEntries) {
    const key = classSlotKey(entry.classSectionId, entry.dayOfWeek, entry.periodNumber);
    if (!allTeachingSlotSet.has(key)) {
      generationWarnings.push(`Manual base entry for ${yearClassMap.get(entry.classSectionId)?.displayName ?? "a class"} is outside the current teaching template but was copied.`);
    }
    if (classOccupied.has(key)) {
      generationWarnings.push("A manual base entry was skipped because a locked or fixed period already occupies the cell.");
      hardConflictsAvoided += 1;
      continue;
    }
    if (entry.teacherId && teacherOccupied.has(teacherSlotKey(entry.teacherId, entry.dayOfWeek, entry.periodNumber))) {
      generationWarnings.push("A manual base entry was skipped because it would double-book a teacher.");
      hardConflictsAvoided += 1;
      continue;
    }
    addEntry(copyBaseEntry(entry));
  }
  if (!settings.applyFixedPeriodsFirst) {
    for (const fixed of scopedFixedPeriods) {
      classOccupied.add(classSlotKey(fixed.classSectionId!, fixed.dayOfWeek, fixed.periodNumber));
    }
    if (scopedFixedPeriods.length) {
      generationWarnings.push("Fixed periods were reserved but not copied because Apply fixed periods first was turned off.");
    }
  }

  const difficulty = assignments.map((assignment) => {
    const availableSlots = slots.filter((slot) =>
      slot.classSectionId === assignment.classSectionId
      && !unavailable.has(teacherSlotKey(assignment.teacherId, slot.dayOfWeek, slot.periodNumber))
    ).length;
    return { assignment, availableSlots };
  }).sort((left, right) =>
    right.assignment.periodsPerWeek - left.assignment.periodsPerWeek
    || left.availableSlots - right.availableSlots
    || (right.assignment.priority ?? 0) - (left.assignment.priority ?? 0)
    || left.assignment.id.localeCompare(right.assignment.id)
  );

  const unresolved: GeneratorUnresolved[] = [];
  for (const { assignment } of difficulty) {
    const teacher = teacherMap.get(assignment.teacherId);
    const subject = subjectMap.get(assignment.subjectId);
    const classSection = classMap.get(assignment.classSectionId)!;
    const alreadyPlaced = assignmentCounts.get(assignment.id) ?? 0;
    let remaining = Math.max(0, assignment.periodsPerWeek - alreadyPlaced);
    if (!teacher?.isActive || !subject?.isActive) {
      if (remaining) {
        unresolved.push(unresolvedRow(assignment, classSection, subject?.name ?? "Inactive subject", teacher?.name ?? "Inactive teacher", remaining, !teacher?.isActive ? "Teacher is inactive." : "Subject is inactive."));
      }
      continue;
    }
    while (remaining > 0) {
      const candidates = slots
        .filter((slot) => slot.classSectionId === assignment.classSectionId)
        .flatMap((slot) => {
          const invalid = hardConstraintReason(slot, assignment, classOccupied, teacherOccupied, unavailable);
          if (invalid) {
            hardConflictsAvoided += 1;
            return [];
          }
          return [{ slot, score: scoreSlot({
            slot,
            assignment,
            entries,
            teacher,
            subject,
            teacherDay,
            teacherWeek,
            classDay,
            settings
          }) }];
        })
        .sort((left, right) =>
          right.score - left.score
          || dayIndex(left.slot.dayOfWeek) - dayIndex(right.slot.dayOfWeek)
          || left.slot.periodNumber - right.slot.periodNumber
        );
      const best = candidates[0];
      if (!best) break;
      addEntry({
        academicYear: settings.academicYear,
        classSectionId: assignment.classSectionId,
        dayOfWeek: best.slot.dayOfWeek,
        periodNumber: best.slot.periodNumber,
        assignmentId: assignment.id,
        teacherId: assignment.teacherId,
        subjectId: assignment.subjectId,
        label: subject.name,
        entryType: "TEACHING",
        isLocked: false,
        notes: "Automatically generated; manual review required."
      });
      remaining -= 1;
    }
    if (remaining > 0) {
      unresolved.push(unresolvedRow(
        assignment,
        classSection,
        subject.name,
        teacher.name,
        remaining,
        unresolvedReason(assignment, slots, classOccupied, teacherOccupied, unavailable)
      ));
    }
  }

  entries.sort(compareEntries);
  const fridayMaxPeriod = Math.max(0, ...input.templates
    .filter((row) => row.academicYear === settings.academicYear && row.groupName === "FRIDAY" && row.isTeachingPeriod)
    .map((row) => row.periodNumber ?? 0));
  const selectedAssignmentIds = new Set(assignments.map((row) => row.id));
  const referencedAssignmentIds = new Set(entries.map((row) => row.assignmentId).filter((value): value is string => Boolean(value)));
  const validationAssignments = input.assignments.filter((row) =>
    row.academicYear === settings.academicYear
    && (selectedAssignmentIds.has(row.id) || referencedAssignmentIds.has(row.id))
  );
  const rawValidationIssues = validateDraftTimetable({
    entries,
    teachers: input.teachers,
    subjects: input.subjects,
    classSections: yearClasses,
    assignments: validationAssignments,
    unavailability: input.unavailability,
    fixedPeriods: input.fixedPeriods.filter((row) => Boolean(row.classSectionId) && classMap.has(row.classSectionId!)),
    teachingSlots: slots,
    fridayMaxPeriod
  }).filter((row) =>
    row.code !== "ASSIGNMENT_UNDERUSED"
    || !row.entityId
    || selectedAssignmentIds.has(row.entityId)
  );
  const validationIssues = compactGeneratorIssues(rawValidationIssues, selectedClasses, assignments);
  const classCompletion = selectedClasses.map((classSection) => {
    const classAssignments = assignments.filter((row) => row.classSectionId === classSection.id);
    const requiredPeriods = classAssignments.reduce((sum, row) => sum + row.periodsPerWeek, 0);
    const placedPeriods = classAssignments.reduce((sum, row) => sum + Math.min(row.periodsPerWeek, assignmentCounts.get(row.id) ?? 0), 0);
    return {
      classSectionId: classSection.id,
      classSection: classSection.displayName,
      requiredPeriods,
      placedPeriods,
      completionPercentage: requiredPeriods ? Math.round((placedPeriods / requiredPeriods) * 100) : 0
    };
  });
  const teacherWorkloads = input.teachers
    .filter((teacher) => teacher.isActive && (teacherWeek.get(teacher.id) ?? 0) > 0)
    .map((teacher) => ({
      teacherId: teacher.id,
      teacher: teacher.name,
      placedPeriods: teacherWeek.get(teacher.id) ?? 0,
      maxPeriodsPerWeek: teacher.maxPeriodsPerWeek,
      dailyLoads: TIMETABLE_DAYS.map((dayOfWeek) => ({
        dayOfWeek,
        periods: teacherDay.get(`${teacher.id}|${dayOfWeek}`) ?? 0,
        maximum: teacher.maxPeriodsPerDay ?? null
      }))
    }))
    .sort((a, b) => a.teacher.localeCompare(b.teacher));
  const totalRequiredPeriods = assignments.reduce((sum, row) => sum + row.periodsPerWeek, 0);
  const placedPeriods = classCompletion.reduce((sum, row) => sum + row.placedPeriods, 0);
  const errors = validationIssues.filter((row) => row.severity === "error");
  const warnings = validationIssues.filter((row) => row.severity === "warning");
  return {
    generatedDraftName: generatedTimetableName(input.generatedAt),
    settings,
    entries,
    summary: {
      classSectionsProcessed: selectedClasses.length,
      totalRequiredPeriods,
      placedPeriods,
      unresolvedPeriods: unresolved.reduce((sum, row) => sum + row.remainingPeriods, 0),
      hardConflictsAvoided,
      errors: errors.length,
      warnings: warnings.length + generationWarnings.length
    },
    classCompletion,
    teacherWorkloads,
    unresolved,
    validation: { errors, warnings },
    generationWarnings
  };
}

export function generatedDraftCreateData(result: GeneratorResult, createdByUserId: string, name = result.generatedDraftName) {
  return {
    academicYear: result.settings.academicYear,
    name,
    status: "DRAFT",
    notes: generationNotes(result.settings),
    createdByUserId,
    entries: {
      create: result.entries.map((entry) => ({
        academicYear: entry.academicYear,
        classSectionId: entry.classSectionId,
        dayOfWeek: entry.dayOfWeek,
        periodNumber: entry.periodNumber,
        assignmentId: entry.assignmentId ?? null,
        teacherId: entry.teacherId ?? null,
        subjectId: entry.subjectId ?? null,
        label: entry.label ?? null,
        entryType: entry.entryType,
        isLocked: Boolean(entry.isLocked),
        notes: entry.notes ?? null
      }))
    }
  };
}

export async function saveGeneratedTimetableDraft(
  client: { timetableDraft: { create(args: unknown): Promise<unknown> } },
  result: GeneratorResult,
  createdByUserId: string,
  name = result.generatedDraftName
) {
  return client.timetableDraft.create({
    data: generatedDraftCreateData(result, createdByUserId, name),
    include: { entries: true }
  });
}

function generationNotes(settings: GeneratorSettings) {
  const scope = settings.scope === "CLASS" ? `class ${settings.classSectionId}`
    : settings.scope === "GROUP" ? `group ${settings.groupName}`
    : "all class sections";
  return [
    `Automatically generated for ${scope}. Manual review required.`,
    `Base draft: ${settings.baseDraftId ?? "none"}.`,
    `Fixed periods applied first: ${settings.applyFixedPeriodsFirst ? "yes" : "no"}.`,
    `Copy manual entries: ${settings.copyManualEntries ? "yes" : "no"}.`,
    `Avoid consecutive subject: ${settings.avoidConsecutiveSameSubject ? "yes" : "no"}.`,
    `Spread subjects: ${settings.spreadSubjectsAcrossWeek ? "yes" : "no"}.`,
    `Avoid daily teacher overload: ${settings.avoidTeacherOverloadPerDay ? "yes" : "no"}.`
  ].join(" ");
}

function teachingPeriodNumbers(templates: GeneratorTemplate[], academicYear: string, groupName: string, dayOfWeek: string) {
  let rows = templates.filter((row) =>
    row.academicYear === academicYear
    && row.isTeachingPeriod
    && row.dayOfWeek === dayOfWeek
    && (dayOfWeek === "FRIDAY" ? row.groupName === "FRIDAY" : row.groupName === groupName)
  );
  if (!rows.length && dayOfWeek === "SATURDAY") {
    rows = templates.filter((row) =>
      row.academicYear === academicYear
      && row.isTeachingPeriod
      && row.dayOfWeek === "MONDAY"
      && row.groupName === groupName
    );
  }
  return rows
    .filter((row): row is GeneratorTemplate & { periodNumber: number } => row.periodNumber !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.periodNumber - b.periodNumber)
    .map((row) => row.periodNumber);
}

function expandFixedPeriods(fixedPeriods: GeneratorFixedPeriod[], classes: GeneratorClassSection[], academicYear: string) {
  const classIds = new Set(classes.map((row) => row.id));
  return fixedPeriods
    .filter((row) => row.academicYear === academicYear)
    .flatMap((row) => row.classSectionId
      ? classIds.has(row.classSectionId) ? [row] : []
      : classes.map((classSection) => ({
        ...row,
        classSectionId: classSection.id,
        teacherId: null,
        subjectId: null,
        reason: row.teacherId || row.subjectId
          ? [row.reason, "Global fixed-period teacher/subject was omitted for safety."].filter(Boolean).join(" ")
          : row.reason
      })))
    .sort((a, b) =>
      dayIndex(a.dayOfWeek) - dayIndex(b.dayOfWeek)
      || a.periodNumber - b.periodNumber
      || String(a.classSectionId).localeCompare(String(b.classSectionId))
    );
}

function hardConstraintReason(
  slot: Slot,
  assignment: GeneratorAssignment,
  classOccupied: Set<string>,
  teacherOccupied: Set<string>,
  unavailable: Set<string>
) {
  if (classOccupied.has(classSlotKey(slot.classSectionId, slot.dayOfWeek, slot.periodNumber))) return "CLASS_OCCUPIED";
  const teacherKey = teacherSlotKey(assignment.teacherId, slot.dayOfWeek, slot.periodNumber);
  if (teacherOccupied.has(teacherKey)) return "TEACHER_OCCUPIED";
  if (unavailable.has(teacherKey)) return "TEACHER_UNAVAILABLE";
  return null;
}

function scoreSlot(input: {
  slot: Slot;
  assignment: GeneratorAssignment;
  entries: DraftEntry[];
  teacher: GeneratorTeacher;
  subject: GeneratorSubject;
  teacherDay: Map<string, number>;
  teacherWeek: Map<string, number>;
  classDay: Map<string, number>;
  settings: GeneratorSettings;
}) {
  const { slot, assignment, entries, teacher, subject, teacherDay, teacherWeek, classDay, settings } = input;
  const classSubjectEntries = entries.filter((row) =>
    row.classSectionId === assignment.classSectionId
    && row.subjectId === assignment.subjectId
    && isTeachingEntry(row)
  );
  const sameDay = classSubjectEntries.filter((row) => row.dayOfWeek === slot.dayOfWeek).length;
  const adjacent = classSubjectEntries.some((row) =>
    row.dayOfWeek === slot.dayOfWeek && Math.abs(row.periodNumber - slot.periodNumber) === 1
  );
  const consecutiveAllowed = allowsConsecutivePeriods(
    Boolean(subject.allowConsecutivePeriods),
    assignment.allowConsecutiveOverride
  );
  const dailyTeacherLoad = teacherDay.get(`${assignment.teacherId}|${slot.dayOfWeek}`) ?? 0;
  const weeklyTeacherLoad = teacherWeek.get(assignment.teacherId) ?? 0;
  const dailyClassLoad = classDay.get(`${assignment.classSectionId}|${slot.dayOfWeek}`) ?? 0;
  let score = 1000;
  if (settings.spreadSubjectsAcrossWeek) score -= sameDay * 160;
  if (settings.avoidConsecutiveSameSubject && !consecutiveAllowed && adjacent) score -= 240;
  if (settings.avoidTeacherOverloadPerDay) {
    score -= dailyTeacherLoad * 35;
    if (teacher.maxPeriodsPerDay && dailyTeacherLoad >= teacher.maxPeriodsPerDay) score -= 600;
  }
  score -= dailyClassLoad * 8;
  if (weeklyTeacherLoad >= teacher.maxPeriodsPerWeek) score -= 800;
  score -= dayIndex(slot.dayOfWeek);
  score -= slot.periodNumber / 100;
  return score;
}

function unresolvedReason(
  assignment: GeneratorAssignment,
  slots: Slot[],
  classOccupied: Set<string>,
  teacherOccupied: Set<string>,
  unavailable: Set<string>
) {
  const classSlots = slots.filter((slot) => slot.classSectionId === assignment.classSectionId);
  if (!classSlots.length) return "No teaching periods are configured for this class section.";
  const emptyClassSlots = classSlots.filter((slot) => !classOccupied.has(classSlotKey(slot.classSectionId, slot.dayOfWeek, slot.periodNumber)));
  if (!emptyClassSlots.length) return "All teaching periods for this class section are already occupied.";
  const teacherAvailable = emptyClassSlots.filter((slot) =>
    !unavailable.has(teacherSlotKey(assignment.teacherId, slot.dayOfWeek, slot.periodNumber))
  );
  if (!teacherAvailable.length) return "The teacher is unavailable in every remaining class slot.";
  const conflictFree = teacherAvailable.filter((slot) =>
    !teacherOccupied.has(teacherSlotKey(assignment.teacherId, slot.dayOfWeek, slot.periodNumber))
  );
  if (!conflictFree.length) return "The teacher is already teaching another class in every remaining slot.";
  return "No conflict-free teaching slot remains.";
}

function unresolvedRow(
  assignment: GeneratorAssignment,
  classSection: GeneratorClassSection,
  subject: string,
  teacher: string,
  remainingPeriods: number,
  reason: string
): GeneratorUnresolved {
  return {
    assignmentId: assignment.id,
    classSectionId: classSection.id,
    classSection: classSection.displayName,
    subjectId: assignment.subjectId,
    subject,
    teacherId: assignment.teacherId,
    teacher,
    remainingPeriods,
    reason
  };
}

function copyBaseEntry(entry: DraftEntry): DraftEntry {
  return {
    academicYear: entry.academicYear,
    classSectionId: entry.classSectionId,
    dayOfWeek: entry.dayOfWeek,
    periodNumber: entry.periodNumber,
    assignmentId: entry.assignmentId ?? null,
    teacherId: entry.teacherId ?? null,
    subjectId: entry.subjectId ?? null,
    label: entry.label ?? null,
    entryType: entry.entryType,
    isLocked: Boolean(entry.isLocked),
    notes: entry.notes ?? null
  };
}

function isTeachingEntry(entry: DraftEntry) {
  return ["TEACHING", "FIXED", "SUBSTITUTION"].includes(entry.entryType);
}

function classSlotKey(classSectionId: string, dayOfWeek: string, periodNumber: number) {
  return `${classSectionId}|${dayOfWeek}|${periodNumber}`;
}

function teacherSlotKey(teacherId: string, dayOfWeek: string, periodNumber: number) {
  return `${teacherId}|${dayOfWeek}|${periodNumber}`;
}

function dayIndex(dayOfWeek: string) {
  const index = (TIMETABLE_DAYS as readonly string[]).indexOf(dayOfWeek);
  return index === -1 ? TIMETABLE_DAYS.length : index;
}

function compareEntries(left: DraftEntry, right: DraftEntry) {
  return left.classSectionId.localeCompare(right.classSectionId)
    || dayIndex(left.dayOfWeek) - dayIndex(right.dayOfWeek)
    || left.periodNumber - right.periodNumber
    || String(left.assignmentId ?? "").localeCompare(String(right.assignmentId ?? ""));
}

function compactGeneratorIssues(
  issues: TimetableWarning[],
  classes: GeneratorClassSection[],
  assignments: GeneratorAssignment[]
) {
  const classMap = new Map(classes.map((row) => [row.id, row]));
  const assignmentClassIds = new Set(assignments.map((row) => row.classSectionId));
  const emptyCounts = new Map<string, number>();
  const compact = issues.filter((row) => {
    if (row.code !== "EMPTY_TEACHING_PERIOD" || !row.entityId) return true;
    emptyCounts.set(row.entityId, (emptyCounts.get(row.entityId) ?? 0) + 1);
    return false;
  });
  for (const [classSectionId, count] of emptyCounts) {
    const className = classMap.get(classSectionId)?.displayName ?? "Class section";
    compact.push({
      code: "EMPTY_TEACHING_PERIOD",
      message: assignmentClassIds.has(classSectionId)
        ? `${className} has ${count} empty teaching periods remaining.`
        : `${className} has no workload assignments; ${count} teaching periods remain empty.`,
      severity: "warning",
      entityId: classSectionId
    });
  }
  return compact;
}
