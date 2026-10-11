export const ROOT: string;
export function reserveOutput(name: string): Promise<string>;
export function writeReports(dir: string, report: {json:string;csv:string;html:string}): Promise<void>;
export function cleanupOutput(dir: string): Promise<void>;
