import { EncryptedDurableQueue } from "./encrypted-queue.js";
import { simulateScenario, SIMULATOR_SCENARIOS, type SimulatorScenario } from "./adapters/simulator.js";

const command = process.argv[2];
const scenario = (process.argv[3] ?? "normal") as SimulatorScenario;
const deviceId = process.argv[4];
const queueKey = process.env.NALANDA_BIOMETRIC_QUEUE_KEY;
if (command !== "simulate" || !SIMULATOR_SCENARIOS.includes(scenario) || !deviceId) throw new Error("Usage: simulate <scenario> <device-uuid>");
if (!queueKey) throw new Error("NALANDA_BIOMETRIC_QUEUE_KEY_REQUIRED");
const queue = new EncryptedDurableQueue(process.env.NALANDA_BIOMETRIC_QUEUE_PATH ?? "biometric-queue.enc", queueKey);
queue.append(simulateScenario(scenario, deviceId).map((event) => ({ ...event, queuedAt: event.bridgeReceivedTimestamp, localState: "RECEIVED_FROM_DEVICE" as const, attemptCount: 0 })));
process.stdout.write(`${JSON.stringify({ scenario, queued: queue.size(), deterministic: true })}\n`);
