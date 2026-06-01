import type { DefaultSession } from "next-auth";

// Surface the user id (set from our JWT `userId`) on the session so server
// actions can scope queries: session.user.id. Mirrors legacy $decoded->user_id.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
  }
}
