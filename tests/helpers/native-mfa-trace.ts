// Test-only await/transaction observations. No SQL, arguments, result rows,
// credentials or error messages are inspected. Services are delegated intact.
import { AsyncLocalStorage } from "node:async_hooks";
import { ServiceTrace, type Phase } from "./service-trace";

type Scope = { trace: ServiceTrace; parent: number; attempt: number };
const scope = new AsyncLocalStorage<Scope>();
export function mfaPhase<T>(phase: Phase, action: () => Promise<T>, attempt?: number): Promise<T> {
  const current = scope.getStore();
  if (!current) return action();
  const number = attempt ?? current.attempt, span = current.trace.begin(phase, number);
  current.trace.emit("LINK", phase, span, number, null, { parentSpan: current.parent });
  return scope.run({ ...current, parent: span, attempt: number }, async () => {
    try { const result = await action(); current.trace.end(span, false, number); return result; }
    catch (error) { current.trace.end(span, true, number); throw error; }
  });
}
export function observeMfaClient<T extends object>(client: T): T {
  return new Proxy(client, { get(target: any, key) {
    if (key === "$transaction") return (...args: any[]) => {
      if (!scope.getStore()) return target.$transaction(...args);
      return mfaPhase("transaction_wait", () => {
        const fn = args[0];
        const forwarded = typeof fn === "function" ? [(tx: any) => mfaPhase("transaction_action", () => fn(tx)), ...args.slice(1)] : args;
        return target.$transaction(...forwarded);
      });
    };
    const value = Reflect.get(target, key); return typeof value === "function" ? value.bind(target) : value;
  } });
}
export class MfaJourneyObservation {
  private pending = new Set<Promise<unknown>>();
  constructor(readonly trace: ServiceTrace) {}
  run<T>(parent: number, action: () => Promise<T>): Promise<T> {
    const work = scope.run({ trace: this.trace, parent, attempt: 0 }, () => mfaPhase("mfa_journey", action));
    this.pending.add(work);
    // Observe both settlements without replacing the original return/rejection.
    void work.then(() => this.pending.delete(work), () => this.pending.delete(work));
    return work;
  }
  get pendingCount() { return this.pending.size; }
  async drain(budgetMs = 5000): Promise<boolean> {
    if (!Number.isInteger(budgetMs) || budgetMs < 1 || budgetMs > 5000) throw Error("MFA_TRACE_DRAIN_BOUND_INVALID");
    const span = this.trace.begin("cleanup_wait");
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // A deadline, not a delay/retry or new action budget. Vitest's unchanged
      // 10s afterAll hook still bounds this plus actual cleanup.
      const settled = await Promise.race([
        Promise.allSettled([...this.pending]).then(() => true),
        new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), budgetMs); })
      ]);
      this.trace.end(span, !settled);
      return settled;
    } finally { if (timer) clearTimeout(timer); }
  }
}
