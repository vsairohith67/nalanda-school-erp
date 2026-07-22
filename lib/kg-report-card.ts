import { safeReportCardText } from "@/lib/report-card-templates-shared";

export const KG_EVALUATIONS = ["I", "II", "III", "IV", "V"] as const;
export const KG_ATTENDANCE_MONTHS = ["JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER", "JANUARY", "FEBRUARY", "MARCH", "APRIL"] as const;
export const KG_GROWTH_PERIODS = ["I", "III", "V"] as const;
export const KG_PERSONALITY_CODES = ["G", "S", "N"] as const;
export const KG_GRADE_CODES = ["A+", "A", "B", "C", "D", "E"] as const;

export const KG_RESPONSE_SETS = {
  instruction: ["ALL", "SOME", "VERY_FEW"],
  talks: ["SPONTANEOUSLY", "WHEN_ENCOURAGED", "NEEDS_IMPROVEMENT"],
  vocabulary: ["FULLY_ACQUAINTED", "PARTLY_ACQUAINTED", "NEEDS_IMPROVEMENT"],
  reading: ["ALL", "MANY", "VERY_FEW"],
  speech: ["CLEAR_AUDIBLE", "NEEDS_CLARITY", "NEEDS_AUDIBILITY"],
  pencil: ["PROPER_STEADY", "FAIRLY_STEADY", "NEEDS_HELP"],
  exercise: ["WELL", "FAIRLY_WELL", "NEEDS_HELP"],
  formation: ["GOOD", "SATISFACTORY", "NEEDS_IMPROVEMENT"],
  quality: ["GOOD", "AVERAGE", "NEEDS_IMPROVEMENT"],
  rhymes: ["ENJOYS_MEMORIZES_WELL", "RENDERS_MECHANICALLY"],
  story: ["RECEIVES_WELL_ENJOYS", "ENJOYS_ONLY_LISTENING", "JUST_LISTENS"]
} as const;

export const KG_CRITERIA = [
  ["english_oral_understands", "English oral", "Understands instructions", "instruction"],
  ["english_oral_talks", "English oral", "Talks", "talks"],
  ["english_oral_vocabulary", "English oral", "Vocabulary", "vocabulary"],
  ["english_oral_reading", "English oral", "Reading words / sentences", "reading"],
  ["english_oral_speech", "English oral", "Speech", "speech"],
  ["english_written_pencil", "English written", "Holding of pencil", "pencil"],
  ["english_written_exercises", "English written", "Follows exercises", "exercise"],
  ["english_written_letters", "English written", "Formation of letters", "formation"],
  ["hindi_oral_understands", "Hindi oral", "Understands instructions", "instruction"],
  ["hindi_oral_vocabulary", "Hindi oral", "Vocabulary", "vocabulary"],
  ["hindi_oral_reading", "Hindi oral", "Reading words / sentences", "reading"],
  ["hindi_written_exercises", "Hindi written", "Follows exercises", "exercise"],
  ["hindi_written_letters", "Hindi written", "Formation of letters", "formation"],
  ["number_oral_understands", "Number work oral", "Understands instructions", "instruction"],
  ["number_oral_recognition", "Number work oral", "Recognition of numbers", "quality"],
  ["number_oral_concept", "Number work oral", "Understanding of concept", "quality"],
  ["number_written_numbers", "Number work written", "Writing numbers", "quality"],
  ["number_written_names", "Number work written", "Writing number names", "quality"],
  ["other_environment", "Other", "Environmental study", "quality"],
  ["other_rhymes", "Other", "Rhymes", "rhymes"],
  ["other_story", "Other", "Story", "story"]
] as const;

export const KG_SUMMARY_AREAS = [
  "english_reading", "english_conversation", "english_recitation", "english_written", "english_dictation", "english_home_assignment",
  "hindi_reading", "hindi_recitation", "hindi_written",
  "maths_recognition", "maths_operations", "maths_written", "maths_dictation", "maths_home_assignment",
  "other_environment", "other_drawing", "overall_grade"
] as const;

export const KG_PERSONALITY_TRAITS = [
  "regular_to_school", "punctual", "dresses_neatly", "takes_snacks_lunch", "uses_toilets", "shares_with_others",
  "gets_along_with_students", "speaks_in_english", "self_control", "admits_faults", "responsible_for_belongings",
  "self_confidence", "responds_to_correction", "relates_experiences", "shows_work_with_pleasure", "waits_for_turn",
  "good_listener", "aware_of_hazards", "care_of_personal_things", "appreciates_beauty"
] as const;

export type KgDraft = ReturnType<typeof createEmptyKgDraft>;

export function createEmptyKgDraft() {
  return {
    rubrics: Object.fromEntries(KG_EVALUATIONS.map((evaluation) => [evaluation, {}])) as Record<string, Record<string, string>>,
    summaryGrades: Object.fromEntries(KG_EVALUATIONS.map((evaluation) => [evaluation, {}])) as Record<string, Record<string, string>>,
    personality: Object.fromEntries(KG_EVALUATIONS.map((evaluation) => [evaluation, {}])) as Record<string, Record<string, string>>,
    attendance: KG_ATTENDANCE_MONTHS.map((month) => ({ month, workingDays: null as number | null, daysPresent: null as number | null })),
    attendanceSource: { status: "INCOMPLETE_SOURCE", overrideReason: null as string | null },
    growth: Object.fromEntries(KG_GROWTH_PERIODS.map((evaluation) => [evaluation, { heightCm: null as number | null, weightKg: null as number | null, observationDate: null as string | null }])) as Record<string, { heightCm: number | null; weightKg: number | null; observationDate: string | null }>,
    evaluationComments: Object.fromEntries(KG_EVALUATIONS.map((evaluation) => [evaluation, { comment: "", classTeacherApproval: null, principalApproval: null, directorApproval: null }])) as Record<string, { comment: string; classTeacherApproval: unknown; principalApproval: unknown; directorApproval: unknown }>,
    final: { grade: "", comment: "", nextClass: "", nextSessionStartDate: null as string | null }
  };
}

export function normalizeKgDraft(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("KG report-card data must be an object.");
  const source = input as Record<string, any>;
  const empty = createEmptyKgDraft();
  const draft = {
    ...empty,
    rubrics: source.rubrics ?? empty.rubrics,
    summaryGrades: source.summaryGrades ?? empty.summaryGrades,
    personality: source.personality ?? empty.personality,
    attendance: source.attendance ?? empty.attendance,
    attendanceSource: source.attendanceSource ?? empty.attendanceSource,
    growth: source.growth ?? empty.growth,
    evaluationComments: source.evaluationComments ?? empty.evaluationComments,
    final: source.final ?? empty.final
  };
  exactObjectKeys(draft.rubrics, KG_EVALUATIONS, "KG rubric evaluation periods");
  exactObjectKeys(draft.summaryGrades, KG_EVALUATIONS, "KG summary evaluation periods");
  exactObjectKeys(draft.personality, KG_EVALUATIONS, "KG personality evaluation periods");
  exactObjectKeys(draft.evaluationComments, KG_EVALUATIONS, "KG comment evaluation periods");
  exactObjectKeys(draft.growth, KG_GROWTH_PERIODS, "KG growth evaluation periods");
  validateEvaluationMaps(draft);
  if (!Array.isArray(draft.attendance) || draft.attendance.length !== KG_ATTENDANCE_MONTHS.length) throw new Error("KG attendance must contain June through April exactly once.");
  const monthSet = new Set<string>();
  draft.attendance = draft.attendance.map((row: any) => {
    const month = String(row?.month ?? "").toUpperCase();
    if (!(KG_ATTENDANCE_MONTHS as readonly string[]).includes(month) || monthSet.has(month)) throw new Error("KG attendance months must be unique and use June through April.");
    monthSet.add(month);
    const workingDays = optionalWholeNumber(row?.workingDays, "Working days", 0, 31);
    const daysPresent = optionalHalfNumber(row?.daysPresent, "Days present", 0, 31);
    if (workingDays !== null && daysPresent !== null && daysPresent > workingDays) throw new Error("Days present cannot exceed working days.");
    return { month, workingDays, daysPresent };
  });
  const status = String(draft.attendanceSource?.status ?? "INCOMPLETE_SOURCE").toUpperCase();
  if (!["CALCULATED_FROM_ATTENDANCE", "INCOMPLETE_SOURCE", "MANUALLY_REVIEWED_SNAPSHOT"].includes(status)) throw new Error("Choose a valid attendance source status.");
  const overrideReason = safeReportCardText(draft.attendanceSource?.overrideReason, "Attendance override reason", 1000, false);
  if (status === "MANUALLY_REVIEWED_SNAPSHOT" && !overrideReason) throw new Error("A manual attendance snapshot requires a reason.");
  draft.attendanceSource = { status, overrideReason };
  for (const evaluation of KG_GROWTH_PERIODS) {
    const row = draft.growth?.[evaluation] ?? {};
    const heightCm = optionalHalfNumber(row.heightCm, `Evaluation ${evaluation} height`, 30, 220);
    const weightKg = optionalHalfNumber(row.weightKg, `Evaluation ${evaluation} weight`, 2, 200);
    const observationDate = row.observationDate ? validDateText(row.observationDate, "Growth observation date") : null;
    draft.growth[evaluation] = { heightCm, weightKg, observationDate };
  }
  for (const evaluation of KG_EVALUATIONS) {
    const row = draft.evaluationComments?.[evaluation] ?? {};
    draft.evaluationComments[evaluation] = {
      comment: safeReportCardText(row.comment, `Evaluation ${evaluation} comment`, 1500, false) ?? "",
      classTeacherApproval: safeApproval(row.classTeacherApproval, "CLASS_TEACHER"),
      principalApproval: safeApproval(row.principalApproval, "PRINCIPAL"),
      directorApproval: safeApproval(row.directorApproval, "DIRECTOR")
    };
  }
  draft.final = {
    grade: String(draft.final?.grade ?? "").toUpperCase(),
    comment: safeReportCardText(draft.final?.comment, "Final comment", 2000, false) ?? "",
    nextClass: safeReportCardText(draft.final?.nextClass, "Next class", 40, false) ?? "",
    nextSessionStartDate: draft.final?.nextSessionStartDate ? validDateText(draft.final.nextSessionStartDate, "Next-session start date") : null
  };
  if (draft.final.grade && !(KG_GRADE_CODES as readonly string[]).includes(draft.final.grade)) throw new Error("Choose a valid final KG grade.");
  return draft;
}

export function kgValidationGaps(input: unknown, options: { directorApprovalRequired?: boolean } = {}) {
  let draft: ReturnType<typeof normalizeKgDraft>;
  try { draft = normalizeKgDraft(input); } catch (error) { return [error instanceof Error ? error.message : "KG data is invalid."]; }
  const gaps: string[] = [];
  for (const evaluation of KG_EVALUATIONS) {
    for (const [key, , label] of KG_CRITERIA) if (!draft.rubrics[evaluation]?.[key]) gaps.push(`Evaluation ${evaluation}: ${label}`);
    for (const key of KG_SUMMARY_AREAS) if (!draft.summaryGrades[evaluation]?.[key]) gaps.push(`Evaluation ${evaluation}: summary ${key.replaceAll("_", " ")}`);
    for (const key of KG_PERSONALITY_TRAITS) if (!draft.personality[evaluation]?.[key]) gaps.push(`Evaluation ${evaluation}: personality ${key.replaceAll("_", " ")}`);
    if (!draft.evaluationComments[evaluation]?.comment) gaps.push(`Evaluation ${evaluation}: comment`);
    if (!draft.evaluationComments[evaluation]?.classTeacherApproval) gaps.push(`Evaluation ${evaluation}: Class Teacher approval`);
    if (!draft.evaluationComments[evaluation]?.principalApproval) gaps.push(`Evaluation ${evaluation}: Principal approval`);
    if (options.directorApprovalRequired && !draft.evaluationComments[evaluation]?.directorApproval) gaps.push(`Evaluation ${evaluation}: Director approval`);
  }
  for (const row of draft.attendance) if (row.workingDays === null || row.daysPresent === null) gaps.push(`${row.month}: attendance`);
  if (draft.attendanceSource.status === "INCOMPLETE_SOURCE") gaps.push("Attendance source is incomplete; review the snapshot and record a reason");
  for (const evaluation of KG_GROWTH_PERIODS) {
    const row = draft.growth[evaluation];
    if (row.heightCm === null || row.weightKg === null) gaps.push(`Evaluation ${evaluation}: physical growth`);
  }
  if (!draft.final.grade) gaps.push("Final grade");
  if (!draft.final.comment) gaps.push("Final comment");
  return gaps;
}

function validateEvaluationMaps(draft: any) {
  const criterionOptions = new Map<string, Set<string>>(KG_CRITERIA.map(([key, , , set]) => [key, new Set<string>(KG_RESPONSE_SETS[set])]));
  for (const evaluation of KG_EVALUATIONS) {
    for (const [key, value] of Object.entries(draft.rubrics?.[evaluation] ?? {})) {
      if (!criterionOptions.has(key) || (value && !criterionOptions.get(key)!.has(String(value)))) throw new Error(`Evaluation ${evaluation} contains an invalid KG rubric response.`);
    }
    for (const [key, value] of Object.entries(draft.summaryGrades?.[evaluation] ?? {})) {
      if (!(KG_SUMMARY_AREAS as readonly string[]).includes(key) || (value && !(KG_GRADE_CODES as readonly string[]).includes(String(value)))) throw new Error(`Evaluation ${evaluation} contains an invalid summary grade.`);
    }
    for (const [key, value] of Object.entries(draft.personality?.[evaluation] ?? {})) {
      if (!(KG_PERSONALITY_TRAITS as readonly string[]).includes(key) || (value && !(KG_PERSONALITY_CODES as readonly string[]).includes(String(value)))) throw new Error(`Evaluation ${evaluation} contains an invalid personality grade.`);
    }
  }
}

function safeApproval(value: any, expectedRole: string) {
  if (!value) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("Approval details must be an object.");
  const role = safeReportCardText(value.role, "Approval role", 60)!;
  if (role !== expectedRole) throw new Error(`Approval role must be ${expectedRole}.`);
  return { name: safeReportCardText(value.name, "Approval name", 120)!, role, approvedAt: validDateText(value.approvedAt, "Approval date") };
}
function exactObjectKeys(value: unknown, expected: readonly string[], label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  const keys = Object.keys(value);
  if (keys.length !== expected.length || expected.some((key) => !keys.includes(key))) throw new Error(`${label} must contain only ${expected.join(", ")}.`);
}
function optionalWholeNumber(value: unknown, label: string, minimum: number, maximum: number) { if (value === null || value === undefined || value === "") return null; const number = Number(value); if (!Number.isInteger(number) || number < minimum || number > maximum) throw new Error(`${label} must be a whole number from ${minimum} to ${maximum}.`); return number; }
function optionalHalfNumber(value: unknown, label: string, minimum: number, maximum: number) { if (value === null || value === undefined || value === "") return null; const number = Number(value); if (!Number.isFinite(number) || number < minimum || number > maximum || Math.round(number * 2) !== number * 2) throw new Error(`${label} must be from ${minimum} to ${maximum} in 0.5 increments.`); return number; }
function validDateText(value: unknown, label: string) { const text = String(value ?? ""); if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(new Date(`${text}T00:00:00Z`).getTime())) throw new Error(`${label} must use YYYY-MM-DD.`); return text; }
