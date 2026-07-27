import { UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "~/components/ui/avatar/avatar";
import { getAvatarImageSource } from "~/features/profiles/avatar-url";
import { cn } from "~/lib/utils";

export interface ProfileIdentitySummary {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

type ProfileAvatarSize = "sm" | "md" | "lg";

const avatarSizeClasses = {
  sm: "size-9 text-sm",
  md: "size-11 text-lg",
  lg: "size-14 text-xl",
} as const satisfies Record<ProfileAvatarSize, string>;

export function ProfileAvatar({
  className,
  profile,
  size = "md",
}: {
  profile: ProfileIdentitySummary;
  size?: ProfileAvatarSize | undefined;
  className?: string | undefined;
}) {
  return (
    <Avatar
      className={cn("border bg-muted", avatarSizeClasses[size], className)}
    >
      {profile.avatarUrl === null ? null : (
        <AvatarImage
          alt=""
          decoding="async"
          loading="lazy"
          src={getAvatarImageSource(profile.avatarUrl)}
        />
      )}
      <AvatarFallback>
        {profile.displayName.slice(0, 1).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

export function AnonymousAvatar({
  className,
  size = "md",
}: {
  size?: ProfileAvatarSize | undefined;
  className?: string | undefined;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border border-dashed bg-secondary text-muted-foreground",
        avatarSizeClasses[size],
        className,
      )}
    >
      <UserRound className={size === "sm" ? "size-4" : "size-5"} />
    </span>
  );
}

export function ProfileIdentityLink({
  className,
  meta,
  profile,
  trailing,
}: {
  profile: ProfileIdentitySummary;
  meta?: ReactNode;
  trailing?: ReactNode;
  className?: string | undefined;
}) {
  const profileHref = `/${profile.username}`;

  return (
    <div
      className={cn("flex min-w-0 flex-1 items-center gap-3", className)}
      data-slot="profile-identity"
    >
      <Link
        aria-label={`View ${profile.displayName}'s profile`}
        className="shrink-0 rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35"
        to={profileHref}
      >
        <ProfileAvatar profile={profile} />
      </Link>
      <div className="flex min-w-0 flex-col">
        <Link
          className="w-fit max-w-full truncate font-semibold leading-tight text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/35"
          to={profileHref}
        >
          {profile.displayName}
        </Link>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 font-mono text-xs text-muted-foreground">
          <span className="min-w-0 max-w-full truncate">
            @{profile.username}
          </span>
          {meta}
        </div>
      </div>
      {trailing}
    </div>
  );
}
