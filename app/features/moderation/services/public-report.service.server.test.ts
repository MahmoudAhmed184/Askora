import { describe, expect, it } from "vitest";

import type { CurrentSessionSummary } from "~/features/auth/services/auth.service.server";
import {
  submitPublicContentReport,
  type NewPublicContentReport,
  type PublicReportStore,
} from "~/features/moderation/services/public-report.service.server";
import type {
  RateLimitDecision,
  RateLimitOptions,
} from "~/lib/rate-limit.server";

const now = new Date("2026-06-01T12:00:00.000Z");

describe("submitPublicContentReport", () => {
  it("creates a report for a visible public answer", async () => {
    const store = createStore();

    const result = await submitReport({
      store: store.store,
      targetType: "thread_item",
      targetId: "titem_public_1",
    });

    expect(result).toMatchObject({ status: "created", targetType: "thread_item" });
    expect(store.created).toEqual([
      expect.objectContaining({
        reporterUserId: "user_1",
        reporterProfileId: "profile_1",
        targetType: "thread_item",
        targetId: "thread_item_1",
        reason: "harassment",
      }),
    ]);
  });

  it("creates a report for an active public profile", async () => {
    const store = createStore();

    const result = await submitReport({
      store: store.store,
      targetType: "profile",
      targetId: "person",
    });

    expect(result).toMatchObject({ status: "created", targetType: "profile" });
    expect(store.created[0]).toMatchObject({
      targetType: "profile",
      targetId: "profile_1",
    });
  });

  it.each([
    [anonymousSession, "login_required"],
    [suspendedSession, "suspended"],
  ] as const)("rejects a %s reporter", async (session, reason) => {
    const store = createStore();

    await expect(
      submitPublicContentReport({
        formData: createReportFormData(),
        now,
        session,
        store: store.store,
      }),
    ).resolves.toMatchObject({ status: "denied", reason });
    expect(store.created).toEqual([]);
  });

  it("rejects an unavailable public target", async () => {
    const store = createStore({
      threadItem: { ...createStore().threadItem, status: "unpublished" },
    });

    await expect(
      submitReport({ store: store.store, targetType: "thread_item" }),
    ).resolves.toMatchObject({ status: "denied", reason: "unavailable" });
    expect(store.created).toEqual([]);
  });

  it("returns a safe duplicate result when the open-report constraint wins", async () => {
    const store = createStore();
    const duplicateStore: PublicReportStore = {
      ...store.store,
      createReport: () => Promise.resolve(false),
    };

    await expect(
      submitReport({ store: duplicateStore }),
    ).resolves.toMatchObject({ status: "denied", reason: "already_reported" });
  });

  it("enforces the per-account daily report limit before insertion", async () => {
    const store = createStore();
    const rateLimiter = (
      _options: RateLimitOptions,
    ): Promise<RateLimitDecision> =>
      Promise.resolve({ allowed: false, retryAfterSeconds: 900 });

    await expect(
      submitReport({ rateLimiter, store: store.store }),
    ).resolves.toMatchObject({ status: "denied", reason: "rate_limited" });
    expect(store.created).toEqual([]);
  });
});

async function submitReport({
  store,
  targetType,
  targetId = targetType === "profile" ? "person" : "titem_public_1",
  rateLimiter,
}: {
  store: PublicReportStore;
  targetType?: "thread_item" | "profile";
  targetId?: string;
  rateLimiter?: (options: RateLimitOptions) => Promise<RateLimitDecision>;
}) {
  return submitPublicContentReport({
    formData: createReportFormData({
      targetType: targetType ?? "thread_item",
      targetId,
    }),
    now,
    session: completedSession,
    store,
    ...(rateLimiter === undefined ? {} : { rateLimiter }),
  });
}

function createReportFormData({
  targetType = "thread_item",
  targetId = "titem_public_1",
}: {
  targetType?: "thread_item" | "profile";
  targetId?: string;
} = {}) {
  const formData = new FormData();
  formData.set("targetType", targetType);
  formData.set("targetId", targetId);
  formData.set("reason", "harassment");
  formData.set("details", "Repeated personal attacks.");
  return formData;
}

function createStore(overrides: Partial<ReturnType<typeof createStoreData>> = {}) {
  const data = { ...createStoreData(), ...overrides };
  const created: NewPublicContentReport[] = [];
  const store: PublicReportStore = {
    findProfileByUsername: () => Promise.resolve(data.profile),
    findThreadItemByPublicId: () => Promise.resolve(data.threadItem),
    createReport: (report) => {
      created.push(report);
      return Promise.resolve(true);
    },
  };

  return { created, store, ...data };
}

function createStoreData() {
  return {
    threadItem: {
      id: "thread_item_1",
      status: "published" as "draft" | "published" | "unpublished" | "deleted",
      threadStatus: "published" as "draft" | "published" | "unpublished" | "deleted",
      deletedAt: null,
      ownerIsActive: true,
      ownerUserDeletedAt: null,
    },
    profile: {
      id: "profile_1",
      isActive: true,
      userDeletedAt: null,
    },
  };
}

const completedSession = {
  status: "authenticated",
  profileStatus: "complete",
  suspensionStatus: "none",
  user: {
    id: "user_1",
    email: "reporter@example.com",
    name: "Reporter",
    image: undefined,
  },
  profile: {
    id: "profile_1",
    username: "reporter",
    displayName: "Reporter",
    avatarUrl: null,
  },
} satisfies CurrentSessionSummary;

const suspendedSession = {
  ...completedSession,
  suspensionStatus: "active",
} satisfies CurrentSessionSummary;

const anonymousSession = { status: "anonymous" } satisfies CurrentSessionSummary;
