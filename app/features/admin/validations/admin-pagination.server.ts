import { Buffer } from "node:buffer";

import { z } from "zod";

const serializedAdminReportCursorSchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.string().min(1).max(128),
});

export interface AdminReportCursor {
  createdAt: Date;
  id: string;
}

export function encodeAdminReportCursor(cursor: AdminReportCursor) {
  return Buffer.from(
    JSON.stringify({
      createdAt: cursor.createdAt.toISOString(),
      id: cursor.id,
    }),
    "utf8",
  ).toString("base64url");
}

export function decodeAdminReportCursor(value: string | undefined) {
  if (value === undefined || value.trim().length === 0) {
    return undefined;
  }

  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as unknown;
    const parsed = serializedAdminReportCursorSchema.safeParse(decoded);

    return parsed.success
      ? {
          createdAt: new Date(parsed.data.createdAt),
          id: parsed.data.id,
        }
      : undefined;
  } catch {
    return undefined;
  }
}
