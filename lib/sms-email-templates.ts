import { channelOf } from "@/lib/sms-email-profiles";

export const SMS_EMAIL_PARAMETER_ALLOWLIST = [
  "schoolName", "notificationTitle", "notificationBody", "academicYear", "className", "section",
  "dueDate", "childFirstName", "safeInternalPortalLabel", "schoolOfficePhone", "schoolOfficeEmail"
] as const;

const PROHIBITED = /(marks?|fee.?balance|medical|health|aadhaar|certificate.?number|password|raw.?id|student.?id)/i;
const PLACEHOLDER = /\{\{([A-Za-z][A-Za-z0-9]*)\}\}/g;

export function validateSmsEmailTemplateInput(input: any) {
  const channel = channelOf(input?.channel);
  const mappingCode = String(input?.mappingCode ?? "").trim().toUpperCase();
  const notificationCategory = required(input?.notificationCategory, "Notification category").toUpperCase();
  const internalPurpose = required(input?.internalPurpose, "Internal purpose").slice(0, 200);
  if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(mappingCode)) throw new Error("Mapping code must use 3–40 uppercase letters, numbers, underscore or hyphen.");
  const parameters = parseParameters(input?.parameterDefinition ?? input?.parameterDefinitionJson);
  const base = {
    mappingCode,
    integrationProfileId: required(input?.integrationProfileId, "Integration profile"),
    channel,
    notificationCategory,
    internalPurpose,
    providerStatus: String(input?.providerStatus ?? "UNKNOWN").trim().toUpperCase(),
    parameterDefinitionJson: JSON.stringify(parameters),
    sampleValuesJson: optional(input?.sampleValuesJson)
  };
  if (channel === "SMS") {
    const text = safeTemplate(input?.smsTemplateText, 1000, "SMS template");
    const smsHeader = required(input?.smsHeader, "Registered SMS header").toUpperCase();
    if (!/^[A-Z0-9-]{3,11}$/.test(smsHeader)) throw new Error("SMS header must be a registered 3–11 character identity.");
    const smsDltTemplateId = required(input?.smsDltTemplateId, "DLT content-template ID");
    validatePlaceholders(text, parameters);
    return {
      ...base,
      smsPrincipalEntityReference: required(input?.smsPrincipalEntityReference, "Principal Entity reference"),
      smsHeader,
      smsDltTemplateId,
      smsTemplateCategory: "SERVICE",
      smsTemplateText: text,
      emailSenderAlias: null, emailSubjectTemplate: null, emailTextTemplate: null, emailReplyToAlias: null
    };
  }
  const subject = safeTemplate(input?.emailSubjectTemplate, 180, "Email subject");
  const body = safeTemplate(input?.emailTextTemplate, 10_000, "Email body");
  validatePlaceholders(`${subject}\n${body}`, parameters);
  return {
    ...base,
    smsPrincipalEntityReference: null, smsHeader: null, smsDltTemplateId: null, smsTemplateCategory: null, smsTemplateText: null,
    emailSenderAlias: required(input?.emailSenderAlias, "Approved Email sender alias").toLowerCase(),
    emailSubjectTemplate: subject, emailTextTemplate: body,
    emailReplyToAlias: optional(input?.emailReplyToAlias)?.toLowerCase() ?? null
  };
}

export async function createSmsEmailTemplate(client: any, input: any, actorId: string) {
  const data = validateSmsEmailTemplateInput(input);
  const profile = await client.smsEmailIntegrationProfile.findUnique({ where: { id: data.integrationProfileId } });
  if (!profile || profile.channel !== data.channel) throw new Error("Template channel must match its integration profile.");
  if (data.channel === "EMAIL" && profile.senderDomain && !data.emailSenderAlias?.endsWith(`@${profile.senderDomain}`)) {
    throw new Error("Email sender alias must use the configured sender domain.");
  }
  return client.smsEmailTemplateMapping.create({ data: { ...data, status: "DRAFT", createdByUserId: actorId } });
}

export async function setSmsEmailTemplateStatus(client: any, id: string, action: string, actorId: string) {
  const row = await client.smsEmailTemplateMapping.findUnique({ where: { id } });
  if (!row) throw new Error("SMS/Email template mapping was not found.");
  if (action === "activate") {
    if (row.providerStatus !== "APPROVED") throw new Error("Only a provider/DLT-approved template can be activated.");
    validateSmsEmailTemplateInput(row);
    return client.smsEmailTemplateMapping.update({ where: { id }, data: { status: "ACTIVE", activatedByUserId: actorId } });
  }
  if (action === "inactivate") return client.smsEmailTemplateMapping.update({ where: { id }, data: { status: "INACTIVE" } });
  throw new Error("Unsupported template action.");
}

export function renderSmsEmailTemplate(mapping: any, campaign: any, context: { childCount?: number; childFirstName?: string | null } = {}) {
  const parameters = parseParameters(mapping.parameterDefinitionJson);
  const values: Record<string, string> = {
    schoolName: "Nalanda Public School",
    notificationTitle: safeValue(campaign.title, 140),
    notificationBody: safeValue(campaign.body ?? campaign.message ?? campaign.title, 2000),
    academicYear: safeValue(campaign.academicYear ?? "2026-27", 20),
    className: safeValue(campaign.className ?? "School", 40),
    section: safeValue(campaign.section ?? "", 20, true),
    dueDate: safeValue(campaign.dueDate ?? "", 30, true),
    childFirstName: context.childCount === 1 ? safeValue(context.childFirstName ?? "your child", 60) : "your child",
    safeInternalPortalLabel: "Nalanda Parent Portal",
    schoolOfficePhone: "School office",
    schoolOfficeEmail: "school office"
  };
  const render = (template: string | null) => String(template ?? "").replace(PLACEHOLDER, (_all, name) => {
    if (!parameters.includes(name)) throw new Error(`Template parameter ${name} is not approved.`);
    return values[name] ?? "";
  });
  const renderedSubject = mapping.channel === "EMAIL" ? render(mapping.emailSubjectTemplate) : null;
  const renderedBody = render(mapping.channel === "SMS" ? mapping.smsTemplateText : mapping.emailTextTemplate);
  if (mapping.channel === "SMS") {
    const exact = render(mapping.smsTemplateText);
    if (renderedBody !== exact) throw new Error("Rendered SMS does not exactly match the registered DLT template.");
  }
  return { subject: renderedSubject, body: renderedBody, parameters: Object.fromEntries(parameters.map((name) => [name, values[name]])) };
}

export function estimateSmsSegments(text: string) {
  const gsm = /^[\x0A\x0D\x20-\x7E€£¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉÄÖÑÜ§¿äöñüà^{}\\\[~\]|]*$/.test(text);
  const length = [...text].length;
  const single = gsm ? 160 : 70;
  const multipart = gsm ? 153 : 67;
  return { encoding: gsm ? "GSM_COMPATIBLE" : "UNICODE", segments: length <= single ? 1 : Math.ceil(length / multipart), characters: length };
}

function parseParameters(value: unknown) {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); } catch { parsed = value.split(",").map((item) => item.trim()).filter(Boolean); }
  }
  if (!Array.isArray(parsed)) throw new Error("Template parameter definition must be an array.");
  const names = parsed.map(String);
  if (new Set(names).size !== names.length) throw new Error("Template parameter names must be unique.");
  for (const name of names) if (!(SMS_EMAIL_PARAMETER_ALLOWLIST as readonly string[]).includes(name) || PROHIBITED.test(name)) throw new Error(`Template parameter ${name} is not allowlisted.`);
  return names;
}
function validatePlaceholders(text: string, parameters: string[]) {
  const used = [...text.matchAll(PLACEHOLDER)].map((match) => match[1]);
  for (const name of used) if (!parameters.includes(name)) throw new Error(`Placeholder ${name} is not declared in the approved parameter definition.`);
  if (/\{\{|\}\}/.test(text.replace(PLACEHOLDER, ""))) throw new Error("Template contains a malformed placeholder.");
}
function safeTemplate(value: unknown, max: number, label: string) {
  const text = String(value ?? "").replace(/\r\n/g, "\n").trim();
  if (!text || text.length > max || PROHIBITED.test(text)) throw new Error(`${label} is empty, too long, or contains prohibited sensitive content.`);
  if (/<\/?[A-Za-z][^>]*>/.test(text)) throw new Error(`${label} must be plain text; arbitrary HTML is not allowed.`);
  if (/\bhttps?:\/\/\S+/i.test(text)) throw new Error(`${label} cannot contain an external link that bypasses portal permissions.`);
  return text;
}
function safeValue(value: unknown, max: number, allowEmpty = false) {
  const text = String(value ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  if ((!text && !allowEmpty) || text.length > max || PROHIBITED.test(text)) throw new Error("Campaign data cannot be rendered safely.");
  return text;
}
function required(value: unknown, label: string) { const text = String(value ?? "").trim(); if (!text) throw new Error(`${label} is required.`); return text; }
function optional(value: unknown) { const text = String(value ?? "").trim(); return text || null; }
