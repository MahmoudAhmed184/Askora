import { eq } from "drizzle-orm";
import type { ZodError } from "zod";

import { getRuntimeDatabase, type RuntimeDatabase } from "~/db/client.server";
import {
  authUsers,
  profiles,
  reports,
  threadItems,
  threads,
} from "~/db/schema";
import type { CurrentSessionSummary } from "~/features/auth/services/auth.service.server";
import {
  moderationReportReasonValues,
  type ModerationReportReason,
} from "~/db/schema/moderation-values";
import { optionalReportDetailsSchema } from "~/features/moderation/validations/moderation.validations";
import { createDatabaseId } from "~/lib/ids.server";
import { parseFormData } from "~/lib/zod-form";
import { z } from "zod";
import {
  checkRateLimit,
  type RateLimitDecision,
  type RateLimitOptions,
} from "~/lib/rate-limit.server";

const REPORT_DAILY_MAX = 10;
const DAY_SECONDS = 60 * 60 * 24;

const publicReportTargetTypeValues = ["thread_item", "profile"] as const;

const publicContentReportSchema = z.object({
  targetType: z.enum(publicReportTargetTypeValues, {
    error: "Choose report target.",
  }),
  targetId: z
    .string()
    .trim()
    .min(1, "Choose reported content.")
    .max(100, "Reported content is invalid."),
  reason: z.enum(moderationReportReasonValues, {
    error: "Choose a report reason.",
  }),
  details: optionalReportDetailsSchema,
});

export type PublicReportTargetType = (typeof publicReportTargetTypeValues)[number];

export interface PublicContentReportFormValues {
  targetType: PublicReportTargetType | "unknown";
  targetId: string;
  reason: ModerationReportReason | "unknown";
  details: string;
}

export interface NewPublicContentReport {
  id: string;
  reporterUserId: string;
  reporterProfileId: string;
  targetType: PublicReportTargetType;
  targetId: string;
  reason: ModerationReportReason;
  details: string | undefined;
  status: "open";
  createdAt: Date;
  updatedAt: Date;
}

interface PublicThreadItemReportTarget {
  id: string;
  status: "draft" | "published" | "unpublished" | "deleted";
  threadStatus: "draft" | "published" | "unpublished" | "deleted";
  deletedAt: Date | null;
  ownerIsActive: boolean;
  ownerUserDeletedAt: Date | null;
}

interface PublicProfileReportTarget {
  id: string;
  isActive: boolean;
  userDeletedAt: Date | null;
}

export interface PublicReportStore {
  findThreadItemByPublicId(
    publicId: string,
  ): Promise<PublicThreadItemReportTarget | undefined>;
  findProfileByUsername(
    username: string,
  ): Promise<PublicProfileReportTarget | undefined>;
  createReport(report: NewPublicContentReport): Promise<boolean>;
}

export type PublicContentReportResult =
  | {
      status: "created";
      targetType: PublicReportTargetType;
    }
  | {
      status: "invalid";
      values: PublicContentReportFormValues;
      fieldErrors: Record<string, string>;
      formError: string;
    }
  | {
      status: "denied";
      values: PublicContentReportFormValues;
      reason:
        | "login_required"
        | "profile_required"
        | "suspended"
        | "not_found"
        | "unavailable"
        | "rate_limited"
        | "already_reported";
      formError: string;
    };

export async function submitPublicContentReport({
  createId = createDatabaseId,
  formData,
  now = new Date(),
  session,
  store = createDrizzlePublicReportStore(),
  rateLimiter = checkRateLimit,
}: {
  formData: FormData;
  session: CurrentSessionSummary;
  store?: PublicReportStore;
  createId?: () => string;
  now?: Date;
  rateLimiter?: (options: RateLimitOptions) => Promise<RateLimitDecision>;
}): Promise<PublicContentReportResult> {
  const values = getPublicContentReportFormValues(formData);
  if (session.status === "anonymous") {
    return deniedResult(values, "login_required");
  }

  if (session.profileStatus === "incomplete") {
    return deniedResult(values, "profile_required");
  }

  if (session.suspensionStatus === "active") {
    return deniedResult(values, "suspended");
  }

  const parsed = parseFormData(publicContentReportSchema, formData);

  if (!parsed.ok) {
    return {
      status: "invalid",
      values,
      fieldErrors: getFieldErrors(parsed.error),
      formError: "Check the report details and try again.",
    };
  }

  const target = await findPublicReportTarget({
    form: parsed.value,
    store,
  });

  if (target.status !== "available") {
    return deniedResult(values, target.reason);
  }

  const rateLimit = await rateLimiter({
    key: `reports:profile:${session.profile.id}:daily`,
    max: REPORT_DAILY_MAX,
    windowSeconds: DAY_SECONDS,
  });

  if (!rateLimit.allowed) {
    return deniedResult(values, "rate_limited");
  }

  const created = await store.createReport({
    id: createId(),
    reporterUserId: session.user.id,
    reporterProfileId: session.profile.id,
    targetType: parsed.value.targetType,
    targetId: target.id,
    reason: parsed.value.reason,
    details: parsed.value.details,
    status: "open",
    createdAt: now,
    updatedAt: now,
  });

  if (!created) {
    return deniedResult(values, "already_reported");
  }

  return {
    status: "created",
    targetType: parsed.value.targetType,
  };
}

export function createDrizzlePublicReportStore(
  database: RuntimeDatabase = getRuntimeDatabase(),
): PublicReportStore {
  return {
    async findThreadItemByPublicId(publicId) {
      const [target] = await database
        .select({
          id: threadItems.id,
          status: threadItems.status,
          threadStatus: threads.status,
          deletedAt: threadItems.deletedAt,
          ownerIsActive: profiles.isActive,
          ownerUserDeletedAt: authUsers.deletedAt,
        })
        .from(threadItems)
        .innerJoin(threads, eq(threads.id, threadItems.threadId))
        .innerJoin(profiles, eq(profiles.id, threads.ownerProfileId))
        .leftJoin(authUsers, eq(authUsers.id, profiles.userId))
        .where(eq(threadItems.publicId, publicId))
        .limit(1);

      return target;
    },
    async findProfileByUsername(username) {
      const [target] = await database
        .select({
          id: profiles.id,
          isActive: profiles.isActive,
          userDeletedAt: authUsers.deletedAt,
        })
        .from(profiles)
        .leftJoin(authUsers, eq(authUsers.id, profiles.userId))
        .where(eq(profiles.username, username))
        .limit(1);

      return target;
    },
    async createReport(report) {
      try {
        await database.insert(reports).values(report);
        return true;
      } catch (error) {
        if (isOpenReportUniqueViolation(error)) {
          return false;
        }

        throw error;
      }
    },
  };
}

async function findPublicReportTarget({
  form,
  store,
}: {
  form: z.infer<typeof publicContentReportSchema>;
  store: PublicReportStore;
}): Promise<
  | { status: "available"; id: string }
  | { status: "denied"; reason: "not_found" | "unavailable" }
> {
  if (form.targetType === "thread_item") {
    const target = await store.findThreadItemByPublicId(form.targetId);

    if (target === undefined) {
      return { status: "denied", reason: "not_found" };
    }

    return isVisiblePublicThreadItem(target)
      ? { status: "available", id: target.id }
      : { status: "denied", reason: "unavailable" };
  }

  const target = await store.findProfileByUsername(form.targetId);

  if (target === undefined) {
    return { status: "denied", reason: "not_found" };
  }

  return isAvailablePublicProfile(target)
    ? { status: "available", id: target.id }
    : { status: "denied", reason: "unavailable" };
}

function isVisiblePublicThreadItem(target: PublicThreadItemReportTarget) {
  return (
    target.status === "published" &&
    target.threadStatus === "published" &&
    target.deletedAt === null &&
    target.ownerIsActive &&
    target.ownerUserDeletedAt === null
  );
}

function isAvailablePublicProfile(target: PublicProfileReportTarget) {
  return target.isActive && target.userDeletedAt === null;
}

function getPublicContentReportFormValues(
  formData: FormData,
): PublicContentReportFormValues {
  const targetType = getFormText(formData, "targetType");
  const reason = getFormText(formData, "reason");

  return {
    targetType: publicReportTargetTypeValues.includes(
      targetType as PublicReportTargetType,
    )
      ? (targetType as PublicReportTargetType)
      : "unknown",
    targetId: getFormText(formData, "targetId")?.trim() ?? "",
    reason: moderationReportReasonValues.includes(
      reason as ModerationReportReason,
    )
      ? (reason as ModerationReportReason)
      : "unknown",
    details: getFormText(formData, "details")?.trim() ?? "",
  };
}

function getFieldErrors(error: ZodError) {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (typeof field === "string" && fieldErrors[field] === undefined) {
      fieldErrors[field] = issue.message;
    }
  }

  return fieldErrors;
}

function deniedResult(
  values: PublicContentReportFormValues,
  reason: PublicContentReportResult extends infer Result
    ? Result extends { status: "denied"; reason: infer Reason }
      ? Reason
      : never
    : never,
): PublicContentReportResult {
  return {
    status: "denied",
    values,
    reason,
    formError: getDeniedMessage(reason),
  };
}

function getDeniedMessage(
  reason:
    | "login_required"
    | "profile_required"
    | "suspended"
    | "not_found"
    | "unavailable"
    | "rate_limited"
    | "already_reported",
) {
  switch (reason) {
    case "login_required":
      return "Log in with a completed profile to report public content.";
    case "profile_required":
      return "Complete your profile before reporting public content.";
    case "suspended":
      return "Reporting is unavailable while your account is suspended.";
    case "not_found":
      return "The reported content could not be found.";
    case "unavailable":
      return "Only visible public content can be reported.";
    case "rate_limited":
      return "Report activity is temporarily limited. Try again later.";
    case "already_reported":
      return "You have already reported this content.";
  }
}

function isOpenReportUniqueViolation(error: unknown) {
  let current: unknown = error;

  for (let depth = 0; depth < 5; depth += 1) {
    if (
      typeof current === "object" &&
      current !== null &&
      "code" in current &&
      current.code === "23505" &&
      "constraint" in current &&
      current.constraint === "reports_open_reporter_target_unique"
    ) {
      return true;
    }

    if (
      typeof current !== "object" ||
      current === null ||
      !("cause" in current)
    ) {
      return false;
    }

    current = current.cause;
  }

  return false;
}

function getFormText(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : undefined;
}
