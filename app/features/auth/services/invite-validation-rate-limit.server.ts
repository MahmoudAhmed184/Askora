import {
  checkRateLimit,
  type RateLimitDecision,
  type RateLimitOptions,
} from "~/lib/rate-limit.server";
import { getRequestInfoHashes } from "~/lib/request-info.server";

const INVITE_VALIDATION_WINDOW_SECONDS = 15 * 60;
const INVITE_VALIDATION_IP_MAX = 20;

export async function checkInviteValidationRateLimit({
  inviteCode,
  rateLimit = checkRateLimit,
  request,
}: {
  inviteCode: string | undefined;
  request: Request;
  rateLimit?: (options: RateLimitOptions) => Promise<RateLimitDecision>;
}) {
  if (inviteCode === undefined || inviteCode.trim().length === 0) {
    return { allowed: true } as const;
  }

  const requestInfo = getRequestInfoHashes(request);

  return rateLimit({
    key: `invite-validation:ip:${requestInfo.ipHash}`,
    max: INVITE_VALIDATION_IP_MAX,
    windowSeconds: INVITE_VALIDATION_WINDOW_SECONDS,
  });
}
