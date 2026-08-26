import { nativeAuthResponse, resolveNativeSession } from "@/lib/native-app/auth";
import { verifyOfflineRequest, offlineTrustResponse, safeDevice, OfflineTrustError } from "@/lib/offline-sync/device-trust";

export async function GET(request: Request) {
  try {
    const context = await resolveNativeSession(request, "offline:context");
    await verifyOfflineRequest({ request, rawBody: "", user: context.user, sessionId: null, expectedDeviceId: context.device.id });
    return Response.json({
      user: { id: context.user.id, name: context.user.name, role: context.user.role },
      device: safeDevice(context.device),
      feature: "CROSS_PLATFORM_APPS_1A",
      featureAvailability: { crossPlatformApps: true, offlineSync: true },
      maintenanceState: process.env.NALANDA_NATIVE_MAINTENANCE_STATE === "ACTIVE" ? "ACTIVE" : "AVAILABLE",
      serverVersion: process.env.NALANDA_SERVER_VERSION ?? "0.1.0",
      nativeApiVersion: 1,
      currentSyncSchemaVersion: 1,
      minimumSupportedSyncSchema: 1,
      minimumSupportedAppVersion: process.env.NALANDA_NATIVE_MINIMUM_APP_VERSION ?? "0.1.0",
      recommendedAppVersion: process.env.NALANDA_NATIVE_RECOMMENDED_APP_VERSION ?? "0.1.0"
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return error instanceof OfflineTrustError ? offlineTrustResponse(error) : nativeAuthResponse(error); }
}
