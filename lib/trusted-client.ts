export const TRUSTED_PROXY_MODE = "authenticated-edge-v1" as const;
export const TRUSTED_PROXY_PROOF_HEADER = "x-nalanda-proxy-auth" as const;

export type TrustedClientIdentity = {
  source: string;
  trusted: boolean;
  boundaryMismatch: boolean;
  reason:
    | "trusted-edge"
    | "proxy-disabled"
    | "proxy-config-invalid"
    | "proxy-proof-invalid"
    | "client-ip-invalid"
    | "forwarded-origin-invalid";
};

type HeaderReader = Pick<Headers, "get">;
type Environment = Record<string, string | undefined>;

export function trustedClientIdentity(
  headers: HeaderReader,
  environment: Environment = process.env
): TrustedClientIdentity {
  if (environment.TRUST_PROXY_HEADERS !== "true") {
    return direct("proxy-disabled", false);
  }
  const secret = environment.NALANDA_PROXY_SHARED_SECRET?.trim() ?? "";
  if (environment.NALANDA_TRUSTED_PROXY_MODE !== TRUSTED_PROXY_MODE || secret.length < 32) {
    return direct("proxy-config-invalid", true);
  }
  const proof = headers.get(TRUSTED_PROXY_PROOF_HEADER)?.trim() ?? "";
  if (!constantTimeEqual(proof, secret)) return direct("proxy-proof-invalid", true);

  const configuredHeader = (environment.NALANDA_CLIENT_IP_HEADER?.trim().toLowerCase() || "x-forwarded-for");
  if (!["x-forwarded-for", "x-real-ip", "cf-connecting-ip"].includes(configuredHeader)) {
    return direct("proxy-config-invalid", true);
  }
  const forwarded = headers.get(configuredHeader)?.trim() ?? "";
  if (!validSingleIp(forwarded)) return direct("client-ip-invalid", true);

  const expectedOrigin = parseOrigin(environment.APP_ORIGIN);
  const forwardedProto = headers.get("x-forwarded-proto")?.trim().toLowerCase() ?? "";
  const forwardedHost = headers.get("x-forwarded-host")?.trim().toLowerCase() ?? "";
  if (
    !expectedOrigin ||
    forwardedProto !== expectedOrigin.protocol.slice(0, -1) ||
    forwardedHost !== expectedOrigin.host.toLowerCase() ||
    forwardedHost.includes(",")
  ) {
    return direct("forwarded-origin-invalid", true);
  }
  return { source: forwarded.toLowerCase(), trusted: true, boundaryMismatch: false, reason: "trusted-edge" };
}

export function trustedProxyRequest(headers: HeaderReader, environment: Environment = process.env) {
  return trustedClientIdentity(headers, environment).trusted;
}

export function trustedProxyRequired(environment: Environment = process.env) {
  return environment.NALANDA_REQUIRE_TRUSTED_PROXY === "true";
}

function direct(reason: TrustedClientIdentity["reason"], boundaryMismatch: boolean): TrustedClientIdentity {
  return { source: "direct", trusted: false, boundaryMismatch, reason };
}

function parseOrigin(value?: string) {
  try {
    const parsed = new URL(value ?? "");
    return ["http:", "https:"].includes(parsed.protocol) ? parsed : null;
  } catch {
    return null;
  }
}

function constantTimeEqual(actual: string, expected: string) {
  if (!actual || actual.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < actual.length; index += 1) {
    mismatch |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return mismatch === 0;
}

function validSingleIp(value: string) {
  if (!value || value.length > 64 || /[\s,%\[\]]/.test(value)) return false;
  return validIpv4(value) || validIpv6(value);
}

function validIpv4(value: string) {
  const parts = value.split(".");
  return parts.length === 4 && parts.every((part) => /^(?:0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255);
}

function validIpv6(value: string) {
  if (!/^[0-9a-f:.]+$/i.test(value) || !value.includes(":")) return false;
  if ((value.match(/::/g) ?? []).length > 1) return false;
  const halves = value.split("::");
  if (halves.length > 2) return false;
  const groups = halves.flatMap((half) => half ? half.split(":") : []);
  let groupCount = 0;
  for (const group of groups) {
    if (group.includes(".")) {
      if (!validIpv4(group)) return false;
      groupCount += 2;
    } else {
      if (!/^[0-9a-f]{1,4}$/i.test(group)) return false;
      groupCount += 1;
    }
  }
  return value.includes("::") ? groupCount < 8 : groupCount === 8;
}
