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

export type SignUpInput = z.infer<typeof signUpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
