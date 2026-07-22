import { validateNotificationActionPath } from "@/lib/notification-links";

export const NOTIFICATION_CATEGORIES = [
  "GENERAL", "ACADEMIC", "ATTENDANCE", "HOMEWORK", "EXAM", "REPORT_CARD",
  "FEE_INFORMATION", "LIBRARY", "CERTIFICATE", "CLASS_X_DOCUMENTS", "ID_CARD",
  "SAFETY", "EMERGENCY", "SYSTEM"
] as const;
export const NOTIFICATION_PRIORITIES = ["NORMAL", "IMPORTANT", "URGENT"] as const;
export const NOTIFICATION_TEMPLATE_STATUSES = ["DRAFT", "ACTIVE", "INACTIVE"] as const;
export const SAFE_NOTIFICATION_PLACEHOLDERS = ["schoolName", "academicYear"] as const;

export type NotificationTemplateInput = {
  templateCode: string;
  name: string;
  category: (typeof NOTIFICATION_CATEGORIES)[number];
  defaultPriority: (typeof NOTIFICATION_PRIORITIES)[number];
  titleTemplate: string;
  bodyTemplate: string;
  actionLabel: string | null;
  actionPath: string | null;
  acknowledgmentRequired: boolean;
};

export function validateNotificationTemplateInput(input: unknown): NotificationTemplateInput {
  const source = record(input, "Notification template details are required.");
  const templateCode = normalizeNotificationCode(source.templateCode, "Template code");
  const name = plainText(source.name, "Template name", 120);
  const category = allow(source.category, NOTIFICATION_CATEGORIES, "category");
  const defaultPriority = allow(source.defaultPriority ?? "NORMAL", NOTIFICATION_PRIORITIES, "priority");
  const titleTemplate = templateText(source.titleTemplate, "Title template", 120);
  const bodyTemplate = templateText(source.bodyTemplate, "Body template", 2_000);
  const actionLabel = optionalPlainText(source.actionLabel, "Action label", 80);
  const actionPath = validateNotificationActionPath(source.actionPath);
  if (Boolean(actionLabel) !== Boolean(actionPath)) throw new Error("Action label and action path must be provided together.");
  return {
    templateCode,
    name,
    category,
    defaultPriority,
    titleTemplate,
    bodyTemplate,
    actionLabel,
    actionPath,
    acknowledgmentRequired:
      source.acknowledgmentRequired === true || source.acknowledgmentRequired === "true"
  };
}

export function normalizeNotificationCode(value: unknown, label = "Code") {
  const code = String(value ?? "").trim().toUpperCase().replace(/[\s_]+/g, "-");
  if (!/^[A-Z0-9][A-Z0-9-]{2,39}$/.test(code)) {
    throw new Error(`${label} must use 3-40 letters, numbers, and hyphens.`);
  }
  return code;
}

export function plainText(value: unknown, label: string, maxLength: number) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} is required.`);
  if (text.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  rejectExecutableText(text, label);
  return text;
}

export function optionalPlainText(value: unknown, label: string, maxLength: number) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (text.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  rejectExecutableText(text, label);
  return text;
}

export function rejectExecutableText(text: string, label = "Content") {
  if (/<[^>]*>/i.test(text) || /(?:javascript|data|vbscript)\s*:/i.test(text) || /\bon[a-z]+\s*=/i.test(text)) {
    throw new Error(`${label} must be plain text without HTML, scripts, handlers, or executable content.`);
  }
}

export function notificationTemplateErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
    return "Template code already exists. Choose a different code.";
  }
  return error instanceof Error ? error.message : fallback;
}

function templateText(value: unknown, label: string, maxLength: number) {
  const text = plainText(value, label, maxLength);
  for (const match of text.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)) {
    if (!(SAFE_NOTIFICATION_PLACEHOLDERS as readonly string[]).includes(match[1])) {
      throw new Error(`Template placeholder "${match[1]}" is not allowed.`);
    }
  }
  return text;
}

function record(value: unknown, message: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
}

function allow<T extends readonly string[]>(value: unknown, values: T, label: string): T[number] {
  const text = String(value ?? "").trim().toUpperCase();
  if (!(values as readonly string[]).includes(text)) throw new Error(`Choose a valid notification ${label}.`);
  return text as T[number];
}
