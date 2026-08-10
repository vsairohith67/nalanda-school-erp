import { NextRequest, NextResponse } from "next/server";
import { ONBOARDING_PRIVATE_HEADERS } from "@/lib/onboarding-types";
import { OnboardingError } from "@/lib/onboarding";
import { unsafeRequestOriginAllowed } from "@/lib/request-security";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { safeErrorFingerprint } from "@/lib/safe-logging";

export function onboardingJson(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: ONBOARDING_PRIVATE_HEADERS }); }
export function assertOnboardingOrigin(request: NextRequest) { if (!unsafeRequestOriginAllowed(request)) throw new OnboardingError("The request origin is not allowed.", 403, "ORIGIN_DENIED"); }
export async function onboardingBody(request: NextRequest) {
  assertOnboardingOrigin(request);
  if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") throw new OnboardingError("Use an application/json request body.", 415, "JSON_REQUIRED");
  const length = Number(request.headers.get("content-length") ?? 0); if (length && (!Number.isSafeInteger(length) || length < 0 || length > 256 * 1024)) throw new OnboardingError("The request body is too large.", 413, "PAYLOAD_TOO_LARGE");
  const body = await request.json(); if (!body || typeof body !== "object" || Array.isArray(body)) throw new OnboardingError("A JSON object is required."); return body as Record<string, unknown>;
}
export function onboardingError(error: unknown) { if (error instanceof OnboardingError) return onboardingJson({ error: error.message, code: error.code }, error.status); const message = error instanceof Error ? error.message : ""; if (/^Re-authentication|^Authorization changed/.test(message)) return onboardingJson({ error: message, code: "REAUTHENTICATION_REQUIRED" }, 403); console.error("ONBOARDING_ACTION_FAILED"); return onboardingJson({ error: "The onboarding action failed safely.", code: "ONBOARDING_FAILED" }, 500); }

export async function runObservedOnboardingJob<T>(
  input: { jobType: string; summarySafe: string; idempotencyKey?: string },
  task: () => Promise<T> | T
) {
  const now = new Date();
  const idempotencyKey = input.idempotencyKey ?? `onboarding-${randomUUID()}`;
  const existing = await prisma.backgroundJobRun.findUnique({ where: { idempotencyKey } });
  const job = existing
    ? await prisma.backgroundJobRun.update({ where: { id: existing.id }, data: { status: "RUNNING", attemptCount: { increment: 1 }, startedAt: now, completedAt: null, safeErrorFingerprint: null, summarySafe: input.summarySafe } })
    : await prisma.backgroundJobRun.create({ data: { idempotencyKey, jobType: input.jobType, component: "GOVERNED_BULK_ONBOARDING", status: "RUNNING", attemptCount: 1, summarySafe: input.summarySafe, startedAt: now, expiresAt: new Date(now.valueOf() + 90 * 24 * 60 * 60 * 1000) } });
  try {
    const value = await task();
    await prisma.backgroundJobRun.update({ where: { id: job.id }, data: { status: "COMPLETED", completedAt: new Date(), summarySafe: `${input.summarySafe} completed.` } });
    return value;
  } catch (error) {
    await prisma.backgroundJobRun.update({ where: { id: job.id }, data: { status: "FAILED", completedAt: new Date(), safeErrorFingerprint: safeErrorFingerprint(error, "governed-bulk-onboarding"), summarySafe: `${input.summarySafe} failed safely.` } }).catch(() => undefined);
    throw error;
  }
}
