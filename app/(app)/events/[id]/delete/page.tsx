import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DeleteEventForm } from "@/components/forms/DeleteEventForm";

export default async function DeleteEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const event = await db.event.findUnique({ where: { id } });
  if (!event) notFound();
  if (event.userId !== session.user.id) {
    return <p className="text-destructive">You do not have permission to delete this event</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Delete event</h1>
      <p>
        Are you sure you want to delete <strong>{event.name}</strong>? This cannot be undone.
        (Your games are not deleted — only this event plan.)
      </p>
      <DeleteEventForm id={event.id} />
    </div>
  );
}
