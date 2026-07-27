import type { CurrentSessionSummary } from "~/features/auth/services/auth.service.server";
import {
  loadPublicThreadPage,
  type PublicThreadLoadResult,
  type PublicThreadPageData,
} from "~/features/threads/queries/public-thread.queries.server";
import { createFollowUpTimingToken } from "~/features/threads/services/follow-up.service.server";
import {
  createCanonicalThreadPath,
  getThreadModalParams,
  type ThreadModalData,
} from "~/features/threads/thread-modal";

export async function loadThreadModalData({
  now = new Date(),
  request,
  session,
}: {
  request: Request;
  session: CurrentSessionSummary;
  now?: Date | undefined;
}): Promise<ThreadModalData | undefined> {
  const params = getThreadModalParams(new URL(request.url).searchParams);

  if (params === undefined) {
    return undefined;
  }

  const result = await loadModalThreadResult({ params, session });
  const canonicalPath = createCanonicalThreadPath(
    getThreadCanonicalParams(result.page),
  );

  if (
    result.page.status === "available" &&
    result.page.followUp.status === "allowed"
  ) {
    if (result.owner === undefined) {
      throw new Error("Available thread modal is missing its owner.");
    }

    return {
      canonicalPath,
      page: result.page,
      followUpComposer: {
        status: "available",
        timingToken: createFollowUpTimingToken({
          now,
          profileId: result.owner.profileId,
          threadPublicId: result.page.thread.publicId,
          username: result.owner.username,
        }),
      },
    };
  }

  return {
    canonicalPath,
    page: result.page,
    followUpComposer: { status: "unavailable" },
  };
}

async function loadModalThreadResult({
  params,
  session,
}: {
  params: {
    threadPublicId: string;
    username: string;
  };
  session: CurrentSessionSummary;
}): Promise<Extract<PublicThreadLoadResult, { status: "page" }>> {
  const result = await loadPublicThreadPage({
    session,
    threadPublicId: params.threadPublicId,
    username: params.username,
  });

  if (result.status !== "redirect") {
    return result;
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

  return canonicalResult;
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
