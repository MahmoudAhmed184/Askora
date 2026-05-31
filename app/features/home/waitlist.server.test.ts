import { describe, expect, it } from "vitest";

import {
  submitWaitlistEntry,
  type WaitlistStore,
} from "~/features/home/waitlist.server";
import { waitlistSubmissionSchema } from "~/features/home/waitlist.schema";
import type { RateLimitDecision, RateLimitOptions } from "~/lib/rate-limit.server";

describe("waitlistSubmissionSchema", () => {
  it("rejects invalid email", () => {
    const parsed = waitlistSubmissionSchema.safeParse({ email: "not-email" });

    expect(parsed.success).toBe(false);
  });

  it("normalizes email before insert", async () => {
    const parsed = waitlistSubmissionSchema.parse({
      email: "  PERSON@Example.COM  ",
    });
    const waitlist = createFakeWaitlistStore();

    await submitWaitlistEntry({
      email: parsed.email,
      request: createRequest(),
      store: waitlist.store,
      rateLimit: allowRateLimit,
    });

    expect(waitlist.emails).toEqual(["person@example.com"]);
  });
});

describe("submitWaitlistEntry", () => {
  it("returns the same success response for duplicates", async () => {
    const waitlist = createFakeWaitlistStore();

    const first = await submitWaitlistEntry({
      email: "person@example.com",
      request: createRequest(),
      store: waitlist.store,
      rateLimit: allowRateLimit,
    });
    const second = await submitWaitlistEntry({
      email: "person@example.com",
      request: createRequest(),
      store: waitlist.store,
      rateLimit: allowRateLimit,
    });

    expect(second).toEqual(first);
    expect(waitlist.emails).toEqual(["person@example.com"]);
  });

  it("does not leak email existence in response copy", async () => {
    const waitlist = createFakeWaitlistStore();

    const result = await submitWaitlistEntry({
      email: "person@example.com",
      request: createRequest(),
      store: waitlist.store,
      rateLimit: allowRateLimit,
    });

    expect(result.message).not.toMatch(/already|exists|duplicate/i);
  });
});

function createFakeWaitlistStore() {
  const emails: string[] = [];
  const events: unknown[] = [];

  const store: WaitlistStore = {
    insertEmail(email) {
      if (!emails.includes(email)) {
        emails.push(email);
      }

      return Promise.resolve();
    },
    recordSubmission(event) {
      events.push(event);

      return Promise.resolve();
    },
  };

  return {
    emails,
    events,
    store,
  };
}

function allowRateLimit(
  _options: RateLimitOptions,
): Promise<RateLimitDecision> {
  return Promise.resolve({ allowed: true });
}

function createRequest() {
  return new Request("https://app.example.com/", {
    headers: {
      "user-agent": "vitest",
      "x-forwarded-for": "203.0.113.10",
    },
  });
}
