import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { GameForm } from "@/components/forms/GameForm";

export default async function EditGamePage({
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
    return <p className="text-destructive">You do not have permission to update this game</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit game</h1>
      <GameForm
        mode="edit"
        game={{ id: game.id, title: game.title, description: game.description }}
      />
    </div>
  );
}
