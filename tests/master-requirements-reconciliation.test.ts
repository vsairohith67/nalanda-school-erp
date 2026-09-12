import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import historical from "@/config/requirements-history/master-register-1.0.0.json";
import register from "@/config/master-requirements-register.json";
import audit from "@/config/master-requirements-audit-evidence.json";
import certificateDelta from "@/config/certificate-graduation-source-delta.json";

import featureDelta from "@/config/prior-year-concession-source-delta.json";
import debt from "@/config/product-experience-debt-register.json";
import screens from "@/config/product-experience-screen-register.json";
import { MASTER_BASE, PRIOR_REGISTER_HASH, publicContentErrors, repositorySourceReader, sourceHash, validateMasterRequirements } from "@/lib/master-requirements";

const copy = () => structuredClone(register);
const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).trim();

describe("Living Master Requirements fail-closed contracts", () => {
  it("validates the real schema, exact owner inventory and concrete source evidence", () => {
    expect(validateMasterRequirements(register, repositorySourceReader())).toEqual([]);
    expect(register.requirements).toHaveLength(46);
    expect(Object.values(register.statusCounts).reduce((a, b) => a + b, 0)).toBe(46);
  });
  it("records native Git-proven absence for the new dynamic API paths", () => {
    // These exact paths were absent in authorized tree 2c7f1a1, verified with
    // git cat-file --batch. Do not hash git show fallback output for [id] paths.
    const absentAtAuthorizedBase = [
      "app/api/certificates/[id]/pdf/route.ts",
      "app/api/certificates/bulk/[id]/pdf/route.ts",
      "app/api/certificates/bulk/[id]/route.ts",
      "app/api/certificates/requests/[id]/charge/route.ts",
      "app/api/parent/certificates/[id]/pdf/route.ts"
    ];
    for (const file of absentAtAuthorizedBase) {
      const entry = certificateDelta.added.find(item => item.path === file);
      expect(entry, file).toBeDefined(); expect(entry!.authorizedBaseSha256, file).toBeNull();
    }
  });
  it("rejects missing, duplicate and out-of-range IDs", () => {
    const dropped = copy(); dropped.requirements.pop(); expect(validateMasterRequirements(dropped).length).toBeGreaterThan(0);
    const duplicate = copy(); duplicate.requirements[1].id = duplicate.requirements[0].id; expect(validateMasterRequirements(duplicate)).toContain("EXACT_ORDERED_ID_SET_REQUIRED");
    const invalid = copy(); invalid.requirements[0].id = "NPS-REQ-047"; expect(validateMasterRequirements(invalid).length).toBeGreaterThan(0);
  });
  it("rejects unsupported statuses, unknown fields and inaccurate status totals", () => {
    const state = copy(); state.requirements[0].status = "READY"; expect(validateMasterRequirements(state).length).toBeGreaterThan(0);
    const extra = { ...copy(), activatedUsers: [] }; expect(validateMasterRequirements(extra).length).toBeGreaterThan(0);
    const count = copy(); count.statusCounts.COMPLETE++; expect(validateMasterRequirements(count)).toContain("STATUS_COUNT_MISMATCH:COMPLETE");
  });
  it("requires implementation, tests, recovery references and missing acceptance by status", () => {
    for (const field of ["evidence", "tests", "qaEvidence"] as const) {
      const candidate = copy(); candidate.requirements[0][field] = []; expect(validateMasterRequirements(candidate).length).toBeGreaterThan(0);
    }
    const candidate = copy(); candidate.requirements[0].missingAcceptanceCriteria = []; expect(validateMasterRequirements(candidate).length).toBeGreaterThan(0);
    const recovery = copy(); recovery.requirements[4].backupRestoreCoverage.sourceFiles = []; expect(validateMasterRequirements(recovery).length).toBeGreaterThan(0);
    const falseComplete = copy(); falseComplete.requirements[0].status = "COMPLETE"; expect(validateMasterRequirements(falseComplete).length).toBeGreaterThan(0);
  });
  it("requires repository and retained-history search for every MISSING verdict", () => {
    const candidate = copy(); const missing = candidate.requirements.find(r => r.status === "MISSING")!;
    missing.searchEvidence.historyCommits = []; expect(validateMasterRequirements(candidate).length).toBeGreaterThan(0);
    expect(audit.retainedContentSearch.result).toBe("NO_MATCHING_SOURCE_CHANGE");
    for (const req of register.requirements.filter(r => r.status === "MISSING")) {
      expect(req.searchEvidence.neighboringFiles.length).toBeGreaterThan(0);
      for (const sha of req.searchEvidence.historyCommits) expect(sha).toMatch(/^[a-f0-9]{40}$/);
    }
  });
  it("rejects missing dependencies, self-cycles and multi-node cycles", () => {
    const unknown = copy(); unknown.requirements[0].dependencies = ["NPS-REQ-049"]; expect(validateMasterRequirements(unknown).some(x => x.startsWith("UNKNOWN_DEPENDENCY"))).toBe(true);
    const self = copy(); self.requirements[0].dependencies = [self.requirements[0].id]; expect(validateMasterRequirements(self).some(x => x.startsWith("DEPENDENCY_CYCLE"))).toBe(true);
    const cycle = copy(); cycle.requirements[0].dependencies = [cycle.requirements[1].id]; expect(validateMasterRequirements(cycle).some(x => x.startsWith("DEPENDENCY_CYCLE"))).toBe(true);
  });
  it("detects duplicate semantic titles and any owner-intent drift", () => {
    const duplicate = copy(); duplicate.requirements[1].title = duplicate.requirements[0].title.toUpperCase().replace(/,/g, " ");
    expect(validateMasterRequirements(duplicate).some(x => x.startsWith("DUPLICATE_SEMANTIC_REQUIREMENT"))).toBe(true);
    const intent = copy(); intent.requirements[0].sourceIntent += " altered"; expect(validateMasterRequirements(intent)).toContain("OWNER_INTENT_DRIFT");
    const decision = copy(); decision.settledOwnerDecisions.pop(); expect(validateMasterRequirements(decision)).toContain("OWNER_INTENT_DRIFT");
  });
  it("requires explicit valid external gates and honest approval state", () => {
    const unknown = copy(); unknown.requirements[0].externalGates = ["UNKNOWN"]; expect(validateMasterRequirements(unknown).some(x => x.startsWith("UNKNOWN_EXTERNAL_GATE"))).toBe(true);
    const action = copy(); action.requirements[0].permissions.push("ASSIGN_ROLE"); expect(validateMasterRequirements(action).some(x => x.startsWith("UNKNOWN_PERMISSION"))).toBe(true);
    const blocked = copy(); blocked.requirements.find(r => r.status === "BLOCKED")!.externalGates = []; expect(validateMasterRequirements(blocked).length).toBeGreaterThan(0);
    const approval = copy(); approval.approvalState = "APPROVED"; expect(validateMasterRequirements(approval)).toContain("APPROVAL_STATE_MISMATCH");
    const invalidTime = { ...copy(), approvalState: "APPROVED", approvedAt: "2026-02-30T00:00:00.000Z" }; expect(validateMasterRequirements(invalidTime)).toContain("INVALID_APPROVAL_TIMESTAMP");
  });
  it("rejects absent, escaped and changed evidence without reading outside the repository", () => {
    const escaped = copy(); escaped.requirements[0].sourceFiles.push("../private.txt"); expect(validateMasterRequirements(escaped).some(x => x.startsWith("UNSAFE_EVIDENCE_PATH"))).toBe(true);
    const reader = repositorySourceReader(); expect(() => reader("../private.txt")).toThrow();
    const missing = copy(); missing.requirements[0].tests.push("tests/no-such-test.ts"); expect(validateMasterRequirements(missing, reader).some(x => x.startsWith("EVIDENCE_NOT_FOUND"))).toBe(true);
    const drift = copy(); drift.requirements[0].evidence[0].sha256 = "0".repeat(64); expect(validateMasterRequirements(drift, reader).some(x => x.startsWith("EVIDENCE_DRIFT"))).toBe(true);
  });
  it("rejects contacts, credentials, private paths, named approvers and operational record fields", () => {
    const unsafe = ["sample@" + "private-mail.net", "+91" + "9876543210", "123456" + "789012", "ghp_" + "x".repeat(36), "C:" + "/Users/private/record", "Dr." + " Sample Citizen", { approverName: "Synthetic forbidden field" }];
    for (const value of unsafe) expect(publicContentErrors(value).length).toBeGreaterThan(0);
    expect(publicContentErrors({ nested: [{ path: "C:" + "\\Users\\private\\record" }] })).toContain("PRIVATE_PATH");
    expect(publicContentErrors({ nested: { note: "+91 " + "98765 43210" } })).toContain("PRIVATE_CONTACT");
    expect(publicContentErrors("１２３４ " + "５６７８ ９０１２")).toContain("PRIVATE_CONTACT");
    expect(publicContentErrors({ branding: "NALANDA PUBLIC SCHOOL", approvalRole: "Principal" })).toEqual([]);
    expect(publicContentErrors(debt)).toEqual([]);
  });
  it("preserves frozen branch evidence at its admitted committed source, separately from integrated evidence", () => {
    const at = (head: string, path: string) => execFileSync("git", ["show", head + ":" + path], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    expect(sourceHash(readFileSync("config/requirements-history/master-register-1.0.0.json", "utf8"))).toBe(PRIOR_REGISTER_HASH);
    expect(register.priorRegisterHash).toBe(PRIOR_REGISTER_HASH);
    expect(register.approvedAt).toBeNull();
    const portableHead = "5bf70e4c4be07b706224debe01a27c54fd0af096";
    const certificateHead = "67c504be6230f763663cf19faf50d9bc46dc6902";
    const concessionHead = "d784262ccc78ae431a72a3934ced45198e4bfb4c";
    for (const path of ["config/master-requirements-audit-evidence.json", "config/requirements-history/master-register-1.0.0.json"]) expect(sourceHash(readFileSync(path,"utf8"))).toBe(sourceHash(at(portableHead,path)));
    expect(sourceHash(readFileSync("config/certificate-graduation-source-delta.json","utf8"))).toBe(sourceHash(at(certificateHead,"config/certificate-graduation-source-delta.json")));
    expect(sourceHash(readFileSync("config/prior-year-concession-source-delta.json","utf8"))).toBe(sourceHash(at(concessionHead,"config/prior-year-concession-source-delta.json")));
    expect(certificateDelta.baseCommit).toBe("104aacc7bd314cae82e60bb02b5c8a965c7ffedd");
    expect(certificateDelta.baseTree).toBe("2c7f1a129e6b98abb9689abf7c989b0ed8468561");
    for (const entry of [...certificateDelta.changed,...certificateDelta.added]) expect(sourceHash(at(certificateHead,entry.path)),entry.path).toBe(entry.currentSha256);
    for (const entry of featureDelta.files) expect(sourceHash(at(concessionHead,entry.path)),entry.path).toBe(entry.sha256);
  }, 120000);
  it("requires a dated complete integration delta and preserves production defaults", () => {
    const result = execFileSync(process.execPath,["scripts/recovery-source-evidence.mjs"],{encoding:"utf8",timeout:240000});
    expect(JSON.parse(result)).toMatchObject({status:"PASS",sourceHeads:4,backupSourceContracts:4});
    const current=JSON.parse(readFileSync("config/release-feature-flags.json","utf8"));
    for(const flag of current){expect(flag.defaultState).toBe(false);expect(flag.rolloutPercentage).toBe(0);}
    const packageNow=JSON.parse(readFileSync("package.json","utf8"));
    expect(packageNow.dependencies).toEqual({...audit.productionDependencies,next:"15.5.25",sharp:"0.35.4"});
    expect(Object.keys(packageNow.dependencies).some(k=>/opentelemetry|sentry|posthog/i.test(k))).toBe(false);
  }, 250000);
  it("preserves every historical migration checksum and adds both original feature migrations",()=>{
    expect(audit.schemaFiles).toEqual(["prisma/schema.prisma","prisma/postgresql/schema.prisma"]);
    for(const old of audit.migrationFiles)expect(sourceHash(readFileSync(old.path,"utf8")),old.path).toBe(old.sha256);
    const added=[...certificateDelta.added.filter(f=>/^prisma\/(postgresql\/)?migrations\/.*\.sql$/.test(f.path)).map(f=>f.path),...featureDelta.files.filter(f=>f.baselineSha256===null&&/^prisma\/(postgresql\/)?migrations\/.*\.sql$/.test(f.path)).map(f=>f.path)];
    expect(added).toHaveLength(4);
    expect([...audit.migrationFiles.map(f=>f.path),...added].sort()).toEqual(git("ls-files","--cached","--others","--exclude-standard","--","prisma").split(/\r?\n/).filter(f=>/^prisma\/(postgresql\/)?migrations\/.*\.sql$/.test(f)).sort());
    expect(debt.screens.map(s=>s.sourceFile).sort()).toEqual(screens.screens.map(s=>s.file).sort());
    expect(debt.screens.every(s=>s.roles.length>0&&Object.keys(s.dimensions).length===19)).toBe(true);
    expect(debt.auditMode).toContain("NO_CURRENT_BROWSER_CERTIFICATION");
  });
  it("preserves the historical generated prompt and records its later explicit source-only start", () => {
    const prompt = readFileSync(register.generatedNextPrompt.path, "utf8");
    expect(prompt).toContain("GENERATED_NOT_EXECUTED");
    expect(prompt).toContain("later explicit owner start");
    const generated = git("ls-files", "--cached", "--others", "--exclude-standard", "--", "docs/prompts").split(/\r?\n/).filter(f => f && !audit.priorPromptFiles.includes(f));
    expect(generated.filter(f => f !== register.generatedNextPrompt.path)).toEqual([]);
    expect(historical.generatedNextPrompt.state).toBe("GENERATED_NOT_EXECUTED");
    expect(register.generatedNextPrompt.state).toBe("STARTED_SOURCE_ONLY");
    expect(register.operationalActivationState).toBe("NOT_AUTHORISED_ALL_EXISTING_FLAGS_UNCHANGED");
    const enabled = copy(); enabled.generatedNextPrompt.state = "EXECUTED"; expect(validateMasterRequirements(enabled).length).toBeGreaterThan(0);
  });
});
