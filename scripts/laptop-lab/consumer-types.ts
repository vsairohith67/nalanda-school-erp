import type { ArtifactContext, verifyArtifactEvidence } from '../portable/artifact-handoff';
export type ArtifactReceipt = ReturnType<typeof verifyArtifactEvidence>;
export type Producer = {
  repository: 'vsairohith67/nalanda-school-erp'; source: string; tree: string;
  architecture: 'amd64'; runId: string | null; attempt: string | null;
  provenanceSha256: string | null;
};
export type ConsumerProfile = {
  contract: 'NPS_LAPTOP_CONSUMER_V1'; producer: Producer;
  consumer: { kind: 'LOCAL_LAPTOP'; runId: string; project: string;
    context: 'desktop-linux'; endpoint: 'npipe:////./pipe/dockerDesktopLinuxEngine';
    architecture: 'amd64'; workspace: string; outputName: string; codeSha256:string };
  scope: { scenario: 'read-only' | 'disposable-mutation'; operations: ('certificate_list' | 'certificate_request')[];
    cpu: number; memoryBytes: number; pids: number; phaseTimeoutMs: number; outputLimitBytes: number;
    origin: 'https://portable-staging.localhost:8443' };
};
export type LabAdapter = { classification: 'SIMULATED_SERVICE' | 'AUTHENTICATED_ERP';
  measurement?:'CONTROLLED_TRANSPORT'|'BOUND_HTTP';binding?:{source:string;subjectSha256:string};
  clock: { kind: string; now(): number; iso(): string; sleep(ms: number, signal?: AbortSignal): Promise<void> };
  drive<T>(promise: Promise<T>): Promise<T>;
  transport(input: { operation: string; ordinal: number; signal: AbortSignal }): Promise<unknown>;
  expected(operation: string, ordinal: number): unknown;
  sample(): unknown; owns(): boolean };
export type SourceBinding = { source: string; tree: string; inputs: ArtifactContext['inputs']; baseImages: string[] };
export type OwnedResource = { kind: 'container' | 'network' | 'volume'; id: string; name: string };
export type ConsumerEnvironment = Record<string,string|undefined>;
