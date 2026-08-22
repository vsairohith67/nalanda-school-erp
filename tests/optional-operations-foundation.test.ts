import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { visibleNavigationItems } from "@/lib/access-rules";
import {
  CAFETERIA_V1_5,
  optionalOperationsFeatureEnabled,
  TRANSPORT_V1_5,
} from "@/lib/optional-operations-feature-flags";
import { PERMISSIONS, RECOMMENDED_ROLE_PERMISSIONS } from "@/lib/permissions";

const root = process.cwd();
const originalEnvironment = {
  NODE_ENV: process.env.NODE_ENV,
  OPTIONAL_OPS_SYNTHETIC_QA: process.env.OPTIONAL_OPS_SYNTHETIC_QA,
  TRANSPORT_V1_5: process.env.TRANSPORT_V1_5,
  CAFETERIA_V1_5: process.env.CAFETERIA_V1_5,
};

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

describe("Optional Operations V1.5 foundations", () => {
  it("keeps both governed features default-off and refuses a production override", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.OPTIONAL_OPS_SYNTHETIC_QA = "1";
    process.env.TRANSPORT_V1_5 = "enabled";
    process.env.CAFETERIA_V1_5 = "enabled";
    expect(optionalOperationsFeatureEnabled(TRANSPORT_V1_5, "SUPER_ADMIN")).toBe(false);
    expect(optionalOperationsFeatureEnabled(CAFETERIA_V1_5, "SUPER_ADMIN")).toBe(false);
    const flags = JSON.parse(readFileSync(path.join(root, "config/release-feature-flags.json"), "utf8")) as Array<Record<string, unknown>>;
    for (const key of ["transport-v1-5", "cafeteria-v1-5"]) {
      const flag = flags.find((entry) => entry.key === key);
      expect(flag).toMatchObject({ defaultState: false, rolloutPercentage: 0 });
    }
  });

  it("hides disabled navigation and exposes it only when the matching flag is enabled", () => {
    const permissions = RECOMMENDED_ROLE_PERMISSIONS.SUPER_ADMIN;
    const disabled = visibleNavigationItems(permissions, "SUPER_ADMIN").map((item) => item.href);
    expect(disabled).not.toContain("/operations/transport");
    expect(disabled).not.toContain("/operations/cafeteria");
    const enabled = visibleNavigationItems(permissions, "SUPER_ADMIN", ["TRANSPORT_V1_5", "CAFETERIA_V1_5"]).map((item) => item.href);
    expect(enabled).toContain("/operations/transport");
    expect(enabled).toContain("/operations/cafeteria");
  });

  it("grants management only to Super Admin by default", () => {
    const management = PERMISSIONS.filter((permission) => /^(MANAGE_TRANSPORT|MANAGE_CAFETERIA|RECORD_CAFETERIA)/.test(permission));
    expect(management.length).toBeGreaterThan(0);
    for (const permission of management) {
      expect(RECOMMENDED_ROLE_PERMISSIONS.SUPER_ADMIN.has(permission)).toBe(true);
      for (const role of ["DIRECTOR", "PRINCIPAL", "TEACHER", "COMPUTER_OPERATOR", "ACCOUNTANT", "VIEWER", "PARENT", "STUDENT"] as const) {
        expect(RECOMMENDED_ROLE_PERMISSIONS[role].has(permission), `${role}:${permission}`).toBe(false);
      }
    }
    expect(RECOMMENDED_ROLE_PERMISSIONS.PARENT.has("VIEW_OWN_CHILD_TRANSPORT")).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.PARENT.has("VIEW_OWN_CHILD_CAFETERIA")).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.STUDENT.has("VIEW_OWN_CHILD_TRANSPORT")).toBe(false);
  });

  it("keeps Transport and Cafeteria in separate additive models without forbidden integrations", () => {
    const schema = readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
    const optionalModels = schema.slice(schema.indexOf("model TransportVehicle"));
    expect(optionalModels.match(/^model Transport/gm)).toHaveLength(6);
    expect(optionalModels.match(/^model Cafeteria/gm)).toHaveLength(6);
    expect(optionalModels).not.toMatch(/Gps|Telematics|MapApi|Wallet|PaymentCard|Diagnosis|MedicalRecord|VendorIntegration/);
    expect(optionalModels).not.toContain("homeAddress");
    const migration = readFileSync(path.join(root, "prisma/migrations/20260822090000_optional_operations_v1_5_foundations/migration.sql"), "utf8");
    expect(migration).toContain('CHECK ("capacity" > 0)');
    expect(migration).toContain('CHECK ("allocatedSeats" >= 0 AND "allocatedSeats" <= "capacity")');
  });

  it("guards every module API with authenticated fail-closed helpers", () => {
    const roots = [
      path.join(root, "app/api/operations/transport"),
      path.join(root, "app/api/operations/cafeteria"),
      path.join(root, "app/api/parent/transport"),
      path.join(root, "app/api/parent/cafeteria"),
    ];
    const routeFiles = roots.flatMap((directory) => {
      const walk = (current: string): string[] => readdirSync(current, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(path.join(current, entry.name)) : entry.name === "route.ts" ? [path.join(current, entry.name)] : []);
      return walk(directory);
    });
    expect(routeFiles.length).toBeGreaterThanOrEqual(12);
    for (const file of routeFiles) {
      const source = readFileSync(file, "utf8");
      expect(source, file).toContain("optionalOperationsActor");
      expect(source, file).not.toMatch(/request\.json\(\)/);
    }
  });

  it("documents the privacy, safety, finance, and non-activation boundaries in executable policy", () => {
    const transport = readFileSync(path.join(root, "lib/transport.ts"), "utf8");
    const cafeteria = readFileSync(path.join(root, "lib/cafeteria.ts"), "utf8");
    expect(transport).toContain('capacity: "HARD_BLOCK_EFFECTIVE_INTERVAL"');
    expect(transport).toContain('locationData: "APPROVED_STOP_ONLY"');
    expect(transport).not.toContain("address: true");
    expect(transport).toContain('requirePermission(actor, "EXPORT_TRANSPORT_REPORTS")');
    expect(cafeteria).toContain('dietaryNote: "OMITTED_REQUIRES_SEPARATE_HEALTH_DATA_GOVERNANCE"');
    expect(cafeteria).toContain('requirePermission(actor, "EXPORT_CAFETERIA_REPORTS")');
    expect(cafeteria).toContain("CAFETERIA_HEALTH_DATA_PROHIBITED");
    expect(cafeteria).toContain('financialMutation: "PROHIBITED"');
  });
});
