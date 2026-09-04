import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROLE_TEMPLATE_CATALOGUE, accessTemplate, roleCombinationWarnings } from "@/lib/real-user-access/catalogue";
import { ACCESS_REQUEST_STATES, ACCESS_REQUEST_TRANSITIONS, activationBlockers, assertAccessTransition } from "@/lib/real-user-access/lifecycle";
import { decryptMfaSecret, encryptMfaSecret, generateBoundToken, hashBoundToken, rotateMfaSecret, serializeMfaSecretEnvelope } from "@/lib/real-user-access/crypto";
import { createTotpEnrollment, generateTotpForSyntheticQa, verifyTotp } from "@/lib/real-user-access/totp";
import { generateRecoveryCodes, recoveryCodeMatches } from "@/lib/real-user-access/recovery-codes";
import { validateAccountPreparationPackage } from "@/lib/real-user-access/validation";
import { resolveWebAuthnPolicy } from "@/lib/real-user-access/webauthn";
import { syntheticInvitationPreview } from "@/lib/real-user-access/invitations";
import { emptyRealUserAccessBackup, sanitizeRealUserAccessBackup, validateRealUserAccessBackup } from "@/lib/real-user-access/backup";
import { ROLES } from "@/lib/permissions";

const env = {
  SESSION_SECRET: "synthetic-session-secret-at-least-32-characters-long",
  AUTH_MFA_KEYRING_JSON: JSON.stringify({ active: "V2", keys: { V1: Buffer.alloc(32, 1).toString("base64"), V2: Buffer.alloc(32, 2).toString("base64") } }),
  AUTH_WEBAUTHN_RP_ID: "localhost",
  AUTH_WEBAUTHN_ORIGIN: "http://localhost:3000",
  NODE_ENV: "test"
} as NodeJS.ProcessEnv;

describe("REAL-USER-ACCESS-READINESS-1A security contracts", () => {
  it("admits only the bounded unauthenticated activation and MFA completion routes through middleware", () => {
    const source = readFileSync("middleware.ts", "utf8");
    expect(source).toContain('"/activate"');
    expect(source).toContain('"/api/auth/login/mfa"');
    expect(source).toContain('"/api/auth/invitations/accept"');
    expect(source).toContain('"/api/auth/activation/"');
    expect(source).not.toContain('"/api/auth/step-up/"');
    expect(source).not.toContain('"/api/user-access-readiness/"');
  });

  it("publishes every current base role plus three explicit specialised templates", () => {
    expect(ROLE_TEMPLATE_CATALOGUE).toHaveLength(14);
    expect(ROLE_TEMPLATE_CATALOGUE.filter((entry) => entry.implementation === "BASE_ROLE").map((entry) => entry.id)).toEqual([...ROLES]);
    expect(accessTemplate("MARKS_ENTRY_OPERATOR")?.implementation).toBe("PERMISSION_PROFILE");
    expect(accessTemplate("UDISE_DATA_OPERATOR")?.implementation).toBe("PLANNED_PROFILE");
    expect(accessTemplate("SUPER_ADMIN")?.mfa).toBe("MANDATORY");
    expect(roleCombinationWarnings(["TEACHER", "MARKS_ENTRY_OPERATOR"])).toContain("REVIEW_REQUIRED:MARKS_ENTRY_OPERATOR+TEACHER");
  });

  it("defines an explicit lifecycle and blocks activation until every server-side gate is met", () => {
    expect(Object.keys(ACCESS_REQUEST_TRANSITIONS)).toEqual([...ACCESS_REQUEST_STATES]);
    expect(() => assertAccessTransition("PREPARED", "ACTIVE")).toThrow("ACCESS_TRANSITION_REFUSED");
    expect(activationBlockers({ identityLinkReviewed: true, roleApproved: true, scopeApproved: true, invitationAccepted: true, credentialEstablished: true, mfaRequired: true, mfaEnrolled: false, trainingSatisfied: false, policySatisfied: false, eligible: true, featureEnabled: true }))
      .toEqual(["MFA_NOT_ENROLLED", "TRAINING_NOT_SATISFIED", "POLICY_NOT_ACKNOWLEDGED"]);
  });

  it("binds hashes and authenticated encryption to purpose, environment, subject, and AAD", () => {
    const token = generateBoundToken();
    expect(token).not.toBe(generateBoundToken());
    expect(hashBoundToken({ token, purpose: "invite", environment: "QA", subject: "u1" }, env)).not.toBe(hashBoundToken({ token, purpose: "invite", environment: "PROD", subject: "u1" }, env));
    const envelope = encryptMfaSecret("JBSWY3DPEHPK3PXP", "user:factor", env);
    expect(decryptMfaSecret(envelope, "user:factor", env)).toBe("JBSWY3DPEHPK3PXP");
    expect(() => decryptMfaSecret(envelope, "other:factor", env)).toThrow();
    expect(rotateMfaSecret(serializeMfaSecretEnvelope(envelope), "user:factor", env).keyVersion).toBe("V2");
  });

  it("accepts RFC 6238 TOTP only once per time-step and keeps recovery codes one-use capable", () => {
    const factor = createTotpEnrollment({ userId: "u1", authenticatorId: "f1", accountLabel: "synthetic.qa" }, env);
    const timestamp = 1_800_000_000_000;
    const token = generateTotpForSyntheticQa({ secretEnvelope: factor.secretEnvelope, userId: "u1", authenticatorId: "f1", timestamp }, env);
    const accepted = verifyTotp({ token, secretEnvelope: factor.secretEnvelope, userId: "u1", authenticatorId: "f1", lastUsedStep: null, timestamp }, env);
    expect(accepted.verified).toBe(true);
    expect(verifyTotp({ token, secretEnvelope: factor.secretEnvelope, userId: "u1", authenticatorId: "f1", lastUsedStep: accepted.usedStep, timestamp }, env)).toMatchObject({ verified: false, reason: "REPLAYED_TOKEN" });
    const codes = generateRecoveryCodes("u1", "QA", env);
    expect(codes).toHaveLength(10);
    expect(new Set(codes.map((entry) => entry.code)).size).toBe(10);
    expect(recoveryCodeMatches(codes[0].code.toLowerCase(), codes[0].codeHash, "u1", "QA", env)).toBe(true);
    expect(recoveryCodeMatches(codes[0].code, codes[0].codeHash, "u1", "PROD", env)).toBe(false);
  });

  it("permits loopback WebAuthn only under the explicit synthetic policy", () => {
    expect(resolveWebAuthnPolicy(env, true)).toMatchObject({ rpId: "localhost", origin: "http://localhost:3000" });
    expect(() => resolveWebAuthnPolicy(env, false)).toThrow("WEBAUTHN_HTTPS_ORIGIN_REQUIRED");
    expect(() => resolveWebAuthnPolicy({ ...env, AUTH_WEBAUTHN_RP_ID: "example.test", AUTH_WEBAUTHN_ORIGIN: "https://wrong.example.invalid" }, false)).toThrow("WEBAUTHN_RP_ORIGIN_MISMATCH");
  });

  it("places invitation material in a URL fragment and refuses non-loopback previews", () => {
    const preview = syntheticInvitationPreview({ role: "TEACHER", expiresAt: new Date("2026-09-04T00:00:00Z"), activationOrigin: "http://127.0.0.1:3000", oneTimeToken: `${"a".repeat(8)}-${"b".repeat(4)}-${"c".repeat(4)}-${"d".repeat(4)}-${"e".repeat(12)}.${"x".repeat(43)}` });
    expect(preview.link).toContain("/activate#token=");
    expect(preview.link).not.toContain("?token=");
    expect(() => syntheticInvitationPreview({ role: "TEACHER", expiresAt: new Date(), activationOrigin: "https://school.example", oneTimeToken: "token" })).toThrow("SYNTHETIC_INVITATION_LOOPBACK_ONLY");
  });

  it("validates the minimum 38-account synthetic wave plus specialised and multi-role cases", () => {
    const roles = ["SUPER_ADMIN", "SUPER_ADMIN", "DIRECTOR", "PRINCIPAL", "ACCOUNTANT", "COMPUTER_OPERATOR", ...Array(10).fill("TEACHER"), ...Array(10).fill("PARENT"), ...Array(10).fill("STUDENT"), "VIEWER", "GATE_STAFF"];
    const wave = roles.map((role, index) => ({ personReference: `person-${index}`, personType: role === "PARENT" ? "GUARDIAN" : role === "STUDENT" ? "STUDENT" : "STAFF", username: `synthetic.user.${index}`, email: `synthetic.user.${index}@example.test`, roles: [role], scopes: ["SYNTHETIC_SCOPE"], training: [...(accessTemplate(role)?.training ?? [])], mfaRequired: accessTemplate(role)?.mfa === "MANDATORY", approverReference: `approver-${index}` }));
    wave.push(
      { personReference: "marks-operator", personType: "STAFF", username: "synthetic.marks", email: "synthetic.marks@example.test", roles: ["TEACHER", "MARKS_ENTRY_OPERATOR"], scopes: ["SYNTHETIC_CLASS_10_A", "VALID_UNTIL_2026_09_04"], training: [...new Set([...(accessTemplate("TEACHER")?.training ?? []), ...(accessTemplate("MARKS_ENTRY_OPERATOR")?.training ?? [])])], mfaRequired: true, approverReference: "approver-marks" },
      { personReference: "attendance-operator", personType: "STAFF", username: "synthetic.attendance", email: "synthetic.attendance@example.test", roles: ["TEACHER", "ATTENDANCE_OPERATOR"], scopes: ["SYNTHETIC_CLASS_9_B", "VALID_UNTIL_2026_09_04"], training: [...new Set([...(accessTemplate("TEACHER")?.training ?? []), ...(accessTemplate("ATTENDANCE_OPERATOR")?.training ?? [])])], mfaRequired: true, approverReference: "approver-attendance" },
      { personReference: "teacher-parent", personType: "STAFF", username: "synthetic.teacher.parent", email: "synthetic.teacher.parent@example.test", roles: ["TEACHER", "PARENT"], scopes: ["SYNTHETIC_STAFF_SCOPE", "SYNTHETIC_GUARDIAN_SCOPE"], training: [...new Set([...(accessTemplate("TEACHER")?.training ?? []), ...(accessTemplate("PARENT")?.training ?? [])])], mfaRequired: true, approverReference: "approver-multirole" }
    );
    const result = validateAccountPreparationPackage(wave);
    expect(wave).toHaveLength(41);
    expect(result).toMatchObject({ valid: true, mode: "PREVIEW_ONLY" });
    expect(result.findings.map((finding) => finding.code)).toEqual(expect.arrayContaining(["REVIEW_REQUIRED:MARKS_ENTRY_OPERATOR+TEACHER", "REVIEW_REQUIRED:MULTI_PERSON_LINK"]));
    const unsafe = structuredClone(wave); unsafe[1].username = unsafe[0].username; unsafe[2].scopes = ["=WEBSERVICE(\"https://example.invalid\")"];
    expect(validateAccountPreparationPackage(unsafe).findings.map((finding) => finding.code)).toEqual(expect.arrayContaining(["DUPLICATE_USERNAME", "CSV_FORMULA_INJECTION"]));
  });

  it("sanitizes durable access backups and rejects secret-shaped or cross-record rows", () => {
    const clean = sanitizeRealUserAccessBackup({ invitations: [{ id: "i1", tokenHash: "forbidden-name", secretHash: "hash", userId: "u1" }], mfaRecoveryCodes: [{ id: "c1", codeHash: "forbidden-name", recoveryCodeHash: "hash", userId: "u1" }] });
    expect(JSON.stringify(clean)).not.toMatch(/tokenHash|codeHash/);
    const blank = emptyRealUserAccessBackup();
    expect(() => validateRealUserAccessBackup({ ...blank, invitations: [{ id: "i1", tokenHash: "secret" }] }, { userIds: new Set(), studentIds: new Set(), guardianIds: new Set(), staffMemberIds: new Set() })).toThrow("tokenHash is not supported");
  });
});
