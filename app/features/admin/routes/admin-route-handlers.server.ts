import { data } from "react-router";

import type { AppShellData } from "~/components/app/app-shell-data";
import {
  handleAdminReportAction,
  type AdminReportActionResult,
  type AdminReportActionStore,
} from "~/features/admin/admin-actions.server";
import {
  requireAdminSession,
  requireAdminSessionFromContext,
  type AdminSession,
} from "~/features/admin/admin-auth.server";
import {
  loadAdminReportDetail,
  loadAdminReportQueue,
  type AdminReportLoaderStore,
} from "~/features/admin/admin.loader.server";
import { parseAdminQueueStatus } from "~/features/admin/admin.schema";
import type { CurrentSessionContextReader } from "~/features/auth/auth.server";
import { loadAppShellData } from "~/features/dashboard/app-shell.server";

export interface AdminReportActionRouteData {
  adminAction: AdminReportActionResult;
}

type AdminSessionSource = Request | CurrentSessionContextReader;
type RequireAdminSession = (
  source: AdminSessionSource,
) => Promise<AdminSession | Response>;

export async function loadAdminIndexRoute({
  context,
  request,
  requireAdmin,
  store,
}: {
  context?: CurrentSessionContextReader;
  request: Request;
  requireAdmin?: RequireAdminSession;
  store?: AdminReportLoaderStore;
}) {
  const session = await getAdminSession({ context, request, requireAdmin });

  if (session instanceof Response) {
    return session;
  }

  const url = new URL(request.url);
  const status = parseAdminQueueStatus(url.searchParams.get("status"));

  return {
    shell: await loadAdminShellData(session),
    queue: await loadAdminReportQueue({
      status,
      ...(store === undefined ? {} : { store }),
    }),
  };
}

export async function loadAdminReportDetailRoute({
  context,
  reportId,
  request,
  requireAdmin,
  store,
}: {
  context?: CurrentSessionContextReader;
  reportId: string;
  request: Request;
  requireAdmin?: RequireAdminSession;
  store?: AdminReportLoaderStore;
}) {
  const session = await getAdminSession({ context, request, requireAdmin });

  if (session instanceof Response) {
    return session;
  }

  const shell = await loadAdminShellData(session);
  const result = await loadAdminReportDetail({
    reportId,
    ...(store === undefined ? {} : { store }),
  });

  if (result.status === "not_found") {
    return data({ status: "not_found" as const, shell }, { status: 404 });
  }

  return {
    status: "found" as const,
    detail: result.detail,
    shell,
  };
}

export async function handleAdminReportActionRoute({
  context,
  reportId,
  request,
  requireAdmin,
  store,
}: {
  context?: CurrentSessionContextReader;
  reportId: string;
  request: Request;
  requireAdmin?: RequireAdminSession;
  store?: AdminReportActionStore;
}) {
  const session = await getAdminSession({ context, request, requireAdmin });

  if (session instanceof Response) {
    return session;
  }

  const result = await handleAdminReportAction({
    formData: await request.formData(),
    reportId,
    session,
    ...(store === undefined ? {} : { store }),
  });

  return data<AdminReportActionRouteData>(
    { adminAction: result },
    { status: getAdminReportActionResponseStatus(result) },
  );
}

async function getAdminSession({
  context,
  request,
  requireAdmin,
}: {
  context: CurrentSessionContextReader | undefined;
  request: Request;
  requireAdmin: RequireAdminSession | undefined;
}) {
  if (requireAdmin !== undefined) {
    return requireAdmin(context ?? request);
  }

  return context === undefined
    ? requireAdminSession(request)
    : requireAdminSessionFromContext(context);
}

async function loadAdminShellData(session: AdminSession): Promise<AppShellData> {
  if (session.profileStatus === "complete") {
    return loadAppShellData({ session });
  }

  return {
    session: {
      profile: {
        username: "",
        displayName: session.user.name,
      },
    },
    profileHref: "/setup",
    unreadNotificationCount: 0,
  };
}

function getAdminReportActionResponseStatus(result: AdminReportActionResult) {
  switch (result.status) {
    case "dismissed":
    case "actioned":
      return 200;
    case "invalid":
      return 400;
    case "denied":
      return result.reason === "not_found" ? 404 : 409;
  }
}
