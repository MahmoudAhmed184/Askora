import { index, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { authUsers } from "~/db/schema/auth";

export const waitlistStatusEnum = pgEnum("waitlist_status", [
  "pending",
  "invited",
  "dismissed",
]);

export const inviteCodes = pgTable(
  "invite_codes",
  {
    id: text("id").primaryKey(),
    codeHash: text("code_hash").notNull(),
    usedByUserId: text("used_by_user_id").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    usedAt: timestamp("used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("invite_codes_code_hash_unique").on(table.codeHash),
    index("invite_codes_used_by_user_id_idx").on(table.usedByUserId),
  ],
);

export const waitlistEntries = pgTable(
  "waitlist_entries",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    status: waitlistStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("waitlist_entries_email_unique").on(table.email),
    index("waitlist_entries_status_idx").on(table.status),
  ],
);
