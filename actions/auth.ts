"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Prisma } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { signIn, signOut } from "@/lib/auth";
import {
  signUpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/validations/user";

// Reset links are good for one hour. We store only the SHA-256 of the token
// (see the PasswordResetToken model); the plaintext lives only in the email.
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type AuthFormState = {
  fieldErrors?: Partial<Record<"email" | "password", string[]>>;
  formError?: string;
};

// Mirrors POST /sign-up: validate → create user → notify admin → redirect to
// login. Duplicate email (legacy 409) surfaces via Prisma's P2002.
export async function signUp(formData: FormData): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  try {
    const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
    const user = await db.user.create({
      data: { email: parsed.data.email, hashedPassword }, // userGroup defaults to 1
    });
    const ua = (await headers()).get("user-agent") ?? "unknown";
    await notifyOnSignUp(user.email, ua);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        fieldErrors: {
          email: ["This email address is already associated with an account"],
        },
      };
    }
    throw e;
  }

  // Outside the try: redirect() throws NEXT_REDIRECT, which must not be caught.
  redirect("/login?registered=1");
}

// Email failures must not break sign-up (legacy logged and continued).
async function notifyOnSignUp(email: string, userAgent: string) {
  try {
    const { notifyAdminNewUser } = await import("@/lib/email");
    await notifyAdminNewUser(email, userAgent);
  } catch (e) {
    console.error("Admin sign-up notification failed:", e);
  }
}

// Mirrors POST /login. On success signIn redirects to /games (throws
// NEXT_REDIRECT); invalid credentials surface as the legacy "Log in failed".
export async function login(formData: FormData): Promise<AuthFormState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/games",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { formError: "Log in failed" };
    }
    throw error; // re-throw NEXT_REDIRECT and anything unexpected
  }
  return {};
}

// Step 1 of "forgot password": issue a reset token and email a link. Always
// returns the same empty (success) state whether or not the email is on file —
// the UI shows an identical "check your inbox" message either way, so the
// response can't be used to enumerate which addresses have accounts.
export async function requestPasswordReset(formData: FormData): Promise<AuthFormState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (user) {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    // One live token per user: drop any earlier outstanding ones before issuing.
    await db.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await db.passwordResetToken.create({
      data: { tokenHash: hashToken(token), userId: user.id, expiresAt },
    });

    const base = process.env.AUTH_URL ?? "http://localhost:3000";
    const resetUrl = `${base}/reset-password?token=${token}`;
    try {
      const { sendPasswordResetEmail } = await import("@/lib/email");
      await sendPasswordResetEmail(user.email, resetUrl);
    } catch (e) {
      // Don't leak the failure to the client (that would reveal the account
      // exists); log it for the operator instead.
      console.error("Password reset email failed:", e);
    }
  }

  return {};
}

// Step 2 of "forgot password": redeem the token and set the new password.
// Token problems surface as a single formError (the user can't fix a bad link
// inline — they need a fresh one); a too-short password is a field error.
export async function resetPassword(formData: FormData): Promise<AuthFormState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    if (fieldErrors.token) return { formError: fieldErrors.token[0] };
    return { fieldErrors: { password: fieldErrors.password } };
  }

  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(parsed.data.token) },
  });
  if (!record || record.expiresAt < new Date()) {
    if (record) await db.passwordResetToken.delete({ where: { id: record.id } });
    return {
      formError:
        "This password reset link is invalid or has expired. Please request a new one.",
    };
  }

  const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
  // Set the password and burn every outstanding token for this user atomically.
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { hashedPassword } }),
    db.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
  ]);

  // Outside any try: redirect() throws NEXT_REDIRECT, which must not be caught.
  redirect("/login?reset=1");
}

// Mirrors POST /logout.
export async function logout() {
  await signOut({ redirectTo: "/login" });
}
