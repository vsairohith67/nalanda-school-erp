import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;
const COMMON_PASSWORDS = new Set([
  "password1234",
  "password@123",
  "administrator",
  "qwerty123456",
  "welcome@123",
  "changeme1234",
  "nalanda@123"
]);

export async function hashPassword(password: string) {
  validateNewPassword(password);
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export function validateNewPassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`Password must be no more than ${MAX_PASSWORD_LENGTH} characters`);
  }
  if (COMMON_PASSWORDS.has(password.trim().toLowerCase()) || /^(.)\1{11,}$/.test(password)) {
    throw new Error("Choose a less common password");
  }
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, hashHex] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !hashHex) return false;
  const stored = Buffer.from(hashHex, "hex");
  const derived = (await scrypt(password, salt, stored.length)) as Buffer;
  return stored.length === derived.length && timingSafeEqual(stored, derived);
}
