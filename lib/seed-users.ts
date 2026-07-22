import { hashPassword } from "@/lib/password";

export const SEED_USER_DEFINITIONS = [
  { name: "Director", username: "director", email: "director@nalanda.local", role: "DIRECTOR", env: "SEED_DIRECTOR_PASSWORD" },
  { name: "Admin", username: "admin", email: "admin@nalanda.local", role: "ADMIN", env: "SEED_ADMIN_PASSWORD" },
  { name: "Accountant", username: "accountant", email: "accountant@nalanda.local", role: "ACCOUNTANT", env: "SEED_ACCOUNTANT_PASSWORD" },
  { name: "Viewer", username: "viewer", email: "viewer@nalanda.local", role: "VIEWER", env: "SEED_VIEWER_PASSWORD" }
] as const;

export function demoTemporaryPassword(definition: typeof SEED_USER_DEFINITIONS[number]) {
  return ["Nalanda", definition.name.replace(/[^A-Za-z0-9]/g, ""), "@", "2026"].join("");
}

type SeedClient = {
  user: {
    findUnique(args: { where: { username: string } }): Promise<{ id: string } | null>;
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
};

export async function ensureSeedUsers(
  client: SeedClient,
  environment: NodeJS.ProcessEnv = process.env,
  warn: (message: string) => void = console.warn
) {
  const created: string[] = [];
  const skipped: string[] = [];
  const missing: typeof SEED_USER_DEFINITIONS[number][] = [];
  for (const definition of SEED_USER_DEFINITIONS) {
    const existing = await client.user.findUnique({ where: { username: definition.username } });
    if (existing) {
      skipped.push(definition.username);
      continue;
    }
    missing.push(definition);
  }

  const demoSeedOptIn =
    environment.NODE_ENV !== "production" &&
    environment.NALANDA_DEMO_SEED_OPT_IN === "true";
  const passwords = new Map<string, string>();
  for (const definition of missing) {
    const configured = environment[definition.env];
    if (configured) {
      passwords.set(definition.username, configured);
      continue;
    }
    if (!demoSeedOptIn) {
      throw new Error(
        `${definition.env} is required for database seeding unless NALANDA_DEMO_SEED_OPT_IN=true`
      );
    }
    passwords.set(definition.username, demoTemporaryPassword(definition));
    warn(`WARNING: Explicit demo-seed opt-in is using a generated non-production default for ${definition.username}.`);
  }

  for (const definition of missing) {
    const password = passwords.get(definition.username);
    if (!password) throw new Error(`${definition.env} is required for database seeding`);
    await client.user.create({
      data: {
        name: definition.name,
        username: definition.username,
        email: definition.email,
        role: definition.role,
        passwordHash: await hashPassword(password),
        isActive: true
      }
    });
    created.push(definition.username);
  }
  return { created, skipped };
}

