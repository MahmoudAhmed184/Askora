import { z } from "zod";

import {
  sealJsonForCookie,
  unsealJsonFromCookie,
} from "~/lib/crypto.server";
import { serverEnv } from "~/lib/env.server";

const SETUP_SHARE_ACCESS_COOKIE_NAME = "askora_setup_share_access";
const SETUP_SHARE_ACCESS_COOKIE_PURPOSE = "setup-share-access";
const SETUP_SHARE_ACCESS_COOKIE_MAX_AGE_SECONDS = 5 * 60;

const setupShareAccessSchema = z.object({
  profileId: z.string().min(1),
});

export function createSetupShareAccessCookieHeader(profileId: string) {
  const value = sealJsonForCookie(
    { profileId },
    SETUP_SHARE_ACCESS_COOKIE_PURPOSE,
  );

  return serializeSetupShareAccessCookie(
    value,
    SETUP_SHARE_ACCESS_COOKIE_MAX_AGE_SECONDS,
  );
}

export function clearSetupShareAccessCookieHeader() {
  return serializeSetupShareAccessCookie("", 0);
}

export function hasSetupShareAccess({
  profileId,
  request,
}: {
  profileId: string;
  request: Request;
}) {
  const cookieValue = getCookieValue(
    request.headers.get("cookie"),
    SETUP_SHARE_ACCESS_COOKIE_NAME,
  );

  if (cookieValue === undefined) {
    return false;
  }

  const unsealed = unsealJsonFromCookie(
    cookieValue,
    SETUP_SHARE_ACCESS_COOKIE_PURPOSE,
  );
  const parsed = setupShareAccessSchema.safeParse(unsealed);

  return parsed.success && parsed.data.profileId === profileId;
}

function serializeSetupShareAccessCookie(
  value: string,
  maxAgeSeconds: number,
) {
  const cookieParts = [
    `${SETUP_SHARE_ACCESS_COOKIE_NAME}=${value}`,
    "Path=/setup/share",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${String(maxAgeSeconds)}`,
  ];

  if (serverEnv.NODE_ENV === "production") {
    cookieParts.push("Secure");
  }

  return cookieParts.join("; ");
}

function getCookieValue(cookieHeader: string | null, cookieName: string) {
  if (cookieHeader === null) {
    return undefined;
  }

  for (const cookie of cookieHeader.split(";")) {
    const [name, ...valueParts] = cookie.trim().split("=");

    if (name === cookieName) {
      return valueParts.join("=");
    }
  }

  return undefined;
}
