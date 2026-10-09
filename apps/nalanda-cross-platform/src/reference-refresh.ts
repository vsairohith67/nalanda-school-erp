import { parseReferenceObservation, referenceJson, type ReferenceObservation } from "../../../lib/native-app/reference-observation";
import type { ReferencePack } from "./offline-adapter";

export type ReferenceBinding = { userId: string; sessionId: string; deviceId: string; publicDeviceId: string; profile: string };
export type StoredReference = { format: 1; binding: ReferenceBinding; operationId: string; pack: ReferencePack; observation: ReferenceObservation };
export type RefreshState = { operationId: string; source: "MANUAL" | "AUTOMATIC" | "SYNC"; stage: "REQUESTING" | "VALIDATED" | "STORED" | "FAILED" | "CANCELLED"; observation?: ReferenceObservation; profile?: string };
export const referenceHash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), b => b.toString(16).padStart(2, "0")).join("");
export async function validateReferenceResponse(body: string, binding: ReferenceBinding, requestHash: string): Promise<{ pack: ReferencePack; observation: ReferenceObservation }> {
  if (new TextEncoder().encode(body).length > 1_000_000) throw Error("REFERENCE_RESPONSE_BOUND");
  let raw: any; try { raw = JSON.parse(body); } catch { throw Error("REFERENCE_RESPONSE_INVALID"); }
  const { observation: metadata, ...pack } = raw ?? {};
  const observation = parseReferenceObservation(metadata);
  for (const k of ["userId", "sessionId", "deviceId", "publicDeviceId"] as const) if (observation[k] !== binding[k]) throw Error("REFERENCE_RESPONSE_BINDING");
  if (observation.requestHash !== requestHash) throw Error("REFERENCE_REQUEST_MISMATCH");
  if (pack.schemaVersion !== 1 || pack.mode !== "FULL" || pack.truncated !== false || typeof pack.snapshotVersion !== "string" || !pack.snapshotVersion || typeof pack.cursor !== "string" || !pack.cursor) throw Error("REFERENCE_PACK_INCOMPATIBLE");
  for (const k of ["generatedAt", "softStaleAt", "hardExpiresAt"]) if (typeof pack[k] !== "string" || !Number.isFinite(Date.parse(pack[k]))) throw Error("REFERENCE_PACK_TIME");
  if (Date.parse(pack.hardExpiresAt) <= Date.now() || Date.parse(pack.generatedAt) > Date.parse(pack.softStaleAt) || Date.parse(pack.softStaleAt) > Date.parse(pack.hardExpiresAt)) throw Error("REFERENCE_PACK_EXPIRED");
  for (const k of ["students", "feeStructures", "vendors", "expenseCategories", "expenseDepartments", "miscIncomeItems"]) {
    if (!Array.isArray(pack[k]) || pack[k].length > 5000 || pack[k].some((v: any) => !v || typeof v.id !== "string" || !v.id || typeof v.entityVersion !== "string")) throw Error("REFERENCE_PACK_ROWS");
    if (new Set(pack[k].map((v: any) => v.id)).size !== pack[k].length) throw Error("REFERENCE_PACK_DUPLICATE");
  }
  if (pack.students.length > 800 || pack.students.some((s: any) => typeof s.admissionNo !== "string" || typeof s.name !== "string" || typeof s.academicYear !== "string")) throw Error("REFERENCE_PACK_STUDENTS");
  const text = (v: unknown) => typeof v === "string" && v.length > 0 && v.length <= 500;
  for (const k of ["vendors", "expenseCategories", "expenseDepartments", "miscIncomeItems"]) if (pack[k].some((v: any) => !text(v.code) || !text(v.name))) throw Error("REFERENCE_PACK_FIELDS");
  if (pack.miscIncomeItems.some((v: any) => !text(v.studentLinkPolicy) || !Array.isArray(v.rates) || v.rates.length > 500 || v.rates.some((r: any) => !r || !text(r.id) || !text(r.academicYear) || !text(r.entityVersion) || typeof r.amount !== "string" || !/^\d{1,12}\.\d{2}$/.test(r.amount)))) throw Error("REFERENCE_PACK_RATES");
  const admissions = pack.students.map((s: any) => s.admissionNo).sort();
  if (new Set(admissions).size !== admissions.length || observation.studentCount !== admissions.length || observation.populationHash !== await referenceHash(JSON.stringify(admissions)) || observation.contentHash !== await referenceHash(referenceJson(pack)) || observation.snapshotHash !== await referenceHash(pack.snapshotVersion)) throw Error("REFERENCE_CONTENT_MISMATCH");
  return { pack: pack as ReferencePack, observation };
}
export interface ReferenceCommitStore { commit(value: StoredReference, current: () => void): Promise<void>; read(): Promise<StoredReference | null>; }
/** One controller per mounted vault lifetime. Generation invalidates both automatic
 * and manual work. A queued commit rechecks ownership after encryption and before
 * the atomic native UPSERT. An already dispatched write cannot be rolled back. */
export class ReferenceRefresh {
  private generation = 0;
  private operationId: string | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  cancel() { this.generation++; this.operationId = null; }
  async drain() { await this.queue.catch(() => undefined); }
  assertCurrent(operationId: string) { if (this.operationId !== operationId) throw Error("REFERENCE_REFRESH_CANCELLED"); }
  async run(source: RefreshState["source"], prepare: (current: () => void) => Promise<{ body: string; requestHash: string; binding: ReferenceBinding }>, store: ReferenceCommitStore, observe: (state: RefreshState) => void) {
    const generation = ++this.generation, operationId = crypto.randomUUID();
    this.operationId = operationId;
    const current = () => { if (generation !== this.generation) throw Error("REFERENCE_REFRESH_CANCELLED"); };
    const state = (stage: RefreshState["stage"], value?: StoredReference) => { current(); observe({ operationId, source, stage, ...(value ? { observation: value.observation, profile: value.binding.profile } : {}) }); };
    state("REQUESTING");
    try {
      const input = await prepare(current); current();
      const result = await validateReferenceResponse(input.body, input.binding, input.requestHash); current();
      const stored: StoredReference = { format: 1, binding: input.binding, operationId, ...result };
      state("VALIDATED");
      const commit = this.queue.catch(() => undefined).then(async () => {
        current(); await store.commit(stored, current); current();
        const readback = await store.read(); current();
        if (!readback || referenceJson(readback) !== referenceJson(stored)) throw Error("REFERENCE_STORAGE_READBACK_MISMATCH");
      });
      this.queue = commit; await commit; current(); state("STORED", stored); return stored;
    } catch (error) {
      if (generation !== this.generation) throw Error("REFERENCE_REFRESH_CANCELLED");
      if (generation === this.generation) state("FAILED");
      // Error text never includes the response, credential, or private pack.
      throw error instanceof Error && /^(REFERENCE_[A-Z_]+|NATIVE_[A-Z_]+|FEATURE_DISABLED)$/.test(error.message) ? error : Error("REFERENCE_REFRESH_FAILED");
    }
  }
}
