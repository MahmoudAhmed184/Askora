import { data } from "react-router";

import {
  handleAdminReportAction,
  type AdminReportActionResult,
  type AdminReportActionStore,
} from "~/features/admin/admin-actions.server";
import {
  requireAdminSession,
  type AdminSession,
} from "~/features/admin/admin-auth.server";
import {
  loadAdminReportDetail,
  loadAdminReportQueue,
  type AdminReportLoaderStore,
} from "~/features/admin/admin.loader.server";
import { parseAdminQueueStatus } from "~/features/admin/admin.schema";

export interface AdminReportActionRouteData {
  adminAction: AdminReportActionResult;
}

type RequireAdminSession = (request: Request) => Promise<AdminSession | Response>;

export async function loadAdminIndexRoute({
  request,
  requireAdmin = requireAdminSession,
  store,
}: {
  request: Request;
  requireAdmin?: RequireAdminSession;
  store?: AdminReportLoaderStore;
}) {
  const session = await requireAdmin(request);

  if (session instanceof Response) {
    return session;
  }

  const url = new URL(request.url);
  const status = parseAdminQueueStatus(url.searchParams.get("status"));

  return {
    queue: await loadAdminReportQueue({
      status,
      ...(store === undefined ? {} : { store }),
    }),
  };
}

export async function loadAdminReportDetailRoute({
  reportId,
  request,
  requireAdmin = requireAdminSession,
  store,
}: {
  reportId: string;
  request: Request;
  requireAdmin?: RequireAdminSession;
  store?: AdminReportLoaderStore;
}) {
  const session = await requireAdmin(request);

  if (session instanceof Response) {
    return session;
  }

  const result = await loadAdminReportDetail({
    reportId,
    ...(store === undefined ? {} : { store }),
  });

  if (result.status === "not_found") {
    return data({ status: "not_found" as const }, { status: 404 });
  }

  return {
    status: "found" as const,
    detail: result.detail,
  };
}

export async function handleAdminReportActionRoute({
  reportId,
  request,
  requireAdmin = requireAdminSession,
  store,
}: {
  reportId: string;
  request: Request;
  requireAdmin?: RequireAdminSession;
  store?: AdminReportActionStore;
}) {
  const session = await requireAdmin(request);

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
