import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { EventForm } from "@/components/forms/EventForm";

export default async function NewEventPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const games = await db.game.findMany({
    where: { userId: session.user.id },
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Plan an event</h1>
      <EventForm mode="create" games={games} />
    </div>
  );
}
