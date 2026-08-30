import type { BridgeConfig, NormalizedEvent, Profile } from "../contracts.js";
export type ConfiguredDevice = BridgeConfig["devices"][number];
export interface DeviceAdapter {
  readonly profile: Profile;
  readonly officialProtocolRequired: boolean;
  poll(device: ConfiguredDevice): Promise<NormalizedEvent[]>;
  acknowledgePoll?(device: ConfiguredDevice, events: NormalizedEvent[]): Promise<void>;
}
