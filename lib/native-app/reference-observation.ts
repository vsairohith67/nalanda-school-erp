/** Non-secret response identity. PREPARED is never a claim of delivery/storage. */
export type ReferenceObservation = {
  version: 1; responseId: string; userId: string; sessionId: string;
  deviceId: string; publicDeviceId: string; requestHash: string;
  snapshotHash: string; contentHash: string; populationHash: string; studentCount: number;
};
const keys = ["version", "responseId", "userId", "sessionId", "deviceId", "publicDeviceId", "requestHash", "snapshotHash", "contentHash", "populationHash", "studentCount"];
export function parseReferenceObservation(value: unknown): ReferenceObservation {
  const v = value as ReferenceObservation;
  const fail = () => { throw Error("REFERENCE_OBSERVATION_INVALID"); };
  if (!v || typeof v !== "object" || Array.isArray(v) || JSON.stringify(Object.keys(v).sort()) !== JSON.stringify([...keys].sort())) fail();
  if (v.version !== 1 || !Number.isSafeInteger(v.studentCount) || v.studentCount < 0 || v.studentCount > 800) fail();
  for (const k of ["responseId", "sessionId", "publicDeviceId"] as const) if (typeof v[k] !== "string" || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(v[k])) fail();
  for (const k of ["userId", "deviceId"] as const) if (typeof v[k] !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(v[k])) fail();
  for (const k of ["requestHash", "snapshotHash", "contentHash", "populationHash"] as const) if (typeof v[k] !== "string" || !/^[a-f0-9]{64}$/.test(v[k])) fail();
  return v;
}
/** Stable JSON after wire serialization, not a claim that snapshotVersion is ordered. */
export function referenceJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(referenceJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${referenceJson((value as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(value);
}
