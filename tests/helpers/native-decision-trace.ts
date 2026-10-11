import { AsyncLocalStorage } from "node:async_hooks";
import { ServiceTrace, type OverrideMetadata } from "./service-trace";

type Context = { trace: ServiceTrace; attempt: number; callSpan: number; attemptSpan: number };
const invocation = new AsyncLocalStorage<Context>();
// Invoked only by this test file's delegated module wrapper. The actual service
// still resolves cookies, roles, permissions, step-up and target inside its tx.
export async function observeRevocation<T>(trace: ServiceTrace, actual: (...args: any[]) => Promise<T>, client: any, ...args: any[]): Promise<T> {
  const callSpan = trace.begin("native_call");
  return invocation.run({ trace, attempt: 0, callSpan, attemptSpan: 0 }, async () => {
    const observed = new Proxy(client, { get(target, key) {
      if (key === "$transaction") return async (fn: any, options: any) => {
        const context = invocation.getStore()!; const attempt = ++context.attempt;
        const attemptSpan = trace.begin("native_attempt", attempt);
        trace.emit("LINK", "native_attempt", attemptSpan, attempt, null, { parentSpan: callSpan });
        try {
          const result = await target.$transaction((tx: any) => invocation.run({ trace, attempt, callSpan, attemptSpan }, () => fn(tx)), options);
          trace.end(attemptSpan, false, attempt); return result;
        } catch (error) { trace.end(attemptSpan, true, attempt); throw error; }
      };
      const value = Reflect.get(target, key); return typeof value === "function" ? value.bind(target) : value;
    } });
    try { const result: any = await actual(observed, ...args); trace.emit("OUTCOME", "native_call", callSpan, 0, result?.status === "REVOKED" ? "REVOKED" : result?.status === "ALREADY_REVOKED" ? "ALREADY_REVOKED" : "UNKNOWN"); trace.end(callSpan); return result; }
    catch (error) { trace.emit("OUTCOME", "native_call", callSpan, 0, "REJECTED"); trace.end(callSpan, true); throw error; }
  });
}
export async function observeDecision(actual: (...args: any[]) => Promise<any>, client: any, input: any) {
  const context = invocation.getStore(); if (!context) return actual(client, input);
  const { trace, attempt, attemptSpan } = context; let rows: OverrideMetadata[] = [], actorRole: string | null = null;
  const decisionSpan = trace.begin("evaluator", attempt);
  trace.emit("LINK", "evaluator", decisionSpan, attempt, null, { parentSpan: attemptSpan });
  trace.emit("DECISION_INPUT", "evaluator", decisionSpan, attempt, null, { actor: trace.label(input.userId), session: trace.label(input.sessionId), role: trace.label(input.roleAssignmentId), cutoffMs: input.now.getTime(), attempt });
  const observed = new Proxy(client, { get(target, key) {
    if (key === "userPermissionOverride") return new Proxy(target.userPermissionOverride, { get(delegate, operation) {
      if (operation === "findMany") return async (args: any) => {
        // Observe exactly the rows from the evaluator's existing filtered query.
        // No additional query, post-hoc read, clock replacement or wait.
        const result = await delegate.findMany(args); rows = result.map((r: any) => trace.override(r)); trace.emit("RETURNED_ROWS", "evaluator", decisionSpan, attempt, null, { rows }); return result;
      };
      const value = Reflect.get(delegate, operation); return typeof value === "function" ? value.bind(delegate) : value;
    } });
    if (key === "userRoleAssignment") return new Proxy(target.userRoleAssignment, { get(delegate, operation) {
      if (operation === "findFirst") return async (args: any) => { const result = await delegate.findFirst(args); actorRole = result?.role ?? null; return result; };
      const value = Reflect.get(delegate, operation); return typeof value === "function" ? value.bind(delegate) : value;
    } });
    const value = Reflect.get(target, key); return typeof value === "function" ? value.bind(target) : value;
  } });
  try {
    const result = await actual(observed, input);
    trace.emit("DECISION", "evaluator", decisionSpan, attempt, null, { actor: trace.label(input.userId), session: trace.label(input.sessionId), role: trace.label(input.roleAssignmentId), actorRole, cutoffMs: input.now.getTime(), attempt, rows, allowed: result.allowed, source: result.source });
    trace.end(decisionSpan, false, attempt); return result;
  } catch (error) { trace.end(decisionSpan, true, attempt); throw error; }
}
