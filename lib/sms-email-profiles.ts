import type { AuthUser } from "@/lib/auth";
import { createEmailProvider, createSmsProvider, type SmsEmailChannel } from "@/lib/sms-email-provider";
import { communicationFeatureAvailability } from "@/lib/communication-policy";

const PROFILE_CODE = /^[A-Z0-9][A-Z0-9_-]{2,39}$/;
const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;
const HEALTH = new Set(["UNKNOWN", "VERIFIED", "WARNING", "FAILED"]);

export function validateSmsEmailProfileInput(input: any) {
  const channel = channelOf(input?.channel);
  const mode = String(input?.mode ?? "MOCK").trim().toUpperCase();
  const providerKind = String(input?.providerKind ?? (channel === "SMS" ? "MOCK_SMS" : "MOCK_EMAIL")).trim().toUpperCase();
  const profileCode = String(input?.profileCode ?? "").trim().toUpperCase();
  const displayName = String(input?.displayName ?? "").trim();
  const quietHoursStart = optional(input?.quietHoursStart);
  const quietHoursEnd = optional(input?.quietHoursEnd);
  if (!PROFILE_CODE.test(profileCode)) throw new Error("Profile code must use 3–40 uppercase letters, numbers, underscore or hyphen.");
  if (!displayName) throw new Error("Profile display name is required.");
  if (!["MOCK", "LIVE"].includes(mode)) throw new Error("Provider mode must be MOCK or LIVE.");
  if (channel === "SMS" && !["MOCK_SMS", "SELECTED_DLT_SMS"].includes(providerKind)) throw new Error("SMS provider kind is invalid.");
  if (channel === "EMAIL" && !["MOCK_EMAIL", "GMAIL_API"].includes(providerKind)) throw new Error("Email provider kind is invalid.");
  if (mode === "LIVE" && providerKind.startsWith("MOCK_")) throw new Error("A LIVE profile cannot use a MOCK provider.");
  if ((quietHoursStart && !CLOCK.test(quietHoursStart)) || (quietHoursEnd && !CLOCK.test(quietHoursEnd)) || Boolean(quietHoursStart) !== Boolean(quietHoursEnd)) {
    throw new Error("Quiet hours require both start and end in 24-hour HH:mm format.");
  }
  const domain = optional(input?.senderDomain)?.toLowerCase() ?? null;
  if (channel === "EMAIL" && domain && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) throw new Error("Sender domain is invalid.");
  const health = (name: string) => {
    const value = String(input?.[name] ?? "UNKNOWN").trim().toUpperCase();
    if (!HEALTH.has(value)) throw new Error(`${name} has an invalid readiness status.`);
    return value;
  };
  return {
    profileCode,
    channel,
    providerKind,
    displayName: displayName.slice(0, 120),
    mode,
    providerApiVersion: optional(input?.providerApiVersion),
    senderIdentityMasked: optional(input?.senderIdentityMasked),
    senderDomain: domain,
    defaultCountryCode: channel === "SMS" ? optional(input?.defaultCountryCode) ?? "+91" : null,
    timezone: "Asia/Kolkata",
    quietHoursStart,
    quietHoursEnd,
    hourlyLimit: positiveOrNull(input?.hourlyLimit, "Hourly limit"),
    dailyLimit: positiveOrNull(input?.dailyLimit, "Daily limit"),
    workerChunkSize: bounded(input?.workerChunkSize, 25, 1, 100, "Worker chunk size"),
    maximumRetryCount: bounded(input?.maximumRetryCount, 3, 0, 8, "Maximum retry count"),
    costCapEnabled: bool(input?.costCapEnabled),
    maximumEstimatedBatchCostMinor: moneyMinor(input?.maximumEstimatedBatchCost, input?.maximumEstimatedBatchCostMinor),
    costCapCurrency: "INR",
    dltPrincipalEntityReference: channel === "SMS" ? optional(input?.dltPrincipalEntityReference) : null,
    dltHeaderReference: channel === "SMS" ? optional(input?.dltHeaderReference) : null,
    spfStatus: channel === "EMAIL" ? health("spfStatus") : "UNKNOWN",
    dkimStatus: channel === "EMAIL" ? health("dkimStatus") : "UNKNOWN",
    dmarcStatus: channel === "EMAIL" ? health("dmarcStatus") : "UNKNOWN",
    senderAliasStatus: channel === "EMAIL" ? health("senderAliasStatus") : "UNKNOWN"
  };
}

export async function ensureSmsEmailMockProfiles(client: any) {
  const rows = [
    {
      profileCode: "DEFAULT_MOCK_SMS", channel: "SMS", providerKind: "MOCK_SMS",
      displayName: "MOCK SMS", mode: "MOCK", status: "CONFIGURED",
      liveSendingEnabled: false, defaultCountryCode: "+91", timezone: "Asia/Kolkata",
      maximumRetryCount: 3, workerChunkSize: 25, costCapEnabled: false, costCapCurrency: "INR",
      dltPrincipalEntityReference: "MOCK-PE", dltHeaderReference: "NPSMCK"
    },
    {
      profileCode: "DEFAULT_MOCK_EMAIL", channel: "EMAIL", providerKind: "MOCK_EMAIL",
      displayName: "MOCK Email", mode: "MOCK", status: "CONFIGURED",
      liveSendingEnabled: false, senderIdentityMasked: "q***@nalandaps.com", senderDomain: "nalandaps.com",
      timezone: "Asia/Kolkata", maximumRetryCount: 3, workerChunkSize: 25,
      costCapEnabled: false, costCapCurrency: "INR",
      spfStatus: "UNKNOWN", dkimStatus: "UNKNOWN", dmarcStatus: "UNKNOWN", senderAliasStatus: "UNKNOWN"
    }
  ];
  const result = [];
  for (const row of rows) {
    result.push(await client.smsEmailIntegrationProfile.upsert({
      where: { profileCode: row.profileCode },
      update: {},
      create: row
    }));
  }
  return result;
}

export async function createSmsEmailProfile(client: any, input: any) {
  const data = validateSmsEmailProfileInput(input);
  if (data.costCapEnabled && data.maximumEstimatedBatchCostMinor == null) throw new Error("An enabled estimated-cost cap requires a positive INR amount.");
  return client.smsEmailIntegrationProfile.create({ data: { ...data, status: "DRAFT", liveSendingEnabled: false } });
}

export function smsDltReadiness(profile: any, mapping?: any | null) {
  const checks = {
    providerSelected: profile.mode === "MOCK"
      ? profile.providerKind === "MOCK_SMS"
      : profile.providerKind === "SELECTED_DLT_SMS" && Boolean(process.env.SMS_EMAIL_SMS_PROVIDER_ADAPTER),
    principalEntity: Boolean(
      profile.dltPrincipalEntityReference
      && mapping?.smsPrincipalEntityReference
      && profile.dltPrincipalEntityReference === mapping.smsPrincipalEntityReference
    ),
    registeredHeader: Boolean(
      profile.dltHeaderReference
      && mapping?.smsHeader
      && profile.dltHeaderReference === mapping.smsHeader
    ),
    registeredTemplate: Boolean(mapping?.smsDltTemplateId && mapping?.smsTemplateText),
    providerApproved: mapping?.providerStatus === "APPROVED"
  };
  return { ready: Object.values(checks).every(Boolean), checks };
}

export function emailDomainReadiness(profile: any, mapping?: any | null) {
  const checks = {
    senderDomain: Boolean(profile.senderDomain),
    senderAlias: profile.senderAliasStatus === "VERIFIED" && Boolean(mapping?.emailSenderAlias),
    spf: profile.spfStatus === "VERIFIED",
    dkim: profile.dkimStatus === "VERIFIED",
    dmarcReviewed: ["VERIFIED", "WARNING"].includes(profile.dmarcStatus)
  };
  return { ready: Object.values(checks).every(Boolean), checks };
}

export async function runSmsEmailProfileHealth(client: any, id: string, network = false) {
  const profile = await requiredProfile(client, id);
  if (profile.mode === "LIVE" && network && !communicationFeatureAvailability(profile.channel).enabled) {
    throw new Error(`The unified communication foundation and ${profile.channel} channel are operationally disabled.`);
  }
  const provider = profile.channel === "SMS" ? createSmsProvider(profile.mode) : createEmailProvider(profile.mode);
  const health = await provider.healthCheck({ network: profile.mode === "LIVE" && network });
  await client.smsEmailIntegrationProfile.update({
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

export async function activateSmsEmailProfile(client: any, id: string, actor: AuthUser, confirmation: unknown) {
  if (!["SUPER_ADMIN", "DIRECTOR"].includes(actor.role)) throw new Error("Only Director or Super Admin can activate an external integration.");
  const profile = await requiredProfile(client, id);
  if (String(confirmation ?? "").trim() !== `ACTIVATE ${profile.profileCode}`) throw new Error(`Type ACTIVATE ${profile.profileCode} to confirm.`);
  const provider = profile.channel === "SMS" ? createSmsProvider(profile.mode) : createEmailProvider(profile.mode);
  const health = await provider.healthCheck({ network: false });
  if (!health.ok) throw new Error(health.message);
  if (profile.mode === "LIVE") {
    if (!communicationFeatureAvailability(profile.channel).enabled) throw new Error(`The unified communication foundation and ${profile.channel} channel are operationally disabled.`);
    if (process.env.SMS_EMAIL_SUPERVISED_LIVE_ACTIVATION_ENABLED !== "true") throw new Error("Supervised LIVE activation is disabled for Prompt 19C.");
    if (profile.channel === "SMS" && process.env.SMS_EMAIL_SMS_LIVE_ENABLED !== "true") throw new Error("SMS LIVE sending is disabled.");
    if (profile.channel === "EMAIL" && process.env.SMS_EMAIL_EMAIL_LIVE_ENABLED !== "true") throw new Error("Email LIVE sending is disabled.");
  }
  return client.$transaction(async (tx: any) => {
    if (profile.mode === "LIVE") {
      await tx.smsEmailIntegrationProfile.updateMany({
        where: { id: { not: id }, channel: profile.channel, mode: "LIVE", status: "ACTIVE" },
        data: { status: "PAUSED", liveSendingEnabled: false, pausedByUserId: actor.id }
      });
    }
    return tx.smsEmailIntegrationProfile.update({
      where: { id },
      data: {
        status: "ACTIVE", liveSendingEnabled: profile.mode === "LIVE",
        activatedByUserId: actor.id, lastHealthCheckAt: new Date(),
        lastHealthCheckStatus: health.status, lastHealthCheckMessage: health.message.slice(0, 500)
      }
    });
  });
}

export async function pauseSmsEmailProfile(client: any, id: string, actor: AuthUser) {
  await requiredProfile(client, id);
  return client.smsEmailIntegrationProfile.update({
    where: { id }, data: { status: "PAUSED", liveSendingEnabled: false, pausedByUserId: actor.id }
  });
}

export async function assertSmsEmailProfileCanSend(profile: any, mapping: any) {
  if (profile.status !== "ACTIVE") throw new Error(`${profile.channel} integration profile must be active.`);
  if (profile.channel === "SMS" && !smsDltReadiness(profile, mapping).ready) {
    throw new Error("SMS DLT readiness is incomplete or the registered identity does not exactly match.");
  }
  if (profile.mode === "LIVE") {
    if (!profile.liveSendingEnabled) throw new Error(`${profile.channel} LIVE sending is disabled.`);
    if (profile.lastHealthCheckStatus !== "SUCCESS") throw new Error("A successful environment-backed health check is required.");
    const readiness = profile.channel === "SMS" ? smsDltReadiness(profile, mapping) : emailDomainReadiness(profile, mapping);
    if (!readiness.ready) throw new Error(profile.channel === "SMS" ? "SMS DLT readiness is incomplete." : "Email sender-domain readiness is incomplete.");
  }
}

export function channelOf(value: unknown): SmsEmailChannel {
  const channel = String(value ?? "").trim().toUpperCase();
  if (!["SMS", "EMAIL"].includes(channel)) throw new Error("Channel must be SMS or EMAIL.");
  return channel as SmsEmailChannel;
}
function requiredProfile(client: any, id: string) {
  return client.smsEmailIntegrationProfile.findUnique({ where: { id } }).then((row: any) => {
    if (!row) throw new Error("SMS/Email integration profile was not found.");
    return row;
  });
}
function optional(value: unknown) { const text = String(value ?? "").trim(); return text || null; }
function bool(value: unknown) { return value === true || value === "true" || value === "on"; }
function positiveOrNull(value: unknown, label: string) {
  if (value == null || value === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error(`${label} must be a positive whole number.`);
  return number;
}
function bounded(value: unknown, fallback: number, min: number, max: number, label: string) {
  if (value == null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new Error(`${label} must be between ${min} and ${max}.`);
  return number;
}
function moneyMinor(major: unknown, minor: unknown) {
  if (major != null && major !== "") {
    const value = Number(major);
    if (!Number.isFinite(value) || value <= 0) throw new Error("Estimated-cost cap must be positive.");
    return Math.round(value * 100);
  }
  if (minor == null || minor === "") return null;
  const value = Number(minor);
  if (!Number.isInteger(value) || value < 1) throw new Error("Estimated-cost cap must be positive.");
  return value;
}
