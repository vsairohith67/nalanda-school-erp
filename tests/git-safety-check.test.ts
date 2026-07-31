import { describe, expect, it } from "vitest";
import { classifyRiskyPath, formatFindings, scanTextContent } from "../scripts/git-safety-check";

describe("Git safety scanner", () => {
  it("blocks a secret-shaped fixture without echoing its value", () => {
    const secret = ["sk", "proj", "A".repeat(40)].join("-");
    const findings = scanTextContent("src/private-config.ts", `OPENAI_API_KEY="${secret}"`);
    expect(findings.map((finding) => finding.reasonCode)).toContain("OPENAI_API_KEY");
    expect(formatFindings(findings)).not.toContain(secret);
  });

  it("blocks database files", () => {
    expect(classifyRiskyPath("prisma/rehearsal.sqlite-wal").map((finding) => finding.reasonCode)).toContain("DATABASE_FILE");
  });

  it("blocks backup JSON paths", () => {
    expect(classifyRiskyPath("backups/nalanda-backup-example.json").map((finding) => finding.reasonCode)).toContain("BACKUP_JSON");
  });

  it("allows documentation policy wording", () => {
    const findings = scanTextContent("docs/SECURITY_POLICY.md", "Never commit a passwordHash, API key, token, encryption key, or webhook secret.");
    expect(findings).toEqual([]);
  });

  it("allows placeholder-only env examples", () => {
    const findings = scanTextContent(".env.example", [
      'DATABASE_URL="file:./local-example.db"',
      'AUTH_SECRET="<generate-locally-at-least-32-random-characters>"',
      'GMAIL_OAUTH_CLIENT_SECRET="<provider-console-placeholder>"',
      'AUTH2B_DELIVERY_ADAPTER="DISABLED"',
      'SMS_EMAIL_SMS_LIVE_ENABLED="false"'
    ].join("\n"));
    expect(findings).toEqual([]);
  });
});
