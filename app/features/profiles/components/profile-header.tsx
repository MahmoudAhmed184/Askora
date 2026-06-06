import { Settings, Share2 } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import type { PublicProfileView } from "~/features/profiles/profile.loader.server";
import { FollowButton } from "~/features/social/components/follow-button";
import type { FollowControlState } from "~/features/social/social-controls";

interface ProfileHeaderProps {
  profile: PublicProfileView;
  follow?: FollowControlState | undefined;
  isOwnerView?: boolean | undefined;
}

export function ProfileHeader({
  follow,
  isOwnerView = false,
  profile,
}: ProfileHeaderProps) {
  return (
    <section className="overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-[var(--shadow-card)] transition-[border-color] duration-[250ms] ease-[ease] hover:border-border-strong">
      <div
        aria-hidden="true"
        className="relative h-40 overflow-hidden bg-[linear-gradient(135deg,oklch(0.70_0.13_310)_0%,oklch(0.50_0.15_295)_100%)] sm:h-52"
      >
        <div className="absolute inset-0 opacity-15 [background-image:linear-gradient(to_right,var(--primary)_1px,transparent_1px),linear-gradient(to_bottom,var(--primary)_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>
      <div className="flex flex-col gap-6 p-6 pt-0 sm:p-9 sm:pb-10 sm:pt-0">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end">
            <div className="relative z-10 -mt-14 shrink-0 sm:-mt-20">
              <ProfileAvatar profile={profile} />
            </div>
            <div className="flex min-w-0 flex-col gap-2 pb-1 sm:pt-5">
              <div className="flex flex-col gap-1">
                <h1 className="break-words font-serif text-[2rem] font-bold leading-tight text-foreground sm:text-[2.4rem]">
                  {profile.displayName}
                </h1>
                <p className="break-all font-mono text-sm text-muted-foreground">
                  @{profile.username}
                </p>
              </div>
              {profile.bio === null ? null : (
                <p className="max-w-2xl whitespace-pre-wrap break-words text-[0.96rem] leading-7 text-muted-foreground">
                  {profile.bio}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-start gap-3 sm:pt-4">
            {isOwnerView ? (
              <OwnerProfileActions profile={profile} />
            ) : follow === undefined ? null : (
              <FollowButton follow={follow} />
            )}
          </div>
        </div>
        <ProfileCounts profile={profile} />
      </div>
    </section>
  );
}

function OwnerProfileActions({ profile }: { profile: PublicProfileView }) {
  return (
    <>
      <Button
        onClick={() => {
          void copyProfileLink(profile.username);
        }}
        size="sm"
        type="button"
        variant="outline"
      >
        <Share2 data-icon="inline-start" />
        Share
      </Button>
      <Button asChild size="sm">
        <Link to="/dashboard/settings/profile">
          <Settings data-icon="inline-start" />
          Edit profile
        </Link>
      </Button>
    </>
  );
}

async function copyProfileLink(username: string) {
  const profileUrl = new URL(`/${username}`, window.location.origin).toString();

  try {
    await navigator.clipboard.writeText(profileUrl);
    toast.success("Profile URL copied.", { id: "profile-url-copied" });
  } catch {
    toast.error("Could not copy profile URL.", {
      id: "profile-url-copy-unavailable",
    });
  }
}

function ProfileAvatar({ profile }: ProfileHeaderProps) {
  if (profile.avatarUrl !== null) {
    return (
      <img
        alt=""
        className="size-[86px] shrink-0 rounded-full border-4 border-card bg-muted object-cover shadow-[0_4px_12px_oklch(0.17_0.035_292_/_0.08)] sm:size-[110px]"
        src={profile.avatarUrl}
      />
    );
  }

  return (
    <span className="flex size-[86px] shrink-0 items-center justify-center rounded-full border-4 border-card bg-secondary font-serif text-[1.8rem] font-bold text-primary shadow-[0_4px_12px_oklch(0.17_0.035_292_/_0.08)] sm:size-[110px] sm:text-[2.2rem]">
      {profile.displayName.slice(0, 1).toUpperCase()}
    </span>
  );
}

function ProfileCounts({ profile }: ProfileHeaderProps) {
  return (
    <dl className="flex flex-wrap gap-3 text-sm">
      <ProfileCount label="answers" value={profile.counts.answers} />
      {profile.counts.followers === undefined ? null : (
        <ProfileCount label="followers" value={profile.counts.followers} />
      )}
      {profile.counts.following === undefined ? null : (
        <ProfileCount label="following" value={profile.counts.following} />
      )}
      {profile.counts.reactions === undefined ? null : (
        <ProfileCount label="reactions" value={profile.counts.reactions} />
      )}
    </dl>
  );
}

function ProfileCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border bg-secondary px-3 py-1.5 text-secondary-foreground">
      <dt className="order-2 text-xs font-semibold text-muted-foreground">
        {label}
      </dt>
      <dd className="font-mono text-xs font-bold tabular-nums text-foreground">
        {value}
      </dd>
    </div>
  );
}

export function BetaNoindexBadge() {
  return <Badge variant="outline">Noindex beta</Badge>;
}
