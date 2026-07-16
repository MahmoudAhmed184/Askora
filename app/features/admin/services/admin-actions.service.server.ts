import { and, eq, isNull, lte, not, or } from "drizzle-orm";
import type { ZodError } from "zod";

import { getRuntimeDatabase, type RuntimeDatabase } from "~/db/client.server";
import { adminActions, authUsers, profiles, reports, threadItems, threads } from "~/db/schema";
import {
  adminActionFormSchema,
  adminActionValues,
  type AdminActionSubmission,
  type AdminActionType,
} from "~/features/admin/validations/admin.validations";
import type { AdminSession } from "~/features/admin/services/admin-auth.service.server";
import {
  createDrizzleAdminReportLoaderStore,
  getAdminActionTargetReferences,
  getAvailableAdminActions,
  type StoredAdminReport,
} from "~/features/admin/queries/admin.queries.server";
import { createDatabaseId } from "~/lib/ids.server";
import { parseFormData } from "~/lib/zod-form";

export interface AdminActionFormValues {
  actionType: AdminActionType | "unknown";
  notes: string;
}

export interface AdminActionFieldErrors {
  actionType?: string;
  notes?: string;
}

export type AdminActionDeniedReason = "not_found" | "unavailable";

export type AdminReportActionResult =
  | {
      status: "dismissed" | "actioned";
      actionType: AdminActionType;
      reportId: string;
    }
  | {
      status: "invalid";
      values: AdminActionFormValues;
      fieldErrors: AdminActionFieldErrors;
      formError: string;
    }
  | {
      status: "denied";
      values: AdminActionFormValues;
      reason: AdminActionDeniedReason;
      formError: string;
    };

export interface AdminActionMutationParams {
  id: string;
  report: StoredAdminReport;
  form: AdminActionSubmission;
  adminUserId: string;
  now: Date;
}

export interface AdminReportActionStore {
  findReportById(reportId: string): Promise<StoredAdminReport | undefined>;
  applyAdminAction(params: AdminActionMutationParams): Promise<boolean>;
}

export async function handleAdminReportAction({
  createId = createDatabaseId,
  formData,
  now = new Date(),
  reportId,
  session,
  store = createDrizzleAdminReportActionStore(),
}: {
  formData: FormData;
  reportId: string;
  session: AdminSession;
  store?: AdminReportActionStore;
  createId?: () => string;
  now?: Date;
}): Promise<AdminReportActionResult> {
  const values = getAdminActionFormValues(formData);
  const parsed = parseFormData(adminActionFormSchema, formData);

  if (!parsed.ok) {
    return {
      status: "invalid",
      values,
      fieldErrors: getAdminActionFieldErrors(parsed.error),
      formError: "Check the moderation action and try again.",
    };
  }

  const report = await store.findReportById(reportId);

  if (report === undefined) {
    return deniedResult(values, "not_found");
  }

  if (!getAvailableAdminActions(report).includes(parsed.value.actionType)) {
    return deniedResult(values, "unavailable");
  }

  const applied = await store.applyAdminAction({
    id: createId(),
    report,
    form: parsed.value,
    adminUserId: session.user.id,
    now,
  });

  if (!applied) {
    return deniedResult(values, "unavailable");
  }

  return {
    status: parsed.value.actionType === "dismiss" ? "dismissed" : "actioned",
    actionType: parsed.value.actionType,
    reportId,
  };
}

export function createDrizzleAdminReportActionStore(
  database: RuntimeDatabase = getRuntimeDatabase(),
): AdminReportActionStore {
  const reportLoader = createDrizzleAdminReportLoaderStore(database);

  return {
    findReportById(reportId) {
      return reportLoader.findReportById(reportId);
    },
    async applyAdminAction(params) {
      return database.transaction(async (transaction) => {
        const references = getAdminActionTargetReferences(params.report);
        const [claimedReport] = await transaction
          .update(reports)
          .set({
            status:
              params.form.actionType === "dismiss" ? "dismissed" : "actioned",
            reviewedAt: params.now,
            updatedAt: params.now,
          })
          .where(
            and(
              eq(reports.id, params.report.report.id),
              eq(reports.status, "open"),
            ),
          )
          .returning({ id: reports.id });

        if (claimedReport === undefined) {
          return false;
        }

        await applyTargetMutation({
          references,
          params,
          transaction,
        });

        await transaction.insert(adminActions).values({
          id: params.id,
          reportId: params.report.report.id,
          adminUserId: params.adminUserId,
          actionType: params.form.actionType,
          reportTargetType: params.report.report.targetType,
          reportTargetId: params.report.report.targetId,
          targetUserId: references.targetUserId,
          targetProfileId: references.targetProfileId,
          targetQuestionId: references.targetQuestionId,
          targetThreadItemId: references.targetThreadItemId,
          notes: params.form.notes ?? null,
          createdAt: params.now,
          updatedAt: params.now,
        });

        return true;
      });
    },
  };
}

async function applyTargetMutation({
  references,
  params,
  transaction,
}: {
  references: ReturnType<typeof getAdminActionTargetReferences>;
  params: AdminActionMutationParams;
  transaction: Parameters<Parameters<RuntimeDatabase["transaction"]>[0]>[0];
}) {
  if (params.form.actionType === "warn") {
    await updateTargetUserSuspension({
      status: "warned",
      suspendedUntil: null,
      references,
      params,
      transaction,
    });
    return;
  }

  if (params.form.actionType === "suspend_7_days") {
    await updateTargetUserSuspension({
      status: "suspended",
      suspendedUntil: addDays(params.now, 7),
      references,
      params,
      transaction,
    });
    return;
  }

  if (params.form.actionType === "suspend_30_days") {
    await updateTargetUserSuspension({
      status: "suspended",
      suspendedUntil: addDays(params.now, 30),
      references,
      params,
      transaction,
    });
    return;
  }

  if (params.form.actionType === "permanent_suspension") {
    await updateTargetUserSuspension({
      status: "permanent",
      suspendedUntil: null,
      references,
      params,
      transaction,
    });
    return;
  }

  if (params.form.actionType === "hide_profile") {
    if (references.targetProfileId === null) {
      return;
    }

    await transaction
      .update(profiles)
      .set({
        isActive: false,
        deactivatedAt: params.now,
        deactivationReason: "admin",
        updatedAt: params.now,
      })
      .where(eq(profiles.id, references.targetProfileId));
    return;
  }

  if (params.form.actionType === "remove_public_content") {
    await removePublicThreadItem({
      params,
      transaction,
    });
  }
}

async function updateTargetUserSuspension({
  references,
  params,
  status,
  suspendedUntil,
  transaction,
}: {
  references: ReturnType<typeof getAdminActionTargetReferences>;
  params: AdminActionMutationParams;
  status: "warned" | "suspended" | "permanent";
  suspendedUntil: Date | null;
  transaction: Parameters<Parameters<RuntimeDatabase["transaction"]>[0]>[0];
}) {
  if (references.targetUserId === null) {
    return;
  }

  const suspensionPredicate = getSuspensionChangePredicate({
    nextStatus: status,
    nextSuspendedUntil: suspendedUntil,
    now: params.now,
  });

  await transaction
    .update(authUsers)
    .set({
      suspensionStatus: status,
      suspendedUntil,
      updatedAt: params.now,
    })
    .where(
      and(eq(authUsers.id, references.targetUserId), suspensionPredicate),
    );
}

export function isSuspensionChangeAllowed(
  currentStatus: "warned" | "suspended" | "permanent" | null,
  nextStatus: "warned" | "suspended" | "permanent",
) {
  if (nextStatus === "warned") {
    return currentStatus === null || currentStatus === "warned";
  }

  if (nextStatus === "suspended") {
    return currentStatus !== "permanent";
  }

  return true;
}

function getSuspensionChangePredicate({
  nextStatus,
  nextSuspendedUntil,
  now,
}: {
  nextStatus: "warned" | "suspended" | "permanent";
  nextSuspendedUntil: Date | null;
  now: Date;
}) {
  if (nextStatus === "warned") {
    return or(
      isNull(authUsers.suspensionStatus),
      eq(authUsers.suspensionStatus, "warned"),
      lte(authUsers.suspendedUntil, now),
    );
  }

  if (nextStatus === "suspended") {
    return or(
      isNull(authUsers.suspensionStatus),
      eq(authUsers.suspensionStatus, "warned"),
      and(
        eq(authUsers.suspensionStatus, "suspended"),
        nextSuspendedUntil === null
          ? isNull(authUsers.suspendedUntil)
          : lte(authUsers.suspendedUntil, nextSuspendedUntil),
      ),
    );
  }

  return or(
    isNull(authUsers.suspensionStatus),
    not(eq(authUsers.suspensionStatus, "permanent")),
  );
}

async function removePublicThreadItem({
  params,
  transaction,
}: {
  params: AdminActionMutationParams;
  transaction: Parameters<Parameters<RuntimeDatabase["transaction"]>[0]>[0];
}) {
  const target = params.report.target;

  if (target?.type !== "thread_item") {
    return;
  }

  await transaction
    .update(threadItems)
    .set({
      status: "deleted",
      deletedAt: params.now,
      deletedBy: "admin",
      updatedAt: params.now,
    })
    .where(eq(threadItems.id, target.id));

  if (target.questionId !== target.initialQuestionId) {
    return;
  }

  await transaction
    .update(threads)
    .set({
      status: "deleted",
      updatedAt: params.now,
    })
    .where(eq(threads.id, target.threadId));
}

function deniedResult(
  values: AdminActionFormValues,
  reason: AdminActionDeniedReason,
): AdminReportActionResult {
  return {
    status: "denied",
    values,
    reason,
    formError: getDeniedMessage(reason),
  };
}

function getAdminActionFormValues(formData: FormData): AdminActionFormValues {
  const actionType = getFormText(formData, "actionType");

  return {
    actionType: isAdminActionType(actionType) ? actionType : "unknown",
    notes: getFormText(formData, "notes")?.trim() ?? "",
  };
}

function getAdminActionFieldErrors(error: ZodError): AdminActionFieldErrors {
  const fieldErrors: AdminActionFieldErrors = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (field === "actionType" && fieldErrors.actionType === undefined) {
      fieldErrors.actionType = issue.message;
    }

    if (field === "notes" && fieldErrors.notes === undefined) {
      fieldErrors.notes = issue.message;
    }
  }

  return fieldErrors;
}

function getDeniedMessage(reason: AdminActionDeniedReason) {
  switch (reason) {
    case "not_found":
      return "Report could not be found.";
    case "unavailable":
      return "This action is not available for the reported target.";
  }
}

function isAdminActionType(
  value: string | undefined,
): value is AdminActionType {
  return adminActionValues.includes(value as AdminActionType);
}

function getFormText(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : undefined;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
