import type { ConfiguredDevice, DeviceAdapter } from "./adapter.js";
import type { NormalizedEvent, Profile } from "../contracts.js";

export class GenericContractPendingAdapter implements DeviceAdapter {
  readonly officialProtocolRequired = false;
  constructor(readonly profile: Profile) {}
  async poll(_device: ConfiguredDevice): Promise<NormalizedEvent[]> {
    throw new Error(`GENERIC_ADAPTER_CONTRACT_NOT_CONFIGURED:${this.profile}`);
  }
}
