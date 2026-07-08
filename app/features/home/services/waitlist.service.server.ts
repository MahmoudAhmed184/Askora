import { waitlistEntries, events } from "~/db/schema";
import { getRuntimeDatabase, type RuntimeDatabase } from "~/db/client.server";
import { createDatabaseId } from "~/lib/ids.server";
import { hashWithHmacSha256 } from "~/lib/crypto.server";
import { getRequestInfoHashes } from "~/lib/request-info.server";
import {
  checkRateLimit,
  type RateLimitDecision,
  type RateLimitOptions,
} from "~/lib/rate-limit.server";

const WAITLIST_RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const WAITLIST_EMAIL_RATE_LIMIT_MAX = 3;
const WAITLIST_IP_RATE_LIMIT_MAX = 12;

export type WaitlistSubmissionResult =
  | {
      status: "submitted";
      message: string;
    }
  | {
      status: "rate_limited";
      message: string;
      retryAfterSeconds: number;
    };

export interface WaitlistStore {
  insertEmail(email: string): Promise<void>;
  recordSubmission(event: WaitlistSubmissionEvent): Promise<void>;
}

interface WaitlistSubmissionEvent {
  emailHash: string;
  fingerprintHash: string;
}

interface SubmitWaitlistOptions {
  email: string;
  request: Request;
  store?: WaitlistStore;
  rateLimit?: (options: RateLimitOptions) => Promise<RateLimitDecision>;
}

const waitlistSuccessMessage =
  "Request received. We use the waitlist to prioritize invites; it does not create an account.";

export async function submitWaitlistEntry({
  email,
  request,
  store = createDrizzleWaitlistStore(),
  rateLimit = checkRateLimit,
}: SubmitWaitlistOptions): Promise<WaitlistSubmissionResult> {
  const requestInfo = getRequestInfoHashes(request);
  const emailHash = hashWithHmacSha256(email, "waitlist-email");
  const rateLimitDecision = await checkWaitlistRateLimit({
    emailHash,
    ipHash: requestInfo.ipHash,
    rateLimit,
  });

  if (!rateLimitDecision.allowed) {
    return {
      status: "rate_limited",
      message: "Too many requests. Try again later.",
      retryAfterSeconds: rateLimitDecision.retryAfterSeconds,
    };
  }

  await store.insertEmail(email);
  await store.recordSubmission({
    emailHash,
    fingerprintHash: requestInfo.fingerprintHash,
  });

  return {
    status: "submitted",
    message: waitlistSuccessMessage,
  };
}

export function createDrizzleWaitlistStore(
  database: RuntimeDatabase = getRuntimeDatabase(),
): WaitlistStore {
  return {
    async insertEmail(email) {
      await database
        .insert(waitlistEntries)
        .values({
          id: createDatabaseId(),
          email,
        })
        .onConflictDoNothing({
          target: waitlistEntries.email,
        });
    },
    async recordSubmission({ emailHash, fingerprintHash }) {
      await database.insert(events).values({
        id: createDatabaseId(),
        anonymousEventId: fingerprintHash,
        type: "waitlist_submitted",
        metadata: {
          emailHash,
        },
      });
    },
  };
}

async function checkWaitlistRateLimit({
  emailHash,
  ipHash,
  rateLimit,
}: {
  emailHash: string;
  ipHash: string;
  rateLimit: (options: RateLimitOptions) => Promise<RateLimitDecision>;
}) {
  const emailDecision = await rateLimit({
    key: `waitlist:email:${emailHash}`,
    max: WAITLIST_EMAIL_RATE_LIMIT_MAX,
    windowSeconds: WAITLIST_RATE_LIMIT_WINDOW_SECONDS,
  });

  if (!emailDecision.allowed) {
    return emailDecision;
  }

  return rateLimit({
    key: `waitlist:ip:${ipHash}`,
    max: WAITLIST_IP_RATE_LIMIT_MAX,
    windowSeconds: WAITLIST_RATE_LIMIT_WINDOW_SECONDS,
  });
}
