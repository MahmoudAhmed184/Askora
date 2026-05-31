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
  lastRequestAtMilliseconds: number;
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
        count: sql<number>`case when ${authRateLimits.lastRequest} < ${resetBeforeMilliseconds} then 1 else ${authRateLimits.count} + 1 end`,
        lastRequest: now,
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
    lastRequestAtMilliseconds: counter.lastRequest,
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
    lastRequestAtMilliseconds: nextCounter.lastRequestAtMilliseconds,
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
    now - existingCounter.lastRequestAtMilliseconds > windowMilliseconds
  ) {
    return {
      count: 1,
      lastRequestAtMilliseconds: now,
    };
  }

  return {
    count: existingCounter.count + 1,
    lastRequestAtMilliseconds: now,
  };
}

function getRateLimitDecision({
  count,
  lastRequestAtMilliseconds,
  max,
  now,
  windowMilliseconds,
}: {
  count: number;
  lastRequestAtMilliseconds: number;
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
      Math.ceil((lastRequestAtMilliseconds + windowMilliseconds - now) / 1000),
    ),
  };
}
