import { hashPassword } from "@/lib/password";
import { demoUserSeedDecision } from "@/lib/demo-user-seed-safety";
import type { PrismaClient } from "@prisma/client";

export const SEED_USER_DEFINITIONS = [
  { name: "Director", username: "director", email: "director@nalanda.local", role: "DIRECTOR", env: "SEED_DIRECTOR_PASSWORD" },
  { name: "Admin", username: "admin", email: "admin@nalanda.local", role: "ADMIN", env: "SEED_ADMIN_PASSWORD" },
  { name: "Accountant", username: "accountant", email: "accountant@nalanda.local", role: "ACCOUNTANT", env: "SEED_ACCOUNTANT_PASSWORD" },
  { name: "Viewer", username: "viewer", email: "viewer@nalanda.local", role: "VIEWER", env: "SEED_VIEWER_PASSWORD" }
] as const;

export function documentedSeedPasswordForAudit(definition: typeof SEED_USER_DEFINITIONS[number]) {
  return ["Nalanda", definition.name.replace(/[^A-Za-z0-9]/g, ""), "@", "2026"].join("");
}

type SeedClient = Pick<PrismaClient, "user">;

export async function ensureSeedUsers(
  client: SeedClient,
  environment: NodeJS.ProcessEnv = process.env,
  workspaceRoot = process.cwd()
) {
  const decision = demoUserSeedDecision(environment, workspaceRoot);
  if (!decision.enabled) {
    return {
      enabled: false as const,
      createdRoles: [] as string[],
      preservedRoles: [] as string[],
      disabledPreservedRoles: [] as string[]
    };
  }

  const existingRows = new Map<string, { id: string; isActive?: boolean; role?: string }>();
  const missing: typeof SEED_USER_DEFINITIONS[number][] = [];
  for (const definition of SEED_USER_DEFINITIONS) {
    const existing = await client.user.findUnique({ where: { username: definition.username } });
    if (existing) {
      existingRows.set(definition.username, existing);
      continue;
    }
    missing.push(definition);
  }

  if (existingRows.size > 0 && missing.length > 0) {
    throw new Error("DEMO_USERS_PARTIAL_RETAINED_SET_REFUSED");
  }

  const preservedRoles = SEED_USER_DEFINITIONS
    .filter((definition) => existingRows.has(definition.username))
    .map((definition) => existingRows.get(definition.username)?.role ?? definition.role);
  const disabledPreservedRoles = SEED_USER_DEFINITIONS
    .filter((definition) => existingRows.get(definition.username)?.isActive === false)
    .map((definition) => existingRows.get(definition.username)?.role ?? definition.role);
  if (missing.length === 0) {
    return {
      enabled: true as const,
      createdRoles: [] as string[],
      preservedRoles,
      disabledPreservedRoles
    };
  }

  const passwords = new Map<string, string>();
  for (const definition of missing) {
    const configured = environment[definition.env]?.trim();
    if (!configured) throw new Error("DEMO_USER_PASSWORDS_REQUIRED");
    if (configured === documentedSeedPasswordForAudit(definition)) {
      throw new Error("DOCUMENTED_SEED_PASSWORD_REFUSED");
    }
    passwords.set(definition.username, configured);
  }
  if (new Set(passwords.values()).size !== passwords.size) {
    throw new Error("DEMO_USER_PASSWORDS_MUST_BE_UNIQUE");
  }

  const rows = await Promise.all(missing.map(async (definition) => {
    const password = passwords.get(definition.username);
    if (!password) throw new Error("DEMO_USER_PASSWORDS_REQUIRED");
    return {
      name: definition.name,
      username: definition.username,
      email: definition.email,
      role: definition.role,
      passwordHash: await hashPassword(password),
      isActive: true
    };
  }));
  const inserted = await client.user.createMany({ data: rows });
  if (inserted.count !== rows.length) {
    throw new Error("DEMO_USER_ATOMIC_CREATE_COUNT_MISMATCH");
  }
  return {
    enabled: true as const,
    createdRoles: missing.map((definition) => definition.role),
    preservedRoles,
    disabledPreservedRoles
  };
}
