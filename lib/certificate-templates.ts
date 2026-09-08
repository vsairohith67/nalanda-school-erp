export const CERTIFICATE_TYPES = ["BONAFIDE", "STUDY", "CONDUCT", "TRANSFER", "GRADUATION"] as const;
export const GRADUATION_DISCLAIMER = "School-issued institutional recognition only. This Graduation Certificate does not replace a statutory Board or Council marks sheet, pass certificate, migration certificate or Transfer Certificate (TC).";
export type CertificateType = (typeof CERTIFICATE_TYPES)[number];
export const CONDUCT_STATEMENTS = ["GOOD", "SATISFACTORY", "REVIEWED_CUSTOM"] as const;

const FORBIDDEN = /<\s*\/?\s*(script|iframe|object|embed|style|form)|javascript:|on\w+\s*=|aadhaar|caste|religion|disability|passwordhash|bank\s*(account|details)/i;

export function isCertificateType(value: unknown): value is CertificateType {
  return CERTIFICATE_TYPES.includes(String(value).toUpperCase() as CertificateType);
}

export function normalizeCode(value: unknown, label = "Code") {
  const code = String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!code || code.length > 60) throw new Error(`${label} must contain 1 to 60 letters, numbers, hyphens, or underscores.`);
  return code;
}

export type CertificateTemplateDefinition = {
  heading: string;
  body: string;
  enabledFields?: string[];
  conductStatement?: "GOOD" | "SATISFACTORY" | "REVIEWED_CUSTOM";
  customConductText?: string;
  signatories?: Array<{ name: string; role: string }>;
  recognitionText?: string;
  mediumOfInstruction?: string;
  disclaimer?: string;
};

const ALLOWED_FIELDS = new Set([
  "studentName", "admissionNumber", "dateOfBirth", "fatherName", "motherName", "className", "section",
  "academicYear", "admissionDate", "leavingDate", "lastAttendanceDate", "attendanceSummary",
  "reasonForLeaving", "promotionDisplay", "purpose", "schoolContact", "recognitionText", "mediumOfInstruction"
]);

export function validateCertificateTemplateDefinition(type: unknown, input: unknown): CertificateTemplateDefinition {
  if (!isCertificateType(type)) throw new Error("Certificate type must be BONAFIDE, STUDY, CONDUCT, or TRANSFER.");
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Template definition must be an object.");
  const source = input as Record<string, unknown>;
  const heading = String(source.heading ?? "").trim();
  const body = String(source.body ?? "").trim();
  const disclaimer = type === "GRADUATION" ? String(source.disclaimer ?? "").trim() : undefined;
  if (type === "GRADUATION") {
    const supplement = disclaimer?.replace(GRADUATION_DISCLAIMER, "") ?? "";
    const claims = /board|council|marks\s*sheet|pass(?:ed)?|migration|transfer|replace|statutory|\bTC\b/i;
    if (claims.test(supplement) || source.customConductText || source.conductStatement || source.mediumOfInstruction || /\{\{(?!studentName\}\}|academicYear\}\})/.test(body)) throw new Error("Unsupported Graduation claim or placeholder. Use only reviewed Student name and academic year.");
    const roles = ["Principal", "Director", "Head of School", "Authorized Signatory", "Correspondent"];
    if (!Array.isArray(source.signatories) || !source.signatories.length || source.signatories.some((s: any) => !roles.includes(s?.role) || s?.name)) throw new Error("Choose an authorized signatory role; typed personal signatures are unavailable.");
    if (!disclaimer?.includes(GRADUATION_DISCLAIMER) || disclaimer.length > 2000) throw new Error("Preserve the mandatory institutional-recognition disclaimer; approved supplemental wording may be appended.");
    if (/board|council|marks\s*sheet|pass(?:ed)?|migration|transfer|\bTC\b/i.test(`${heading} ${body} ${source.recognitionText ?? ""}`)) throw new Error("Graduation wording cannot claim Board success or statutory document status.");
  }
  if (!heading || heading.length > 120) throw new Error("Template heading is required and must be at most 120 characters.");
  if (!body || body.length > 4000) throw new Error("Template body is required and must be at most 4000 characters.");
  if (FORBIDDEN.test(JSON.stringify(source))) throw new Error("Template contains unsafe or sensitive content.");
  const enabledFields = Array.isArray(source.enabledFields) ? source.enabledFields.map(String) : [];
  const unsupported = enabledFields.find((field) => !ALLOWED_FIELDS.has(field));
  if (unsupported) throw new Error(`Unsupported certificate field: ${unsupported}`);
  const conductStatement = source.conductStatement == null ? undefined : String(source.conductStatement) as CertificateTemplateDefinition["conductStatement"];
  if (conductStatement && !CONDUCT_STATEMENTS.includes(conductStatement)) throw new Error("Unsupported conduct statement.");
  const customConductText = String(source.customConductText ?? "").trim() || undefined;
  if (conductStatement === "REVIEWED_CUSTOM" && (!customConductText || customConductText.length > 500)) {
    throw new Error("Reviewed custom conduct wording is required and must be at most 500 characters.");
  }
  return { heading, body, enabledFields, conductStatement, customConductText, disclaimer, signatories: Array.isArray(source.signatories) ? source.signatories.slice(0, 3).map((row: any) => ({ name: String(row?.name ?? "").slice(0, 100), role: String(row?.role ?? "").slice(0, 100) })) : [], recognitionText: String(source.recognitionText ?? "").slice(0, 500) || undefined, mediumOfInstruction: String(source.mediumOfInstruction ?? "").slice(0, 100) || undefined };
}

export function defaultTemplateDefinition(type: CertificateType): CertificateTemplateDefinition {
  const headings = { BONAFIDE: "BONAFIDE CERTIFICATE", STUDY: "STUDY CERTIFICATE", CONDUCT: "CONDUCT CERTIFICATE", TRANSFER: "TRANSFER CERTIFICATE", GRADUATION: "GRADUATION CERTIFICATE" };
  return {
    heading: headings[type],
    ...(type === "GRADUATION" ? { disclaimer: GRADUATION_DISCLAIMER } : {}),
    body: type === "GRADUATION" ? "This school recognizes {{studentName}} for completion of the reviewed Class X school programme in {{academicYear}}." : type === "BONAFIDE" ? "This is to certify that {{studentName}} is/was a bonafide Student of this school for the reviewed academic period."
      : type === "STUDY" ? "This is to certify that {{studentName}} studied at this school during the reviewed periods listed below."
      : type === "CONDUCT" ? "The approved conduct of {{studentName}} during the reviewed period was {{conductText}}."
      : "This Transfer Certificate records the reviewed school information for {{studentName}}. Issuing it does not itself change Student status.",
    enabledFields: type === "TRANSFER" ? ["studentName", "admissionNumber", "dateOfBirth", "fatherName", "motherName", "admissionDate", "className", "academicYear", "lastAttendanceDate", "attendanceSummary", "leavingDate", "reasonForLeaving", "promotionDisplay"] : ["studentName", "admissionNumber", "className", "academicYear", "purpose"],
    ...(type === "CONDUCT" ? { conductStatement: "GOOD" as const } : {}),
    signatories: [{ name: "", role: "Principal" }]
  };
}
