export const OPERATIONAL_DAY_TYPES = ["WORKING_DAY", "NON_WORKING_DAY", "HALF_DAY", "VACATION_DAY", "SPECIAL_WORKING_DAY", "EMERGENCY_CLOSURE"] as const;
export const SCHOOL_EVENT_TYPES = ["SCHOOL_FUNCTION", "PARENT_MEETING", "ACTIVITY", "COMPETITION", "ACADEMIC_DEADLINE", "STAFF_MEETING", "EXAMINATION_REFERENCE", "CLASS_EVENT", "OTHER"] as const;
export const SCHOOL_EVENT_AUDIENCES = ["SCHOOL_WIDE", "STAFF_ONLY", "PARENTS_ALL", "ROLE_SPECIFIC", "CLASS", "CLASS_SECTION", "LINKED_CHILD_COHORT", "LEADERSHIP_ONLY"] as const;

export function humanCalendarLabel(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
