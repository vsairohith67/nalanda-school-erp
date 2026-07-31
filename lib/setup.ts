import { timingSafeEqual } from "node:crypto";
import { hashPassword } from "@/lib/password";
import { optionalText, requireText } from "@/lib/validation";
import { maskAlias, normalizeAliasValue } from "@/lib/auth-identifiers";

type SetupStatusClient = {
  user: {
    count(args: { where: { isActive: boolean; role?: string; OR?: Array<{ role: string }> } }): Promise<number>;
  };
};

type SetupTransactionClient = SetupStatusClient & {
  user: {
    count(args: { where: { isActive: boolean; role?: string; OR?: Array<{ role: string }> } }): Promise<number>;
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
  authLoginAlias: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
  schoolSettings: {
    upsert(args: {
      where: { id: string };
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    }): Promise<unknown>;
  };
};

export type FirstRunSetupInput = {
  directorName: string;
  username: string;
  email: string | null;
  password: string;
  schoolName: string;
  academicYear: string;
  phone: string;
  address: string;
  bootstrapToken: string | null;
};

export async function isFirstRunRequired(client: SetupStatusClient) {
  return (await client.user.count({
    where: {
      isActive: true,
      OR: [{ role: "DIRECTOR" }, { role: "SUPER_ADMIN" }]
    }
  })) === 0;
}

export function validateFirstRunSetup(input: Record<string, unknown>): FirstRunSetupInput {
  const password = String(input.password ?? "");
  if (password.length < 12) throw new Error("Director password must be at least 12 characters");
  const username = requireText(input.username, "Director username").toLowerCase();
  if (!/^[a-z0-9._-]+$/.test(username)) {
    throw new Error("Director username may use letters, numbers, dot, underscore, and hyphen only");
  }

  return {
    directorName: requireText(input.directorName, "Director name"),
    username,
    email: optionalText(input.email)?.toLowerCase() ?? null,
    password,
    schoolName: requireText(input.schoolName, "School name"),
    academicYear: requireText(input.academicYear, "Academic year"),
    phone: requireText(input.phone, "School phone"),
    address: requireText(input.address, "School address"),
    bootstrapToken: optionalText(input.bootstrapToken)
  };
}

export async function createFirstRunSetup(
  client: SetupTransactionClient,
  input: FirstRunSetupInput,
  environment: NodeJS.ProcessEnv = process.env
) {
  assertFirstRunBootstrapAuthorized(input.bootstrapToken, environment);
  if (!(await isFirstRunRequired(client))) {
    throw new Error("Setup already completed. Sign in with an active Director or Super Admin account.");
  }

  const passwordHash = await hashPassword(input.password);
  const user = await client.user.create({
    data: {
      name: input.directorName,
      username: input.username,
      email: input.email,
      passwordHash,
      role: "DIRECTOR",
      isActive: true
    }
  });
  const username = normalizeAliasValue("USERNAME", input.username);
  await client.authLoginAlias.create({
    data: {
      id: `auth2b_username_${(user as { id: string }).id}`,
      userId: (user as { id: string }).id,
      type: "USERNAME",
      normalizedValue: username,
      displayMasked: maskAlias("USERNAME", username),
      status: "VERIFIED",
      isSchoolGoverned: true,
      verifiedAt: new Date()
    }
  });
  await client.schoolSettings.upsert({
    where: { id: "school" },
    update: {
      schoolName: input.schoolName,
      academicYear: input.academicYear,
      phone: input.phone,
      addressLine1: input.address
    },
    create: {
      id: "school",
      schoolName: input.schoolName,
      academicYear: input.academicYear,
      phone: input.phone,
      addressLine1: input.address
    }
  });
}

export function assertFirstRunBootstrapAuthorized(
  suppliedToken: string | null | undefined,
  environment: NodeJS.ProcessEnv = process.env
) {
  if (environment.NODE_ENV !== "production") return;
  const configuredToken = environment.FIRST_RUN_BOOTSTRAP_TOKEN?.trim();
  const supplied = suppliedToken?.trim();
  if (!configuredToken || configuredToken.length < 32 || !supplied) {
    throw new Error("First-run setup authorization failed");
  }
  const configuredBytes = Buffer.from(configuredToken);
  const suppliedBytes = Buffer.from(supplied);
  if (
    configuredBytes.length !== suppliedBytes.length ||
    !timingSafeEqual(configuredBytes, suppliedBytes)
  ) {
    throw new Error("First-run setup authorization failed");
  }
}
