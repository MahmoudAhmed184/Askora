import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { serverEnv, type ServerEnv } from "~/lib/env.server";

export const DEVELOPMENT_AUTH_SECRET =
  "development-only-better-auth-secret-change-before-production";

const SEALED_COOKIE_VERSION = "v1";
const SEALED_COOKIE_SEPARATOR = ".";

export function getServerAuthSecret(
  environment: Pick<ServerEnv, "BETTER_AUTH_SECRET"> = serverEnv,
) {
  return environment.BETTER_AUTH_SECRET ?? DEVELOPMENT_AUTH_SECRET;
}

export function hashWithHmacSha256(value: string, purpose: string) {
  return createHmac("sha256", getServerAuthSecret())
    .update(purpose)
    .update("\0")
    .update(value)
    .digest("hex");
}

export function isEqualDigest(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function sealJsonForCookie(value: unknown, purpose: string) {
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    getSealedCookieKey(purpose),
    initializationVector,
  );
  cipher.setAAD(getSealedCookieAdditionalData(purpose));

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  const authenticationTag = cipher.getAuthTag();

  return [
    SEALED_COOKIE_VERSION,
    initializationVector.toString("base64url"),
    authenticationTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(SEALED_COOKIE_SEPARATOR);
}

export function unsealJsonFromCookie(sealedValue: string, purpose: string) {
  const [version, initializationVector, authenticationTag, encrypted] =
    sealedValue.split(SEALED_COOKIE_SEPARATOR);

  if (
    version !== SEALED_COOKIE_VERSION ||
    initializationVector === undefined ||
    authenticationTag === undefined ||
    encrypted === undefined
  ) {
    return undefined;
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getSealedCookieKey(purpose),
      Buffer.from(initializationVector, "base64url"),
    );
    decipher.setAAD(getSealedCookieAdditionalData(purpose));
    decipher.setAuthTag(Buffer.from(authenticationTag, "base64url"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64url")),
      decipher.final(),
    ]);

    return JSON.parse(decrypted.toString("utf8")) as unknown;
  } catch {
    return undefined;
  }
}

function getSealedCookieKey(purpose: string) {
  return createHash("sha256")
    .update(getServerAuthSecret())
    .update("\0")
    .update(purpose)
    .digest();
}

function getSealedCookieAdditionalData(purpose: string) {
  return Buffer.from(`askora:${purpose}:${SEALED_COOKIE_VERSION}`);
}
