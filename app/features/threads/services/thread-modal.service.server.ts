import type {
  CurrentSessionSummary
} from "~/features/auth/services/auth.service.server";;
import {
  loadPublicThreadPage,
  type PublicThreadPageData
} from "~/features/threads/queries/public-thread.queries.server";;
import {
  createCanonicalThreadPath,
  getThreadModalParams,
  type ThreadModalData,
} from "~/features/threads/thread-modal";

export async function loadThreadModalData({
  request,
  session,
}: {
  request: Request;
  session: CurrentSessionSummary;
}): Promise<ThreadModalData | undefined> {
  const params = getThreadModalParams(new URL(request.url).searchParams);

  if (params === undefined) {
    return undefined;
  }

  const page = await loadModalThreadPage({ params, session });

  return {
    canonicalPath: createCanonicalThreadPath(getThreadCanonicalParams(page)),
    page,
  };
}

async function loadModalThreadPage({
  params,
  session,
}: {
  params: {
    threadPublicId: string;
    username: string;
  };
  session: CurrentSessionSummary;
}) {
  const result = await loadPublicThreadPage({
    session,
    threadPublicId: params.threadPublicId,
    username: params.username,
  });

  if (result.status !== "redirect") {
    return result.page;
  }

  const canonicalResult = await loadPublicThreadPage({
    session,
    threadPublicId: params.threadPublicId,
    username: result.username,
  });

  if (canonicalResult.status === "redirect") {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw new Response("Thread redirect could not be resolved.", {
      status: 500,
    });
  }

  return canonicalResult.page;
}

function getThreadCanonicalParams(page: PublicThreadPageData) {
  if (page.status === "available") {
    return {
      threadPublicId: page.thread.publicId,
      username: page.profile.username,
    };
  }

  return {
    threadPublicId: page.threadPublicId,
    username: page.username,
  };
}
