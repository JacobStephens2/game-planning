"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { eventCreateSchema, eventUpdateSchema } from "@/lib/validations/event";

export type EventFormState = {
  fieldErrors?: Partial<Record<"name" | "eventDate" | "notes", string[]>>;
  error?: string;
};

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

function emptyToUndef(v: FormDataEntryValue | null): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? undefined : s;
}

function parseDate(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Restrict attached games to ones the user actually owns (don't trust the form).
async function ownedGameIds(userId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const owned = await db.game.findMany({
    where: { id: { in: ids }, userId },
    select: { id: true },
  });
  return owned.map((g) => g.id);
}

function parseForm(formData: FormData, schema: typeof eventCreateSchema) {
  return schema.safeParse({
    name: formData.get("name"),
    eventDate: emptyToUndef(formData.get("eventDate")),
    notes: emptyToUndef(formData.get("notes")),
    gameIds: formData.getAll("gameIds").map(String),
  });
}

export async function createEvent(formData: FormData): Promise<EventFormState> {
  const userId = await requireUserId();

  const parsed = parseForm(formData, eventCreateSchema);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const gameIds = await ownedGameIds(userId, parsed.data.gameIds ?? []);
  await db.event.create({
    data: {
      name: parsed.data.name,
      eventDate: parseDate(parsed.data.eventDate),
      notes: parsed.data.notes ?? null,
      userId,
      games: { create: gameIds.map((gid) => ({ gameId: gid })) }, // packed defaults false
    },
  });

  revalidatePath("/events");
  redirect("/events");
}

export async function updateEvent(id: string, formData: FormData): Promise<EventFormState> {
  const userId = await requireUserId();

  const existing = await db.event.findUnique({ where: { id } });
  if (!existing) return { error: "No event is associated with the provided id" };
  if (existing.userId !== userId) {
    return { error: "You do not have permission to update this event" };
  }

  const parsed = parseForm(formData, eventUpdateSchema);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const gameIds = await ownedGameIds(userId, parsed.data.gameIds ?? []);
  await db.event.update({
    where: { id },
    data: {
      name: parsed.data.name,
      eventDate: parseDate(parsed.data.eventDate),
      notes: parsed.data.notes ?? null,
    },
  });

  // Reconcile which games are on the plan, preserving `packed` for ones that
  // stay: drop de-selected rows, add newly-selected ones.
  await db.eventGame.deleteMany({ where: { eventId: id, gameId: { notIn: gameIds } } });
  if (gameIds.length > 0) {
    const existing = await db.eventGame.findMany({
      where: { eventId: id },
      select: { gameId: true },
    });
    const have = new Set(existing.map((e) => e.gameId));
    const toAdd = gameIds.filter((gid) => !have.has(gid));
    if (toAdd.length > 0) {
      await db.eventGame.createMany({
        data: toAdd.map((gid) => ({ eventId: id, gameId: gid })),
      });
    }
  }

  revalidatePath("/events");
  revalidatePath(`/events/${id}`);
  redirect(`/events/${id}`);
}

// Toggle a game's packed state on an event (the packing list). Owner-scoped.
export async function setPacked(
  eventId: string,
  gameId: string,
  packed: boolean,
): Promise<{ error?: string }> {
  const userId = await requireUserId();

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { userId: true },
  });
  if (!event || event.userId !== userId) {
    return { error: "You do not have permission to update this event" };
  }

  await db.eventGame.update({
    where: { eventId_gameId: { eventId, gameId } },
    data: { packed },
  });

  revalidatePath(`/events/${eventId}`);
  return {};
}

export async function deleteEvent(id: string): Promise<EventFormState> {
  const userId = await requireUserId();

  const existing = await db.event.findUnique({ where: { id } });
  if (!existing) return { error: "No event is associated with the provided id" };
  if (existing.userId !== userId) {
    return { error: "You do not have permission to delete this event" };
  }

  await db.event.delete({ where: { id } });

  revalidatePath("/events");
  redirect("/events");
}
