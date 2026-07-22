import { verifyPassword } from "@/lib/password";
import { validateNewPassword } from "@/lib/user-management";

export async function validateOwnPasswordChange(input: {
  currentPassword: string;
  storedHash: string;
  newPassword: string;
  confirmPassword: string;
}) {
  if (!input.currentPassword) throw new Error("Current password is required");
  if (input.newPassword !== input.confirmPassword) throw new Error("Password confirmation does not match");
  validateNewPassword(input.newPassword, input.currentPassword);
  if (!(await verifyPassword(input.currentPassword, input.storedHash))) {
    throw new Error("Current password is incorrect");
  }
}
