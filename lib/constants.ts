export const ACADEMIC_YEAR = "2026-27";

export const STUDENT_STATUSES = ["Active", "Cancelled", "TC", "Left"] as const;
export const STUDENT_TYPES = ["Normal", "Faculty Child", "Concession"] as const;
export const CLASS_NAMES = [
  "Nursery",
  "LKG",
  "UKG",
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X"
] as const;

export const BANK_TRANSFER_PAYMENT_MODES = ["NEFT", "RTGS", "IMPS", "Bank Transfer"] as const;
export const BANK_OTHER_PAYMENT_MODES = [...BANK_TRANSFER_PAYMENT_MODES, "Cheque", "Other"] as const;
export const PAYMENT_MODES = ["Cash", "UPI", ...BANK_OTHER_PAYMENT_MODES] as const;
export const RECEIVED_ACCOUNTS = [
  "Cash",
  "Director Sir GPay",
  "NPS Current Account UPI",
  "NPS Bank Account",
  "Other"
] as const;
export const FEE_TYPES = ["Current Year Fee", "Old Due", "Admission Fee", "Other"] as const;
export const TERM_HINTS = ["Auto", "Term 1", "Term 2", "Term 3", "Term 4", "Multiple", "Old Due", "Other"] as const;

export const DEFAULT_FEE_STRUCTURE = [
  { classes: ["Nursery", "LKG", "UKG"], termAmount: 7800 },
  { classes: ["I", "II"], termAmount: 8600 },
  { classes: ["III", "IV", "V"], termAmount: 9200 },
  { classes: ["VI", "VII", "VIII"], termAmount: 10000 },
  { classes: ["IX"], termAmount: 11300 },
  { classes: ["X"], termAmount: 12000 }
];

export const LOWER_SCHOOL_DUE_MONTHS = ["June", "September", "December", "February"] as const;
export const HIGH_SCHOOL_DUE_MONTHS = ["April", "July", "October", "January"] as const;

export function isHighSchoolExamClass(className: string) {
  return ["IX", "X"].includes(normalizeClassName(className));
}

export function dueMonthsForClass(className: string) {
  return isHighSchoolExamClass(className) ? [...HIGH_SCHOOL_DUE_MONTHS] : [...LOWER_SCHOOL_DUE_MONTHS];
}

export function normalizeClassName(value: string) {
  const cleaned = value.trim().toUpperCase()
    .replace(/^(CLASS|GRADE)\s*/, "")
    .replace(/\s+/g, "");
  const map: Record<string, string> = {
    NURSERY: "Nursery",
    NUR: "Nursery",
    LKG: "LKG",
    PP1: "LKG",
    UKG: "UKG",
    PP2: "UKG",
    "1": "I",
    "1ST": "I",
    I: "I",
    "2": "II",
    "2ND": "II",
    II: "II",
    "3": "III",
    "3RD": "III",
    III: "III",
    "4": "IV",
    "4TH": "IV",
    IV: "IV",
    "5": "V",
    "5TH": "V",
    V: "V",
    "6": "VI",
    "6TH": "VI",
    VI: "VI",
    "7": "VII",
    "7TH": "VII",
    VII: "VII",
    "8": "VIII",
    "8TH": "VIII",
    VIII: "VIII",
    "9": "IX",
    "9TH": "IX",
    IX: "IX",
    "10": "X",
    "10TH": "X",
    X: "X"
  };
  return map[cleaned] ?? value.trim();
}

export function isValidClassName(value: string) {
  return (CLASS_NAMES as readonly string[]).includes(normalizeClassName(value));
}
