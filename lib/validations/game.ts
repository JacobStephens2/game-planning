import { z } from "zod";

// Mirrors the legacy Game::validate(): the only rule is a non-blank title;
// description is fully optional. Message matches the PHP string exactly.
export const gameCreateSchema = z.object({
  title: z.string().min(1, "Title cannot be blank."),
  description: z.string().optional(),
});

// Update has the same shape (title required, description optional).
export const gameUpdateSchema = gameCreateSchema;

export type GameCreateInput = z.infer<typeof gameCreateSchema>;
export type GameUpdateInput = z.infer<typeof gameUpdateSchema>;
