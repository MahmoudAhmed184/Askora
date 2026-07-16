import { data } from "react-router";

import { getCurrentSessionSummaryFromContext } from "~/features/auth/services/auth.service.server";
import {
  submitPublicContentReport,
  type PublicContentReportResult,
} from "~/features/moderation/services/public-report.service.server";

import type { Route } from "./+types/report.route";

export interface PublicReportRouteActionData {
  report: PublicContentReportResult;
}

export async function action({ context, request }: Route.ActionArgs) {
  const result = await submitPublicContentReport({
    formData: await request.formData(),
    session: getCurrentSessionSummaryFromContext(context),
  });

  return data<PublicReportRouteActionData>(
    { report: result },
    { status: getReportResponseStatus(result) },
  );
}

function getReportResponseStatus(result: PublicContentReportResult) {
  if (result.status === "created") {
    return 201;
  }

  if (result.status === "invalid") {
    return 400;
  }

  switch (result.reason) {
    case "not_found":
      return 404;
    case "unavailable":
      return 409;
    case "login_required":
    case "profile_required":
    case "suspended":
      return 403;
    case "rate_limited":
      return 429;
    case "already_reported":
      return 409;
  }
}
