import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON
} from "@simplewebauthn/server";
import { boundTokenMatches, hashBoundToken } from "@/lib/real-user-access/crypto";

export type WebAuthnPolicy = { rpName: "Nalanda School Management System"; rpId: string; origin: string };

export function resolveWebAuthnPolicy(env: NodeJS.ProcessEnv = process.env, allowSyntheticLoopback = false): WebAuthnPolicy {
  const rpId = String(env.AUTH_WEBAUTHN_RP_ID ?? "").trim().toLowerCase();
  const origin = String(env.AUTH_WEBAUTHN_ORIGIN ?? "").trim();
  let parsed: URL;
  try { parsed = new URL(origin); } catch { throw new Error("WEBAUTHN_ORIGIN_INVALID"); }
  const loopback = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (!rpId || (parsed.protocol !== "https:" && !(allowSyntheticLoopback && loopback && parsed.protocol === "http:"))) throw new Error("WEBAUTHN_HTTPS_ORIGIN_REQUIRED");
  if (parsed.pathname !== "/" || parsed.search || parsed.hash || (parsed.hostname !== rpId && !parsed.hostname.endsWith(`.${rpId}`))) throw new Error("WEBAUTHN_RP_ORIGIN_MISMATCH");
  if (loopback && !allowSyntheticLoopback) throw new Error("WEBAUTHN_LOOPBACK_PRODUCTION_REFUSED");
  return { rpName: "Nalanda School Management System", rpId, origin: parsed.origin };
}

export async function createPasskeyRegistrationOptions(input: { userId: string; username: string; displayName: string; existing: { credentialId: string; transports?: AuthenticatorTransportFuture[] }[] }, policy: WebAuthnPolicy) {
  return generateRegistrationOptions({
    rpName: policy.rpName, rpID: policy.rpId, userID: new TextEncoder().encode(input.userId), userName: input.username,
    userDisplayName: input.displayName, timeout: 5 * 60_000, attestationType: "none",
    excludeCredentials: input.existing.map((entry) => ({ id: entry.credentialId, transports: entry.transports })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "required" }
  });
}

export function hashWebAuthnChallenge(challenge: string, challengeId: string, environment: string, env: NodeJS.ProcessEnv = process.env) {
  return hashBoundToken({ token: challenge, purpose: "webauthn-challenge", environment, subject: challengeId }, env);
}

export async function verifyPasskeyRegistration(input: { response: RegistrationResponseJSON; challengeId: string; challengeHash: string; environment: string }, policy: WebAuthnPolicy, env: NodeJS.ProcessEnv = process.env) {
  return verifyRegistrationResponse({ response: input.response, expectedChallenge: (challenge) => boundTokenMatches({ token: challenge, purpose: "webauthn-challenge", environment: input.environment, subject: input.challengeId, expectedHash: input.challengeHash }, env), expectedOrigin: policy.origin, expectedRPID: policy.rpId, requireUserPresence: true, requireUserVerification: true });
}

export async function createPasskeyAuthenticationOptions(input: { credentialId: string; transports?: AuthenticatorTransportFuture[] }[], policy: WebAuthnPolicy) {
  return generateAuthenticationOptions({ rpID: policy.rpId, timeout: 5 * 60_000, userVerification: "required", allowCredentials: input.map((entry) => ({ id: entry.credentialId, transports: entry.transports })) });
}

export async function verifyPasskeyAuthentication(input: { response: AuthenticationResponseJSON; challengeId: string; challengeHash: string; environment: string; credentialId: string; publicKey: Uint8Array; counter: number; transports?: AuthenticatorTransportFuture[] }, policy: WebAuthnPolicy, env: NodeJS.ProcessEnv = process.env) {
  return verifyAuthenticationResponse({ response: input.response, expectedChallenge: (challenge) => boundTokenMatches({ token: challenge, purpose: "webauthn-challenge", environment: input.environment, subject: input.challengeId, expectedHash: input.challengeHash }, env), expectedOrigin: policy.origin, expectedRPID: policy.rpId, requireUserVerification: true, credential: { id: input.credentialId, publicKey: input.publicKey as Uint8Array<ArrayBuffer>, counter: input.counter, transports: input.transports } });
}
