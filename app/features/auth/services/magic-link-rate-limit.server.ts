import { hashWithHmacSha256 } from "~/lib/crypto.server";
import {
  checkRateLimit,
  type RateLimitDecision,
  type RateLimitOptions,
} from "~/lib/rate-limit.server";
import { getRequestInfoHashes } from "~/lib/request-info.server";

const MAGIC_LINK_HOURLY_WINDOW_SECONDS = 60 * 60;
const MAGIC_LINK_DAILY_WINDOW_SECONDS = 60 * 60 * 24;
const MAGIC_LINK_EMAIL_HOURLY_MAX = 5;
const MAGIC_LINK_EMAIL_DAILY_MAX = 10;
const MAGIC_LINK_IP_HOURLY_MAX = 20;

export async function checkMagicLinkRateLimit({
  email,
  request,
  rateLimit = checkRateLimit,
}: {
  email: string;
  request: Request;
  rateLimit?: (options: RateLimitOptions) => Promise<RateLimitDecision>;
}) {
  const requestInfo = getRequestInfoHashes(request);
  const emailHash = hashWithHmacSha256(email, "magic-link-email");
  const hourlyEmailDecision = await rateLimit({
    key: `magic-link:email:${emailHash}:hourly`,
    max: MAGIC_LINK_EMAIL_HOURLY_MAX,
    windowSeconds: MAGIC_LINK_HOURLY_WINDOW_SECONDS,
  });

  if (!hourlyEmailDecision.allowed) {
    return hourlyEmailDecision;
  }

  const dailyEmailDecision = await rateLimit({
    key: `magic-link:email:${emailHash}:daily`,
    max: MAGIC_LINK_EMAIL_DAILY_MAX,
    windowSeconds: MAGIC_LINK_DAILY_WINDOW_SECONDS,
  });

  if (!dailyEmailDecision.allowed) {
    return dailyEmailDecision;
  }

  return rateLimit({
    key: `magic-link:ip:${requestInfo.ipHash}:hourly`,
    max: MAGIC_LINK_IP_HOURLY_MAX,
    windowSeconds: MAGIC_LINK_HOURLY_WINDOW_SECONDS,
  });
}
