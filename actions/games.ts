"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { gameCreateSchema, gameUpdateSchema } from "@/lib/validations/game";

export type GameFormState = {
  fieldErrors?: Partial<Record<"title" | "description", string[]>>;
  error?: string;
};

// Every game action is owner-scoped. Unauthenticated → redirect to /login
// (the "correct the legacy 200-with-error-body" decision).
async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

function parseGameForm(formData: FormData, schema: typeof gameCreateSchema) {
  const description = formData.get("description");
  return schema.safeParse({
    title: formData.get("title"),
    // empty textarea → undefined (optional), not "" — matches "blank" semantics
    description: typeof description === "string" && description.trim() !== "" ? description : undefined,
  });
}

// Mirrors POST /game/create. On success redirects to the list.
export async function createGame(formData: FormData): Promise<GameFormState> {
  const userId = await requireUserId();

  const parsed = parseGameForm(formData, gameCreateSchema);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  await db.game.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      userId,
    },
  });

  revalidatePath("/games");
  redirect("/games");
}

// Mirrors POST /game/update?id=. Owner check matches the PHP (404 vs 403),
// with the exact legacy messages.
export async function updateGame(id: string, formData: FormData): Promise<GameFormState> {
  const userId = await requireUserId();

  const existing = await db.game.findUnique({ where: { id } });
  if (!existing) return { error: `id ${id} does not match a game in the database` };
  if (existing.userId !== userId) {
    return { error: "You do not have permission to update this game" };
  }

  const parsed = parseGameForm(formData, gameUpdateSchema);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  await db.game.update({
    where: { id },
    data: { title: parsed.data.title, description: parsed.data.description ?? null },
  });

  revalidatePath("/games");
  revalidatePath(`/games/${id}`);
  redirect(`/games/${id}`);
}

// Mirrors POST /game/delete?id=. Owner check with legacy messages.
export async function deleteGame(id: string): Promise<GameFormState> {
  const userId = await requireUserId();

  const existing = await db.game.findUnique({ where: { id } });
  if (!existing) return { error: "No game is associated with the provided id" };
  if (existing.userId !== userId) {
    return { error: "You do not have permission to delete this game" };
  }

  await db.game.delete({ where: { id } });

  revalidatePath("/games");
  redirect("/games");
}
