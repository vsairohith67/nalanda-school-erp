export const WHATSAPP_PARAMETER_ALLOWLIST = [
  "school_name",
  "campaign_title",
  "campaign_category",
  "recipient_label",
  "child_context"
] as const;

const TEMPLATE_NAME = /^[a-z0-9_]{1,512}$/;
const LANGUAGE = /^[a-z]{2,3}(?:_[A-Z]{2})?$/;
const MAPPING_CODE = /^[A-Z0-9][A-Z0-9_-]{2,39}$/;
const PROHIBITED_PARAMETER = /(student_name|admission|marks?|fee|balance|health|certificate|phone|mobile|email|address|aadhaar|raw|id)/i;

export function validateWhatsAppTemplateMappingInput(input: any) {
  const mappingCode = String(input?.mappingCode ?? "").trim().toUpperCase();
  const metaTemplateName = String(input?.metaTemplateName ?? "").trim();
  const metaTemplateLanguage = String(input?.metaTemplateLanguage ?? "").trim();
  const metaTemplateCategory = String(input?.metaTemplateCategory ?? "").trim().toUpperCase();
  const notificationCategory = String(input?.notificationCategory ?? "").trim().toUpperCase();
  const internalPurpose = String(input?.internalPurpose ?? "").trim();
  if (!MAPPING_CODE.test(mappingCode)) throw new Error("Mapping code must use 3–40 uppercase letters, numbers, underscore or hyphen.");
  if (!TEMPLATE_NAME.test(metaTemplateName)) throw new Error("Meta template name must use lowercase letters, numbers and underscores.");
  if (!LANGUAGE.test(metaTemplateLanguage)) throw new Error("Meta template language must use a supported locale code such as en_US.");
  if (!["MARKETING", "UTILITY"].includes(metaTemplateCategory)) {
    throw new Error("Prompt 19B supports only the category returned by Meta for Marketing or Utility templates. Authentication/OTP is out of scope.");
  }
  if (!notificationCategory || !internalPurpose) throw new Error("Notification category and internal purpose are required.");
  const definitions = parseParameterDefinition(input?.parameterDefinition ?? input?.parameterDefinitionJson);
  return {
    mappingCode,
    integrationProfileId: required(input?.integrationProfileId, "Integration profile"),
    notificationCategory,
    internalPurpose: internalPurpose.slice(0, 200),
    metaTemplateName,
    metaTemplateLanguage,
    metaTemplateCategory,
    providerTemplateId: optional(input?.providerTemplateId),
    providerStatus: String(input?.providerStatus ?? "UNKNOWN").trim().toUpperCase(),
    parameterDefinitionJson: JSON.stringify(definitions),
    sampleValuesJson: input?.sampleValues ? JSON.stringify(input.sampleValues) : optional(input?.sampleValuesJson)
  };
}

export function parseParameterDefinition(value: unknown): string[] {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); }
    catch { parsed = value.split(",").map((item) => item.trim()).filter(Boolean); }
  }
  if (!Array.isArray(parsed)) throw new Error("Template parameter definition must be an array.");
  const parameters = parsed.map((item) => typeof item === "string" ? item : String((item as any)?.name ?? "")).filter(Boolean);
  if (new Set(parameters).size !== parameters.length) throw new Error("Template parameter names must be unique.");
  for (const parameter of parameters) {
    if (PROHIBITED_PARAMETER.test(parameter) || !(WHATSAPP_PARAMETER_ALLOWLIST as readonly string[]).includes(parameter)) {
      throw new Error(`Template parameter ${parameter} is not allowlisted for Prompt 19B.`);
    }
  }
  return parameters;
}

export function renderWhatsAppTemplateParameters(mapping: any, campaign: any, subject: { type: string; childCount?: number }) {
  const definitions = parseParameterDefinition(mapping.parameterDefinitionJson);
  const values: Record<string, string> = {
    school_name: "Nalanda Public School",
    campaign_title: safeText(campaign.title, 120),
    campaign_category: safeText(campaign.category, 40),
    recipient_label: subject.type === "GUARDIAN" ? "Parent/Guardian" : "Staff Member",
    child_context: subject.type === "GUARDIAN"
      ? subject.childCount && subject.childCount > 1 ? "your linked children" : "your linked child"
      : "staff communication"
  };
  return definitions.map((name) => ({ name, value: values[name] }));
}

export async function createWhatsAppTemplateMapping(client: any, input: any, actorId: string) {
  const data = validateWhatsAppTemplateMappingInput(input);
  const profile = await client.whatsAppIntegrationProfile.findUnique({ where: { id: data.integrationProfileId } });
  if (!profile) throw new Error("Integration profile was not found.");
  return client.whatsAppTemplateMapping.create({
    data: { ...data, status: "DRAFT", createdByUserId: actorId }
  });
}

export async function setWhatsAppTemplateMappingStatus(client: any, id: string, action: string, actorId: string) {
  const row = await client.whatsAppTemplateMapping.findUnique({ where: { id } });
  if (!row) throw new Error("Template mapping was not found.");
  if (action === "activate") {
    if (row.providerStatus !== "APPROVED") throw new Error("Only a provider-approved template can be activated.");
    parseParameterDefinition(row.parameterDefinitionJson);
    return client.whatsAppTemplateMapping.update({ where: { id }, data: { status: "ACTIVE", activatedByUserId: actorId } });
  }
  if (action === "inactivate") return client.whatsAppTemplateMapping.update({ where: { id }, data: { status: "INACTIVE" } });
  throw new Error("Unsupported template mapping action.");
}

function safeText(value: unknown, max: number) {
  const text = String(value ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  if (!text || text.length > max) throw new Error("Campaign text cannot be rendered safely into the approved template.");
  if (/(aadhaar|marks?|fee balance|medical|health|password|student id)/i.test(text)) {
    throw new Error("Campaign title contains data prohibited from Prompt 19B template parameters.");
  }
  return text;
}
function required(value: unknown, label: string) { const text = String(value ?? "").trim(); if (!text) throw new Error(`${label} is required.`); return text; }
function optional(value: unknown) { const text = String(value ?? "").trim(); return text || null; }
