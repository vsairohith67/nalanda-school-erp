import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  MARKS_DELEGATION_ELIGIBLE_ROLES,
  MARKS_DELEGATION_PERMISSIONS
} from "@/lib/academic-integrity";
import { eventMediaPublicGalleryEnabled } from "@/lib/event-media";
import { immutablePermissionDenial } from "@/lib/iam/permission-governance";
import { parentMeetingsEnabled } from "@/lib/parent-meeting-feature";
import { can, PERMISSIONS, RECOMMENDED_ROLE_PERMISSIONS, ROLES } from "@/lib/permissions";
import { evaluateReleaseFeatureFlag, releaseFeatureFlags } from "@/lib/release-feature-flags";
import { getSmartAiProvider, validateSmartAiLocalEndpoint } from "@/lib/smart-ai-provider-local";
import { classifySmartAiQuestion } from "@/lib/smart-ai-safety";
import { assertUniversalSearchActor, parseUniversalSearchRequest, UNIVERSAL_SEARCH_LIMITS } from "@/lib/universal-search";

const originalEnvironment = { ...process.env };
afterEach(() => { process.env = { ...originalEnvironment }; });

function trackedFiles() {
  return execFileSync("git", ["ls-files", "-z"], { cwd: process.cwd(), encoding: "utf8" }).split("\0").filter(Boolean).map((file) => file.replaceAll("\\", "/"));
}

describe("FINAL-SCOPE-QA-1A corrected-scope contract acceptance", () => {
  it("keeps role and Academic Integrity decisions deny-first", () => {
    expect(new Set(ROLES).size).toBe(ROLES.length);
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
    expect(can("UNKNOWN_ROLE" as never, "VIEW_DASHBOARD")).toBe(false);
    for (const permission of ["ENTER_MARKS", "SUBMIT_MARKS", "ENTER_ASSIGNED_EXAM_MARKS", "SUBMIT_ASSIGNED_EXAM_MARKS", "ENTER_REPORT_CARD_DATA", "SUBMIT_REPORT_CARDS"] as const) {
      expect(RECOMMENDED_ROLE_PERMISSIONS.TEACHER.has(permission)).toBe(false);
      expect(immutablePermissionDenial("TEACHER", permission)).toMatch(/Academic Integrity v1\.1/);
    }
    expect(can("PRINCIPAL", "ENTER_MARKS")).toBe(true);
    expect(can("SUPER_ADMIN", "ENTER_MARKS")).toBe(true);
    expect(MARKS_DELEGATION_ELIGIBLE_ROLES.has("TEACHER")).toBe(false);
    expect(MARKS_DELEGATION_PERMISSIONS).toEqual([
      "ENTER_MARKS",
      "SUBMIT_MARKS",
      "VIEW_OWN_EXAM_MARKS",
      "ENTER_ASSIGNED_EXAM_MARKS",
      "SUBMIT_ASSIGNED_EXAM_MARKS",
      "REQUEST_EXAM_MARK_CORRECTION"
    ]);
    for (const permission of ["MANAGE_IAM_USERS", "DELEGATE_IAM_ACCESS", "MODERATE_EXAM_MARKS", "REOPEN_EXAM_MARK_SHEETS", "RUN_EXAM_CALCULATIONS", "LOCK_EXAM_CALCULATIONS", "APPROVE_REPORT_CARDS", "ISSUE_REPORT_CARDS", "CORRECT_ISSUED_REPORT_CARDS", "LOCK_EXAMS"] as const) {
      expect(MARKS_DELEGATION_PERMISSIONS).not.toContain(permission);
    }
  });

  it("keeps Universal Search exact-role, bounded and empty-query closed", () => {
    expect(() => assertUniversalSearchActor({ id: "super-admin", role: "SUPER_ADMIN" })).not.toThrow();
    for (const role of ROLES.filter((role) => role !== "SUPER_ADMIN")) {
      expect(() => assertUniversalSearchActor({ id: role, role })).toThrow();
    }
    expect(() => assertUniversalSearchActor({ id: "delegated", role: "DELEGATED_CUSTOM_ROLE" as never })).toThrow();
    for (const input of [{ query: "" }, { query: "a" }, { query: "%_" }, { query: "valid", limit: UNIVERSAL_SEARCH_LIMITS.maximumOverallLimit + 1 }]) {
      expect(() => parseUniversalSearchRequest(input)).toThrow();
    }
  });

  it("keeps Smart AI disabled by default and rejects every non-exact loopback form", () => {
    delete process.env.SMART_AI_PROVIDER;
    delete process.env.SMART_AI_LOCAL_ENDPOINT;
    expect(getSmartAiProvider().status).toMatchObject({ kind: "DISABLED", state: "DISABLED" });
    for (const endpoint of ["http://localhost:11435/generate", "http://127.0.0.1:11435/generate", "http://[::1]:11435/generate"]) {
      expect(validateSmartAiLocalEndpoint(endpoint).hostname.replace(/^\[|\]$/g, "")).toMatch(/^(?:localhost|127\.0\.0\.1|::1)$/);
    }
    for (const endpoint of [
      "https://localhost/generate",
      "http://0.0.0.0:11435/generate",
      "http://192.168.1.5:11435/generate",
      "http://example.com/generate",
      "http://localhost.evil.example/generate",
      "http://user:pass@localhost:11435/generate",
      "http://127.0.0.1.evil.example/generate",
      "http://%31%32%37.0.0.1:11435/generate",
      "http://localhost:11435/generate?next=https://evil.example",
      "http://localhost:11435/generate#https://evil.example"
    ]) expect(() => validateSmartAiLocalEndpoint(endpoint)).toThrow();
    for (const request of ["change marks", "complete Task", "edit Student", "post payment", "change attendance", "publish report", "change IAM", "send messages"]) {
      expect(classifySmartAiQuestion(request), request).toMatchObject({ allowed: false, code: "WRITE_ACTION_REQUEST" });
    }
  });

  it("discovers every committed release flag and exposes its actual runtime enforcement state", () => {
    const flags = releaseFeatureFlags();
    expect(flags.length).toBeGreaterThan(0);
    for (const flag of flags) {
      expect(flag.defaultState, flag.key).toBe(false);
      expect(flag.rolloutPercentage, flag.key).toBe(0);
      expect(evaluateReleaseFeatureFlag({ key: flag.key, environment: flag.environment, role: flag.allowedRoles[0], expectedVersion: flag.version })).toMatchObject({ enabled: false, reason: "DEFAULT_OFF" });
    }
    const contracts = JSON.parse(readFileSync("tools/release-evidence/final-scope-contracts.json", "utf8")) as {
      featureFlagRuntimeContracts: Array<{ key: string; status: string; evidencePaths: string[] }>;
    };
    expect(new Set(contracts.featureFlagRuntimeContracts.map((entry) => entry.key))).toEqual(new Set(flags.map((flag) => flag.key)));
    for (const contract of contracts.featureFlagRuntimeContracts) {
      expect(["ENFORCED", "ENFORCED_NO_MAPPED_SURFACES", "COMPENSATING_CONTROL", "NO_RUNTIME_PROVIDER_CAPABILITY", "NO_RUNTIME_CAPABILITY", "UNENFORCED_EXPOSED_SURFACE", "BLOCKED_BY_EVIDENCE"]).toContain(contract.status);
      expect(contract.evidencePaths.length, contract.key).toBeGreaterThan(0);
      for (const evidencePath of contract.evidencePaths) expect(existsSync(evidencePath), `${contract.key}:${evidencePath}`).toBe(true);
    }
    expect(contracts.featureFlagRuntimeContracts.filter((entry) => entry.status === "UNENFORCED_EXPOSED_SURFACE")).toEqual([]);
    for (const key of ["real-data-imports", "public-admissions-form", "payroll-ess-pilot"]) {
      expect(contracts.featureFlagRuntimeContracts.find((entry) => entry.key === key)?.status).toBe("ENFORCED");
    }
    expect(contracts.featureFlagRuntimeContracts.find((entry) => entry.key === "bulk-exports")?.status).toBe("ENFORCED_NO_MAPPED_SURFACES");
    const example = readFileSync(".env.example", "utf8");
    const assignments = Object.fromEntries(example.split(/\r?\n/).flatMap((line) => {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*["']?([^"'\s#]+)["']?\s*$/);
      return match ? [[match[1], match[2]]] : [];
    }));
    expect(assignments.SMART_AI_PROVIDER).toBe("DISABLED");
    expect(assignments.EVENT_MEDIA_PUBLIC_GALLERY_ENABLED).toBe("false");
    expect(assignments.PARENT_MEETINGS_V1_5).toBe("false");
    for (const [key, value] of Object.entries(assignments).filter(([key]) => /(?:LIVE|PUBLIC|INDEXING).*ENABLED|LIVE_PROVIDERS_ENABLED/.test(key))) {
      expect(value, key).not.toBe("true");
    }
    delete process.env.EVENT_MEDIA_PUBLIC_GALLERY_ENABLED;
    expect(eventMediaPublicGalleryEnabled()).toBe(false);
    delete process.env.PARENT_MEETINGS_V1_5;
    expect(parentMeetingsEnabled()).toBe(false);
  });

  it("keeps backup and restore version support aligned without assuming a historical version", () => {
    const backup = readFileSync("lib/backup.ts", "utf8");
    const restore = readFileSync("lib/restore.ts", "utf8");
    const backupVersion = Number(backup.match(/backupVersion:\s*(\d+)/)?.[1] ?? 0);
    const restoreMaximum = Number(restore.match(/Number\(metadata\.backupVersion\)\s*>\s*(\d+)/)?.[1] ?? 0);
    expect(backupVersion).toBeGreaterThan(0);
    expect(restoreMaximum).toBe(backupVersion);
  });

  it("keeps the active migration graph uniquely named and complete", () => {
    const root = path.join(process.cwd(), "prisma", "migrations");
    const migrations = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
    expect(migrations.length).toBeGreaterThan(0);
    expect(new Set(migrations.map((entry) => entry.toLowerCase())).size).toBe(migrations.length);
    for (const migration of migrations) expect(existsSync(path.join(root, migration, "migration.sql")), migration).toBe(true);
  });

  it("has no focused tests, undisclosed skip directives or assertion-only bypasses", () => {
    const testFiles = trackedFiles().filter((file) => file.startsWith("tests/") && file.endsWith(".test.ts"));
    const skipDirectives: string[] = [];
    for (const file of testFiles) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/\b(?:test|it|describe)\.only\s*\(/);
      if (/\b(?:test|it|describe)\.skip(?:If)?\s*\(/.test(source)) skipDirectives.push(file);
    }
    expect(skipDirectives).toEqual(["tests/payslip-request-qpdf.test.ts"]);
  });

  it("tracks no operational databases, backups, model binaries, build output or unresolved merge markers", () => {
    const files = trackedFiles();
    expect(files.filter((file) => /(?:^|\/)(?:node_modules|\.next|dist|build|out)(?:\/|$)/i.test(file))).toEqual([]);
    expect(files.filter((file) => /\.(?:db|sqlite|sqlite3|gguf|ggml|safetensors|onnx|pt|pth)$/i.test(file))).toEqual([]);
    expect(files.filter((file) => /(?:^|\/)backups?\/.*\.json$/i.test(file))).toEqual([]);
    for (const file of files.filter((file) => /^(?:app|components|config|docs|lib|scripts|tests|tools)\//.test(file))) {
      if (!existsSync(file) || statSync(file).size > 2 * 1024 * 1024) continue;
      expect(readFileSync(file, "utf8"), file).not.toMatch(/^(?:<<<<<<<|=======|>>>>>>>)/m);
    }
  }, 15_000);
});
