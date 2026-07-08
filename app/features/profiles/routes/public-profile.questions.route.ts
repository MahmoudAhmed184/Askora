import { redirect } from "react-router";

import { getCurrentSessionSummaryFromContext } from "~/features/auth/services/auth.service.server";
import { createPublicAskFlashCookieHeader } from "~/features/profiles/services/ask-friction.service.server";
import {
  getPublicAskFlashForResult,
  submitPublicQuestion,
} from "~/features/profiles/services/ask-question.service.server";

import type { Route } from "./+types/public-profile.questions.route";

export function loader({ params }: Route.LoaderArgs) {
  return redirect(`/${params.username}#ask`);
}

export async function action({ context, params, request }: Route.ActionArgs) {
  const username = params.username;

  const session = getCurrentSessionSummaryFromContext(context);
  const result = await submitPublicQuestion({
    formData: await request.formData(),
    request,
    session,
    username,
  });
  const flash = getPublicAskFlashForResult({ result, session });
  const headers = new Headers();

  headers.append(
    "Set-Cookie",
    createPublicAskFlashCookieHeader({ username, result: flash }),
  );

  return redirect(`/${username}#ask`, { headers });
}
