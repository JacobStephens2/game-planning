import { z } from "zod";

// A "plan for an event": a name, an optional date, optional notes, and the set
// of games to bring (ids of games from the user's library).
export const eventCreateSchema = z.object({
  name: z.string().min(1, "Event name cannot be blank."),
  eventDate: z.string().optional(), // yyyy-mm-dd from <input type="date">
  notes: z.string().optional(),
  gameIds: z.array(z.string()).optional(),
});

export const eventUpdateSchema = eventCreateSchema;

export type EventCreateInput = z.infer<typeof eventCreateSchema>;
export type EventUpdateInput = z.infer<typeof eventUpdateSchema>;
