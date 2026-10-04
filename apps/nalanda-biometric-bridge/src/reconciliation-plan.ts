export type StaffMetadata = { staffReference: string; deviceUserId: string; displayName: string; revision: string };
export function planMetadataReconciliation(local: StaffMetadata[], remote: StaffMetadata[], input: { remoteAvailable: boolean; localRevision: string; remoteRevision: string; now: string; expiresAt: string }) {
  if (!input.remoteAvailable) return { status: "UNAVAILABLE", actions: [] } as const;
  const now = Date.parse(input.now), expiry = Date.parse(input.expiresAt);
  if (!input.localRevision || !input.remoteRevision || !Number.isFinite(now) || !Number.isFinite(expiry) || expiry <= now || expiry - now > 86_400_000) throw new Error("METADATA_PLAN_EXPIRED_OR_UNVERSIONED");
  for (const rows of [local, remote]) for (const row of rows) {
    if (Object.keys(row).some(key => !["staffReference", "deviceUserId", "displayName", "revision"].includes(key)) || Object.values(row).some(v => typeof v !== "string" || v.length < 1 || v.length > 200)) throw new Error("METADATA_PRIVACY_OR_SHAPE_INVALID");
  }
  for (const rows of [local, remote]) if (new Set(rows.map(r => r.staffReference)).size !== rows.length || new Set(rows.map(r => r.deviceUserId)).size !== rows.length) throw new Error("METADATA_MAPPING_CONFLICT");
  const actions = [...new Set([...local, ...remote].map(r => r.staffReference))].map(id => {
    const l = local.find(r => r.staffReference === id), r = remote.find(r => r.staffReference === id);
    return { staffReference: id, local: l ?? null, remote: r ?? null, proposal: !l || !r || l.deviceUserId !== r.deviceUserId ? "REVIEW_MAPPING" : l.displayName !== r.displayName ? "REVIEW_NAME_CONFLICT" : "NO_CHANGE" };
  });
  return { status: "SIMULATOR_PLAN_ONLY", expiresAt: input.expiresAt, localRevision: input.localRevision, remoteRevision: input.remoteRevision, executable: false, actions };
}
