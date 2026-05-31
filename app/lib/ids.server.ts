import { randomBytes, randomUUID } from "node:crypto";

export function createDatabaseId() {
  return randomUUID();
}

export function createPublicId(prefix: string, byteLength = 12) {
  return `${prefix}_${randomBytes(byteLength).toString("base64url")}`;
}
