import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEventDate } from "@/lib/format";

export default async function EventsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const events = await db.event.findMany({
    where: { userId: session.user.id },
    orderBy: [{ eventDate: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { games: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your events</h1>
        <Link href="/events/new" className={buttonVariants()}>
          Plan an event
        </Link>
      </div>

      {events.length === 0 ? (
        <p className="text-muted-foreground">
          No events yet — plan one and pick which games to bring.
        </p>
      ) : (
        <ul className="space-y-3">
          {events.map((event) => {
            const date = formatEventDate(event.eventDate);
            const count = event._count.games;
            return (
              <li key={event.id}>
                <Link href={`/events/${event.id}`} className="block">
                  <Card className="transition-colors hover:bg-muted/50">
                    <CardHeader>
                      <CardTitle>{event.name}</CardTitle>
                      <CardDescription>
                        {date ? `${date} · ` : ""}
                        {count} {count === 1 ? "game" : "games"} to bring
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
