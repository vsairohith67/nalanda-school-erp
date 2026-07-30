import { validateNewPassword, verifyPassword } from "@/lib/password";

export async function validateOwnPasswordChange(input: {
  currentPassword: string;
  storedHash: string;
  newPassword: string;
  confirmPassword: string;
}) {
  if (!input.currentPassword) throw new Error("Current password is required");
  if (input.newPassword !== input.confirmPassword) throw new Error("Password confirmation does not match");
  validateNewPassword(input.newPassword);
  if (input.newPassword === input.currentPassword) {
    throw new Error("New password must be different from the current password");
  }
  if (!(await verifyPassword(input.currentPassword, input.storedHash))) {
    throw new Error("Current password is incorrect");
  }
}
