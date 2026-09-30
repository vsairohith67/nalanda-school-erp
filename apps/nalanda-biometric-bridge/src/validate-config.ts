import { loadBridgeConfig } from "./config.js";
try { const c = loadBridgeConfig(process.argv[2]); console.log(JSON.stringify({ status: "BRIDGE_CONFIG_VALID", pollIntervalMs: c.pollIntervalMs, transportEnabled: c.transportEnabled, syntheticOnly: c.syntheticOnly, configuredDevices: c.devices.length, adapterAvailable: c.devices.every(d => ["SIMULATOR", "GENERIC_CSV_IMPORT"].includes(d.profile)) })); }
catch { console.error("BRIDGE_CONFIG_INVALID"); process.exitCode = 1; }
