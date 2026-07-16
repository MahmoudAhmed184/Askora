import { PassThrough } from "node:stream";
import { randomUUID } from "node:crypto";
import { createReadableStreamFromReadable } from "@react-router/node";
import type { AppLoadContext, EntryContext } from "react-router";
import { ServerRouter } from "react-router";
import { renderToPipeableStream } from "react-dom/server";

const ABORT_DELAY = 5_000;

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: AppLoadContext,
) {
  void _loadContext;

  return new Promise<Response>((resolve, reject) => {
    const body = new PassThrough();
    const stream = createReadableStreamFromReadable(body);

    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
        onShellReady() {
          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );
          pipe(body);
        },
        onShellError(error) {
          handleError(error, { request });
          reject(normalizeError(error));
        },
        onError(error) {
          responseStatusCode = 500;
          handleError(error, { request });
        },
      },
    );

    setTimeout(abort, ABORT_DELAY);
  });
}

export function handleError(
  error: unknown,
  { request }: { request: Request },
) {
  if (request.signal.aborted || isAbortError(error)) {
    return;
  }

  console.error(
    JSON.stringify({
      event: "request_error",
      errorId: randomUUID(),
      method: request.method,
      url: request.url,
      userAgent: request.headers.get("user-agent"),
      error: serializeError(error),
    }),
  );
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: "UnknownError",
    message: String(error),
  };
}

function normalizeError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}
