import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertBoundedJsonValue } from "@/lib/request-security";
import { acceptOneTimeInvitation } from "@/lib/real-user-access/invitations";
import { activationEnvironment, activationFeatureUnavailable, activationJson, setActivationCookie } from "@/lib/real-user-access/activation-api";
import { isOperationalReleaseFeatureEnabled, REAL_USER_ACCESS_READINESS_FEATURE } from "@/lib/release-feature-flag-runtime";

export async function POST(request: NextRequest) {
  if (!isOperationalReleaseFeatureEnabled(REAL_USER_ACCESS_READINESS_FEATURE)) return activationFeatureUnavailable();
  try {
    const body = await request.json() as Record<string, unknown>; assertBoundedJsonValue(body, { maximumArrayLength: 1, maximumStringLength: 512, maximumJsonNodes: 6 });
    const result = await acceptOneTimeInvitation(prisma, String(body.token ?? ""), activationEnvironment());
    if (!result.valid || !("activationToken" in result) || typeof result.activationToken !== "string") return activationJson({ error: "This invitation is invalid or unavailable." }, 400);
    const response = activationJson({ accepted: true, next: "ESTABLISH_CREDENTIAL", requirements: result.requirements }); setActivationCookie(response, result.activationToken); return response;
  } catch { return activationJson({ error: "This invitation is invalid or unavailable." }, 400); }
}
