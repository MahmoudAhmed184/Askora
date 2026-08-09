import { serverEnv } from "~/lib/env.server";

/**
 * Validate browser origin metadata for authenticated mutations. Better Auth's
 * trusted-origin list is the deployment source of truth, so sibling origins
 * cannot submit cookie-backed forms. Requests without either browser header
 * remain supported for native clients and existing no-JavaScript flows.
 */
export function requireTrustedMutationOrigin(request: Request): Response | undefined {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  if (origin !== null && !isTrustedOrigin(origin)) {
    return forbiddenOriginResponse();
  }

  if (origin === null && referer !== null && !isTrustedOrigin(getOrigin(referer))) {
    return forbiddenOriginResponse();
  }

  return undefined;
}

function isTrustedOrigin(origin: string) {
  if (origin === "null" || origin.length === 0) {
    return false;
  }

  return serverEnv.TRUSTED_ORIGINS.some((trustedOrigin) => {
    try {
      return new URL(trustedOrigin).origin === new URL(origin).origin;
    } catch {
      return false;
    }
  });
}

function getOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

function forbiddenOriginResponse() {
  return new Response("Forbidden", {
    status: 403,
    headers: { "Cache-Control": "no-store" },
  });
}
