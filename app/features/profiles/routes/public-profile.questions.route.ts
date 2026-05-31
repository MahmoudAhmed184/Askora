import { redirect } from "react-router";

import { createPublicAskFlashCookieHeader } from "~/features/profiles/ask-friction.server";
import {
  getPublicAskFlashForResult,
  submitPublicQuestion,
} from "~/features/profiles/ask-question.action.server";

import type { Route } from "./+types/public-profile.questions.route";

export async function action({ params, request }: Route.ActionArgs) {
  const username = params.username;

  const { getCurrentSessionSummary } = await import(
    "~/features/auth/auth.server"
  );
  const session = await getCurrentSessionSummary(request);
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
