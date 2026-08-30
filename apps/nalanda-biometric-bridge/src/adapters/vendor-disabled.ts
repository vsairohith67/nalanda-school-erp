import type { DeviceAdapter, ConfiguredDevice } from "./adapter.js";
import type { NormalizedEvent, Profile } from "../contracts.js";
export class VendorProtocolDisabledAdapter implements DeviceAdapter { readonly officialProtocolRequired = true; constructor(readonly profile: Profile) {} async poll(_device: ConfiguredDevice): Promise<NormalizedEvent[]> { throw new Error(`VENDOR_PROTOCOL_NOT_VERIFIED:${this.profile}`); } }
