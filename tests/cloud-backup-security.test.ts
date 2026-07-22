import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (file: string) => readFileSync(file, "utf8");

describe("cloud backup page and direct API boundaries", () => {
  it("keeps Viewer on aggregate health and reports only", () => {
    expect(source("app/cloud-backup/page.tsx")).toContain('requirePermission("VIEW_CLOUD_BACKUP")');
    expect(source("app/cloud-backup/reports/page.tsx")).toContain('requirePermission("VIEW_CLOUD_BACKUP_REPORTS")');
    for (const file of ["app/cloud-backup/runs/page.tsx", "app/cloud-backup/runs/[id]/page.tsx"]) {
      expect(source(file)).toContain('requirePermission("VERIFY_CLOUD_BACKUP")');
    }
    expect(source("app/cloud-backup/settings/page.tsx")).toContain('requirePermission("MANAGE_CLOUD_BACKUP_PROFILES")');
    expect(source("app/cloud-backup/restore-rehearsals/page.tsx")).toContain('requirePermission("RUN_CLOUD_BACKUP_RESTORE_REHEARSAL")');
    expect(source("app/cloud-backup/retention/page.tsx")).toContain('requirePermission("MANAGE_CLOUD_BACKUP_RETENTION")');
  });

  it("uses the same narrow server permissions for object-detail APIs", () => {
    for (const file of ["app/api/cloud-backup/runs/route.ts", "app/api/cloud-backup/runs/[id]/route.ts"]) {
      expect(source(file)).toContain('requireApiPermission("VERIFY_CLOUD_BACKUP")');
    }
    expect(source("app/api/cloud-backup/profiles/route.ts")).toContain('requireApiPermission("MANAGE_CLOUD_BACKUP_PROFILES")');
    expect(source("app/api/cloud-backup/schedules/route.ts")).toContain('requireApiPermission("MANAGE_CLOUD_BACKUP_SCHEDULES")');
    expect(source("app/api/cloud-backup/restore-rehearsals/route.ts")).toContain('requireApiPermission("RUN_CLOUD_BACKUP_RESTORE_REHEARSAL")');
    expect(source("app/api/cloud-backup/retention/route.ts")).toContain('requireApiPermission("MANAGE_CLOUD_BACKUP_RETENTION")');
    expect(source("app/api/cloud-backup/reports/export/route.ts")).toContain('requireApiPermission("EXPORT_CLOUD_BACKUP_REPORTS")');
  });
});
