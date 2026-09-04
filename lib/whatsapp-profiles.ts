import type { AuthUser } from "@/lib/auth";
import { createWhatsAppProvider } from "@/lib/whatsapp-provider";
import { communicationFeatureAvailability } from "@/lib/communication-policy";

const PROFILE_CODE = /^[A-Z0-9][A-Z0-9_-]{2,39}$/;
const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function validateWhatsAppProfileInput(input: any) {
  const profileCode = String(input?.profileCode ?? "").trim().toUpperCase();
  const displayName = String(input?.displayName ?? "").trim();
  const mode = String(input?.mode ?? "MOCK").trim().toUpperCase();
  const graphApiVersion = String(input?.graphApiVersion ?? process.env.WHATSAPP_GRAPH_API_VERSION ?? "v25.0").trim();
  const quietHoursStart = optional(input?.quietHoursStart);
  const quietHoursEnd = optional(input?.quietHoursEnd);
  if (!PROFILE_CODE.test(profileCode)) throw new Error("Profile code must use 3-40 uppercase letters, numbers, underscore or hyphen.");
  if (!displayName) throw new Error("Profile display name is required.");
  if (!["MOCK", "LIVE"].includes(mode)) throw new Error("Provider mode must be MOCK or LIVE.");
  if (!/^v\d+\.\d+$/.test(graphApiVersion)) throw new Error("Graph API version must look like v25.0.");
  if ((quietHoursStart && !CLOCK.test(quietHoursStart)) || (quietHoursEnd && !CLOCK.test(quietHoursEnd))) {
    throw new Error("Quiet hours must use 24-hour HH:mm values.");
  }
  if (Boolean(quietHoursStart) !== Boolean(quietHoursEnd)) throw new Error("Both quiet-hour start and end are required.");
  return {
    profileCode,
    displayName: displayName.slice(0, 120),
    provider: "META_CLOUD",
    mode,
    graphApiVersion,
    businessAccountReference: optional(input?.businessAccountReference),
    phoneNumberReference: optional(input?.phoneNumberReference),
    displayPhoneMasked: optional(input?.displayPhoneMasked),
    defaultCountryCode: optional(input?.defaultCountryCode) ?? "+91",
    quietHoursStart,
    quietHoursEnd,
    timezone: "Asia/Kolkata",
    dailyMessageLimit: positiveIntegerOrNull(input?.dailyMessageLimit, "Daily message limit"),
    hourlyMessageLimit: positiveIntegerOrNull(input?.hourlyMessageLimit, "Hourly message limit"),
    costCapEnabled: Boolean(input?.costCapEnabled === true || input?.costCapEnabled === "on"),
    maximumEstimatedBatchCostMinor: moneyMinorOrNull(input?.maximumEstimatedBatchCost, input?.maximumEstimatedBatchCostMinor),
    costCapCurrency: "INR",
    maximumRetryCount: boundedInteger(input?.maximumRetryCount, 3, 0, 8, "Maximum retry count"),
    workerChunkSize: boundedInteger(input?.workerChunkSize, 25, 1, 100, "Worker chunk size")
  };
}

export async function createWhatsAppProfile(client: any, input: any, actor?: AuthUser) {
  const data = validateWhatsAppProfileInput(input);
  if (data.costCapEnabled && data.maximumEstimatedBatchCostMinor == null) throw new Error("An enabled estimated-cost cap requires a positive INR amount.");
  return client.whatsAppIntegrationProfile.create({
    data: {
      ...data, status: "DRAFT", liveSendingEnabled: false,
      costCapUpdatedAt: data.costCapEnabled ? new Date() : null,
      costCapUpdatedByUserId: data.costCapEnabled ? actor?.id ?? null : null
    }
  });
}

export async function updateWhatsAppCostCapPolicy(client: any, id: string, input: any, actor: AuthUser) {
  await requiredProfile(client, id);
  const enabled = Boolean(input?.costCapEnabled === true || input?.costCapEnabled === "on");
  const maximumEstimatedBatchCostMinor = moneyMinorOrNull(input?.maximumEstimatedBatchCost, input?.maximumEstimatedBatchCostMinor);
  if (enabled && maximumEstimatedBatchCostMinor == null) throw new Error("An enabled estimated-cost cap requires a positive INR amount.");
  return client.whatsAppIntegrationProfile.update({
    where: { id },
    data: {
      costCapEnabled: enabled,
      maximumEstimatedBatchCostMinor: enabled ? maximumEstimatedBatchCostMinor : null,
      costCapCurrency: "INR",
      costCapUpdatedAt: new Date(),
      costCapUpdatedByUserId: actor.id
    }
  });
}

export async function runWhatsAppProfileHealth(client: any, id: string, network = false) {
  const profile = await requiredProfile(client, id);
  if (profile.mode === "LIVE" && network && !communicationFeatureAvailability("WHATSAPP").enabled) {
    throw new Error("The unified communication foundation and WhatsApp channel are operationally disabled.");
  }
  const provider = createWhatsAppProvider(profile.mode);
  const health = await provider.healthCheck({ network: profile.mode === "LIVE" && network });
  await client.whatsAppIntegrationProfile.update({
    where: { id },
    data: {
      lastHealthCheckAt: new Date(),
      lastHealthCheckStatus: health.status,
      lastHealthCheckMessage: health.message.slice(0, 500),
      status: profile.status === "DRAFT" && health.ok ? "CONFIGURED" : profile.status
    }
  });
  return health;
}

export async function activateWhatsAppProfile(client: any, id: string, actor: AuthUser, confirmation: string) {
  if (!["SUPER_ADMIN", "DIRECTOR"].includes(actor.role)) throw new Error("Only Director or Super Admin can activate WhatsApp integration.");
  const profile = await requiredProfile(client, id);
  if (String(confirmation).trim() !== `ACTIVATE ${profile.profileCode}`) {
    throw new Error(`Type ACTIVATE ${profile.profileCode} to confirm activation.`);
  }
  const health = await createWhatsAppProvider(profile.mode).healthCheck();
  if (!health.ok) throw new Error(health.message);
  if (profile.mode === "LIVE" && process.env.WHATSAPP_LIVE_SENDING_ENABLED !== "true") {
    throw new Error("Live sending remains disabled by the environment feature flag.");
  }
  if (profile.mode === "LIVE" && !communicationFeatureAvailability("WHATSAPP").enabled) {
    throw new Error("The unified communication foundation and WhatsApp channel are operationally disabled.");
  }
  return client.$transaction(async (tx: any) => {
    if (profile.mode === "LIVE") {
      await tx.whatsAppIntegrationProfile.updateMany({
        where: { id: { not: id }, mode: "LIVE", status: "ACTIVE" },
        data: { status: "PAUSED", liveSendingEnabled: false, pausedByUserId: actor.id }
      });
    }
    return tx.whatsAppIntegrationProfile.update({
      where: { id },
      data: {
        status: "ACTIVE",
        liveSendingEnabled: profile.mode === "LIVE",
        activatedByUserId: actor.id,
        lastHealthCheckAt: new Date(),
        lastHealthCheckStatus: health.status,
        lastHealthCheckMessage: health.message.slice(0, 500)
      }
    });
  });
}

export async function pauseWhatsAppProfile(client: any, id: string, actor: AuthUser) {
  const profile = await requiredProfile(client, id);
  if (profile.status === "PAUSED") return profile;
  return client.whatsAppIntegrationProfile.update({
    where: { id },
    data: { status: "PAUSED", liveSendingEnabled: false, pausedByUserId: actor.id }
  });
}

export async function assertWhatsAppProfileCanSend(profile: any) {
  if (profile.status !== "ACTIVE") throw new Error("The WhatsApp integration profile must be active.");
  if (profile.mode === "LIVE") {
    if (process.env.WHATSAPP_LIVE_SENDING_ENABLED !== "true" || !profile.liveSendingEnabled) {
      throw new Error("Live WhatsApp sending is disabled.");
    }
    if (profile.lastHealthCheckStatus !== "SUCCESS" || !profile.lastHealthCheckAt) {
      throw new Error("A successful environment-backed health check is required before live sending.");
    }
  }
}

async function requiredProfile(client: any, id: string) {
  const row = await client.whatsAppIntegrationProfile.findUnique({ where: { id } });
  if (!row) throw new Error("WhatsApp integration profile was not found.");
  return row;
}
function optional(value: unknown) { const text = String(value ?? "").trim(); return text || null; }
function positiveIntegerOrNull(value: unknown, label: string) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive whole number.`);
  return parsed;
}
function boundedInteger(value: unknown, fallback: number, min: number, max: number, label: string) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new Error(`${label} must be between ${min} and ${max}.`);
  return parsed;
}
function moneyMinorOrNull(major: unknown, minor: unknown) {
  if (major != null && major !== "") {
    const parsed = Number(major);
    if (!Number.isFinite(parsed) || parsed <= 0 || Math.round(parsed * 100) > 2_147_483_647) throw new Error("Estimated-cost cap must be a positive INR amount.");
    return Math.round(parsed * 100);
  }
  if (minor == null || minor === "") return null;
  const parsed = Number(minor);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 2_147_483_647) throw new Error("Estimated-cost cap must be a positive whole-number minor-unit amount.");
  return parsed;
}
