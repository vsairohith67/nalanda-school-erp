import { Writable } from "node:stream";
import { createInterface } from "node:readline/promises";
import { loadEnvFile, stdin, stdout } from "node:process";
import {
  assertSuperAdminRecoverySafetyFiles,
  executeSuperAdminRecovery,
  resolveSuperAdminRecoveryConfig,
  safeSuperAdminRecoveryFailure,
  SUPER_ADMIN_RECOVERY_CONFIRMATION,
  SuperAdminRecoveryRefusal
} from "@/lib/super-admin-recovery";

loadEnvFile();

class HiddenPromptOutput extends Writable {
  muted = false;

  _write(
    chunk: Buffer | string,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ) {
    if (!this.muted) stdout.write(chunk, encoding);
    callback();
  }
}

async function main() {
  if (process.argv.slice(2).length !== 0) {
    throw new SuperAdminRecoveryRefusal("AUTH_RECOVERY_COMMAND_ARGUMENTS_REFUSED");
  }
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new SuperAdminRecoveryRefusal("AUTH_RECOVERY_INTERACTIVE_TTY_REQUIRED");
  }

  const config = resolveSuperAdminRecoveryConfig(process.env, process.cwd());
  assertSuperAdminRecoverySafetyFiles(config);
  const hiddenOutput = new HiddenPromptOutput();
  const prompt = createInterface({
    input: stdin,
    output: hiddenOutput,
    terminal: true
  });

  async function visibleQuestion(label: string) {
    hiddenOutput.muted = false;
    return prompt.question(label);
  }

  async function hiddenQuestion(label: string) {
    stdout.write(label);
    hiddenOutput.muted = true;
    try {
      return await prompt.question("");
    } finally {
      hiddenOutput.muted = false;
      stdout.write("\n");
    }
  }

  try {
    const identifier = await visibleQuestion("Super Admin login identifier: ");
    const newPassword = await hiddenQuestion("New password (hidden): ");
    const confirmPassword = await hiddenQuestion("Confirm new password (hidden): ");
    stdout.write(`Type exactly: ${SUPER_ADMIN_RECOVERY_CONFIRMATION}\n`);
    const confirmationPhrase = await visibleQuestion("Recovery confirmation: ");
    const result = await executeSuperAdminRecovery({
      environment: process.env,
      workspaceRoot: process.cwd(),
      identifier,
      newPassword,
      confirmPassword,
      confirmationPhrase
    });
    stdout.write(`${result.status}\n`);
  } finally {
    prompt.close();
  }
}

main().catch((error) => {
  stdout.write(`${safeSuperAdminRecoveryFailure(error)}\n`);
  process.exitCode = 1;
});
