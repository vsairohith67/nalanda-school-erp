export function normalizeBridgeJwk(value: unknown) {
  const source = typeof value === "string" ? JSON.parse(value) : value;
  if (!source || typeof source !== "object" || Array.isArray(source)) throw new Error("BIOMETRIC_BRIDGE_PUBLIC_KEY_INVALID");
  const jwk = source as JsonWebKey;
  if (jwk.kty === "OKP" && jwk.crv === "Ed25519" && jwk.x && !jwk.d) return { algorithm: "ED25519", jwk: { kty: "OKP", crv: "Ed25519", x: jwk.x, ext: true, key_ops: ["verify"] } as JsonWebKey };
  if (jwk.kty === "EC" && jwk.crv === "P-256" && jwk.x && jwk.y && !jwk.d) return { algorithm: "ECDSA_P256_SHA256", jwk: { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y, ext: true, key_ops: ["verify"] } as JsonWebKey };
  throw new Error("BIOMETRIC_BRIDGE_PUBLIC_KEY_INVALID");
}
