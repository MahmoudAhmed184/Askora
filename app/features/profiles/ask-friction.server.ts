import { z } from "zod";

import {
  sealJsonForCookie,
  unsealJsonFromCookie,
} from "~/lib/crypto.server";
import { serverEnv } from "~/lib/env.server";

export const PUBLIC_ASK_FLASH_COOKIE_NAME = "qna_public_ask_flash";
export const ASK_MINIMUM_SUBMIT_MILLISECONDS = 1_500;
export const ASK_TIMING_TOKEN_MAX_AGE_MILLISECONDS = 60 * 60 * 1000;

const ASK_FLASH_COOKIE_PURPOSE = "public-ask-flash";
const ASK_FLASH_COOKIE_MAX_AGE_SECONDS = 120;
const ASK_TIMING_TOKEN_PURPOSE = "public-ask-timing";

const askTimingTokenSchema = z.object({
  profileId: z.string().min(1),
  username: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
});

const publicAskFlashSchema = z.object({
  username: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
  result: z.union([
    z.object({
      status: z.literal("success"),
      message: z.string().min(1),
      prompt: z.string().optional(),
    }),
    z.object({
      status: z.literal("error"),
      fieldErrors: z
        .object({
          question: z.string().optional(),
          identityMode: z.string().optional(),
          timingToken: z.string().optional(),
        })
        .optional(),
      formError: z.string().optional(),
      values: z.object({
        question: z.string(),
        identityMode: z.enum(["anonymous", "attributed"]),
      }),
    }),
  ]),
});

export type AskTimingToken = z.infer<typeof askTimingTokenSchema>;
export type PublicAskFlash = z.infer<typeof publicAskFlashSchema>["result"];

export type AskTimingTokenDecision =
  | {
      status: "valid";
    }
  | {
      status: "invalid";
      reason: "missing" | "malformed" | "mismatch" | "expired" | "too_fast";
    };

export function createAskTimingToken({
  now = new Date(),
  profileId,
  username,
}: {
  profileId: string;
  username: string;
  now?: Date;
}) {
  return sealJsonForCookie(
    {
      profileId,
      username,
      createdAt: now.getTime(),
    } satisfies AskTimingToken,
    ASK_TIMING_TOKEN_PURPOSE,
  );
}

export function validateAskTimingToken({
  minimumSubmitMilliseconds = ASK_MINIMUM_SUBMIT_MILLISECONDS,
  now = new Date(),
  profileId,
  token,
  username,
}: {
  token: string | undefined;
  profileId: string;
  username: string;
  now?: Date | undefined;
  minimumSubmitMilliseconds?: number | undefined;
}): AskTimingTokenDecision {
  if (token === undefined || token.trim().length === 0) {
    return { status: "invalid", reason: "missing" };
  }

  const parsed = parseAskTimingToken(token);

  if (parsed === undefined) {
    return { status: "invalid", reason: "malformed" };
  }

  if (parsed.profileId !== profileId || parsed.username !== username) {
    return { status: "invalid", reason: "mismatch" };
  }

  const ageMilliseconds = now.getTime() - parsed.createdAt;

  if (ageMilliseconds > ASK_TIMING_TOKEN_MAX_AGE_MILLISECONDS) {
    return { status: "invalid", reason: "expired" };
  }

  if (ageMilliseconds < minimumSubmitMilliseconds) {
    return { status: "invalid", reason: "too_fast" };
  }

  return { status: "valid" };
}

export function createPublicAskFlashCookieHeader({
  result,
  username,
}: {
  username: string;
  result: PublicAskFlash;
}) {
  const value = sealJsonForCookie(
    {
      username,
      result,
      createdAt: Date.now(),
    },
    ASK_FLASH_COOKIE_PURPOSE,
  );

  return serializePublicAskFlashCookie(value, ASK_FLASH_COOKIE_MAX_AGE_SECONDS);
}

export function clearPublicAskFlashCookieHeader() {
  return serializePublicAskFlashCookie("", 0);
}

export function readPublicAskFlashFromRequest(request: Request, username: string) {
  const cookieValue = getCookieValue(
    request.headers.get("cookie"),
    PUBLIC_ASK_FLASH_COOKIE_NAME,
  );

  if (cookieValue === undefined) {
    return undefined;
  }

  const unsealed = unsealJsonFromCookie(cookieValue, ASK_FLASH_COOKIE_PURPOSE);
  const parsed = publicAskFlashSchema.safeParse(unsealed);

  if (!parsed.success || parsed.data.username !== username) {
    return undefined;
  }

  return parsed.data.result;
}

export function hasPublicAskFlashCookie(request: Request) {
  return (
    getCookieValue(
      request.headers.get("cookie"),
      PUBLIC_ASK_FLASH_COOKIE_NAME,
    ) !== undefined
  );
}

function parseAskTimingToken(token: string) {
  const unsealed = unsealJsonFromCookie(token, ASK_TIMING_TOKEN_PURPOSE);
  const parsed = askTimingTokenSchema.safeParse(unsealed);

  return parsed.success ? parsed.data : undefined;
}

function serializePublicAskFlashCookie(value: string, maxAgeSeconds: number) {
  const cookieParts = [
    `${PUBLIC_ASK_FLASH_COOKIE_NAME}=${value}`,
    "Path=/",
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
