import { z } from "zod";

// Sign-up validates email format + 8-char password, mirroring the legacy
// PHP messages exactly (see plan's Behavior Parity table).
export const signUpSchema = z.object({
  email: z.email("Please provide a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// Login validates presence only — the legacy PHP did NOT check email format
// on login (decision: keep loose). Single shared message matches `/login`.
export const loginSchema = z.object({
  email: z.string().min(1, "Submit credentials to log in"),
  password: z.string().min(1, "Submit credentials to log in"),
});

// "Forgot password" step 1: collect the email. Format-validated like sign-up
// so an obvious typo is caught before we bother looking the account up.
export const forgotPasswordSchema = z.object({
  email: z.email("Please provide a valid email address"),
});

// "Forgot password" step 2: choose a new password. Same 8-char floor as
// sign-up; the token travels separately (hidden field / query string).
export const resetPasswordSchema = z.object({
  token: z.string().min(1, "This password reset link is invalid"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
