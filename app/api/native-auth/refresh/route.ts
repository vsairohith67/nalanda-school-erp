import { nativeAuthResponse, parseBoundedNativeJson, refreshNativeSession } from "@/lib/native-app/auth";

export async function POST(request: Request) {
  try {
    return Response.json(await refreshNativeSession(await parseBoundedNativeJson(request)), { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return nativeAuthResponse(error); }
}
