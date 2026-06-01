-- Convert the implicit _EventGames m-n into an explicit join table that also
-- carries a per-game `packed` flag (packing-list state). Existing relations are
-- copied over before the old table is dropped, so no event data is lost.

-- CreateTable
CREATE TABLE "event_games" (
    "eventId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "packed" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "event_games_pkey" PRIMARY KEY ("eventId", "gameId")
);

-- Preserve existing rows (A = event id, B = game id in the implicit table)
INSERT INTO "event_games" ("eventId", "gameId", "packed")
SELECT "A", "B", false FROM "_EventGames";

-- DropTable (implicit join, now replaced)
DROP TABLE "_EventGames";

-- AddForeignKey
ALTER TABLE "event_games" ADD CONSTRAINT "event_games_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_games" ADD CONSTRAINT "event_games_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
