import { Heart } from "lucide-react";
import { useFetcher, useLocation } from "react-router";

import { Button } from "~/components/ui/button";
import type { LikeActionResult } from "~/features/social/like.action.server";
import type { LikeControlState } from "~/features/social/social-controls";

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

  return (
    <fetcher.Form action="/dashboard/likes" method="post">
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
        {isLiked ? "Liked" : "Like"}
        {count === undefined ? null : (
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
