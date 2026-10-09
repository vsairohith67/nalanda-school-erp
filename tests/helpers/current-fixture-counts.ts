import contracts from "../../config/recovery-source-contracts.json";

/** Keep deliberately edited unit-test rows and their declared counts consistent.
 * Does not adapt versions, add collections, or repair any contract identity.
 * Raw malformed-envelope tests must call the production parser directly.
 */
export function withCurrentFixtureCounts<T>(input: T): T {
  const root = input as Record<string, any>;
  if (!root || typeof root !== "object" || root.metadata?.backupVersion !== 48 ||
      root.metadata.schemaContract !== contracts.sources["48"].discriminator ||
      JSON.stringify(Object.keys(root.metadata.counts ?? {}).sort()) !== JSON.stringify(contracts.sources["48"].countKeys)) {
    throw new Error("CURRENT_UNIT_FIXTURE_REQUIRED");
  }
  const fixture = structuredClone(root);
  for (const key of contracts.sources["48"].arrayCollections) {
    if (Array.isArray(fixture[key])) fixture.metadata.counts[key] = fixture[key].length;
  }
  return fixture as T;
}
