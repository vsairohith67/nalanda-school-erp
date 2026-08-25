import { getCurrentAuthContext, requireApiPermission } from "@/lib/auth";
import { createDeviceChallenge, offlineTrustResponse } from "@/lib/offline-sync/device-trust";
import { offlineSyncRoleAllowed, requireOfflineSyncForApi } from "@/lib/offline-sync/feature-flag";

export async function POST(request: Request) {
  const unavailable = requireOfflineSyncForApi(); if (unavailable) return unavailable;
  const auth = await requireApiPermission("USE_OFFLINE_SYNC"); if (auth.response) return auth.response;
  const context = await getCurrentAuthContext();
  if (!context || !offlineSyncRoleAllowed(context.user.role)) return Response.json({ error: "You do not have permission for this action" }, { status: 403 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const purpose = String(body.purpose ?? "REGISTER").toUpperCase();
    if (purpose !== "REGISTER" && purpose !== "ROTATE") throw new Error("PURPOSE_INVALID");
    const challenge = await createDeviceChallenge({
      userId: context.user.id,
      purpose,
      publicDeviceId: String(body.publicDeviceId ?? ""),
      keyVersion: Number(body.keyVersion),
      publicKeyJwk: body.publicKeyJwk
    });
    return Response.json(challenge, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return offlineTrustResponse(error); }
}
