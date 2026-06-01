import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { buttonVariants } from "@/components/ui/button";
import { PackingList } from "@/components/PackingList";
import { formatEventDate } from "@/lib/format";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const event = await db.event.findUnique({
    where: { id },
    include: { games: { include: { game: true }, orderBy: { game: { title: "asc" } } } },
  });
  if (!event) notFound();
  if (event.userId !== session.user.id) {
    return <p className="text-destructive">You do not have permission to view this event</p>;
  }

  const date = formatEventDate(event.eventDate);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{event.name}</h1>
          {date && <p className="text-muted-foreground">{date}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href={`/events/${event.id}/edit`}
            className={buttonVariants({ variant: "outline" })}
          >
            Edit
          </Link>
          <Link
            href={`/events/${event.id}/delete`}
            className={buttonVariants({ variant: "destructive" })}
          >
            Delete
          </Link>
        </div>
      </div>

      {event.notes && <p className="whitespace-pre-wrap text-muted-foreground">{event.notes}</p>}

      <div className="space-y-2">
        {(() => {
          const items = event.games.map((eg) => ({
            gameId: eg.gameId,
            title: eg.game.title,
            packed: eg.packed,
          }));
          const packedCount = items.filter((i) => i.packed).length;
          return (
            <>
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-medium">Packing list</h2>
                {items.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {packedCount} of {items.length} packed
                  </span>
                )}
              </div>
              {items.length === 0 ? (
                <p className="text-muted-foreground">No games selected for this event yet.</p>
              ) : (
                <PackingList eventId={event.id} items={items} />
              )}
            </>
          );
        })()}
      </div>

      <Link href="/events" className={buttonVariants({ variant: "link", className: "px-0" })}>
        ← Back to events
      </Link>
    </div>
  );
}
