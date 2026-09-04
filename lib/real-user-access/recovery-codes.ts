import { randomBytes } from "node:crypto";
import { boundTokenMatches, hashBoundToken } from "@/lib/real-user-access/crypto";

export function generateRecoveryCodes(userId: string, environment: string, env: NodeJS.ProcessEnv = process.env) {
  return Array.from({ length: 10 }, () => {
    const raw = randomBytes(10).toString("hex").toUpperCase();
    const code = `${raw.slice(0, 5)}-${raw.slice(5, 10)}-${raw.slice(10, 15)}-${raw.slice(15, 20)}`;
    return { code, codeHash: hashRecoveryCode(code, userId, environment, env) };
  });
}

export function hashRecoveryCode(code: string, userId: string, environment: string, env: NodeJS.ProcessEnv = process.env) {
  return hashBoundToken({ token: normalizeRecoveryCode(code), purpose: "mfa-recovery-code", environment, subject: userId }, env);
}

export function recoveryCodeMatches(code: string, expectedHash: string, userId: string, environment: string, env: NodeJS.ProcessEnv = process.env) {
  return boundTokenMatches({ token: normalizeRecoveryCode(code), purpose: "mfa-recovery-code", environment, subject: userId, expectedHash }, env);
}

export function normalizeRecoveryCode(code: string) { return code.replace(/[^a-f0-9]/gi, "").toUpperCase(); }
