import { emitSecurityResilienceEvent } from "@/lib/security-observability";

export type GuardedOperation = "UNIVERSAL_SEARCH" | "SMART_AI" | "EVENT_MEDIA_IMAGE" | "REPORT_PDF";

export class ResourceGuardError extends Error {
  constructor(
    public readonly code: "CAPACITY_EXHAUSTED" | "QUEUE_WAIT_TIMEOUT" | "OPERATION_TIMEOUT" | "CIRCUIT_OPEN",
    public readonly status: 503 | 429 = 503,
    public readonly retryAfterSeconds = 5
  ) {
    super("The service is busy. Please retry shortly.");
  }
}

type Waiter = { resolve: (release: () => void) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };

export class BoundedSemaphore {
  private active = 0;
  private readonly queue: Waiter[] = [];

  constructor(
    readonly maximumActive: number,
    readonly maximumQueue: number,
    readonly maximumWaitMs: number
  ) {
    if (![maximumActive, maximumQueue, maximumWaitMs].every(Number.isSafeInteger) || maximumActive < 1 || maximumQueue < 0 || maximumWaitMs < 1) {
      throw new Error("Invalid bounded semaphore configuration.");
    }
  }

  async acquire() {
    if (this.active < this.maximumActive) {
      this.active += 1;
      return this.releaseOnce();
    }
    if (this.queue.length >= this.maximumQueue) throw new ResourceGuardError("CAPACITY_EXHAUSTED");
    return new Promise<() => void>((resolve, reject) => {
      const waiter: Waiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          const index = this.queue.indexOf(waiter);
          if (index >= 0) this.queue.splice(index, 1);
          reject(new ResourceGuardError("QUEUE_WAIT_TIMEOUT"));
        }, this.maximumWaitMs)
      };
      this.queue.push(waiter);
    });
  }

  snapshot() { return { active: this.active, queued: this.queue.length }; }

  private releaseOnce() {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = this.queue.shift();
      if (next) {
        clearTimeout(next.timer);
        next.resolve(this.releaseOnce());
        return;
      }
      this.active = Math.max(0, this.active - 1);
    };
  }
}

const guards: Record<GuardedOperation, BoundedSemaphore> = {
  UNIVERSAL_SEARCH: new BoundedSemaphore(4, 8, 250),
  SMART_AI: new BoundedSemaphore(2, 2, 250),
  EVENT_MEDIA_IMAGE: new BoundedSemaphore(2, 4, 250),
  REPORT_PDF: new BoundedSemaphore(2, 8, 250)
};

export async function withOperationCapacity<T>(operation: GuardedOperation, task: () => Promise<T>) {
  let release: (() => void) | undefined;
  try {
    release = await guards[operation].acquire();
    return await task();
  } catch (error) {
    if (error instanceof ResourceGuardError) {
      const state = guards[operation].snapshot();
      emitSecurityResilienceEvent("QUEUE_SATURATION", { operation, active: state.active, queued: state.queued, status: error.status });
    }
    throw error;
  } finally {
    release?.();
  }
}

type CircuitState = { failures: number; openedUntil: number; probeActive: boolean };
const circuits = new Map<string, CircuitState>();

export async function withCircuitBreaker<T>(
  key: string,
  task: () => Promise<T>,
  options: { now?: () => number; failureThreshold?: number; cooldownMs?: number } = {}
) {
  const clock = options.now ?? Date.now;
  const threshold = options.failureThreshold ?? 3;
  const cooldownMs = options.cooldownMs ?? 30_000;
  const state = circuits.get(key) ?? { failures: 0, openedUntil: 0, probeActive: false };
  const now = clock();
  if (state.openedUntil > now || (state.openedUntil > 0 && state.probeActive)) {
    emitSecurityResilienceEvent("CIRCUIT_BREAKER", { operation: key, status: 503, failureCount: state.failures });
    throw new ResourceGuardError("CIRCUIT_OPEN", 503, Math.max(1, Math.ceil((state.openedUntil - now) / 1_000)));
  }
  if (state.openedUntil > 0) state.probeActive = true;
  circuits.set(key, state);
  try {
    const result = await task();
    circuits.set(key, { failures: 0, openedUntil: 0, probeActive: false });
    return result;
  } catch (error) {
    const failures = state.failures + 1;
    circuits.set(key, {
      failures,
      openedUntil: failures >= threshold ? clock() + cooldownMs : 0,
      probeActive: false
    });
    if (failures >= threshold) emitSecurityResilienceEvent("CIRCUIT_BREAKER", { operation: key, status: 503, failureCount: failures });
    throw error;
  }
}

export function resetResourceGuardsForTests() {
  circuits.clear();
}
