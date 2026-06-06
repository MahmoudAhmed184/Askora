import { z } from "zod";

export const notificationActionIntentValues = [
  "mark_read",
  "mark_all_read",
] as const;

export const notificationActionSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("mark_read"),
    notificationId: z.string().trim().min(1, "Notification is required."),
    redirectTo: z.literal("notifications").optional(),
  }),
  z.object({
    intent: z.literal("mark_all_read"),
  }),
]);

export type NotificationActionSubmission = z.infer<
  typeof notificationActionSchema
>;
export type NotificationActionIntent =
  (typeof notificationActionIntentValues)[number];
