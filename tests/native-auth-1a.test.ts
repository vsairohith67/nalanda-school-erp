import { afterEach, describe, expect, it } from "vitest";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { crossPlatformAppsAvailability, nativeAppEnabled, NATIVE_APP_ID, NATIVE_REDIRECT_URI } from "@/lib/native-app/feature-flag";
import { appVersionSupported, nativeBrowserProofMessage, pkceChallenge, validateNativeAuthRequest } from "@/lib/native-app/auth";
import { publicJwkHash, verifyEd25519Signature } from "@/lib/offline-sync/device-trust";
import { operationPolicy } from "@/lib/security-resilience";
import { requestBodyLimitBytes } from "@/lib/request-security";
import { nativeDirectIngressAllowed, nativeDirectRateLimitActor } from "@/lib/trusted-client";

afterEach(() => {
  delete process.env.RELEASE_FEATURE_FLAGS_QA_MODE;
  delete process.env.RELEASE_FEATURE_FLAGS_QA_ENABLED;
  delete process.env.DATABASE_URL;
  delete process.env.APP_ORIGIN;
  delete process.env.NALANDA_NATIVE_MINIMUM_APP_VERSION;
});

describe("CROSS-PLATFORM-APPS-1A native authentication", () => {
  it("is production default-off and additionally requires Offline Sync 1A", () => {
    expect(crossPlatformAppsAvailability()).toMatchObject({ enabled: false, reason: "DEFAULT_OFF" });
    expect(nativeAppEnabled()).toBe(false);
  });

  it("accepts only the fixed app, callback, platform, PKCE S256 and Ed25519 public key", () => {
    const { publicKey } = generateKeyPairSync("ed25519");
    const publicSigningKey = publicKey.export({ format: "jwk" });
    const valid = { appId: NATIVE_APP_ID, appVersion: "0.1.0", redirectUri: NATIVE_REDIRECT_URI, platform: "WINDOWS", deviceLabel: "Finance office PC", publicDeviceId: "00000000-0000-4000-8000-000000000001", state: "s".repeat(43), nonce: "n".repeat(43), pkceChallenge: "p".repeat(43), publicSigningKey };
    expect(validateNativeAuthRequest(valid)).toMatchObject({ appId: NATIVE_APP_ID, platform: "WINDOWS" });
    expect(() => validateNativeAuthRequest({ ...valid, redirectUri: "https://evil.example/callback" })).toThrow("REDIRECT_URI_INVALID");
    expect(() => validateNativeAuthRequest({ ...valid, publicSigningKey: { ...publicSigningKey, d: "private" } })).toThrow("PUBLIC_KEY_INVALID");
    expect(appVersionSupported("1.2.0", "1.1.9")).toBe(true);
    expect(appVersionSupported("0.9.9", "1.0.0")).toBe(false);
    process.env.NALANDA_NATIVE_MINIMUM_APP_VERSION = "0.2.0";
    expect(() => validateNativeAuthRequest(valid)).toThrow("APP_VERSION_INCOMPATIBLE");
  });

  it("binds the browser proof to request, challenge, state, device and public key", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const publicJwk = publicKey.export({ format: "jwk" });
    const message = nativeBrowserProofMessage({ publicRequestId: "00000000-0000-4000-8000-000000000002", challenge: "challenge", state: "state", publicDeviceId: "00000000-0000-4000-8000-000000000001", publicKeyHash: publicJwkHash(publicJwk) });
    const signature = sign(null, Buffer.from(message), privateKey).toString("base64url");
    expect(await verifyEd25519Signature(JSON.stringify(publicJwk), message, signature)).toBe(true);
    expect(await verifyEd25519Signature(JSON.stringify(publicJwk), `${message}tampered`, signature)).toBe(false);
  });

  it("uses the exact SHA-256 PKCE challenge", () => {
    const verifier = "v".repeat(64);
    expect(pkceChallenge(verifier)).toBe(createHash("sha256").update(verifier).digest("base64url"));
  });

  it("has bounded native request bodies and dedicated high-cost rate policies", () => {
    expect(requestBodyLimitBytes("/api/native-auth/request")).toBe(32 * 1024);
    expect(requestBodyLimitBytes("/api/native/v1/sync")).toBe(32 * 1024);
    expect(operationPolicy("/api/native-auth/exchange", "POST")).toMatchObject({ id: "native.auth", cost: "HIGH", maximum: 12 });
    expect(operationPolicy("/api/native/v1/sync", "POST")).toMatchObject({ id: "native.sync", cost: "HIGH", maximum: 45 });
  });

  it("permits direct native ingress only for explicit non-production loopback development", () => {
    expect(nativeDirectIngressAllowed({ NODE_ENV: "development", NALANDA_NATIVE_PROFILE: "LOCAL_DEVELOPMENT", APP_ORIGIN: "http://127.0.0.1:3000" })).toBe(true);
    expect(nativeDirectIngressAllowed({ NODE_ENV: "production", NALANDA_NATIVE_PROFILE: "LOCAL_DEVELOPMENT", APP_ORIGIN: "http://127.0.0.1:3000" })).toBe(false);
    expect(nativeDirectIngressAllowed({ NODE_ENV: "development", NALANDA_NATIVE_PROFILE: "PRIVATE_STAGING", APP_ORIGIN: "https://staging.example.test" })).toBe(false);
    expect(nativeDirectIngressAllowed({ NODE_ENV: "development", NALANDA_NATIVE_PROFILE: "LOCAL_DEVELOPMENT", APP_ORIGIN: "http://192.0.2.40:3000" })).toBe(false);
    const local = { NODE_ENV: "development", NALANDA_NATIVE_PROFILE: "LOCAL_DEVELOPMENT", APP_ORIGIN: "http://127.0.0.1:3000" };
    expect(nativeDirectRateLimitActor(new Headers({ "x-offline-device-id": "00000000-0000-4000-8000-000000000001" }), local)).toBe("00000000-0000-4000-8000-000000000001");
    expect(nativeDirectRateLimitActor(new Headers({ "x-offline-device-id": "spoofed" }), local)).toBeNull();
    const middleware = readFileSync("middleware.ts", "utf8");
    expect(middleware.indexOf("NATIVE_INGRESS_REJECTED")).toBeLessThan(middleware.indexOf("enforceOperationRateLimit(pathname"));
    expect(middleware.indexOf("NATIVE_CLIENT_ID_REQUIRED")).toBeLessThan(middleware.indexOf("enforceOperationRateLimit(pathname"));
  });
});
