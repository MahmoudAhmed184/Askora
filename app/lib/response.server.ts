export function noindexHeaders() {
  return {
    "X-Robots-Tag": "noindex, nofollow",
  };
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
