export const CANONICAL_CANVS_BOARD_ID = "1LzTSjaWjpOaHppTtyXqICkMbEgHbT6T-";
export const CANONICAL_CANVS_BOARD_URL = `https://app.canvs.io/gdrive?id=${CANONICAL_CANVS_BOARD_ID}`;
export const CANVS_WHITEBOARD_CONFIG_KEY = "NALANDA_CANVS_WHITEBOARD_URL";

export type SuperAdminWhiteboardDestination =
  | { status: "AVAILABLE"; url: typeof CANONICAL_CANVS_BOARD_URL }
  | { status: "UNAVAILABLE"; url: null };

export function isSuperAdminWhiteboardRole(role: string) {
  return role === "SUPER_ADMIN";
}

export function resolveSuperAdminWhiteboardDestination(
  configuredUrl: string | undefined = process.env[CANVS_WHITEBOARD_CONFIG_KEY]
): SuperAdminWhiteboardDestination {
  const candidate = configuredUrl === undefined ? CANONICAL_CANVS_BOARD_URL : configuredUrl.trim();
  if (!candidate) return { status: "UNAVAILABLE", url: null };

  try {
    const parsed = new URL(candidate);
    const parameters = [...parsed.searchParams.entries()];
    const canonical =
      candidate === CANONICAL_CANVS_BOARD_URL &&
      parsed.protocol === "https:" &&
      parsed.hostname === "app.canvs.io" &&
      parsed.host === "app.canvs.io" &&
      parsed.username === "" &&
      parsed.password === "" &&
      parsed.port === "" &&
      parsed.pathname === "/gdrive" &&
      parsed.hash === "" &&
      parameters.length === 1 &&
      parameters[0]?.[0] === "id" &&
      parameters[0]?.[1] === CANONICAL_CANVS_BOARD_ID &&
      parsed.href === CANONICAL_CANVS_BOARD_URL;

    return canonical
      ? { status: "AVAILABLE", url: CANONICAL_CANVS_BOARD_URL }
      : { status: "UNAVAILABLE", url: null };
  } catch {
    return { status: "UNAVAILABLE", url: null };
  }
}
