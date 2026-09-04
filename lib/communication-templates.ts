import { createHash } from "node:crypto";
import { validateActionPath } from "@/lib/communication-policy";
import type { CommunicationChannel, CommunicationPurpose } from "@/lib/communication-types";

export const COMMUNICATION_LOCALES = ["en-IN", "te-IN", "hi-IN"] as const;
export type CommunicationLocale = (typeof COMMUNICATION_LOCALES)[number];
export const COMMUNICATION_PLACEHOLDER_ALLOWLIST = [
  "recipientDisplayName", "studentDisplayName", "classLabel", "meetingDate",
  "safeReference", "actionUrl", "schoolDisplayName"
] as const;
type Placeholder = (typeof COMMUNICATION_PLACEHOLDER_ALLOWLIST)[number];

type LocalizedCopy = { title: string; externalBody: string; inAppBody: string; reviewStatus: "APPROVED" | "DRAFT_PENDING_LANGUAGE_REVIEW" };
export type CommunicationTemplateFamily = {
  key: string;
  version: 1;
  eventType: string;
  purpose: CommunicationPurpose;
  module: string;
  actionPath: string;
  placeholders: readonly Placeholder[];
  copy: Record<CommunicationLocale, LocalizedCopy>;
};

const draft = (title: string, body: string): LocalizedCopy => ({ title, externalBody: body, inAppBody: `${body} వివరాల కోసం సురక్షిత యాప్‌ను తెరవండి.`, reviewStatus: "DRAFT_PENDING_LANGUAGE_REVIEW" });
const draftHindi = (title: string, body: string): LocalizedCopy => ({ title, externalBody: body, inAppBody: `${body} अधिकृत विवरण के लिए सुरक्षित ऐप खोलें।`, reviewStatus: "DRAFT_PENDING_LANGUAGE_REVIEW" });
const english = (title: string, externalBody: string, inAppBody = externalBody): LocalizedCopy => ({ title, externalBody, inAppBody, reviewStatus: "APPROVED" });

export const COMMUNICATION_TEMPLATE_CATALOGUE: readonly CommunicationTemplateFamily[] = [
  family("ACCOUNT_INVITATION", "INVITATION_CREATED", "SECURITY_CRITICAL", "IDENTITY_ACCESS", "/activate", english("Account invitation available", "A one-time account invitation is available from {{schoolDisplayName}}.", "A one-time account invitation is available. Use only the protected activation link before it expires."), draft("ఖాతా ఆహ్వానం అందుబాటులో ఉంది", "{{schoolDisplayName}} నుండి ఒకసారి ఉపయోగించే ఖాతా ఆహ్వానం అందుబాటులో ఉంది."), draftHindi("खाता आमंत्रण उपलब्ध है", "{{schoolDisplayName}} से एक बार उपयोग होने वाला खाता आमंत्रण उपलब्ध है।")),
  family("PASSWORD_RECOVERY", "RECOVERY_REQUESTED", "SECURITY_CRITICAL", "IDENTITY_ACCESS", "/forgot-password", english("Account recovery notice", "An account recovery action was requested. Open the secure Nalanda application if this was you."), draft("ఖాతా పునరుద్ధరణ సమాచారం", "ఖాతా పునరుద్ధరణ చర్య అభ్యర్థించబడింది."), draftHindi("खाता पुनर्प्राप्ति सूचना", "खाता पुनर्प्राप्ति कार्रवाई का अनुरोध किया गया है।")),
  family("SECURITY_STATE_CHANGED", "SECURITY_STATE_CHANGED", "SECURITY_CRITICAL", "IDENTITY_ACCESS", "/security", english("Security setting changed", "A security setting changed on your Nalanda account. Sign in to review it."), draft("భద్రతా సెట్టింగ్ మారింది", "మీ నలందా ఖాతాలో భద్రతా సెట్టింగ్ మారింది."), draftHindi("सुरक्षा सेटिंग बदली", "आपके नालंदा खाते की सुरक्षा सेटिंग बदली गई है।")),
  family("PAYMENT_RECEIPT_AVAILABLE", "PAYMENT_COMMITTED", "TRANSACTIONAL", "FINANCE", "/parent/receipts", english("Receipt available", "A payment receipt is available in Nalanda School Management System."), draft("రసీదు అందుబాటులో ఉంది", "నలందా స్కూల్ మేనేజ్‌మెంట్ సిస్టమ్‌లో చెల్లింపు రసీదు అందుబాటులో ఉంది."), draftHindi("रसीद उपलब्ध है", "नालंदा स्कूल मैनेजमेंट सिस्टम में भुगतान रसीद उपलब्ध है।")),
  family("REPORT_AVAILABLE", "REPORT_ISSUED", "ACADEMIC_OPERATIONAL", "ACADEMICS", "/parent/report-cards", english("Report available", "A report is available in Nalanda School Management System."), draft("నివేదిక అందుబాటులో ఉంది", "నలందా స్కూల్ మేనేజ్‌మెంట్ సిస్టమ్‌లో ఒక నివేదిక అందుబాటులో ఉంది."), draftHindi("रिपोर्ट उपलब्ध है", "नालंदा स्कूल मैनेजमेंट सिस्टम में एक रिपोर्ट उपलब्ध है।")),
  family("CLASSWORK_AVAILABLE", "CLASSWORK_PUBLISHED", "ACADEMIC_OPERATIONAL", "CLASSWORK", "/my-classwork", english("Classwork available", "New classwork is available in the secure Nalanda application."), draft("క్లాస్‌వర్క్ అందుబాటులో ఉంది", "సురక్షిత నలందా యాప్‌లో కొత్త క్లాస్‌వర్క్ అందుబాటులో ఉంది."), draftHindi("कक्षा कार्य उपलब्ध है", "सुरक्षित नालंदा ऐप में नया कक्षा कार्य उपलब्ध है।")),
  family("PARENT_MEETING_UPDATE", "PARENT_MEETING_UPDATED", "TRANSACTIONAL", "PARENT_MEETINGS", "/parent/meetings", english("Parent meeting update", "A Parent Meeting update is available in the secure Nalanda application."), draft("తల్లిదండ్రుల సమావేశ సమాచారం", "సురక్షిత నలందా యాప్‌లో తల్లిదండ్రుల సమావేశ సమాచారం అందుబాటులో ఉంది."), draftHindi("अभिभावक बैठक सूचना", "सुरक्षित नालंदा ऐप में अभिभावक बैठक की सूचना उपलब्ध है।")),
  family("SUPPORT_CASE_UPDATE", "SUPPORT_CASE_UPDATED", "TRANSACTIONAL", "SUPPORT", "/my-support", english("Support request update", "A support request update is available in the secure Nalanda application."), draft("సహాయ అభ్యర్థన సమాచారం", "సురక్షిత నలందా యాప్‌లో సహాయ అభ్యర్థన సమాచారం అందుబాటులో ఉంది."), draftHindi("सहायता अनुरोध सूचना", "सुरक्षित नालंदा ऐप में सहायता अनुरोध की सूचना उपलब्ध है।")),
  family("SAFE_EXIT_UPDATE", "SAFE_EXIT_UPDATED", "SAFETY_CRITICAL", "SAFE_EXIT", "/parent/student-departures", english("Student safety update", "A school-authorised Student safety update requires attention. Sign in for permitted details."), draft("విద్యార్థి భద్రతా సమాచారం", "పాఠశాల అనుమతించిన విద్యార్థి భద్రతా సమాచారానికి మీ దృష్టి అవసరం."), draftHindi("विद्यार्थी सुरक्षा सूचना", "विद्यालय द्वारा अधिकृत विद्यार्थी सुरक्षा सूचना पर ध्यान देना आवश्यक है।")),
  family("LIBRARY_REMINDER", "LIBRARY_REMINDER_DUE", "ADMINISTRATIVE", "LIBRARY", "/my-library", english("Library reminder", "A library reminder is available in the secure Nalanda application."), draft("గ్రంథాలయ గుర్తు", "సురక్షిత నలందా యాప్‌లో గ్రంథాలయ గుర్తు అందుబాటులో ఉంది."), draftHindi("पुस्तकालय अनुस्मारक", "सुरक्षित नालंदा ऐप में पुस्तकालय अनुस्मारक उपलब्ध है।")),
  family("SYSTEM_INCIDENT", "SYSTEM_INCIDENT_RECORDED", "ADMINISTRATIVE", "TECHNICAL_OPERATIONS", "/technical-operations", english("System attention required", "An operational system condition requires authorised review."), draft("సిస్టమ్ పరిశీలన అవసరం", "ఒక కార్యాచరణ సిస్టమ్ పరిస్థితికి అనుమతించిన సమీక్ష అవసరం."), draftHindi("सिस्टम समीक्षा आवश्यक", "एक परिचालन सिस्टम स्थिति के लिए अधिकृत समीक्षा आवश्यक है।"))
] as const;

function family(key: string, eventType: string, purpose: CommunicationPurpose, module: string, actionPath: string, en: LocalizedCopy, te: LocalizedCopy, hi: LocalizedCopy): CommunicationTemplateFamily {
  return { key, version: 1, eventType, purpose, module, actionPath, placeholders: ["schoolDisplayName"], copy: { "en-IN": en, "te-IN": te, "hi-IN": hi } };
}
export function resolveCommunicationTemplate(input: { templateKey: string; version: number; locale?: string | null; channel: CommunicationChannel }) {
  const family = COMMUNICATION_TEMPLATE_CATALOGUE.find((row) => row.key === input.templateKey && row.version === input.version);
  if (!family) throw new Error("COMMUNICATION_TEMPLATE_NOT_FOUND");
  const requested = (COMMUNICATION_LOCALES as readonly string[]).includes(input.locale ?? "") ? input.locale as CommunicationLocale : "en-IN";
  const localized = family.copy[requested] ?? family.copy["en-IN"];
  const body = input.channel === "IN_APP" ? localized.inAppBody : localized.externalBody;
  return {
    ...family,
    locale: requested,
    fallbackApplied: requested !== input.locale && Boolean(input.locale),
    reviewStatus: localized.reviewStatus,
    titleTemplate: localized.title,
    subjectTemplate: input.channel === "EMAIL" ? localized.title : null,
    bodyTemplate: body,
    actionPathTemplate: family.actionPath,
    contentClassification: input.channel === "IN_APP" ? "AUTHORISED_IN_APP_CONTEXT" : "PRIVACY_MINIMISED_EXTERNAL",
    contentHash: createHash("sha256").update(JSON.stringify({ key: family.key, version: family.version, locale: requested, channel: input.channel, title: localized.title, body, actionPath: family.actionPath })).digest("hex")
  };
}

export function renderCommunicationTemplate(input: {
  templateKey: string;
  version: number;
  locale?: string | null;
  channel: CommunicationChannel;
  substitutions: Record<string, unknown>;
}) {
  const template = resolveCommunicationTemplate(input);
  const allowed = new Set(template.placeholders);
  for (const key of Object.keys(input.substitutions)) if (!allowed.has(key as Placeholder)) throw new Error(`COMMUNICATION_TEMPLATE_PLACEHOLDER_DENIED:${key}`);
  const render = (source: string | null) => source == null ? null : source.replace(/\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}/g, (_match, key: string) => {
    if (!allowed.has(key as Placeholder)) throw new Error(`COMMUNICATION_TEMPLATE_PLACEHOLDER_DENIED:${key}`);
    const raw = String(input.substitutions[key] ?? "").trim();
    if (!raw || raw.length > 240 || /[\u0000-\u001f]/.test(raw)) throw new Error(`COMMUNICATION_TEMPLATE_VALUE_INVALID:${key}`);
    if (key === "actionUrl") return validateActionPath(raw) ?? "";
    return raw;
  });
  const title = render(template.titleTemplate)!;
  const subject = render(template.subjectTemplate);
  const body = render(template.bodyTemplate)!;
  const actionPath = validateActionPath(render(template.actionPathTemplate));
  if (subject && /[\r\n]/.test(subject)) throw new Error("COMMUNICATION_EMAIL_HEADER_INJECTION_DENIED");
  if (input.channel !== "IN_APP" && /(?:aadhaar|apaar|cwsn|medical|biometric|password|recovery code|full address|marks?\s*[:=]|ledger)/i.test(body)) {
    throw new Error("COMMUNICATION_EXTERNAL_CONTENT_MINIMISATION_DENIED");
  }
  const contentHash = createHash("sha256").update(JSON.stringify({ templateHash: template.contentHash, title, subject, body, actionPath, channel: input.channel, locale: template.locale })).digest("hex");
  return { ...template, title, subject, body, actionPath, contentHash, html: input.channel === "EMAIL" ? safeEmailHtml(title, body, actionPath) : null };
}

function safeEmailHtml(title: string, body: string, actionPath: string | null) {
  const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  return `<main><h1>${escape(title)}</h1><p>${escape(body)}</p>${actionPath ? `<p><a href="${escape(actionPath)}">Open the secure Nalanda application</a></p>` : ""}</main>`;
}

export function communicationTemplateInventory() {
  return {
    families: COMMUNICATION_TEMPLATE_CATALOGUE.length,
    locales: COMMUNICATION_LOCALES.length,
    localeVersions: COMMUNICATION_TEMPLATE_CATALOGUE.length * COMMUNICATION_LOCALES.length,
    channelRenderings: COMMUNICATION_TEMPLATE_CATALOGUE.length * COMMUNICATION_LOCALES.length * 5,
    reviewedEnglish: COMMUNICATION_TEMPLATE_CATALOGUE.length,
    draftPendingLanguageReview: COMMUNICATION_TEMPLATE_CATALOGUE.length * 2
  };
}
