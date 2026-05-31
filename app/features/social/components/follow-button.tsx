import { UserCheck, UserPlus } from "lucide-react";
import { useFetcher, useLocation } from "react-router";

import { Button } from "~/components/ui/button";
import type { FollowActionResult } from "~/features/social/follow.action.server";
import type { FollowControlState } from "~/features/social/social-controls";

interface FollowButtonProps {
  follow: FollowControlState;
}

interface FollowActionFetcherData {
  follow: FollowActionResult;
}

export function FollowButton({ follow }: FollowButtonProps) {
  const fetcher = useFetcher<FollowActionFetcherData>();
  const location = useLocation();

  if (!follow.visible) {
    return null;
  }

  const pendingIntent = fetcher.formData?.get("intent");
  const isFollowing =
    pendingIntent === "follow"
      ? true
      : pendingIntent === "unfollow"
        ? false
        : follow.isFollowing;
  const disabled = follow.disabled || fetcher.state !== "idle";

  return (
    <fetcher.Form action="/dashboard/follows" method="post">
      <input
        name="intent"
        type="hidden"
        value={isFollowing ? "unfollow" : "follow"}
      />
      <input name="username" type="hidden" value={follow.username} />
      <input name="returnTo" type="hidden" value={getReturnTo(location)} />
      <Button
        aria-pressed={isFollowing}
        disabled={disabled}
        size="sm"
        type="submit"
        variant={isFollowing ? "secondary" : "default"}
      >
        {isFollowing ? (
          <UserCheck data-icon="inline-start" />
        ) : (
          <UserPlus data-icon="inline-start" />
        )}
        {isFollowing ? "Following" : "Follow"}
      </Button>
    </fetcher.Form>
  );
}

function getReturnTo(location: ReturnType<typeof useLocation>) {
  return `${location.pathname}${location.search}${location.hash}`;
}
