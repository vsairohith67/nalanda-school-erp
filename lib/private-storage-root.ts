import path from "node:path";

/**
 * Resolve a private-data root and fail closed if static serving or release
 * packaging could expose it. Module-specific symlink checks still run at I/O.
 */
export function validatedPrivateStorageRoot(value: string, label: string) {
  const resolved = path.resolve(value);
  const workspace = path.resolve(process.cwd());
  const forbiddenRoots = [
    path.join(workspace, "public"),
    path.join(workspace, ".next", "static"),
    path.join(workspace, "release-artifacts"),
    path.join(workspace, "artifacts")
  ].map((entry) => path.resolve(entry));
  if (forbiddenRoots.some((entry) => resolved === entry || resolved.startsWith(`${entry}${path.sep}`))) {
    throw new Error(`${label} must not overlap a public or release-artifact directory`);
  }
  return resolved;
}
