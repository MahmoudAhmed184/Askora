import { UserCheck, UserPlus } from "lucide-react";
import { useFetcher, useLocation } from "react-router";

import { ActionToast } from "~/components/shared/action-toast/action-toast";
import { ToastResultInput } from "~/components/shared/toast-result/toast-result-input";
import { Button } from "~/components/ui/button/button";
import type { FollowActionResult } from "~/features/social/types/social.types";
import type { FollowControlState } from "~/features/social/types/social.types";

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
  const result = fetcher.data?.follow;
  const toastCopy = getFollowToastCopy(result);

  return (
    <fetcher.Form action="/follows" method="post">
      <ActionToast
        message={toastCopy.message}
        tone={toastCopy.tone}
        trigger={result}
      />
      <ToastResultInput />
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

function getFollowToastCopy(result: FollowActionResult | undefined): {
  message: string | undefined;
  tone: "error" | "success";
} {
  switch (result?.status) {
    case undefined:
      return { message: undefined, tone: "success" };
    case "followed":
      return { message: "Profile followed.", tone: "success" };
    case "unfollowed":
      return { message: "Profile unfollowed.", tone: "success" };
    case "invalid":
    case "denied":
      return { message: result.formError, tone: "error" };
  }
}

function getReturnTo(location: ReturnType<typeof useLocation>) {
  return `${location.pathname}${location.search}${location.hash}`;
}
