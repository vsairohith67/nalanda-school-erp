import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

export type OperationsProcessCategory = "NONE" | "STARTUP" | "NONZERO_EXIT" | "TIMEOUT" | "CANCELLED" | "OUTPUT_LIMIT" | "IO" | "UNKNOWN";
export type OperationsProcessEvent = { stage: "spawn" | "first-stdout" | "first-stderr" | "exit" | "close"; pid: number | null };
export type OperationsProcessObservation = {
  exit: number | null;
  signal: NodeJS.Signals | null;
  errorCategory: OperationsProcessCategory;
  closed: boolean;
  settled: "PASS" | "FAIL" | "UNKNOWN";
  durationMs: number;
};
export class OperationsProcessError extends Error {
  constructor(readonly observation: OperationsProcessObservation) {
    super(`OPERATIONS_COMPOSE_PROCESS_${observation.errorCategory}`);
    this.name = "OperationsProcessError";
  }
}
type ProcessOptions = {
  cwd: string;
  // An exact environment, deliberately never merged with the parent's environment.
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  maxBuffer: number;
  signal?: AbortSignal;
  // Actual boundaries only. PID belongs in an owned private capture, never the
  // public process projection; no path/plugin identity is inferred from it.
  onEvent?: (event: OperationsProcessEvent) => void;
};

/** Client-only process runner. A result is released only after close or a bounded
 * settlement failure. Streams stay in memory and never appear in an exception. */
export async function operationsPreparationProcess(executable: string, argv: string[], options: ProcessOptions): Promise<{ stdout: string; observation: OperationsProcessObservation }> {
  const started = performance.now();
  if (options.signal?.aborted) throw new OperationsProcessError({ exit: null, signal: null, errorCategory: "CANCELLED", closed: true, settled: "PASS", durationMs: 0 });
  if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1 || options.timeoutMs > 30000 || !Number.isSafeInteger(options.maxBuffer) || options.maxBuffer < 1 || options.maxBuffer > 1024 * 1024) throw Error("OPERATIONS_PROCESS_BOUNDS_INVALID");
  return new Promise((resolve, reject) => {
    const child = spawn(executable, argv, { cwd: options.cwd, env: options.env, shell: false, windowsHide: true, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
    let category: OperationsProcessCategory = "NONE", closed = false, completed = false;
    let actualExit: number | null = null, actualSignal: NodeJS.Signals | null = null;
    let stdoutSize = 0, stderrSize = 0;
    const stdout: Buffer[] = [];
    let escalation: NodeJS.Timeout | undefined, settlement: NodeJS.Timeout | undefined;
    const finish = () => {
      if (completed) return;
      completed = true;
      clearTimeout(deadline); clearTimeout(escalation); clearTimeout(settlement);
      options.signal?.removeEventListener("abort", abort);
      if (!closed) {
        // Preserve UNKNOWN residue without allowing open pipe handles to keep the
        // parent alive forever after the bounded settlement barrier expires.
        child.stdout.destroy(); child.stderr.destroy(); child.unref();
      }
      // Windows can close the leader while its Compose plugin survives a forced
      // termination. Never turn that observation into a tree-settlement claim.
      let settled: OperationsProcessObservation["settled"] = closed ? "PASS" : "UNKNOWN";
      if (child.pid && category !== "NONE" && category !== "NONZERO_EXIT" && category !== "STARTUP") {
        if (process.platform === "win32") settled = "UNKNOWN";
        else {
          try { process.kill(-child.pid, 0); settled = "UNKNOWN"; }
          catch (error) { settled = (error as NodeJS.ErrnoException).code === "ESRCH" ? "PASS" : "UNKNOWN"; }
        }
      }
      const observation: OperationsProcessObservation = { exit: actualExit, signal: actualSignal, errorCategory: category, closed, settled, durationMs: Math.max(0, performance.now() - started) };
      if (category === "NONE" && actualExit === 0 && settled === "PASS") resolve({ stdout: Buffer.concat(stdout).toString("utf8"), observation });
      else reject(new OperationsProcessError(observation));
    };
    const kill = (signal: NodeJS.Signals) => {
      if (!child.pid) return;
      try {
        if (process.platform === "win32") child.kill(signal);
        else process.kill(-child.pid, signal);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") category = category === "NONE" ? "IO" : category;
      }
    };
    const reconcile = () => {
      if (completed || settlement) return;
      kill("SIGTERM");
      escalation = setTimeout(() => kill("SIGKILL"), 500);
      // This is a cleanup barrier, not additional work time or a test deadline.
      settlement = setTimeout(finish, 2500);
    };
    const terminate = (reason: OperationsProcessCategory) => {
      if (completed) return;
      if (category === "NONE") category = reason;
      reconcile();
    };
    const abort = () => terminate("CANCELLED");
    const deadline = setTimeout(() => terminate("TIMEOUT"), options.timeoutMs);
    const notify = (stage: OperationsProcessEvent["stage"]) => {
      try { options.onEvent?.({ stage, pid: child.pid ?? null }); }
      catch {
        // An actual failed exit precedes this secondary recorder failure. Keep
        // its cause and do not terminate a leader that has already exited.
        if (category === "NONE" && (actualSignal || actualExit !== null && actualExit !== 0)) {
          category = actualSignal ? "UNKNOWN" : "NONZERO_EXIT";
          if (category === "NONZERO_EXIT") return;
        }
        terminate("IO"); // A failed capture never becomes an unhandled event exception.
      }
    };
    let stdoutObserved = false, stderrObserved = false;
    child.once("spawn", () => notify("spawn"));
    child.stdout.on("data", (bytes: Buffer) => {
      if (bytes.length && !stdoutObserved) { stdoutObserved = true; notify("first-stdout"); }
      stdoutSize += bytes.length;
      if (stdoutSize > options.maxBuffer) terminate("OUTPUT_LIMIT");
      else if (category === "NONE") stdout.push(bytes);
    });
    child.stderr.on("data", (bytes: Buffer) => {
      if (bytes.length && !stderrObserved) { stderrObserved = true; notify("first-stderr"); }
      stderrSize += bytes.length;
      if (stderrSize > options.maxBuffer) terminate("OUTPUT_LIMIT");
    });
    child.stdout.on("error", () => terminate("IO"));
    child.stderr.on("error", () => terminate("IO"));
    child.on("error", () => {
      if (!child.pid) category = "STARTUP";
      else terminate("IO");
    });
    child.on("exit", (code, signal) => { actualExit = code; actualSignal = signal; notify("exit"); });
    child.on("close", (code, signal) => {
      closed = true;
      notify("close");
      // Startup failures have no actual exit observation, even when Node supplies
      // an errno-like close code. Keep absent observations explicitly null.
      if (category !== "STARTUP") { actualExit = code; actualSignal = signal; }
      if (category === "NONE" && code !== 0) category = signal ? "UNKNOWN" : "NONZERO_EXIT";
      // A forced POSIX group still needs the escalation/barrier if descendants
      // survived the first signal; Windows failure remains UNKNOWN regardless.
      if (process.platform !== "win32" && child.pid && category !== "NONE" && category !== "STARTUP" && category !== "NONZERO_EXIT") {
        try { process.kill(-child.pid, 0); reconcile(); return; }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") { reconcile(); return; } }
      }
      finish();
    });
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) abort();
  });
}

/** Tracks uncertain process residue independently from a rejected preparation. */
export class OperationsProcessOwner {
  private readonly active = new Set<Promise<unknown>>();
  private uncertain = false;
  get settled() { return this.active.size === 0 && !this.uncertain; }
  async run(executable: string, argv: string[], options: ProcessOptions) {
    const pending = operationsPreparationProcess(executable, argv, options);
    this.active.add(pending);
    try { return await pending; }
    catch (error) {
      if (!(error instanceof OperationsProcessError) || error.observation.settled !== "PASS") this.uncertain = true;
      throw error;
    } finally { this.active.delete(pending); }
  }
}
