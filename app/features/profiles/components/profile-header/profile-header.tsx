import { Settings, Share2 } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";

import { Badge } from "~/components/ui/badge/badge";
import { Button } from "~/components/ui/button/button";
import { getAvatarImageSource } from "~/features/profiles/avatar-url";
import type { PublicProfileView } from "~/features/profiles/types/profiles.types";
import { FollowButton } from "~/features/social/components/follow-button";
import type { FollowControlState } from "~/features/social/types/social.types";
import { PublicReportDialog } from "~/features/moderation/components/public-report-dialog";

interface ProfileHeaderProps {
  profile: PublicProfileView;
  canReport?: boolean | undefined;
  follow?: FollowControlState | undefined;
  isOwnerView?: boolean | undefined;
}

export function ProfileHeader({
  follow,
  canReport = false,
  isOwnerView = false,
  profile,
}: ProfileHeaderProps) {
  return (
    <section className="overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-[var(--shadow-card)] transition-[border-color] duration-[250ms] ease-[ease] hover:border-border-strong">
      {/* Banner — purple gradient with grid overlay */}
      <div
        aria-hidden="true"
        className="relative h-40 overflow-hidden bg-[image:var(--gradient-brand)] sm:h-52"
      >
        <div className="absolute inset-0 opacity-15 [background-image:linear-gradient(to_right,var(--primary)_1px,transparent_1px),linear-gradient(to_bottom,var(--primary)_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>

      {/* Identity + actions row */}
      <div className="flex flex-col gap-6 px-6 pb-6 pt-0 sm:px-8 sm:pb-8 sm:pt-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
            <div className="relative z-10 -mt-14 shrink-0 sm:-mt-20">
              <ProfileAvatar profile={profile} />
            </div>
            <div className="flex min-w-0 flex-col gap-1 sm:pb-1 sm:pt-3">
              <h1 className="break-words font-serif text-[1.85rem] font-bold leading-tight text-foreground sm:text-[2.2rem]">
                {profile.displayName}
              </h1>
              <p className="break-all font-mono text-[0.78rem] text-muted-foreground">
                @{profile.username}
              </p>
              {profile.bio === null ? null : (
                <p className="mt-1 max-w-2xl whitespace-pre-wrap break-words text-[0.96rem] leading-7 text-muted-foreground">
                  {profile.bio}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-start gap-3 sm:pt-3">
            {isOwnerView ? (
              <OwnerProfileActions profile={profile} />
            ) : follow === undefined ? null : (
              <>
                <FollowButton follow={follow} />
                <PublicReportDialog
                  canReport={canReport}
                  targetId={profile.username}
                  targetLabel="profile"
                  targetType="profile"
                />
              </>
            )}
          </div>
        </div>

        {/* Stats row — editorial treatment */}
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
        <Link to="/settings/profile">
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
  const sharedRing =
    "ring-[3px] ring-primary/20 ring-offset-2 ring-offset-card";

  if (profile.avatarUrl !== null) {
    return (
      <img
        alt=""
        className={`size-[84px] shrink-0 rounded-full border-[3px] border-card bg-muted object-cover sm:size-[108px] ${sharedRing}`}
        src={getAvatarImageSource(profile.avatarUrl)}
      />
    );
  }

  return (
    <span
      className={`flex size-[84px] shrink-0 items-center justify-center rounded-full border-[3px] border-card bg-secondary font-serif text-[1.7rem] font-bold text-primary sm:size-[108px] sm:text-[2.1rem] ${sharedRing}`}
    >
      {profile.displayName.slice(0, 1).toUpperCase()}
    </span>
  );
}

function ProfileCounts({ profile }: ProfileHeaderProps) {
  const items: { label: string; value: number }[] = [
    { label: "answers", value: profile.counts.answers },
  ];

  if (profile.counts.followers !== undefined) {
    items.push({ label: "followers", value: profile.counts.followers });
  }

  if (profile.counts.following !== undefined) {
    items.push({ label: "following", value: profile.counts.following });
  }

  if (profile.counts.reactions !== undefined) {
    items.push({ label: "reactions", value: profile.counts.reactions });
  }

  return (
    <dl className="flex items-stretch gap-0 rounded-xl border bg-secondary/50">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={`flex flex-1 flex-col items-center gap-0.5 px-4 py-3 sm:px-6 sm:py-4 ${index > 0 ? "border-l" : ""}`}
        >
          <dd className="font-mono text-lg font-bold tabular-nums leading-none text-foreground sm:text-xl">
            {item.value}
          </dd>
          <dt className="font-serif text-[0.7rem] italic text-muted-foreground sm:text-xs">
            {item.label}
          </dt>
        </div>
      ))}
    </dl>
  );
}

export function BetaNoindexBadge() {
  return <Badge variant="outline">Noindex beta</Badge>;
}
