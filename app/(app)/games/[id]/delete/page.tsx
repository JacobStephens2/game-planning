import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DeleteGameForm } from "@/components/forms/DeleteGameForm";

export default async function DeleteGamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const game = await db.game.findUnique({ where: { id } });
  if (!game) notFound();
  if (game.userId !== session.user.id) {
    return <p className="text-destructive">You do not have permission to delete this game</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Delete game</h1>
      <p>
        Are you sure you want to delete <strong>{game.title}</strong>? This cannot be undone.
      </p>
      <DeleteGameForm id={game.id} />
    </div>
  );
}
