import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const docs = [
  "STAGING_CURRENT_RUNTIME_INVENTORY.md",
  "STAGING_SQLITE_FEASIBILITY_AND_LIMITS.md",
  "STAGING_HOSTING_OPTIONS.md",
  "STAGING_DEPLOYMENT_ARCHITECTURE.md",
  "STAGING_ENVIRONMENT_AND_SECRET_MATRIX.md",
  "STAGING_DATABASE_DEPLOYMENT_AND_ROLLBACK.md",
  "STAGING_DEPLOYMENT_PIPELINE.md",
  "STAGING_TLS_PROXY_AND_SECURITY_HEADERS.md",
  "STAGING_MONITORING_AND_LOGGING_PLAN.md",
  "STAGING_SCHEDULER_AND_SINGLETON_JOBS.md",
  "STAGING_DATA_AND_PRIVACY_POLICY.md",
  "PWA_PHYSICAL_DEVICE_STAGING_CHECKLIST.md",
  "STAGING_COST_AND_DECISION_REGISTER.md",
  "STAGING_LOCAL_REHEARSAL_REPORT.md",
  "STAGING_READINESS_QA_REPORT.md"
];
const source = (name: string) => readFileSync(`docs/${name}`, "utf8");

describe("DEVOPS-1C staging readiness package", () => {
  it("contains every required staging design document", () => {
    for (const name of docs) expect(source(name).length, name).toBeGreaterThan(500);
  });

  it("records restricted SQLite and rejects ephemeral/serverless persistence", () => {
    expect(source("STAGING_SQLITE_FEASIBILITY_AND_LIMITS.md")).toContain("SQLITE_STAGING_ACCEPTABLE_WITH_RESTRICTIONS");
    expect(source("STAGING_HOSTING_OPTIONS.md")).toMatch(/serverless[\s\S]*Rejected|Serverless[\s\S]*Rejected/i);
    expect(source("STAGING_HOSTING_OPTIONS.md")).toMatch(/ephemeral/i);
  });

  it("requires fresh migrate-deploy, backup, maintenance and rollback separation", () => {
    const database = source("STAGING_DATABASE_DEPLOYMENT_AND_ROLLBACK.md");
    const pipeline = source("STAGING_DEPLOYMENT_PIPELINE.md");
    expect(database).toContain("prisma migrate deploy");
    expect(database).toContain("Fresh synthetic staging database");
    expect(database).toContain("not authorised in DEVOPS-1C");
    expect(pipeline).toMatch(/pre-migration[\s\S]*backup/i);
    expect(pipeline).toMatch(/maintenance/i);
    expect(pipeline).toMatch(/previous release/i);
  });

  it("requires HTTPS, trusted proxy sanitization and private no-store caching", () => {
    const tls = source("STAGING_TLS_PROXY_AND_SECURITY_HEADERS.md");
    expect(tls).toEqual(expect.stringContaining("HTTPS"));
    expect(tls).toEqual(expect.stringContaining("single-hop-sanitized"));
    expect(tls).toEqual(expect.stringContaining("private, no-store"));
    expect(tls).toEqual(expect.stringContaining("Strict-Transport-Security"));
  });

  it("keeps staging synthetic-only and physical PWA certification pending HTTPS", () => {
    expect(source("STAGING_DATA_AND_PRIVACY_POLICY.md")).toContain("synthetic-only");
    expect(source("PWA_PHYSICAL_DEVICE_STAGING_CHECKLIST.md")).toContain("must not begin until");
  });

  it("does not claim a deployment, DNS change, provider credential or purchase is complete", () => {
    const all = docs.map(source).join("\n");
    expect(all).not.toMatch(/(?:cloud|staging) deployment (?:is|was) complete/i);
    expect(all).not.toMatch(/DNS (?:is|was) (?:changed|created|updated)/i);
    expect(all).not.toMatch(/(?:resource|subscription) (?:was|is) purchased/i);
    expect(all).not.toMatch(/gho_[A-Za-z0-9]+|AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/);
  });

  it("lists user-owned cost and architecture decisions", () => {
    const cost = source("STAGING_COST_AND_DECISION_REGISTER.md");
    for (const term of ["Hosting provider", "Monthly budget", "Staging hostname", "Backup destination", "Uptime"]) {
      expect(cost).toContain(term);
    }
  });
});
