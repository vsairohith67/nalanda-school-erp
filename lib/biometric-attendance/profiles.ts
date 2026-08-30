export const BIOMETRIC_PROTOCOL_PROFILES = [
  "ESSL_K30_PRO_PUSH",
  "ESSL_ZK_LAN_SDK",
  "ZK_ADMS_PUSH",
  "GENERIC_ADMS_PUSH",
  "GENERIC_LAN_POLL",
  "GENERIC_CSV_IMPORT",
  "SIMULATOR"
] as const;

export type BiometricProtocolProfile = (typeof BIOMETRIC_PROTOCOL_PROFILES)[number];

export const VENDOR_PROTOCOL_PROFILES = new Set<BiometricProtocolProfile>([
  "ESSL_K30_PRO_PUSH",
  "ESSL_ZK_LAN_SDK",
  "ZK_ADMS_PUSH"
]);

export const GENERIC_CONTRACT_PROFILES = new Set<BiometricProtocolProfile>([
  "GENERIC_ADMS_PUSH",
  "GENERIC_LAN_POLL"
]);

export function biometricProtocolProfile(value: unknown): BiometricProtocolProfile {
  const profile = String(value ?? "").trim().toUpperCase() as BiometricProtocolProfile;
  if (!BIOMETRIC_PROTOCOL_PROFILES.includes(profile)) throw new Error("BIOMETRIC_PROTOCOL_PROFILE_INVALID");
  return profile;
}

export function assertProtocolActivation(profile: BiometricProtocolProfile, proofStatus: string) {
  if (VENDOR_PROTOCOL_PROFILES.has(profile) && proofStatus !== "OFFICIAL_VERIFIED") {
    throw new Error("BIOMETRIC_VENDOR_PROTOCOL_NOT_VERIFIED");
  }
  if (GENERIC_CONTRACT_PROFILES.has(profile) && proofStatus !== "ADAPTER_CONTRACT_APPROVED") {
    throw new Error("BIOMETRIC_GENERIC_ADAPTER_CONTRACT_NOT_APPROVED");
  }
}

export function protocolProfileStatus(profile: BiometricProtocolProfile, proofStatus = "NOT_PROVIDED") {
  return {
    profile,
    adapterFoundation: true,
    ingestionAllowed: VENDOR_PROTOCOL_PROFILES.has(profile) ? proofStatus === "OFFICIAL_VERIFIED" : GENERIC_CONTRACT_PROFILES.has(profile) ? proofStatus === "ADAPTER_CONTRACT_APPROVED" : true,
    vendorDocumentStatus: VENDOR_PROTOCOL_PROFILES.has(profile) ? proofStatus : "NOT_REQUIRED",
    adapterContractStatus: GENERIC_CONTRACT_PROFILES.has(profile) ? proofStatus : "NOT_REQUIRED",
    hardwareCertified: false
  };
}
