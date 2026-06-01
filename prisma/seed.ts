import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

// Seeds one test user (bcrypt-hashed password, compatible with the legacy
// PHP PASSWORD_BCRYPT hashes) and two games owned by that user.
// Idempotent: upserts the user and resets their games on each run.
async function main() {
  const email = "test@example.com";
  const hashedPassword = await bcrypt.hash("password123", 10);

  const user = await db.user.upsert({
    where: { email },
    update: { hashedPassword },
    create: { email, hashedPassword },
  });

  await db.game.deleteMany({ where: { userId: user.id } });
  await db.game.createMany({
    data: [
      {
        title: "Capture the Flag",
        description: "Two teams, two flags, one field. First to steal the other's flag wins.",
        userId: user.id,
      },
      {
        title: "Scavenger Hunt",
        description: "Teams race to find every item on a shared list before time runs out.",
        userId: user.id,
      },
    ],
  });

  console.log(`Seeded ${user.email} with 2 games.`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
