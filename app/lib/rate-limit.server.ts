import { sql } from "drizzle-orm";

import { getRuntimeDatabase, type RuntimeDatabase } from "~/db/client.server";
import { authRateLimits } from "~/db/schema";
import { serverEnv } from "~/lib/env.server";
import { createDatabaseId } from "~/lib/ids.server";

export interface RateLimitOptions {
  key: string;
  max: number;
  windowSeconds: number;
  database?: RuntimeDatabase;
  now?: () => number;
  storage?: "database" | "memory";
}

export type RateLimitDecision =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      retryAfterSeconds: number;
    };

interface MemoryCounter {
  count: number;
  windowStartedAtMilliseconds: number;
}

const memoryCounters = new Map<string, MemoryCounter>();

export async function checkRateLimit(
  options: RateLimitOptions,
): Promise<RateLimitDecision> {
  const now = options.now?.() ?? Date.now();

  if (shouldUseDatabase(options)) {
    try {
      return await checkDatabaseRateLimit(options, now);
    } catch (error) {
      if (serverEnv.NODE_ENV === "production") {
        throw error;
      }
    }
  }

  return checkMemoryRateLimit(options, now);
}

export function clearMemoryRateLimits() {
  memoryCounters.clear();
}

function shouldUseDatabase(options: RateLimitOptions) {
  if (options.storage === "memory") {
    return false;
  }

  if (options.storage === "database") {
    return true;
  }

  return options.database !== undefined || serverEnv.DATABASE_URL !== undefined;
}

async function checkDatabaseRateLimit(
  options: RateLimitOptions,
  now: number,
): Promise<RateLimitDecision> {
  const database = options.database ?? getRuntimeDatabase();
  const windowMilliseconds = options.windowSeconds * 1000;
  const resetBeforeMilliseconds = now - windowMilliseconds;
  const hasExpiredWindow = sql`${authRateLimits.lastRequest} <= ${resetBeforeMilliseconds}`;
  const [counter] = await database
    .insert(authRateLimits)
    .values({
      id: createDatabaseId(),
      key: options.key,
      count: 1,
      lastRequest: now,
    })
    .onConflictDoUpdate({
      target: authRateLimits.key,
      set: {
        count: sql<number>`case when ${hasExpiredWindow} then 1 else least(${authRateLimits.count} + 1, ${options.max + 1}) end`,
        lastRequest: sql<number>`case when ${hasExpiredWindow} then ${now} else ${authRateLimits.lastRequest} end`,
      },
    })
    .returning({
      count: authRateLimits.count,
      lastRequest: authRateLimits.lastRequest,
    });

  if (counter === undefined) {
    return { allowed: true };
  }

  return getRateLimitDecision({
    count: counter.count,
    windowStartedAtMilliseconds: counter.lastRequest,
    max: options.max,
    now,
    windowMilliseconds,
  });
}

function checkMemoryRateLimit(options: RateLimitOptions, now: number) {
  const windowMilliseconds = options.windowSeconds * 1000;
  const existingCounter = memoryCounters.get(options.key);
  const nextCounter = getNextMemoryCounter({
    existingCounter,
    now,
    windowMilliseconds,
  });

  memoryCounters.set(options.key, nextCounter);

  return getRateLimitDecision({
    count: nextCounter.count,
    windowStartedAtMilliseconds: nextCounter.windowStartedAtMilliseconds,
    max: options.max,
    now,
    windowMilliseconds,
  });
}

function getNextMemoryCounter({
  existingCounter,
  now,
  windowMilliseconds,
}: {
  existingCounter: MemoryCounter | undefined;
  now: number;
  windowMilliseconds: number;
}) {
  if (
    existingCounter === undefined ||
    now - existingCounter.windowStartedAtMilliseconds >= windowMilliseconds
  ) {
    return {
      count: 1,
      windowStartedAtMilliseconds: now,
    };
  }

  return {
    count: Math.min(existingCounter.count + 1, Number.MAX_SAFE_INTEGER),
    windowStartedAtMilliseconds: existingCounter.windowStartedAtMilliseconds,
  };
}

function getRateLimitDecision({
  count,
  windowStartedAtMilliseconds,
  max,
  now,
  windowMilliseconds,
}: {
  count: number;
  windowStartedAtMilliseconds: number;
  max: number;
  now: number;
  windowMilliseconds: number;
}): RateLimitDecision {
  if (count <= max) {
    return { allowed: true };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((windowStartedAtMilliseconds + windowMilliseconds - now) / 1000),
    ),
  };
}
