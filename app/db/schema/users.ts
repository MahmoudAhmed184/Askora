import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);

export const suspensionStatusEnum = pgEnum("suspension_status", [
  "warned",
  "suspended",
  "permanent",
]);
