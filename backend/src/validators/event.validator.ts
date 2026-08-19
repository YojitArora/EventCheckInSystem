import { z } from "zod";

export const eventIdParamSchema = z.object({
  eventId: z.string().uuid("Invalid event ID format"),
});

export const createEventSchema = z.object({
  name: z.string().trim().min(2, "Event name must be at least 2 characters").max(255, "Event name must not exceed 255 characters"),
  date: z.coerce.date({ invalid_type_error: "Invalid date format" }),
  capacity: z.coerce.number().int("Capacity must be an integer").positive("Capacity must be greater than 0"),
});

export const updateEventSchema = z.object({
  name: z.string().trim().min(2, "Event name must be at least 2 characters").max(255, "Event name must not exceed 255 characters").optional(),
  date: z.coerce.date({ invalid_type_error: "Invalid date format" }).optional(),
  capacity: z.coerce.number().int("Capacity must be an integer").positive("Capacity must be greater than 0").optional(),
}).refine(
  (data) => data.name !== undefined || data.date !== undefined || data.capacity !== undefined,
  { message: "At least one field (name, date, capacity) must be provided for update" }
);

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type EventIdParam = z.infer<typeof eventIdParamSchema>;
