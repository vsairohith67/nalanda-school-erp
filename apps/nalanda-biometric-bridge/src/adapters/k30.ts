import type { ConfiguredDevice, DeviceAdapter } from "./adapter.js";
import type { NormalizedEvent } from "../contracts.js";

/** No SDK calls are guessed. This boundary gains retrieval only after exact SDK admission. */
export class K30UnavailableAdapter implements DeviceAdapter {
  readonly profile = "ESSL_ZK_LAN_SDK" as const;
  readonly officialProtocolRequired = true;
  readonly capability = { attendanceRead: "UNAVAILABLE", metadataWrite: "NOT_IMPLEMENTED", fingerprintMirroring: "NOT_IMPLEMENTED" } as const;
  async poll(_device: ConfiguredDevice): Promise<NormalizedEvent[]> { throw new Error("K30_ADAPTER_UNAVAILABLE:OFFICIAL_SDK_CONTRACT_REQUIRED"); }
}
