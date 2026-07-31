import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { demoUserSeedDecision } from "@/lib/demo-user-seed-safety";
import type { AuthAliasType, RecoveryChannelType } from "@/lib/auth-identifiers";

export type AuthDelivery =
  | { kind: "ALIAS_VERIFICATION"; aliasType: AuthAliasType; destination: string; destinationMasked: string; code: string }
  | { kind: "PASSWORD_RESET"; channelType: RecoveryChannelType; destination: string; destinationMasked: string; resetPath: string };

export interface AuthDeliveryAdapter {
  readonly kind: "DISABLED" | "LOCAL_TEST_SINK";
  readonly available: boolean;
  deliver(message: AuthDelivery): Promise<void>;
}

const disabledAdapter: AuthDeliveryAdapter = {
  kind: "DISABLED",
  available: false,
  async deliver() { throw new Error("AUTH_DELIVERY_NOT_CONFIGURED"); }
};

export function configuredAuthDeliveryAdapter(environment: NodeJS.ProcessEnv = process.env): AuthDeliveryAdapter {
  if (environment.AUTH2B_DELIVERY_ADAPTER?.trim() !== "LOCAL_TEST_SINK") return disabledAdapter;
  const root = environment.AUTH2B_COPIED_DATABASE_ROOT?.trim();
  const mailbox = environment.AUTH2B_LOCAL_DELIVERY_MAILBOX?.trim();
  if (!root || !mailbox || !path.isAbsolute(root) || !path.isAbsolute(mailbox)) {
    throw new Error("AUTH2B_LOCAL_TEST_SINK_PATHS_REQUIRED");
  }
  const decision = demoUserSeedDecision({
    ...environment,
    ALLOW_DEMO_USERS: "true",
    DEMO_USER_DATABASE_ROOT: root
  });
  if (!decision.enabled) throw new Error("AUTH2B_LOCAL_TEST_SINK_ISOLATION_REQUIRED");
  const resolvedMailbox = path.resolve(mailbox);
  const relative = path.relative(decision.isolatedRoot, resolvedMailbox);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("AUTH2B_LOCAL_TEST_SINK_OUTSIDE_ISOLATED_ROOT");
  }
  if (!/\.json$/i.test(resolvedMailbox)) throw new Error("AUTH2B_LOCAL_TEST_SINK_EXTENSION_INVALID");
  return {
    kind: "LOCAL_TEST_SINK",
    available: true,
    async deliver(message) {
      const directory = path.dirname(resolvedMailbox);
      if (!existsSync(directory)) mkdirSync(directory, { recursive: true });
      const payload = message.kind === "ALIAS_VERIFICATION"
        ? { kind: message.kind, aliasType: message.aliasType, destinationMasked: message.destinationMasked, code: message.code }
        : { kind: message.kind, channelType: message.channelType, destinationMasked: message.destinationMasked, resetPath: message.resetPath };
      // This ignored, isolated mailbox is the destination in copied-database QA.
      // Raw codes/tokens never enter application logs, analytics or audits.
      writeFileSync(resolvedMailbox, JSON.stringify(payload), { encoding: "utf8", mode: 0o600 });
    }
  };
}

export function mobileRecoveryConfigured(environment: NodeJS.ProcessEnv = process.env) {
  return environment.AUTH2B_DELIVERY_ADAPTER?.trim() === "LOCAL_TEST_SINK";
}
