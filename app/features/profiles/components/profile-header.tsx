import { Badge } from "~/components/ui/badge";
import type { PublicProfileView } from "~/features/profiles/profile.loader.server";
import { FollowButton } from "~/features/social/components/follow-button";
import type { FollowControlState } from "~/features/social/social-controls";

interface ProfileHeaderProps {
  profile: PublicProfileView;
  follow?: FollowControlState | undefined;
}

export function ProfileHeader({ follow, profile }: ProfileHeaderProps) {
  return (
    <section className="flex flex-col gap-5 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 gap-4">
        <ProfileAvatar profile={profile} />
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-col gap-1">
            <h1 className="break-words text-3xl font-semibold leading-tight sm:text-4xl">
              {profile.displayName}
            </h1>
            <p className="break-all text-sm font-medium text-muted-foreground">
              @{profile.username}
            </p>
          </div>
          {profile.bio === null ? null : (
            <p className="max-w-2xl whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
              {profile.bio}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-col items-start gap-3 sm:items-end">
        {follow === undefined ? null : <FollowButton follow={follow} />}
        <ProfileCounts profile={profile} />
      </div>
    </section>
  );
}

function ProfileAvatar({ profile }: ProfileHeaderProps) {
  if (profile.avatarUrl !== null) {
    return (
      <img
        alt=""
        className="size-16 shrink-0 rounded-lg border bg-muted object-cover"
        src={profile.avatarUrl}
      />
    );
  }

  return (
    <span className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-primary text-2xl font-semibold text-primary-foreground">
      {profile.displayName.slice(0, 1).toUpperCase()}
    </span>
  );
}

function ProfileCounts({ profile }: ProfileHeaderProps) {
  return (
    <dl className="grid grid-cols-2 gap-2 text-sm sm:min-w-64 sm:grid-cols-2">
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
    <div className="rounded-lg border bg-card px-3 py-2 text-card-foreground">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

export function BetaNoindexBadge() {
  return <Badge variant="outline">Noindex beta</Badge>;
}
