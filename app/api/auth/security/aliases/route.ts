import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { beginAliasVerification, removeLoginAlias, verifyLoginAlias } from "@/lib/auth-aliases";
import { configuredAuthDeliveryAdapter } from "@/lib/auth-delivery";
import { isAuthAliasType } from "@/lib/auth-identifiers";
import { safeClientError } from "@/lib/client-errors";
import { authPublicHandleMatches } from "@/lib/auth-security";

export async function POST(request: NextRequest) {
  const context = await getCurrentAuthContext();
  if (!context) return privateJson({ error: "Authentication required" }, 401);
  try {
    const body = await request.json();
    const action = String(body.action ?? "");
    if (action === "add") {
      const type = String(body.type ?? "");
      const value = String(body.value ?? "");
      if (!isAuthAliasType(type) || value.length > 254) throw new Error("Enter a valid login identifier");
      const result = await beginAliasVerification(prisma, { userId: context.user.id, type, value }, configuredAuthDeliveryAdapter());
      return privateJson({ success: true, displayMasked: result.displayMasked, expiresInMinutes: result.expiresInMinutes }, 201);
    }
    const aliasHandle = boundedHandle(body.aliasHandle);
    const expectedVersion = expectedVersionValue(body.expectedVersion);
    const aliases = await prisma.authLoginAlias.findMany({
      where: { userId: context.user.id, version: expectedVersion },
      select: { id: true, version: true }
    });
    const alias = aliases.find((candidate) => authPublicHandleMatches(
      aliasHandle,
      "LOGIN_ALIAS",
      context.user.id,
      candidate.id,
      candidate.version
    ));
    if (!alias) throw new Error("Login identifier changed; refresh and try again");
    if (action === "verify") {
      const code = String(body.code ?? "").trim();
      if (!/^\d{6}$/.test(code)) throw new Error("Enter the six-digit verification code");
      await verifyLoginAlias(prisma, { userId: context.user.id, aliasId: alias.id, expectedVersion, code });
      return privateJson({ success: true }, 200);
    }
    if (action === "remove") {
      await removeLoginAlias(prisma, { userId: context.user.id, aliasId: alias.id, expectedVersion });
      return privateJson({ success: true }, 200);
    }
    throw new Error("Unsupported login identifier action");
  } catch (error) {
    return privateJson({ error: safeClientError(error, "Unable to update login identifiers") }, 400);
  }
}

function boundedHandle(value: unknown) {
  const result = String(value ?? "").trim();
  if (!/^auth_[a-f0-9]{64}$/.test(result)) throw new Error("Login identifier is invalid");
  return result;
}

function expectedVersionValue(value: unknown) {
  const result = Number(value);
  if (!Number.isInteger(result) || result < 1) throw new Error("Expected login identifier version is invalid");
  return result;
}

function privateJson(body: Record<string, unknown>, status: number) {
  const response = NextResponse.json(body, { status });
  response.headers.set("cache-control", "private, no-store");
  return response;
}
