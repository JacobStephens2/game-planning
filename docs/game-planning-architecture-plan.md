# Game Planning App — Re-platform Architecture Plan
**Migration: PHP/MySQL REST API + Vanilla-JS PWA → Next.js (App Router) + TypeScript**

---

## Executive Summary

This document is the authoritative architecture plan for re-platforming the Game Planning App from its current split LAMP architecture (a PHP/MySQL REST API at `game-planning-api` and a separate vanilla-JS PWA at `game-planning-web-app-ui`) into a single, cohesive Next.js (App Router) TypeScript monorepo. All existing functionality is preserved exactly. No new features are added in v1.

The key outcomes of this migration are:
- End-to-end type safety (Zod schemas inferred → Prisma types shared across client and server)
- A single deployable unit on Vercel + managed Postgres
- Replacement of JWT-in-cookie auth with Auth.js (NextAuth) sessions
- Replacement of PHP validation functions with Zod schemas
- Replacement of vanilla HTML/CSS/JS with Tailwind CSS + shadcn/ui

---

## Source Code Audit

### Existing Data Model (from `classes/`)

The PHP classes reveal the precise database columns to reproduce in Prisma.

#### `users` table
Columns: `id`, `email`, `hashed_password`, `user_group` (integer; `'1'` = standard user, implied admin tier exists)

```php
// user.class.php
static protected $db_columns = ['id', 'email', 'user_group', 'hashed_password'];
```

Password hashing: `password_hash($password, PASSWORD_BCRYPT)` → bcrypt. The new stack uses argon2id (via Auth.js / `@auth/prisma-adapter` with argon2) or bcrypt via `bcryptjs` — both are compatible with `password_verify()`-style verification.

#### `games_test` table (production table name)
Columns: `id`, `title`, `description`, `user_id`

```php
// game.class.php
static protected $table_name = 'games_test';
static protected $db_columns = ['id', 'title', 'description', 'user_id'];
```

> ⚠️ **Flag:** The table name is `games_test`, not `games`. Confirm whether this is intentional production naming before writing `schema.prisma`. In Prisma, `@@map("games_test")` preserves the name on an existing database; on a fresh Postgres migration the new table can be named `games` cleanly.

No `created_at` / `updated_at` columns exist in the current schema. Prisma's `@default(now())` and `@updatedAt` can be added for free during migration — this is not a new feature, it is good hygiene and does not change any existing behavior.

### Existing API Endpoints (from `public/`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/sign-up` | None | Create user; notify admin via Mandrill |
| POST | `/login` | None | Verify credentials; set `access_token` JWT cookie. ⚠️ The **JWT `exp` is 60 minutes**, but the cookie `Max-Age` is 7 days — so the cookie outlives the token and the effective session is ~60 minutes. See [Session Lifetime](#session-lifetime-parity). |
| POST | `/logout` | None | Expire `access_token` cookie |
| GET | `/games/read` | JWT cookie | List all games scoped to authenticated user |
| GET | `/game/read?id=` | JWT cookie | Read single game (owner check) |
| POST | `/game/create` | JWT cookie | Create game from `$_POST['game']` array |
| POST | `/game/update?id=` | JWT cookie | Update game fields (owner check) |
| POST | `/game/delete?id=` | JWT cookie | Delete game (owner check) |

### Existing UI Routes (from `game-planning-web-app-ui/`)

| File | Description |
|------|-------------|
| `index.html` | Entry / dashboard |
| `login.html` | Login form |
| `sign-up.html` | Registration form |
| `games/read.html` | Browse all user games |
| `game/create.html` | Create game form |
| `game/edit.html` | Edit game form |
| `game/delete.html` | Delete confirmation |

### Email Notification (from `public/sign-up.php`)

Admin notification on new user registration uses **Mandrill** (Mailchimp's transactional API). The new stack replaces this with **Resend** (simpler API, modern SDK, free tier sufficient). The notification content is preserved:
- Subject: `GamePlan — New Account Created`
- Body: new user email, timestamp, device/user-agent

Environment variables to mirror: `MANDRILL_API_KEY` → `RESEND_API_KEY`, plus `ADMIN_EMAIL`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME`.

### Authentication Mechanism

Current: `firebase/php-jwt` generates an HS512 JWT, stored as an HttpOnly cookie `access_token`. Each protected endpoint calls `authenticate()` which decodes the JWT and returns `$decoded->user_id`. If decoding fails (expired, tampered, or missing), `authenticate()` echoes `{ message: 'You have not been authenticated', exception: ... }` and `exit`s — note it does **not** set a 401 status code, it returns HTTP 200 with an error body. The new stack should return a proper 401/redirect to `/login` (a deliberate, correct improvement over the legacy 200-with-error-body behavior).

The login cookie is set with `setcookie(..., httponly: true)` and `secure` driven by `COOKIE_SECURE`; the JWT payload carries `iat`, `iss` (server name), `nbf`, `exp` (issued-at + 60 min), and `user_id`.

#### Session lifetime (parity)

This is the one place legacy behavior is genuinely ambiguous and a decision is required. The JWT's `exp` claim is **60 minutes** (`$issuedAt->modify('+60 minutes')`), but the `access_token` cookie's `Max-Age` is **7 days** (`time() + (86400 * 7)`). Because `JWT::decode()` enforces `exp`, the practical session length is **60 minutes** — after that the still-present cookie holds an expired token and `authenticate()` fails. The 7-day cookie is effectively dead weight.

**Decision taken (M3): extend to 7 days.** The 7-day cookie reflects the apparent original intent, and a 7-day session is a far better UX than the accidental ~60-minute one. Auth.js `session.maxAge` is set explicitly rather than inheriting the 30-day default:

```ts
// lib/auth.ts (as built)
session: {
  strategy: "jwt",
  maxAge: 7 * 24 * 60 * 60,   // 7 days
},
```

Verified: a fresh login's `/api/auth/session` returns `expires` exactly 7 days out.

New: **Auth.js v5 (NextAuth)** with the `credentials` provider replicates this pattern. Auth.js stores session data in an encrypted, HttpOnly cookie (`next-auth.session-token`). The `user_id` is encoded in the session via the `jwt` callback:

```ts
// lib/auth.ts (jwt callback)
callbacks: {
  jwt({ token, user }) {
    if (user) token.userId = user.id;
    return token;
  },
  session({ session, token }) {
    session.user.id = token.userId as string;
    return session;
  }
}
```

---

## Target Architecture

### Project Structure

```
game-planning/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx               # Login form page
│   │   └── sign-up/
│   │       └── page.tsx               # Sign-up form page
│   ├── (app)/
│   │   └── games/
│   │       ├── page.tsx               # Browse games (games/read)
│   │       ├── new/
│   │       │   └── page.tsx           # Create game form
│   │       └── [id]/
│   │           ├── page.tsx           # Game detail / read
│   │           ├── edit/
│   │           │   └── page.tsx       # Edit game form
│   │           └── delete/
│   │               └── page.tsx       # Delete confirmation
│   ├── api/
│   │   └── auth/
│   │       └── [...nextauth]/
│   │           └── route.ts           # Auth.js catch-all handler
│   ├── layout.tsx                     # Root layout (font, providers)
│   └── page.tsx                       # Root → redirect to /games or /login
├── lib/
│   ├── auth.ts                        # Auth.js config (credentials provider)
│   ├── db.ts                          # Prisma client singleton
│   ├── email.ts                       # Resend email helper
│   └── validations/
│       ├── user.ts                    # Zod schemas: signUpSchema, loginSchema
│       └── game.ts                    # Zod schemas: gameCreateSchema, gameUpdateSchema
├── components/
│   ├── ui/                            # shadcn/ui components (auto-generated)
│   ├── forms/
│   │   ├── LoginForm.tsx
│   │   ├── SignUpForm.tsx
│   │   ├── GameForm.tsx               # Shared create/edit form
│   │   └── DeleteGameForm.tsx
│   └── layout/
│       ├── Nav.tsx
│       └── Footer.tsx
├── actions/
│   ├── auth.ts                        # Server actions: signUp, login, logout
│   └── games.ts                       # Server actions: createGame, updateGame, deleteGame
├── prisma/
│   └── schema.prisma
├── .env                               # Local secrets (gitignored)
├── .env-template                      # Committed template
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json                      # strict: true
└── package.json
```

### Prisma Schema

> **As built (Prisma 7).** The original draft of this block targeted Prisma 6 (`prisma-client-js` generator, `url` inside the datasource). Prisma 7 changed both: the generator is now `prisma-client` with a required `output`, and **`url` is no longer allowed in the schema** — the CLI reads it from `prisma.config.ts` and the runtime client connects via a **driver adapter** (`@prisma/adapter-pg`). The block below is what is actually committed.

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client"
  output   = "../lib/generated/prisma"
}

datasource db {
  provider = "postgresql"
  // No `url` here in Prisma 7. Migrate reads it from prisma.config.ts;
  // the runtime client uses a driver adapter (see lib/db.ts).
}

model User {
  id             String   @id @default(cuid())
  email          String   @unique
  hashedPassword String
  userGroup      Int      @default(1)   // 1 = standard, 2 = admin (mirrors user_group)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  games          Game[]

  @@map("users")
}

model Game {
  id          String   @id @default(cuid())
  title       String
  description String?
  userId      String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("games")  // chose `games` over legacy `games_test` (Open Question #2)
}
```

Supporting Prisma 7 files (also committed):

```ts
// prisma.config.ts — CLI-time config (Migrate URL + seed runner)
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: process.env["DATABASE_URL"] },
});
```

```ts
// lib/db.ts — runtime client via the pg driver adapter
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

> **MySQL option:** If you prefer MySQL, change `provider = "postgresql"` and swap the adapter to `@prisma/adapter-mariadb` (or another supported driver) in `lib/db.ts`. We chose PostgreSQL (Open Question #1). MySQL lacks some Postgres features (native arrays, JSONB) but nothing in v1 requires them.

### .env Template

As committed in `.env-template` (Auth.js **v5** uses `AUTH_SECRET`/`AUTH_URL`, not the v4 `NEXTAUTH_*` names):

```
# Database (Postgres) — used by prisma.config.ts (Migrate) and lib/db.ts adapter
DATABASE_URL="postgresql://user:password@localhost:5432/game_planning?schema=public"

# Auth.js v5 — generate with: npx auth secret
AUTH_SECRET=""
# AUTH_URL="http://localhost:3000"   # optional in dev; set to deployed origin in prod

# Email (Resend)
RESEND_API_KEY=""
ADMIN_EMAIL=""
MAIL_FROM_EMAIL="gameplan@yourdomain.com"
MAIL_FROM_NAME="GamePlan"
```

---

## Zod Validation Schemas

These replace `validation_functions.php` with typed, composable schemas. Inferred TypeScript types are shared across client components (React Hook Form) and server actions.

```ts
// lib/validations/user.ts
import { z } from "zod";

export const signUpSchema = z.object({
  email: z.string().email("Please provide a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Submit a valid email to log in"),
  password: z.string().min(1, "Submit credentials to log in"),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
```

```ts
// lib/validations/game.ts
import { z } from "zod";

export const gameCreateSchema = z.object({
  title: z.string().min(1, "Title cannot be blank."),
  description: z.string().optional(),
});

export const gameUpdateSchema = gameCreateSchema.partial().required({ title: true });

export type GameCreateInput = z.infer<typeof gameCreateSchema>;
export type GameUpdateInput = z.infer<typeof gameUpdateSchema>;
```

---

## Server Actions

Server Actions replace the PHP REST endpoints. They run on the server, receive validated form data, and return typed results. No separate API route layer is needed for CRUD.

```ts
// actions/games.ts (excerpt)
"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { gameCreateSchema } from "@/lib/validations/game";
import { revalidatePath } from "next/cache";

export async function createGame(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");

  const parsed = gameCreateSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const game = await db.game.create({
    data: { ...parsed.data, userId: session.user.id },
  });

  revalidatePath("/games");
  return { data: game };
}
```

The pattern for `updateGame(id, formData)` and `deleteGame(id)` follows the same structure: auth check → ownership check (`game.userId !== session.user.id` → 403) → Prisma mutation → `revalidatePath`.

The `signUp` action carries the only parity subtlety not expressible in Zod alone — the duplicate-email case (legacy 409). Zod validates shape; the unique constraint is enforced by the database, so catch Prisma's `P2002`:

```ts
// actions/auth.ts (excerpt)
"use server";

import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signUpSchema } from "@/lib/validations/user";
import { notifyAdminNewUser } from "@/lib/email";
import { headers } from "next/headers";

export async function signUp(formData: FormData) {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  try {
    const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
    const user = await db.user.create({
      data: { email: parsed.data.email, hashedPassword }, // userGroup defaults to 1
    });
    const ua = (await headers()).get("user-agent") ?? "unknown";
    await notifyAdminNewUser(user.email, ua);
    return { data: { message: "Account creation succeeded" } };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // mirrors legacy 409
      return { error: { email: ["This email address is already associated with an account"] } };
    }
    throw e;
  }
}
```

---

## Auth.js Configuration

```ts
// lib/auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validations/user";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60,   // 7 days (decision)
  },
  trustHost: true,              // single self-hosted origin + localhost dev
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.hashedPassword);
        if (!valid) return null;

        return { id: user.id, email: user.email };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.userId = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.userId) session.user.id = token.userId as string;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
```

> **Notes from the build:** (1) `session.user.id = token.userId as string` needs the cast — the `next-auth/jwt` augmentation resolves `token.userId` too loosely for a direct assignment. (2) The `login` server action wraps `signIn` in try/catch: a successful sign-in throws `NEXT_REDIRECT` (re-thrown so navigation happens), while `instanceof AuthError` is caught and returned as the legacy `"Log in failed"` message. (3) The route handler is just `export const { GET, POST } = handlers` from `app/api/auth/[...nextauth]/route.ts`. No middleware (route protection is done with `auth()` in server components/actions), which keeps bcrypt + Prisma off the edge runtime.

---

## Email Notification

```ts
// lib/email.ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function notifyAdminNewUser(email: string, userAgent: string) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || !process.env.RESEND_API_KEY) return;

  await resend.emails.send({
    from: `${process.env.MAIL_FROM_NAME} <${process.env.MAIL_FROM_EMAIL}>`,
    to: adminEmail,
    subject: "GamePlan — New Account Created",
    text: [
      "A new account was created on GamePlan.",
      `Email: ${email}`,
      `Date: ${new Date().toISOString()}`,
      `Device: ${userAgent.slice(0, 1024)}`,
    ].join("\n\n"),
  });
}
```

Called inside the `signUp` server action after `db.user.create()` succeeds — directly mirrors `notify_admin_new_user()` in the PHP.

---

## Behavior Parity: Status Codes & Error Messages

Because v1's contract is "all existing functionality preserved exactly," the server actions must reproduce the legacy endpoints' **exact status codes and user-facing messages** (these strings are consumed by the current UI's `handleErrors.js` and shown to users). The table below is transcribed verbatim from the PHP handlers and is the acceptance checklist for Milestone 6 parity testing.

### `signUp` (was `POST /sign-up`)

| Condition | Legacy status | Message |
|---|---|---|
| Missing email | 400 | `Submit an email address to register` |
| Password empty or `< 8` chars | 400 | `Password must be at least 8 characters` |
| Invalid email format | 400 | `Please provide a valid email address` |
| Email already registered | 409 | `This email address is already associated with an account` |
| Success | 201 | `Account creation succeeded` (also fires admin email) |

> Validation order matters: email-presence → password-length → email-format → uniqueness. The duplicate-email case (409) must be handled by catching Prisma's `P2002` unique-constraint error on `email` — the Zod schema alone cannot detect it. The current plan's `signUpSchema` omits this message; add it to the `signUp` action's error mapping.

### `login` (was `POST /login`)

| Condition | Legacy status | Message |
|---|---|---|
| Missing email or password | 400 | `Submit credentials to log in` |
| Credentials invalid | 401 | `Log in failed` |
| Success | 200 | `Log in succeeded` (+ `logged_in: 'true'`) |

> Legacy `/login` does **not** validate email *format* — only presence. The plan's `loginSchema` email message (`"Submit a valid email to log in"`) introduces format validation that did not exist; for strict parity, relax it to a presence check (`z.string().min(1, "Submit credentials to log in")`) or accept the minor, defensible tightening and note it.

### `logout` (was `POST /logout`)

| Condition | Legacy status | Message |
|---|---|---|
| Always | 200 | `Logged out` (expires `access_token` cookie) |

### Game endpoints (all require auth)

| Action | Condition | Legacy status | Message |
|---|---|---|---|
| `readGame` | Missing id | 400 | `Please provide a game's id` |
| `readGame` | No such game | 404 | `No game is associated with the provided id` |
| `readGame` | Not owner | 403 | `You do not have permission to view this game` |
| `createGame` | Title blank | (200 body w/ errors) | `Title cannot be blank.` |
| `createGame` | No `game` payload | 200 | `Please provide an array of game form data` |
| `createGame` | Success | 200 | `Game created` |
| `updateGame` | Missing id | 400 | `Please provide a game id` |
| `updateGame` | No such game | 404 | `id <id> does not match a game in the database` |
| `updateGame` | Not owner | 403 | `You do not have permission to update this game` |
| `updateGame` | Save failed | 422 | `Game not updated` |
| `updateGame` | Success | 200 | `<title> updated` |
| `deleteGame` | Missing id | 400 | `Please provide a game's id` |
| `deleteGame` | No such game | 404 | `No game is associated with the provided id` |
| `deleteGame` | Not owner | 403 | `You do not have permission to delete this game` |
| `deleteGame` | Delete failed | 500 | `Game not deleted` |
| `deleteGame` | Success | 200 | `Game deleted` |

> **Ownership checks use `!=` (loose) in PHP** on integer `user_id`. With cuid string IDs in Prisma, use strict `!==`. The only validation `Game::validate()` enforces is the non-blank title — `description` is fully optional, matching `gameCreateSchema`.

> **Payload shape change (non-user-facing):** legacy `create`/`update` read a nested `$_POST['game']` array (`game[title]`, `game[description]`), i.e. form-encoded with a `game` namespace. The new server actions take a flat `FormData` (`title`, `description`). This is a wire-format change only; no user-visible behavior differs. Worth noting so anyone diffing network traffic during parity testing isn't surprised.

---

## UI Component Mapping

| PHP/Vanilla-JS | Next.js Equivalent |
|---|---|
| `login.html` + `modules/requests/login.js` | `app/(auth)/login/page.tsx` + `LoginForm.tsx` (RHF + Zod) |
| `sign-up.html` + `modules/requests/sign-up.js` | `app/(auth)/sign-up/page.tsx` + `SignUpForm.tsx` |
| `games/read.html` | `app/(app)/games/page.tsx` (Server Component, fetches via Prisma) |
| `game/create.html` | `app/(app)/games/new/page.tsx` + `GameForm.tsx` |
| `game/edit.html` | `app/(app)/games/[id]/edit/page.tsx` + `GameForm.tsx` |
| `game/delete.html` | `app/(app)/games/[id]/delete/page.tsx` + `DeleteGameForm.tsx` |
| `modules/components/nav.js` | `components/layout/Nav.tsx` |
| `modules/components/footer.js` | `components/layout/Footer.tsx` |
| `modules/exports/handleErrors.js` | Inline form error states via RHF `formState.errors` |
| `modules/exports/cookieMethods.js` | Removed — Auth.js manages session cookies |
| `modules/exports/apiHostname.js` | Removed — server actions are co-located |

---

## End-to-End Type Safety (The Point of the Migration)

The migration's key architectural value is that types flow unbroken from database to browser. No manual type casting or `any` escapes:

```
prisma/schema.prisma
        ↓ (prisma generate)
@prisma/client → Game, User types
        ↓
lib/validations/game.ts → GameCreateInput = z.infer<typeof gameCreateSchema>
        ↓
actions/games.ts → receives GameCreateInput, returns Prisma.Game
        ↓
app/(app)/games/page.tsx → Server Component receives Prisma.Game[]
        ↓
components/forms/GameForm.tsx → useForm<GameCreateInput>() typed by Zod schema
```

Every layer is typed. `tsconfig.json` must include `"strict": true`. No `any` — use `unknown` and narrow explicitly.

---

## Migration Sequence (Milestones)

### Milestone 1 — Scaffold ✅ (done 2026-05-31)
- ~~`npx create-next-app@latest game-planning --typescript --tailwind --eslint --app --src-dir no --import-alias "@/*"`~~ — actual flag is `--no-src-dir` (not `--src-dir no`). Ran as: `create-next-app@latest . --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --yes`
- shadcn/ui initialized (`npx shadcn@latest init -d`) — New York style, on Tailwind v4; created `components/ui/button.tsx`, `lib/utils.ts`, `components.json`
- Dependencies installed: `prisma`, `@prisma/client`, `next-auth@beta`, `zod`, `react-hook-form`, `@hookform/resolvers`, `bcryptjs`, `resend` (+ `@types/bcryptjs` dev). See [Dependency Reference](#dependency-reference) for the resolved versions — several majors are ahead of the original assumptions.
- `tsconfig.json` `"strict": true` confirmed (create-next-app default); import alias `@/*` confirmed; `app/` at repo root (no `src/`).
- **Verified:** `npm run build` compiles cleanly on Next 16.2.6 (`✓ Compiled successfully`).

### Milestone 2 — Database ✅ (done 2026-06-01)
- **Decisions taken:** PostgreSQL (Q1), table name `games` (Q2).
- Postgres role+db created on the existing on-volume Postgres 16 cluster: role `gameplan` (needs `CREATEDB` so `migrate dev` can build its shadow database), db `game_planning`. `DATABASE_URL` written to gitignored `.env`; `.env-template` committed.
- `prisma/schema.prisma` written (Prisma 7 form above) → `npx prisma migrate dev --name init` created `users` + `games` with the unique-email index and cascade FK.
- `prisma/seed.ts` (one bcrypt user `test@example.com` / `password123`, two games) wired via `migrations.seed` in `prisma.config.ts`; run with `npx prisma db seed`.
- **Verified:** seeded rows confirmed via `psql`; `npx tsc --noEmit` clean; `npm run build` green with the Prisma client + adapter present. (Skipped `prisma studio` — it's an interactive GUI; SQL check was sufficient.)
- **Prisma 7 gotchas hit & resolved:** (a) no `url` in schema → use driver adapter `@prisma/adapter-pg`; (b) `new PrismaClient()` needs `{ adapter }`; (c) seed runner is `tsx`, configured in `prisma.config.ts` (not `package.json#prisma`); (d) shadow DB needs role `CREATEDB`.

### Milestone 3 — Authentication ✅ (done 2026-06-01)
- **Decisions taken:** 7-day session (Q6); correct both legacy quirks (Q7) — real redirect/401 instead of 200-with-error-body, and login keeps presence-only email validation.
- `lib/auth.ts` (credentials provider, 7-day JWT session, trustHost), `app/api/auth/[...nextauth]/route.ts`, `actions/auth.ts` (signUp + Resend notify, login, logout), `lib/validations/user.ts` (Zod 4), `lib/email.ts`, `types/next-auth.d.ts`, and the `LoginForm`/`SignUpForm` + `(auth)/login` & `sign-up` pages all built.
- **Verified at runtime (dev server + NextAuth REST flow):** seeded user logs in → 302 to `/games`, `/api/auth/session` returns `user.id` with a 7-day `expires`; wrong password → `CredentialsSignin`, session `null`; logout → session `null`. Sign-up data path (bcrypt hash → create → **P2002** duplicate guard, `userGroup` defaults to 1) verified against the DB, and a freshly-created user authenticates through the live flow (proves bcrypt hash compatibility).
- **Admin email:** not exercised — no `RESEND_API_KEY` set, so `notifyAdminNewUser` no-ops exactly like the legacy guard. Wire a real key in env to enable; the send is also wrapped so a failure never breaks sign-up.

### Milestone 4 — Game CRUD (API Layer) ✅ (done 2026-06-01)
- `actions/games.ts`: `createGame`, `updateGame`, `deleteGame`, each owner-scoped via `auth()` (unauthenticated → `redirect("/login")`). Existence/ownership checks reproduce the legacy **404-vs-403** distinction with the exact PHP messages; mutations `revalidatePath` + `redirect`. (The legacy "missing id" 400 and "no game payload" cases can't occur — ids come from route params and the form always posts.)
- `lib/validations/game.ts`: Zod 4 schemas, sole rule is non-blank title.

### Milestone 5 — UI Pages ✅ (done 2026-06-01)
- `(app)` route group with an auth-guarded layout (`Nav` + `Footer`); games list (server component, `findMany` scoped to user); `new` / `[id]` / `[id]/edit` / `[id]/delete` pages; shared `GameForm` (RHF + `zodResolver`) and `DeleteGameForm`; root `/` redirects by session.
- **Gotcha:** this shadcn build uses **Base UI** `Button` (not Radix) — no `asChild`/Slot. Link-buttons use `buttonVariants()` on `<Link>` instead.
- **Verified end-to-end (headless Chrome via playwright-core + system google-chrome):** login → **client-side** blank-title validation (`"Title cannot be blank."`) → create (appears in list) → edit (persists on detail) → delete (gone). DB returns to seed state. *(Test-harness note: the `(app)` Nav's `type="submit"` logout button precedes the form button in the DOM — target form submits by text, not a bare `button[type=submit]`.)*

### Milestone 6 — Parity Check & Deploy 🟡 (in progress 2026-06-01)
**Decision: self-host on the VPS** (not Vercel) — the DB already lives here and the systemd + Apache reverse-proxy + certbot pattern is already in use for channel0 / the dashboard. Deployed **parallel** to the legacy PHP app; cut over later.

Done:
- **Parity checked vs the live PHP API**: `POST /login` empty → `400 "Submit credentials to log in"` ✓; `POST /sign-up` bad email → `400 "Please provide a valid email address"` ✓ — exact match to our Zod messages. Unauth `games/read` returns **HTTP 500 with an empty body** on the live app (a PHP fatal on the missing cookie) — confirms the Q7 decision to replace that broken path with a real redirect/401 rather than reproduce it.
- `next.config.ts` → `output: "standalone"`; production build smoke-tested.
- `deploy/`: systemd unit, Apache vhost template, build-is-deploy script, runbook.
- **systemd service `gameplan-web` live on `127.0.0.1:3473`** (enabled on boot, ~49 MB): serves pages, authenticates against the DB (7-day session), reads seeded games. Verified.

Remaining (needs DNS — outward-facing):
- Choose subdomain (e.g. `gameplan2.stephens.page`) + add A record → `68.183.62.24`.
- `a2enmod proxy proxy_http`; install the vhost; `certbot --apache` for TLS.
- Optionally set `RESEND_API_KEY` to enable the admin sign-up email in prod.
- Cutover: repoint `gameplan.stephens.page` and retire the PHP vhosts (migrate legacy MySQL rows first if they must be preserved).

---

## Open Questions / Decisions for You to Make

1. **PostgreSQL or MySQL?** The plan defaults to PostgreSQL (recommended for Vercel/Neon). Prisma supports MySQL equally; change one line in `schema.prisma`. If you have an existing MySQL database to migrate data from, MySQL keeps data migration simpler.

2. **Table name: `games_test` or `games`?** On a fresh Postgres database, `games` is cleaner. If migrating live data from the existing MySQL, use `@@map("games_test")` to preserve the name.

3. **`user_group` → role mapping.** Currently `user_group = 1` for all new users. The admin tier is not surfaced in the UI. For v1, preserve as `userGroup: Int @default(1)` in Prisma. An admin UI or role-based guards can be added post-v1.

4. **Password migration.** Existing bcrypt hashes (`PASSWORD_BCRYPT`) are directly compatible with `bcryptjs.compare()` in Node.js. No re-hashing needed for migrated users.

5. **Resend or Nodemailer?** Resend is recommended (simpler SDK, no SMTP config). Nodemailer + an SMTP provider (e.g., Mailgun, Postmark) is an alternative if you have an existing SMTP setup.

6. ~~**Session lifetime.**~~ **RESOLVED (M3): 7 days.** `session.maxAge = 7 * 24 * 60 * 60`. The legacy 7-day cookie reflected the apparent original intent; the ~60-minute effective session was an accident of the JWT `exp`.

7. ~~**Error-message parity vs. cleanup.**~~ **RESOLVED (M3): correct both.** (a) Login keeps presence-only email validation (no format tightening). (b) Unauthenticated access returns a real redirect/401 (via Auth.js), not the legacy 200-with-error-body. All other [parity strings](#behavior-parity-status-codes--error-messages) preserved verbatim.

---

## Dependency Reference

The table below is the **actually-installed** stack as of the Milestone-1 scaffold (2026-05-31), not the originally-assumed versions. Several majors landed ahead of this plan's first draft — see the breaking-change notes that follow.

| Package | Installed | Originally assumed | Purpose |
|---------|-----------|--------------------|---------|
| `next` | **16.2.6** | 15.x | Framework |
| `react`, `react-dom` | 19.2.4 | 19.x | UI runtime |
| `typescript` | 5.x | 5.x | Language |
| `prisma` | **7.8.0** | 6.x | ORM + migrations |
| `@prisma/client` | **7.8.0** | 6.x | DB client |
| `next-auth` | 5.0.0-beta.31 | 5.x (beta) | Authentication |
| `zod` | **4.4.3** | 3.x | Validation schemas |
| `react-hook-form` | 7.77.0 | 7.x | Form state |
| `@hookform/resolvers` | **5.4.0** | 3.x | RHF + Zod bridge |
| `bcryptjs` | **3.0.3** | 2.x | Password hashing |
| `@types/bcryptjs` | 2.x | 2.x | TS types (bcryptjs 3 may bundle its own — verify before relying on `@types`) |
| `resend` | **6.12.4** | 4.x | Transactional email |
| `tailwindcss` | 4.x | 4.x | Styling (v4 — CSS-first config, no `tailwind.config.ts` by default) |
| `shadcn/ui` | latest | latest | Component library (New York style, on Tailwind v4) |

> ### ⚠️ Version-drift notes for implementation
> The example snippets earlier in this doc were written against the *originally-assumed* versions. Before each milestone, reconcile against the installed majors below. The scaffold also ships an `AGENTS.md` warning that "this is NOT the Next.js you know" — consult `node_modules/next/dist/docs/` for the installed version's conventions.
>
> - **Next 16 (not 15):** App Router APIs shifted. `headers()`/`cookies()`/`params`/`searchParams` are async — `await` them (the `signUp` snippet already does `await headers()`). Verify the Auth.js v5 ↔ Next 16 integration; route handler and middleware signatures may differ from v15 examples.
> - **Prisma 7 (not 6):** Client generation/output conventions changed (custom `output` path on the generator is now expected; the bare `prisma-client-js` provider in the schema block above may need updating). Run `npx prisma init`/`generate` and follow its guidance rather than hand-copying the v6 schema header verbatim.
> - **Zod 4 (not 3):** `z.string().email(...)` is deprecated in favor of top-level `z.email(...)`; `.flatten()` on errors still exists but `z.treeifyError`/`z.flattenError` are the v4-native forms. The validation snippets work but should be modernized when written.
> - **bcryptjs 3 (not 2):** API (`hash`/`compare`) is unchanged and remains compatible with PHP's `PASSWORD_BCRYPT` hashes; the package is now ESM-friendly. The `@types/bcryptjs` dependency may be redundant.
> - **Tailwind v4:** create-next-app produced a CSS-first setup (`@import "tailwindcss"` in `globals.css`, `@tailwindcss/postcss`), so there is no `tailwind.config.ts` — adjust the [Project Structure](#project-structure) tree accordingly.

