import { isAllowedProxiedAvatarUrl } from "~/features/profiles/avatar-url";

const avatarFetchTimeoutMilliseconds = 5_000;
const maxAvatarBytes = 5 * 1024 * 1024;
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

  const body = await readAvatarBody(avatarResponse);

  if (body === null) {
    return new Response("Avatar unavailable", { status: 502 });
  }

  return new Response(body, {
    headers: createAvatarResponseHeaders(avatarResponse, body.byteLength),
    status: 200,
  });
}

async function fetchAvatar(source: string) {
  try {
    const response = await fetch(source, {
      redirect: "error",
      signal: AbortSignal.timeout(avatarFetchTimeoutMilliseconds),
    });

    if (!response.ok) {
      return null;
    }

    const contentLength = response.headers.get("Content-Length");

    return contentLength !== null && Number(contentLength) > maxAvatarBytes
      ? null
      : response;
  } catch {
    return null;
  }
}

function isImageResponse(response: Response) {
  const contentType = response.headers.get("Content-Type")?.toLowerCase();

  return (
    contentType?.startsWith("image/") === true &&
    !contentType.startsWith("image/svg+xml")
  );
}

async function readAvatarBody(response: Response) {
  const reader = response.body?.getReader();

  if (reader === undefined) {
    return new Uint8Array();
  }
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    let result = await reader.read();

    while (!result.done) {
      const { value } = result;
      totalBytes += value.byteLength;

      if (totalBytes > maxAvatarBytes) {
        await reader.cancel();
        return null;
      }

      chunks.push(value);
      result = await reader.read();
    }
  } catch {
    return null;
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return body;
}

function createAvatarResponseHeaders(response: Response, bodyLength: number) {
  const headers = new Headers();
  const contentType = response.headers.get("Content-Type");
  const contentLength = response.headers.get("Content-Length");

  if (contentType !== null) {
    headers.set("Content-Type", contentType);
  }

  headers.set("Content-Length", contentLength ?? String(bodyLength));

  headers.set("Cache-Control", proxiedAvatarCacheControl);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Security-Policy", "default-src 'none'; sandbox");

  return headers;
}
