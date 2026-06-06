import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { auth } from "~/features/auth/auth.server";
import { clearTemporaryInviteCookieHeader } from "~/features/auth/invite.server";

export async function loader({ request, url }: LoaderFunctionArgs) {
  if (isAuthHealthCheck(url)) {
    return Response.json({ status: "ok" });
  }

  return handleAuthRequest(request);
}

export async function action({ request }: ActionFunctionArgs) {
  return handleAuthRequest(request);
}

function isAuthHealthCheck(url: URL) {
  return url.pathname === "/api/auth/ok";
}

async function handleAuthRequest(request: Request) {
  const response = await auth.handler(request);

  if (shouldClearTemporaryInviteCookie(new URL(request.url).pathname)) {
    return withClearedTemporaryInviteCookie(response);
  }

  return response;
}

function shouldClearTemporaryInviteCookie(pathname: string) {
  return pathname.includes("/callback/") || pathname.endsWith("/magic-link/verify");
}

function withClearedTemporaryInviteCookie(response: Response) {
  const headers = new Headers(response.headers);
  headers.append("Set-Cookie", clearTemporaryInviteCookieHeader());

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}
