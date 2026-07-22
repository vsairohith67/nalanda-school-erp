import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../lib/password";
import { SAFE_USER_SELECT } from "../lib/user-management";
import { validateOwnPasswordChange } from "../lib/password-control";

describe("password control", () => {
  it("requires the correct current password for an own-password change", async () => {
    const storedHash = await hashPassword("OldPass@2026");
    await expect(validateOwnPasswordChange({
      currentPassword: "WrongPass@2026",
      storedHash,
      newPassword: "NewPass@2026",
      confirmPassword: "NewPass@2026"
    })).rejects.toThrow("Current password is incorrect");

    await expect(validateOwnPasswordChange({
      currentPassword: "OldPass@2026",
      storedHash,
      newPassword: "NewPass@2026",
      confirmPassword: "NewPass@2026"
    })).resolves.toBeUndefined();
  });

  it("changes the password hash and excludes passwordHash from safe user responses", async () => {
    const oldHash = await hashPassword("OldPass@2026");
    const newHash = await hashPassword("TempPass@2026");
    expect(newHash).not.toBe(oldHash);
    expect(await verifyPassword("TempPass@2026", newHash)).toBe(true);
    expect(SAFE_USER_SELECT).not.toHaveProperty("passwordHash");
  });

  it("rejects short, excessive, common, and repeated new passwords", async () => {
    await expect(hashPassword("Short@2026")).rejects.toThrow("at least 12");
    await expect(hashPassword("x".repeat(129))).rejects.toThrow("no more than 128");
    await expect(hashPassword("Password@123")).rejects.toThrow("less common");
    await expect(hashPassword("aaaaaaaaaaaa")).rejects.toThrow("less common");
  });
});
