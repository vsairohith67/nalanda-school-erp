import type { ConsumerProfile, LabAdapter } from './consumer-types';
export function scheduleFor(scope: ConsumerProfile['scope']): unknown;
export function runConnectedScenario(scope: ConsumerProfile['scope'], adapter: LabAdapter, connection: {
  mode: 'HARNESS_ONLY'|'REAL'; adapter: 'SIMULATED_SERVICE'|'AUTHENTICATED_OPERATION_ADAPTER'; profileSha256: string; producerSource: string;producerTree?:string;
  consumerRunId: string; lifecycle: 'SIMULATED_RUNTIME'|'OWNED_LOCAL_RUNTIME'; processIntegration:'SIMULATED_PROCESS'|'HARMLESS_CHILD_CAPTURED'|'BOUND_DOCKER_PROCESS';
}, signal?: AbortSignal): Promise<{result: {coverageComplete:boolean;stopReason:string;counts:Record<string,number>};json:string;csv:string;html:string}>;
