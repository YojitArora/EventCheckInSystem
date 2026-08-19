import { z } from "zod";

export const registrationParamSchema = z.object({
  eventId: z.string().uuid("Invalid event ID format"),
});

export type RegistrationParam = z.infer<typeof registrationParamSchema>;
