import { z } from "zod";

export const aiInsightSchema = z.object({
  eventId: z.string().uuid("Invalid event ID format"),
  question: z
    .string()
    .trim()
    .min(3, "Question must be at least 3 characters long")
    .max(500, "Question must not exceed 500 characters"),
});

export type AIInsightInput = z.infer<typeof aiInsightSchema>;
