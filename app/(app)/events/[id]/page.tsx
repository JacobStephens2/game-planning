import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { buttonVariants } from "@/components/ui/button";
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
    include: { games: { orderBy: { title: "asc" } } },
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
        <h2 className="text-sm font-medium">Games to bring</h2>
        {event.games.length === 0 ? (
          <p className="text-muted-foreground">No games selected for this event yet.</p>
        ) : (
          <ul className="list-inside list-disc space-y-1">
            {event.games.map((game) => (
              <li key={game.id}>
                <Link href={`/games/${game.id}`} className="underline underline-offset-4">
                  {game.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link href="/events" className={buttonVariants({ variant: "link", className: "px-0" })}>
        ← Back to events
      </Link>
    </div>
  );
}
