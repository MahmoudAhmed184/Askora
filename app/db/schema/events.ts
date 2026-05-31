import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { authUsers } from "~/db/schema/auth";

export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    profileId: text("profile_id"),
    anonymousEventId: text("anonymous_event_id"),
    type: text("type").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("events_user_id_idx").on(table.userId),
    index("events_profile_id_idx").on(table.profileId),
    index("events_type_created_at_idx").on(table.type, table.createdAt),
  ],
);
