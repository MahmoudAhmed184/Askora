import { Heart } from "lucide-react";
import { useFetcher, useLocation } from "react-router";

import { ActionToast } from "~/components/shared/action-toast/action-toast";
import { ToastResultInput } from "~/components/shared/toast-result/toast-result-input";
import { Button } from "~/components/ui/button/button";
import type { LikeActionResult } from "~/features/social/types/social.types";
import type { LikeControlState } from "~/features/social/types/social.types";

interface LikeButtonProps {
  like: LikeControlState;
}

interface LikeActionFetcherData {
  like: LikeActionResult;
}

export function LikeButton({ like }: LikeButtonProps) {
  const fetcher = useFetcher<LikeActionFetcherData>();
  const location = useLocation();
  const pendingIntent = fetcher.formData?.get("intent");
  const isLiked =
    pendingIntent === "like"
      ? true
      : pendingIntent === "unlike"
        ? false
        : like.isLiked;
  const count = getOptimisticCount({ isLiked, like, pendingIntent });
  const disabled = like.disabled || fetcher.state !== "idle";
  const result = fetcher.data?.like;
  const toastCopy = getLikeToastCopy(result);

  return (
    <fetcher.Form action="/likes" method="post">
      <ActionToast
        message={toastCopy.message}
        tone={toastCopy.tone}
        trigger={result}
      />
      <ToastResultInput />
      <input name="intent" type="hidden" value={isLiked ? "unlike" : "like"} />
      <input
        name="threadItemPublicId"
        type="hidden"
        value={like.threadItemPublicId}
      />
      <input name="returnTo" type="hidden" value={getReturnTo(location)} />
      <Button
        aria-label={getLikeButtonLabel({ count, isLiked })}
        aria-pressed={isLiked}
        disabled={disabled}
        size="sm"
        type="submit"
        variant={isLiked ? "secondary" : "outline"}
      >
        <Heart data-icon="inline-start" />
        {count === undefined ? (
          isLiked ? "Liked" : "Like"
        ) : (
          <span className="tabular-nums">{count}</span>
        )}
      </Button>
    </fetcher.Form>
  );
}

function getLikeButtonLabel({
  count,
  isLiked,
}: {
  count: number | undefined;
  isLiked: boolean;
}) {
  const action = isLiked ? "Unlike answer" : "Like answer";

  return count === undefined ? action : `${action} (${String(count)})`;
}

function getLikeToastCopy(result: LikeActionResult | undefined): {
  message: string | undefined;
  tone: "error" | "success";
} {
  switch (result?.status) {
    case undefined:
      return { message: undefined, tone: "success" };
    case "liked":
      return { message: "Reaction added.", tone: "success" };
    case "unliked":
      return { message: "Reaction removed.", tone: "success" };
    case "invalid":
    case "denied":
      return { message: result.formError, tone: "error" };
  }
}

function getOptimisticCount({
  isLiked,
  like,
  pendingIntent,
}: {
  like: LikeControlState;
  isLiked: boolean;
  pendingIntent: FormDataEntryValue | null | undefined;
}) {
  if (like.count === undefined) {
    return undefined;
  }

  if (pendingIntent === "like" && !like.isLiked && isLiked) {
    return like.count + 1;
  }

  if (pendingIntent === "unlike" && like.isLiked && !isLiked) {
    return Math.max(0, like.count - 1);
  }

  return like.count;
}

function getReturnTo(location: ReturnType<typeof useLocation>) {
  return `${location.pathname}${location.search}${location.hash}`;
}
