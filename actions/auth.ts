"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Prisma } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { signIn, signOut } from "@/lib/auth";
import { signUpSchema } from "@/lib/validations/user";

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

// Mirrors POST /logout.
export async function logout() {
  await signOut({ redirectTo: "/login" });
}
