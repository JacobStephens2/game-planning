import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function GamesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const games = await db.game.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your games</h1>
        <Link href="/games/new" className={buttonVariants()}>
          New game
        </Link>
      </div>

      {games.length === 0 ? (
        <p className="text-muted-foreground">No games yet — create your first one.</p>
      ) : (
        <ul className="space-y-3">
          {games.map((game) => (
            <li key={game.id}>
              <Link href={`/games/${game.id}`} className="block">
                <Card className="transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <CardTitle>{game.title}</CardTitle>
                    {game.description && (
                      <CardDescription className="line-clamp-2">
                        {game.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
