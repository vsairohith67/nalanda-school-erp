import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { configuredAuthDeliveryAdapter } from "@/lib/auth-delivery";
import { isRecoveryChannelType } from "@/lib/auth-identifiers";
import { GENERIC_RECOVERY_RESPONSE, requestPasswordReset } from "@/lib/auth-recovery";
import { loginRequestSource } from "@/lib/auth-rate-limit";
import { recoveryRequestAllowed } from "@/lib/auth-recovery-rate-limit";

export async function POST(request: NextRequest) {
  const response = () => privateJson({ message: GENERIC_RECOVERY_RESPONSE }, 202);
  try {
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.startsWith("application/json")) return response();
    const body = await request.json();
    const identifier = String(body.identifier ?? "").trim();
    const channelType = String(body.channelType ?? "");
    if (!identifier || identifier.length > 254 || !isRecoveryChannelType(channelType)) return response();
    const source = loginRequestSource(request.headers);
    const limit = await recoveryRequestAllowed(identifier, channelType, source);
    if (!limit.allowed) {
      console.warn(`AUTH_RECOVERY_RATE_LIMIT account=${limit.accountHash} source=${limit.sourceHash}`);
      return response();
    }
    const adapter = configuredAuthDeliveryAdapter();
    await requestPasswordReset(prisma, { identifier, channelType }, adapter);
    return response();
  } catch {
    return response();
  }
}

function privateJson(body: Record<string, unknown>, status: number) {
  const response = NextResponse.json(body, { status });
  response.headers.set("cache-control", "private, no-store");
  return response;
}
