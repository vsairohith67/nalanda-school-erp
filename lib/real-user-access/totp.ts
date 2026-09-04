import * as OTPAuth from "otpauth";
import { decryptMfaSecret, encryptMfaSecret, serializeMfaSecretEnvelope } from "@/lib/real-user-access/crypto";

export const TOTP_POLICY = { algorithm: "SHA1", digits: 6, period: 30, window: 1, secretBytes: 20 } as const;

export function createTotpEnrollment(input: { userId: string; authenticatorId: string; accountLabel: string }, env: NodeJS.ProcessEnv = process.env) {
  const secret = new OTPAuth.Secret({ size: TOTP_POLICY.secretBytes });
  const totp = new OTPAuth.TOTP({ issuer: "Nalanda School Management System", label: input.accountLabel, secret, algorithm: TOTP_POLICY.algorithm, digits: TOTP_POLICY.digits, period: TOTP_POLICY.period });
  const aad = totpAad(input.userId, input.authenticatorId);
  const secretEnvelope = serializeMfaSecretEnvelope(encryptMfaSecret(secret.base32, aad, env));
  return { secretEnvelope, keyVersion: JSON.parse(secretEnvelope).keyVersion as string, provisioningUri: totp.toString(), algorithm: TOTP_POLICY.algorithm, digits: TOTP_POLICY.digits, period: TOTP_POLICY.period };
}

export function verifyTotp(input: { token: string; secretEnvelope: string; userId: string; authenticatorId: string; lastUsedStep: number | null; timestamp?: number }, env: NodeJS.ProcessEnv = process.env) {
  if (!/^\d{6}$/.test(input.token)) return { verified: false, reason: "INVALID_FORMAT" as const, usedStep: null };
  const timestamp = input.timestamp ?? Date.now();
  const secret = OTPAuth.Secret.fromBase32(decryptMfaSecret(input.secretEnvelope, totpAad(input.userId, input.authenticatorId), env));
  const delta = OTPAuth.TOTP.validate({ token: input.token, secret, algorithm: TOTP_POLICY.algorithm, digits: TOTP_POLICY.digits, period: TOTP_POLICY.period, timestamp, window: TOTP_POLICY.window });
  if (delta == null) return { verified: false, reason: "INVALID_TOKEN" as const, usedStep: null };
  const usedStep = OTPAuth.TOTP.counter({ period: TOTP_POLICY.period, timestamp }) + delta;
  if (input.lastUsedStep != null && usedStep <= input.lastUsedStep) return { verified: false, reason: "REPLAYED_TOKEN" as const, usedStep };
  return { verified: true, reason: "VERIFIED" as const, usedStep };
}

export function generateTotpForSyntheticQa(input: { secretEnvelope: string; userId: string; authenticatorId: string; timestamp?: number }, env: NodeJS.ProcessEnv = process.env) {
  const secret = OTPAuth.Secret.fromBase32(decryptMfaSecret(input.secretEnvelope, totpAad(input.userId, input.authenticatorId), env));
  return OTPAuth.TOTP.generate({ secret, algorithm: TOTP_POLICY.algorithm, digits: TOTP_POLICY.digits, period: TOTP_POLICY.period, timestamp: input.timestamp ?? Date.now() });
}

function totpAad(userId: string, authenticatorId: string) { return `nalanda:mfa:totp:${userId}:${authenticatorId}`; }
