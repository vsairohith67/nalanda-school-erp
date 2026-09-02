import { requireApiPermission } from "@/lib/auth";
import { requireAdmissionsAny } from "@/lib/admissions-api";
import type { OcrContextType } from "@/lib/ocr-scanning/contracts";
import type { CanonicalPermission, Permission } from "@/lib/permissions";

export type OcrAction = "UPLOAD" | "VIEW_SOURCE" | "RUN" | "REVIEW" | "SUBMIT" | "REJECT" | "PURGE" | "VIEW_AUDIT";

const PERMISSION_BY_CONTEXT: Record<Exclude<OcrContextType, "ADMISSION">, Record<OcrAction, Permission>> = {
  STUDENT: {
    UPLOAD: "EDIT_STUDENTS", VIEW_SOURCE: "VIEW_STUDENTS", RUN: "EDIT_STUDENTS", REVIEW: "EDIT_STUDENTS",
    SUBMIT: "EDIT_STUDENTS", REJECT: "EDIT_STUDENTS", PURGE: "EDIT_STUDENTS", VIEW_AUDIT: "VIEW_STUDENTS"
  },
  GUARDIAN: {
    UPLOAD: "MANAGE_GUARDIANS", VIEW_SOURCE: "VIEW_GUARDIANS", RUN: "MANAGE_GUARDIANS", REVIEW: "MANAGE_GUARDIANS",
    SUBMIT: "MANAGE_GUARDIANS", REJECT: "MANAGE_GUARDIANS", PURGE: "MANAGE_GUARDIANS", VIEW_AUDIT: "VIEW_GUARDIANS"
  },
  STAFF: {
    UPLOAD: "MANAGE_STAFF", VIEW_SOURCE: "VIEW_STAFF", RUN: "MANAGE_STAFF", REVIEW: "MANAGE_STAFF",
    SUBMIT: "MANAGE_STAFF", REJECT: "MANAGE_STAFF", PURGE: "MANAGE_STAFF", VIEW_AUDIT: "VIEW_STAFF"
  }
};

const ADMISSION_PERMISSIONS: Record<OcrAction, CanonicalPermission[]> = {
  UPLOAD: ["MANAGE_ADMISSION_DOCUMENTS"],
  VIEW_SOURCE: ["MANAGE_ADMISSION_DOCUMENTS", "REVIEW_ADMISSION_APPLICATIONS"],
  RUN: ["REVIEW_ADMISSION_APPLICATIONS"],
  REVIEW: ["REVIEW_ADMISSION_APPLICATIONS"],
  SUBMIT: ["MANAGE_ADMISSION_APPLICATIONS"],
  REJECT: ["REVIEW_ADMISSION_APPLICATIONS"],
  PURGE: ["MANAGE_ADMISSION_RETENTION"],
  VIEW_AUDIT: ["VIEW_ADMISSIONS", "VIEW_ADMISSION_REPORTS"]
};

export async function requireOcrContextAction(contextType: OcrContextType, action: OcrAction) {
  if (contextType === "ADMISSION") return requireAdmissionsAny(ADMISSION_PERMISSIONS[action]);
  return requireApiPermission(PERMISSION_BY_CONTEXT[contextType][action]);
}
