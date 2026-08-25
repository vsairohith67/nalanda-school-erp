import { createNativeAuthRequest, nativeAuthResponse, parseBoundedNativeJson } from "@/lib/native-app/auth";

export async function POST(request: Request) {
  try {
    const result = await createNativeAuthRequest(await parseBoundedNativeJson(request));
    return Response.json(result, { status: 201, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return nativeAuthResponse(error); }
}
