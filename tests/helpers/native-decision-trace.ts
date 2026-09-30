import { AsyncLocalStorage } from "node:async_hooks";
import { ServiceTrace, type OverrideMetadata } from "./service-trace";

type Context = { trace: ServiceTrace; attempt: number };
const invocation = new AsyncLocalStorage<Context>();
// Invoked only by this test file's delegated module wrapper. The actual service
// still resolves cookies, roles, permissions, step-up and target inside its tx.
export async function observeRevocation<T>(trace: ServiceTrace, actual: (...args: any[]) => Promise<T>, client: any, ...args: any[]): Promise<T> {
  return invocation.run({ trace, attempt: 0 }, () => trace.phase("native_call", async () => {
    const observed = new Proxy(client, { get(target, key) {
      if (key === "$transaction") return (fn: any, options: any) => {
        const context = invocation.getStore()!; const attempt = ++context.attempt;
        return target.$transaction((tx: any) => invocation.run({ trace, attempt }, () => trace.phase("native_attempt", () => fn(tx), attempt)), options);
      };
      const value = Reflect.get(target, key); return typeof value === "function" ? value.bind(target) : value;
    } });
    try { const result: any = await actual(observed, ...args); trace.emit("OUTCOME", "native_call", 0, 0, result?.status === "REVOKED" ? "REVOKED" : result?.status === "ALREADY_REVOKED" ? "ALREADY_REVOKED" : "UNKNOWN"); return result; }
    catch (error) { trace.emit("OUTCOME", "native_call", 0, 0, "REJECTED"); throw error; }
  }));
}
export async function observeDecision(actual: (...args: any[]) => Promise<any>, client: any, input: any) {
  const context = invocation.getStore(); if (!context) return actual(client, input);
  const { trace, attempt } = context; let rows: OverrideMetadata[] = [], actorRole: string | null = null;
  trace.emit("DECISION_INPUT", "evaluator", 0, attempt, null, { actor: trace.label(input.userId), session: trace.label(input.sessionId), role: trace.label(input.roleAssignmentId), cutoffMs: input.now.getTime(), attempt });
  const observed = new Proxy(client, { get(target, key) {
    if (key === "userPermissionOverride") return new Proxy(target.userPermissionOverride, { get(delegate, operation) {
      if (operation === "findMany") return async (args: any) => {
        // Observe exactly the rows from the evaluator's existing filtered query.
        // No additional query, post-hoc read, clock replacement or wait.
        const result = await delegate.findMany(args); rows = result.map((r: any) => trace.override(r)); trace.emit("RETURNED_ROWS", "evaluator", 0, attempt, null, { rows }); return result;
      };
      const value = Reflect.get(delegate, operation); return typeof value === "function" ? value.bind(delegate) : value;
    } });
    if (key === "userRoleAssignment") return new Proxy(target.userRoleAssignment, { get(delegate, operation) {
      if (operation === "findFirst") return async (args: any) => { const result = await delegate.findFirst(args); actorRole = result?.role ?? null; return result; };
      const value = Reflect.get(delegate, operation); return typeof value === "function" ? value.bind(delegate) : value;
    } });
    const value = Reflect.get(target, key); return typeof value === "function" ? value.bind(target) : value;
  } });
  return trace.phase("evaluator", async () => {
    const result = await actual(observed, input);
    trace.emit("DECISION", "evaluator", 0, attempt, null, { actor: trace.label(input.userId), session: trace.label(input.sessionId), role: trace.label(input.roleAssignmentId), actorRole, cutoffMs: input.now.getTime(), attempt, rows, allowed: result.allowed, source: result.source });
    return result;
  }, attempt);
}
