import { nativeAuthResponse, revokeNativeSession } from "@/lib/native-app/auth";

export async function POST(request: Request) {
  try {
    await revokeNativeSession(request);
    return new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return nativeAuthResponse(error); }
}
