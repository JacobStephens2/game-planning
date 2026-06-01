import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { buttonVariants } from "@/components/ui/button";

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const game = await db.game.findUnique({ where: { id } });
  if (!game) notFound(); // legacy 404: "No game is associated with the provided id"
  if (game.userId !== session.user.id) {
    return <p className="text-destructive">You do not have permission to view this game</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold">{game.title}</h1>
        <div className="flex shrink-0 gap-2">
          <Link href={`/games/${game.id}/edit`} className={buttonVariants({ variant: "outline" })}>
            Edit
          </Link>
          <Link
            href={`/games/${game.id}/delete`}
            className={buttonVariants({ variant: "destructive" })}
          >
            Delete
          </Link>
        </div>
      </div>

      {game.description ? (
        <p className="whitespace-pre-wrap text-muted-foreground">{game.description}</p>
      ) : (
        <p className="italic text-muted-foreground">No description.</p>
      )}

      <Link href="/games" className={buttonVariants({ variant: "link", className: "px-0" })}>
        ← Back to games
      </Link>
    </div>
  );
}
