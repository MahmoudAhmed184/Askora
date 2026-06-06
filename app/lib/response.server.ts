const documentCacheControl = {
  private: "private, no-store",
  public: "public, max-age=30, stale-while-revalidate=120",
} as const;

export function noindexHeaders() {
  return {
    "X-Robots-Tag": "noindex, nofollow",
  };
}

export function createDocumentHeaders({
  hasCookie,
  isAuthenticated,
}: {
  hasCookie: boolean;
  isAuthenticated: boolean;
}) {
  const headers = new Headers();

  headers.set(
    "Cache-Control",
    isAuthenticated || hasCookie
      ? documentCacheControl.private
      : documentCacheControl.public,
  );
  appendVaryHeader(headers, "Cookie");

  return headers;
}

export function mergeNoindexHeaders(headers: Headers, noindex: boolean) {
  if (!noindex) {
    return headers;
  }

  for (const [name, value] of Object.entries(noindexHeaders())) {
    headers.set(name, value);
  }

  return headers;
}

function appendVaryHeader(headers: Headers, value: string) {
  const existing = headers.get("Vary");

  if (existing === null || existing.trim() === "") {
    headers.set("Vary", value);
    return;
  }

  const existingValues = existing
    .split(",")
    .map((headerValue) => headerValue.trim().toLowerCase());

  if (existingValues.includes(value.toLowerCase())) {
    return;
  }

  headers.set("Vary", `${existing}, ${value}`);
}

export function notFoundResponse(message = "Not found") {
  return new Response(message, {
    status: 404,
    statusText: "Not Found",
  });
}

export function methodNotAllowedResponse(message = "Method not allowed") {
  return new Response(message, {
    status: 405,
    statusText: "Method Not Allowed",
  });
}
