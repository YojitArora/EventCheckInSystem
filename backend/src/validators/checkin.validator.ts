import { z } from "zod";

export const createCheckInSchema = z
  .object({
    token: z.string().trim().min(1, "QR token is required").optional(),
    rawToken: z.string().trim().min(1, "QR token is required").optional(),
  })
  .refine((data) => Boolean(data.token || data.rawToken), {
    message: "QR token must be provided (either 'token' or 'rawToken')",
  })
  .transform((data) => ({
    token: (data.token || data.rawToken) as string,
  }));

export const syncCheckInSchema = z.object({
  deviceId: z.string().trim().min(1, "Device ID is required"),
  clientScanId: z.string().trim().min(1, "Client scan ID is required"),
  token: z.string().trim().min(1, "QR token is required"),
  scannedAt: z.coerce.date({ invalid_type_error: "Invalid scannedAt date format" }),
});

export type CreateCheckInInput = z.infer<typeof createCheckInSchema>;
export type SyncCheckInInput = z.infer<typeof syncCheckInSchema>;
