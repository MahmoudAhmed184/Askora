import { isAllowedProxiedAvatarUrl } from "~/features/profiles/avatar-url";

const avatarFetchTimeoutMilliseconds = 5_000;
const proxiedAvatarCacheControl =
  "public, max-age=86400, stale-while-revalidate=604800";

export async function loader({ request }: { request: Request }) {
  const source = new URL(request.url).searchParams.get("src");

  if (source === null || !isAllowedProxiedAvatarUrl(source)) {
    return new Response("Invalid avatar source", { status: 400 });
  }

  const avatarResponse = await fetchAvatar(source);

  if (avatarResponse === null || !isImageResponse(avatarResponse)) {
    return new Response("Avatar unavailable", { status: 502 });
  }

  return new Response(avatarResponse.body, {
    headers: createAvatarResponseHeaders(avatarResponse),
    status: 200,
  });
}

async function fetchAvatar(source: string) {
  try {
    const response = await fetch(source, {
      signal: AbortSignal.timeout(avatarFetchTimeoutMilliseconds),
    });

    return response.ok ? response : null;
  } catch {
    return null;
  }
}

function isImageResponse(response: Response) {
  return response.headers.get("Content-Type")?.startsWith("image/") === true;
}

function createAvatarResponseHeaders(response: Response) {
  const headers = new Headers();
  const contentType = response.headers.get("Content-Type");
  const contentLength = response.headers.get("Content-Length");

  if (contentType !== null) {
    headers.set("Content-Type", contentType);
  }

  if (contentLength !== null) {
    headers.set("Content-Length", contentLength);
  }

  headers.set("Cache-Control", proxiedAvatarCacheControl);
  headers.set("X-Content-Type-Options", "nosniff");

  return headers;
}
