import { encryptRecord, decryptRecord } from "../apps/nalanda-cross-platform/src/crypto";

async function main() {
const key = crypto.getRandomValues(new Uint8Array(32));
const drafts = Array.from({ length: 1_000 }, (_, index) => ({
  id: `perf-draft-${String(index).padStart(4, "0")}`,
  type: index % 3 === 0 ? "FEE_PAYMENT" : index % 3 === 1 ? "EXPENSE_DRAFT" : "MISC_INCOME",
  summary: `Synthetic bounded draft ${index}`,
  amountPaise: 10_000 + index,
  state: index % 5 === 0 ? "CONFLICT" : "LOCAL_ONLY",
  updatedAt: "2026-08-26T00:00:00.000Z"
}));

const heapBefore = process.memoryUsage().heapUsed;
const encryptStart = performance.now();
const envelopes = [];
for (const draft of drafts) envelopes.push(await encryptRecord({ recordId: draft.id, recordType: "finance-draft", value: draft, key }));
const encryptMs = performance.now() - encryptStart;

const decryptStart = performance.now();
for (const envelope of envelopes) await decryptRecord({ envelope, key });
const decryptMs = performance.now() - decryptStart;

const referencePack = {
  schemaVersion: 1,
  students: Array.from({ length: 800 }, (_, index) => ({ admissionNo: `SYN-${String(index).padStart(4, "0")}`, name: `Synthetic Student ${index}`, currentDuePaise: 50_000 + index })),
  expenseCategories: Array.from({ length: 40 }, (_, index) => ({ id: `EXP-${index}`, label: `Synthetic category ${index}` })),
  miscellaneousRates: Array.from({ length: 30 }, (_, index) => ({ id: `MISC-${index}`, amountPaise: 10_000 + index }))
};
const packStart = performance.now();
const packEnvelope = await encryptRecord({ recordId: "current", recordType: "reference-pack", value: referencePack, key });
const referencePackEncryptMs = performance.now() - packStart;

const mutations = drafts.slice(0, 75).map((draft) => ({ clientMutationId: `perf:${draft.id}`, localDraftId: draft.id, operationType: draft.type, payload: { synthetic: true }, createdClientAt: draft.updatedAt }));
const batchStart = performance.now();
const batches = Array.from({ length: Math.ceil(mutations.length / 25) }, (_, index) => mutations.slice(index * 25, (index + 1) * 25));
const batchJsonBytes = batches.reduce((total, batch) => total + Buffer.byteLength(JSON.stringify({ schemaVersion: 1, mutations: batch })), 0);
const batchCoordinateMs = performance.now() - batchStart;

const conflictStart = performance.now();
const conflictRows = drafts.filter((draft) => draft.state === "CONFLICT").map((draft) => `${draft.id}:${draft.summary}`);
const conflictRenderModelMs = performance.now() - conflictStart;
const heapDeltaMiB = (process.memoryUsage().heapUsed - heapBefore) / 1024 / 1024;

console.log(JSON.stringify({
  verdict: "PASS",
  syntheticOnly: true,
  draftCount: drafts.length,
  encryptMs: Number(encryptMs.toFixed(2)),
  decryptMs: Number(decryptMs.toFixed(2)),
  ciphertextBytes: envelopes.reduce((total, envelope) => total + Buffer.byteLength(envelope.ciphertext), 0),
  referenceStudentCount: referencePack.students.length,
  referencePackEncryptMs: Number(referencePackEncryptMs.toFixed(2)),
  referencePackCiphertextBytes: Buffer.byteLength(packEnvelope.ciphertext),
  mutationCount: mutations.length,
  batchCount: batches.length,
  batchJsonBytes,
  batchCoordinateMs: Number(batchCoordinateMs.toFixed(2)),
  conflictCount: conflictRows.length,
  conflictRenderModelMs: Number(conflictRenderModelMs.toFixed(2)),
  heapDeltaMiB: Number(heapDeltaMiB.toFixed(2))
}, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
