import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import schema from "@/config/master-requirements-register.schema.json";
import canonical from "@/config/master-requirements-register.json";
import { PERMISSIONS } from "@/lib/permissions";

export type MasterRegister = Omit<typeof canonical, "approvedAt"> & { approvedAt: string | null };
export const MASTER_BASE = "4a4df050d194104cfc497a6de790ca9553a69db6";
export const MASTER_TREE = "d4075661063fc127740bb3806abe51d83b406e61";
export const OWNER_SPECIFICATION_HASH = "618824d76329b924230fede309b30df1d7aa7a94fa52c4b4a849647432421c89";
const validateSchema = new Ajv2020({ allErrors: true, strict: true }).compile<MasterRegister>(schema);
export const sourceHash = (value: string) => createHash("sha256").update(value.replace(/\r\n/g, "\n")).digest("hex");

export function publicContentErrors(value: unknown): string[] {
  const errors: string[] = [];
  const texts: string[] = [];
  const seen = new Set<object>();
  const visit = (item: unknown) => {
    if (typeof item === "string") { texts.push(item.normalize("NFKC")); return; }
    if (!item || typeof item !== "object" || seen.has(item)) return;
    seen.add(item);
    for (const [key, child] of Object.entries(item)) {
      texts.push(key.normalize("NFKC"));
      if (/^(?:studentName|guardianName|staffName|approverName|aadhaarNo|phoneNumber)$/i.test(key) && typeof child === "string" && child.trim()) errors.push("PRIVATE_RECORD_VALUE");
      visit(child);
    }
  };
  visit(value);
  const checks: Array<[string, RegExp]> = [
    ["PRIVATE_KEY", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ["CREDENTIAL", /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AKIA[A-Z0-9]{16})\b/],
    ["PRIVATE_CONTACT", /(?:\+91[\s().-]*[6-9](?:[\s().-]*\d){9}\b|\b[6-9](?:[ .()-]?\d){9}\b|\b\d{4}[ -]?\d{4}[ -]?\d{4}\b)/],
    ["PRIVATE_PATH", /(?:[A-Za-z]:[\\/](?:Users|users|home)[\\/]|(?:^|[\s"'(])\/(?:home|Users)\/[^/\s]+)/],
    ["NAMED_INDIVIDUAL", /\b(?:Mr|Mrs|Ms|Dr)\.\s+[A-Z][a-z]+\s+[A-Z][a-z]+/],
    ["PRIVATE_RECORD_VALUE", /(?:studentName|guardianName|staffName|approverName|aadhaarNo|phoneNumber)\s*["']?\s*[:=]\s*["'][^"']+/i]
  ];
  for (const text of texts) {
    for (const [code, regex] of checks) if (regex.test(text)) errors.push(code);
    for (const match of text.matchAll(/\b[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi)) {
      if (!/(?:^example\.com$|\.(?:invalid|test|example|local)$)/i.test(match[1])) errors.push("PRIVATE_EMAIL");
    }
  }
  return [...new Set(errors)];
}

export function requirementSourceHash(register: MasterRegister) {
  return sourceHash(JSON.stringify({ requirements: register.requirements.map(r => r.sourceIntent), settledOwnerDecisions: register.settledOwnerDecisions }));
}

export function validateMasterRequirements(input: unknown, readSource?: (file: string) => string): string[] {
  if (!validateSchema(input)) return (validateSchema.errors ?? []).map(error => `SCHEMA:${error.instancePath}:${error.keyword}`);
  const register = input;
  const errors: string[] = [];
  if (register.actualMainSha !== MASTER_BASE || register.expectedMainSha !== MASTER_BASE || register.treeSha !== MASTER_TREE) errors.push("BASE_COORDINATES_CHANGED");
  if (requirementSourceHash(register) !== OWNER_SPECIFICATION_HASH || register.normalizedSourceSpecificationHash !== OWNER_SPECIFICATION_HASH) errors.push("OWNER_INTENT_DRIFT");
  if ((register.approvalState === "APPROVED") !== (register.approvedAt !== null)) errors.push("APPROVAL_STATE_MISMATCH");
  if (register.approvedAt !== null) {
    const timestamp = Date.parse(register.approvedAt);
    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== register.approvedAt) errors.push("INVALID_APPROVAL_TIMESTAMP");
  }
  const expectedIds = Array.from({ length: 46 }, (_, i) => `NPS-REQ-${String(i + 1).padStart(3, "0")}`);
  if (register.requirements.map(r => r.id).join() !== expectedIds.join()) errors.push("EXACT_ORDERED_ID_SET_REQUIRED");
  const ids = new Set(register.requirements.map(r => r.id));
  const semantic = new Set<string>();
  const gates = new Set(register.externalGateCatalogue.map(g => g.id));
  const permissions = new Set<string>(PERMISSIONS);
  if (gates.size !== register.externalGateCatalogue.length) errors.push("DUPLICATE_GATE");
  const safePath = (p: string) => !path.isAbsolute(p) && !p.includes("\\") && !p.split("/").some(s => s === ".." || s === "." || !s) && !/^[a-z]+:/i.test(p);
  for (const req of register.requirements) {
    const key = req.title.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (semantic.has(key)) errors.push(`DUPLICATE_SEMANTIC_REQUIREMENT:${req.id}`);
    semantic.add(key);
    for (const dep of req.dependencies) if (!ids.has(dep)) errors.push(`UNKNOWN_DEPENDENCY:${req.id}:${dep}`);
    for (const permission of req.permissions) if (!permissions.has(permission)) errors.push(`UNKNOWN_PERMISSION:${req.id}:${permission}`);
    for (const gate of req.externalGates) if (!gates.has(gate)) errors.push(`UNKNOWN_EXTERNAL_GATE:${req.id}:${gate}`);
    if (req.searchEvidence.baseSha !== MASTER_BASE) errors.push(`STALE_SEARCH:${req.id}`);
    if (req.status === "MISSING" && (!req.searchEvidence.historyCommits.length || !req.searchEvidence.neighboringFiles.length)) errors.push(`MISSING_SEARCH_EVIDENCE:${req.id}`);
    if (req.status === "SUPERSEDED" && !/replac|supersed/i.test(req.recommendedAction)) errors.push(`REPLACEMENT_REQUIRED:${req.id}`);
    if (req.status === "DEFERRED" && !/owner|deliberate|later|future/i.test(req.currentReleaseBoundary)) errors.push(`SCOPE_DECISION_REQUIRED:${req.id}`);
    for (const file of [...req.sourceFiles, ...req.tests, ...req.migrations, ...req.services, ...req.qaEvidence, ...req.backupRestoreCoverage.sourceFiles, ...req.searchEvidence.neighboringFiles]) {
      if (!safePath(file)) { errors.push(`UNSAFE_EVIDENCE_PATH:${req.id}`); continue; }
      if (readSource) { try { readSource(file); } catch { errors.push(`EVIDENCE_NOT_FOUND:${req.id}:${file}`); } }
    }
    for (const item of req.evidence) {
      if (!safePath(item.path) || !req.sourceFiles.includes(item.path)) { errors.push(`UNLINKED_EVIDENCE:${req.id}`); continue; }
      if (readSource) {
        try {
          const source = readSource(item.path);
          if (sourceHash(source) !== item.sha256 || item.line > source.split("\n").length) errors.push(`EVIDENCE_DRIFT:${req.id}:${item.path}`);
        } catch { errors.push(`EVIDENCE_NOT_FOUND:${req.id}:${item.path}`); }
      }
    }
  }
  const visiting = new Set<string>(), visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) { errors.push(`DEPENDENCY_CYCLE:${id}`); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dep of register.requirements.find(r => r.id === id)?.dependencies ?? []) visit(dep);
    visiting.delete(id); visited.add(id);
  };
  for (const id of ids) visit(id);
  for (const [status, count] of Object.entries(register.statusCounts)) {
    if (register.requirements.filter(r => r.status === status).length !== count) errors.push(`STATUS_COUNT_MISMATCH:${status}`);
  }
  errors.push(...publicContentErrors(register));
  return [...new Set(errors)];
}

export function repositorySourceReader(root = process.cwd()) {
  const canonicalRoot = realpathSync(root);
  const cache = new Map<string, string>();
  return (file: string) => {
    if (cache.has(file)) return cache.get(file)!;
    const resolved = realpathSync(path.resolve(canonicalRoot, file));
    const relative = path.relative(canonicalRoot, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("EVIDENCE_ESCAPES_REPOSITORY");
    const text = readFileSync(resolved, "utf8"); cache.set(file, text); return text;
  };
}
