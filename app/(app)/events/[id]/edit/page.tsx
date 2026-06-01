import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { EventForm } from "@/components/forms/EventForm";
import { toDateInputValue } from "@/lib/format";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const event = await db.event.findUnique({
    where: { id },
    include: { games: { select: { gameId: true } } },
  });
  if (!event) notFound();
  if (event.userId !== session.user.id) {
    return <p className="text-destructive">You do not have permission to update this event</p>;
  }

  const games = await db.game.findMany({
    where: { userId: session.user.id },
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit event</h1>
      <EventForm
        mode="edit"
        games={games}
        event={{
          id: event.id,
          name: event.name,
          eventDate: toDateInputValue(event.eventDate),
          notes: event.notes,
          gameIds: event.games.map((g) => g.gameId),
        }}
      />
    </div>
  );
}
